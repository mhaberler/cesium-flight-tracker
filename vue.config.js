const path = require('path');
// const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

const cesiumSource = 'node_modules/cesium/Source';
const cesiumWorkers = '../Build/Cesium/Workers';

module.exports = {
  publicPath: "./",

  configureWebpack: {
    resolve: {
      fallback: { "https": false, "zlib": false, "http": false, "url": false, fs: false },
      mainFiles: ['index', 'Cesium'],
    },
    plugins: [
      // Copy Cesium Assets, Widgets, and Workers to a static directory
      new CopyWebpackPlugin({
        patterns: [
          { from: path.join(cesiumSource, cesiumWorkers), to: 'Workers' },
          { from: path.join(cesiumSource, 'ThirdParty'), to: 'ThirdParty' },
          { from: path.join(cesiumSource, 'Assets'), to: 'Assets' },
          { from: path.join(cesiumSource, 'Widgets'), to: 'Widgets' }
        ]
      }),
      new webpack.DefinePlugin({
        // Define relative base path in cesium for loading assets
        CESIUM_BASE_URL: JSON.stringify('')
      }),
    ],
    module: {
      // Removes these errors: "Critical dependency: require function is used in a way in which dependencies cannot be statically extracted"
      // https://github.com/AnalyticalGraphicsInc/cesium-webpack-example/issues/6
      unknownContextCritical: false,
      unknownContextRegExp: /\/cesium\/cesium\/Source\/Core\/buildModuleUrl\.js/,
    }
  }
}
