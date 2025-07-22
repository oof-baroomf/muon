const path = require('path');
const { WebpackPlugin } = require('@electron-forge/plugin-webpack');

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
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
          }
        ]
      }
    })
  ]
};
