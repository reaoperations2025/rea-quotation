import { supabase } from "@/integrations/supabase/client";

// Excel data parsed from QUOTATION_APP_DATA.xlsx
// This file contains the complete quotation data to be imported

interface QuotationRow {
  quotation_no: string;
  quotation_date: string;
  client: string;
  description_1: string;
  total_amount: string;
  sales_person: string;
  status: string;
}

export async function importExcelData(quotations: QuotationRow[]): Promise<{ success: boolean; imported: number; errors: number }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("User not authenticated");
    }

    console.log(`Starting import of ${quotations.length} quotations via edge function...`);

    // Call edge function to handle the import server-side
    const { data, error } = await supabase.functions.invoke('import-quotations', {
      body: { quotations }
    });

    if (error) {
      throw error;
    }

    console.log('Import completed:', data);
    return { 
      success: true, 
      imported: data.imported, 
      errors: data.errors 
    };
    
  } catch (error) {
    console.error("Import failed:", error);
    throw error;
  }
}
