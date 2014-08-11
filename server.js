/*jshint node:true */
var express = require('express'),
  hbs = require('express3-handlebars'),
  controllers = {
    chars: require('./controllers/chars')
  },
  app = express();

app.enable('trust proxy'); // to get original IP of requests
app.engine('handlebars', hbs());
app.set('view engine', 'handlebars');
app.use(express.static(__dirname + '/static'));

app.get('/', controllers.chars.index);
app.get('/search', controllers.chars.search);

if (process.env.NODE_ENV === 'production') {
  app.listen(5563, 'localhost'); // hex codes for U and c
  console.log("UCDB listening on port 5563 to localhost ONLY.");
} else {
  app.listen(5563);
  console.log("UCDB listening on port 5563.");
}
