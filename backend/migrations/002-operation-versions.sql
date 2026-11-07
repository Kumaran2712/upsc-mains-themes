ALTER TABLE operations ADD COLUMN IF NOT EXISTS lesson_version TEXT;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS lease_expires BIGINT;
UPDATE operations SET lease_expires=created+180000 WHERE lease_expires IS NULL;
