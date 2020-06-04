module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
      },
    ],
    '@babel/preset-typescript',
    '@babel/preset-react',
  ],
  plugins: [
    // can be removed once support for node v10 is dropped.
    [require('@babel/plugin-proposal-class-properties'), { loose: false }],
  ],
}
