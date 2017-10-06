const moment = require('moment');

// Returns a JavaScript UTC timestamp
exports.parseDate = function(value) {
    if (typeof value === 'number') {
        return Math.abs(value);
    }
    if (/^\d+$/.test(value)) {
        return +value;
    }
    if (!value) {
        return null;
    }
    const date = moment.utc(value);
    if (!date.isValid()) {
        return null;
    }
    return +date;
};

// Excel doesn't like ISO 8601
exports.formatCsvDate = function(date) {
    return moment.utc(date).format()
        .replace(/T/, ' ')
        .replace(/Z$/, '');
};
