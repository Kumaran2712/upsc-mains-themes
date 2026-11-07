ALTER TABLE operations DROP CONSTRAINT IF EXISTS operations_state_check;
ALTER TABLE operations ADD CONSTRAINT operations_state_check CHECK(state IN ('running','completed','failed','cancelled','indeterminate'));
ALTER TABLE operations ADD COLUMN IF NOT EXISTS lease_owner TEXT;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS generation BIGINT NOT NULL DEFAULT 1;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS cancelled_at BIGINT;
