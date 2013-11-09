var fs = require("fs");
app.use(express.bodyParser());
//need to take as input the filepath
//in req.body
app.get("/post/", function(req, res) {
    var userid = req.session.user_id;
    
    
    for(input in req.body) {

    }
}
