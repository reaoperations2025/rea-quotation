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
    console.log('Handling Excel file with AI extraction...');
    
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
            role: "system",
            content: "You are an expert data extraction assistant specializing in Excel documents. Extract quotation information with 100% accuracy."
          },
          {
            role: "user",
            content: `Analyze this Excel quotation and extract all fields accurately. Look for headers, labels, and structured data in rows and columns.

Extract these fields EXACTLY as they appear:
- QUOTATION NO (reference number)
- QUOTATION DATE (convert to DD/MM/YYYY)
- CLIENT (customer/company name)
- DESCRIPTION 1 (main product/service)
- DESCRIPTION 2 (additional items if any)
- QTY (quantity as number)
- UNIT COST (numeric only, no currency)
- TOTAL AMOUNT (numeric only, no currency)
- NEW/OLD (client status)
- SALES PERSON (representative name)
- INVOICE NO (if present)
- STATUS (quotation status)

Rules: Extract exact text, remove currency symbols, use empty string "" if not found. Format dates as DD/MM/YYYY.

Excel content (base64 decoded): ${base64Content.substring(0, 2000)}`
          }
        ],
        tools: [
          {
            type: "function",
            name: "extract_quotation_fields",
            description: "Extract structured quotation data",
            parameters: {
              type: "object",
              properties: {
                "QUOTATION NO": { type: "string" },
                "QUOTATION DATE": { type: "string" },
                "CLIENT": { type: "string" },
                "NEW/OLD": { type: "string" },
                "DESCRIPTION 1": { type: "string" },
                "DESCRIPTION 2": { type: "string" },
                "QTY": { type: "string" },
                "UNIT COST": { type: "string" },
                "TOTAL AMOUNT": { type: "string" },
                "SALES  PERSON": { type: "string" },
                "INVOICE NO": { type: "string" },
                "STATUS": { type: "string" }
              },
              required: ["QUOTATION NO", "QUOTATION DATE", "CLIENT", "NEW/OLD", "DESCRIPTION 1", "DESCRIPTION 2", "QTY", "UNIT COST", "TOTAL AMOUNT", "SALES  PERSON", "INVOICE NO", "STATUS"]
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_quotation_fields" } }
      }),
    });

    return await processAIResponse(response);
  } catch (error) {
    console.error("Excel extraction error:", error);
    throw new Error("Failed to process Excel: " + (error instanceof Error ? error.message : "Unknown"));
  }
}

