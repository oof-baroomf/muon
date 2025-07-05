const path = require('path');
module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: './src/main.ts',
  devtool: 'source-map',
  module: {
    rules: [
      { test: /\.ts$/, include: /src/, use: [{ loader: 'ts-loader' }] }
    ]
  },
  resolve: { extensions: ['.ts', '.js'] },
  output: {
    path: path.resolve(__dirname, '.webpack/main'),
    filename: 'index.js'
  }
};
