CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  city_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB
);

CREATE INDEX IF NOT EXISTS tenants_city_idx ON tenants (city_name);
