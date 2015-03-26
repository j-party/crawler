'use strict';

var async   = require('async');
var cheerio = require('cheerio');
var config  = require('config');
var he      = require('he');
var xray    = require('x-ray');

var db  = require('./lib/db')();
var log = require('./lib/log');

var urlRoot   = 'http://j-archive.com/';
var reqLimit  = config.get('reqLimit');
var userAgent = config.get('userAgent');

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

// Decodes HTML entities into standard text.
var decode = he.decode;

// Extracts the correct response from the "toggle(...)" JS.
function extractAnswer(toggleJs) {
  if (!toggleJs) { return null; }

  // Parse the JS string, and extract the HTML response.
  var matches = toggleJs.match(/toggle\(.*?,.*?,\s*['"](.*?)['"]\)/);
  var html = matches[1];

  // Fix up the escaped quotes.
  html = html.replace(/\\"/g, '"');
  html = html.replace(/\\'/g, '\'');

  // Load the HTML into Cheerio for more parsing.
  var $ = cheerio.load(html);

  // Get the text content.
  var text = $('.correct_response').text();

  // Decode the HTML entities.
  return decode(text);
}

function hasMissingClues(clueArray) {
  return clueArray.indexOf(null) > -1 || clueArray.indexOf('') > -1;
}

function addCluesFromBoard(sourceId, boardHtml) {
  // Load the HTML into Cheerio for parsing.
  var $ = cheerio.load(boardHtml);

  // Loop through the categories, adding the clues & answers.
  var col, row, box, name, clues, clue, answers, answer;
  for (col = 0; col < 6; col++) {
    name = $('td.category').eq(col).find('.category_name').text();
    clues = [];
    answers = [];

    for (row = 1; row <= 5; row++) {
      box = $.root().children().eq(row).children().eq(col);
      clue = decode(box.find('.clue_text').text());
      answer = extractAnswer(box.find('div[onmouseover]').attr('onmouseover'));
      clues.push(clue);
      answers.push(answer);
    }

    if (!hasMissingClues(clues)) {
      addClues(sourceId, name, clues, answers);
    }
  }
}

function addClues(sourceId, name, clues, answers) {
  log.debug('Adding clues for category ' + name);
  var data = [];
  clues.forEach(function(clue, i) {
    data.push({
      level: i,
      clue: clue,
      answer: answers[i]
    });
  });
  db.addClues(sourceId, name, data);
}

function addFinalClue(sourceId, name, clue, answer) {
  log.debug('Adding clues for final category ' + name);
  db.addClues(sourceId, name, [{
    level: db.FINAL_CLUE,
    clue: clue,
    answer: answer
  }]);
}

function crawlEpisode(url, done) {
  log.info('Crawling episode ' + url);
  xray(url)
    .ua(userAgent)
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
      db.addSource(url).then(function(sourceId) {
        async.each(data.boards, function(board) {
          addCluesFromBoard(sourceId, board);
        });
        addFinalClue(
          sourceId,
          data.final.name,
          decode(data.final.clue),
          extractAnswer(data.final.mouseover)
        );
        done();
      });
    });
}

function crawlSeason(url, done) {
  log.info('Crawling season ' + url);
  function isSeasonPage(href) {
    return href.search(/(^|\/)showseason\.php/) > -1;
  }

  xray(url)
    .ua(userAgent)
    .prepare('fixHref', function(href) { return rebaseUrl(href, url); })
    .select(['#content table a[href] | fixHref'])
    .run(function(err, episodeUrls) {
      async.eachLimit(episodeUrls, reqLimit, crawlEpisode, done);
    });
}

function crawlSeasonList(url) {
  log.info('Crawling seasons ' + url);
  xray(url)
    .ua(userAgent)
    .prepare('fixHref', function(href) { return rebaseUrl(href, url); })
    .select(['#content table a[href] | fixHref'])
    .run(function(err, seasonUrls) {
      async.eachLimit(seasonUrls, reqLimit, crawlSeason);
    });
}

// crawlSeasonList(urlRoot + 'listseasons.php');
log.info('Starting crawler...');
crawlEpisode('http://www.j-archive.com/showgame.php?game_id=3713', function() {
  log.info('Done.');
  db.shutdown();
});
