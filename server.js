require('./lib/db').connect(function(err, db) {
    if (err) throw err;
    db.end(function(err) {
        if (err) throw err;
        console.log('MySQL connection closed');
    });
});
