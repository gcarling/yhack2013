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


var nameSchema = new mongoose.Schema({
    name: String,//siteName --- NOT the path
    filePath: String,
    dropid: String,
    token: String
});

var userSchema = new mongoose.Schema({
    uniqueid: String,
    dname: String,
    dtoken: String,
});

var site = new mongoose.Schema({
    sitename: String,
    path: String
});

var siteListSchema = new mongoose.Schema({
    dropid: String,
    siteList: [site]
});

var NameSchemaModel = mongoose.model("nameSchema", nameSchema);
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

app.get('/createone_failed', function(req, res) {
  res.sendfile("./createone-error.html");
});

app.get('/createone', function(req, res) {
  res.sendfile("./createone.html");
});


function generateManage(user_sites){
  var html = fs.readFileSync("manage.html", "utf8");
  var parsed = html.split("**PARSE HERE**");
  start = parsed[0];
  end = parsed[1];
  var build = "";
  for (var i = 0; i < user_sites.length; i++){
    build += "<button class='btn btn-primary a-site' id='site";
    build += i;
    build += "'>";
    build += user_sites[i].sitename + " - " + user_sites[i].path;
    build += "</button><button class='btn btn-primary delete' id='delete";
    build += i;
    build += "'>Delete</button></br>";
    //console.log(build);
  }
  //console.log(start + build + end);
  return start + build + end;
}

app.get('/manage',  function(req, res) {
  var userid = req.session.user_id;
  if (!userid) { 
      res.redirect("/");
      return;
  }
  User.findOne({uniqueid : userid}, function(err, user) {
        if(err || !user) {
            res.redirect("/");
            return;
        }
        var access_token = user.dtoken;
        request.get('https://api.dropbox.com/1/account/info', {
            headers: { Authorization: 'Bearer ' + access_token}},
            function(error, response, body) {
                if(error) {throw error}
                console.log(body);
                dropid = JSON.parse(body).uid;
                SiteListModel.findOne({dropid : dropid}, function(err, siteList) {
                    if (err) throw err;
                  console.log(dropid);
                  console.log(siteList.siteList);
                  returnhtml = generateManage(siteList.siteList);
                  res.send(returnhtml);            
            });
        });
   });
});

app.get("/site/*", function(req, res) {
  var url = req.url; 
  // cuts off the /s/
  var filepath = url.substring("/site/".length);
  // gets the sitename (at the beginning of the filepath)
  var sitename = filepath.split("/")[0];
  // gets the real filepath, after sitename
  var realfilepath = filepath.substring(sitename.length);
  if(realfilepath === "/" || realfilepath === "") {
    res.redirect("./index.html");
    return;
  }
  NameSchemaModel.findOne({name : sitename}, function(err, blob) {
    var headpath = blob.filePath;
    var access_token = blob.token;
    console.log(access_token);
    var geturl = 'https://api-content.dropbox.com/1/files/dropbox' + headpath + "" + realfilepath;
    ext_arr = realfilepath.split(".");
    ext = ext_arr[ext_arr.length - 1];
    if(ext === "html" ||  ext === "js") {
    request.get(geturl, {
      headers: { Authorization: 'Bearer ' + access_token}},
      function(error, response, body) {
        res.send(body);
    }); 
    } else {
      // link 'em
      geturl = 'https://api.dropbox.com/1/media/dropbox' + headpath + realfilepath;
        request.post(geturl, {headers: { Authorization: 'Bearer ' + access_token}},
        function(error, response, body) {
          if(error){throw error}
          res.redirect(JSON.parse(body).url);
      }); 
    }
  });   
});

app.post("/deletion", function(req, res) {
    User.findOne({"uniqueid": req.session.user_id},
	function(err, data) {
	    if(err) {
            res.send("-1");
        }
        request.get('https://api.dropbox.com/1/account/info',
            {headers: { Authorization: 'Bearer ' + data.dtoken}},
       function(error, response, body) {
           if(error) {
               res.send("-1");
           }
           deleteSiteEntry(JSON.parse(body).uid, req.body.sitename, res);
       });
	});
});

