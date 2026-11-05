const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const server = require('../server');

describe('server', () => {
  it('should export `createServer`', () => {
    assert.equal(typeof server.createServer, 'function');
  });
});
