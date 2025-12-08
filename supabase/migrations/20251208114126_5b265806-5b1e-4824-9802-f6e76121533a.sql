-- Drop the unique constraint on quotation_no to allow all records
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_quotation_no_unique;

-- Add unique constraint on id only (which is already the primary key)
-- This allows multiple records with same quotation_no