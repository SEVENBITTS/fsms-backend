CREATE SEQUENCE IF NOT EXISTS timeline_events_sequence_seq;

ALTER TABLE timeline_events
  ALTER COLUMN sequence SET DEFAULT nextval('timeline_events_sequence_seq');

DO $$
DECLARE
  max_sequence BIGINT;
BEGIN
  SELECT MAX(sequence) INTO max_sequence FROM timeline_events;

  IF max_sequence IS NULL THEN
    PERFORM setval('timeline_events_sequence_seq', 1, false);
  ELSE
    PERFORM setval('timeline_events_sequence_seq', max_sequence, true);
  END IF;
END $$;