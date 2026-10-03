import { PDFDocument } from 'pdf-lib';
import { loadPdfJsDoc, renderPageToCanvas } from '../../utils/pdfHelper.js';
import { jsPDF } from 'jspdf';

export const unlockPdfTool = {
  id: 'unlock-pdf',
  renderOptions(container, files, onUpdate) {
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="unlock"></i> Unlock & Decrypt PDF</h4>
        <p class="text-muted">Document: <strong>${files[0].name}</strong></p>

        <div class="option-group">
          <div class="option-row">
            <label class="input-label">Document Password (if encrypted):</label>
            <input type="password" id="unlock-password" class="text-input" placeholder="Enter password or leave blank if known">
            <small class="text-muted">Will remove opening lock, printing blocks, and editing restrictions.</small>
          </div>
        </div>
      </div>
    `;
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const password = document.querySelector('#unlock-password')?.value || '';

    setProgress(25, 'Testing document encryption headers...');
    const arrayBuffer = await file.arrayBuffer();

    let unlockedBytes;
    try {
      // Attempt load
      const pdfDoc = await PDFDocument.load(arrayBuffer, {
        password: password || undefined,
        ignoreEncryption: false
      });

      setProgress(60, 'Removing access permissions and restriction dictionaries...');
      // Saving without encryption options creates an unlocked PDF
      unlockedBytes = await pdfDoc.save();
    } catch (err) {
      // If pdf-lib standard load fails, try rendering pages via PDF.js with password then rebuilding
      setProgress(50, 'Re-synthesizing unprotected vector pages...');
      try {
        const loadingTask = (await import('pdfjs-dist')).getDocument({
          data: arrayBuffer,
          password: password
        });
        const pdfJsDoc = await loadingTask.promise;
        const outPdf = new jsPDF();

        for (let i = 1; i <= pdfJsDoc.numPages; i++) {
          setProgress(50 + Math.round((i / pdfJsDoc.numPages) * 40), `Decrypting page ${i}...`);
          if (i > 1) outPdf.addPage();
          const canvas = document.createElement('canvas');
          await renderPageToCanvas(pdfJsDoc, i, canvas, 1.5);
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const w = outPdf.internal.pageSize.getWidth();
          const h = outPdf.internal.pageSize.getHeight();
          outPdf.addImage(imgData, 'JPEG', 0, 0, w, h);
        }
        unlockedBytes = outPdf.output('arraybuffer');
      } catch (innerErr) {
        throw new Error('Incorrect password or unable to decrypt this document.');
      }
    }

    setProgress(95, 'Finalizing unrestricted PDF...');
    setProgress(100, 'Unlocked successfully!');

    return {
      data: unlockedBytes,
      filename: `${file.name.replace(/\.pdf$/i, '')}_unlocked.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
