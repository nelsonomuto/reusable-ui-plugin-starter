const _ = require('lodash');
const webpack = require('webpack');
const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const {
    config,
    production,
    CopyPlugin,
    ImagePathResolverPlugin,
    PolyfillPlugin
} = require('./webpack.config.template.js')('./', webpack, _, path, CleanWebpackPlugin);

config.entry = {
    'main': ['babel-polyfill', path.resolve(__dirname, './app/main.js')]
};
const sassThreadLoader = require('thread-loader');

sassThreadLoader.warmup({ workerParallelJobs: 2 }, [
    'sass-loader',
    'postcss-loader',
    'css-loader',
    'style-loader',
    'babel-loader'
]);
const extractPlugins = [
    new ExtractTextPlugin({
        allChunks: true,
        filename: 'resource/stylesheets/main.css'
    })
];
const extractPluginsRules = [
    {
        test: /main.scss/,
        use: extractPlugins[0].extract({
            use: [
                {
                    loader: 'css-loader',
                    options: {
                        minimize: true
                    }
                }
            ]
        })
    }
];

config.output.publicPath = '/shared/';
config.plugins = config.plugins.concat([
    new CleanWebpackPlugin(['public'], {
        root: path.resolve(__dirname),
        verbose: true,
        dry: false
    }),
    /* eslint-disable */
    ... !production ? [] : [new UglifyJSPlugin({ // only uglify in production, uglify is slow, no need for this in development even though it happens in parallel which ameliorates the pain
        parallel: true
    })],

    new ImagePathResolverPlugin(),

    new PolyfillPlugin([
        path.resolve(__dirname, 'polyfills/IE11Polyfill.min.js')
    ]),
    
    new PolyfillPlugin([
        path.resolve(__dirname, 'polyfills/underscore-min.js') // FIXME: why is IE 11 not able to load underscore via webpack like other browsers?
    ]),

    ... production ? extractPlugins : [], // use inline css in development for debugging & speed

    new CopyPlugin([
        {
            from: path.resolve(__dirname, 'images'),
            to: [
                path.resolve(__dirname, 'public/images')
            ]
        }
    ]),
    /* eslint-enable */
]);

config.module.rules = config.module.rules.concat([
    {
        test: /\.jsx?$/,
        exclude: /(node_modules|bower_components)/,
        include: [path.resolve(__dirname, './app')],
        use: [
            {
                loader: 'thread-loader',
                options: {
                    workerParallelJobs: 2
                }
            },
            {
                loader: 'babel-loader',
                options: {
                    presets: ['react', 'env']
                }
            }
        ]
    },
    {
        test: /\.txt$|\.handlebars$/,
        use: 'raw-loader'
    },
    ...(production ? extractPluginsRules : []) // only used in production mode
]);

config.resolve.alias = _.extend(config.resolve.alias, {
    app: path.resolve(__dirname, 'app')
});

module.exports = config;
