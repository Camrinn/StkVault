-- AI pick sessions: each time the AI generates a batch of picks
CREATE TABLE IF NOT EXISTS ai_pick_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline         TEXT        NOT NULL CHECK (timeline IN ('1w', '2w', '1m')),
  pick_date        TIMESTAMPTZ DEFAULT NOW(),
  resolve_date     TIMESTAMPTZ NOT NULL,
  overall_thesis   TEXT,
  is_resolved      BOOLEAN     DEFAULT FALSE,
  win_count        INT,
  total_picks      INT,
  avg_return_pct   DECIMAL(8,4)
);

-- Individual picks within a session
CREATE TABLE IF NOT EXISTS ai_picks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID        NOT NULL REFERENCES ai_pick_sessions(id) ON DELETE CASCADE,
  symbol           TEXT        NOT NULL,
  price_at_pick    DECIMAL(12,4) NOT NULL,
  score_at_pick    DECIMAL(6,2),
  reasoning        TEXT,
  resolved_price   DECIMAL(12,4),
  resolved_pct     DECIMAL(8,4),
  is_winner        BOOLEAN
);

CREATE INDEX IF NOT EXISTS ai_picks_session_idx ON ai_picks (session_id);
