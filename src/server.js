'use strict';

const { logger, changeLevel } = require('./logger');
const { createServer: createProxyServer } = require('./proxy_server');

const DEFAULT_OPTIONS = {
  host: '127.0.0.1',
  port: 8080,
  socks: '127.0.0.1:1080',
};

function toPort(value) {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid listen port "${value}": expected an integer 0-65535`);
  }

  return port;
}

// host:port:user:password -> host:port:***, so the startup banner can be
// captured in logs or issue reports without leaking credentials.
function describeSocks(socks) {
  const fields = String(socks).split(':');
  return fields.length === 4 ? `${fields[0]}:${fields[1]}:***` : socks;
}

function createServer(opts = {}) {
  const options = Object.assign({}, DEFAULT_OPTIONS, opts);

  if (typeof options.level === 'string') {
    changeLevel(logger, options.level);
  }

  const host = options.host;
  const port = toPort(options.port);
  const socks = options.socks;

  // Printed unconditionally, and on stdout: scripts (including infravibe)
  // treat this line as the "proxy is up" signal.
  console.log(`SOCKS: ${describeSocks(socks)}\nhttp-proxy listening: ${host}:${port}`);

  return createProxyServer({ socks }).listen(port, host);
}

module.exports = {
  createServer,
  describeSocks,
  toPort,
};
