import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { loadPdfLibDoc } from '../../utils/pdfHelper.js';

export const addWatermarkTool = {
  id: 'add-watermark',
  renderOptions(container, files, onUpdate) {
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="stamp"></i> Add Watermark</h4>
        <p class="text-muted">Document: <strong>${files[0].name}</strong></p>

        <div class="option-row">
          <label class="input-label">Watermark Text:</label>
          <input type="text" id="wm-text" class="text-input" value="CONFIDENTIAL" placeholder="e.g. CONFIDENTIAL, DRAFT, SAMPLE">
        </div>

        <div class="grid-2-col" style="margin-top: 10px;">
          <div class="option-row">
            <label class="input-label">Watermark Color:</label>
            <select id="wm-color" class="text-input">
              <option value="red" selected>Crimson Red</option>
              <option value="gray">Neutral Gray</option>
              <option value="blue">Royal Blue</option>
              <option value="black">Deep Black</option>
            </select>
          </div>

          <div class="option-row">
            <label class="input-label">Font Size (pt):</label>
            <input type="number" id="wm-size" class="text-input" value="48" min="18" max="96">
          </div>
        </div>

        <div class="grid-2-col" style="margin-top: 10px;">
          <div class="option-row">
            <label class="input-label">Opacity / Transparency:</label>
            <input type="range" id="wm-opacity" min="0.05" max="0.9" step="0.05" value="0.25">
            <span id="wm-opacity-val" class="text-muted small">25%</span>
          </div>

          <div class="option-row">
            <label class="input-label">Rotation Angle:</label>
            <input type="range" id="wm-angle" min="-90" max="90" step="5" value="45">
            <span id="wm-angle-val" class="text-muted small">45°</span>
          </div>
        </div>
      </div>
    `;

    const opSlider = container.querySelector('#wm-opacity');
    const opVal = container.querySelector('#wm-opacity-val');
    opSlider.addEventListener('input', () => {
      opVal.innerText = `${Math.round(opSlider.value * 100)}%`;
    });

    const angSlider = container.querySelector('#wm-angle');
    const angVal = container.querySelector('#wm-angle-val');
    angSlider.addEventListener('input', () => {
      angVal.innerText = `${angSlider.value}°`;
    });
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const text = document.querySelector('#wm-text')?.value || 'CONFIDENTIAL';
    const colorType = document.querySelector('#wm-color')?.value || 'red';
    const fontSize = parseInt(document.querySelector('#wm-size')?.value || '48');
    const opacity = parseFloat(document.querySelector('#wm-opacity')?.value || '0.25');
    const angle = parseInt(document.querySelector('#wm-angle')?.value || '45');

    let textColor = rgb(0.85, 0.15, 0.15);
    if (colorType === 'gray') textColor = rgb(0.5, 0.5, 0.5);
    else if (colorType === 'blue') textColor = rgb(0.15, 0.35, 0.85);
    else if (colorType === 'black') textColor = rgb(0.05, 0.05, 0.05);

    setProgress(25, 'Loading PDF document...');
    const pdfDoc = await loadPdfLibDoc(file);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    setProgress(50, `Stamping watermark across ${totalPages} pages...`);

    pages.forEach((page, idx) => {
      const { width, height } = page.getSize();
      const textWidth = helveticaBold.widthOfTextAtSize(text, fontSize);
      const textHeight = helveticaBold.heightAtSize(fontSize);

      // Center coords
      const centerX = width / 2;
      const centerY = height / 2;

      page.drawText(text, {
        x: centerX - (textWidth / 2) * Math.cos((angle * Math.PI) / 180),
        y: centerY - (textWidth / 2) * Math.sin((angle * Math.PI) / 180),
        size: fontSize,
        font: helveticaBold,
        color: textColor,
        opacity: opacity,
        rotate: degrees(angle)
      });
    });

    setProgress(85, 'Saving watermarked document...');
    const bytes = await pdfDoc.save();

    setProgress(100, 'Complete!');
    return {
      data: bytes,
      filename: `${file.name.replace(/\.pdf$/i, '')}_watermarked.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
