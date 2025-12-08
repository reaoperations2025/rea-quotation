import { supabase } from "@/integrations/supabase/client";

interface ImportResult {
  success: boolean;
  imported: number;
  errors: number;
  message: string;
}

interface QuotationJSON {
  "QUOTATION NO": string;
  "QUOTATION DATE": string;
  "CLIENT": string;
  "NEW/OLD": string;
  "DESCRIPTION 1": string | null;
  "DESCRIPTION 2": string | null;
  "QTY": string | null;
  "UNIT COST": string | null;
  "TOTAL AMOUNT": string | null;
  "SALES  PERSON": string | null;
  "INVOICE NO"?: string | null;
  "STATUS": string;
}

export async function directImportFromExcel(): Promise<ImportResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  // Fetch the JSON file directly
  const response = await fetch('/data/quotations-full.json');
  if (!response.ok) {
    throw new Error('Failed to load quotations JSON file');
  }

  const jsonData: QuotationJSON[] = await response.json();
  console.log(`Loaded ${jsonData.length} records from JSON file`);

  // Filter out empty records - DO NOT deduplicate to preserve all records with amounts
  const validRecords = jsonData.filter(row => {
    const quotationNo = row["QUOTATION NO"]?.toString().trim();
    return quotationNo && quotationNo !== '';
  });
  
  console.log(`Valid records: ${validRecords.length}`);

  // Calculate total for verification
  let totalSum = 0;
  const statusCounts: Record<string, number> = {};

  // Convert to database format - NO user_id for shared data
  const dbRecords = validRecords.map(q => {
    // Parse total amount - remove commas and whitespace
    let totalAmount = "0.00";
    const rawAmount = q["TOTAL AMOUNT"];
    if (rawAmount) {
      const cleaned = rawAmount.toString().replace(/,/g, '').trim();
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        totalAmount = parsed.toFixed(2);
        totalSum += parsed;
      }
    }

    const status = (q.STATUS || 'PENDING').toUpperCase();
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    return {
      quotation_no: q["QUOTATION NO"].toString().trim(),
      quotation_date: q["QUOTATION DATE"] || '',
      client: q.CLIENT || '',
      new_old: q["NEW/OLD"] || 'OLD',
      description_1: q["DESCRIPTION 1"] || null,
      description_2: q["DESCRIPTION 2"] || null,
      qty: q.QTY || null,
      unit_cost: q["UNIT COST"]?.toString().replace(/,/g, '').trim() || null,
      total_amount: totalAmount,
      sales_person: q["SALES  PERSON"] || null,
      invoice_no: q["INVOICE NO"] || null,
      status: status
    };
  });

  console.log('Total amount sum:', totalSum.toFixed(2));
  console.log('Status distribution:', statusCounts);

  // Batch INSERT to Supabase - no unique constraint, insert all records
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < dbRecords.length; i += batchSize) {
    const batch = dbRecords.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('quotations')
      .insert(batch as any)
      .select();

    if (error) {
      console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, error);
      errorCount += batch.length;
    } else {
      successCount += data?.length || 0;
      console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${data?.length || 0} records`);
    }
  }

  return {
    success: errorCount === 0,
    imported: successCount,
    errors: errorCount,
    message: `Imported ${successCount} quotations (Total: ${totalSum.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED)${errorCount > 0 ? ` (${errorCount} errors)` : ''}`
  };
}
