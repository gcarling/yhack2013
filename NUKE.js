var mongoose = require('mongoose');

var mongoURI = "mongodb://Launch:Drop@paulo.mongohq.com:10045/LaunchDrop";
mongoose.connect(mongoURI);


var nameSchema = new mongoose.Schema({
    name: String,//siteName --- NOT the path
    filePath: String,
    dropid: String,
    token: String});

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

var SiteListModel = mongoose.model("siteList", siteListSchema);
var User = mongoose.model("user", userSchema);
var NameSchemaModel = mongoose.model("nameSchema", siteListSchema);

SiteListModel.find({}, function (err, users) {
    users.forEach(function (user) {
        user.remove();
    });

    NameSchemaModel.find({}, function (err, names) {
         names.forEach(function (name) {
             name.remove();
         });

         User.find({}, function (err, us) {
             us.forEach(function (u) {
                 u.remove();
             });
             console.log("NUKED.");
         });
    });
});
