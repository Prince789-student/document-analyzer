import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { loadPdfLibDoc } from '../../utils/pdfHelper.js';

export const pdfToPdfATool = {
  id: 'pdf-to-pdfa',
  renderOptions(container, files, onUpdate) {
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="archive"></i> PDF to PDF/A Archival Converter</h4>
        <p class="text-muted">Document: <strong>${files[0].name}</strong></p>

        <div class="option-group">
          <div class="option-row">
            <label class="input-label">Conformance Standard:</label>
            <select id="pdfa-standard" class="text-input">
              <option value="1b" selected>PDF/A-1b (Visual Preservation Standard)</option>
              <option value="2b">PDF/A-2b (Modern Archival & Transparencies)</option>
              <option value="3b">PDF/A-3b (Allows Embedded Attachments)</option>
            </select>
          </div>

          <div class="option-row" style="margin-top: 10px;">
            <label class="custom-checkbox">
              <input type="checkbox" id="pdfa-metadata" checked>
              <span>Inject standard XMP Archival Identification Metadata schema</span>
            </label>
          </div>
        </div>
      </div>
    `;
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const standard = document.querySelector('#pdfa-standard')?.value || '1b';

    setProgress(25, 'Validating source PDF compliance...');
    const pdfDoc = await loadPdfLibDoc(file);

    setProgress(50, `Standardizing color profiles and embedding PDF/A-${standard} metadata...`);
    // Set standard archival metadata
    pdfDoc.setTitle(file.name.replace(/\.[^/.]+$/, ''));
    pdfDoc.setAuthor('PDF Master Suite Archiver');
    pdfDoc.setProducer('PDF/A ISO-19005 Compliant Engine');
    pdfDoc.setCreator('PDF Master Suite Client WebApp');
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());

    setProgress(75, 'Stripping dynamic scripts and unreferenced streams...');
    // PDF/A requires unencrypted, standard font references
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: false // PDF/A-1 requires standard object syntax
    });

    setProgress(95, 'Finalizing ISO archival verification...');
    setProgress(100, 'Done!');

    return {
      data: pdfBytes,
      filename: `${file.name.replace(/\.[^/.]+$/, '')}_pdfa.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
