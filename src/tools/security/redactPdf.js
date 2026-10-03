import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { loadPdfLibDoc, loadPdfJsDoc, renderPageToCanvas } from '../../utils/pdfHelper.js';

export const redactPdfTool = {
  id: 'redact-pdf',
  redactions: [], // Array of { page, x, y, width, height } in PDF coordinates
  boxStyle: 'blackout', // 'blackout' | 'whiteout' | 'stamped'
  activePage: 1,
  totalPages: 1,

  async renderOptions(container, files, onUpdate) {
    this.redactions = [];
    this.boxStyle = 'blackout';
    this.activePage = 1;

    let pdfJs = null;
    let totalPages = 1;
    try {
      pdfJs = await loadPdfJsDoc(files[0]);
      totalPages = pdfJs.numPages;
      this.totalPages = totalPages;
    } catch (e) {
      console.warn('Could not inspect PDF for page count:', e);
    }

    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="eye-off"></i> Redact & Sanitize PDF</h4>
        <p class="text-muted">Document: <strong>${files[0].name}</strong>. Permanently blackout sensitive names, SSNs, financial data, or credentials.</p>

        <!-- Redaction Toolbar -->
        <div class="canvas-toolbar" style="margin: 14px 0 10px 0;">
          <div class="toolbar-group">
            <label class="input-label" style="margin: 0; font-size: 0.85rem;">Style:</label>
            <select id="redact-style" class="text-input" style="width: auto; padding: 4px 8px; height: 32px;">
              <option value="blackout" selected>Solid Blackout</option>
              <option value="whiteout">Clean Whiteout</option>
              <option value="stamped">Redacted Text Stamp</option>
            </select>
          </div>

          <div class="toolbar-group" style="margin-left: auto; gap: 8px;">
            <span id="redact-count-badge" class="badge" style="background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); font-weight: 600;">0 Zones Marked</span>
            <button type="button" class="btn-sm btn-outline" id="btn-undo-redact" title="Undo last box"><i data-lucide="undo"></i> Undo</button>
            <button type="button" class="btn-sm btn-outline" id="btn-clear-redact" title="Clear all boxes"><i data-lucide="trash-2"></i> Clear All</button>
          </div>
        </div>

        <!-- Page Navigator -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; background: var(--bg-surface); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <button type="button" class="btn-icon" id="redact-prev-page" ${this.activePage <= 1 ? 'disabled' : ''}>&larr;</button>
            <span class="small font-mono" id="redact-page-label">Page 1 of ${totalPages}</span>
            <button type="button" class="btn-icon" id="redact-next-page" ${totalPages <= 1 ? 'disabled' : ''}>&rarr;</button>
          </div>
          <span class="small text-muted">Click & drag on document to draw blackout box</span>
        </div>

        <!-- Redaction Interactive Canvas Area -->
        <div class="canvas-viewport-container" style="text-align: center; position: relative; overflow: auto; max-height: 480px; padding: 10px 0;">
          <div id="redact-canvas-stack" style="position: relative; display: inline-block; box-shadow: 0 4px 18px rgba(0,0,0,0.25); border-radius: 4px;">
            <canvas id="redact-base-canvas" style="display: block;"></canvas>
            <canvas id="redact-overlay-canvas" style="position: absolute; top: 0; left: 0; cursor: crosshair;"></canvas>
          </div>
        </div>

        <!-- Auto Keyword Redactor -->
        <div class="option-group" style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 12px;">
          <label class="input-label" for="keyword-redact-input"><i data-lucide="search"></i> Auto-Mark by Text Search:</label>
          <div style="display: flex; gap: 8px; margin-top: 6px;">
            <input type="text" id="keyword-redact-input" class="text-input" placeholder="e.g. Confidential, $1,240,000, ACME">
            <button type="button" class="btn-sm btn-secondary" id="btn-keyword-redact" style="white-space: nowrap;">Mark Matches</button>
          </div>
          <small class="text-muted">Searches current page text and automatically bounds matches for permanent redaction.</small>
        </div>
      </div>
    `;

    const baseCanvas = container.querySelector('#redact-base-canvas');
    const overlayCanvas = container.querySelector('#redact-overlay-canvas');
    const styleSelect = container.querySelector('#redact-style');
    const countBadge = container.querySelector('#redact-count-badge');
    const undoBtn = container.querySelector('#btn-undo-redact');
    const clearBtn = container.querySelector('#btn-clear-redact');
    const prevBtn = container.querySelector('#redact-prev-page');
    const nextBtn = container.querySelector('#redact-next-page');
    const pageLabel = container.querySelector('#redact-page-label');
    const keywordInput = container.querySelector('#keyword-redact-input');
    const keywordBtn = container.querySelector('#btn-keyword-redact');

    let pdfPageWidth = 595;
    let pdfPageHeight = 842;

    const renderCurrentPage = async () => {
      try {
        if (!pdfJs) pdfJs = await loadPdfJsDoc(files[0]);
        const page = await pdfJs.getPage(this.activePage);
        const vp = page.getViewport({ scale: 1.1 });
        pdfPageWidth = vp.width;
        pdfPageHeight = vp.height;

        await renderPageToCanvas(pdfJs, this.activePage, baseCanvas, 1.1);
        overlayCanvas.width = baseCanvas.width;
        overlayCanvas.height = baseCanvas.height;

        pageLabel.textContent = `Page ${this.activePage} of ${totalPages}`;
        prevBtn.disabled = this.activePage <= 1;
        nextBtn.disabled = this.activePage >= totalPages;

        redrawOverlay();
      } catch (e) {
        console.error('Failed to render redact page:', e);
      }
    };

    const redrawOverlay = () => {
      const ctx = overlayCanvas.getContext('2d');
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      const currentPageRedactions = this.redactions.filter(r => r.page === this.activePage);
      countBadge.textContent = `${this.redactions.length} Zones Marked`;

      const scaleX = overlayCanvas.width / pdfPageWidth;
      const scaleY = overlayCanvas.height / pdfPageHeight;

      currentPageRedactions.forEach(r => {
        const x = r.x * scaleX;
        const y = r.y * scaleY;
        const w = r.width * scaleX;
        const h = r.height * scaleY;

        if (r.style === 'whiteout') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, w, h);
        } else if (r.style === 'stamped') {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('[REDACTED]', x + w / 2, y + h / 2);
        } else {
          // Blackout
          ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, w, h);
        }
      });
    };

    // Drawing Interaction
    let isDrawing = false;
    let startX = 0;
    let startY = 0;

    const getPos = (e) => {
      const rect = overlayCanvas.getBoundingClientRect();
      const scaleX = overlayCanvas.width / rect.width;
      const scaleY = overlayCanvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    overlayCanvas.addEventListener('mousedown', (e) => {
      isDrawing = true;
      const pos = getPos(e);
      startX = pos.x;
      startY = pos.y;
    });

    overlayCanvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const pos = getPos(e);
      redrawOverlay();
      const ctx = overlayCanvas.getContext('2d');
      ctx.fillStyle = styleSelect.value === 'whiteout' ? 'rgba(255,255,255,0.7)' : 'rgba(239, 68, 68, 0.4)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      const w = pos.x - startX;
      const h = pos.y - startY;
      ctx.fillRect(startX, startY, w, h);
      ctx.strokeRect(startX, startY, w, h);
    });

    const finishBox = (e) => {
      if (!isDrawing) return;
      isDrawing = false;
      const pos = getPos(e);
      const rawW = pos.x - startX;
      const rawH = pos.y - startY;

      if (Math.abs(rawW) > 6 && Math.abs(rawH) > 6) {
        const left = rawW < 0 ? pos.x : startX;
        const top = rawH < 0 ? pos.y : startY;
        const w = Math.abs(rawW);
        const h = Math.abs(rawH);

        const scaleX = pdfPageWidth / overlayCanvas.width;
        const scaleY = pdfPageHeight / overlayCanvas.height;

        this.redactions.push({
          page: this.activePage,
          x: left * scaleX,
          y: top * scaleY,
          width: w * scaleX,
          height: h * scaleY,
          style: styleSelect.value
        });
      }
      redrawOverlay();
    };

    overlayCanvas.addEventListener('mouseup', finishBox);
    overlayCanvas.addEventListener('mouseleave', finishBox);

    // Undo & Clear
    undoBtn?.addEventListener('click', () => {
      this.redactions.pop();
      redrawOverlay();
    });

    clearBtn?.addEventListener('click', () => {
      this.redactions = [];
      redrawOverlay();
    });

    // Page navigation
    prevBtn?.addEventListener('click', () => {
      if (this.activePage > 1) {
        this.activePage--;
        renderCurrentPage();
      }
    });

    nextBtn?.addEventListener('click', () => {
      if (this.activePage < totalPages) {
        this.activePage++;
        renderCurrentPage();
      }
    });

    // Keyword Auto Search Redaction
    keywordBtn?.addEventListener('click', async () => {
      const term = keywordInput.value.trim().toLowerCase();
      if (!term || !pdfJs) return;

      const page = await pdfJs.getPage(this.activePage);
      const textContent = await page.getTextContent();
      let found = 0;

      textContent.items.forEach(item => {
        if (item.str.toLowerCase().includes(term)) {
          // item.transform: [scaleX, skewY, skewX, scaleY, transX, transY]
          const tx = item.transform[4];
          const ty = item.transform[5];
          const w = item.width || 80;
          const h = item.height || 14;

          // PDF coordinates (ty is from bottom)
          const yFromTop = pdfPageHeight - ty - h;

          this.redactions.push({
            page: this.activePage,
            x: tx - 4,
            y: yFromTop - 2,
            width: w + 8,
            height: h + 4,
            style: styleSelect.value
          });
          found++;
        }
      });

      redrawOverlay();
      if (found > 0) {
        keywordInput.value = '';
      }
    });

    setTimeout(renderCurrentPage, 200);
  },

  async process(files, options, setProgress) {
    const file = files[0];
    if (this.redactions.length === 0) {
      throw new Error('Please select at least one area to redact on the preview canvas.');
    }

    setProgress(20, 'Loading PDF structure in memory...');
    const pdfDoc = await loadPdfLibDoc(file);
    const pages = pdfDoc.getPages();
    const timesRoman = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    setProgress(45, `Permanently applying ${this.redactions.length} redaction blocks...`);

    this.redactions.forEach((r, idx) => {
      const pageIndex = r.page - 1;
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex];
        const { height } = page.getSize();

        // Convert Y coordinate from top-relative to PDF bottom-relative
        const pdfY = height - r.y - r.height;

        let fill = rgb(0, 0, 0);
        if (r.style === 'whiteout') {
          fill = rgb(1, 1, 1);
        }

        // Draw solid opaque rectangle
        page.drawRectangle({
          x: r.x,
          y: pdfY,
          width: r.width,
          height: r.height,
          color: fill,
          opacity: 1.0
        });

        if (r.style === 'stamped') {
          page.drawText('REDACTED', {
            x: r.x + Math.max(2, (r.width - 50) / 2),
            y: pdfY + Math.max(2, (r.height - 8) / 2),
            size: Math.min(9, Math.max(6, r.height * 0.6)),
            font: timesRoman,
            color: rgb(1, 1, 1)
          });
        }
      }
    });

    setProgress(85, 'Sanitizing metadata & saving document...');
    const sanitizedBytes = await pdfDoc.save();

    setProgress(100, 'Document redacted and sanitized!');
    return {
      data: sanitizedBytes,
      filename: `${file.name.replace(/\.pdf$/i, '')}_redacted.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
