'use strict';

// Flat config. Deliberately small: correctness rules that catch real defects in
// a network proxy, plus the recommended set. Formatting is not policed here.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', '*.tgz'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'multi-line'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-throw-literal': 'error',
      'no-self-compare': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-template-curly-in-string': 'error',
      'no-unused-expressions': 'error',
      'no-console': 'off',
    },
  },
  {
    files: ['src/__tests__/**/*.js'],
    rules: {
      // Tests print to prove behaviour; keep them free to do so.
      'no-console': 'off',
    },
  },
];
