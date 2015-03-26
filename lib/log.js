'use strict';

var chalk  = require('chalk');
var logger = require('loglevel');

var colors = {
  trace: 'black',
  debug: 'black',
  info:  'gray',
  warn:  'yellow',
  error: 'red'
};

var originalFactory = logger.methodFactory;
logger.methodFactory = function(methodName, logLevel) {
  var rawMethod = originalFactory(methodName, logLevel);
  var color = colors[methodName];
  var type = '[' + methodName.toUpperCase() + ']';

  return function(message) {
    rawMethod(chalk[color](type) + ' ' + message);
  };
};

logger.setLevel('info');

module.exports = logger;
