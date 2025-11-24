import { supabase } from "@/integrations/supabase/client";
import quotationsData from "../../public/data/quotations-import.json";

// Auto-fix data to match source file exactly
export async function autoFixData() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Get current count
    const { count: currentCount } = await supabase
      .from('quotations')
      .select('*', { count: 'exact', head: true });

    const sourceCount = quotationsData.quotations.length;
    
    // If counts match, assume data is in sync
    if (currentCount === sourceCount) {
      console.log(`✓ Database has ${currentCount} quotations matching source file`);
      return;
    }

    console.log(`Database has ${currentCount} quotations but source has ${sourceCount}. Syncing...`);
    
    // Delete all existing quotations for this user
    const { error: deleteError } = await supabase
      .from('quotations')
      .delete()
      .eq('user_id', session.user.id);
    
    if (deleteError) {
      console.error('Delete error:', deleteError);
      return;
    }

    console.log('Cleared existing data. Importing fresh data from source...');
    
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
    
    // Import all quotations from source in batches
    const batchSize = 100;
    let imported = 0;
    
    for (let i = 0; i < quotationsData.quotations.length; i += batchSize) {
      const batch = quotationsData.quotations.slice(i, i + batchSize);
      
      const transformedBatch = batch.map((q: any) => ({
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
        console.error('Import error:', error);
        continue;
      }
      
      imported += data.length;
      console.log(`Imported batch ${Math.floor(i / batchSize) + 1}: ${data.length} records (${imported}/${sourceCount})`);
    }
    
    console.log(`✓ Successfully imported ${imported} quotations from source file`);
    
  } catch (error) {
    console.error("Auto-fix failed:", error);
  }
}
