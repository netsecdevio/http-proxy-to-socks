const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { writeFileSync, mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { getFileConfig, getOptionsArgs } = require('../cli');

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

  describe('getFileConfig', () => {
    function writeConfig(body) {
      const dir = mkdtempSync(join(tmpdir(), 'hpts-'));
      const file = join(dir, 'config.json');
      writeFileSync(file, body);
      return file;
    }

    it('should keep only the supported keys', () => {
      const file = writeConfig(JSON.stringify({
        socks: '127.0.0.1:1080',
        port: 8080,
        socksList: '/etc/proxies.txt',
        proxyListReloadTimeout: 5,
      }));

      assert.deepEqual(getFileConfig(file), {
        socks: '127.0.0.1:1080',
        port: 8080,
      });
    });

    it('should not let a config file reach Object.prototype', () => {
      const file = writeConfig('{"__proto__": {"polluted": true}, "port": 8080}');

      const config = getFileConfig(file);

      assert.deepEqual(Object.keys(config), ['port']);
      assert.equal({}.polluted, undefined);
    });

    it('should reject invalid JSON and non-object documents', () => {
      assert.throws(() => getFileConfig(writeConfig('{oops')), /invalid json content/);
      assert.throws(() => getFileConfig(writeConfig('[1,2,3]')), /expected a JSON object/);
    });
  });
});
