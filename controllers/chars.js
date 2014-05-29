/*jshint node:true */

var pg = require('pg.js'),
  config = JSON.parse(require('fs').readFileSync('config.json')),
  db = new pg.Client(config.db);

db.on('error', function (err) {
  console.err('Database error:', err);
});

db.on('notice', function (notice) {
  console.err('Database notice:', notice);
});

db.connect();

exports.blocks = function (req, res) {
  // Looks up the list of blocks, then renders the homepage.
  db.query('SELECT name, id FROM blocks ORDER BY name', function (err, result) {

    if (err) {
      console.err('Error querying blocks:', err);
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

  var queryParams = [],
    select = 'SELECT code, name, alt_name, wgl4, html_entity FROM chars WHERE ',
    selectWithBlock = 'SELECT chars.code, chars.name, chars.alt_name, chars.wgl4, chars.html_entity, blocks.name AS block, blocks.id AS block_id FROM chars INNER JOIN blocks ON chars.block_id = blocks.id WHERE ',
    where,
    charName = req.query.name || '',
    blockId = +(req.query.block_id || '');

  // If both name and block_id are missing, we don't know what to search for.
  if (!charName && !blockId) {
    return res.send(400);
  }

  // There are three potential search types:
  // - name but no block ID
  // - name and block ID
  // - block ID but no name

  // When searching with no block ID, the output must be limited otherwise we
  // might end up returning tens of thousands of characters, and the browser
  // won't like rendering a list that big. TODO: pagination!
  // Also, with no block ID specified in a search, we return the block name and
  // ID so it can be linked to in the HTML result.

  if (blockId < 1) {
    select = selectWithBlock;
  }

  if (blockId) {
    // Real block ID.
    if (charName) {
      if (blockId === -1) {
        // Char name and 'WGL4' meta-block.
        where = '(chars.name LIKE $1 OR alt_name LIKE $1) AND wgl4 = true ORDER BY code';
        queryParams = ['%' + charName.toUpperCase() + '%'];
      } else {
        // char name and real block ID.
        where = '(chars.name LIKE $1 OR alt_name LIKE $1) AND block_id = $2 ORDER BY code';
        queryParams = ['%' + charName.toUpperCase() + '%', blockId];
      }
    } else {
      // Block ID but no char name.
      if (blockId === -1) {
        where = 'wgl4 = true ORDER BY code';
      } else {
        where = 'block_id = $1 ORDER BY code';
        queryParams = [blockId];
      }
    }
  } else {
    // No block ID, implying only char name.
    where = 'chars.name LIKE $1 OR chars.alt_name LIKE $1 ORDER BY code LIMIT 500';
    queryParams = ['%' + req.query.name.toUpperCase() + '%'];
  }

  console.log((new Date()) + '\t', select, where + ';\t', queryParams);

  db.query(select + where, queryParams, function (err, result) {
    var chars;

    if (err || !result) {
      console.err('Error selecting characters:', err);
      return res.send(500);
    }

    if (result.rows.length === 0) {
      return res.send(404, []);
    }

    if (result.rows[0].block_id) {
      chars = result.rows.map(function (char) {
        return {
          char: char.name === '<control>' ? '' : '&#' + char.code,
          code: char.code,
          hexCode: char.code.toString(16),
          name: (char.name || '').toLowerCase(),
          altName: (char.alt_name || '').toLowerCase(),
          wgl4: char.wgl4,
          htmlEntity: char.html_entity,
          block: char.block,
          blockId: char.block_id
        };
      });
    } else {
      chars = result.rows.map(function (char) {
        return {
          char: char.name === '<control>' ? '' : '&#' + char.code,
          code: char.code,
          hexCode: char.code.toString(16),
          name: (char.name || '').toLowerCase(),
          altName: (char.alt_name || '').toLowerCase(),
          wgl4: char.wgl4,
          htmlEntity: char.html_entity
        };
      });
    }

    res.send(chars);
  });

};
