//db.js
//module to handle sqlite3 database operations
//uses sqlite3 package
//exports functions to get, all, and run queries
//database file is located at ../node/data/forum.db
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'node', 'data', 'forum.db');
const db = new sqlite3.Database(dbPath);

module.exports = {
  db,
  //get data from database
  get(sql, params = []) {
    return new Promise((resolve, reject) =>
      db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))
    );
  },
  //all data from database
  all(sql, params = []) {
    return new Promise((resolve, reject) =>
      db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
    );
  },
  //insert or update data in database
  run(sql, params = []) {
    return new Promise((resolve, reject) =>
      db.run(sql, params, function (err) {
        err ? reject(err) : resolve(this);
      })
    );
  }
};
