'use strict';

/**
 * Minimal leveled logger: error < warn < info, no dependencies.
 *
 * hpts runs either as a CLI or as a library, so it must never pull a logging
 * framework (or its transitive tree) into the caller's process. Levels are
 * filtered here; `info` goes to stdout, `error`/`warn` to stderr, and colour is
 * only emitted when the destination is a TTY.
 */

const LEVELS = { error: 0, warn: 1, info: 2 };
const COLORS = { error: '\u001b[31m', warn: '\u001b[33m', info: '\u001b[32m' };
const RESET = '\u001b[0m';
const DEFAULT_LEVEL = 'warn';

function pad(value) {
  return value < 10 ? `0${value}` : String(value);
}

function timestamp(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function isLevel(name) {
  return Object.prototype.hasOwnProperty.call(LEVELS, name);
}

function createLogger(level = DEFAULT_LEVEL) {
  const state = { level: isLevel(level) ? level : DEFAULT_LEVEL };

  function write(name, message) {
    if (LEVELS[name] > LEVELS[state.level]) {
      return;
    }
    const stream = name === 'info' ? process.stdout : process.stderr;
    const label = stream.isTTY ? `${COLORS[name]}${name}${RESET}` : name;
    stream.write(`${timestamp()} - ${label} ${message}\n`);
  }

  return {
    get level() {
      return state.level;
    },
    setLevel(next) {
      state.level = isLevel(next) ? next : DEFAULT_LEVEL;
    },
    error: (message) => write('error', message),
    warn: (message) => write('warn', message),
    info: (message) => write('info', message),
  };
}

function changeLevel(target, level) {
  target.setLevel(level);
}

const logger = createLogger();

module.exports = {
  DEFAULT_LEVEL,
  createLogger,
  changeLevel,
  logger,
};
