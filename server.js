var express = require("express");
var dropbox = require("dropbox");
var fs = require("fs");

var privateKey = fs.readFileSync("ssl/gabes-key.pem", "utf8");
var certificate = fs.readFileSync("ssl/gabes-cert.pem", "utf8");
var credentials = {key: privateKey, cert: certicate};

// Init express
var app = express();

// Gzip requests for speed 
app.use(express.compress());

// Host static files
app.use(express.static(__dirname));

// Install Utilities
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(logErrors);
app.use(clientErrorHandler);
app.use(errorHandler);

/*
 * GET REQUESTS
 */

app.get("/", function(res, req) {
    sendfile("index.html");
});

var httpsServer = https.createServer(credentials, app);

// LAUNCH
var port = process.env.PORT || 8080;

httpsServer.listen(port);
console.log('Listening securely on port' + port);

/**
Error Handlers
*/

//logs errors to console
function logErrors(err, req, res, next) {
  console.error(err.stack);
  next(err);
}

//throws errors when its client side
function clientErrorHandler(err, req, res, next) {
  if (req.xhr) {
    res.send(500, { error: 'Something went wrong.' });
  } else {
    next(err);
  }
}

//catch-all
function errorHandler(err, req, res, next) {
  res.status(500);
  res.render('error', { error: err });
}

