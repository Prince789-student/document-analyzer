import pptxgen from 'pptxgenjs';
import { loadPdfJsDoc, renderPageToCanvas } from '../../utils/pdfHelper.js';

export const pdfToPptTool = {
  id: 'pdf-to-powerpoint',
  renderOptions(container, files, onUpdate) {
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="presentation"></i> PDF to PowerPoint (.pptx)</h4>
        <p class="text-muted">Document: <strong>${files[0].name}</strong></p>

        <div class="option-group">
          <div class="option-row">
            <label class="input-label">Slide Presentation Layout:</label>
            <select id="pptx-layout" class="text-input">
              <option value="LAYOUT_16x9" selected>Widescreen 16:9</option>
              <option value="LAYOUT_4x3">Standard 4:3</option>
            </select>
          </div>
        </div>
      </div>
    `;
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const layout = document.querySelector('#pptx-layout')?.value || 'LAYOUT_16x9';

    setProgress(20, 'Loading PDF document...');
    const pdfJsDoc = await loadPdfJsDoc(file);
    const numPages = pdfJsDoc.numPages;

    setProgress(30, 'Initializing PowerPoint slide deck...');
    const pptx = new pptxgen();
    pptx.layout = layout;

    for (let i = 1; i <= numPages; i++) {
      setProgress(30 + Math.round((i / numPages) * 60), `Converting page ${i} of ${numPages} to slide...`);

      const canvas = document.createElement('canvas');
      await renderPageToCanvas(pdfJsDoc, i, canvas, 1.8);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

      const slide = pptx.addSlide();
      slide.addImage({
        data: dataUrl,
        x: '5%',
        y: '5%',
        w: '90%',
        h: '90%',
        sizing: { type: 'contain', w: '90%', h: '90%' }
      });
    }

    setProgress(95, 'Generating .pptx file...');
    const pptxBlob = await pptx.write({ outputType: 'blob' });

    setProgress(100, 'Complete!');
    return {
      data: pptxBlob,
      filename: `${file.name.replace(/\.[^/.]+$/, '')}.pptx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
  }
};
