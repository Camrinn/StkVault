-- ── Predictions (friend prediction tracker) ──────────────────────────────────
-- No auth required — player_name is a free-text display name.
-- Resolves automatically via cron after target_date passes.

CREATE TABLE IF NOT EXISTS predictions (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name    TEXT        NOT NULL,
  symbol         TEXT        NOT NULL REFERENCES tracked_symbols(symbol),
  direction      TEXT        NOT NULL CHECK (direction IN ('bull', 'bear')),
  timeframe      TEXT        NOT NULL CHECK (timeframe IN ('1W', '1M', '3M')),
  price_at_call  NUMERIC     NOT NULL,
  target_date    DATE        NOT NULL,
  resolved_at    TIMESTAMPTZ,
  price_at_resolve NUMERIC,
  was_correct    BOOLEAN,
  return_pct     NUMERIC,     -- signed: positive = stock went up
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_player   ON predictions(player_name);
CREATE INDEX IF NOT EXISTS idx_predictions_symbol   ON predictions(symbol);
CREATE INDEX IF NOT EXISTS idx_predictions_pending  ON predictions(target_date) WHERE resolved_at IS NULL;

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read predictions"   ON predictions FOR SELECT USING (true);
CREATE POLICY "Public insert predictions" ON predictions FOR INSERT WITH CHECK (true);
CREATE POLICY "Service resolve predictions" ON predictions FOR UPDATE USING (true);
