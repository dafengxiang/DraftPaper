'use strict'

const SizePlugin = require('size-plugin')
const { VueLoaderPlugin } = require('vue-loader')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

const PATHS = require('./paths')

// To re-use webpack configuration across templates,
// CLI maintains a common webpack configuration file - `webpack.common.js`.
// Whenever user creates an extension, CLI adds `webpack.common.js` file
// in template's `config` folder
const common = {
    output: {
        // the build folder to output bundles and assets in.
        path: PATHS.build,
        // the filename template for entry chunks
        filename: '[name].js',
        publicPath: './',
    },
    devtool: 'source-map',
    stats: {
        all: false,
        errors: true,
        builtAt: true,
    },
    module: {
        rules: [
            // Help webpack in understanding CSS files imported in .js files
            {
                test: /\.(le|c)ss$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    {
                        loader: 'less-loader',
                        options: {
                            sourceMap: true,
                            lessOptions: {
                                javascriptEnabled: true,
                            },
                        },
                    },
                ],
            },
            {
                test: /\.(png|jpe?g|gif)$/i,
                type: 'asset',
            },
            {
                test: /\.vue$/,
                loader: 'vue-loader',
            },
        ],
    },
    plugins: [
        new VueLoaderPlugin(),
        // Print file sizes
        new SizePlugin(),
        // Copy static assets from `public` folder to `build` folder
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: '**/*',
                    context: 'public',
                },
            ],
        }),
        // Extract CSS into separate files
        new MiniCssExtractPlugin({
            filename: '[name].css',
        }),
    ],
}

module.exports = common
