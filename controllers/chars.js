/*jshint node:true */

var pg = require('pg.js'),
  config = JSON.parse(require('fs').readFileSync('config.json')),
  db = new pg.Client(config.db);

db.on('error', function (err) {
  console.log('Database error:', err);
});

db.on('notice', function (notice) {
  console.log('Database notice:', notice);
});

db.connect();

exports.blocks = function (req, res) {
  // Looks up the list of blocks, then renders the homepage.
  db.query('select name, id from blocks', function (err, result) {

    if (err) {
      console.log('Error querying blocks:', err);
      return res.send(500);
    }

    res.render('index', {
      title: 'Unicode Character Database',
      blocks: result.rows
    });
  });
};

exports.search = function (req, res) {
  // Returns JSON array of characters based on given search criteria.

  var query, queryParams,
    select = 'SELECT code, name, alt_name FROM chars WHERE ';

  // If both name and block_id are missing, we don't know what to search for.
  if (!req.query.name && !req.query.block_id) {
    return res.send(400);
  }

  // There are three potential search types:
  // - name but no block ID
  // - name and block ID
  // - block ID but no name

  // When searching with no block ID, the output must be limited otherwise we
  // might end up returning tens of thousands of characters, and the browser
  // won't like rendering a list that big. TODO: pagination!
  if (req.query.name && !req.query.block_id) {
    query = select + 'name LIKE $1 OR alt_name LIKE $1 ORDER BY code LIMIT 300';
    queryParams = ['%' + req.query.name.toUpperCase() + '%'];
  }

  if (req.query.name && req.query.block_id) {
    query = select + '(name LIKE $1 OR alt_name LIKE $1) AND block_id = $2';
    queryParams = ['%' + req.query.name.toUpperCase() + '%', +req.query.block_id];
  }

  if (req.query.block_id && !req.query.name) {
    query = select + 'block_id = $1';
    queryParams = [+req.query.block_id];
  }

  console.log(query);
  console.log(queryParams);

  db.query(query, queryParams, function (err, result) {
    var chars;

    if (err) {
      console.log('Error selecting characters:', err);
      return res.send(500);
    }

    chars = result.rows.map(function (char) {
      return {
        char: char.name === '<control>' ? '' : String.fromCharCode(char.code),
        code: char.code,
        hexCode: char.code.toString(16),
        name: char.name,
        altName: char.alt_name
      };
    });

    res.send(chars);
  });

};
