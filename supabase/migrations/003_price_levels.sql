-- Price levels: horizontal support/resistance lines drawn on the chart
CREATE TABLE IF NOT EXISTS price_levels (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol      TEXT        NOT NULL,
  price       DECIMAL(12,4) NOT NULL,
  initials    TEXT        NOT NULL CHECK (char_length(initials) <= 2),
  direction   TEXT        NOT NULL CHECK (direction IN ('up', 'down')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS price_levels_symbol_idx ON price_levels (symbol);

-- Insert mock dev user so notes FK is satisfied
INSERT INTO users (id, email, name, role, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev@localhost',
  'Admin',
  'admin',
  NOW()
)
ON CONFLICT (id) DO NOTHING;
