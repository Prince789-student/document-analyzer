import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { loadPdfLibDoc, loadPdfJsDoc } from '../../utils/pdfHelper.js';

export const splitPdfTool = {
  id: 'split-pdf',
  async renderOptions(container, files, onUpdate) {
    let totalPages = 1;
    try {
      const pdf = await loadPdfJsDoc(files[0]);
      totalPages = pdf.numPages;
    } catch (e) {}

    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="scissors"></i> Split Options</h4>
        <p class="text-muted">Total Pages in document: <strong>${totalPages}</strong></p>

        <div class="option-group">
          <label class="radio-card">
            <input type="radio" name="splitMode" value="range" checked>
            <div class="radio-card-content">
              <strong>Custom Page Range</strong>
              <span>Extract a specific range into a single PDF (e.g. 1-${Math.min(2, totalPages)})</span>
            </div>
          </label>

          <label class="radio-card">
            <input type="radio" name="splitMode" value="all">
            <div class="radio-card-content">
              <strong>Split All Pages to ZIP</strong>
              <span>Extract each page as an individual standalone PDF</span>
            </div>
          </label>
        </div>

        <div id="range-inputs" style="margin-top: 15px;">
          <label class="input-label">Page Range Expression:</label>
          <input type="text" id="split-range-input" class="text-input" value="1-${Math.min(2, totalPages)}" placeholder="e.g. 1-2, 3">
          <small class="text-muted">Use comma-separated ranges or single numbers (e.g. 1, 2-3)</small>
        </div>
      </div>
    `;

    const radioBtns = container.querySelectorAll('input[name="splitMode"]');
    const rangeInputs = container.querySelector('#range-inputs');
    radioBtns.forEach(r => {
      r.addEventListener('change', () => {
        rangeInputs.style.display = r.value === 'range' ? 'block' : 'none';
      });
    });
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const mode = document.querySelector('input[name="splitMode"]:checked')?.value || 'range';
    const rangeStr = document.querySelector('#split-range-input')?.value || '1';

    setProgress(20, 'Analyzing PDF document...');
    const srcDoc = await loadPdfLibDoc(file);
    const totalPages = srcDoc.getPageCount();

    if (mode === 'all') {
      setProgress(40, 'Splitting into individual pages...');
      const zip = new JSZip();

      for (let i = 0; i < totalPages; i++) {
        setProgress(40 + Math.round((i / totalPages) * 50), `Saving page ${i + 1} of ${totalPages}...`);
        const singleDoc = await PDFDocument.create();
        const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
        singleDoc.addPage(copiedPage);
        const bytes = await singleDoc.save();
        zip.file(`page_${i + 1}.pdf`, bytes);
      }

      setProgress(95, 'Generating ZIP package...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      setProgress(100, 'Done!');
      return {
        data: zipBlob,
        filename: `${file.name.replace(/\.pdf$/i, '')}_split_pages.zip`,
        mimeType: 'application/zip'
      };
    } else {
      // Range mode
      setProgress(40, 'Parsing page ranges...');
      const pageIndices = parsePageRanges(rangeStr, totalPages);
      if (pageIndices.length === 0) {
        throw new Error(`Invalid page range. Please enter numbers between 1 and ${totalPages}.`);
      }

      setProgress(60, `Extracting ${pageIndices.length} pages...`);
      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
      copiedPages.forEach(p => newDoc.addPage(p));

      setProgress(90, 'Building PDF...');
      const bytes = await newDoc.save();
      setProgress(100, 'Done!');
      return {
        data: bytes,
        filename: `${file.name.replace(/\.pdf$/i, '')}_split.pdf`,
        mimeType: 'application/pdf'
      };
    }
  }
};

function parsePageRanges(str, max) {
  const indices = new Set();
  const parts = str.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        const low = Math.max(1, Math.min(start, end));
        const high = Math.min(max, Math.max(start, end));
        for (let i = low; i <= high; i++) indices.add(i - 1);
      }
    } else {
      const num = parseInt(trimmed);
      if (!isNaN(num) && num >= 1 && num <= max) {
        indices.add(num - 1);
      }
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
}
