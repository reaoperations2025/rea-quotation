import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageData } = await req.json();
    
    if (!imageData) {
      throw new Error("No file data provided");
    }

    // Validate base64 format
    if (!imageData.startsWith('data:')) {
      throw new Error("Invalid file format. Expected base64 data URL.");
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const mimeType = imageData.split(';')[0].split(':')[1];
    console.log('Processing document...', `Type: ${mimeType}, Size: ${imageData.length}`);

    // Handle different file types
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      return await handleExcelFile(imageData, LOVABLE_API_KEY);
    } else if (mimeType === 'application/pdf') {
      return await handlePDFFile(imageData, LOVABLE_API_KEY);
    } else {
      return await handleImageFile(imageData, LOVABLE_API_KEY);
    }

  } catch (error) {
    console.error("Error extracting quotation:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

async function handleExcelFile(base64Data: string, apiKey: string) {
  try {
    console.log('Handling Excel file...');
    
    const base64Content = base64Data.split(',')[1];
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: `You are analyzing an Excel quotation spreadsheet. Extract ALL fields with MAXIMUM ACCURACY:

FIELD DESCRIPTIONS:
- QUOTATION NO: Unique quotation reference (e.g., "ABA-05-188")
- QUOTATION DATE: Date in DD/MM/YYYY format
- CLIENT: Full client/company name
- NEW/OLD: Client type - "NEW" or "OLD"
- DESCRIPTION 1: Primary product/service description
- DESCRIPTION 2: Secondary description (if exists)
- QTY: Total quantity (sum all line items if multiple)
- UNIT COST: Price per unit WITHOUT currency symbols
- TOTAL AMOUNT: Total value WITHOUT currency symbols
- SALES  PERSON: Salesperson name
- INVOICE NO: Invoice reference (if invoiced)
- STATUS: "INVOICED", "PENDING", "REGRET", "APPROVED", or "OPEN"

EXTRACTION RULES:
1. Look for column headers and match data to correct fields
2. Check multiple rows for line items - sum quantities if needed
3. Remove currency symbols from all numbers
4. Date must be DD/MM/YYYY format
5. For NEW/OLD: Look for "Client Type" or similar columns
6. For STATUS: Check for status columns or invoice indicators
7. Empty string if field not found

Return ONLY this JSON:
{
  "QUOTATION NO": "",
  "QUOTATION DATE": "",
  "CLIENT": "",
  "NEW/OLD": "",
  "DESCRIPTION 1": "",
  "DESCRIPTION 2": "",
  "QTY": "",
  "UNIT COST": "",
  "TOTAL AMOUNT": "",
  "SALES  PERSON": "",
  "INVOICE NO": "",
  "STATUS": ""
}

Excel Data (base64): ${base64Content.substring(0, 1500)}...

CRITICAL: Verify accuracy before returning. Return ONLY JSON.`
          }
        ],
      }),
    });

    return await processAIResponse(response);
  } catch (error) {
    console.error("Excel error:", error);
    throw new Error("Failed to process Excel: " + (error instanceof Error ? error.message : "Unknown"));
  }
}

