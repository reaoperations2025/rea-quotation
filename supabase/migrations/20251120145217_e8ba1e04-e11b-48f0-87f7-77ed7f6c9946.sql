-- Fix the get_quotation_stats function to avoid ambiguous column references
DROP FUNCTION IF EXISTS public.get_quotation_stats();

CREATE OR REPLACE FUNCTION public.get_quotation_stats()
RETURNS TABLE(total_records bigint, total_amount numeric, invoiced_count bigint, regret_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_records,
    SUM(
      CASE 
        WHEN q.total_amount IS NULL OR q.total_amount = '' OR q.total_amount = '-' THEN 0
        ELSE CAST(REPLACE(q.total_amount, ',', '') AS NUMERIC)
      END
    )::NUMERIC as total_amount,
    COUNT(CASE WHEN UPPER(q.status) = 'INVOICED' THEN 1 END)::BIGINT as invoiced_count,
    COUNT(CASE WHEN UPPER(q.status) = 'REGRET' THEN 1 END)::BIGINT as regret_count
  FROM quotations q;
END;
$$;