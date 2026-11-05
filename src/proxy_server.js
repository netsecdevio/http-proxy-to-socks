// inspired by https://github.com/asluchevskiy/http-to-socks-proxy
const util = require('util');
const http = require('http');
const fs = require('fs');
const Socks = require('socks');
const { logger } = require('./logger');
const { SocksProxyAgent } = require('socks-proxy-agent');

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getProxyObject(host, port, login, password) {
  return {
    ipaddress: host,
    port: parseInt(port, 10),
    type: 5,
    authentication: { username: login || '', password: password || '' },
  };
}

function parseProxyLine(line) {
  const proxyInfo = line.split(':');

  if (proxyInfo.length !== 4 && proxyInfo.length !== 2) {
    throw new Error(`Incorrect proxy line: ${line}`);
  }

  return getProxyObject.apply(this, proxyInfo);
}

function getFromRawHeaders(rawHeaders) {
  const headers = {};

  if (!Array.isArray(rawHeaders)) {
    return headers;
  }

  for (let i = 0; i < rawHeaders.length; i += 2) {
    const key = rawHeaders[i];
    const value = rawHeaders[i + 1] || '';

    headers[key] = headers[key] || [];
    headers[key].push(value);
  }

  return headers;
}

function normalizeRequestHeaders(rawHeaders, fallbackHeaders = {}) {
  if (!Array.isArray(rawHeaders) || rawHeaders.length === 0) {
    return Object.assign({}, fallbackHeaders);
  }

  const rawMap = getFromRawHeaders(rawHeaders);
  const normalized = {};

  Object.keys(rawMap).forEach((key) => {
    const values = rawMap[key];
    normalized[key] = values.length === 1 ? values[0] : values;
  });

  return normalized;
}

function getSocksUrl(proxy) {
  const protocol = proxy.type === 4 ? 'socks4a' : 'socks5h';
  const hasAuth = proxy.authentication && proxy.authentication.username;
  const auth = hasAuth
    ? `${encodeURIComponent(proxy.authentication.username)}:${encodeURIComponent(proxy.authentication.password || '')}@`
    : '';
  return `${protocol}://${auth}${proxy.ipaddress}:${proxy.port}`;
}

function requestListener(getProxyInfo, request, response) {
  logger.info(`request: ${request.url}`);

  const proxy = getProxyInfo();
  const ph = new URL(request.url);
  const port = ph.port ? parseInt(ph.port, 10) : (ph.protocol === 'https:' ? 443 : 80);
  const reqPath = `${ph.pathname}${ph.search}`;

  const socksAgent = new SocksProxyAgent(getSocksUrl(proxy));

  const options = {
    port,
    hostname: ph.hostname,
    method: request.method,
    path: reqPath,
    headers: normalizeRequestHeaders(request.rawHeaders, request.headers),
    agent: socksAgent,
  };

  const proxyRequest = http.request(options);

  request.on('error', (err) => {
    logger.error(`${err.message}`);
    proxyRequest.destroy(err);
  });

  proxyRequest.on('error', (error) => {
    logger.error(`${error.message} on proxy ${proxy.ipaddress}:${proxy.port}`);
    response.writeHead(500);
    response.end('Connection error\n');
  });

  proxyRequest.on('response', (proxyResponse) => {
    response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
    proxyResponse.pipe(response);
  });

  request.pipe(proxyRequest);
}

function connectListener(getProxyInfo, request, socketRequest, head) {
  logger.info(`connect: ${request.url}`);

  const proxy = getProxyInfo();

  const targetUrl = request.url.includes('://') ? request.url : `http://${request.url}`;
  const ph = new URL(targetUrl);
  const host = ph.hostname;
  const port = ph.port ? parseInt(ph.port, 10) : 443;

  const proxyConfig = {
    host: proxy.ipaddress,
    port: parseInt(proxy.port, 10),
    type: proxy.type,
  };

  if (proxy.authentication && proxy.authentication.username) {
    proxyConfig.userId = proxy.authentication.username;
    proxyConfig.password = proxy.authentication.password || '';
  }

  const options = {
    proxy: proxyConfig,
    destination: { host, port },
    command: 'connect',
  };

  let socket;

  socketRequest.on('error', (err) => {
    logger.error(`${err.message}`);
    if (socket) {
      socket.destroy(err);
    }
  });

  Socks.SocksClient.createConnection(options, (error, info) => {
    if (error) {
      // error in SocksSocket creation
      logger.error(`${error.message} connection creating on ${proxy.ipaddress}:${proxy.port}`);
      socketRequest.write(`HTTP/${request.httpVersion} 500 Connection error\r\n\r\n`);
      return;
    }

    socket = info.socket;

    if (typeof socket.on === 'function') {
      socket.on('error', (err) => {
        logger.error(`${err.message}`);
        if (typeof socketRequest.destroy === 'function') {
          socketRequest.destroy(err);
        }
      });
    }

    // tunneling to the host
    socket.pipe(socketRequest);
    socketRequest.pipe(socket);

    socket.write(head);
    socketRequest.write(`HTTP/${request.httpVersion} 200 Connection established\r\n\r\n`);
    socket.resume();
  });
}

function ProxyServer(options) {
  http.Server.call(this, () => { });

  this.proxyList = [];

  if (options.socks) {
    // stand alone proxy loading
    this.loadProxy(options.socks);
  } else if (options.socksList) {
    // proxy list loading
    this.loadProxyFile(options.socksList);
    if (options.proxyListReloadTimeout) {
      setInterval(
        () => {
          this.loadProxyFile(options.socksList);
        },
        options.proxyListReloadTimeout * 1000,
      );
    }
  }

  this.addListener(
    'request',
    requestListener.bind(null, () => randomElement(this.proxyList)),
  );
  this.addListener(
    'connect',
    connectListener.bind(null, () => randomElement(this.proxyList)),
  );
}

util.inherits(ProxyServer, http.Server);

ProxyServer.prototype.loadProxy = function loadProxy(proxyLine) {
  try {
    this.proxyList.push(parseProxyLine(proxyLine));
  } catch (ex) {
    logger.error(ex.message);
  }
};

ProxyServer.prototype.loadProxyFile = function loadProxyFile(fileName) {
  const self = this;

  logger.info(`Loading proxy list from file: ${fileName}`);

  fs.readFile(fileName, (err, data) => {
    if (err) {
      logger.error(
        `Impossible to read the proxy file : ${fileName} error : ${err.message}`,
      );
      return;
    }

    const lines = data.toString().split('\n');
    const proxyList = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (line !== '' && line.charAt(0) !== '#') {
        try {
          proxyList.push(parseProxyLine(line));
        } catch (ex) {
          logger.error(ex.message);
        }
      }
    }
    self.proxyList = proxyList;
  });
};

module.exports = {
  createServer: options => new ProxyServer(options),
  requestListener,
  connectListener,
  getProxyObject,
  parseProxyLine,
  getFromRawHeaders,
  getSocksUrl,
};
