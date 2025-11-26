-- Add unique constraint on quotation_no and user_id to enable upsert
-- This allows us to update existing records and add new ones without duplicates
ALTER TABLE quotations ADD CONSTRAINT quotations_quotation_no_user_id_key UNIQUE (quotation_no, user_id);