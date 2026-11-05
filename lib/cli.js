const { readFileSync } = require('fs');
const { resolve } = require('path');
const { Command } = require('commander');
const { version } = require('../package.json');
const { createServer } = require('./server');

const optionNames = [
  'socks',
  'port',
  'level',
  'config',
  'host',
];

function getFileConfig(filePath) {
  const absFile = resolve(process.cwd(), filePath);

  const content = readFileSync(absFile).toString('utf8');

  try {
    return JSON.parse(content);
  } catch (err) {
    const error = new Error(`invalid json content: ${err.message}`);
    error.code = err.code;
    throw error;
  }
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
  cli.version(version)
    .option('-s, --socks [socks]', 'specify your socks proxy host, default: 127.0.0.1:1080')
    .option('-p, --port [port]', 'specify the listening port of http proxy server, default: 8080')
    .option('-l, --host [host]', 'specify the listening host of http proxy server, default: 127.0.0.1')
    .option('-c, --config [config]', 'read configs from file in json format')
    .option('--level [level]', 'log level, vals: info, error')
    .parse(argv);

  const rawArgs = typeof cli.opts === 'function' ? cli.opts() : cli;
  const options = getOptionsArgs(rawArgs);

  let fileConfig = null;

  if (options.config) {
    fileConfig = getFileConfig(options.config);
  }

  Object.assign(options, fileConfig);

  createServer(options);
}

module.exports = {
  getOptionsArgs,
  main,
};
