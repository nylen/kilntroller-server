#!/usr/bin/env node

var moment = require('moment'),
    split  = require('split');

JSON.stringifyCanonical = require('canonical-json');

var insertTemperatureQuery = `
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
`;

var insertScheduleQuery = `
    INSERT INTO schedule_changes (
        changed_at,
        schedule_started_at,
        step_started_at,
        steps_json
    ) VALUES (
        ?,
        ?,
        ?,
        ?
    )

    ON DUPLICATE KEY UPDATE
        changed_at = VALUES(changed_at),
        schedule_started_at = VALUES(schedule_started_at),
        step_started_at = VALUES(step_started_at),
        steps_json = VALUES(steps_json)
`;

function schedulesAreEqual(a, b) {
    a = JSON.parse(JSON.stringify(a)) || {};
    b = JSON.parse(JSON.stringify(b)) || {};
    ['startedAt', 'stepStartedAt', 'now'].forEach(function(k) {
        delete a[k];
        delete b[k];
    });
    return (
        JSON.stringifyCanonical(a) === JSON.stringifyCanonical(b)
    );
}

require('../lib/db').connect(function(err, db) {
    if (err) throw err;

    var lastSchedule = null;

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
                db.query(insertTemperatureQuery, [
                    // measured_at DATETIME NOT NULL
                    moment.utc(obj.timestamp).toDate(),
                    // temp_1 MEDIUMINT
                    Math.round(obj.computed.T1 * 100),
                    // temp_2 MEDIUMINT
                    Math.round(obj.computed.T2 * 100),
                    // temp_3 MEDIUMINT
                    Math.round(obj.computed.T3 * 100),
                    // temp_avg MEDIUMINT NOT NULL
                    Math.round(obj.computed.temperature * 100),
                    // setpoint MEDIUMINT
                    obj.setpoint ? Math.round(obj.setpoint * 100) : null
                ], function(err) {
                    process.stdin.resume();
                    if (err) throw err;
                    console.log('updated');
                });
            } catch (err) {
                console.error('Invalid object: ' + err.message);
            }
            if (obj.schedule) {
                if (!schedulesAreEqual(obj.schedule, lastSchedule)) {
                    process.stdin.pause();
                    db.query(insertScheduleQuery, [
                        // changed_at DATETIME NOT NULL
                        moment.utc(obj.schedule.now).toDate(),
                        // schedule_started_at DATETIME
                        moment.utc(obj.schedule.startedAt).toDate(),
                        // step_started_at DATETIME
                        moment.utc(obj.schedule.stepStartedAt).toDate(),
                        // steps_json VARCHAR(1000)
                        JSON.stringifyCanonical(obj.schedule.steps)
                    ], function(err) {
                        process.stdin.resume();
                        if (err) throw err;
                        console.log('updated schedule');
                        lastSchedule = obj.schedule;
                    });
                }
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
