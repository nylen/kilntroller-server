const events = require('events');
const util   = require('util');

const moment  = require('moment');
const suspend = require('suspend');

const simplifyPoints = require('./simplifyPoints');

class TemperatureDataStore extends events.EventEmitter {
    constructor(db) {
        super();

        this.db    = db;
        this.cache = {};

        setInterval(this._cacheCleanup.bind(this), 60 * 60 * 1000);
    }

    fetch(min, max, count, cb) {
        suspend(function*() {
            if (
                typeof min !== 'number' ||
                typeof max !== 'number' ||
                min > max
            ) {
                return cb(new Error(
                    'min and max must be valid timestamps (min <= max)'
                ));
            }

            if (!Number.isInteger(count) || count <= 0) {
                return cb(new Error(
                    'count must be a positive integer'
                ));
            }

            const highestPossibleCount = (max - min) / 1000 + 1;
            if (count > highestPossibleCount) {
                count = highestPossibleCount;
            }

            const begin  = moment.utc(min).startOf('hour');
            const end    = moment.utc(max).endOf('hour');
            // We will not re-fetch data prior to this point
            const frozen = moment.utc().subtract(1, 'hour');

            // Determine whether we can safely simplify each hour to ~1 point
            // per minute before aggregating (huge time savings)
            const simplifyEachHour = (highestPossibleCount / count > 60 * 1.2);

            let points = [];

            for (let hour = begin; hour < end; hour.add(1, 'hour')) {
                const cached = this.cache[+hour];
                if (cached) {
                    this.log(
                        'got %d points from cache for %s',
                        cached.raw.length,
                        hour.toString()
                    );
                    if (simplifyEachHour && cached.raw.length > 200) {
                        points = points.concat(cached.simplified);
                    } else {
                        points = points.concat(cached.raw);
                    }
                    continue;
                }

                const hourEnd = hour.clone().endOf('hour');

                this.log(
                    'fetching data for %s',
                    hour.toString()
                );
                const pointsThisHour = yield this._fetchSegment(
                    hour.toDate(),
                    hourEnd.toDate(),
                    suspend.resume()
                );
                this.log(
                    'got %d points for %s',
                    pointsThisHour.length,
                    hour.toString()
                );
                let hourSimplified = null;
                if (simplifyEachHour && pointsThisHour.length > 200) {
                    hourSimplified = this._simplify(pointsThisHour, 60);
                    points = points.concat(hourSimplified);
                } else {
                    points = points.concat(pointsThisHour);
                }

                if (hourEnd.isBefore(frozen)) {
                    // Cache this hour's data (assume it won't change again)
                    if (!hourSimplified) {
                        hourSimplified = this._simplify(pointsThisHour, 60);
                    }
                    this.cache[+hour] = {
                        raw        : pointsThisHour,
                        simplified : hourSimplified
                    };
                }
            }

            // TODO better handling for first and last hour (may not get very
            // good data here if we are taking a small part of an hour that was
            // already simplified to only 60 points)
            points = points.filter(p => {
                return p.measured_at >= min && p.measured_at <= max;
            });

            if (points.length > count) {
                this.log(
                    'simplifying %d points to %d',
                    points.length,
                    count
                );
                points = this._simplify(points, count);
                this.log('done simplifying');
            } else {
                // Note - this method may not return the requested number of
                // points!  This happens when part of the requested interval
                // has no data, but the code thinks it should have enough data
                // to only pick 60 points from each hour, then simplify again
                // at the end.  This shouldn't present any problems in practice
                // and the time savings is well worth it.
                this.log(
                    'not simplifying %d points to %d',
                    points.length,
                    count
                );
            }

            cb(null, this._normalize(points));
        }.bind(this))();
    }

    _fetchSegment(min, max, cb) {
        this.db.query(TemperatureDataStore.queries.fetchSegment, [
            min,
            max
        ], (err, rows) => {
            if (err) {
                return cb(err);
            }
            cb(null, rows);
        });
    }

    _simplify(points, count) {
        return simplifyPoints(
            points,
            'measured_at',
            ['temp_avg', 'setpoint'],
            count
        );
    }

    _normalize(points) {
        return points.map(p => {
            const n = {
                timestamp   : +moment.utc(p.measured_at),
                temperature : p.temp_avg / 100,
                raw         : {}
            };
            if (typeof p.setpoint === 'number') {
                n.setpoint = p.setpoint / 100;
            }
            if (typeof p.temp_1 === 'number') {
                n.raw.temp1 = p.temp_1 / 100;
            }
            if (typeof p.temp_2 === 'number') {
                n.raw.temp2 = p.temp_2 / 100;
            }
            if (typeof p.temp_3 === 'number') {
                n.raw.temp3 = p.temp_3 / 100;
            }
            return n;
        });
    }

    _cacheCleanup() {
        let segmentsDeleted = 0;
        let pointsDeleted   = 0;
        for (let hour in this.cache) {
            if (moment.utc().diff(hour, 'days') > 10) {
                segmentsDeleted++;
                pointsDeleted += this.cache[hour].raw.length;
                delete this.cache[hour];
            }
        }
        this.log(
            'cache cleanup deleted %d segments (%d points)',
            segmentsDeleted,
            pointsDeleted
        );
    }

    log() {
        this.emit('log', util.format.apply(null, arguments));
    }
}

TemperatureDataStore.queries = {
    fetchSegment: `
SELECT measured_at, temp_1, temp_2, temp_3, temp_avg, setpoint
FROM temperature_data
WHERE measured_at BETWEEN ? and ?;
`
};

module.exports = TemperatureDataStore;
