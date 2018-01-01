require('colors');
const assert = require('assert');
const fs = require('fs-extra');
const debug = require('debug')('webpack-config');

module.exports = function get(buildRoot, webpack, _, path, CleanWebpackPlugin) {
    // depending on -p flag, we'll tweak some settings
    const production = process.argv.indexOf('-p') > -1;
    debug({ buildRoot, production });
    const sourcePath = path.resolve(__dirname, './app');
    const config = {
        // point to the dir your app code is in
        context: path.resolve(buildRoot),

        // entry point to your app
        // it's possible to have multiple entry points (see docs)
        // this is relative to the context dir above
        entry: {
            main: path.resolve(buildRoot, './app/main')
        },

        output: {
            // where we want to output built files
            path: path.resolve(__dirname, './public'),
            filename: 'resource/js/[name]-bundle.js',
            chunkFilename: 'resource/js/chunk/[name]-chunk.js',
            publicPath: '/car/assets/' // will be overriden by product
        },

        // in development we want to produce source-maps
        // (see http://webpack.github.io/docs/configuration.html#devtool)
        // TODO: fix error while creating 'source-map' for production
        devtool: production ? false : 'cheap-eval-source-map',

        // this is to support older versions of jquery
        amd: { jQuery: true },

        watchOptions: {
            poll: 500,
            ignored: /node_modules/
        },

        plugins: [
            new webpack.ProvidePlugin({
                $: 'jquery',
                jQuery: 'jquery',
                'window.jQuery': 'jquery',
                'window.$': 'jquery',
                moment: 'moment'
            }),
            new webpack.ContextReplacementPlugin(/moment[\\\/]locale$/, /^\.\/(en|ko|ja|zh-cn)$/),
            new webpack.optimize.LimitChunkCountPlugin({
                maxChunks: 1
            })
        ],
        resolve: {
            alias: {}
        },
        module: {
            rules: [
                // {
                //     test: /\.(txt|html)$/,
                //     use: 'raw-loader'
                // },
                {
                    test: /\.(woff|ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                    loader: 'base64-inline-loader'
                },
                {
                    test: /\.s?css$/, // scss and css | use scss for the new stuff
                    use: [
                        // cache css output for faster rebuilds
                        'cache-loader',
                        {
                            // build css/sass in threads (faster)
                            loader: 'thread-loader',
                            options: {
                                workerParallelJobs: 2
                            }
                        },
                        {
                            loader: 'style-loader' // creates style nodes from JS strings
                        },
                        {
                            loader: 'css-loader',
                            options: {
                                module: true,
                                sourceMap: !production,
                                localIdentName: production
                                    ? '[hash:base64:5]'
                                    : '[path][name]-[local]'
                            }
                        },
                        {
                            loader: 'postcss-loader',
                            options: {
                                sourceMap: true
                            }
                        },
                        {
                            loader: 'sass-loader',
                            options: {
                                outputStyle: 'collapsed',
                                sourceMap: true,
                                includePaths: [sourcePath]
                            }
                        }
                    ]
                },
                {
                    test: /markerclusterer/,
                    loaders: ['exports-loader?MarkerClusterer']
                },
                {
                    test: /detectizr/,
                    loaders: ['imports-loader?this=>window,modernizr', 'exports-loader?Detectizr']
                },
                {
                    test: /modernizr/,
                    loaders: ['imports-loader?this=>window', 'exports-loader?Modernizr']
                },
                {
                    test: /backbone\.js/,
                    loaders: ['imports-loader?this=>window,jquery,_=underscore']
                },
                {
                    test: /jquery\.ui\.core/,
                    loaders: ['imports-loader?jquery']
                },
                {
                    test: /jquery\.ui\.widget/,
                    loaders: ['imports-loader?jquery.ui.core']
                },
                {
                    test: /jquery\.ui\.position/,
                    loaders: ['imports-loader?jquery.ui.core']
                },
                {
                    test: /jquery\.ui\.button/,
                    loaders: ['imports-loader?jquery.ui.core,jquery.ui.widget']
                },
                {
                    test: /jquery\.ui\.datepicker/,
                    loaders: ['imports-loader?jquery.ui.core']
                },
                {
                    test: /jquery\.timepicker/,
                    loaders: ['imports-loader?jquery.ui.datepicker']
                },
                {
                    test: /jquery\.ui\.autocomplete\.js/,
                    loaders: ['imports-loader?jquery.ui.core,jquery.ui.widget,jquery.ui.position']
                },
                {
                    test: /jquery\.ui\.mouse/,
                    loaders: ['imports-loader?jquery.ui.widget']
                },
                {
                    test: /jquery\.ui\.slider/,
                    loaders: ['imports-loader?jquery.ui.core,jquery.ui.mouse,jquery.ui.widget']
                },
                {
                    test: /jquery\.ui\.autocomplete\.categorized/,
                    loaders: ['imports-loader?jquery.ui.autocomplete']
                },
                {
                    test: /backbone-localstorage/,
                    loaders: ['imports-loader?this=>window,backbone,_=underscore']
                }
            ]
        }
    };

    // BEGIN: webpack custom plugins
    class CopyPlugin {
        constructor(args) {
            this.args = args;
        }
        apply(compiler) {
            const froms = this.args.reduce((sum, value) => [...sum, value.from], []);
            compiler.plugin('done', stats => {
                [...froms].map(p => {
                    try {
                        assert(fs.existsSync(p));
                    } catch (e) {
                        debug('Copy Plugin error fs.existsSync'.red, p);
                        throw e;
                    }
                });
                debug('CopyPlugin this.args <froms> file sources all exist'.magenta);
                [...this.args].map(arg => [...arg.to].map(to => fs.copySync(arg.from, to)));
            });
        }
    }

    class ImagePathResolverPlugin {
        apply(compiler) {
            compiler.plugin('done', stats => {
                [...Object.keys(stats.compilation.assets)].map(a => {
                    const contents = fs
                        .readFileSync(stats.compilation.assets[a].existsAt)
                        .toString();
                    const targets = contents.match(/url\([a-z0-9\.\-\_\"'\/\\]*\)/gi);
                    if (!targets) return;
                    const replacements = [...targets].map(m => process(m));

                    fs.writeFileSync(
                        stats.compilation.assets[a].existsAt,
                        targets.reduce(
                            (sum, value, i) => sum.replace(value, replacements[i]),
                            contents
                        )
                    );
                    function process(url) {
                        // format url(image.png)
                        const matches = url.match(/url\((.*)\)/);
                        if (!matches) return url;
                        const path = matches[1];
                        let pathError = false;
                        if (path === null || path === '') {
                            debug('Alert, path error image resolver'.red, { matches });
                            pathError = true;
                        }
                        let newPath = path.replace(/\"|\\/g, '');
                        try {
                            newPath = pathError
                                ? path
                                : config.output.publicPath +
                                  path.match(/web\/public\/([a-z0-9\.\/\-]*)/i)[1];
                        } catch (e) {
                            debug('Alert, path error'.red);
                        }
                        if (path !== newPath) {
                            debug(stats.compilation.assets[a].existsAt.blue, newPath, path);
                        }
                        // TODO: process new path relative to public image directory
                        return url.replace(path, newPath);
                    }
                });
            });
        }
    }

    class PolyfillPlugin {
        constructor(args) {
            this.args = args;
        }
        apply(compiler) {
            compiler.plugin('done', stats => {
                const polyfills = this.args.reduce(
                    (sum, value) => `${sum}\n${fs.readFileSync(value).toString()}`,
                    ''
                );
                const k = Object.keys(stats.compilation.assets)[0];
                const contents = fs.readFileSync(stats.compilation.assets[k].existsAt).toString();
                fs.writeFileSync(
                    stats.compilation.assets[k].existsAt,
                    addPolyfill(polyfills, contents)
                );
                function addPolyfill(p, c) {
                    return `${p} ${c}`;
                }
            });
        }
    }
    // END: webpack custom plugins

    return {
        production,
        config,
        CopyPlugin,
        ImagePathResolverPlugin,
        PolyfillPlugin
    };
};
