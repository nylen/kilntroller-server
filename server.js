const express = require('express');
const moment  = require('moment');

const config               = require('./lib/config');
const TemperatureDataStore = require('./lib/TemperatureDataStore');

const app       = express();
const apiRouter = express.Router();

require('./lib/db').connect((err, db) => {
    if (err) throw err;

    const temperatureDataStore = new TemperatureDataStore(db);
    temperatureDataStore.on('log', msg => {
        console.log(`TemperatureDataStore: ${msg}`);
    });

    apiRouter.get('/data', (req, res) => {
        const min   = +req.query.min || +moment.utc().subtract(2, 'days');
        const max   = +req.query.max || +moment.utc();
        const count = +req.query.count || 500;

        if (
            moment.utc(max).diff(moment.utc(min), 'days') > 10 ||
            count > 5000
        ) {
            res.json({
                ok    : false,
                error : 'Too much data requested (>10 days / >5000 points)'
            });
            return;
        }

        temperatureDataStore.fetch(min, max, count, (err, points) => {
            if (err) {
                res.json({
                    ok    : false,
                    error : err.message
                });
            } else {
                res.json({
                    ok   : true,
                    data : points,
                    min,
                    max,
                    count
                });
            }
        });
    });

    app.use(config.http.basePath || '/', apiRouter);

    app.listen(config.http.port, () => {
        console.log('Listening on :' + config.http.port);
    });

    process.on('SIGINT', () => {
        console.log();
        db.end(err => {
            if (err) throw err;
            console.log('MySQL connection closed');
            process.exit(0);
        });
    });
});
