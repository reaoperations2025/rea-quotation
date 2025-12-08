-- Make user_id nullable for shared data
ALTER TABLE quotations ALTER COLUMN user_id DROP NOT NULL;

-- Set default to null for new inserts
ALTER TABLE quotations ALTER COLUMN user_id SET DEFAULT NULL;