/*jshint node:true */

var pg = require('pg.js'),
  config = JSON.parse(require('fs').readFileSync('config.json')),
  db = new pg.Client(config.db),
  ucs2 = require('punycode').ucs2,

  MAX_RESULTS = 500;

db.on('error', function (err) {
  console.log('Database error:', err);
});

db.on('notice', function (notice) {
  console.log('Database notice:', notice);
});

db.connect();

exports.blocks = function (req, res) {

  db.query('UPDATE analytics SET count = count + 1');

  // Looks up the list of blocks, then renders the homepage.
  db.query('SELECT name, id FROM blocks ORDER BY name', function (err, result) {

    if (err) {
      console.log('Error querying blocks:', err);
      return res.send(500);
    }

    res.render('index', {
      title: 'Unicode Character Database',
      blocks: result.rows,
      timestamp: Date.now(),
      blocksJSON: JSON.stringify(result.rows)
    });
  });
};

function buildQuery(ch, block) {
  // Note: some aliases are enclosed in double quotes because otherwise they'd
  // be converted to lowercase by Postgres.
  var select = 'SELECT CASE chars.name WHEN \'<control>\' THEN \'\' ELSE \'&#\' || code || \';\' END AS char, chars.code, chars.code_hex AS "hexCode", chars.name, chars.alt_name AS "altName", chars.wgl4, chars.html_entity AS "htmlEntity", blocks.name AS block, blocks.id AS "blockId", CAST(COUNT(code) OVER () AS integer) AS count FROM chars INNER JOIN blocks ON chars.block_id = blocks.id WHERE ',

    chars,
    decCode;

  ch = ch || '';
  block = +(block || '');
  decCode = parseInt(ch, 10) || -1;

  // Convert JavaScript string (UCS-2 encoding) into an array of numbers
  // representing Unicode code points, because String.charCodeAt() only works on
  // single-byte characters.
  chars = ucs2.decode(ch);

  // There are four potential search types:
  // - literal character
  // - name but no block ID
  // - name and block ID
  // - block ID but no name

  // When searching with no block ID, the output must be limited otherwise we
  // might end up returning tens of thousands of characters, and the browser
  // won't like rendering a list that big. TODO: pagination!
  // Also, with no block ID specified in a search, we return the block name and
  // ID so it can be linked to in the HTML result.

  // Simplest case: match single character.
  if (chars.length === 1) {
    return {
      select: select + 'chars.code = $1',
      params: [chars[0]],
      searchType: 'single character'
    };
  }

  ch = ch.toLowerCase();

  // No block ID (implied: char name is not blank).
  if (block === 0) {
    return {
      select: select + 'chars.name LIKE $1 OR chars.alt_name LIKE $1 OR chars.html_entity = $2 OR chars.code_hex = $2 OR chars.code = $3 ORDER BY code LIMIT ' + MAX_RESULTS,
      params: ['%' + ch + '%', ch, decCode],
      searchType: 'name only'
    };
  }

  // No character given but...
  if (ch === '') {

    // ...WGL4 meta-block given.
    if (block === -1) {
      return {
        select: select + 'wgl4 = true ORDER BY code',
        params: [],
        searchType: 'block only (WGL4)'
      };
    }

    // ...real block ID given.
    return {
      select: select + 'block_id = $1 ORDER BY code',
      params: [block],
      searchType: 'block only'
    };
  }

  // Char name given and...
  if (block === -1) {
    // ...WGL4 meta-block given.
    return {
      select: select + '(chars.name LIKE $1 OR alt_name LIKE $1 OR html_entity = $2 OR code_hex = $2 OR code = $3) AND wgl4 = true ORDER BY code',
      params: ['%' + ch + '%', ch, decCode],
      searchType: 'name and WGL4'
    };
  }

  // ...char name and real block given.
  return {
    select: select + '(chars.name LIKE $1 OR alt_name LIKE $1 OR html_entity = $2 OR code_hex = $2 OR code = $3) AND block_id = $4 ORDER BY code',
    params: ['%' + ch + '%', ch, decCode, block],
    searchType: 'name and block'
  };
}

exports.search = function (req, res) {
  // Returns JSON array of characters based on given search criteria.

  var query,
    startTime = process.hrtime();

  // If both name and block_id are missing, we don't know what to search for.
  if (!req.query.name && !req.query.block_id) {
    return res.send(400);
  }

  query = buildQuery(req.query.name, req.query.block_id);

  db.query(query.select, query.params, function (err, result) {
    var endTime;

    if (err || !result) {
      db.end();
      console.log('Error selecting characters:', err);
      return res.send(500);
    }

    if (result.rows.length === 0) {
      return res.send(404, { chars:[], count: 0 });
    }

    endTime = (process.hrtime(startTime)[1] / 1000000).toFixed(2);

    if (query.searchType === 'single character') {
      console.log([(new Date()).toISOString(), req.ip, query.searchType, JSON.stringify(query.params.concat([req.query.name])), endTime + 'ms'].join('\t'));
    } else {
      console.log([(new Date()).toISOString(), req.ip, query.searchType, JSON.stringify(query.params), endTime + 'ms'].join('\t'));
    }

    res.send({ chars: result.rows, count: result.rows[0].count });
  });

};
