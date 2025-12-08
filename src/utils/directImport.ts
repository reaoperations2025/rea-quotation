import { supabase } from "@/integrations/supabase/client";

interface ImportResult {
  success: boolean;
  imported: number;
  errors: number;
  message: string;
}

export async function directImportFromExcel(): Promise<ImportResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  // Fetch the Excel file
  const response = await fetch('/data/quotations-import.xlsx');
  if (!response.ok) {
    throw new Error('Failed to load Excel file');
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Read with header option to get column names
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  console.log('Excel headers:', rawData[0]);
  console.log('First data row:', rawData[1]);
  
  // Parse and deduplicate - keep last occurrence of each quotation_no
  const quotationMap = new Map<string, any>();
  
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    const quotationNo = String(row[0] || '').trim();
    
    // Skip empty rows
    if (!quotationNo) continue;
    
    // Map columns: 0=QUOTATION NO, 1=QUOTATION DATE, 2=CLIENT, 3=DESCRIPTION 1, 4=TOTAL AMOUNT, 5=SALES PERSON, 6=STATUS
    quotationMap.set(quotationNo, {
      user_id: user.id,
      quotation_no: quotationNo,
      quotation_date: String(row[1] || '').trim(),
      client: String(row[2] || '').trim(),
      new_old: "OLD",
      description_1: String(row[3] || '').trim(),
      description_2: "",
      qty: "",
      unit_cost: "",
      total_amount: String(row[4] || '').trim(),
      sales_person: String(row[5] || '').trim(),
      invoice_no: "",
      status: String(row[6] || 'PENDING').trim().toUpperCase()
    });
  }
  
  const quotations = Array.from(quotationMap.values());
  console.log(`Parsed ${quotations.length} unique quotations from Excel`);
  
  // Validate some data
  const sampleWithAmount = quotations.filter(q => q.total_amount && !isNaN(parseFloat(q.total_amount.replace(/,/g, ''))));
  console.log(`${sampleWithAmount.length} quotations have valid amounts`);
  console.log('Sample quotation:', quotations[0]);
  
  // Batch insert directly to Supabase
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < quotations.length; i += batchSize) {
    const batch = quotations.slice(i, i + batchSize);
    
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
    message: `Imported ${successCount} quotations${errorCount > 0 ? ` (${errorCount} errors)` : ''}`
  };
}
