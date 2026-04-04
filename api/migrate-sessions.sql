-- Sessions & activity tracking for credential sharing detection
-- Run: node run-migration.js sessions

-- ── Sessions (one row per login) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  id              VARCHAR(36)    PRIMARY KEY,
  user_id         VARCHAR(36)    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address      INET,
  user_agent      TEXT,
  country         VARCHAR(100),
  city            VARCHAR(100),
  device_fingerprint VARCHAR(64),
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  expired_at      TIMESTAMPTZ,
  is_active       BOOLEAN        DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions (user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sessions_ip ON sessions (ip_address);

-- ── Activity log (sampled API requests for pattern detection) ───────────────

CREATE TABLE IF NOT EXISTS activity_log (
  id              BIGSERIAL      PRIMARY KEY,
  user_id         VARCHAR(36)    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id      VARCHAR(36)    REFERENCES sessions(id) ON DELETE SET NULL,
  ip_address      INET,
  endpoint        VARCHAR(255)   NOT NULL,
  method          VARCHAR(10)    NOT NULL,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_ip ON activity_log (ip_address, created_at DESC);

-- Auto-cleanup: drop activity older than 90 days (run periodically)
-- DELETE FROM activity_log WHERE created_at < NOW() - INTERVAL '90 days';