async function handlePDFFile(base64Data: string, apiKey: string) {
  try {
    console.log('Handling PDF file with AI extraction...');
    
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
            role: "system",
            content: "You are an expert data extraction assistant. Extract quotation information from documents with 100% accuracy. Only extract visible text - never guess or make up information."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this PDF quotation document carefully and extract the following fields with complete accuracy:

REQUIRED FIELDS (extract EXACTLY as shown in document):
1. QUOTATION NO - The quotation/quote reference number
2. QUOTATION DATE - Format as DD/MM/YYYY
3. CLIENT - Full client/customer name or company name
4. DESCRIPTION 1 - Primary item, service, or product description
5. UNIT COST - Numeric value only (remove AED, $, or any currency symbols)
6. TOTAL AMOUNT - Total cost as numeric value (remove currency symbols)

OPTIONAL FIELDS (if visible):
7. DESCRIPTION 2 - Additional description or second line item
8. QTY - Quantity (numeric)
9. NEW/OLD - Client status if mentioned
10. SALES PERSON - Sales representative name
11. INVOICE NO - Invoice reference if present
12. STATUS - Order/quotation status

EXTRACTION RULES:
- Extract text EXACTLY as it appears
- For dates: convert to DD/MM/YYYY format
- For numbers: remove all currency symbols and commas, keep only digits and decimal point
- If a field is not visible or unclear, leave it as empty string ""
- Do NOT guess, infer, or make up any information
- Pay attention to headers, labels, and document structure

Return your response as a JSON object with these exact keys.`
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
        tools: [
          {
            type: "function",
            name: "extract_quotation_fields",
            description: "Extract structured quotation data from the document",
            parameters: {
              type: "object",
              properties: {
                "QUOTATION NO": { type: "string", description: "Quotation reference number" },
                "QUOTATION DATE": { type: "string", description: "Date in DD/MM/YYYY format" },
                "CLIENT": { type: "string", description: "Client or company name" },
                "NEW/OLD": { type: "string", description: "Client status" },
                "DESCRIPTION 1": { type: "string", description: "Primary item/service description" },
                "DESCRIPTION 2": { type: "string", description: "Additional description" },
                "QTY": { type: "string", description: "Quantity" },
                "UNIT COST": { type: "string", description: "Unit cost without currency symbols" },
                "TOTAL AMOUNT": { type: "string", description: "Total amount without currency symbols" },
                "SALES  PERSON": { type: "string", description: "Sales person name" },
                "INVOICE NO": { type: "string", description: "Invoice number if available" },
                "STATUS": { type: "string", description: "Quotation status" }
              },
              required: ["QUOTATION NO", "QUOTATION DATE", "CLIENT", "NEW/OLD", "DESCRIPTION 1", "DESCRIPTION 2", "QTY", "UNIT COST", "TOTAL AMOUNT", "SALES  PERSON", "INVOICE NO", "STATUS"]
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_quotation_fields" } }
      }),
    });

    return await processAIResponse(response);
  } catch (error) {
    console.error("PDF extraction error:", error);
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
          role: "system",
          content: "You are an expert OCR and data extraction assistant. Extract quotation information from images with perfect accuracy."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Carefully analyze this quotation image and extract all visible information with complete accuracy.

EXTRACT THESE FIELDS:
- QUOTATION NO: Reference/quote number
- QUOTATION DATE: Convert to DD/MM/YYYY format
- CLIENT: Full customer or company name
- DESCRIPTION 1: Main product/service/item
- DESCRIPTION 2: Additional items if visible
- QTY: Quantity (numeric)
- UNIT COST: Price per unit (remove currency symbols)
- TOTAL AMOUNT: Total cost (remove currency symbols)
- NEW/OLD: Client status if mentioned
- SALES PERSON: Sales representative name
- INVOICE NO: Invoice reference if shown
- STATUS: Quotation/order status

RULES:
- Read and transcribe text EXACTLY as it appears in the image
- For amounts: remove AED, $, or any currency symbols - keep only numbers
- For dates: convert to DD/MM/YYYY format
- Use empty string "" for fields not visible in the image
- Do NOT guess or infer information not clearly visible
- Pay attention to tables, headers, and structured layouts

Return structured JSON with all fields.`
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
      tools: [
        {
          type: "function",
          name: "extract_quotation_fields",
          description: "Extract all quotation fields from the image",
          parameters: {
            type: "object",
            properties: {
              "QUOTATION NO": { type: "string" },
              "QUOTATION DATE": { type: "string" },
              "CLIENT": { type: "string" },
              "NEW/OLD": { type: "string" },
              "DESCRIPTION 1": { type: "string" },
              "DESCRIPTION 2": { type: "string" },
              "QTY": { type: "string" },
              "UNIT COST": { type: "string" },
              "TOTAL AMOUNT": { type: "string" },
              "SALES  PERSON": { type: "string" },
              "INVOICE NO": { type: "string" },
              "STATUS": { type: "string" }
            },
            required: ["QUOTATION NO", "QUOTATION DATE", "CLIENT", "NEW/OLD", "DESCRIPTION 1", "DESCRIPTION 2", "QTY", "UNIT COST", "TOTAL AMOUNT", "SALES  PERSON", "INVOICE NO", "STATUS"]
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "extract_quotation_fields" } }
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
  console.log('Full AI response:', JSON.stringify(data, null, 2));

  // Check for tool call response (structured output)
  const toolCalls = data.choices?.[0]?.message?.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    const functionCall = toolCalls[0];
    console.log('Tool call detected:', functionCall.function.name);
    const extractedData = JSON.parse(functionCall.function.arguments);
    console.log('Extracted data from tool call:', extractedData);
    
    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fallback to content parsing
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content or tool calls in AI response");
  }

  console.log('AI Response content:', content);

  // Extract JSON from the response
  let jsonStr = content.trim();
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  console.log('Extracted JSON string:', jsonStr);
  const extractedData = JSON.parse(jsonStr);
  console.log('Parsed data:', extractedData);

  return new Response(
    JSON.stringify({ success: true, data: extractedData }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
