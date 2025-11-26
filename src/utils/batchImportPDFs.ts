import { supabase } from "@/integrations/supabase/client";
import { Quotation } from "@/types/quotation";

async function convertFileToBase64(filePath: string): Promise<string> {
  const response = await fetch(filePath);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function extractQuotationFromPDF(base64Data: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke('extract-quotation', {
    body: { imageData: base64Data }
  });

  if (error) throw error;
  return data;
}

export async function batchImportPDFs(files: { path: string; name: string }[]) {
  const results = [];
  const errors = [];

  for (const file of files) {
    try {
      console.log(`Processing ${file.name}...`);
      
      // Convert PDF to base64
      const base64Data = await convertFileToBase64(file.path);
      
      // Extract data using edge function
      const extractedData = await extractQuotationFromPDF(base64Data);
      
      if (!extractedData || !extractedData["QUOTATION NO"]) {
        throw new Error("Failed to extract quotation number");
      }

      // Get user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Insert into database
      const { data: insertedData, error: insertError } = await supabase
        .from('quotations')
        .insert({
          quotation_no: extractedData["QUOTATION NO"],
          quotation_date: extractedData["QUOTATION DATE"] || "",
          client: extractedData.CLIENT || "",
          new_old: extractedData["NEW/OLD"] || "NEW",
          description_1: extractedData["DESCRIPTION 1"] || "",
          description_2: extractedData["DESCRIPTION 2"] || "",
          qty: extractedData.QTY || "",
          unit_cost: extractedData["UNIT COST"] || "",
          total_amount: extractedData["TOTAL AMOUNT"] || "",
          sales_person: extractedData["SALES  PERSON"] || "",
          invoice_no: extractedData["INVOICE NO"] || "",
          status: extractedData.STATUS || "PENDING",
          user_id: session.user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      results.push({
        file: file.name,
        quotationNo: extractedData["QUOTATION NO"],
        success: true,
      });
      
      console.log(`✓ Successfully imported ${file.name}`);
    } catch (error) {
      console.error(`✗ Failed to import ${file.name}:`, error);
      errors.push({
        file: file.name,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { results, errors };
}
