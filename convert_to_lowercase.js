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

  db.query('UPDATE chars SET name = LOWER(name)');
  db.query('UPDATE chars SET alt_name = LOWER(alt_name)');

});


