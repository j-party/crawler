var config  = require('config');
var sqlite3 = require('sqlite3').verbose();
var Q       = require('q');

module.exports = function() {
  var db;

  // Bitfield returned by checkSource()
  var SOURCE_NONEXISTENT = 0x0;
  var SOURCE_EXISTS      = 0x1;
  var SOURCE_CHANGED     = 0x2;

  function init() {
    db = new sqlite3.Database(
      config.get('dbFile')
    );
    db.run('CREATE TABLE IF NOT EXISTS sources ( \
      id INTEGER PRIMARY KEY AUTOINCREMENT, \
      uri TEXT NOT NULL, \
      hash TEXT NOT NULL \
    )');
    db.run('CREATE TABLE IF NOT EXISTS categories ( \
      id INTEGER PRIMARY KEY AUTOINCREMENT, \
      sourceId INTEGER NOT NULL, \
      name TEXT NOT NULL \
    )');
    db.run('CREATE TABLE IF NOT EXISTS clues ( \
      id INTEGER PRIMARY KEY AUTOINCREMENT, \
      sourceId INTEGER NOT NULL, \
      categoryId INTEGER NOT NULL, \
      level INTEGER NOT NULL, \
      clue TEXT NOT NULL, \
      answer TEXT NOT NULL \
    )');
  }

  function shutdown() {
    db.close();
  }

  // Returns a promise that resolves to an object with possible properties:
  //  * status -- status of the source (SOURCE_* bits), compared to the new hash
  //  * id -- id of the existing source (when applicable)
  function checkSource(uri, cmpHash) {
    var deferred = Q.defer();
    var info = { status: 0 };
    db.get('SELECT * FROM sources WHERE uri = ?', uri, function(err, row) {
      if (err) {
        deferred.reject(err);
        return;
      }

      if (row) {
        info.id = row.id;
        info.status |= SOURCE_EXISTS;
        if (row.hash !== cmpHash) {
          info.status |= SOURCE_CHANGED;
        }
      }
      deferred.resolve(info);
    });
    return deferred.promise;
  }

  // Deletes a source (and all its related data). Returns a promise.
  function deleteSource(id) {
    var deferreds = [
      Q.defer(), Q.defer(), Q.defer()
    ];
    db.run('DELETE FROM sources WHERE id = ?', id, function(err) {
      deferreds[0][err ? 'reject' : 'resolve']();
    });
    db.run('DELETE FROM categories WHERE sourceId = ?', id, function(err) {
      deferreds[1][err ? 'reject' : 'resolve']();
    });
    db.run('DELETE FROM clues WHERE sourceId = ?', id, function(err) {
      deferreds[2][err ? 'reject' : 'resolve']();
    });
    return Q.all([
      deferreds[0].promise,
      deferreds[1].promise,
      deferreds[2].promise
    ]);
  }

  // Inserts a URI source into the database. Returns a promise.
  function insertSource(uri, hash) {
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
  function addSource(uri, hash) {
    return checkSource(uri, hash).then(function(info) {
      if (info.status === SOURCE_NONEXISTENT) {
        return insertSource(uri, hash);
      } else if (info.status & SOURCE_CHANGED) {
        deleteSource(info.id);
        return insertSource(uri, hash);
      } else { // unchanged
        return Q.reject();
      }
    });
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
          'INSERT INTO clues (sourceId, categoryId, level, clue, answer) VALUES (?, ?, ?, ?, ?)',
          sourceId, categoryId, data.level, data.clue, data.answer,
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
