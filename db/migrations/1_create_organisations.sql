-- Up Migration
CREATE TABLE organisations (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Down Migration
DROP TABLE organisations;
