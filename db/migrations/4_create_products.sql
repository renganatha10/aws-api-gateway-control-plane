-- Up Migration

CREATE TABLE products (
  id          SERIAL       PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  title       VARCHAR(255) NOT NULL,
  version     VARCHAR(50)  NOT NULL DEFAULT '1.0',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE product_apis (
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  api_id      INTEGER NOT NULL REFERENCES apis(id)     ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, api_id)
);

-- Down Migration

DROP TABLE product_apis;
DROP TABLE products;
