import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

/**
 * Creates a rich, multi-page sample PDF file for instant testing of all tools
 */
export async function createSamplePdfFile(filename = 'Sample_Document.pdf') {
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Executive Overview
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page1.getSize();

  // Top header bar
  page1.drawRectangle({
    x: 0,
    y: height - 100,
    width: width,
    height: 100,
    color: rgb(0.12, 0.15, 0.28)
  });

  page1.drawText('ACME CORPORATION', {
    x: 50,
    y: height - 45,
    size: 14,
    font: helveticaBold,
    color: rgb(0.4, 0.6, 1.0)
  });

  page1.drawText('Quarterly Business Performance & Audit Report', {
    x: 50,
    y: height - 75,
    size: 20,
    font: helveticaBold,
    color: rgb(1, 1, 1)
  });

  page1.drawText('1. Executive Summary', {
    x: 50,
    y: height - 140,
    size: 16,
    font: helveticaBold,
    color: rgb(0.15, 0.2, 0.3)
  });

  const bodyText1 = 
    'This confidential document has been prepared for executive stakeholders to demonstrate\n' +
    'document processing capabilities, cross-functional analytics, and strategic milestones.\n' +
    'All metrics reported herein have been compiled under standard audit compliance.';

  page1.drawText(bodyText1, {
    x: 50,
    y: height - 170,
    size: 11,
    font: helveticaFont,
    color: rgb(0.3, 0.35, 0.4),
    lineHeight: 18
  });

  // Callout Box
  page1.drawRectangle({
    x: 50,
    y: height - 310,
    width: width - 100,
    height: 90,
    color: rgb(0.94, 0.96, 1.0),
    borderColor: rgb(0.39, 0.4, 0.95),
    borderWidth: 1.5
  });

  page1.drawText('KEY HIGHLIGHT: 48% PRODUCTIVITY INCREASE', {
    x: 70,
    y: height - 250,
    size: 12,
    font: helveticaBold,
    color: rgb(0.24, 0.25, 0.6)
  });

  page1.drawText('Implementing intelligent client-side document processing workflows eliminated\nexternal server bottlenecks while ensuring zero data retention and total privacy.', {
    x: 70,
    y: height - 280,
    size: 10,
    font: helveticaFont,
    color: rgb(0.3, 0.35, 0.45),
    lineHeight: 15
  });

  // Bullet points
  page1.drawText('2. Core Strategic Objectives', {
    x: 50,
    y: height - 350,
    size: 14,
    font: helveticaBold,
    color: rgb(0.15, 0.2, 0.3)
  });

  const bullets = [
    '• Zero-latency local PDF manipulation with cryptographic verification.',
    '• Complete privacy-first architecture running 100% in browser memory.',
    '• Comprehensive 30-tool support for conversions, editing, and security.',
    '• Automatic OCR text extraction and high-resolution visual comparison.'
  ];

  let bY = height - 380;
  for (const b of bullets) {
    page1.drawText(b, {
      x: 65,
      y: bY,
      size: 10.5,
      font: helveticaFont,
      color: rgb(0.3, 0.35, 0.4)
    });
    bY -= 24;
  }

  // Footer
  page1.drawText('Page 1 of 3  |  Confidential & Proprietary', {
    x: 50,
    y: 40,
    size: 9,
    font: helveticaFont,
    color: rgb(0.5, 0.55, 0.6)
  });

  // Page 2: Financial Table & Metrics
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  
  page2.drawText('3. Financial Breakdown & Performance Metrics', {
    x: 50,
    y: height - 70,
    size: 18,
    font: helveticaBold,
    color: rgb(0.15, 0.2, 0.3)
  });

  page2.drawText('Comparative fiscal breakdown for recent quarters across international operations:', {
    x: 50,
    y: height - 100,
    size: 11,
    font: helveticaFont,
    color: rgb(0.4, 0.45, 0.5)
  });

  // Table header
  const startY = height - 140;
  const rowHeight = 30;
  page2.drawRectangle({
    x: 50,
    y: startY - rowHeight,
    width: width - 100,
    height: rowHeight,
    color: rgb(0.15, 0.2, 0.3)
  });

  page2.drawText('Department', { x: 65, y: startY - 20, size: 11, font: helveticaBold, color: rgb(1, 1, 1) });
  page2.drawText('Q1 Revenue', { x: 200, y: startY - 20, size: 11, font: helveticaBold, color: rgb(1, 1, 1) });
  page2.drawText('Q2 Revenue', { x: 320, y: startY - 20, size: 11, font: helveticaBold, color: rgb(1, 1, 1) });
  page2.drawText('Growth', { x: 450, y: startY - 20, size: 11, font: helveticaBold, color: rgb(1, 1, 1) });

  const tableData = [
    ['Enterprise Cloud', '$1,240,000', '$1,890,000', '+52.4%'],
    ['AI Document Tools', '$940,000', '$1,580,000', '+68.1%'],
    ['Security Infrastructure', '$820,000', '$1,120,000', '+36.6%'],
    ['Hardware Solutions', '$610,000', '$640,000', '+4.9%'],
    ['Consulting Services', '$450,000', '$510,000', '+13.3%']
  ];

  let currentY = startY - rowHeight;
  tableData.forEach((row, idx) => {
    currentY -= rowHeight;
    const isEven = idx % 2 === 0;
    page2.drawRectangle({
      x: 50,
      y: currentY,
      width: width - 100,
      height: rowHeight,
      color: isEven ? rgb(0.97, 0.98, 0.99) : rgb(0.92, 0.94, 0.97)
    });

    page2.drawText(row[0], { x: 65, y: currentY + 9, size: 10, font: helveticaBold, color: rgb(0.2, 0.25, 0.3) });
    page2.drawText(row[1], { x: 200, y: currentY + 9, size: 10, font: helveticaFont, color: rgb(0.3, 0.35, 0.4) });
    page2.drawText(row[2], { x: 320, y: currentY + 9, size: 10, font: helveticaFont, color: rgb(0.3, 0.35, 0.4) });
    page2.drawText(row[3], { x: 450, y: currentY + 9, size: 10, font: helveticaBold, color: rgb(0.06, 0.6, 0.35) });
  });

  // Footer
  page2.drawText('Page 2 of 3  |  Financial Confidentiality Clause Applies', {
    x: 50,
    y: 40,
    size: 9,
    font: helveticaFont,
    color: rgb(0.5, 0.55, 0.6)
  });

  // Page 3: Verification, Form & Signature Section
  const page3 = pdfDoc.addPage([595.28, 841.89]);

  page3.drawText('4. Authorization & Sign-Off Statement', {
    x: 50,
    y: height - 70,
    size: 18,
    font: helveticaBold,
    color: rgb(0.15, 0.2, 0.3)
  });

  page3.drawText('By signing below, the reviewer acknowledges verification of all submitted records.', {
    x: 50,
    y: height - 100,
    size: 11,
    font: helveticaFont,
    color: rgb(0.4, 0.45, 0.5)
  });

  // Interactive-looking Form Fields
  const formBoxY = height - 280;
  page3.drawRectangle({
    x: 50,
    y: formBoxY,
    width: width - 100,
    height: 150,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.8, 0.82, 0.86),
    borderWidth: 1
  });

  page3.drawText('Full Legal Name: Johnathan Doe, Chief Operations Officer', {
    x: 70,
    y: formBoxY + 110,
    size: 11,
    font: helveticaBold,
    color: rgb(0.2, 0.25, 0.3)
  });

  page3.drawText('Review Date: October 14, 2026', {
    x: 70,
    y: formBoxY + 80,
    size: 11,
    font: helveticaFont,
    color: rgb(0.3, 0.35, 0.4)
  });

  page3.drawText('Verification Code: ACME-SEC-99201-XYZ', {
    x: 70,
    y: formBoxY + 50,
    size: 11,
    font: helveticaFont,
    color: rgb(0.3, 0.35, 0.4)
  });

  page3.drawText('[X] Compliance Standards Formally Approved', {
    x: 70,
    y: formBoxY + 20,
    size: 10,
    font: helveticaBold,
    color: rgb(0.1, 0.55, 0.3)
  });

  // Signature box
  page3.drawText('Authorized Signature Line:', {
    x: 50,
    y: height - 360,
    size: 12,
    font: helveticaBold,
    color: rgb(0.2, 0.25, 0.3)
  });

  page3.drawLine({
    start: { x: 50, y: height - 420 },
    end: { x: 300, y: height - 420 },
    thickness: 1.5,
    color: rgb(0.4, 0.45, 0.5)
  });

  page3.drawText('Signature Stamp / Digital Seal Area', {
    x: 60,
    y: height - 440,
    size: 9,
    font: helveticaFont,
    color: rgb(0.6, 0.65, 0.7)
  });

  // Page 3 footer
  page3.drawText('Page 3 of 3  |  End of Document', {
    x: 50,
    y: 40,
    size: 9,
    font: helveticaFont,
    color: rgb(0.5, 0.55, 0.6)
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  return new File([blob], filename, { type: 'application/pdf' });
}

/**
 * Creates a sample high-res image File for Image-to-PDF
 */
export function createSampleImageFile(filename = 'Sample_Invoice_Receipt.jpg') {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 800, 1000);

  // Decorative header
  ctx.fillStyle = '#4f46e5';
  ctx.fillRect(0, 0, 800, 120);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('INVOICE / RECEIPT', 50, 70);

  ctx.font = '16px sans-serif';
  ctx.fillText('Invoice #INV-2026-8841', 520, 70);

  // Content
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Billed To:', 50, 180);

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('Global Innovations Ltd.', 50, 215);
  ctx.fillText('742 Evergreen Terrace, Suite 400', 50, 240);
  ctx.fillText('San Francisco, CA 94107', 50, 265);

  // Items table
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(50, 320, 700, 45);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('Description', 70, 350);
  ctx.fillText('Qty', 420, 350);
  ctx.fillText('Rate', 520, 350);
  ctx.fillText('Amount', 640, 350);

  // Row 1
  ctx.fillStyle = '#334155';
  ctx.font = '15px sans-serif';
  ctx.fillText('Enterprise Document Suite License', 70, 410);
  ctx.fillText('1', 430, 410);
  ctx.fillText('$1,200', 520, 410);
  ctx.fillText('$1,200', 640, 410);

  // Row 2
  ctx.fillText('Cloud Infrastructure & API Access', 70, 460);
  ctx.fillText('12 mo', 420, 460);
  ctx.fillText('$150', 520, 460);
  ctx.fillText('$1,800', 640, 460);

  // Line
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(50, 520);
  ctx.lineTo(750, 520);
  ctx.stroke();

  // Total
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Total Paid: $3,000.00 USD', 440, 580);

  // Stamp
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 4;
  ctx.strokeRect(100, 680, 220, 80);
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('PAID IN FULL', 115, 730);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Creates a sample Excel File (.xlsx) for Excel-to-PDF testing
 */
export function createSampleExcelFile(filename = 'Quarterly_Sales_Data.xlsx') {
  const wb = XLSX.utils.book_new();
  const wsData = [
    ['Region', 'Q1 Target', 'Q1 Actual', 'Q2 Target', 'Q2 Actual', 'Status'],
    ['North America', 500000, 580000, 600000, 640000, 'Exceeded'],
    ['Europe & UK', 420000, 450000, 480000, 510000, 'Exceeded'],
    ['Asia Pacific', 350000, 390000, 400000, 435000, 'Exceeded'],
    ['Latin America', 180000, 175000, 200000, 210000, 'Met'],
    ['Middle East', 150000, 162000, 170000, 185000, 'Exceeded']
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Sales Performance');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new File([wbout], filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Creates a sample Word File (.docx) for Word-to-PDF testing
 */
export async function createSampleWordFile(filename = 'Project_Specification.docx') {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: 'System Architecture Specification',
            heading: HeadingLevel.TITLE
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Author: ',
                bold: true
              }),
              new TextRun('Senior Engineering Team\nDate: September 2026')
            ]
          }),
          new Paragraph({
            text: '1. Executive Overview',
            heading: HeadingLevel.HEADING_1
          }),
          new Paragraph({
            text: 'This system provides complete in-browser PDF utilities running entirely on WebAssembly and modern client-side standards. No documents are uploaded to third-party endpoints, satisfying strict enterprise compliance and zero-retention privacy mandates.'
          }),
          new Paragraph({
            text: '2. Functional Modules',
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({
            text: '• Document Organizing: Merge, Split, Reorder, Extract, and Scan.'
          }),
          new Paragraph({
            text: '• Optimization: High-ratio compression, Stream repair, and OCR.'
          }),
          new Paragraph({
            text: '• Multi-format conversion to and from Office formats.'
          })
        ]
      }
    ]
  });

  const buffer = await Packer.toBlob(doc);
  return new File([buffer], filename, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/**
 * Creates a sample HTML string for HTML-to-PDF testing
 */
export function getSampleHtmlContent() {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1e293b; }
    .header { border-bottom: 3px solid #6366f1; padding-bottom: 15px; margin-bottom: 25px; }
    h1 { color: #1e1b4b; margin: 0 0 5px 0; font-size: 26px; }
    .subtitle { color: #64748b; font-size: 14px; margin: 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 25px 0; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; }
    .card h3 { margin-top: 0; color: #4338ca; font-size: 16px; }
    .badge { display: inline-block; padding: 4px 10px; background: #e0e7ff; color: #3730a3; border-radius: 9999px; font-size: 12px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #4f46e5; color: white; text-align: left; padding: 10px; font-size: 13px; }
    td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">PROPOSAL</span>
    <h1>Digital Transformation & Document Pipeline</h1>
    <p class="subtitle">Generated dynamically via PDF Master Studio</p>
  </div>
  <p>This automated HTML-to-PDF document demonstrates high-fidelity markup rendering, styled responsive tables, and typography fidelity directly within modern web clients.</p>
  <div class="grid">
    <div class="card">
      <h3>Phase 1: Ingestion</h3>
      <p>Instant parsing of unstructured multi-page data streams with local WebAssembly processing.</p>
    </div>
    <div class="card">
      <h3>Phase 2: Distribution</h3>
      <p>Secure encryption, digital watermarking, and ISO PDF/A archival compliance.</p>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Deliverable</th><th>Timeline</th><th>Status</th></tr>
    </thead>
    <tbody>
      <tr><td>Client-Side PDF Engines</td><td>Week 1</td><td>Complete</td></tr>
      <tr><td>OCR Optical Character Recognition</td><td>Week 2</td><td>Complete</td></tr>
      <tr><td>Security & Digital Signatures</td><td>Week 3</td><td>Verified</td></tr>
    </tbody>
  </table>
</body>
</html>`;
}

export function createSampleHtmlFile(filename = 'Sample_Web_Report.html') {
  const content = getSampleHtmlContent();
  return new File([content], filename, { type: 'text/html' });
}

