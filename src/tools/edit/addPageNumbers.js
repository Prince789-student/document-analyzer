import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { loadPdfLibDoc } from '../../utils/pdfHelper.js';

export const addPageNumbersTool = {
  id: 'add-page-numbers',
  renderOptions(container, files, onUpdate) {
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="binary"></i> Add Page Numbers</h4>
        <p class="text-muted">Document: <strong>${files[0].name}</strong></p>

        <div class="grid-2-col">
          <div class="option-row">
            <label class="input-label">Number Position:</label>
            <select id="pg-position" class="text-input">
              <option value="bottom-right" selected>Bottom Right</option>
              <option value="bottom-center">Bottom Center</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="top-right">Top Right</option>
              <option value="top-center">Top Center</option>
              <option value="top-left">Top Left</option>
            </select>
          </div>

          <div class="option-row">
            <label class="input-label">Numbering Format:</label>
            <select id="pg-format" class="text-input">
              <option value="page-of-total" selected>Page {n} of {total}</option>
              <option value="simple">{n}</option>
              <option value="page-n">Page {n}</option>
              <option value="dash">- {n} -</option>
            </select>
          </div>
        </div>

        <div class="grid-2-col" style="margin-top: 10px;">
          <div class="option-row">
            <label class="input-label">Font Size:</label>
            <input type="number" id="pg-size" class="text-input" value="10" min="8" max="24">
          </div>

          <div class="option-row">
            <label class="input-label">Starting Page Number:</label>
            <input type="number" id="pg-start-num" class="text-input" value="1" min="1">
          </div>
        </div>

        <div class="option-row" style="margin-top: 15px;">
          <label class="custom-checkbox">
            <input type="checkbox" id="pg-skip-first">
            <span>Skip first page (Do not number cover page)</span>
          </label>
        </div>
      </div>
    `;
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const position = document.querySelector('#pg-position')?.value || 'bottom-right';
    const format = document.querySelector('#pg-format')?.value || 'page-of-total';
    const fontSize = parseInt(document.querySelector('#pg-size')?.value || '10');
    const startNum = parseInt(document.querySelector('#pg-start-num')?.value || '1');
    const skipFirst = document.querySelector('#pg-skip-first')?.checked || false;

    setProgress(25, 'Loading PDF document...');
    const pdfDoc = await loadPdfLibDoc(file);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    setProgress(50, `Inserting page numbers across ${totalPages} pages...`);

    pages.forEach((page, idx) => {
      if (skipFirst && idx === 0) return;

      const pageNum = startNum + (skipFirst ? idx - 1 : idx);
      let text = '';
      if (format === 'page-of-total') text = `Page ${pageNum} of ${totalPages}`;
      else if (format === 'simple') text = `${pageNum}`;
      else if (format === 'page-n') text = `Page ${pageNum}`;
      else if (format === 'dash') text = `- ${pageNum} -`;

      const textWidth = helveticaFont.widthOfTextAtSize(text, fontSize);
      const textHeight = helveticaFont.heightAtSize(fontSize);
      const { width, height } = page.getSize();

      const margin = 35;
      let x = margin;
      let y = margin;

      if (position.includes('bottom')) y = margin;
      else if (position.includes('top')) y = height - margin;

      if (position.includes('left')) x = margin;
      else if (position.includes('center')) x = (width - textWidth) / 2;
      else if (position.includes('right')) x = width - margin - textWidth;

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font: helveticaFont,
        color: rgb(0.35, 0.4, 0.45)
      });
    });

    setProgress(85, 'Saving numbered PDF...');
    const bytes = await pdfDoc.save();

    setProgress(100, 'Complete!');
    return {
      data: bytes,
      filename: `${file.name.replace(/\.pdf$/i, '')}_numbered.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