function deleteSiteEntry(dropid, sitename, res) {
    NameSchemaModel.findOne({"dropid": dropid, "name": sitename},
	function(err, data) {
	    if(err) {
            res.send("-1");
        }
	    data.remove()});
    SiteListModel.findOne({"dropid": dropid},
	function(err, data) {
    console.log(siteList.siteList);
	    if(err) {
            res.send("-1");
        }
	    if(siteIndexOf(data.siteList,sitename) != -1) {
            data.siteList.splice(siteIndexOf(data.siteList,sitename), 1);
            data.save(function() {
                res.send("1");
            });
	    }
	});
}

function siteIndexOf(sitelist, sitename) {
    for (var i = 0; i < sitelist.length; i++) {
        if (site.sitename === sitename) {
            return i;
        }
    }
    return -1;
}

app.post('/createcallback', function(req, res) {
  var newfolder = req.body.sitename;
  var userid = req.session.user_id;
  NameSchemaModel.findOne({"name" : newfolder},
	function(err, id) {
	    if(err) {
            throw err;
        }
	    else if (id) {
            res.redirect("./createone_failed");
            return; 
	    }
	    User.findOne({uniqueid : userid}, function(err, user) {
            if(err || !user) {
                throw err;
            }
            var access_token = user.dtoken;
            request.post('https://api.dropbox.com/1/fileops/create_folder?root=dropbox&path=' + 
                encodeURI("/" + newfolder), {
                root : "dropbox",
                path : "/" + newfolder,
                headers: { Authorization: 'Bearer ' + access_token }
            }, function (error, response, body) {
                if(error) {
                    throw error;
                    res.redirect("./createone");
                }
			//add folder here
			request.post('https://api.dropbox.com/1/account/info', {
			    headers: { Authorization: 'Bearer ' + access_token}},
		          function(error, response, body) {
                      if(error) {throw error;}
                      SiteListModel.findOne({"dropid": JSON.parse(body).uid},
                            function(err, slist) {
                                var parsed = JSON.parse(body);
                                if(err) {throw err;}
                                if(slist) {
                                    console.log("1");
                                    slist.siteList.push({ sitename:newfolder,
                                        path:"/" + newfolder});
                                    slist.save(function() {
                                        var newNameSchema = new NameSchemaModel({
                                        name: newfolder,
                                        filePath: "/" + newfolder,
                                        dropid: parsed.uid,
                                        token: access_token
                                        });
                                        newNameSchema.save(function (err) {
                                             res.redirect("../manage");
                                        });
                                    });
                                }
                                else {
                                    console.log("2");
                                    var siteList = [];
                                    siteList.push({sitename : newfolder, 
                                        path : "/" + newfolder});
                                    var newList = new SiteListModel({
                                                    dropid: parsed.uid,
                                                    siteList: siteList});
                                    newList.save(function() {
                                        var newNameSchema = new NameSchemaModel({
                                        name: newfolder,
                                        filePath: "/" + newfolder,
                                        dropid: parsed.uid,
                                        token: access_token
                                        });
                                        newNameSchema.save(function (err) {
                                             res.redirect("../manage");
                                        });
                                    });
                                }
                     });
              });
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
                addUserToDB(token, "name", unique_id);
                
                // use token to get dropid and redirect to which, create
                request.get('https://api.dropbox.com/1/account/info', 
                        {
                          headers: { Authorization: 'Bearer ' + token }
                        },
                    function(error, response, body) {
                        getRedirect(JSON.parse(body).uid, unique_id, token, res);
			    });
        });
});

//takes in an array with the
//path and an array of parameters for the redirect
function getRedirect(dropid, userid, token, res) {
    SiteListModel.findOne({dropid: dropid}, function(err, sitelist) {
        // if no previous dropid
        if(err || !sitelist || sitelist.siteList.length == 0) {
            var newList = new SiteListModel(
                            {dropid: dropid,
                             siteList: []});
            newList.save();
            // search dropbox for index paths and send to which 
            NameSchemaModel.findOne({dropid: dropid}, function(err, site) {
                if (site) {
                    res.redirect("../manage");
                }
                else {
                listIndexPaths(token,
                    function (paths) {
                        console.log(paths);
                        if (paths.length == 0) {
                            // send to create
                            res.redirect("../createone");
                        } 
                        else {
                            res.location("../which");
                            res.send(generateWhich(paths));
                        }
                });
                }
            });
        }
        else {
            // send to manage **NEEDS TO CREATE THIS GET HANDLER 
            res.redirect("../manage");
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

app.post("/addManage", function(req, res) {
	console.log("getting called");
    var user_id = req.session.user_id;
    var currPaths = req.body.pathnames;
    request.get('https://api.dropbox.com/1/account/info', {
	headers: {Authorization: 'Bearer ' + user_id}},
	function(err, idData) {
	    dropid = idData.uid;
	    NameSchemaModel.findOne({"dropid": dropid},
		function(err, tokenData) {
		    listIndexPaths(tokenData.token, function(arr) {
			if(arr.length != 0) {
			    var outpaths = new Array();
			    var count = 0;
			    for(var i = 0; i < arr.length; i++) {
				var found = false;
				for(var j = 0; j < currPaths.length; j++) {
				    if(currPaths[j] === arr[i])
					found = true;
				}
				if(!found) {
				    outpaths[count] = arr[i];
				    count++;
				}
			    }
			    res.location("./which");
                            res.send(generateWhich(outpaths));
			}
		    });
		});
	});
});

app.get("/whichtest", function (req, res) {
    res.send(generateWhich(["/bin/sleep", "/course/cs033/hi"]));
});

app.post("/whichCreate", function (req, res) {
    var user_id = req.session.user_id; 
    var path = req.body.path;
    var sitename = req.body.sitename;
    User.findOne({uniqueid: user_id},
	function(err, userdata) {
	    if(err) {throw err;}
	    if(userdata) {
		request.get('https://api.dropbox.com/1/account/info', {
		    headers: { Authorization: 'Bearer ' + userdata.dtoken}},
              function(err, dropdata) {
                  if(err) {throw err;}
                  if(dropdata) {
                  NameSchemaModel.findOne({name: sitename},
                     function(err, data) {
                     if(err) {throw err;}
                     if(!data) {
                         var newName = new NameSchemaModel({
                                     name: sitename,
                                     filePath: path,
                                     dropid: dropdata.uid,
                                     token: userdata.dtoken});
                         newName.save();
                         console.log("drop data: " + dropdata);
                         SiteListModel.findOne({dropid: dropdata.uid},
                            function(err, siteListModelData) {
                                if(err){throw err;}
                                if(siteListModelData) {
                                    siteListModelData.siteList.push({sitename:sitename,
                                                                     path: path});
                                    siteListModelData.save();
                                }
                            });
                            res.redirect("../site/" + sitename);
                         }
                  });
              }
          });
	    }
	});
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

function listIndexPaths(token, callback) {
    var meta_uri = "https://api.dropbox.com/1/metadata/dropbox";
    var options = {
        list: true,
        file_limit: 25000,
        headers: {Authorization: "Bearer " + token}
    };
    request.get(meta_uri , options, function (error, response, body) {
        var contents = JSON.parse(body).contents;
        contents.filter(function (e) {
            return e.is_dir;
        });
        var count = [];
        count.push(contents.length);
        var paths = [];  
        contents.forEach(function(dirName) {
            request.get(meta_uri + dirName.path, options, 
                function (err, res, bod) {
                    var dirMeta = JSON.parse(bod);
                    if (dirMeta) {
                        if(dirMeta.is_dir == false) {
                          count[0] = count[0] - 1;
                          if (count[0] == 0) callback(paths);
                          return;
                        }
                        dirMeta.contents.forEach(function (item) {
                            if (typeof item.path != 'undefined' && item.path) {
                                var split = item.path.split("/");
                                if (split[split.length-1] === "index.html") {
                                    paths.push(JSON.parse(bod).path);
                                }
                            }
                        });
                        count[0] = count[0] - 1;
                        if (count[0] == 0) callback(paths);
                    }
                }
            );
        }); 
    });
}















