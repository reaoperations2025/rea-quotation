import { supabase } from "@/integrations/supabase/client";

interface ImportResult {
  success: boolean;
  imported: number;
  errors: number;
  message: string;
}

// Convert Excel serial date to DD-MMM-YY format
function excelDateToString(excelDate: any): string {
  if (!excelDate) return "";
  
  // If already a string in correct format, return it
  if (typeof excelDate === 'string' && excelDate.includes('-')) {
    return excelDate;
  }
  
  // If it's a number (Excel serial date)
  if (typeof excelDate === 'number') {
    // Excel dates are days since Dec 30, 1899
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  }
  
  return String(excelDate);
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
  
  // Read with header row to get named columns
  const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
  
  console.log('Total rows from Excel:', jsonData.length);
  console.log('First row keys:', Object.keys(jsonData[0] || {}));
  console.log('First row data:', jsonData[0]);
  
  // Parse and deduplicate - keep last occurrence of each quotation_no
  const quotationMap = new Map<string, any>();
  
  for (const row of jsonData) {
    // Get column values by name (handle different possible column names)
    const quotationNo = String(row['QUOTATION NO'] || row['Quotation No'] || '').trim();
    
    // Skip empty rows
    if (!quotationNo) continue;
    
    const quotationDate = excelDateToString(row['QUOTATION DATE'] || row['Quotation Date'] || '');
    const client = String(row['CLIENT'] || row['Client'] || '').trim();
    const description1 = String(row['DESCRIPTION 1'] || row['Description 1'] || '').trim();
    const totalAmount = String(row['TOTAL AMOUNT'] || row['Total Amount'] || '').trim();
    const salesPerson = String(row['SALES PERSON'] || row['Sales Person'] || '').trim();
    const status = String(row['STATUS'] || row['Status'] || 'PENDING').trim().toUpperCase();
    
    quotationMap.set(quotationNo, {
      user_id: user.id,
      quotation_no: quotationNo,
      quotation_date: quotationDate,
      client: client,
      new_old: "OLD",
      description_1: description1,
      description_2: "",
      qty: "",
      unit_cost: "",
      total_amount: totalAmount,
      sales_person: salesPerson,
      invoice_no: "",
      status: status
    });
  }
  
  const quotations = Array.from(quotationMap.values());
  console.log(`Parsed ${quotations.length} unique quotations from Excel`);
  
  // Validate sample data
  console.log('Sample quotation after parsing:', quotations[0]);
  console.log('Sample quotation 2:', quotations[1]);
  
  // Count by status to verify
  const statusCounts: Record<string, number> = {};
  quotations.forEach(q => {
    const s = q.status || 'UNKNOWN';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  console.log('Status distribution:', statusCounts);
  
  // Calculate total amount for verification
  let totalAmountSum = 0;
  quotations.forEach(q => {
    const amt = parseFloat((q.total_amount || '').replace(/,/g, ''));
    if (!isNaN(amt)) totalAmountSum += amt;
  });
  console.log('Total amount sum:', totalAmountSum.toFixed(2));
  
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
