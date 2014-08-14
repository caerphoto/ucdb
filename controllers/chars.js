/*jshint node:true */
var pg = require('pg'),
  fs = require('fs'),
  config = JSON.parse(fs.readFileSync('config.json')).db,

  MAX_RESULTS = 128,

  // The more unwieldy SQL strings are in their own files:
  SQL = {
    select: fs.readFileSync('assets/select.sql') + ' ',
    blocks: 'SELECT name, id FROM blocks ORDER BY name'
  },
  ucs2 = require('punycode').ucs2,

  blocks = {
    '': '<no block>',
    '-1': 'WGL4'
  },
  chars;


// Load all characters into memory.
pg.connect(config, function (err, client, done) {
  if (err) {
    console.log('Error connecting to DB', err);
    return done(client);
  }

  client.query(SQL.select, function (err, result) {
    if (err) {
      console.log('Error loading characters from DB', err);
      return done(client);
    }

    console.log('Successfully loaded characters from DB');
    chars = result.rows;
    done();
  });
});

exports.index = function (req, res) {
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

      // Build block name lookup, for nicer query logging.
      result.rows.forEach(function (row) {
        blocks[row.id.toString()] = row.name;
      });

      res.render('index', {
        title: 'Unicode Character Database',
        blocks: result.rows,
        timestamp: Date.now(),
        blocksJSON: JSON.stringify(result.rows),
        pageSize: MAX_RESULTS
      });
    });
  });
};

function filterResults(ch, block) {
  var charCodes,
    decCode,
    result,
    re;

  function testRow(row) {
    return (
      re.test(row.name) ||
      re.test(row.altName) ||
      row.htmlEntity === ch ||
      row.hexCode === ch ||
      row.code === decCode
    );
  }

  block = (block || '');
  decCode = parseInt(ch, 10) || -1;

  // Convert JavaScript string (UCS-2 encoding) into an array of numbers
  // representing Unicode code points, because String.charCodeAt() only works on
  // single-byte characters.
  charCodes = ucs2.decode(ch);

  // There are four potential search types:
  // - literal character
  // - name but no block ID
  // - name and block ID
  // - block ID but no name

  // Simplest case: match single character.
  if (charCodes.length === 1) {
    chars.some(function (row) {
      if (row.code === charCodes[0]) {
        result = [row];
        return true;
      }
    });
    return result;
  }

  ch = (ch || '').toLowerCase();
  re = new RegExp(ch);

  // Find by name, but no block ID
  if (block === '') {
    return chars.filter(testRow);
  }

  // No character given but...
  if (ch === '') {

    // ...WGL4 meta-block given.
    if (block === '-1') {
      return chars.filter(function (row) {
        return row.wgl4;
      });
    }

    // ...real block ID given.
    return chars.filter(function (row) {
      return row.blockId === block;
    });
  }

  // Char name given and...
  if (block === '-1') {
    // ...WGL4 meta-block given.

    return chars.filter(function (row) {
      return testRow(row) && row.wgl4;
    });
  }

  // ...char name and real block given.
  return chars.filter(function (row) {
    return testRow(row) && row.blockId === block;
  });
}

exports.search = function (req, res) {
  // Returns JSON array of characters after filtering based on given search
  // criteria.

  var startTime = process.hrtime(),
    endTime,

    offset = 0,
    result = {};

  // If both name and block_id are missing, we don't know what to search for.
  if (!req.query.name && !req.query.block_id) {
    return res.send(400);
  }

  result.rows = filterResults(req.query.name, req.query.block_id);

  result.rows.sort(function (a, b) {
    return a.code < b.code ? -1 : 1;
  });

  result.count = result.rows.length;
  if (result.count > MAX_RESULTS) {
    if (req.query.offset) {
      offset = parseInt(req.query.offset, 10) * MAX_RESULTS;
      result.rows = result.rows.slice(offset, offset + MAX_RESULTS);
    } else {
      result.rows = result.rows.slice(0, MAX_RESULTS);
    }
  }

  endTime = (process.hrtime(startTime)[1] / 1000000).toFixed(1);

  console.log([
    (new Date()).toISOString(),
    req.ip,
    '"' + req.query.name + '"',
    '"' + req.query.block_id + '" (' + blocks[req.query.block_id] + ')',
    'o:' + offset,
    result.count,
    endTime + 'ms'
  ].join('\t'));

  if (result.count === 0) {
    return res.send(404, { chars:[], count: 0 });
  }

  res.send({ chars: result.rows, count: result.count });
};
