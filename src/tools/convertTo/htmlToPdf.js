import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { getSampleHtmlContent } from '../../utils/sampleDocs.js';

export const htmlToPdfTool = {
  id: 'html-to-pdf',
  renderOptions(container, files, onUpdate) {
    const defaultHtml = getSampleHtmlContent();

    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="code-2"></i> HTML to PDF Studio</h4>
        <p class="text-muted">Edit HTML code directly or upload an .html file to render into high-fidelity PDF.</p>

        <div class="html-editor-container" style="margin-top: 10px;">
          <label class="input-label">HTML / CSS Source:</label>
          <textarea id="html-source-input" class="text-input" rows="8" style="font-family: monospace; font-size: 12px;">${defaultHtml}</textarea>
        </div>

        <div class="option-row" style="margin-top: 10px;">
          <label class="input-label">Output Page Layout:</label>
          <select id="html-orientation" class="text-input">
            <option value="portrait" selected>Portrait (A4)</option>
            <option value="landscape">Landscape (A4)</option>
          </select>
        </div>
      </div>
    `;

    if (files && files.length > 0 && files[0].name.endsWith('.html')) {
      files[0].text().then(t => {
        const input = container.querySelector('#html-source-input');
        if (input) input.value = t;
      });
    }
  },

  async process(files, options, setProgress) {
    const htmlCode = document.querySelector('#html-source-input')?.value || getSampleHtmlContent();
    const orientation = document.querySelector('#html-orientation')?.value || 'portrait';

    setProgress(20, 'Mounting sandbox rendering container...');
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '800px';
    iframe.style.height = '1200px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    iframe.contentDocument.open();
    iframe.contentDocument.write(htmlCode);
    iframe.contentDocument.close();

    // Wait for assets/fonts to paint
    await new Promise(r => setTimeout(r, 600));

    setProgress(50, 'Capturing rendered layout with HTML2Canvas...');
    const targetElement = iframe.contentDocument.body;
    const canvas = await html2canvas(targetElement, {
      scale: 2,
      useCORS: true,
      logging: false
    });

    document.body.removeChild(iframe);

    setProgress(75, 'Constructing PDF vector pages...');
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'pt',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);

    const ratio = pdfWidth / imgProps.width;
    const canvasHeightInPdf = imgProps.height * ratio;

    let heightLeft = canvasHeightInPdf;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, canvasHeightInPdf, undefined, 'FAST');
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - canvasHeightInPdf;
      pdf.addPage('a4', orientation);
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, canvasHeightInPdf, undefined, 'FAST');
      heightLeft -= pdfHeight;
    }

    setProgress(95, 'Finalizing PDF output...');
    const blob = pdf.output('blob');

    setProgress(100, 'Complete!');
    return {
      data: blob,
      filename: 'webpage_rendered.pdf',
      mimeType: 'application/pdf'
    };
  }
};
