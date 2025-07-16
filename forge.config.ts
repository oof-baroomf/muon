import type { ForgeConfig } from '@electron-forge/shared-types';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import path from 'path';

const config: ForgeConfig = {
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
            html: './src/renderer/notes.html',
            js: './src/renderer/notes.ts',
            name: 'notes_window',
            preload: { js: './src/preload.ts' }
          }
        ]
      }
    })
  ]
};
export default config;
