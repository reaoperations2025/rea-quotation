import { supabase } from "@/integrations/supabase/client";

interface ImportResult {
  success: boolean;
  imported: number;
  errors: number;
  message: string;
}

interface QuotationData {
  "QUOTATION NO": string;
  "QUOTATION DATE": string;
  "CLIENT": string;
  "NEW/OLD": string;
  "DESCRIPTION 1": string;
  "DESCRIPTION 2": string | null;
  "QTY": string | null;
  "UNIT COST": string | null;
  "TOTAL AMOUNT": number;
  "SALES  PERSON": string;
  "INVOICE NO": string | null;
  "STATUS": string;
}

export async function directImportFromExcel(): Promise<ImportResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  // Fetch the Excel file and parse it to JSON
  const response = await fetch('/data/quotations-import.xlsx');
  if (!response.ok) {
    throw new Error('Failed to load Excel file');
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Read with header row
  const rawData = XLSX.utils.sheet_to_json(worksheet) as any[];
  
  console.log('Total rows from Excel:', rawData.length);
  console.log('First row:', rawData[0]);
  
  // Convert to proper format and deduplicate
  const quotationMap = new Map<string, any>();
  
  for (const row of rawData) {
    const quotationNo = String(row['QUOTATION NO'] || '').trim();
    if (!quotationNo) continue;
    
    // Parse total amount - handle both number and string formats
    let totalAmount = 0;
    const rawAmount = row['TOTAL AMOUNT'];
    if (typeof rawAmount === 'number') {
      totalAmount = rawAmount;
    } else if (typeof rawAmount === 'string') {
      totalAmount = parseFloat(rawAmount.replace(/,/g, '')) || 0;
    }
    
    const quotation: QuotationData = {
      "QUOTATION NO": quotationNo,
      "QUOTATION DATE": String(row['QUOTATION DATE'] || '').trim(),
      "CLIENT": String(row['CLIENT'] || '').trim(),
      "NEW/OLD": "OLD",
      "DESCRIPTION 1": String(row['DESCRIPTION 1'] || '').trim(),
      "DESCRIPTION 2": null,
      "QTY": null,
      "UNIT COST": null,
      "TOTAL AMOUNT": totalAmount,
      "SALES  PERSON": String(row['SALES PERSON'] || row['SALES  PERSON'] || '').trim(),
      "INVOICE NO": null,
      "STATUS": String(row['STATUS'] || 'PENDING').trim().toUpperCase()
    };
    
    quotationMap.set(quotationNo, quotation);
  }
  
  const quotations = Array.from(quotationMap.values());
  console.log(`Parsed ${quotations.length} unique quotations`);
  
  // Calculate total for verification
  const totalSum = quotations.reduce((sum, q) => sum + q["TOTAL AMOUNT"], 0);
  console.log('Total amount sum:', totalSum.toFixed(2));
  
  // Count by status
  const statusCounts: Record<string, number> = {};
  quotations.forEach(q => {
    const s = q.STATUS || 'UNKNOWN';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  console.log('Status distribution:', statusCounts);
  
  // Convert to database format
  const dbRecords = quotations.map(q => ({
    user_id: user.id,
    quotation_no: q["QUOTATION NO"],
    quotation_date: q["QUOTATION DATE"],
    client: q.CLIENT,
    new_old: q["NEW/OLD"],
    description_1: q["DESCRIPTION 1"],
    description_2: q["DESCRIPTION 2"] || "",
    qty: q.QTY || "",
    unit_cost: q["UNIT COST"] || "",
    total_amount: q["TOTAL AMOUNT"].toFixed(2), // Store as formatted string
    sales_person: q["SALES  PERSON"],
    invoice_no: q["INVOICE NO"] || "",
    status: q.STATUS
  }));
  
  // Batch insert to Supabase
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < dbRecords.length; i += batchSize) {
    const batch = dbRecords.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('quotations')
      .upsert(batch, { 
        onConflict: 'quotation_no,user_id',
        ignoreDuplicates: false 
      })
      .select();
    
    if (error) {
      console.error(`Batch ${Math.floor(i/batchSize) + 1} error:`, error);
      errorCount += batch.length;
    } else {
      successCount += data?.length || 0;
      console.log(`Batch ${Math.floor(i/batchSize) + 1}: ${data?.length || 0} records`);
    }
  }
  
  return {
    success: errorCount === 0,
    imported: successCount,
    errors: errorCount,
    message: `Imported ${successCount} quotations (Total: ${totalSum.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED)${errorCount > 0 ? ` (${errorCount} errors)` : ''}`
  };
}
