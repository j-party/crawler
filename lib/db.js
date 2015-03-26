var config  = require('config');
var sqlite3 = require('sqlite3').verbose();
var Q       = require('kew');

module.exports = function() {
  var db;

  function init() {
    db = new sqlite3.Database(
      config.get('dbFile')
    );
    db.run('CREATE TABLE IF NOT EXISTS sources (uri TEXT NOT NULL)');
    db.run('CREATE TABLE IF NOT EXISTS categories ( \
      sourceId INTEGER NOT NULL, \
      name TEXT NOT NULL \
    )');
    db.run('CREATE TABLE IF NOT EXISTS clues ( \
      categoryId INTEGER NOT NULL, \
      level INTEGER NOT NULL, \
      clue TEXT NOT NULL, \
      answer TEXT NOT NULL \
    )');
  }

  function shutdown() {
    db.close();
  }

  // Returns a promise that resolves with the integer ID of the new record.
  function addSource(uri) {
    var deferred = Q.defer();

    db.run('INSERT INTO sources (uri) VALUES (?)', uri, function(err) {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve(this.lastID);
      }
    });

    return deferred;
  }

  function addClues(sourceId, categoryName, clues) {
    db.run(
      'INSERT INTO categories (name, sourceId) VALUES (?, ?)',
      categoryName,
      sourceId,
      function(err) {
        if (err) { return; }

        var categoryId = this.lastID;
        clues.forEach(function(data) {
          db.run(
            'INSERT INTO clues (categoryId, level, clue, answer) VALUES (?, ?, ?, ?)',
            categoryId, data.level, data.clue, data.answer
          );
        });
      }
    );
  }

  init();
  return {
    FINAL_CLUE: 999,
    addSource: addSource,
    addClues: addClues,
    shutdown: shutdown
  };
}
