CREATE TABLE IF NOT EXISTS roadmap_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL, completed INTEGER NOT NULL CHECK(completed IN (0,1)),
  revision INTEGER NOT NULL, updated BIGINT NOT NULL, PRIMARY KEY(user_id,theme_id)
);
CREATE TABLE IF NOT EXISTS practice_attempts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL,
  day TEXT NOT NULL, fingerprint TEXT NOT NULL, payload TEXT NOT NULL, created BIGINT NOT NULL,
  PRIMARY KEY(user_id,id)
);
CREATE INDEX IF NOT EXISTS practice_user_day ON practice_attempts(user_id,day,created);
CREATE TABLE IF NOT EXISTS map_attempts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL,
  map_id TEXT NOT NULL, fingerprint TEXT NOT NULL, payload TEXT NOT NULL, created BIGINT NOT NULL,
  PRIMARY KEY(user_id,id)
);
CREATE TABLE IF NOT EXISTS import_receipts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL,
  fingerprint TEXT NOT NULL, result TEXT NOT NULL, created BIGINT NOT NULL,
  PRIMARY KEY(user_id,id)
);
