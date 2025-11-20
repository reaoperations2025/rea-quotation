import { supabase } from "@/integrations/supabase/client";

interface QuotationData {
  "QUOTATION NO": string;
  "QUOTATION DATE ": string;
  "CLIENT": string;
  "NEW/OLD": string;
  "DESCRIPTION 1": string;
  "DESCRIPTION 2": string | null;
  "QTY": string | number | null;
  "UNIT COST": string | number | null;
  "TOTAL AMOUNT": string | number | null;
  "SALES  PERSON": string | null;
  "INVOICE NO": string | null;
  "STATUS": string | null;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    
    return `${day}-${month}-${year}`;
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export async function directImportQuotations(quotations: QuotationData[]) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    console.log(`Starting direct import of ${quotations.length} quotations...`);

    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < quotations.length; i += batchSize) {
      const batch = quotations.slice(i, i + batchSize);
      
      const transformedBatch = batch.map(q => ({
        user_id: user.id,
        quotation_no: q["QUOTATION NO"] || "",
        quotation_date: formatDate(q["QUOTATION DATE "]),
        client: (q["CLIENT"] || "").trim(),
        new_old: q["NEW/OLD"] || "",
        description_1: q["DESCRIPTION 1"] || "",
        description_2: q["DESCRIPTION 2"] || "",
        qty: q["QTY"]?.toString() || "",
        unit_cost: q["UNIT COST"]?.toString() || "",
        total_amount: q["TOTAL AMOUNT"]?.toString() || "",
        sales_person: q["SALES  PERSON"] || "",
        invoice_no: q["INVOICE NO"] || "",
        status: q["STATUS"] || "PENDING"
      }));

      const { data, error } = await supabase
        .from('quotations')
        .insert(transformedBatch)
        .select();

      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
        errorCount += batch.length;
      } else {
        successCount += data.length;
        console.log(`Imported batch ${i / batchSize + 1}: ${data.length} records (${successCount}/${quotations.length})`);
      }
    }

    console.log(`Import completed: ${successCount} success, ${errorCount} errors`);
    return { success: true, imported: successCount, errors: errorCount };
    
  } catch (error) {
    console.error("Import failed:", error);
    throw error;
  }
}
