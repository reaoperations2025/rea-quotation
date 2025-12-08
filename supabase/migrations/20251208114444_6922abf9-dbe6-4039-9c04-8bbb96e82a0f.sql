-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert quotations" ON quotations;

-- Create new INSERT policy that allows any authenticated user to insert
CREATE POLICY "Authenticated users can insert quotations"
ON quotations FOR INSERT
TO authenticated
WITH CHECK (true);