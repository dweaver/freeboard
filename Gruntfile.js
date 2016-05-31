module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        env : {
          dev_local: {
            NODE_ENV : 'DEVELOPMENT_LOCAL'
          },
          dev_server: {
            NODE_ENV : 'DEVELOPMENT_SERVER'
          }
        },
        preprocess: {
          dev_local: {
            src: './index.tmpl.html',
            dest: './index.html'
          },
          dev_server: {
            src: './index.tmpl.html',
            dest: './index.html'
          }
        },
        concat: {
            css: {
                src: [
                    'lib/css/thirdparty/*.css',
                    'lib/css/freeboard/styles.css'
                ],
                dest: 'css/freeboard.css'
            },
            thirdparty : {
                src : [
                    [
                        'lib/js/thirdparty/head.js',
                        'lib/js/thirdparty/jquery.js',
                        'lib/js/thirdparty/jquery-ui.js',
                        'lib/js/thirdparty/knockout.js',
                        'lib/js/thirdparty/underscore.js',
                        'lib/js/thirdparty/jquery.gridster.js',
                        'lib/js/thirdparty/jquery.caret.js',
						'lib/js/thirdparty/jquery.xdomainrequest.js',
                        'lib/js/thirdparty/codemirror.js',
                    ]
                ],
                dest : 'js/freeboard.thirdparty.js'
            },
			fb : {
				src : [
					'lib/js/freeboard/DatasourceModel.js',
					'lib/js/freeboard/DeveloperConsole.js',
					'lib/js/freeboard/DialogBox.js',
					'lib/js/freeboard/FreeboardModel.js',
					'lib/js/freeboard/FreeboardUI.js',
					'lib/js/freeboard/JSEditor.js',
					'lib/js/freeboard/PaneModel.js',
					'lib/js/freeboard/PluginEditor.js',
					'lib/js/freeboard/ValueEditor.js',
					'lib/js/freeboard/WidgetModel.js',
					'lib/js/freeboard/freeboard.js',
				],
				dest : 'js/freeboard.js'
			},
            plugins : {
                src : [
                    'plugins/freeboard/*.js',
                    'plugins/exosite/*.js'
                ],
                dest : 'js/freeboard.plugins.js'
            },
            'fb_plugins' : {
                src : [
                    'js/freeboard.js',
                    'js/freeboard.plugins.js'
                ],
                dest : 'js/freeboard_plugins.js'
            }
        },
        cssmin : {
            css:{
                src: 'css/freeboard.css',
                dest: 'css/freeboard.min.css'
            }
        },
        uglify : {
            fb: {
                files: {
                    'js/freeboard.min.js' : [ 'js/freeboard.js' ]
                }
            },
            plugins: {
                files: {
                    'js/freeboard.plugins.min.js' : [ 'js/freeboard.plugins.js' ]
                }
            },
            thirdparty :{
                options: {
                    mangle : false,
                    beautify : false,
                    compress: {}
                },
                files: {
                    'js/freeboard.thirdparty.min.js' : [ 'js/freeboard.thirdparty.js' ]
                }
            },
            'fb_plugins': {
                files: {
                    'js/freeboard_plugins.min.js' : [ 'js/freeboard_plugins.js' ]
                }
            }
        },
        'string-replace': {
            css: {
                files: {
                    'css/': 'css/*.css'
                },
                options: {
                    replacements: [{
                        pattern: /..\/..\/..\/img/ig,
                        replacement: '../img'
                    }]
                }
            }
        },
        watch: {
          files: [ './index.tmpl.html', 'plugins/**/*.js', 'lib/**/*.js', 'img/**' ],
          tasks: [ 'dev_server' ],
          options: {
            debounceDelay: 250,
            reload: true
          }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-preprocess');
    grunt.loadNpmTasks('grunt-env');
    grunt.loadNpmTasks('grunt-string-replace');

    var base_tasks = [ 'concat:css', 'cssmin:css', 'concat:fb', 'concat:thirdparty', 'concat:plugins', 'concat:fb_plugins', 'uglify:fb', 'uglify:plugins', 'uglify:fb_plugins', 'uglify:thirdparty', 'string-replace:css' ];

    var dev_local_tasks = ['env:dev_local', 'preprocess:dev_local'].concat(base_tasks.slice(0));
    grunt.registerTask('dev_local', dev_local_tasks);

    var dev_server_tasks = ['env:dev_server', 'preprocess:dev_server'].concat(base_tasks.slice(0));
    grunt.registerTask('dev_server', dev_server_tasks);

    grunt.registerTask('default', ['dev_local', 'watch']);
};
