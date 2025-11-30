module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: 'source-map',
  module: {
    rules: [
      { test: /.ts$/, include: /src/, use: [{ loader: 'ts-loader' }] },
      { test: /.css$/, use: ['style-loader', 'css-loader', 'postcss-loader'] }
    ]
  },
  devServer: {
    // Avoid clashes with other local apps that frequently occupy port 3000.
    port: Number(process.env.MUON_DEV_PORT) || 3080,
    hot: true
  },
  resolve: { extensions: ['.ts', '.js'] }
};
