var mysql = require('mysql');

var config = require('./config');

exports.connect = function(done) {
    var pool = mysql.createPool(Object.assign({
        connectionLimit : 2,
    }, config.mysql));

    require('./migrations').doMigrations(pool, function(err) {
        if (err) {
            done(err);
        } else {
            done(null, pool);
        }
    });
};
