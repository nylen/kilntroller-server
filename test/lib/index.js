const expect = require('chai').expect;

const TemperatureDataStore = require('../../lib/TemperatureDataStore');

class MockDb {
    constructor() {
        this.cache = {};
    }

    generatePoint(t) {
        t *= 1000;
        const temp = 1000 * Math.sin(t / 10000);
        return {
            measured_at : t,
            temp_avg    : temp,
            setpoint    : 1,
            temp_1      : temp - 10,
            temp_2      : temp,
            temp_3      : temp + 10,
        };
    }

    generate(min, max) {
        const cacheKey = [min, max].join(':');
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }

        const points = [];
        for (let t = min; t <= max; t++) {
            // Leave some gaps
            if (t >= 100 && t <= 200) {
                continue;
            } else if (t >= 8000 && t <= 12000) {
                continue;
            }
            points.push(this.generatePoint(t));
        }

        this.cache[cacheKey] = points;
        return points;
    }

    query(sql, params, callback) {
        expect(sql).to.eql(TemperatureDataStore.queries.fetchSegment);
        const min = +params[0] / 1000;
        const max = +params[1] / 1000;
        callback(null, this.generate(min, max));
    }
}

exports.MockDb = MockDb;
