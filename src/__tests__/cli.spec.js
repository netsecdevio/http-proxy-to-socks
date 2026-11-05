const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getOptionsArgs } = require('../cli');

describe('cli', () => {
  describe('getOptionsArgs', () => {
    it('should return an object with specified fields when provided', () => {
      const options = {
        socks: 'socks',
        port: 'port',
        level: 'level',
        config: 'config',
        FIELD_NOT_EXIST: 'FIELD_NOT_EXIST',
      };

      const res = getOptionsArgs(options);

      Object.keys(options).forEach((name) => {
        if (name === 'FIELD_NOT_EXIST') {
          assert.equal(Boolean(res[name]), false);
          return;
        }

        assert.equal(Boolean(res[name]), true);
      });
    });
  });
});
