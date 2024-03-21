const HtmlWebpackPlugin = require('html-webpack-plugin');
const { DefinePlugin } = require('webpack');
const { resolve } = require('path');

const mode = 'development';

module.exports = {
    mode,
    devtool: 'eval-cheap-source-map',
    entry: resolve(__dirname, 'src/index.ts'),
    resolve: {
        extensions: ['.ts', '.js', '.css'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: 'ts-loader',
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            }
        ],
    },
    devServer: {
        host: '0.0.0.0',
        port: 3000,
        hot: true,
    },
    plugins: [
        new HtmlWebpackPlugin({ inject: true }),
        new DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(mode),
        }),
    ],
};