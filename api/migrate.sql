-- ReelMaps PostgreSQL Schema Migration
-- Run this against your RDS instance to create all tables.
--
-- Usage:
--   psql -h your-rds-endpoint.us-east-2.rds.amazonaws.com -U postgres -d reelmaps -f migrate.sql

-- ── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id             VARCHAR(36)  PRIMARY KEY,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  display_name   VARCHAR(100),
  avatar_url     TEXT,
  email_verified BOOLEAN      DEFAULT FALSE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_renew_date TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS eula_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS eula_version VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS eula_accepted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users (LOWER(display_name));

-- ── EULA Versions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS eula_versions (
  id          SERIAL       PRIMARY KEY,
  version     VARCHAR(20)  NOT NULL UNIQUE,
  title       VARCHAR(255) NOT NULL DEFAULT 'End User License Agreement',
  content     TEXT         NOT NULL,
  published   BOOLEAN      DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eula_version ON eula_versions (version);

-- ── Saved Spots ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_spots (
  id         VARCHAR(36)    PRIMARY KEY,
  user_id    VARCHAR(36)    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(255)   NOT NULL,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  depth_ft   DOUBLE PRECISION,
  spot_type  VARCHAR(50),
  species    TEXT,
  notes      TEXT,
  icon       VARCHAR(30),
  is_private BOOLEAN        DEFAULT FALSE,
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Add icon column to existing tables (safe to re-run)
ALTER TABLE saved_spots ADD COLUMN IF NOT EXISTS icon VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_saved_spots_user ON saved_spots (user_id);

-- ── Trip Logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_logs (
  id                 VARCHAR(36)    PRIMARY KEY,
  user_id            VARCHAR(36)    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_date          DATE           NOT NULL,
  title              VARCHAR(255)   NOT NULL,
  departure_port     VARCHAR(255),
  lat                DOUBLE PRECISION,
  lng                DOUBLE PRECISION,
  weather_conditions VARCHAR(255),
  wind_speed         DOUBLE PRECISION,
  wind_direction     DOUBLE PRECISION,
  wave_height        DOUBLE PRECISION,
  water_temp         DOUBLE PRECISION,
  species_caught     TEXT,
  catch_count        INTEGER,
  notes              TEXT,
  rating             INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_logs_user ON trip_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_trip_logs_date ON trip_logs (user_id, trip_date DESC);

-- ── User Lifecycle Audit Log ────────────────────────────────────────────────
-- Permanent record of key account events. Never deleted.

CREATE TABLE IF NOT EXISTS user_audit_log (
  id         BIGSERIAL      PRIMARY KEY,
  user_id    VARCHAR(36)    NOT NULL,
  email      VARCHAR(255)   NOT NULL,
  event      VARCHAR(50)    NOT NULL,  -- 'registered', 'verified', 'deactivated', 'reactivated'
  ip_address INET,
  user_agent TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON user_audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_event ON user_audit_log (event);
CREATE INDEX IF NOT EXISTS idx_audit_created ON user_audit_log (created_at);

-- ── User Preferences ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id            VARCHAR(36)    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  units              VARCHAR(20)    DEFAULT 'imperial',
  default_basemap    VARCHAR(50)    DEFAULT 'satellite',
  default_layers     TEXT,
  default_center_lat DOUBLE PRECISION,
  default_center_lng DOUBLE PRECISION,
  default_zoom       DOUBLE PRECISION,
  theme              VARCHAR(20)    DEFAULT 'dark',
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
