/* jshint bitwise:false, multistr:true */
'use strict';

var config  = require('config');
var sqlite3 = require('sqlite3');
var Q       = require('q');

module.exports = function() {
  var db;

  // Bitfield returned by checkSource()
  // TODO Just use a hash instead.
  var SOURCE_NONEXISTENT = 0x0;
  var SOURCE_EXISTS      = 0x1;
  var SOURCE_CHANGED     = 0x2;

  function init() {
    var logLevel = config.get('logLevel');
    if (logLevel === 'trace' || logLevel === 'debug') {
      sqlite3.verbose();
    }

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
    var info = { status: 0 };
    return Q.npost(db, 'get', ['SELECT * FROM sources WHERE uri = ?', uri])
      .then(function(row) {
        if (row) {
          info.id = row.id;
          info.status |= SOURCE_EXISTS;
          if (row.hash !== cmpHash) {
            info.status |= SOURCE_CHANGED;
          }
        }
        return info;
      });
  }

  // Deletes a source (and all its related data). Returns a promise.
  function deleteSource(id) {
    return Q.all([
      Q.npost(db, 'run', ['DELETE FROM sources WHERE id = ?', id]),
      Q.npost(db, 'run', ['DELETE FROM categories WHERE sourceId = ?', id]),
      Q.npost(db, 'run', ['DELETE FROM clues WHERE sourceId = ?', id])
    ]);
  }

  // Inserts a URI source into the database. Returns a promise.
  function insertSource(uri, hash) {
    return Q.Promise(function(resolve, reject) {
      db.run('INSERT INTO sources (uri, hash) VALUES (?, ?)', uri, hash, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
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
    return Q.Promise(function(resolve, reject) {
      db.run(
        'INSERT INTO categories (name, sourceId) VALUES (?, ?)',
        name,
        sourceId,
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // Returns a promise.
  function addClues(sourceId, categoryName, clues) {
    return addCategory(sourceId, categoryName).then(function(categoryId) {
      return Q.all(
        clues.map(function(data) {
          return Q.npost(db, 'run', [
            'INSERT INTO clues (sourceId, categoryId, level, clue, answer) VALUES (?, ?, ?, ?, ?)',
            sourceId, categoryId, data.level, data.clue, data.answer
          ])
        })
      );
    });
  }

  init();
  return {
    FINAL_CLUE: 999,
    addSource: addSource,
    addClues: addClues,
    shutdown: shutdown
  };
};
