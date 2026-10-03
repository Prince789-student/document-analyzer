import { PDFDocument } from 'pdf-lib';
import { loadPdfLibDoc } from '../../utils/pdfHelper.js';

export const mergePdfTool = {
  id: 'merge-pdf',
  renderOptions(container, files, onUpdate) {
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="layers"></i> Merge Configuration</h4>
        <p class="text-muted">Drag or use the up/down buttons to reorder files before combining.</p>
        <div class="file-order-list" id="merge-file-list">
          ${files.map((f, i) => `
            <div class="file-order-item" data-index="${i}">
              <span class="drag-handle"><i data-lucide="grip-vertical"></i></span>
              <span class="file-badge">${i + 1}</span>
              <span class="file-name">${f.name}</span>
              <span class="file-size">${(f.size / 1024).toFixed(1)} KB</span>
              <div class="file-order-actions">
                <button type="button" class="btn-icon move-up" data-idx="${i}" ${i === 0 ? 'disabled' : ''} title="Move Up">&uarr;</button>
                <button type="button" class="btn-icon move-down" data-idx="${i}" ${i === files.length - 1 ? 'disabled' : ''} title="Move Down">&darr;</button>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="option-row" style="margin-top: 15px;">
          <label class="custom-checkbox">
            <input type="checkbox" id="merge-bookmarks" checked>
            <span>Retain document metadata and outline</span>
          </label>
        </div>
      </div>
    `;

    // Hook up reorder buttons
    container.querySelectorAll('.move-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        if (idx > 0) {
          const temp = files[idx];
          files[idx] = files[idx - 1];
          files[idx - 1] = temp;
          onUpdate(files);
        }
      });
    });

    container.querySelectorAll('.move-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        if (idx < files.length - 1) {
          const temp = files[idx];
          files[idx] = files[idx + 1];
          files[idx + 1] = temp;
          onUpdate(files);
        }
      });
    });
  },

  async process(files, options, setProgress) {
    if (!files || files.length < 2) {
      throw new Error('Please upload at least 2 PDF files to merge.');
    }

    setProgress(15, 'Initializing merged document...');
    const mergedDoc = await PDFDocument.create();

    const total = files.length;
    for (let i = 0; i < total; i++) {
      const file = files[i];
      setProgress(15 + Math.round((i / total) * 70), `Merging "${file.name}" (${i + 1} of ${total})...`);
      
      const docToMerge = await loadPdfLibDoc(file);
      const copiedPages = await mergedDoc.copyPages(docToMerge, docToMerge.getPageIndices());
      copiedPages.forEach(page => mergedDoc.addPage(page));
    }

    setProgress(90, 'Finalizing and compressing PDF...');
    const mergedPdfBytes = await mergedDoc.save();

    setProgress(100, 'Complete!');
    return {
      data: mergedPdfBytes,
      filename: 'merged_document.pdf',
      mimeType: 'application/pdf'
    };
  }
};
