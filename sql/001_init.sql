CREATE TABLE IF NOT EXISTS timeline_events (
  id BIGSERIAL PRIMARY KEY,
  sequence BIGINT NOT NULL UNIQUE,
  mission_id BIGINT,
  aircraft_id BIGINT,
  event_type TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  classified BOOLEAN NOT NULL DEFAULT FALSE,
  legacy BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_sequence
  ON timeline_events(sequence);

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