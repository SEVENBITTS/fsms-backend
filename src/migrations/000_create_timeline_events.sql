CREATE TABLE IF NOT EXISTS timeline_events (
  id BIGSERIAL PRIMARY KEY,
  sequence BIGINT NOT NULL,
  mission_id BIGINT NULL,
  aircraft_id BIGINT NULL,
  event_type TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  classified BOOLEAN NOT NULL DEFAULT false,
  legacy BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_mission_id
  ON timeline_events(mission_id);

CREATE INDEX IF NOT EXISTS idx_timeline_aircraft_id
  ON timeline_events(aircraft_id);

CREATE INDEX IF NOT EXISTS idx_timeline_event_type
  ON timeline_events(event_type);

CREATE INDEX IF NOT EXISTS idx_timeline_event_time
  ON timeline_events(event_time);

CREATE INDEX IF NOT EXISTS idx_timeline_classified
  ON timeline_events(classified);

CREATE INDEX IF NOT EXISTS idx_timeline_legacy
  ON timeline_events(legacy);

CREATE INDEX IF NOT EXISTS idx_timeline_sequence
  ON timeline_events(sequence);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'timeline_events_sequence_key'
  ) THEN
    ALTER TABLE timeline_events
      ADD CONSTRAINT timeline_events_sequence_key UNIQUE (sequence);
  END IF;
END $$;