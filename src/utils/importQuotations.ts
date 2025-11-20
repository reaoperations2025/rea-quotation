import { supabase } from "@/integrations/supabase/client";

export async function importQuotationsFromJSON(jsonData: any) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("User not authenticated");
    }

    const quotations = jsonData.quotations;
    
    if (!quotations || !Array.isArray(quotations)) {
      throw new Error("Invalid JSON format");
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
