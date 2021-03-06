'use strict';

var async   = require('async');
var cheerio = require('cheerio');
var config  = require('config');
var hash    = require('hash.js');
var he      = require('he');

var crawl = require('./lib/crawler');
var db    = require('./lib/db')();
var log   = require('./lib/log');

var reqLimit  = config.get('reqLimit');

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
  return db.addClues(sourceId, name, data);
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

function addFinalClue(sourceId, name, clue, answer) {
  log.debug('Adding clues for final category ' + name);
  return db.addClues(sourceId, name, [{
    level: db.FINAL_CLUE,
    clue: clue,
    answer: answer
  }]);
}

function crawlEpisode(url, done) {
  log.info('Crawling episode ' + url);
  var selectors = {
    content: '#content',
    boards: ['.round@html'],
    final: '.final_round@html'
  };
  return crawl(url, selectors).then(function(data) {
    var fingerprint = hash.sha256().update(data.content).digest('hex');
    return db.addSource(url, fingerprint).then(function(sourceId) {
      async.each(data.boards, function(board) {
        addCluesFromBoard(sourceId, board);
      });

      var $ = cheerio.load(data.final);
      addFinalClue(
        sourceId,
        $('.category_name').text(),
        decode($('.clue_text').text()),
        extractAnswer($('div[onmouseover]').attr('onmouseover'))
      );
    }).fail(function() {
      log.debug('... episode is unchanged');
    }).fin(done);
  });
}

function isEpisodePage(href) {
  return href.search(/(^|\/)showgame\.php/) > -1;
}

function crawlSeason(url, done) {
  log.info('Crawling season ' + url);
  var selectors = {
    episodeUrls: ['#content table a@href']
  };
  return crawl(url, selectors).then(function(data) {
    data.episodeUrls = data.episodeUrls.filter(isEpisodePage);
    async.eachLimit(data.episodeUrls, reqLimit, crawlEpisode, done);
  });
}

function isSeasonPage(href) {
  return href.search(/(^|\/)showseason\.php/) > -1;
}

function crawlSeasonList(url) {
  log.info('Crawling seasons ' + url);
  var selectors = {
    seasonUrls: ['#content table a@href']
  };
  return crawl(url, selectors).then(function(data) {
    data.seasonUrls = data.seasonUrls.filter(isSeasonPage);
    async.eachLimit(data.seasonUrls, reqLimit, crawlSeason);
  });
}

log.info('Starting crawler...');
crawlSeasonList('http://j-archive.com/listseasons.php', function() {
  log.info('Done.');
  db.shutdown();
}).catch(log.error.bind(log));
