'use strict';

var async   = require('async');
var cheerio = require('cheerio');
var xray    = require('x-ray');

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

// Extracts the correct response from the "toggle(...)" JS.
function extractAnswer(toggleJs) {
  // Parse the JS string, and extract the HTML response.
  var matches = toggleJs.match(/toggle\(.*?,.*?,\s*['"](.*?)['"]\)/);
  var html = matches[1];

  // Fix up the escaped quotes.
  html = html.replace(/\\"/g, '"');
  html = html.replace(/\\'/g, '\'');

  // Load the HTML into Cheerio for more parsing.
  var $ = cheerio.load(html);

  // Return the actual answer.
  return $('.correct_response').text();
}

function addFinalClue(name, clue, answer) {
  console.log('adding FJ clue:', name, clue, answer);
}

function crawlEpisode(url, done) {
  xray(url)
    .select({
      boards: ['.round[html]'],
      final: {
        $root: '.final_round',
        name: '.category_name',
        clue: '.clue_text',
        mouseover: 'div[onmouseover]'
      }
    })
    .run(function(err, data) {
      addFinalClue(
        data.final.name,
        data.final.clue,
        extractAnswer(data.final.mouseover)
      );
      done();
    });
}

function crawlSeason(url, done) {
  function isSeasonPage(href) {
    return href.search(/(^|\/)showseason\.php/) > -1;
  }

  xray(url)
    .prepare('fixHref', function(href) { return rebaseUrl(href, url); })
    .select(['#content table a[href] | fixHref'])
    .run(function(err, episodeUrls) {
      async.eachLimit(episodeUrls, reqLimit, crawlEpisode, done);
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
