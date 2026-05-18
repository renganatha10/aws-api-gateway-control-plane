-- Up Migration

CREATE TABLE product_deployments (
  id             SERIAL PRIMARY KEY,
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  environment_id INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  gateway_id     INTEGER NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  status         VARCHAR(50) NOT NULL DEFAULT 'deployed',
  created_by     VARCHAR(255) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, environment_id)
);

-- Down Migration

DROP TABLE product_deployments;
