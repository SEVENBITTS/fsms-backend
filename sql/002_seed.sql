TRUNCATE TABLE timeline_events RESTART IDENTITY;

INSERT INTO timeline_events
(sequence, mission_id, aircraft_id, event_type, event_time, classified, legacy, payload)
VALUES
(1, 10, 100, 'mission.created',  '2026-04-01T08:00:00Z', true,  false, '{"source":"new"}'),
(2, 10, 100, 'takeoff',          '2026-04-01T08:15:00Z', true,  false, '{"runway":"09"}'),
(3, 10, 100, 'landing',          '2026-04-01T09:00:00Z', true,  false, '{"runway":"27"}'),
(4, 11, 101, 'mission.created',  '2026-04-02T10:00:00Z', false, true,  '{"source":"legacy"}'),
(5, 11, 101, 'position.recorded','2026-04-02T10:05:00Z', false, true,  '{"lat":1,"lon":2}'),
(6, 12, 102, 'mission.created',  '2026-04-03T11:00:00Z', true,  false, '{"source":"new"}'),
(7, 12, 102, 'takeoff',          '2026-04-03T11:10:00Z', true,  false, '{"runway":"18"}'),
(8, 12, 102, 'position.recorded','2026-04-03T11:20:00Z', true,  false, '{"lat":3,"lon":4}'),
(9, 12, 102, 'landing',          '2026-04-03T12:00:00Z', true,  false, '{"runway":"36"}');