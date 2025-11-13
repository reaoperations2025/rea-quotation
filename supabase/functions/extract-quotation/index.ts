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
            content: `This is an Excel quotation spreadsheet. Extract and return ONLY valid JSON:
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

Rules: Empty string if not found, no currency symbols, date as DD/MM/YYYY, return ONLY JSON.
Base64 sample: ${base64Content.substring(0, 1000)}...`
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
            content: `Extract quotation data from this PDF. Return ONLY valid JSON:
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

Rules: Empty string if not found, no currency symbols, date as DD/MM/YYYY, return ONLY JSON.
PDF (base64): ${base64Data.substring(0, 2000)}...`
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
              text: `Extract quotation data from this image. Return ONLY valid JSON:
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

Rules: Empty string if not found, no currency symbols, date as DD/MM/YYYY, return ONLY JSON.`
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
