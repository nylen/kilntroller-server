const cors    = require('cors');
const express = require('express');
const http    = require('http');
const moment  = require('moment');

const config               = require('./lib/config');
const TemperatureDataStore = require('./lib/TemperatureDataStore');
const UpdateListener       = require('./lib/UpdateListener');

const app       = express();
const apiRouter = express.Router();
const server    = http.createServer(app);

require('./lib/db').connect((err, db) => {
    if (err) throw err;

    const temperatureDataStore = new TemperatureDataStore(db);
    temperatureDataStore.on('log', msg => {
        console.log(`TemperatureDataStore: ${msg}`);
    });

    const updateListener = new UpdateListener(config.updateListener);
    updateListener.on('log', msg => {
        console.log(`UpdateListener: ${msg}`);
    });
    updateListener.server.installHandlers(server, {
        prefix : (config.http.basePath || '') + '/sockjs'
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
                let actual;
                if (points.length) {
                    actual = {
                        min   : points[0].timestamp,
                        max   : points[points.length - 1].timestamp,
                        count : points.length
                    }
                } else {
                    actual = {
                        min   : 0,
                        max   : 0,
                        count : 0
                    };
                }

                res.json({
                    ok        : true,
                    data      : points,
                    requested : {
                        min,
                        max,
                        count
                    },
                    actual
                });
            }
        });
    });

    app.use(config.http.basePath || '/', cors(), apiRouter);

    server.listen(config.http.port, () => {
        console.log('Listening for requests on :' + config.http.port);
    });

    process.on('SIGINT', () => {
        console.log();
        updateListener.close();
        db.end(err => {
            if (err) throw err;
            console.log('MySQL connection closed');
            process.exit(0);
        });
    });
});
