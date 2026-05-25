-- Up Migration
CREATE TABLE plans (
  id                SERIAL PRIMARY KEY,
  display_name      VARCHAR(255) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  organisation_id   INTEGER      NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  throttle          INTEGER,
  burst             INTEGER,
  quota_limit       INTEGER,
  quota_period      VARCHAR(10),
  created_by        VARCHAR(255) NOT NULL,
  updated_by        VARCHAR(255),
  aws_usage_plan_id VARCHAR(100),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plans_organisation_id ON plans(organisation_id);

-- Down Migration
DROP TABLE plans;
