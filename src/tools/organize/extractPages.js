import { PDFDocument } from 'pdf-lib';
import { loadPdfLibDoc, generatePageThumbnails } from '../../utils/pdfHelper.js';

export const extractPagesTool = {
  id: 'extract-pages',
  selectedPages: new Set(),

  async renderOptions(container, files, onUpdate) {
    this.selectedPages.clear();
    // Pre-select first page by default
    this.selectedPages.add(1);

    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="file-symlink"></i> Select Pages to Extract</h4>
        <p class="text-muted">Click pages to select them. Selected (blue/green highlighted) pages will be extracted into a new PDF.</p>
        <div class="pages-grid-loading" id="pages-loading">
          <div class="spinner"></div>
          <span>Rendering page previews...</span>
        </div>
        <div class="pages-thumbnail-grid" id="pages-grid" style="display:none;"></div>
      </div>
    `;

    try {
      const thumbs = await generatePageThumbnails(files[0]);
      const loading = container.querySelector('#pages-loading');
      const grid = container.querySelector('#pages-grid');
      if (loading) loading.style.display = 'none';
      if (grid) {
        grid.style.display = 'grid';
        grid.innerHTML = thumbs.map(t => `
          <div class="page-thumb-card ${t.pageNumber === 1 ? 'marked-for-extraction' : ''}" data-page="${t.pageNumber}">
            <div class="page-thumb-wrapper">
              <img src="${t.dataUrl}" alt="Page ${t.pageNumber}" class="page-thumb-img"/>
              <div class="page-extract-badge"><i data-lucide="check"></i> Selected</div>
            </div>
            <span class="page-number-label">Page ${t.pageNumber}</span>
          </div>
        `).join('');

        grid.querySelectorAll('.page-thumb-card').forEach(card => {
          card.addEventListener('click', () => {
            const pageNum = parseInt(card.dataset.page);
            if (this.selectedPages.has(pageNum)) {
              if (this.selectedPages.size === 1) return; // keep at least 1
              this.selectedPages.delete(pageNum);
              card.classList.remove('marked-for-extraction');
            } else {
              this.selectedPages.add(pageNum);
              card.classList.add('marked-for-extraction');
            }
            if (typeof onUpdate === 'function') onUpdate(this.selectedPages);
          });
        });
      }
    } catch (e) {
      console.error(e);
    }
  },

  async process(files, options, setProgress) {
    const file = files[0];
    if (this.selectedPages.size === 0) {
      throw new Error('Please select at least one page to extract.');
    }

    setProgress(30, 'Loading source PDF...');
    const srcDoc = await loadPdfLibDoc(file);
    const newDoc = await PDFDocument.create();

    const sortedPages = Array.from(this.selectedPages).sort((a, b) => a - b).map(p => p - 1);
    setProgress(60, `Extracting ${sortedPages.length} pages...`);
    const copiedPages = await newDoc.copyPages(srcDoc, sortedPages);
    copiedPages.forEach(p => newDoc.addPage(p));

    setProgress(85, 'Assembling extracted document...');
    const bytes = await newDoc.save();

    setProgress(100, 'Done!');
    return {
      data: bytes,
      filename: `${file.name.replace(/\.pdf$/i, '')}_extracted.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
