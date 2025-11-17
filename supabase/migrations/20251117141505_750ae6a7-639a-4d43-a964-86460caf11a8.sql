-- Update RLS policies to allow all authenticated users to access all quotations
-- This enables organization-wide sharing of quotation data

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own quotations" ON public.quotations;
DROP POLICY IF EXISTS "Users can create their own quotations" ON public.quotations;
DROP POLICY IF EXISTS "Users can update their own quotations" ON public.quotations;
DROP POLICY IF EXISTS "Users can delete their own quotations" ON public.quotations;

-- Create new policies for organization-wide access
CREATE POLICY "All authenticated users can view all quotations" 
ON public.quotations 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can create quotations" 
ON public.quotations 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "All authenticated users can update quotations" 
ON public.quotations 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "All authenticated users can delete quotations" 
ON public.quotations 
FOR DELETE 
TO authenticated
USING (true);