import { PDFDocument } from 'pdf-lib';

export const jpgToPdfTool = {
  id: 'jpg-to-pdf',
  renderOptions(container, files, onUpdate) {
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="image"></i> Image to PDF Settings</h4>
        <p class="text-muted">Converting <strong>${files.length}</strong> image(s) to PDF.</p>

        <div class="grid-2-col">
          <div class="option-row">
            <label class="input-label">Page Orientation:</label>
            <select id="img-orientation" class="text-input">
              <option value="auto" selected>Auto Detect</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>

          <div class="option-row">
            <label class="input-label">Page Margin:</label>
            <select id="img-margin" class="text-input">
              <option value="none">No Margin (Full Bleed)</option>
              <option value="small" selected>Small (20pt)</option>
              <option value="large">Large (40pt)</option>
            </select>
          </div>
        </div>

        <div class="option-row" style="margin-top: 10px;">
          <label class="input-label">Page Size:</label>
          <select id="img-pagesize" class="text-input">
            <option value="a4" selected>A4 Standard</option>
            <option value="letter">US Letter</option>
            <option value="fit">Fit to Image Aspect Ratio</option>
          </select>
        </div>
      </div>
    `;
  },

  async process(files, options, setProgress) {
    if (!files || files.length === 0) {
      throw new Error('Please select at least one image file.');
    }

    const orientation = document.querySelector('#img-orientation')?.value || 'auto';
    const marginType = document.querySelector('#img-margin')?.value || 'small';
    const pageSize = document.querySelector('#img-pagesize')?.value || 'a4';

    let margin = 20;
    if (marginType === 'none') margin = 0;
    if (marginType === 'large') margin = 40;

    setProgress(20, 'Creating PDF document...');
    const pdfDoc = await PDFDocument.create();

    const total = files.length;
    for (let i = 0; i < total; i++) {
      const file = files[i];
      setProgress(20 + Math.round((i / total) * 70), `Embedding image ${i + 1} of ${total}...`);

      const arrayBuffer = await file.arrayBuffer();
      let pdfImage;
      if (file.type === 'image/png' || file.name.endsWith('.png')) {
        pdfImage = await pdfDoc.embedPng(arrayBuffer);
      } else {
        pdfImage = await pdfDoc.embedJpg(arrayBuffer);
      }

      const imgWidth = pdfImage.width;
      const imgHeight = pdfImage.height;

      let pageWidth = 595.28; // A4
      let pageHeight = 841.89;

      if (pageSize === 'letter') {
        pageWidth = 612;
        pageHeight = 792;
      } else if (pageSize === 'fit') {
        pageWidth = imgWidth + margin * 2;
        pageHeight = imgHeight + margin * 2;
      }

      if (orientation === 'landscape' || (orientation === 'auto' && imgWidth > imgHeight && pageSize !== 'fit')) {
        const temp = pageWidth;
        pageWidth = pageHeight;
        pageHeight = temp;
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      const availWidth = pageWidth - margin * 2;
      const availHeight = pageHeight - margin * 2;
      const scale = Math.min(availWidth / imgWidth, availHeight / imgHeight);

      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;
      const x = margin + (availWidth - drawWidth) / 2;
      const y = margin + (availHeight - drawHeight) / 2;

      page.drawImage(pdfImage, {
        x,
        y,
        width: drawWidth,
        height: drawHeight
      });
    }

    setProgress(95, 'Finalizing PDF output...');
    const bytes = await pdfDoc.save();

    setProgress(100, 'Complete!');
    return {
      data: bytes,
      filename: 'images_converted.pdf',
      mimeType: 'application/pdf'
    };
  }
};
