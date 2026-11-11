const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const net = require('net');
const Socks = require('socks');
const spaMod = require('socks-proxy-agent');

function last(array) {
  return array[array.length - 1];
}

describe('proxy_server', () => {
  const requestURL = 'https://google.com';
  let mockOn;
  let mockRequest;
  let mockCreateConnection;
  let getProxyInfo;
  let request;
  let socksRequest;
  let response;
  let socketRequest;
  let socket;

  const {
    createServer,
    getProxyObject,
    parseProxyLine,
    requestListener,
    connectListener,
    getFromRawHeaders,
    normalizeRequestHeaders,
    getSocksUrl,
  } = require('../proxy_server');

  function getLastMockOn(event) {
    return last(mockOn.mock.calls.filter(call => call.arguments[0] === event));
  }

  beforeEach(() => {
    mock.restoreAll();
    mockOn = mock.fn();
    mockRequest = mock.method(http, 'request', () => ({
      on: mockOn,
      destroy: mock.fn(),
    }));
    mockCreateConnection = mock.method(Socks.SocksClient, 'createConnection', () => {});

    getProxyInfo = mock.fn(() => ({
      ipaddress: '127.0.0.1',
      port: 8080,
      type: 5,
      authentication: { username: '', password: '' },
    }));

    request = {
      on: mock.fn(),
      pipe: mock.fn(),
      url: requestURL,
      method: 'GET',
    };

    socksRequest = {
      on: mock.fn(),
      pipe: mock.fn(),
      url: requestURL.slice('https://'.length),
      httpVersion: '1.1',
    };

    response = {
      on: mock.fn(),
      writeHead: mock.fn(),
      end: mock.fn(),
      headersSent: false,
      writableEnded: false,
    };

    socketRequest = {
      on: mock.fn(),
      write: mock.fn(),
      pipe: mock.fn(),
      destroy: mock.fn(),
      destroyed: false,
    };

    socket = {
      on: mock.fn(),
      pipe: mock.fn(),
      write: mock.fn(),
      resume: mock.fn(),
      destroy: mock.fn(),
    };
  });

  describe('getProxyObject', () => {
    it('should return an object with "ipaddress", "port", "type", "authentication" properties', () => {
      const host = '127.0.0.1';
      const port = '8080';
      const res = getProxyObject(host, port);

      assert.equal(typeof res, 'object');
      assert.equal(res.ipaddress, host);
      assert.equal(res.port, parseInt(port, 10));
      assert.equal(res.type, 5);
      assert.equal(typeof res.authentication, 'object');
      assert.equal(Object.prototype.hasOwnProperty.call(res.authentication, 'username'), true);
      assert.equal(Object.prototype.hasOwnProperty.call(res.authentication, 'password'), true);
    });
  });

  describe('parseProxyLine', () => {
    it('should return an object with "host" and "port" extracted from proxy string', () => {
      const proxyLine = '127.0.0.1:1080';
      const res = parseProxyLine(proxyLine);

      assert.equal(typeof res, 'object');
      assert.equal(res.ipaddress, '127.0.0.1');
      assert.equal(res.port, 1080);
    });

    it('should also contain "username" and "password" properties when provided', () => {
      const proxyLine = '127.0.0.1:1080:oyyd:password';
      const res = parseProxyLine(proxyLine);

      assert.equal(typeof res, 'object');
      assert.equal(res.ipaddress, '127.0.0.1');
      assert.equal(res.port, 1080);
      assert.equal(typeof res.authentication, 'object');
      assert.equal(res.authentication.username, 'oyyd');
      assert.equal(res.authentication.password, 'password');
    });

    it('should throw error when the proxy string is invalid', () => {
      assert.throws(() => parseProxyLine('127.0.0.1'), Error);
      assert.throws(() => parseProxyLine('127.0.0.1:8080:oyyd'), Error);
      assert.throws(() => parseProxyLine('127.0.0.1:0'), Error);
      assert.throws(() => parseProxyLine('127.0.0.1:65536'), Error);
      assert.throws(() => parseProxyLine('127.0.0.1:http'), Error);
    });

    it('should not echo credentials in the error message', () => {
      assert.throws(
        () => parseProxyLine('127.0.0.1:0:user:secret-password-here'),
        (err) => !err.message.includes('secret-password-here'),
      );
    });
  });

  describe('getSocksUrl', () => {
    it('should build socks5h URL with and without credentials', () => {
      assert.equal(
        getSocksUrl(parseProxyLine('127.0.0.1:1080')),
        'socks5h://127.0.0.1:1080',
      );
      assert.equal(
        getSocksUrl(parseProxyLine('127.0.0.1:1080:user:p@ss')),
        'socks5h://user:p%40ss@127.0.0.1:1080',
      );
    });
  });

  describe('normalizeRequestHeaders', () => {
    it('should drop client proxy headers so they cannot reach the destination', () => {
      const rawHeaders = [
        'Host', 'example.com',
        'Proxy-Authorization', 'Basic bWFzdGVyOnNlY3JldA==',
        'proxy-connection', 'keep-alive',
        'Proxy-Authenticate', 'Basic',
        'Accept', '*/*',
      ];

      const headers = normalizeRequestHeaders(rawHeaders, {});

      assert.deepEqual(headers, { Host: 'example.com', Accept: '*/*' });
    });

    it('should fall back to request.headers when raw headers are absent', () => {
      const headers = normalizeRequestHeaders(undefined, {
        host: 'example.com',
        'proxy-authorization': 'Basic bWFzdGVyOnNlY3JldA==',
      });

      assert.deepEqual(headers, { host: 'example.com' });
    });
  });

  describe('requestListener', () => {
    it('should create a valid SocksProxyAgent and pass it to http.request', () => {
      requestListener(getProxyInfo, request, response);

      const httpLastCall = last(mockRequest.mock.calls);
      const reqOptions = httpLastCall.arguments[0];

      assert.equal(reqOptions.hostname, 'google.com');
      assert.equal(reqOptions.port, 443);
      assert.equal(reqOptions.agent instanceof spaMod.SocksProxyAgent, true);
      assert.equal(reqOptions.agent.proxy.host, '127.0.0.1');
      assert.equal(reqOptions.agent.proxy.port, 8080);
      assert.equal(reqOptions.agent.proxy.type, 5);
    });

    it('should answer 400 without touching the SOCKS proxy for a relative target', () => {
      requestListener(getProxyInfo, { ...request, url: '/just-a-path' }, response);

      assert.equal(mockRequest.mock.calls.length, 0);
      assert.equal(response.writeHead.mock.calls[0].arguments[0], 400);
      assert.equal(response.end.mock.calls[0].arguments[0], 'Bad request\n');
    });

    it('should return 502 when the upstream request errors', () => {
      requestListener(getProxyInfo, request, response);

      const onErrorCall = getLastMockOn('error');
      assert.ok(onErrorCall);

      onErrorCall.arguments[1](new Error('500'));

      assert.equal(response.writeHead.mock.calls[0].arguments[0], 502);
      assert.equal(response.end.mock.calls[0].arguments[0].indexOf('error') > -1, true);
    });

    it('should pipe response when "response"', () => {
      const proxyResponse = {
        statusCode: 200,
        headers: {},
        pipe: mock.fn(),
        on: mock.fn(),
      };

      requestListener(getProxyInfo, request, response);

      const onResponseCall = getLastMockOn('response');
      assert.ok(onResponseCall);

      onResponseCall.arguments[1](proxyResponse);

      assert.equal(proxyResponse.pipe.mock.calls[0].arguments[0], response);
    });
  });

  describe('connectListener', () => {
    it('should create socks connections', () => {
      connectListener(getProxyInfo, socksRequest, socketRequest, '');

      const lastCall = last(mockCreateConnection.mock.calls);

      assert.equal(lastCall.arguments[0].destination.host, 'google.com');
      assert.equal(lastCall.arguments[0].destination.port, 443);
    });

    it('should write 502 when the SOCKS connection fails', () => {
      connectListener(getProxyInfo, socksRequest, socketRequest, '');

      const lastCall = last(mockCreateConnection.mock.calls);
      lastCall.arguments[1](new Error('500'), socket);

      assert.equal(socketRequest.write.mock.calls[0].arguments[0].indexOf('502') > -1, true);
      assert.equal(socket.pipe.mock.calls.length, 0);
    });

    it('should pipe sockets when socket connected', () => {
      connectListener(getProxyInfo, socksRequest, socketRequest, '');

      const lastCall = last(mockCreateConnection.mock.calls);
      lastCall.arguments[1](null, { socket });

      assert.equal(socketRequest.pipe.mock.calls[0].arguments[0], socket);
      assert.equal(socket.pipe.mock.calls[0].arguments[0], socketRequest);
      assert.equal(socketRequest.write.mock.calls[0].arguments[0].indexOf('200') > -1, true);
      assert.equal(socket.write.mock.calls[0].arguments[0], '');
    });
  });

  describe('createServer', () => {
    it('should hold the parsed proxy and register request and connect listeners', () => {
      const server = createServer({ socks: '127.0.0.1:1080' });

      assert.equal(server.proxy.ipaddress, '127.0.0.1');
      assert.equal(server.proxy.port, 1080);
      assert.equal(server.listenerCount('request') > 0, true);
      assert.equal(server.listenerCount('connect') > 0, true);
    });

    it('should refuse to start with an invalid proxy address', () => {
      assert.throws(() => createServer({ socks: 'nope' }), /Invalid SOCKS proxy/);
    });
  });

  describe('getFromRawHeaders', () => {
    it('should work', () => {
      const rawHeaders = [
        'UPPER-CASE',
        'abc',
        'Host',
        '127.0.0.1:12345',
        'Connection',
        'keep-alive',
      ];

      const result = getFromRawHeaders(rawHeaders);
      assert.deepEqual(result, {
        'UPPER-CASE': ['abc'],
        Host: ['127.0.0.1:12345'],
        Connection: ['keep-alive'],
      });
    });
  });

  describe('end-to-end SOCKS5 proxy integration', () => {
    it('should proxy both HTTP GET and CONNECT tunnel through a live local SOCKS5 server', async () => {
      mock.restoreAll();

      // 1. Start a target HTTP server
      const targetServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`target-ok:${req.method}:${req.url}`);
      });
      await new Promise(resolve => targetServer.listen(0, '127.0.0.1', resolve));
      targetServer.unref();
      const targetPort = targetServer.address().port;

      // 2. Start a minimal RFC 1928 SOCKS5 server (no-auth, CONNECT)
      const socksServer = net.createServer((clientSocket) => {
        clientSocket.once('data', (greeting) => {
          assert.equal(greeting[0], 0x05);
          clientSocket.write(Buffer.from([0x05, 0x00]));
          clientSocket.once('data', (reqBuf) => {
            assert.equal(reqBuf[0], 0x05);
            assert.equal(reqBuf[1], 0x01); // CONNECT
            const atyp = reqBuf[3];
            let dstHost;
            let offset = 4;
            if (atyp === 0x01) {
              dstHost = `${reqBuf[4]}.${reqBuf[5]}.${reqBuf[6]}.${reqBuf[7]}`;
              offset = 8;
            } else if (atyp === 0x03) {
              const len = reqBuf[4];
              dstHost = reqBuf.subarray(5, 5 + len).toString('utf8');
              offset = 5 + len;
            }
            const dstPort = reqBuf.readUInt16BE(offset);
            const upstream = net.connect(dstPort, dstHost, () => {
              clientSocket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0, 0]));
              clientSocket.pipe(upstream);
              upstream.pipe(clientSocket);
            });
            upstream.on('error', () => clientSocket.destroy());
            clientSocket.on('error', () => upstream.destroy());
          });
        });
      });
      await new Promise(resolve => socksServer.listen(0, '127.0.0.1', resolve));
      socksServer.unref();
      const socksPort = socksServer.address().port;

      // 3. Start hpts proxy server
      const proxyServer = createServer({ socks: `127.0.0.1:${socksPort}` });
      await new Promise(resolve => proxyServer.listen(0, '127.0.0.1', resolve));
      proxyServer.unref();
      const proxyPort = proxyServer.address().port;

      try {
        // Test A: Standard HTTP request via hpts
        const httpBody = await new Promise((resolve, reject) => {
          const req = http.request({
            host: '127.0.0.1',
            port: proxyPort,
            method: 'GET',
            path: `http://127.0.0.1:${targetPort}/hello?x=1`,
            headers: { 'Proxy-Authorization': 'Basic c2VjcmV0OnNlY3JldA==' },
          }, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode, data }));
          });
          req.on('error', reject);
          req.end();
        });
        assert.equal(httpBody.statusCode, 200);
        assert.equal(httpBody.data, 'target-ok:GET:/hello?x=1');

        // Test B: HTTP CONNECT tunnel via hpts
        const connectBody = await new Promise((resolve, reject) => {
          const req = http.request({
            host: '127.0.0.1',
            port: proxyPort,
            method: 'CONNECT',
            path: `127.0.0.1:${targetPort}`,
          });
          req.on('connect', (res, tunnelSocket) => {
            assert.equal(res.statusCode, 200);
            tunnelSocket.write(`GET /tunneled HTTP/1.1\r\nHost: 127.0.0.1:${targetPort}\r\nConnection: close\r\n\r\n`);
            let raw = '';
            tunnelSocket.setEncoding('utf8');
            tunnelSocket.on('data', chunk => { raw += chunk; });
            tunnelSocket.on('end', () => resolve(raw));
          });
          req.on('error', reject);
          req.end();
        });
        assert.equal(connectBody.includes('target-ok:GET:/tunneled'), true);

        // Test C: a request whose target is not absolute is rejected, not fatal
        const rejected = await new Promise((resolve, reject) => {
          const req = http.request({
            host: '127.0.0.1',
            port: proxyPort,
            method: 'GET',
            path: '/relative-target',
          }, (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode));
          });
          req.on('error', reject);
          req.end();
        });
        assert.equal(rejected, 400);
      } finally {
        proxyServer.close();
        socksServer.close();
        targetServer.close();
      }
    });

    it('should answer 502 when the SOCKS proxy is not listening', async () => {
      mock.restoreAll();

      // Grab a port, then close it so nothing is listening there.
      const dead = net.createServer();
      await new Promise(resolve => dead.listen(0, '127.0.0.1', resolve));
      const deadPort = dead.address().port;
      await new Promise(resolve => dead.close(resolve));

      const proxyServer = createServer({ socks: `127.0.0.1:${deadPort}` });
      await new Promise(resolve => proxyServer.listen(0, '127.0.0.1', resolve));
      proxyServer.unref();

      try {
        const status = await new Promise((resolve, reject) => {
          const req = http.request({
            host: '127.0.0.1',
            port: proxyServer.address().port,
            method: 'GET',
            path: 'http://127.0.0.1:9/',
          }, (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode));
          });
          req.on('error', reject);
          req.end();
        });
        assert.equal(status, 502);
      } finally {
        proxyServer.close();
      }
    });
  });
});
