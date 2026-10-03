import { PDFDocument } from 'pdf-lib';
import { loadPdfLibDoc, loadPdfJsDoc, renderPageToCanvas } from '../../utils/pdfHelper.js';

export const cropPdfTool = {
  id: 'crop-pdf',
  async renderOptions(container, files, onUpdate) {
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="crop"></i> Crop PDF Pages</h4>
        <p class="text-muted">Document: <strong>${files[0].name}</strong></p>

        <div class="grid-2-col">
          <div class="option-row">
            <label class="input-label">Left Margin Crop (pt):</label>
            <input type="range" id="crop-left" min="0" max="150" value="30">
            <span id="crop-left-val" class="text-muted small">30 pt</span>
          </div>

          <div class="option-row">
            <label class="input-label">Right Margin Crop (pt):</label>
            <input type="range" id="crop-right" min="0" max="150" value="30">
            <span id="crop-right-val" class="text-muted small">30 pt</span>
          </div>
        </div>

        <div class="grid-2-col" style="margin-top: 10px;">
          <div class="option-row">
            <label class="input-label">Top Margin Crop (pt):</label>
            <input type="range" id="crop-top" min="0" max="150" value="40">
            <span id="crop-top-val" class="text-muted small">40 pt</span>
          </div>

          <div class="option-row">
            <label class="input-label">Bottom Margin Crop (pt):</label>
            <input type="range" id="crop-bottom" min="0" max="150" value="40">
            <span id="crop-bottom-val" class="text-muted small">40 pt</span>
          </div>
        </div>

        <div class="crop-preview-wrapper" style="margin-top: 20px; text-align: center; position: relative;">
          <span class="text-muted small">Page 1 Crop Area Preview:</span>
          <div style="position: relative; display: inline-block; margin-top: 8px;">
            <canvas id="crop-preview-canvas" style="max-height: 240px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"></canvas>
            <div id="crop-overlay-box" style="position: absolute; border: 2px dashed #6366f1; background: rgba(99, 102, 241, 0.12); pointer-events: none; transition: all 0.15s ease;"></div>
          </div>
        </div>
      </div>
    `;

    const canvas = container.querySelector('#crop-preview-canvas');
    const overlay = container.querySelector('#crop-overlay-box');

    let pdfWidth = 595;
    let pdfHeight = 842;

    try {
      const pdfJs = await loadPdfJsDoc(files[0]);
      const page = await pdfJs.getPage(1);
      const vp = page.getViewport({ scale: 1.0 });
      pdfWidth = vp.width;
      pdfHeight = vp.height;
      await renderPageToCanvas(pdfJs, 1, canvas, 0.4);
    } catch (e) {}

    const updateOverlay = () => {
      if (!canvas || !canvas.clientWidth) return;
      const cL = parseInt(container.querySelector('#crop-left').value);
      const cR = parseInt(container.querySelector('#crop-right').value);
      const cT = parseInt(container.querySelector('#crop-top').value);
      const cB = parseInt(container.querySelector('#crop-bottom').value);

      const scaleX = canvas.clientWidth / pdfWidth;
      const scaleY = canvas.clientHeight / pdfHeight;

      overlay.style.left = `${cL * scaleX}px`;
      overlay.style.top = `${cT * scaleY}px`;
      overlay.style.width = `${canvas.clientWidth - (cL + cR) * scaleX}px`;
      overlay.style.height = `${canvas.clientHeight - (cT + cB) * scaleY}px`;
    };

    ['left', 'right', 'top', 'bottom'].forEach(side => {
      const input = container.querySelector(`#crop-${side}`);
      const val = container.querySelector(`#crop-${side}-val`);
      input.addEventListener('input', () => {
        val.innerText = `${input.value} pt`;
        updateOverlay();
      });
    });

    setTimeout(updateOverlay, 300);
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const cL = parseInt(document.querySelector('#crop-left')?.value || '30');
    const cR = parseInt(document.querySelector('#crop-right')?.value || '30');
    const cT = parseInt(document.querySelector('#crop-top')?.value || '40');
    const cB = parseInt(document.querySelector('#crop-bottom')?.value || '40');

    setProgress(25, 'Loading PDF document...');
    const pdfDoc = await loadPdfLibDoc(file);
    const pages = pdfDoc.getPages();

    setProgress(50, `Cropping margins on ${pages.length} pages...`);
    pages.forEach(page => {
      const { width, height } = page.getSize();
      const newX = cL;
      const newY = cB;
      const newW = Math.max(50, width - cL - cR);
      const newH = Math.max(50, height - cT - cB);

      page.setCropBox(newX, newY, newW, newH);
    });

    setProgress(85, 'Saving cropped PDF...');
    const bytes = await pdfDoc.save();

    setProgress(100, 'Complete!');
    return {
      data: bytes,
      filename: `${file.name.replace(/\.pdf$/i, '')}_cropped.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
