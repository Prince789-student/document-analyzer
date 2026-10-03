import { createWorker } from 'tesseract.js';
import { loadPdfJsDoc, renderPageToCanvas } from '../../utils/pdfHelper.js';
import { jsPDF } from 'jspdf';

export const ocrPdfTool = {
  id: 'ocr-pdf',
  extractedText: '',

  renderOptions(container, files, onUpdate) {
    this.extractedText = '';
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="scan-text"></i> Client-Side OCR Engine</h4>
        <p class="text-muted">Extract text from scanned PDF pages and images using browser-based machine learning.</p>

        <div class="option-group">
          <div class="option-row">
            <label class="input-label">OCR Recognition Language:</label>
            <select id="ocr-lang-select" class="text-input">
              <option value="eng" selected>English (Default)</option>
              <option value="spa">Spanish</option>
              <option value="fra">French</option>
              <option value="deu">German</option>
              <option value="hin">Hindi</option>
            </select>
          </div>

          <div class="option-row" style="margin-top: 10px;">
            <label class="input-label">Export Format:</label>
            <div class="radio-pills">
              <label><input type="radio" name="ocrOutput" value="txt" checked> Plain Text (.txt)</label>
              <label><input type="radio" name="ocrOutput" value="pdf"> Searchable PDF (.pdf)</label>
            </div>
          </div>
        </div>

        <div id="ocr-preview-container" style="margin-top: 15px; display: none;">
          <label class="input-label">Extracted Text Preview:</label>
          <textarea id="ocr-text-result" class="text-input" rows="8" readonly style="font-family: monospace; font-size: 12px;"></textarea>
        </div>
      </div>
    `;
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const lang = document.querySelector('#ocr-lang-select')?.value || 'eng';
    const outputFormat = document.querySelector('input[name="ocrOutput"]:checked')?.value || 'txt';

    setProgress(15, `Initializing Tesseract OCR worker (${lang})...`);
    let worker;
    try {
      worker = await createWorker(lang);
    } catch (e) {
      console.warn('Worker creation fallback:', e);
      worker = await createWorker('eng');
    }

    let allText = '';
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

    if (isPdf) {
      setProgress(25, 'Rendering PDF pages for OCR recognition...');
      const pdfJsDoc = await loadPdfJsDoc(file);
      const totalPages = pdfJsDoc.numPages;

      for (let i = 1; i <= totalPages; i++) {
        setProgress(25 + Math.round((i / totalPages) * 60), `Running OCR on Page ${i} of ${totalPages}...`);
        const canvas = document.createElement('canvas');
        await renderPageToCanvas(pdfJsDoc, i, canvas, 1.5);

        const ret = await worker.recognize(canvas);
        allText += `=== Page ${i} ===\n\n${ret.data.text}\n\n`;
      }
    } else {
      setProgress(40, 'Running OCR on image...');
      const ret = await worker.recognize(file);
      allText = ret.data.text;
    }

    await worker.terminate();

    this.extractedText = allText;
    const previewContainer = document.querySelector('#ocr-preview-container');
    const resultBox = document.querySelector('#ocr-text-result');
    if (previewContainer && resultBox) {
      previewContainer.style.display = 'block';
      resultBox.value = allText;
    }

    setProgress(95, 'Compiling OCR output...');

    if (outputFormat === 'txt') {
      setProgress(100, 'Done!');
      return {
        data: allText,
        filename: `${file.name.replace(/\.[^/.]+$/, '')}_ocr.txt`,
        mimeType: 'text/plain'
      };
    } else {
      // Create searchable PDF with text
      const pdf = new jsPDF();
      const splitText = pdf.splitTextToSize(allText, 180);
      pdf.text(splitText, 15, 20);
      const blob = pdf.output('blob');
      setProgress(100, 'Done!');
      return {
        data: blob,
        filename: `${file.name.replace(/\.[^/.]+$/, '')}_ocr_searchable.pdf`,
        mimeType: 'application/pdf'
      };
    }
  }
};
