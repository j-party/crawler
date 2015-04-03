var config  = require('config');
var sqlite3 = require('sqlite3').verbose();
var Q       = require('q');

module.exports = function() {
  var db;

  function init() {
    db = new sqlite3.Database(
      config.get('dbFile')
    );
    db.run('CREATE TABLE IF NOT EXISTS sources ( \
      uri TEXT NOT NULL, \
      hash TEXT NOT NULL \
    )');
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
  function addSource(uri, hash) {
    var deferred = Q.defer();
    db.run('INSERT INTO sources (uri, hash) VALUES (?, ?)', uri, hash, function(err) {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve(this.lastID);
      }
    });
    return deferred.promise;
  }

  // Returns a promise that resolves with the integer ID of the new record.
  function addCategory(sourceId, name) {
    var deferred = Q.defer();
    db.run(
      'INSERT INTO categories (name, sourceId) VALUES (?, ?)',
      name,
      sourceId,
      function(err) {
        if (err) {
          deferred.reject(err);
        } else {
          deferred.resolve(this.lastID);
        }
      }
    );
    return deferred.promise;
  }

  // Returns a promise.
  function addClues(sourceId, categoryName, clues) {
    var promises = [];
    addCategory(sourceId, categoryName).then(function(categoryId) {
      clues.forEach(function(data) {
        var deferred = Q.defer();
        db.run(
          'INSERT INTO clues (categoryId, level, clue, answer) VALUES (?, ?, ?, ?)',
          categoryId, data.level, data.clue, data.answer,
          function(err) {
            if (err) {
              deferred.reject(err);
            } else {
              deferred.resolve();
            }
          }
        );
        promises.push(deferred.promise);
      });
    });
    return Q.all(promises);
  }

  init();
  return {
    FINAL_CLUE: 999,
    addSource: addSource,
    addClues: addClues,
    shutdown: shutdown
  };
}
