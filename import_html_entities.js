/*jshint node:true */
var fs = require("fs"),
  pg = require("pg.js"),
  db = new pg.Client({
    user:     "unicodedb",
    database: "unicodedb",
    host:     "localhost",
    password: "reaction cherry"
  }),
  ro = { encoding: "utf8" };

fs.readFile(__dirname + "/html_entities.txt", ro, function (err, txt) {
  var lines,
    entities;

  if (err) {
    console.log(err);
    return false;
  }

  lines = txt.split("\n");
  lines.pop();

  entities = lines.map(function (line) {
    var parts;
    if (!line) {
      return;
    }
    parts = line.split("\t");
    parts[2] = parts[2].match(/\(([0-9]+)\)/);
    return { name: parts[0], code: parseInt(parts[2][1], 10) };
  });

  db.connect(function (err) {
    if (err) {
      console.log(err);
      return;
    }

    db.query("ALTER TABLE chars ADD COLUMN html_entity character varying");

    entities.forEach(function (entity) {
      db.query(
        "update chars set html_entity = $1 where code = $2",
        [ entity.name, entity.code ]
      );
    });

    //db.end();
  });
});

