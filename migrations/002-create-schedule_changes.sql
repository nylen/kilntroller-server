CREATE TABLE schedule_changes (
    changed_at DATETIME NOT NULL,
    schedule_started_at DATETIME,
    step_started_at DATETIME,
    steps_json VARCHAR(1000),
    PRIMARY KEY (changed_at)
);
