'use strict';

var gulp   = require('gulp');
var jshint = require('gulp-jshint');

var jsFiles = [
  'crawl.js',
  'gulpfile.js',
  'lib/*.js'
];

gulp.task('lint', function() {
  return gulp.src(jsFiles)
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('watch', function() {
  return gulp.watch(jsFiles, ['lint']);
});

gulp.task('default', ['lint']);
