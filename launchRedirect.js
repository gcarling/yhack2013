
//takes in an array with the
//path and an array of parameters for the redirect
function getRedirect(dropid, userid, callback, token) {
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
            // send to manage
            res.redirect("./manage");
        }
    });
}

function getRedirectHelp(siteListEntry, userid, callback, token) {
    var output = {};
    output['parameters'] = [];
    var sitesList = siteListEntry.siteList;
    if(sitesList.length > 0) {
        output['address'] = "manage";
        output['parameters']['sitesList']  = sitesList;
        callback(output);
    }
    else {
        var startPath = "https://api.dropbox.com/1/metadata/dropbox/";
        listIndexPaths(startPath, "", token,
            function(arr) {
                possibleSitesList = arr;
                if(possibleSitesList.length > 0) {
                output['address'] = "which";
                output['parameters']['sitesList'] = possibleSitesList;
                }
                else
                output['address'] = "create";
                callback(output);
            });
    }
}
function listIndexPathsHelp(startPath, call, token, arr, ind, isLast,
			   callback) {
    request.get(startPath + call, {
        list: true,
        file_limit:25000,
        headers: { Authorization: 'Bearer ' + token }
    }, function (error, response, body) {
        var parsedBody = JSON.parse(body);
        if(parsedBody.is_dir) {
            var counter = 0;
            parsedBody.contents.forEach(function (file) {
                if (!(counter == parsedBody.contents.length - 1)) {
                    isLast = false;
                }
                var fileOb = parsedBody.contents[file];
                var filePath = (fileOb.path.split("/"));
                if(ind > 0 && fileOb.is_dir) {
                    listIndexPathsHelp(fileOb.path, call, token,
                           arr, ind-1, isLast, callback);
                }
                else {
                    if(filePath[filePath.length - 1] === "index.html"
                       && ind >=0) {
                    arr.push(fileOb.path);
                    }
                    if(isLast)
                    callback(arr);
                }
            }
        }
    });
}
function listIndexPaths(startPath, call, token, callback) {
    var arr = new Array();
    listIndexPathsHelp(startPath, call, token, arr, 5, true, callback);
}