async function handlePDFFile(base64Data: string, apiKey: string) {
  try {
    console.log('Handling PDF file...');
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: `You are an expert at extracting quotation data from PDF documents. Analyze this PDF VERY CAREFULLY and extract ALL the following fields with PRECISION:

FIELD DESCRIPTIONS:
- QUOTATION NO: The unique quotation reference number (e.g., "ABA-05-188", "QTN-2024-001")
- QUOTATION DATE: The date when quotation was issued (format: DD/MM/YYYY, e.g., "24/10/2025")
- CLIENT: Full company/client name exactly as written
- NEW/OLD: Indicates if client is "NEW" or "OLD" (existing customer)
- DESCRIPTION 1: Main product/service description or first line item
- DESCRIPTION 2: Additional description or second line item (if any)
- QTY: Quantity of items/services (look for multiple items and sum them, or the main quantity)
- UNIT COST: Price per unit WITHOUT currency symbols (e.g., "12000.00" not "AED 12000")
- TOTAL AMOUNT: Total quotation value WITHOUT currency symbols
- SALES  PERSON: Name of salesperson/account manager
- INVOICE NO: Invoice number if quotation has been invoiced (often blank for new quotes)
- STATUS: Current status - look for words like "INVOICED", "PENDING", "REGRET", "APPROVED", "OPEN"

EXTRACTION RULES:
1. Read EVERY line of the PDF carefully - data may be in headers, tables, or footer
2. For NEW/OLD: Look for labels like "Client Type", "Customer Status", or infer from context
3. For STATUS: Look for status labels, approval stamps, or payment indicators
4. For INVOICE NO: Only fill if there's a clear invoice reference
5. For numeric fields: Remove ALL currency symbols (AED, $, ₹, etc.) and keep only numbers with decimals
6. If a field is truly not present, use empty string ""
7. Double-check calculations: TOTAL AMOUNT should equal QTY × UNIT COST (if not, use the explicit total shown)

Return ONLY this JSON structure with accurate data:
{
  "QUOTATION NO": "",
  "QUOTATION DATE": "",
  "CLIENT": "",
  "NEW/OLD": "",
  "DESCRIPTION 1": "",
  "DESCRIPTION 2": "",
  "QTY": "",
  "UNIT COST": "",
  "TOTAL AMOUNT": "",
  "SALES  PERSON": "",
  "INVOICE NO": "",
  "STATUS": ""
}

PDF Data (base64): ${base64Data.substring(0, 3000)}...

IMPORTANT: Verify your extraction is accurate before returning. Return ONLY the JSON object.`
          }
        ],
      }),
    });

    return await processAIResponse(response);
  } catch (error) {
    console.error("PDF error:", error);
    throw new Error("Failed to process PDF: " + (error instanceof Error ? error.message : "Unknown"));
  }
}

async function handleImageFile(base64Data: string, apiKey: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an expert at extracting quotation data from images. Analyze this image VERY CAREFULLY and extract ALL the following fields with PRECISION:

FIELD DESCRIPTIONS:
- QUOTATION NO: The unique quotation reference number (e.g., "ABA-05-188", "QTN-2024-001")
- QUOTATION DATE: The date when quotation was issued (format: DD/MM/YYYY)
- CLIENT: Full company/client name exactly as written
- NEW/OLD: Indicates if client is "NEW" or "OLD" (existing customer) - look for this label
- DESCRIPTION 1: Main product/service description or first line item
- DESCRIPTION 2: Additional description or second line item (if any)
- QTY: Quantity of items/services (check all line items carefully)
- UNIT COST: Price per unit WITHOUT currency symbols (e.g., "12000.00" not "AED 12000")
- TOTAL AMOUNT: Total quotation value WITHOUT currency symbols
- SALES  PERSON: Name of salesperson/account manager
- INVOICE NO: Invoice number if quotation has been invoiced
- STATUS: Current status - "INVOICED", "PENDING", "REGRET", "APPROVED", or "OPEN"

EXTRACTION RULES:
1. Read EVERY text element in the image - look in headers, tables, margins, and footers
2. For NEW/OLD: Check for explicit labels or client status indicators
3. For STATUS: Look for status stamps, approval marks, or payment indicators
4. For QTY: Add up all quantities if multiple line items exist
5. Remove ALL currency symbols (AED, $, ₹, etc.) from numeric fields
6. If field not present after thorough search, use empty string ""
7. Verify TOTAL AMOUNT = QTY × UNIT COST (or use explicit total if shown differently)

Return ONLY this JSON:
{
  "QUOTATION NO": "",
  "QUOTATION DATE": "",
  "CLIENT": "",
  "NEW/OLD": "",
  "DESCRIPTION 1": "",
  "DESCRIPTION 2": "",
  "QTY": "",
  "UNIT COST": "",
  "TOTAL AMOUNT": "",
  "SALES  PERSON": "",
  "INVOICE NO": "",
  "STATUS": ""
}

CRITICAL: Double-check your extraction for accuracy. Return ONLY the JSON object.`
            },
            {
              type: "image_url",
              image_url: {
                url: base64Data
              }
            }
          ]
        }
      ],
    }),
  });

  return await processAIResponse(response);
}

async function processAIResponse(response: Response) {
  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again in a moment.");
    } else if (response.status === 402) {
      throw new Error("AI credits exhausted. Please add credits to your workspace.");
    }
    
    throw new Error(`AI gateway error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content in AI response");
  }

  console.log('AI Response:', content);

  // Extract JSON from the response
  let jsonStr = content.trim();
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  console.log('Extracted JSON:', jsonStr);
  const extractedData = JSON.parse(jsonStr);
  console.log('Parsed data:', extractedData);

  return new Response(
    JSON.stringify({ success: true, data: extractedData }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
