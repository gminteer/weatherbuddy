module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2020: true,
    node: true,
  },
  plugins: ['prettier'],
  extends: ['eslint:recommended', 'google', 'prettier'],
  rules: {
    'prettier/prettier': ['warn'],
    'prefer-template': ['warn'],
    'no-debugger': ['warn'],
    'brace-style': ['error', '1tbs', {allowSingleLine: true}],
    'require-jsdoc': ['off'],
    eqeqeq: ['error', 'always'],
    curly: ['error', 'multi-or-nest', 'consistent'],
  },
  parserOptions: {
    sourceType: 'module',
  },
};
