import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quotation } from '@/types/quotation';

export const exportClientsToExcel = (quotations: Quotation[], filename: string = 'clients') => {
  // Get unique clients from quotations
  const uniqueClients = Array.from(
    new Set(quotations.map(q => q.CLIENT).filter(c => c && c.trim() !== ''))
  ).sort();
  
  // Create data array with client names
  const clientData = uniqueClients.map((client, index) => ({
    'No.': index + 1,
    'Client Name': client,
  }));
  
  const worksheet = XLSX.utils.json_to_sheet(clientData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 8 },  // No.
    { wch: 50 }, // Client Name
  ];
  
  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportToExcel = (data: Quotation[], filename: string = 'quotations') => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Quotations');
  
  // Set column widths
  const maxWidth = data.reduce((w, r) => Math.max(w, String(r.CLIENT).length), 10);
  worksheet['!cols'] = [
    { wch: 15 }, // Quotation No
    { wch: 12 }, // Date
    { wch: maxWidth }, // Client
    { wch: 10 }, // New/Old
    { wch: 30 }, // Description 1
    { wch: 30 }, // Description 2
    { wch: 10 }, // Qty
    { wch: 12 }, // Unit Cost
    { wch: 15 }, // Total Amount
    { wch: 15 }, // Sales Person
    { wch: 12 }, // Invoice No
    { wch: 10 }, // Status
  ];
  
  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportToPDF = (data: Quotation[], filename: string = 'quotations') => {
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for more columns
  
  // Add header
  doc.setFontSize(18);
  doc.setTextColor(15, 108, 130); // Teal color
  doc.text('REA QUOTATION TRACKER', 14, 15);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);
  doc.text(`Total Records: ${data.length}`, 14, 27);
  
  // Prepare table data
  const tableData = data.map(q => [
    q["QUOTATION NO"],
    q["QUOTATION DATE"],
    q.CLIENT,
    q["NEW/OLD"],
    q["DESCRIPTION 1"],
    q.QTY,
    q["UNIT COST"],
    q["TOTAL AMOUNT"],
    q["SALES  PERSON"],
    q["INVOICE NO"],
    q.STATUS,
  ]);
  
  autoTable(doc, {
    head: [[
      'Quotation No',
      'Date',
      'Client',
      'Type',
      'Description',
      'Qty',
      'Unit Cost',
      'Total',
      'Sales Person',
      'Invoice',
      'Status'
    ]],
    body: tableData,
    startY: 32,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [15, 108, 130], // Teal
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [240, 248, 250],
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 18 },
      2: { cellWidth: 35 },
      3: { cellWidth: 12 },
      4: { cellWidth: 40 },
      5: { cellWidth: 15 },
      6: { cellWidth: 18 },
      7: { cellWidth: 20 },
      8: { cellWidth: 22 },
      9: { cellWidth: 18 },
      10: { cellWidth: 15 },
    },
  });
  
  // Add footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount} | Developed by ANIMA Tech Studio`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
};
