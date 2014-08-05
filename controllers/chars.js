/*jshint node:true */
var pg = require('pg'),
  fs = require('fs'),
  config = JSON.parse(fs.readFileSync('config.json')).db,

  MAX_RESULTS = 500,

  // The more unwieldy SQL strings are in their own files:
  SQL = {
    select: fs.readFileSync('assets/select.sql') + ' ',
    blocks: 'SELECT name, id FROM blocks ORDER BY name',
    where: {
      all: fs.readFileSync('assets/where_all.sql') + ' ' + MAX_RESULTS,
      wgl4: fs.readFileSync('assets/where_wgl4.sql'),
      block: fs.readFileSync('assets/where_block.sql')
    }
  },
  ucs2 = require('punycode').ucs2;

/*
db.on('error', function (err) {
  console.log('Database error:', err);
});

db.on('notice', function (notice) {
  console.log('Database notice:', notice);
});
*/

exports.blocks = function (req, res) {

  pg.connect(config, function (err, client, done) {
    client.query('UPDATE analytics SET count = count + 1');

    // Looks up the list of blocks, then renders the homepage.
    client.query(SQL.blocks, function (err, result) {

      if (err) {
        console.log('Error querying blocks:', err);
        done(client);
        return res.send(500);
      }

      done();

      res.render('index', {
        title: 'Unicode Character Database',
        blocks: result.rows,
        timestamp: Date.now(),
        blocksJSON: JSON.stringify(result.rows)
      });
    });
  });
};

function buildQuery(ch, block) {
  // Note: some aliases are enclosed in double quotes because otherwise they'd
  // be converted to lowercase by Postgres.

  var chars,
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
      sql: SQL.select + 'chars.code = $1',
      params: [chars[0]],
      searchType: 'single character'
    };
  }

  ch = ch.toLowerCase();

  // No block ID (implied: char name is not blank).
  if (block === 0) {
    return {
      sql: SQL.select + SQL.where.all,
      params: ['%' + ch + '%', ch, decCode],
      searchType: 'name only'
    };
  }

  // No character given but...
  if (ch === '') {

    // ...WGL4 meta-block given.
    if (block === -1) {
      return {
        sql: SQL.select + 'wgl4 = true ORDER BY code',
        params: [],
        searchType: 'block only (WGL4)'
      };
    }

    // ...real block ID given.
    return {
      sql: SQL.select + 'block_id = $1 ORDER BY code',
      params: [block],
      searchType: 'block only'
    };
  }

  // Char name given and...
  if (block === -1) {
    // ...WGL4 meta-block given.
    return {
      sql: SQL.select + SQL.where.wgl4,
      params: ['%' + ch + '%', ch, decCode],
      searchType: 'name and WGL4'
    };
  }

  // ...char name and real block given.
  return {
    sql: SQL.select + SQL.where.block,
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

  pg.connect(config, function (err, client, done) {
    query = buildQuery(req.query.name, req.query.block_id);

    client.query(query.sql, query.params, function (err, result) {
      var endTime,
        logParam;

      if (err || !result) {
        console.log('Error selecting characters:', err);
        done(client);
        return res.send(500);
      }

      done();

      endTime = (process.hrtime(startTime)[1] / 1000000).toFixed(2);

      if (query.searchType === 'single character') {
        logParam = JSON.stringify(query.params.concat([req.query.name]));
      } else{
        logParam = JSON.stringify(query.params);
      }

      console.log([
        (new Date()).toISOString(),
        req.ip,
        query.searchType,
        logParam,
        result.rows.length ? result.rows[0].count : 0,
        endTime + 'ms'
      ].join('\t'));

      if (result.rows.length === 0) {
        return res.send(404, { chars:[], count: 0 });
      }

      res.send({ chars: result.rows, count: result.rows[0].count });
    });
  });

};
