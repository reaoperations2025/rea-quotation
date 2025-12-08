// This script converts the Excel data to JSON format
// Run this once to generate the JSON file

import * as XLSX from 'xlsx';
import * as fs from 'fs';

interface QuotationData {
  "QUOTATION NO": string;
  "QUOTATION DATE": string;
  "CLIENT": string;
  "NEW/OLD": string;
  "DESCRIPTION 1": string;
  "DESCRIPTION 2": string | null;
  "QTY": string | null;
  "UNIT COST": string | null;
  "TOTAL AMOUNT": number;
  "SALES  PERSON": string;
  "INVOICE NO": string | null;
  "STATUS": string;
}

// Read the Excel file
const workbook = XLSX.readFile('public/data/quotations-import.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON
const rawData = XLSX.utils.sheet_to_json(worksheet) as any[];

const quotations: QuotationData[] = rawData.map(row => ({
  "QUOTATION NO": String(row['QUOTATION NO'] || '').trim(),
  "QUOTATION DATE": String(row['QUOTATION DATE'] || '').trim(),
  "CLIENT": String(row['CLIENT'] || '').trim(),
  "NEW/OLD": "OLD",
  "DESCRIPTION 1": String(row['DESCRIPTION 1'] || '').trim(),
  "DESCRIPTION 2": null,
  "QTY": null,
  "UNIT COST": null,
  "TOTAL AMOUNT": parseFloat(String(row['TOTAL AMOUNT'] || '0').replace(/,/g, '')) || 0,
  "SALES  PERSON": String(row['SALES PERSON'] || row['SALES  PERSON'] || '').trim(),
  "INVOICE NO": null,
  "STATUS": String(row['STATUS'] || 'PENDING').trim().toUpperCase()
})).filter(q => q["QUOTATION NO"]);

// Deduplicate - keep last occurrence
const quotationMap = new Map<string, QuotationData>();
quotations.forEach(q => quotationMap.set(q["QUOTATION NO"], q));
const uniqueQuotations = Array.from(quotationMap.values());

// Write to JSON file
fs.writeFileSync('public/data/quotations.json', JSON.stringify(uniqueQuotations, null, 2));

console.log(`Converted ${uniqueQuotations.length} quotations to JSON`);
