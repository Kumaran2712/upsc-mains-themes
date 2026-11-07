
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  recovery_hash TEXT NOT NULL, created BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL, expires BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS conversations (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, concept_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Exploring' CHECK(status IN ('Exploring','Developing','Understood')),
  revisit BIGINT NOT NULL DEFAULT 0 CHECK(revisit IN (0,1)), revision BIGINT NOT NULL DEFAULT 0,
  assessment TEXT, attempts BIGINT NOT NULL DEFAULT 0, updated BIGINT NOT NULL,
  PRIMARY KEY(user_id, concept_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, concept_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','tutor')), text TEXT NOT NULL, created BIGINT NOT NULL,
  FOREIGN KEY(user_id, concept_id) REFERENCES conversations(user_id, concept_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS messages_conversation ON messages(user_id, concept_id, id);
CREATE TABLE IF NOT EXISTS operations (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL,
  concept_id TEXT NOT NULL, fingerprint TEXT NOT NULL, kind TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('running','completed','failed')),
  result TEXT, created BIGINT NOT NULL, model TEXT, prompt_version TEXT, provider_usage TEXT,
  PRIMARY KEY(user_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_running_operation ON operations(user_id) WHERE state = 'running';
CREATE TABLE IF NOT EXISTS counters (
  bucket TEXT NOT NULL, period TEXT NOT NULL, calls BIGINT NOT NULL DEFAULT 0,
  tokens BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(bucket,period)
);
