import JSZip from 'jszip';
import { loadPdfJsDoc, renderPageToCanvas } from '../../utils/pdfHelper.js';

export const pdfToJpgTool = {
  id: 'pdf-to-jpg',
  renderOptions(container, files, onUpdate) {
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="images"></i> PDF to JPG / PNG</h4>
        <p class="text-muted">Document: <strong>${files[0].name}</strong></p>

        <div class="grid-2-col">
          <div class="option-row">
            <label class="input-label">Image Format:</label>
            <select id="img-format-select" class="text-input">
              <option value="jpeg" selected>JPG (Standard, smaller size)</option>
              <option value="png">PNG (Lossless, sharp text)</option>
            </select>
          </div>

          <div class="option-row">
            <label class="input-label">Image Resolution (DPI):</label>
            <select id="img-dpi-select" class="text-input">
              <option value="1.0">Standard Web (72-96 DPI)</option>
              <option value="1.5" selected>Medium HD (150 DPI)</option>
              <option value="2.0">Ultra High-Res (300 DPI)</option>
            </select>
          </div>
        </div>
      </div>
    `;
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const format = document.querySelector('#img-format-select')?.value || 'jpeg';
    const scale = parseFloat(document.querySelector('#img-dpi-select')?.value || '1.5');
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';

    setProgress(20, 'Loading PDF document...');
    const pdfJsDoc = await loadPdfJsDoc(file);
    const numPages = pdfJsDoc.numPages;

    if (numPages === 1) {
      setProgress(50, 'Rendering single page to high-res image...');
      const canvas = document.createElement('canvas');
      await renderPageToCanvas(pdfJsDoc, 1, canvas, scale);
      const dataUrl = canvas.toDataURL(mime, 0.95);

      setProgress(100, 'Done!');
      return {
        data: dataUrl,
        filename: `${file.name.replace(/\.[^/.]+$/, '')}_page_1.${ext}`,
        mimeType: mime
      };
    } else {
      setProgress(30, `Rendering ${numPages} pages to image archive...`);
      const zip = new JSZip();

      for (let i = 1; i <= numPages; i++) {
        setProgress(30 + Math.round((i / numPages) * 60), `Rendering page ${i} of ${numPages}...`);
        const canvas = document.createElement('canvas');
        await renderPageToCanvas(pdfJsDoc, i, canvas, scale);

        const dataUrl = canvas.toDataURL(mime, 0.92);
        const base64Data = dataUrl.split(',')[1];
        zip.file(`page_${String(i).padStart(3, '0')}.${ext}`, base64Data, { base64: true });
      }

      setProgress(95, 'Zipping images into package...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      setProgress(100, 'Complete!');
      return {
        data: zipBlob,
        filename: `${file.name.replace(/\.[^/.]+$/, '')}_images.zip`,
        mimeType: 'application/zip'
      };
    }
  }
};
