import { PDFDocument } from 'pdf-lib';
import { loadPdfLibDoc, generatePageThumbnails } from '../../utils/pdfHelper.js';

export const removePagesTool = {
  id: 'remove-pages',
  selectedPages: new Set(),

  async renderOptions(container, files, onUpdate) {
    this.selectedPages.clear();
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="trash-2"></i> Select Pages to Remove</h4>
        <p class="text-muted">Click any page to toggle deletion. Red-highlighted pages will be removed.</p>
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
          <div class="page-thumb-card" data-page="${t.pageNumber}">
            <div class="page-thumb-wrapper">
              <img src="${t.dataUrl}" alt="Page ${t.pageNumber}" class="page-thumb-img"/>
              <div class="page-overlay-badge"><i data-lucide="trash-2"></i> Delete</div>
            </div>
            <span class="page-number-label">Page ${t.pageNumber}</span>
          </div>
        `).join('');

        grid.querySelectorAll('.page-thumb-card').forEach(card => {
          card.addEventListener('click', () => {
            const pageNum = parseInt(card.dataset.page);
            if (this.selectedPages.has(pageNum)) {
              this.selectedPages.delete(pageNum);
              card.classList.remove('marked-for-deletion');
            } else {
              this.selectedPages.add(pageNum);
              card.classList.add('marked-for-deletion');
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
      throw new Error('Please select at least one page to delete by clicking on its thumbnail.');
    }

    setProgress(25, 'Loading original PDF...');
    const srcDoc = await loadPdfLibDoc(file);
    const totalPages = srcDoc.getPageCount();

    if (this.selectedPages.size >= totalPages) {
      throw new Error('Cannot delete all pages of the document. Keep at least one page.');
    }

    setProgress(50, 'Removing selected pages...');
    // Delete in descending order so indices don't shift
    const sortedDesc = Array.from(this.selectedPages).map(p => p - 1).sort((a, b) => b - a);
    for (const idx of sortedDesc) {
      srcDoc.removePage(idx);
    }

    setProgress(85, 'Saving revised PDF...');
    const bytes = await srcDoc.save();

    setProgress(100, 'Done!');
    return {
      data: bytes,
      filename: `${file.name.replace(/\.pdf$/i, '')}_pages_removed.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
