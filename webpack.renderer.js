module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: 'source-map',
  module: {
    rules: [
      { test: /.ts$/, include: /src/, use: [{ loader: 'ts-loader' }] },
      { test: /.css$/, use: ['style-loader', 'css-loader', 'postcss-loader'] }
    ]
  },
  resolve: { extensions: ['.ts', '.js'] }
};
