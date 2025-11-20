import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    // Parse "2024-01-02 00:00:00" format
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    
    // Format as DD-Mon-YY
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { quotations } = await req.json();

    if (!quotations || !Array.isArray(quotations)) {
      return new Response(
        JSON.stringify({ error: 'Invalid data format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting import of ${quotations.length} quotations for user ${user.id}...`);

    // Batch insert in chunks of 100
    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < quotations.length; i += batchSize) {
      const batch = quotations.slice(i, i + batchSize);
      
      const transformedBatch = batch.map((q: QuotationData) => ({
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
        console.log(`Imported batch ${i / batchSize + 1}: ${data.length} records`);
      }
    }

    console.log(`Import completed: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: successCount, 
        errors: errorCount,
        message: `Successfully imported ${successCount} quotations${errorCount > 0 ? ` (${errorCount} errors)` : ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Import failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
