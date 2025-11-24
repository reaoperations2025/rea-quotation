import { supabase } from "@/integrations/supabase/client";
import quotationsData from "../../public/data/quotations-import.json";

export async function fixQuotationsData() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("User not authenticated");
    }

    console.log("Starting data fix...");
    
    // Get all existing quotation numbers from database
    const { data: existingQuotations, error: fetchError } = await supabase
      .from('quotations')
      .select('quotation_no');
    
    if (fetchError) throw fetchError;
    
    const existingQuotationNos = new Set(
      existingQuotations?.map(q => q.quotation_no) || []
    );
    
    console.log(`Found ${existingQuotationNos.size} existing quotations in database`);
    
    // Get quotations from source file
    const sourceQuotations = quotationsData.quotations;
    console.log(`Found ${sourceQuotations.length} quotations in source file`);
    
    // Find missing quotations
    const missingQuotations = sourceQuotations.filter(
      (q: any) => !existingQuotationNos.has(q["QUOTATION NO"])
    );
    
    console.log(`Found ${missingQuotations.length} missing quotations to import`);
    
    if (missingQuotations.length === 0) {
      return {
        success: true,
        message: "No missing quotations found. Database is up to date!",
        imported: 0
      };
    }
    
    // Format date helper
    const formatDate = (dateStr: string): string => {
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
    };
    
    // Transform and import missing quotations
    const transformedBatch = missingQuotations.map((q: any) => ({
      user_id: session.user.id,
      quotation_no: q["QUOTATION NO"] || "",
      quotation_date: formatDate(q["QUOTATION DATE "]),
      client: (q["CLIENT"] || "").toString().trim(),
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
      console.error('Error importing:', error);
      throw error;
    }
    
    console.log(`Successfully imported ${data.length} quotations`);
    
    return {
      success: true,
      imported: data.length,
      message: `Successfully imported ${data.length} missing quotations`
    };
    
  } catch (error) {
    console.error("Fix failed:", error);
    throw error;
  }
}
