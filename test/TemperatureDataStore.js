const expect = require('chai').expect;
const mocha  = require('mocha');

const lib                  = require('./lib');
const TemperatureDataStore = require('../lib/TemperatureDataStore');

describe('TemperatureDataStore', () => {
    const db = new lib.MockDb();

    let store, logs;

    function fetch(min, max, count, cb) {
        store.fetch(min * 1000, max * 1000, count, cb);
    }

    beforeEach(() => {
        store = new TemperatureDataStore(db);
        logs = [];
        store.on('log', msg => {
            logs.push(msg);
        });
    });

    it('should simplify when fetching a large number of points', done => {
        fetch(0, 15000, 500, (err, points) => {
            expect(err).to.eql(null);
            expect(points).to.have.lengthOf(500);
            expect(points[0].timestamp).to.eql(0);
            expect(points[points.length - 1].timestamp).to.eql(15000 * 1000);
            expect(logs).to.eql([
                'fetching data for Thu Jan 01 1970 00:00:00 GMT+0000',
                'got 3499 points for Thu Jan 01 1970 00:00:00 GMT+0000',
                'fetching data for Thu Jan 01 1970 01:00:00 GMT+0000',
                'got 3600 points for Thu Jan 01 1970 01:00:00 GMT+0000',
                'fetching data for Thu Jan 01 1970 02:00:00 GMT+0000',
                'got 800 points for Thu Jan 01 1970 02:00:00 GMT+0000',
                'fetching data for Thu Jan 01 1970 03:00:00 GMT+0000',
                'got 2399 points for Thu Jan 01 1970 03:00:00 GMT+0000',
                'fetching data for Thu Jan 01 1970 04:00:00 GMT+0000',
                'got 3600 points for Thu Jan 01 1970 04:00:00 GMT+0000',
                'simplifying 10899 points to 500',
                'done simplifying',
            ]);
            done();
        });
    });

    it('should use the cache when fetching multiple times', done => {
        fetch(0, 15000, 500, (err, points) => {
            expect(err).to.eql(null);
            expect(points).to.have.lengthOf(500);
            expect(points[0].timestamp).to.eql(0);
            expect(points[points.length - 1].timestamp).to.eql(15000 * 1000);
            expect(logs).to.eql([
                'fetching data for Thu Jan 01 1970 00:00:00 GMT+0000',
                'got 3499 points for Thu Jan 01 1970 00:00:00 GMT+0000',
                'fetching data for Thu Jan 01 1970 01:00:00 GMT+0000',
                'got 3600 points for Thu Jan 01 1970 01:00:00 GMT+0000',
                'fetching data for Thu Jan 01 1970 02:00:00 GMT+0000',
                'got 800 points for Thu Jan 01 1970 02:00:00 GMT+0000',
                'fetching data for Thu Jan 01 1970 03:00:00 GMT+0000',
                'got 2399 points for Thu Jan 01 1970 03:00:00 GMT+0000',
                'fetching data for Thu Jan 01 1970 04:00:00 GMT+0000',
                'got 3600 points for Thu Jan 01 1970 04:00:00 GMT+0000',
                'simplifying 10899 points to 500',
                'done simplifying',
            ]);
            logs = [];
            fetch(0, 15000, 500, (err, points) => {
                expect(err).to.eql(null);
                expect(points).to.have.lengthOf(500);
                expect(points[0].timestamp).to.eql(0);
                expect(points[points.length - 1].timestamp).to.eql(15000 * 1000);
                expect(logs).to.eql([
                    'got 3499 points from cache for Thu Jan 01 1970 00:00:00 GMT+0000',
                    'got 3600 points from cache for Thu Jan 01 1970 01:00:00 GMT+0000',
                    'got 800 points from cache for Thu Jan 01 1970 02:00:00 GMT+0000',
                    'got 2399 points from cache for Thu Jan 01 1970 03:00:00 GMT+0000',
                    'got 3600 points from cache for Thu Jan 01 1970 04:00:00 GMT+0000',
                    'simplifying 10899 points to 500',
                    'done simplifying',
                ]);
                done();
            });
        });
    });

    it('should fetch a small number of points', done => {
        fetch(0, 10, 10, (err, points) => {
            expect(err).to.eql(null);
            expect(points[0].timestamp).to.eql(0);
            expect(points[points.length - 1].timestamp).to.eql(10 * 1000);
            expect(points).to.have.lengthOf(10);
            expect(logs).to.contain('simplifying 11 points to 10');
            done();
        });
    });

    it('should fetch a small number of points without simplifying', done => {
        fetch(0, 10, 1000, (err, points) => {
            expect(err).to.eql(null);
            expect(points.length).to.eql(11);
            expect(points).to.eql(store._normalize(db.generate(0, 10)));
            expect(logs).to.contain('not simplifying 11 points to 11');
            done();
        });
    });
});
