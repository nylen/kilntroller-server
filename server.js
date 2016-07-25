const cors    = require('cors');
const express = require('express');
const http    = require('http');
const moment  = require('moment');
const net     = require('net');
const sockjs  = require('sockjs');
const split   = require('split');

const config               = require('./lib/config');
const TemperatureDataStore = require('./lib/TemperatureDataStore');

const app       = express();
const apiRouter = express.Router();
const server    = http.createServer(app);

let clientsToUpdate = [];

require('./lib/db').connect((err, db) => {
    if (err) throw err;

    const temperatureDataStore = new TemperatureDataStore(db);
    temperatureDataStore.on('log', msg => {
        console.log(`TemperatureDataStore: ${msg}`);
    });

    const updateListener = net.createServer(client => {
        client.pipe(split())
            .on('data', function(line) {
                if (!line.trim()) return;
                clientsToUpdate.forEach(c => c.write(line));
            });
    });

    updateListener.listen(config.updateListener.port, 'localhost', () => {
        console.log('Listening for updates on :' + config.updateListener.port);
    });

    // TODO: upgrade to Apache 2.4 - http://stackoverflow.com/q/27526281/106302
    const updateServer = sockjs.createServer({
        sockjs_url : 'http://cdn.jsdelivr.net/sockjs/1.1.1/sockjs.min.js',
        websocket  : false,
    });

    updateServer.on('connection', function(conn) {
        clientsToUpdate.push(conn);
        conn.on('close', function() {
            clientsToUpdate = clientsToUpdate.filter(c => c !== conn);
        });
    });

    updateServer.installHandlers(server, {
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

    app.use(cors());
    app.use(config.http.basePath || '/', apiRouter);

    server.listen(config.http.port, () => {
        console.log('Listening for requests on :' + config.http.port);
    });

    process.on('SIGINT', () => {
        console.log();
        updateListener.close();
        console.log('Update listener closed');
        db.end(err => {
            if (err) throw err;
            console.log('MySQL connection closed');
            process.exit(0);
        });
    });
});
