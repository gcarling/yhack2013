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
});

var siteListSchema = new Schema({
    dropid: String,
    siteList: [String]
});

var SiteListModel = mongoose.model("siteList", siteListSchema);
var User = mongoose.model("user", userSchema);

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

app.get('/createone/:used', function(req, res) {
  var error = req.params.used;
  if(error) {
    res.sendfile("./createone-error.html");
  } else {
    res.sendfile("./createone.html");
  }
});
var nameSchema = new Schema({
    name: String,//siteName --- NOT the path
    filePath: String,
    dropid: String,
    token: String});
var NameSchemaModel = mongoose.model("nameSchema", siteListSchema);

app.post("/deletion", function(req, res) {
    User.findOne({"uniqueid": req.session.user_id},
	function(err, data) {
	    if(err) {throw err;}
	        request.get('https://api.dropbox.com/1/account/info',
			    {headers: { Authorization: 'Bearer ' + data.dtoken}},
		   function(error, response, body) {
		       if(error) {throw error;}
		       deleteSiteEntry(JSON.parse(body).uid, req.filename);
		   });
	});
});
function deleteSiteEntry(dropid, filename) {
    NameSchemaModel.findOne({"dropid": dropid, "name": name},
	function(err, data) {
	    if(err) {throw err;}
	    data.remove()});
    SiteListModel.findOne({"dropid": dropid},
	function(err, data) {
	    if(err) {throw err;}
	    if(data.siteList.indexOf(filename) != -1) {
		data.siteList.splice(data.siteList.indexOf(filename), 1);
	    }
	});
}


app.post('/createcallback', function(req, res) {
  var newfolder = req.body.sitename;
  var userid = req.session.user_id;
  NameSchemaModel.findOne({"filePath" : newfolder},
	function(err, id) {
	    if(err) {throw err};
	    else if(id) {
		res.redirect("./createone?used=true")
		return;
	    }
	    User.findOne({uniqueid : userid}, function(err, user) {
		if(err || !(user)) {
		    throw err;
		}
		
		var access_token = user.dtoken;
		request.get('https://api.dropbox.com/1/fileops/create_folder', {
		    root : "dropbox",
		    path : "/" + newfolder,
		    headers: { Authorization: 'Bearer ' + token }
		}, function (error, response, body) {
		    if(error) {
			throw error;
			res.redirect("./createone");
		    }
		    //add folder here
		    request.get('https://api.dropbox.com/1/account/info', {
			headers: { Authorization: 'Bearer ' + token}},
			function(error, response, body) {
			    if(error) {throw error}
			    SiteListModel.findOne({"dropid": JSON.parse(body).uid},
				function(err, id) {
				    if(err) {throw err}
				    if(id) {
					id.siteList.push(newfolder);
				    }
				    else {
					var newNameSchema = new NameSchemaModel({
					    name: newfolder,
					    filePath: "/" + newfolder,
					    dropid: JSON.parse(body).uid,
					    token: token});
					newNameSchema.save();
					var newList = new SiteListModel({
					    dropid: JSON.parse(body).uid,
					    siteList: [newfolder]});
					newList.save();
				    }
				});
			});
		    res.redirect("./manage");
		    
		});
	    });
	});
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
<<<<<<< HEAD
                // use the bearer token to make API calls
	        request.get('https://api.dropbox.com/1/account/info', {headers: { Authorization: 'Bearer ' + token}},
			    function(error, response, body) {
				getRedirect(JSON.parse(body).uid);
=======

                // use token to get dropid and redirect to which, create
                request.get('https://api.dropbox.com/1/account/info', 
                        {
                          headers: { Authorization: 'Bearer ' + token }
                        },
                    function(error, response, body) {
                        getRedirect(JSON.parse(body).uid, unique_id, token);
>>>>>>> ccdc7ee0c3c26b158cf7a13b6898dff06c721c57
			    });
        });
});

//takes in an array with the
//path and an array of parameters for the redirect
function getRedirect(dropid, userid, token) {
    SiteListModel.findOne({"dropid": dropid}, function(err, sitelist) {
        // if no previous dropid
        if(err || !sitelist || sitelist.siteList.length == 0) {
            var newList = new SiteListModel(
                            {dropid: dropid,
                             siteList: []});
            newList.save();
            // search dropbox for index paths and send to which 
            var startPath = "https://api.dropbox.com/1/metadata/dropbox/";
            listIndexPaths(startPath, "", token,
                function (paths) {
                    if (paths.length == 0) {
                        // send to create
                        res.redirect("./create");
                    } 
                    else {
                        res.location("./which");
                        res.send(generateWhich(paths));
                    }
                });
        }
        else {
            // send to manage **NEEDS TO CREATE THIS GET HANDLER 
            res.redirect("./manage");
        }
    });
}

function addUserToDB(token, name, uniqueid) {
    var newuser = new User({
        uniqueid: uniqueid,
        dname: name,
        dtoken: token,
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



app.get("/whichtest", function (req, res) {
    res.send(generateWhich(["/bin/sleep", "/course/cs033/hi"]));
});

app.post("/whichCreate", function (req, res) {
    var user_id = req.session.user_id; 
    var path = req.body.path;
    var sitename = req.body.sitename;
    res.send(user_id + " " + path + " " + sitename);
});

function generateWhich(paths) {
    var html = fs.readFileSync("which.html", "utf8");
    var parsed = html.split("**PARSE HERE**");
    var built = parsed[0];
    for (var i = 0; i < paths.length; i++) {
        built += "<a href='#' data-toggle='modal' data-target='#myModal'>" + 
            "<li class='list-group-item'>" 
            + breadcrumbed(paths[i]) + "</li></a>";
    }
    built += parsed[1];
    return built;
}

function breadcrumbed(str) {
    var breadcrumb = "";
    for (var i = 0; i < str.length; i++) {
        var character = str.substring(i,i+1);
        if (character == '/') {
            if (i != 0) {
                breadcrumb += " > ";
            }
        }
        else {
            breadcrumb += character;
        }
    }
    return breadcrumb;
}


