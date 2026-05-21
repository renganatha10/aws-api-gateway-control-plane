-- Up Migration

CREATE TABLE consumers (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  environment_id INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  plan_id        INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  gateway_id     INTEGER NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  created_by     VARCHAR(255) NOT NULL,
  updated_by     VARCHAR(255),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Down Migration

DROP TABLE consumers;
