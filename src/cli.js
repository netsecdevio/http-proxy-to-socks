'use strict';

const { readFileSync } = require('fs');
const { resolve } = require('path');
const { Command } = require('commander');
const { version } = require('../package.json');
const { createServer } = require('./server');
const { logger } = require('./logger');

// The only keys a config file may set. Merging the parsed object wholesale
// would let a file smuggle `__proto__` or unrelated options into the server.
const CONFIG_KEYS = ['socks', 'port', 'host', 'level'];
const optionNames = CONFIG_KEYS.concat('config');

function getFileConfig(filePath) {
  const absFile = resolve(process.cwd(), filePath);
  const content = readFileSync(absFile).toString('utf8');

  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch (err) {
    const readError = new Error(`invalid json content in ${absFile}: ${err.message}`);
    readError.code = err.code;
    throw readError;
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`invalid config in ${absFile}: expected a JSON object`);
  }

  const config = {};

  CONFIG_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      config[key] = parsed[key];
    }
  });

  return config;
}

function getOptionsArgs(args) {
  const options = {};

  optionNames.forEach((name) => {
    if (Object.prototype.hasOwnProperty.call(args, name)) {
      if (typeof args[name] !== 'string') {
        throw new Error(`string "${name}" expected`);
      }
      options[name] = args[name];
    }
  });

  return options;
}

function main(argv = process.argv) {
  const cli = new Command();

  cli
    .name('hpts')
    .description('Convert HTTP proxy requests into SOCKS proxy requests')
    .version(version)
    .option('-s, --socks <socks>', 'SOCKS proxy as host:port or host:port:user:password')
    .option('-p, --port <port>', 'port to listen on')
    .option('-l, --host <host>', 'address to listen on')
    .option('-c, --config <file>', 'read socks/host/port/level from a JSON file')
    .option('--level <level>', 'log level: error, warn or info')
    .parse(argv);

  const options = getOptionsArgs(cli.opts());

  try {
    // Explicit flags win over the config file.
    const merged = Object.assign({}, getFileConfigSafe(options.config), options);
    createServer(merged);
  } catch (err) {
    logger.error(err.message);
    process.exitCode = 1;
  }
}

function getFileConfigSafe(configPath) {
  return configPath ? getFileConfig(configPath) : {};
}

module.exports = {
  CONFIG_KEYS,
  getFileConfig,
  getOptionsArgs,
  main,
};
