-- Up Migration

CREATE TABLE sessions (
  id          TEXT        PRIMARY KEY,
  data        JSONB       NOT NULL DEFAULT '{}',
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

-- Down Migration

DROP TABLE sessions;
