const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/renderer/index.tsx',
    target: 'web',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'renderer.js',
    },
    devtool: 'source-map',
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
      fallback: {
        "path": false,
        "fs": false,
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg|ico|icns)$/,
          type: 'asset/resource',
        },
        // MP3 files are served as static files, not bundled
        // They are served from src/renderer/sound/ in dev and copied to dist/sound/ in production
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
      }),
      new webpack.DefinePlugin({
        'process.env.API_URL': JSON.stringify(process.env.API_URL || 'https://goranked.gg'),
        'REVERB_HOST': JSON.stringify(process.env.REVERB_HOST || 'goranked.gg'),
        'REVERB_PORT': JSON.stringify(process.env.REVERB_PORT || '443'),
        'REVERB_SCHEME': JSON.stringify(process.env.REVERB_SCHEME || 'https'),
        'REVERB_APP_KEY': JSON.stringify(process.env.REVERB_APP_KEY || (() => {
          if (isProduction) {
            throw new Error('REVERB_APP_KEY environment variable is required for production builds');
          }
          // Only allow fallback in development mode
          console.warn('⚠️  REVERB_APP_KEY not set, using empty string. Set it in .env file!');
          return '';
        })()),
        'WS_URL': JSON.stringify(process.env.WS_URL || (() => {
          const host = process.env.REVERB_HOST || 'goranked.gg';
          const port = process.env.REVERB_PORT || '443';
          const scheme = process.env.REVERB_SCHEME || 'https';
          const appKey = process.env.REVERB_APP_KEY || '';
          const wsScheme = scheme === 'https' ? 'wss' : 'ws';
          return `${wsScheme}://${host}${port === '443' ? '' : ':' + port}/app/${appKey}`;
        })()),
        'process.env.NODE_ENV': JSON.stringify(argv.mode || 'development'),
        // Security: Disable MOCK_MODE in production builds
        'process.env.MOCK_MODE': JSON.stringify(
          isProduction ? 'false' : (process.env.MOCK_MODE || 'false')
        ),
        'global': 'globalThis',
      }),
      new webpack.ProvidePlugin({
        global: 'globalThis',
      }),
    ],
    devServer: {
      port: 3000,
      hot: true,
      static: [
        {
          directory: path.join(__dirname, 'src/renderer'),
          publicPath: '/',
        },
        {
          directory: path.join(__dirname, 'src/renderer/sound'),
          publicPath: '/sound',
        },
      ],
    },
  };
};

