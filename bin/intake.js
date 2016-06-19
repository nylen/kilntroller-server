#!/usr/bin/env node

var moment = require('moment'),
    split  = require('split');

var insertQuery = `
    INSERT INTO temperature_data (
        measured_at,
        temp_1,
        temp_2,
        temp_3,
        temp_avg,
        setpoint
    ) VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
    )
    ON DUPLICATE KEY UPDATE
        temp_1 = VALUES(temp_1),
        temp_2 = VALUES(temp_2),
        temp_3 = VALUES(temp_3),
        temp_avg = VALUES(temp_avg),
        setpoint = VALUES(setpoint)
    ;
`

require('../lib/db').connect(function(err, db) {
    if (err) throw err;

    process.stdin.pipe(split())
        .on('data', function(line) {
            if (!line.trim()) return;
            try {
                var obj = JSON.parse(line);
                if (
                    !obj.timestamp ||
                    !obj.computed.T1 ||
                    !obj.computed.T2 ||
                    !obj.computed.T3 ||
                    !obj.computed.temperature ||
                    !('setpoint' in obj)
                ) {
                    throw new Error('invalid object data');
                }
                process.stdin.pause();
                db.query(insertQuery, [
                    moment.utc(obj.timestamp).toDate(),
                    Math.round(obj.computed.T1 * 100),
                    Math.round(obj.computed.T2 * 100),
                    Math.round(obj.computed.T3 * 100),
                    Math.round(obj.computed.temperature * 100),
                    obj.setpoint ? Math.round(obj.setpoint * 100) : null
                ], function(err) {
                    process.stdin.resume();
                    if (err) throw err;
                    console.log('updated');
                });
            } catch (err) {
                console.error('Invalid object: ' + err.message);
            }
        })
        .on('end', function() {
            db.end(function(err) {
                if (err) throw err;
                console.log('MySQL connection closed');
            });
        });

    console.log('ready');
});
