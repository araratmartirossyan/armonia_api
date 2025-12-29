// ESLint v9+ uses "flat config" by default (eslint.config.(js|mjs|cjs)).
// Keep the legacy `.eslintrc.json` and adapt it via FlatCompat (no full migration needed).
// This file is intentionally CommonJS to avoid ESM/`__dirname` issues during ESLint config loading.
const { FlatCompat } = require('@eslint/eslintrc')

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

module.exports = [
  { ignores: ['dist/**', 'node_modules/**'] },
  ...compat.config(require('./.eslintrc.json')),
]