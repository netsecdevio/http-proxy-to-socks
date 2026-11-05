# CHANGELOG

## 1.2.0
- deps: bump `socks` (`^2.8.10`), `socks-proxy-agent` (`^8.0.5`), `winston` (`^3.19.0`), `commander` (`^12.1.0`), and `chalk` (`^4.1.2`); replace deprecated Babel 6 / Jest 18 / ESLint 3 toolchain with native Node test runner and ESLint 10
- fix: pass a valid `socks5h://` URL to `SocksProxyAgent` in `requestListener` instead of a raw proxy config object
- fix: normalize single-value raw headers so `http.request` does not throw `ERR_INVALID_ARG_TYPE` on `headers.host` in modern Node.js
- fix: replace deprecated `url.parse()` (`DEP0169`) with WHATWG `URL`
- fix: forward SOCKS5 `userId`/`password` credentials in `connectListener` and fix inverted line filter in `loadProxyFile`

## 1.1.5
- deps: upgrade socks and other deps

## 1.1.3, 1.1.4
- chore: keep header cases

## 1.1.1
- src: Use parsed url hostname instead of host which may contain also port

## 1.1.0
- src: Support setting local address of the http-service.
- src: Format timestamp of logs.

## 1.0.4
- src: Support setting the `--level` option in `createServer()`.

## 1.0.3
- src: Bind `error` event on sockets to prevent servers from exiting in some node runtimes.

## 1.0.2

- Exports "main" fields in `package.json`.
