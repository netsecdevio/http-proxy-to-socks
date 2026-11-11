# CHANGELOG

## 2.1.0

- docs: describe the package on its own terms; it is independently maintained
- docs: repository description, badges and security notes for the standalone repo
- deps: `commander@15.1.0`, `socks-proxy-agent@10.1.0`, `socks@2.8.10`
- security: override `minimatch` to 11.0.8 for the dev toolchain
  (GHSA-g3hv-75wg-m249); runtime dependencies audit clean
- ci: SBOM generation on every push, pull request and week, via the
  organisation workflow — SPDX 2.3 and CycloneDX 1.5 documents kept as run
  artifacts, and `sbom` is now a required status check

## 2.0.0

Republished as `@dyneconllc/hpts` with a narrowed, dependency-light core.
- rename: package is `@dyneconllc/hpts`; the executable is still `hpts`
- deps: `socks@^2.8.10`, `socks-proxy-agent@^8.0.5`, `commander@^12.1.0`
- removed: `winston` and `chalk`; logging is ~60 dependency-free lines
- removed: `lib/` build step and `scripts/build.js`; `src/` is published as-is
- removed: ESLint toolchain and its dev-dependency tree
- removed: undocumented `socksList` file mode and its reload interval, which
  kept the event loop alive and was never covered by tests
- removed: Travis CI config and the Chinese README
- security: config files may only set `socks`/`host`/`port`/`level`, so a file
  can no longer reach `Object.prototype` through `__proto__`
- security: `Proxy-Authorization`/`Proxy-Authenticate`/`Proxy-Connection` are
  stripped before forwarding
- security: proxy validation errors no longer echo credentials
- fix: malformed request targets return `400` instead of throwing inside the
  request listener; unreachable upstreams return `502`
- fix: upstream response errors and client disconnects destroy the peer request
  instead of leaking sockets
- fix: CLI flag values now override config-file values
- docs: English-only README with security notes, plus SECURITY.md

## 1.2.0

- deps: bump `socks` (`^2.8.10`), `socks-proxy-agent` (`^8.0.5`), `winston`
  (`^3.19.0`), `commander` (`^12.1.0`) and `chalk` (`^4.1.2`)
- fix: pass a valid `socks5h://` URL to `SocksProxyAgent`
- fix: normalize single-value raw headers so `http.request` does not throw
  `ERR_INVALID_ARG_TYPE` on `headers.host` in modern Node.js
- fix: replace deprecated `url.parse()` with the WHATWG `URL`
- fix: forward SOCKS5 credentials in `connectListener`

## Earlier releases

1.1.x and below were published upstream as `http-proxy-to-socks` by Ouyang
Yadong. See <https://github.com/oyyd/http-proxy-to-socks/commits/master>.
