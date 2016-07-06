const expect = require('chai').expect;
const mocha  = require('mocha');

const lib            = require('./lib');
const simplifyPoints = require('../lib/simplifyPoints');

describe('simplifyPoints', () => {
    let db = new lib.MockDb();

    function simplify(points, count) {
        return simplifyPoints(
            points,
            'measured_at',
            ['temp_avg', 'setpoint'],
            count
        );
    }

    function simplifyMultiple() {
        const result = simplifyPoints.apply(null, arguments);
        for (var i = 0; i < 20; i++) {
            expect(simplifyPoints.apply(null, arguments)).to.eql(result);
        }
        return result;
    }

    it('should prune points but keep the endpoints', () => {
        const simplified = simplify(db.generate(0, 15000), 500);
        expect(simplified).to.have.lengthOf(500);
        expect(simplified[0].measured_at).to.eql(0);
        expect(simplified[simplified.length - 1].measured_at).to.eql(15000 * 1000);
    });

    it('should remove the point that makes a line with its neighbors', () => {
        const line = [
            { t : 0, v : 0 },
            { t : 1, v : 10 },
            { t : 2, v : 11 },
            { t : 3, v : 12 },
            { t : 4, v : 4 },
        ];

        expect(
            simplifyMultiple(line, 't', 'v', line.length - 1)
        ).to.eql([
            { t : 0, v : 0 },
            { t : 1, v : 10 },
            { t : 3, v : 12 },
            { t : 4, v : 4 },
        ]);
    });

    it('should remove multiple points that make a line', () => {
        const line = [
            { t : 0, v : 0 },
            { t : 1, v : 10 },
            { t : 2, v : 11 },
            { t : 3, v : 12 },
            { t : 4, v : 13 },
            { t : 5, v : 14 },
            { t : 6, v : 15 },
            { t : 7, v : 7 },
        ];

        expect(
            simplifyMultiple(line, 't', 'v', line.length - 4)
        ).to.eql([
            { t : 0, v : 0 },
            { t : 1, v : 10 },
            { t : 6, v : 15 },
            { t : 7, v : 7 },
        ]);
    });
});
