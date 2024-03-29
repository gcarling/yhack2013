/*
  takes a path representing the initial URL of the token
  and the path from which to start looking
  */
//callback takes in an array of pathnames
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
	    for(file in parsedBody.contents) {
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
		       && ind == 0) {
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
