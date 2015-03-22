var config  = require('config');
var sqlite3 = require('sqlite3').verbose();

module.exports = function() {
  var db;

  function init() {
    db = new sqlite3.Database(
      config.get('dbFile')
    );
    db.run('CREATE TABLE IF NOT EXISTS categories (name TEXT NOT NULL)');
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

  function addClues(categoryName, clues) {
    db.run('INSERT INTO categories (name) VALUES (?)', categoryName, function(err) {
      if (err) { return; }

      var categoryId = this.lastID;
      clues.forEach(function(data) {
        db.run(
          'INSERT INTO clues (categoryId, level, clue, answer) VALUES (?, ?, ?, ?)',
          categoryId, data.level, data.clue, data.answer
        );
      });
    });
  }

  init();
  return {
    FINAL_CLUE: 999,
    addClues: addClues,
    shutdown: shutdown
  };
}
