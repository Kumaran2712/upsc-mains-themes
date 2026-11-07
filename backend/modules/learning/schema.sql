CREATE TABLE IF NOT EXISTS assessment_attempts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL,
  concept_id TEXT NOT NULL, lesson_version TEXT, payload TEXT NOT NULL,
  recorded BIGINT NOT NULL, completed BIGINT,
  PRIMARY KEY(user_id,id)
);
CREATE INDEX IF NOT EXISTS assessment_history ON assessment_attempts(user_id,concept_id,recorded,id);
