import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuotationData {
  quotation_no: string;
  quotation_date: string;
  client: string;
  description_1: string;
  total_amount: string;
  sales_person: string;
  status: string;
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
        quotation_no: q.quotation_no || "",
        quotation_date: q.quotation_date || "",
        client: (q.client || "").trim(),
        new_old: "OLD",
        description_1: q.description_1 || "",
        description_2: "",
        qty: "",
        unit_cost: "",
        total_amount: q.total_amount || "",
        sales_person: q.sales_person || "",
        invoice_no: "",
        status: q.status || "PENDING"
      }));

      // Use upsert to update existing records and add new ones
      const { data, error } = await supabase
        .from('quotations')
        .upsert(transformedBatch, { 
          onConflict: 'quotation_no,user_id',
          ignoreDuplicates: false 
        })
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
