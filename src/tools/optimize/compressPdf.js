import { PDFDocument } from 'pdf-lib';
import { loadPdfJsDoc, renderPageToCanvas, loadPdfLibDoc } from '../../utils/pdfHelper.js';
import { jsPDF } from 'jspdf';

export const compressPdfTool = {
  id: 'compress-pdf',
  renderOptions(container, files, onUpdate) {
    const sizeMb = (files[0].size / (1024 * 1024)).toFixed(2);
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="minimize-2"></i> Compression Level</h4>
        <p class="text-muted">Original File Size: <strong>${sizeMb} MB</strong></p>

        <div class="option-group">
          <label class="radio-card">
            <input type="radio" name="compressionLevel" value="extreme">
            <div class="radio-card-content">
              <strong>Extreme Compression</strong>
              <span>Smallest file size (~70-85% reduction), optimized for email attachments.</span>
            </div>
          </label>

          <label class="radio-card">
            <input type="radio" name="compressionLevel" value="recommended" checked>
            <div class="radio-card-content">
              <strong>Recommended Compression</strong>
              <span>Balanced quality and size (~40-60% reduction), ideal for web viewing.</span>
            </div>
          </label>

          <label class="radio-card">
            <input type="radio" name="compressionLevel" value="low">
            <div class="radio-card-content">
              <strong>Light Compression</strong>
              <span>Maximum visual quality (~15-30% reduction), preserves high-res print details.</span>
            </div>
          </label>
        </div>
      </div>
    `;
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const level = document.querySelector('input[name="compressionLevel"]:checked')?.value || 'recommended';

    let scale = 1.0;
    let quality = 0.75;
    if (level === 'extreme') {
      scale = 0.8;
      quality = 0.55;
    } else if (level === 'low') {
      scale = 1.3;
      quality = 0.88;
    }

    setProgress(15, 'Analyzing PDF streams and structure...');
    const pdfJsDoc = await loadPdfJsDoc(file);
    const numPages = pdfJsDoc.numPages;

    setProgress(30, 'Re-encoding and optimizing raster streams...');
    const outPdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    for (let i = 1; i <= numPages; i++) {
      setProgress(30 + Math.round((i / numPages) * 55), `Optimizing page ${i} of ${numPages}...`);
      if (i > 1) outPdf.addPage('a4', 'portrait');

      const canvas = document.createElement('canvas');
      await renderPageToCanvas(pdfJsDoc, i, canvas, scale);
      const imgData = canvas.toDataURL('image/jpeg', quality);

      const pdfWidth = outPdf.internal.pageSize.getWidth();
      const pdfHeight = outPdf.internal.pageSize.getHeight();
      outPdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    }

    setProgress(92, 'Generating optimized stream...');
    const blob = outPdf.output('blob');

    const origSize = file.size;
    const newSize = blob.size;
    const savings = Math.max(0, Math.round(((origSize - newSize) / origSize) * 100));

    setProgress(100, `Done! Reduced by ${savings}%`);
    return {
      data: blob,
      filename: `${file.name.replace(/\.pdf$/i, '')}_compressed.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
