// Import all 30 PDF Suite Tools
import { mergePdfTool } from './organize/mergePdf.js';
import { splitPdfTool } from './organize/splitPdf.js';
import { removePagesTool } from './organize/removePages.js';
import { extractPagesTool } from './organize/extractPages.js';
import { organizePdfTool } from './organize/organizePdf.js';
import { scanToPdfTool } from './organize/scanToPdf.js';

import { compressPdfTool } from './optimize/compressPdf.js';
import { repairPdfTool } from './optimize/repairPdf.js';
import { ocrPdfTool } from './optimize/ocrPdf.js';

import { jpgToPdfTool } from './convertTo/jpgToPdf.js';
import { wordToPdfTool } from './convertTo/wordToPdf.js';
import { pptToPdfTool } from './convertTo/pptToPdf.js';
import { excelToPdfTool } from './convertTo/excelToPdf.js';
import { htmlToPdfTool } from './convertTo/htmlToPdf.js';

import { pdfToJpgTool } from './convertFrom/pdfToJpg.js';
import { pdfToWordTool } from './convertFrom/pdfToWord.js';
import { pdfToPptTool } from './convertFrom/pdfToPpt.js';
import { pdfToExcelTool } from './convertFrom/pdfToExcel.js';
import { pdfToPdfATool } from './convertFrom/pdfToPdfA.js';

import { rotatePdfTool } from './edit/rotatePdf.js';
import { addPageNumbersTool } from './edit/addPageNumbers.js';
import { addWatermarkTool } from './edit/addWatermark.js';
import { cropPdfTool } from './edit/cropPdf.js';
import { editPdfTool } from './edit/editPdf.js';
import { pdfFormsTool } from './edit/pdfForms.js';

import { unlockPdfTool } from './security/unlockPdf.js';
import { protectPdfTool } from './security/protectPdf.js';
import { signPdfTool } from './security/signPdf.js';
import { redactPdfTool } from './security/redactPdf.js';
import { comparePdfTool } from './security/comparePdf.js';

export const toolsRegistry = {
  'merge-pdf': mergePdfTool,
  'split-pdf': splitPdfTool,
  'remove-pages': removePagesTool,
  'extract-pages': extractPagesTool,
  'organize-pdf': organizePdfTool,
  'scan-to-pdf': scanToPdfTool,
  'compress-pdf': compressPdfTool,
  'repair-pdf': repairPdfTool,
  'ocr-pdf': ocrPdfTool,
  'jpg-to-pdf': jpgToPdfTool,
  'word-to-pdf': wordToPdfTool,
  'powerpoint-to-pdf': pptToPdfTool,
  'excel-to-pdf': excelToPdfTool,
  'html-to-pdf': htmlToPdfTool,
  'pdf-to-jpg': pdfToJpgTool,
  'pdf-to-word': pdfToWordTool,
  'pdf-to-powerpoint': pdfToPptTool,
  'pdf-to-excel': pdfToExcelTool,
  'pdf-to-pdfa': pdfToPdfATool,
  'rotate-pdf': rotatePdfTool,
  'add-page-numbers': addPageNumbersTool,
  'add-watermark': addWatermarkTool,
  'crop-pdf': cropPdfTool,
  'edit-pdf': editPdfTool,
  'pdf-forms': pdfFormsTool,
  'unlock-pdf': unlockPdfTool,
  'protect-pdf': protectPdfTool,
  'sign-pdf': signPdfTool,
  'redact-pdf': redactPdfTool,
  'compare-pdf': comparePdfTool
};

export function getTool(id) {
  return toolsRegistry[id] || null;
}
