-- Up Migration
CREATE TABLE organisation_members (
  id              SERIAL PRIMARY KEY,
  organisation_id INTEGER      NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_email      VARCHAR(255) NOT NULL,
  role            VARCHAR(50)  NOT NULL CHECK (role IN ('admin','editor','viewer','portal-user')),
  invited_by      VARCHAR(255),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id, user_email)
);
CREATE INDEX idx_org_members_email ON organisation_members(user_email);

-- Down Migration
DROP TABLE IF EXISTS organisation_members;
