const path = require('path');
module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: 'source-map',
  module: {
    rules: [
      { test: /\.tsx?$/, include: /src/, use: [{ loader: 'ts-loader' }] },
      { test: /.css$/, use: ['style-loader', 'css-loader', 'postcss-loader'] }
    ]
  },
  resolve: { extensions: ['.tsx', '.ts', '.js'] }
};
