import { PDFDocument, degrees } from 'pdf-lib';
import { loadPdfLibDoc, generatePageThumbnails } from '../../utils/pdfHelper.js';

export const rotatePdfTool = {
  id: 'rotate-pdf',
  currentAngle: 90,

  async renderOptions(container, files, onUpdate) {
    this.currentAngle = 90;

    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="rotate-cw"></i> Rotate PDF Pages</h4>
        <p class="text-muted">Document: <strong>${files[0].name}</strong></p>

        <div class="rotation-controls-row">
          <button type="button" class="btn btn-outline rotate-action-btn" data-angle="90">
            <i data-lucide="rotate-cw"></i> Rotate Right (90°)
          </button>
          <button type="button" class="btn btn-outline rotate-action-btn" data-angle="180">
            <i data-lucide="refresh-cw"></i> Flip Upside Down (180°)
          </button>
          <button type="button" class="btn btn-outline rotate-action-btn" data-angle="270">
            <i data-lucide="rotate-ccw"></i> Rotate Left (270°)
          </button>
        </div>

        <div class="option-row" style="margin-top: 15px;">
          <label class="input-label">Apply Rotation To:</label>
          <select id="rotate-target-pages" class="text-input">
            <option value="all" selected>All Pages</option>
            <option value="odd">Odd Pages Only (1, 3, 5...)</option>
            <option value="even">Even Pages Only (2, 4, 6...)</option>
            <option value="first">First Page Only</option>
          </select>
        </div>

        <div class="preview-rotation-box" style="margin-top: 15px; text-align: center;">
          <span class="text-muted small">Live Thumbnail Preview:</span>
          <div id="rotate-preview-wrapper" style="display: inline-block; margin-top: 8px; transition: transform 0.3s ease;">
            <img id="rotate-preview-img" src="" style="max-height: 180px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" alt="Preview"/>
          </div>
        </div>
      </div>
    `;

    try {
      const thumbs = await generatePageThumbnails(files[0], 200);
      if (thumbs.length > 0) {
        const img = container.querySelector('#rotate-preview-img');
        if (img) img.src = thumbs[0].dataUrl;
      }
    } catch (e) {}

    const wrapper = container.querySelector('#rotate-preview-wrapper');
    container.querySelectorAll('.rotate-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.rotate-action-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentAngle = parseInt(btn.dataset.angle);
        if (wrapper) wrapper.style.transform = `rotate(${this.currentAngle}deg)`;
      });
    });
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const target = document.querySelector('#rotate-target-pages')?.value || 'all';

    setProgress(25, 'Loading PDF document...');
    const pdfDoc = await loadPdfLibDoc(file);
    const pages = pdfDoc.getPages();
    const total = pages.length;

    setProgress(50, `Rotating pages (${this.currentAngle}°)...`);
    pages.forEach((page, idx) => {
      const pageNum = idx + 1;
      let shouldRotate = false;

      if (target === 'all') shouldRotate = true;
      else if (target === 'odd' && pageNum % 2 !== 0) shouldRotate = true;
      else if (target === 'even' && pageNum % 2 === 0) shouldRotate = true;
      else if (target === 'first' && pageNum === 1) shouldRotate = true;

      if (shouldRotate) {
        const curr = page.getRotation().angle;
        page.setRotation(degrees((curr + this.currentAngle) % 360));
      }
    });

    setProgress(85, 'Saving rotated document...');
    const bytes = await pdfDoc.save();

    setProgress(100, 'Complete!');
    return {
      data: bytes,
      filename: `${file.name.replace(/\.pdf$/i, '')}_rotated.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
