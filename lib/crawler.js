'use strict';

var config    = require('config');
var Q         = require('q');
var xray      = require('x-ray')();

var userAgent = config.get('userAgent');

// Adds a url to be crawled asynchronously.
// The schema is an object.
//   Each property is the name the data will be saved under.
//   The value should be an x-ray CSS-style selector string.
//   Enclose the value inside an array to collect ALL matching elements.
// Returns a promise.
//   When successful, resolves with the requested data.
//   On errors, the promise is rejected (with the error as the first argument).
module.exports = function(url, schema) {
  return Q.nfcall(xray(url, schema));
};
