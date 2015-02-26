var each = require('each-async');
var xray = require('x-ray');

var urlRoot = 'http://j-archive.com/';

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

function crawlSeasonList(url) {
  function isSeasonPage(href) {
    return href.search(/(^|\/)showseason\.php/) > -1;
  }

  xray(url)
    .prepare('fixHref', function(href) { return rebaseUrl(href, url); })
    .select(['#content a[href] | fixHref'])
    .run(function(err, linkUrls) {
      each(linkUrls, function(linkUrl) {
        if (isSeasonPage(linkUrl)) {
          console.log('link:', linkUrl);
        }
      });
    });
}

crawlSeasonList(urlRoot + 'listseasons.php');
