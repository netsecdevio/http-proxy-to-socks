'use strict';

// Inspired by https://github.com/asluchevskiy/http-to-socks-proxy (MIT).
// hpts: accept HTTP proxy requests, forward them over SOCKS5.

const http = require('http');
const util = require('util');
const Socks = require('socks');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { logger } = require('./logger');

const SOCKS5 = 5;
const DEFAULT_PORTS = { 'http:': 80, 'https:': 443 };

// Headers that describe the client -> hpts hop. Forwarding them would leak the
// client's proxy credentials to the destination server.
const HOP_BY_HOP = new Set([
  'proxy-authorization',
  'proxy-authenticate',
  'proxy-connection',
]);

function getProxyObject(host, port, login, password) {
  return {
    ipaddress: host,
    port: parseInt(port, 10),
    type: SOCKS5,
    authentication: { username: login || '', password: password || '' },
  };
}

function parseProxyLine(line) {
  const fields = String(line).trim().split(':');

  if (fields.length !== 2 && fields.length !== 4) {
    // Never echo the line: it may contain credentials that end up in logs.
    throw new Error('Invalid SOCKS proxy: expected host:port or host:port:username:password');
  }

  const [host, rawPort] = fields;
  const port = Number(rawPort);

  if (host === '' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid SOCKS proxy address for host "${host}": port must be 1-65535`);
  }

  return getProxyObject(...fields);
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

function isHopByHop(name) {
  return HOP_BY_HOP.has(String(name).toLowerCase());
}

function normalizeRequestHeaders(rawHeaders, fallbackHeaders = {}) {
  const source = Array.isArray(rawHeaders) && rawHeaders.length > 0
    ? getFromRawHeaders(rawHeaders)
    : getFromRawHeaders(
      Object.entries(fallbackHeaders).flatMap(([key, value]) => [key, value]),
    );
  const normalized = {};

  Object.keys(source).forEach((key) => {
    if (isHopByHop(key)) {
      return;
    }
    const values = source[key];
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

function badRequest(response, reason) {
  logger.warn(`rejected request: ${reason}`);
  if (!response.headersSent) {
    response.writeHead(400, { 'Content-Type': 'text/plain' });
  }
  response.end('Bad request\n');
}

function parseTarget(requestUrl) {
  const targetUrl = requestUrl.includes('://') ? requestUrl : null;

  if (!targetUrl) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  return {
    hostname: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : DEFAULT_PORTS[parsed.protocol],
    path: `${parsed.pathname}${parsed.search}`,
  };
}

function requestListener(getProxyInfo, request, response) {
  logger.info(`request: ${request.method} ${request.url}`);

  const target = parseTarget(request.url);

  if (!target) {
    badRequest(response, `not an absolute http(s) URL: ${request.url}`);
    return;
  }

  const proxy = getProxyInfo();
  const proxyRequest = http.request({
    port: target.port,
    hostname: target.hostname,
    method: request.method,
    path: target.path,
    headers: normalizeRequestHeaders(request.rawHeaders, request.headers),
    agent: new SocksProxyAgent(getSocksUrl(proxy)),
  });

  request.on('error', (err) => {
    logger.error(`${err.message}`);
    proxyRequest.destroy(err);
  });

  response.on('close', () => {
    if (!response.writableEnded) {
      proxyRequest.destroy();
    }
  });

  proxyRequest.on('error', (error) => {
    logger.error(`${error.message} on proxy ${proxy.ipaddress}:${proxy.port}`);
    if (!response.headersSent) {
      response.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    response.end('Connection error\n');
  });

  proxyRequest.on('response', (proxyResponse) => {
    response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
    proxyResponse.on('error', (error) => {
      logger.error(`${error.message} reading response from ${target.hostname}`);
      response.destroy(error);
    });
    proxyResponse.pipe(response);
  });

  request.pipe(proxyRequest);
}

function connectListener(getProxyInfo, request, socketRequest, head) {
  logger.info(`connect: ${request.url}`);

  const authority = request.url.includes('://') ? new URL(request.url).host : request.url;
  const separator = authority.lastIndexOf(':');
  // CONNECT normally carries "host:port"; a bare host keeps the historical 443.
  const host = separator < 1 ? authority : authority.slice(0, separator);
  const port = separator < 1 ? 443 : Number(authority.slice(separator + 1));

  if (host === '' || !Number.isInteger(port) || port < 1 || port > 65535) {
    socketRequest.write(`HTTP/${request.httpVersion} 400 Bad request\r\n\r\n`);
    socketRequest.destroy();
    return;
  }

  const proxy = getProxyInfo();
  const proxyConfig = {
    host: proxy.ipaddress,
    port: parseInt(proxy.port, 10),
    type: proxy.type,
  };

  if (proxy.authentication && proxy.authentication.username) {
    proxyConfig.userId = proxy.authentication.username;
    proxyConfig.password = proxy.authentication.password || '';
  }

  let socket;

  socketRequest.on('error', (err) => {
    logger.error(`${err.message}`);
    if (socket) {
      socket.destroy(err);
    }
  });

  Socks.SocksClient.createConnection({
    proxy: proxyConfig,
    destination: { host, port },
    command: 'connect',
  }, (error, info) => {
    if (error) {
      logger.error(`${error.message} connecting to ${host}:${port} via ${proxy.ipaddress}:${proxy.port}`);
      if (!socketRequest.destroyed) {
        socketRequest.write(`HTTP/${request.httpVersion} 502 Connection error\r\n\r\n`);
        socketRequest.destroy();
      }
      return;
    }

    socket = info.socket;

    socket.on('error', (err) => {
      logger.error(`${err.message}`);
      socketRequest.destroy(err);
    });

    // Tunnel bytes in both directions.
    socket.pipe(socketRequest);
    socketRequest.pipe(socket);

    socket.write(head);
    socketRequest.write(`HTTP/${request.httpVersion} 200 Connection established\r\n\r\n`);
    socket.resume();
  });
}

function ProxyServer(options = {}) {
  http.Server.call(this);

  this.proxy = parseProxyLine(options.socks);
  const getProxyInfo = () => this.proxy;

  this.addListener('request', requestListener.bind(null, getProxyInfo));
  this.addListener('connect', connectListener.bind(null, getProxyInfo));
}

util.inherits(ProxyServer, http.Server);

module.exports = {
  ProxyServer,
  createServer: (options) => new ProxyServer(options),
  requestListener,
  connectListener,
  getProxyObject,
  parseProxyLine,
  normalizeRequestHeaders,
  getFromRawHeaders,
  getSocksUrl,
};
