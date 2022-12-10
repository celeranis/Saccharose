import dotenv from 'dotenv';
import path from 'path';
import { Configuration, IgnorePlugin } from 'webpack';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import { VueLoaderPlugin } from 'vue-loader';
dotenv.config();

const pathDefaults = {
  entry: path.resolve(__dirname, './src/frontend/index.ts'),
  dist: path.resolve(__dirname, './public/dist'),
  public: '/dist', // path of distribution folder relative to base path in the browser (not in the repo)
};
const paths = {
  development: {
    ... pathDefaults,
    outputFilename: `[name].bundle.js`,
    outputChunkFilename: `[name].bundle.js`,
    cssFilename: `[name].bundle.css`,
  },
  production: {
    ... pathDefaults,
    outputFilename: `[name].[chunkhash].bundle.js`,
    outputChunkFilename: `[name].[chunkhash].bundle.js`,
    cssFilename: `[name].[contenthash].bundle.css`,
  }
}

export default (env: 'development'|'production') => <Configuration> {
  entry: {
    app: paths[env].entry,
  },
  target: 'web',
  output: {
    filename: paths[env].outputFilename,
    path: paths[env].dist,
    chunkFilename: paths[env].outputChunkFilename,
    publicPath: paths[env].public,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    mainFields: ['browser', 'main', 'module']
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        vendors: {
          name: 'vendor',
          test: /node_modules/,
          chunks: 'all'
        }
      }
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        include: path.resolve(__dirname, './src'),
        exclude: path.resolve(__dirname, './src/backend'),
        use: [{
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            experimentalWatchApi: true,
            appendTsSuffixTo: ['\\.vue$']
          },
        }],
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          esModule: true,
          loaders: {
            'scss': 'vue-style-loader!css-loader!sass-loader',
            'sass': 'vue-style-loader!css-loader!sass-loader?indentedSyntax'
          }
        }
      },
      {
        test: /\.(sa|sc|c)ss$/,
        include: [
          path.resolve(__dirname, './src/frontend'),
          path.resolve(__dirname, './node_modules/tippy.js'),
        ],
        use: [
          MiniCssExtractPlugin.loader,
          {loader: 'css-loader', options: {url: false, sourceMap: true}},
          'postcss-loader',
          {loader: 'sass-loader', options: {sourceMap: true, implementation: require('sass')}}
        ]
      }
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: paths[env].cssFilename }),
    new CleanWebpackPlugin(),
    new IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }),
    new VueLoaderPlugin()
  ],
};