var express = require("express");
var Dropbox = require("dropbox");
var fs = require("fs");
var https = require("https");
var crypto = require('crypto');
var request = require('request');
var url = require('url');
var mongoose = require("mongoose");

var mongoURI = "mongodb://Launch:Drop@paulo.mongohq.com:10045/LaunchDrop";
mongoose.connect(mongoURI);

var site = new mongoose.Schema({
    name: String,
    path: String
});

var userSchema = new mongoose.Schema({
    uniqueid: String,
    dname: String,
    dtoken: String,
    sites: [site]
});

var User = mongoose.model("user", userSchema);

//var client = new Dropbox.Client({
//    key: "dfxzvgtw5vbh0r4",
//    secret: "y3fpf3zgcpxecpr"
//});


// Init express
var app = express();

// Gzip requests for speed 
app.use(express.compress());

// Host static files
app.use(express.static(__dirname));

// Install Utilities
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({secret: "Grahammer'd Loins."}));
app.use(express.methodOverride());
app.use(app.router);
app.use(logErrors);
app.use(clientErrorHandler);
app.use(errorHandler);

//client.authDriver(new Dropbox.AuthDriver.Popup({
//    receiverUrl: "https://fdkfjskdlfjasdklfj/oauth_receiver.html"}));
//client.authDriver(new Dropbox.AuthDriver.NodeServer(8191));

// insert your app key and secret here
var APP_KEY = 'dfxzvgtw5vbh0r4'
var APP_SECRET = 'y3fpf3zgcpxecpr';

var userIdCount = 0;

function getUniqueId() {
    return generateCSRFToken() + userIdCount++;
}

function generateCSRFToken() {
        return crypto.randomBytes(18).toString('base64')
                .replace(/\//g, '-').replace(/\+/g, '_');
}

function generateRedirectURI(req) {
        return url.format({
                        protocol: req.protocol,
                        host: req.headers.host,
                        pathname: app.path() + '/callback'
        });
}

app.get('/createone', function(req, res) {
  res.sendfile("./createone.html");
});

app.get('/dropbox', function (req, res) {
        var csrfToken = generateCSRFToken();
        res.cookie('csrf', csrfToken);
        res.redirect(url.format({
                protocol: 'https',
                hostname: 'www.dropbox.com',
                pathname: '1/oauth2/authorize',
                query: {
                        client_id: APP_KEY,
                        response_type: 'code',
                        state: csrfToken,
                        redirect_uri: generateRedirectURI(req)
                }
        }));
});

app.get('/callback', function (req, res) {
        if (req.query.error) {
                return res.send('ERROR ' + req.query.error + 
                    ': ' + req.query.error_description);
        }

        // check CSRF token
        if (req.query.state !== req.cookies.csrf) {
                return res.status(401).send(
                    'CSRF token mismatch, possible cross-site request forgery attempt.'
                );
        }

        var unique_id = getUniqueId();
        // Sets user id cookie
        req.session.user_id = unique_id; 
        req.session.cookie.maxAge = 365 * 24 * 60 * 60 * 1000;

        // exchange access code for bearer token
        request.post('https://api.dropbox.com/1/oauth2/token', {
                form: {
                        code: req.query.code,
                        grant_type: 'authorization_code',
                        redirect_uri: generateRedirectURI(req)
                },
                auth: {
                        user: APP_KEY,
                        pass: APP_SECRET
                }
        }, function (error, response, body) {
                var data = JSON.parse(body);

                if (data.error) {
                        return res.send('ERROR: ' + data.error);
                }

                // extract bearer token
                var token = data.access_token;
                addUserToDB(token, "name", unique_pid);
                // use the bearer token to make API calls
                request.get('https://api.dropbox.com/1/metadata/dropbox/Intranet/git', {
                        list : true,
                        file_limit:25000,
                        headers: { Authorization: 'Bearer ' + token }
                }, function (error, response, body) {
                        res.send('Logged in successfully as ' + 
                            body + JSON.parse(body).display_name + '.');
                });
        });
});

function addUserToDB(token, name, uniqueid) {
    var newuser = new User({
        uniqueid: uniqueid,
        dname: name,
        dtoken: token,
        sites: []
    });
    newuser.save();
}

var privateKey = fs.readFileSync("ssl/gabes-key.pem", "utf8");
var certificate = fs.readFileSync("ssl/gabes-cert.pem", "utf8");
var credentials = {key: privateKey, cert: certificate};


/*
 * GET REQUESTS
 */


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

/*
 * HTML ASSEMBLING aka we should really use a templating language
 */

function whichSites(paths) {
    
}
