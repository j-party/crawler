'use strict';

var config    = require('config');
var Q         = require('q');
var urlParser = require('url');
var xray      = require('x-ray');

var userAgent = config.get('userAgent');

// Returns the protocol+host of the given URL.
function getRoot(url) {
  var parts = urlParser.parse(url);
  return parts.protocol + '//' + parts.host + '/';
}

// Remove the original URL from the given link, and return the new, modified URL.
function rebaseUrl(newUrl, originalUrl) {
  var urlRoot = getRoot(originalUrl);
  var originalRegexp = new RegExp('^' + originalUrl + '(/?)');

  // Strip the original URL prefix.
  if (originalRegexp.test(newUrl)) {
    newUrl = newUrl.replace(originalRegexp, '');
  }

  // Add the root URL on relative links.
  if (newUrl.search(/^http(s?):\/\//) === -1) {
    newUrl = urlRoot + newUrl;
  }

  return newUrl;
}

// Adds a url to be crawled asynchronously.
// The schema is an object.
//   Each property is the name the data will be saved under.
//   The value should be a CSS-style selector string.
//   Enclose the value inside an array to collect ALL matching elements.
// Returns a promise.
//   When successful, resolves with the requested data.
//   On errors, the promise is rejected (with the error as the first argument).
module.exports = function(url, schema) {
  var deferred = Q.defer();
  xray(url)
    .ua(userAgent)
    .prepare('fixHref', function(href) { return rebaseUrl(href, url); })
    .select(schema)
    .run(function(err, data) {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve(data);
      }
    });

  return deferred.promise;
};
