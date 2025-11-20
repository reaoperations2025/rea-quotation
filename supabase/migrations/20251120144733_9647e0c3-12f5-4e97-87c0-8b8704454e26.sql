-- Create a function to calculate quotation statistics
CREATE OR REPLACE FUNCTION get_quotation_stats()
RETURNS TABLE (
  total_records BIGINT,
  total_amount NUMERIC,
  invoiced_count BIGINT,
  regret_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_records,
    SUM(
      CASE 
        WHEN total_amount IS NULL OR total_amount = '' OR total_amount = '-' THEN 0
        ELSE CAST(REPLACE(total_amount, ',', '') AS NUMERIC)
      END
    )::NUMERIC as total_amount,
    COUNT(CASE WHEN UPPER(status) = 'INVOICED' THEN 1 END)::BIGINT as invoiced_count,
    COUNT(CASE WHEN UPPER(status) = 'REGRET' THEN 1 END)::BIGINT as regret_count
  FROM quotations;
END;
$$;