import { PDFDocument, degrees } from 'pdf-lib';
import { loadPdfLibDoc, generatePageThumbnails } from '../../utils/pdfHelper.js';

export const organizePdfTool = {
  id: 'organize-pdf',
  pagesState: [], // [{ pageIndex: 0, rotation: 0, origThumb: url }]

  async renderOptions(container, files, onUpdate) {
    this.pagesState = [];
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="layout-dashboard"></i> Organize & Reorder Pages</h4>
        <p class="text-muted">Reorder, rotate, or delete individual pages directly in the visual organizer workspace.</p>
        <div class="pages-grid-loading" id="pages-loading">
          <div class="spinner"></div>
          <span>Rendering page thumbnails...</span>
        </div>
        <div class="organize-pages-grid" id="organize-grid" style="display:none;"></div>
      </div>
    `;

    try {
      const thumbs = await generatePageThumbnails(files[0]);
      this.pagesState = thumbs.map((t, i) => ({
        originalIndex: i,
        rotation: 0,
        thumbUrl: t.dataUrl,
        pageNumber: i + 1
      }));

      const loading = container.querySelector('#pages-loading');
      const grid = container.querySelector('#organize-grid');
      if (loading) loading.style.display = 'none';
      if (grid) {
        grid.style.display = 'grid';
        this.renderGrid(grid);
      }
    } catch (e) {
      console.error(e);
    }
  },

  renderGrid(grid) {
    grid.innerHTML = this.pagesState.map((p, idx) => `
      <div class="organize-card" data-idx="${idx}">
        <div class="organize-thumb-wrapper" style="transform: rotate(${p.rotation}deg);">
          <img src="${p.thumbUrl}" alt="Page" class="page-thumb-img"/>
        </div>
        <div class="organize-footer">
          <span class="organize-page-num">${idx + 1} (Orig ${p.pageNumber})</span>
          <div class="organize-actions">
            <button type="button" class="btn-icon rotate-btn" data-idx="${idx}" title="Rotate 90°"><i data-lucide="rotate-cw"></i></button>
            <button type="button" class="btn-icon move-left" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Move Left">&larr;</button>
            <button type="button" class="btn-icon move-right" data-idx="${idx}" ${idx === this.pagesState.length - 1 ? 'disabled' : ''} title="Move Right">&rarr;</button>
            <button type="button" class="btn-icon delete-btn text-danger" data-idx="${idx}" title="Delete Page"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      </div>
    `).join('');

    // Attach listeners
    grid.querySelectorAll('.rotate-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        this.pagesState[idx].rotation = (this.pagesState[idx].rotation + 90) % 360;
        this.renderGrid(grid);
      });
    });

    grid.querySelectorAll('.move-left').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        if (idx > 0) {
          const temp = this.pagesState[idx];
          this.pagesState[idx] = this.pagesState[idx - 1];
          this.pagesState[idx - 1] = temp;
          this.renderGrid(grid);
        }
      });
    });

    grid.querySelectorAll('.move-right').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        if (idx < this.pagesState.length - 1) {
          const temp = this.pagesState[idx];
          this.pagesState[idx] = this.pagesState[idx + 1];
          this.pagesState[idx + 1] = temp;
          this.renderGrid(grid);
        }
      });
    });

    grid.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        if (this.pagesState.length <= 1) {
          alert('Document must have at least one page.');
          return;
        }
        this.pagesState.splice(idx, 1);
        this.renderGrid(grid);
      });
    });
  },

  async process(files, options, setProgress) {
    const file = files[0];
    if (this.pagesState.length === 0) {
      throw new Error('No pages left in organized document.');
    }

    setProgress(20, 'Loading source document...');
    const srcDoc = await loadPdfLibDoc(file);
    const newDoc = await PDFDocument.create();

    const origIndices = this.pagesState.map(p => p.originalIndex);
    setProgress(50, 'Extracting and rearranging pages...');
    const copiedPages = await newDoc.copyPages(srcDoc, origIndices);

    copiedPages.forEach((page, i) => {
      const rot = this.pagesState[i].rotation;
      if (rot !== 0) {
        const currentRot = page.getRotation().angle;
        page.setRotation(degrees((currentRot + rot) % 360));
      }
      newDoc.addPage(page);
    });

    setProgress(85, 'Saving reorganized PDF...');
    const bytes = await newDoc.save();

    setProgress(100, 'Complete!');
    return {
      data: bytes,
      filename: `${file.name.replace(/\.pdf$/i, '')}_organized.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
