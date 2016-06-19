CREATE TABLE temperature_data(
    measured_at DATETIME NOT NULL,
    temp_1 MEDIUMINT,
    temp_2 MEDIUMINT,
    temp_3 MEDIUMINT,
    temp_avg MEDIUMINT NOT NULL,
    setpoint MEDIUMINT,
    PRIMARY KEY (measured_at)
);
