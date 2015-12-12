var express = require("express");
var morgan = require('morgan');
var path = require('path');
var bodyParser = require('body-parser');
var session = require('client-sessions');
var app = express();
app.use(morgan('short'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  cookieName: 'session',
  secret: 'h1289fhoih2309h09his',
  duration: 30 * 60 * 1000,
  activeDuration: 5 * 60 * 1000,
}));
require('./routes/herdRoutes.js').init(app);
// Set the views directory
app.set('views', __dirname + '/public/views');

// Define the view (templating) engine
app.set('view engine', 'ejs');



app.listen(50000);
console.log("Server listening at http://localhost:50000/");
