'use strict';

var async = require('async');
var xray  = require('x-ray');

var urlRoot  = 'http://j-archive.com/';
var reqLimit = 1;

// Remove the original URL from the given link, and return the new, modified URL.
function rebaseUrl(newUrl, originalUrl) {
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

function crawlSeason(url, done) {
  function isSeasonPage(href) {
    return href.search(/(^|\/)showseason\.php/) > -1;
  }

  xray(url)
    .prepare('fixHref', function(href) { return rebaseUrl(href, url); })
    .select(['#content table a[href] | fixHref'])
    .run(function(err, episodeUrls) {
      console.log('crawled season', url);
      done();
    });
}

function crawlSeasonList(url) {
  xray(url)
    .prepare('fixHref', function(href) { return rebaseUrl(href, url); })
    .select(['#content table a[href] | fixHref'])
    .run(function(err, seasonUrls) {
      async.eachLimit(seasonUrls, reqLimit, crawlSeason);
    });
}

crawlSeasonList(urlRoot + 'listseasons.php');
