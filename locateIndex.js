/*
  takes a path representing the initial URL of the token
  and the path from which to start looking
  */
function listIndexPathsHelp(startPath, call, token, arr, ind) {
    request.get(startPath + call, {
	list: true,
	file_limit:25000,
	headers: { Authorization: 'Bearer ' + token }
    }, function (error, response, body) {
	var parsedBody = JSON.parse(body);
	if(parsedBody.is_dir) {
	    for(file in parsedBody.contents) {
		var fileOb = parsedBody.contents[file];
		var filePath = (fileOb.path.split("/"));
		if(filePath[filePath.length - 1] === "index.html"
		  && ind == 0) {
		    arr.push(fileOb.path);
		}
		else if(ind > 0 && fileOb.is_dir) {
		    listIndexPathsHelp(fileOb.path, call, token,
				   arr, ind-1);
		}
	    }
	}
    });
}
function listIndexPaths(startPath, call, token) {
    var arr = new Array();
    listIndexPathsHelp(startPath, call, token, arr, 5);
    return arr;
}
