-- Up Migration
CREATE TABLE products (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  display_name    VARCHAR(255) NOT NULL,
  description     TEXT,
  visibility      VARCHAR(50)  NOT NULL DEFAULT 'authenticated',
  organisation_id INTEGER      NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by      VARCHAR(255) NOT NULL,
  updated_by      VARCHAR(255),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id, name)
);

-- Down Migration
DROP TABLE products;
