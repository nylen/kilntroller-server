const events = require('events');
const net    = require('net');
const sockjs = require('sockjs');
const split  = require('split');
const util   = require('util');

class UpdateListener extends events.EventEmitter {
    constructor(config, httpServer) {
        super();

        this.listener = net.createServer(client => {
            this.log(
                'Receiving updates from %s:%d',
                client.remoteAddress,
                client.remotePort
            );
            client.pipe(split())
                .on('data', line => {
                    if (!line.trim()) return;
                    this.clients.forEach(c => c.write(line));
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
