function simplifyPoints(points, timestampKey, valueKeys, count) {
    if (points.length <= count) {
        return points;
    }

    if (points.length <= 2) {
        return points;
    }

    if (typeof valueKeys === 'string') {
        valueKeys = [valueKeys];
    }

    const pointsByRemovalCost = [];

    for (let i = 1; i < points.length - 1; i++) {
        const timestamp = points[i][timestampKey];
        const prev      = points[i - 1];
        const next      = points[i + 1];
        let cost        = 0;
        valueKeys.forEach(k => {
            if (typeof points[i][k] === 'number') {
                const actual = points[i][k];
                const estimate = (
                    prev[k]
                    + (next[k] - prev[k]) * (
                        (timestamp - prev[timestampKey]) /
                        (next[timestampKey] - prev[timestampKey])
                    )
                );
                cost += (actual - estimate) * (actual - estimate);
            }
        });
        pointsByRemovalCost.push({
            timestamp,
            cost
        });
    }

    pointsByRemovalCost.sort((a, b) => {
        if (a.cost === b.cost) {
            return Math.random() - 0.5;
        } else {
            return a.cost - b.cost;
        }
    });

    const toRemove = pointsByRemovalCost.slice(0, points.length - count)
        .reduce((acc, p) => {
            acc[p.timestamp] = true;
            return acc;
        }, {});

    return points.filter(p => !toRemove[p[timestampKey]]);
}

module.exports = simplifyPoints;
