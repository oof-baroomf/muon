const { WebpackPlugin } = require('@electron-forge/plugin-webpack');
const path = require('path');

const config = {
  packagerConfig: { asar: true },
  makers: [
    { name: '@electron-forge/maker-squirrel', config: {} },
    { name: '@electron-forge/maker-zip', platforms: ['darwin', 'linux', 'win32'] }
  ],
  plugins: [
    new WebpackPlugin({
      mainConfig: path.join(__dirname, 'webpack.main.js'),
      renderer: {
        config: path.join(__dirname, 'webpack.renderer.js'),
        entryPoints: [
          {
            html: './src/renderer/index.html',
            js: './src/renderer/renderer.ts',
            name: 'main_window',
            preload: { js: './src/preload.ts' }
          },
          {
            html: './src/renderer/settings/index.html',
            js: './src/renderer/settings/window.ts',
            name: 'settings_window',
            preload: { js: './src/preload.ts' }
          }
        ]
      }
    })
  ]
};
module.exports = config;
