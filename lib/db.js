var mysql = require('mysql');

var config = require('./config');

exports.connect = function(done) {
    var db = mysql.createConnection(config.mysql);
    db.connect();

    require('./migrations').doMigrations(db, function(err) {
        if (err) {
            done(err);
        } else {
            done(null, db);
        }
    });
};
