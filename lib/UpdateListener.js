const events = require('events');
const fs     = require('fs');
const net    = require('net');
const path   = require('path');
const sockjs = require('sockjs');
const split  = require('split');
const util   = require('util');

const { throttle } = require('lodash');

class UpdateListener extends events.EventEmitter {
    constructor(config, httpServer) {
        super();

        this.lastUpdatePath = path.join(
            __dirname,
            '..', 'data', 'last-update.json'
        );

        try {
            this.lastUpdate = JSON.parse(
                fs.readFileSync(this.lastUpdatePath)
            );
        } catch (err) {
            this.lastUpdate = {};
        }

        this._writeLastUpdate = throttle(
            this._writeLastUpdate.bind(this),
            10000
        );

        this.listener = net.createServer(client => {
            this.log(
                'Receiving updates from %s:%d',
                client.remoteAddress,
                client.remotePort
            );
            client.pipe(split())
                .on('data', line => {
                    if (!line.trim()) return;
                    try {
                        const update = JSON.parse(line);
                        if (update && update.type) {
                            this.save(update);
                            this.clients.forEach(c => c.write(line));
                        }
                    } catch (err) {}
                });
        });

        this.listener.listen(config.port, 'localhost', () => {
            this.log(
                'Listening for updates on :%d',
                config.port
            );
        });

        this.server = sockjs.createServer({
            sockjs_url : 'http://cdn.jsdelivr.net/sockjs/1.1.1/sockjs.min.js',
            // TODO: upgrade to Apache 2.4 -
            // http://stackoverflow.com/q/27526281/106302
            websocket  : false,
        });

        this.clients = [];

        this.server.on('connection', conn => {
            this.log(
                'Client %s:%d connected',
                conn.remoteAddress,
                conn.remotePort
            );
            this.clients.push(conn);
            Object.keys(this.lastUpdate).forEach(k => {
                conn.write(JSON.stringify(this.lastUpdate[k]));
            });
            conn.on('close', () => {
                this.log(
                    'Client %s:%d disconnected',
                    conn.remoteAddress,
                    conn.remotePort
                );
                this.clients = this.clients.filter(c => c !== conn);
            });
        });
    }

    log() {
        this.emit('log', util.format.apply(null, arguments));
    }

    getCurrentStatus() {
        return Object.keys(this.lastUpdate).map(k => this.lastUpdate[k]);
    }

    save(update) {
        this.lastUpdate[update.type] = update;
        this._writeLastUpdate();
    }

    _writeLastUpdate() {
        if (!this._saving) {
            this._saving = true;
            fs.writeFile(
                this.lastUpdatePath,
                JSON.stringify(this.lastUpdate),
                err => {
                    if (err) {
                        this.log(
                            'Error saving last update: %s',
                            err.message
                        );
                    }
                    this._saving = false;
                }
            );
        }
    }

    close() {
        this.listener.close();
        this.log('Listener socket closed');
        if (this.clients.length) {
            this.clients.forEach(c => c.end());
            this.log(
                'Disconnected %d client%s',
                this.clients.length,
                (this.clients.length === 1 ? '' : 's')
            );
            this.clients = [];
        }
    }
}

module.exports = UpdateListener;
