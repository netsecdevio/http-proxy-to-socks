# Security Policy

## Supported versions

Only the latest published `@netsecdevio/hpts` release receives fixes.

## Reporting a vulnerability

Open a private advisory at
<https://github.com/netsecdevio/http-proxy-to-socks/security/advisories/new>,
or email the maintainer listed in `package.json`. Please do not open a public
issue for anything that lets a request escape the configured SOCKS proxy, leak
credentials, or crash the process.

Expect an acknowledgement within a few days. There is no bug bounty.

## Scope worth knowing about

`hpts` is an unauthenticated local proxy by design. Binding it to a non-loopback
address puts an open relay on your network, so treat that as a configuration
error rather than a vulnerability.
