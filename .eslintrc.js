module.exports = {
  extends: [require.resolve('code-fabric/eslint')],
  rules: {
    'no-undefined': 2,
    '@typescript-eslint/strict-boolean-expressions': 2,
    'no-void': 0,
    '@typescript-eslint/no-unused-vars': 0,
    'no-restricted-syntax': 0,
    'no-underscore-dangle': 0,
    'no-param-reassign': 0,
    'max-classes-per-file': 0,
    'no-unused-vars': 0,
    'global-require': 0,
    '@typescript-eslint/ban-types': 0,
  },
};
