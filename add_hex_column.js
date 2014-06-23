/*jshint node:true */
var pg = require('pg.js'),
  config = JSON.parse(require('fs').readFileSync('config.json')),
  db = new pg.Client(config.db);

db.connect(function (err) {
  if (err) {
    console.log('Initialisation error.');
    console.log(err);
    return;
  }

  db.query('ALTER TABLE chars ADD COLUMN code_hex character varying');
  db.query('UPDATE chars set code_hex = to_hex(code)');

});

