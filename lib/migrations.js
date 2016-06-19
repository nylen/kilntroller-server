var fs   = require('fs'),
    path = require('path'),
    util = require('util');

function loadMigrations(cb) {
    var dir           = path.join(__dirname, '..', 'migrations'),
        migrations    = [],
        numMigrations = -1;

    fs.readdir(dir, function(err, files) {
        if (err) {
            cb(err);
            return;
        }

        for (var i = 0; i < files.length; i++) {
            var filename = files[i];

            if (/\.sql$/i.test(filename)) {
                var number = parseInt(filename.split('-')[0], 10);

                if (isNaN(number)) {
                    cb(new Error(util.format(
                        'Invalid migration filename: %s',
                        filename
                    )));
                    return;
                } else if (migrations[number]) {
                    cb(new Error(util.format(
                        'Duplicate migration number: %s',
                        filename
                    )));
                    return;
                }

                var contents = fs.readFileSync(
                    path.join(dir, filename),
                    'utf8'
                );

                migrations[number] = contents;
                numMigrations++;
            }
        }

        for (var i = 0; i < numMigrations; i++) {
            if (!migrations[i]) {
                cb(new Error(util.format(
                    'Missing migration index: %d',
                    i
                )));
                return;
            }
        }

        cb(null, migrations);
    });
}

function getCurrentVersion(db, migrations, done) {
    db.query('SELECT version FROM db_version', function(err, rows, fields) {
        if (err) {
            if (err.code === 'ER_NO_SUCH_TABLE') {
                // Migration 0 creates the db_version table
                db.query(migrations[0], function(err) {
                    setCurrentVersion(db, 0, function(err) {
                        if (err) {
                            done(err);
                        } else {
                            done(null, 0);
                        }
                    });
                });
            } else {
                done(err);
            }
            return;
        }

        if (rows.length === 1) {
            done(null, rows[0].version);
        } else {
            done(new Error(util.format(
                'Expected 1 db_version row but found %d',
                rows.length
            )));
        }
    });
}

function setCurrentVersion(db, version, done) {
    db.query('DELETE FROM db_version', function(err) {
        if (err) {
            done(err);
            return;
        }
        db.query(
            'INSERT INTO db_version (version) VALUES (?)',
            [version],
            function(err) {
                done(err);
            }
        );
    });
}

function doMigrations(db, done) {
    loadMigrations(function(err, migrations) {
        if (err) {
            done(err);
            return;
        }
        getCurrentVersion(db, migrations, function(err, version) {
            if (err) {
                done(err);
                return;
            }
            if (migrations[version + 1]) {
                console.log(
                    'Migrating to DB version %d',
                    version + 1
                );
                db.query(migrations[version + 1], function(err) {
                    if (err) {
                        done(err);
                        return;
                    }
                    setCurrentVersion(db, version + 1, function(err) {
                        if (err) {
                            done(err);
                            return;
                        }
                        doMigrations(db, done);
                    });
                });
            } else {
                console.log(
                    'DB version %d is up to date',
                    version
                );
                done();
            }
        });
    });
}

exports.doMigrations = doMigrations;
