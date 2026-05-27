-- Up Migration
INSERT INTO organisation_members (organisation_id, user_email, role)
SELECT id, created_by, 'admin' FROM organisations
ON CONFLICT DO NOTHING;

-- Down Migration
-- intentionally empty — no safe way to undo a backfill
