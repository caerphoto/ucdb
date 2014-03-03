/*jshint node:true */
var express = require('express'),
  hbs = require('express3-handlebars'),
  controllers = {
    chars: require('./controllers/chars')
  },
  app = express();

app.engine('handlebars', hbs());
app.set('view engine', 'handlebars');
app.use(express.static(__dirname + '/static'));

app.get('/', controllers.chars.blocks);
app.get('/search', controllers.chars.search);

app.listen(5563); // hex codes for U and c
console.log("UCDB listening on port 5563.");
