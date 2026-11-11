# @dyneconllc/hpts

[![CI](https://github.com/netsecdevio/http-proxy-to-socks/actions/workflows/ci.yml/badge.svg)](https://github.com/netsecdevio/http-proxy-to-socks/actions/workflows/ci.yml)
[![CodeQL](https://github.com/netsecdevio/http-proxy-to-socks/actions/workflows/codeql.yml/badge.svg)](https://github.com/netsecdevio/http-proxy-to-socks/actions/workflows/codeql.yml)
[![npm](https://img.shields.io/npm/v/@dyneconllc/hpts)](https://www.npmjs.com/package/@dyneconllc/hpts)

`hpts` turns a SOCKS5 proxy into an HTTP proxy, so clients that only speak HTTP
proxying can still use a SOCKS tunnel.

`hpts` is an independently maintained package: current Node.js, `socks@2.8.x`,
and a deliberately small surface. Its name is distinct from every similarly
named package so an install can never resolve to an unintended one.

- Node.js **>= 18**
- Three runtime dependencies: `commander`, `socks@2.8.x`, `socks-proxy-agent@8`
- No build step, no transpiler, no logging framework, no proxy-list mode

## Install

```sh
npm install -g @dyneconllc/hpts
```

## Usage

```sh
hpts -s 127.0.0.1:1080 -p 8080
```

This listens on `127.0.0.1:8080` as an HTTP proxy and forwards each request
through the SOCKS5 proxy at `127.0.0.1:1080`. Plain `GET`/`POST` requests and
`CONNECT` tunnels are both supported.

```
Options:
  -V, --version          output the version number
  -s, --socks <socks>    SOCKS proxy as host:port or host:port:user:password
  -p, --port <port>      port to listen on (default: 8080)
  -l, --host <host>      address to listen on (default: 127.0.0.1)
  -c, --config <file>    read socks/host/port/level from a JSON file
      --level <level>    log level: error, warn or info (default: warn)
  -h, --help             display help for command
```

A config file is plain JSON:

```json
{
  "socks": "127.0.0.1:1080",
  "host": "127.0.0.1",
  "port": 8080
}
```

Only `socks`, `host`, `port` and `level` are read from it. Flags given on the
command line take precedence over the file.

## Library

```js
const { createServer } = require('@dyneconllc/hpts');

const server = createServer({
  socks: '127.0.0.1:1080',
  host: '127.0.0.1',
  port: 8080,
  level: 'info',
});

server.on('error', (err) => console.error(err.message));
server.on('listening', () => console.log('proxy up'));
```

`createServer()` returns a plain `http.Server`, so `close()`, `address()` and
`on('request')` behave as usual.

## Security notes

- The listener has **no authentication**. It binds to `127.0.0.1` by default; do
  not point `--host` at a public interface unless an authenticating layer sits
  in front of it.
- Credentials in `--socks` are never logged, and validation errors echo only the
  host — never the full proxy string.
- `Proxy-Authorization`, `Proxy-Authenticate` and `Proxy-Connection` from the
  client are stripped before a request is forwarded, so the proxy hop's
  credentials cannot leak to the destination server.
- A malformed request target gets `400`; an unreachable SOCKS proxy or
  destination gets `502`. Neither crashes the process.

Report a vulnerability via [SECURITY.md](SECURITY.md).

## Tests

```sh
npm test
```

The suite includes an end-to-end test that starts a real RFC 1928 SOCKS5 server
and tunnels both an HTTP request and a `CONNECT` session through it.

## License

MIT. See [LICENSE.md](LICENSE.md) for the full copyright notices.
