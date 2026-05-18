-- Up Migration

CREATE TABLE products (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description  TEXT,
  visibility   VARCHAR(50) NOT NULL DEFAULT 'authenticated',
  gateway_id   INTEGER NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  created_by   VARCHAR(255) NOT NULL,
  updated_by   VARCHAR(255),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gateway_id, name)
);

CREATE TABLE api_associations (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  api_id     INTEGER NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  gateway_id INTEGER NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, api_id)
);

CREATE TABLE plan_associations (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  plan_id    INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  gateway_id INTEGER NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, plan_id)
);

-- Down Migration

DROP TABLE plan_associations;
DROP TABLE api_associations;
DROP TABLE products;
