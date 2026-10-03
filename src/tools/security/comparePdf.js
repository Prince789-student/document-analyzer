import { jsPDF } from 'jspdf';
import { comparePdfPages, loadPdfJsDoc } from '../../utils/pdfHelper.js';

export const comparePdfTool = {
  id: 'compare-pdf',
  activePage: 1,
  maxPages: 1,
  viewMode: 'split', // 'split' | 'overlay'

  async renderOptions(container, files, onUpdate) {
    if (files.length < 2) {
      container.innerHTML = `
        <div class="tool-options-panel" style="text-align: center; padding: 25px;">
          <i data-lucide="git-compare" style="width: 44px; height: 44px; color: #f59e0b; margin-bottom: 12px;"></i>
          <h4>Compare Two PDF Documents</h4>
          <p class="text-muted">Please upload <strong>2 PDF files</strong> to compare text, layouts, and alterations side-by-side.</p>
          <div style="margin-top: 15px;">
            <label class="btn-sm btn-primary" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <i data-lucide="plus"></i> Add Second PDF
              <input type="file" id="compare-add-file" accept=".pdf" style="display: none;">
            </label>
          </div>
        </div>
      `;

      container.querySelector('#compare-add-file')?.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          files.push(e.target.files[0]);
          onUpdate(files);
        }
      });
      return;
    }

    const docA = files[0];
    const docB = files[1];

    container.innerHTML = `
      <div class="tool-options-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 style="margin: 0;"><i data-lucide="git-compare"></i> Visual & Text Comparison Studio</h4>
            <span class="text-muted small"><strong>Doc A:</strong> ${docA.name} vs <strong>Doc B:</strong> ${docB.name}</span>
          </div>

          <div style="display: flex; gap: 8px; align-items: center;">
            <div class="tab-pill-group">
              <button type="button" class="tab-pill-btn active" data-view="split"><i data-lucide="columns-2"></i> Side-by-Side</button>
              <button type="button" class="tab-pill-btn" data-view="overlay"><i data-lucide="layers"></i> Changes Highlight</button>
            </div>
          </div>
        </div>

        <!-- Page Controls & Stats Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin: 14px 0 10px 0; background: var(--bg-surface); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <button type="button" class="btn-icon" id="cmp-prev-page" disabled>&larr;</button>
            <span class="small font-mono" id="cmp-page-label">Page 1</span>
            <button type="button" class="btn-icon" id="cmp-next-page">&rarr;</button>
          </div>

          <div id="diff-metrics-badge" style="display: flex; gap: 10px; font-size: 0.85rem;">
            <span class="badge" style="background: rgba(16,185,129,0.12); color: #10b981;">Analyzing differences...</span>
          </div>
        </div>

        <!-- Split View Container -->
        <div id="compare-view-split" class="compare-viewport-wrapper" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-height: 480px; overflow: auto; padding: 6px;">
          <div style="text-align: center; background: rgba(0,0,0,0.2); border-radius: 6px; padding: 10px;">
            <span class="small" style="font-weight: 600; color: #60a5fa; display: block; margin-bottom: 6px;">Original Document (A)</span>
            <div id="canvas-holder-a" style="overflow: auto;">
              <canvas id="cmp-canvas-a" style="max-width: 100%; box-shadow: 0 4px 12px rgba(0,0,0,0.2); border-radius: 4px; background: #ffffff;"></canvas>
            </div>
          </div>
          <div style="text-align: center; background: rgba(0,0,0,0.2); border-radius: 6px; padding: 10px;">
            <span class="small" style="font-weight: 600; color: #f59e0b; display: block; margin-bottom: 6px;">Modified Document (B)</span>
            <div id="canvas-holder-b" style="overflow: auto;">
              <canvas id="cmp-canvas-b" style="max-width: 100%; box-shadow: 0 4px 12px rgba(0,0,0,0.2); border-radius: 4px; background: #ffffff;"></canvas>
            </div>
          </div>
        </div>

        <!-- Overlay View Container -->
        <div id="compare-view-overlay" class="compare-viewport-wrapper" style="display: none; text-align: center; max-height: 480px; overflow: auto; padding: 12px; background: rgba(0,0,0,0.25); border-radius: 6px;">
          <div style="display: inline-flex; align-items: center; gap: 18px; margin-bottom: 10px; background: var(--bg-surface); padding: 6px 16px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; border: 1px solid var(--border-color);">
            <span style="color: #ef4444;"><span style="display: inline-block; width: 10px; height: 10px; background: #ef4444; border-radius: 50%; margin-right: 4px;"></span>Red: Removed / Only in Doc A</span>
            <span style="color: #10b981;"><span style="display: inline-block; width: 10px; height: 10px; background: #10b981; border-radius: 50%; margin-right: 4px;"></span>Green: Added / Only in Doc B</span>
            <span style="color: #94a3b8;"><span style="display: inline-block; width: 10px; height: 10px; background: #64748b; border-radius: 50%; margin-right: 4px;"></span>Grey: Unchanged</span>
          </div>
          <div style="overflow: auto;">
            <canvas id="cmp-canvas-diff" style="max-width: 92%; box-shadow: 0 4px 16px rgba(0,0,0,0.25); border-radius: 4px; background: #ffffff;"></canvas>
          </div>
        </div>

        <!-- Text Diff Highlights Drawer -->
        <div class="option-group" style="margin-top: 14px; border-top: 1px solid var(--border-color); padding-top: 10px;">
          <details>
            <summary style="cursor: pointer; font-weight: 600; color: var(--text-heading); font-size: 0.9rem;">
              Text Discrepancy Breakdown
            </summary>
            <div id="cmp-text-diff-content" style="margin-top: 10px; max-height: 140px; overflow: auto; background: var(--bg-surface); padding: 10px; border-radius: 6px; font-family: monospace; font-size: 0.8rem; line-height: 1.5;">
              Extracting textual differences...
            </div>
          </details>
        </div>
      </div>
    `;

    const canvasA = container.querySelector('#cmp-canvas-a');
    const canvasB = container.querySelector('#cmp-canvas-b');
    const canvasDiff = container.querySelector('#cmp-canvas-diff');
    const viewSplit = container.querySelector('#compare-view-split');
    const viewOverlay = container.querySelector('#compare-view-overlay');
    const prevBtn = container.querySelector('#cmp-prev-page');
    const nextBtn = container.querySelector('#cmp-next-page');
    const pageLabel = container.querySelector('#cmp-page-label');
    const metricsBadge = container.querySelector('#diff-metrics-badge');
    const textDiffContent = container.querySelector('#cmp-text-diff-content');

    let curPage = 1;

    const runComparison = async (pageNum) => {
      try {
        metricsBadge.innerHTML = `<span class="badge" style="background: rgba(99,102,241,0.15); color: #818cf8;">Comparing Page ${pageNum}...</span>`;
        const result = await comparePdfPages(docA, docB, pageNum);

        this.maxPages = Math.max(result.doc1Pages, result.doc2Pages);
        pageLabel.textContent = `Page ${pageNum} of ${this.maxPages}`;
        prevBtn.disabled = pageNum <= 1;
        nextBtn.disabled = pageNum >= this.maxPages;

        // Copy canvas A
        canvasA.width = result.canvas1.width;
        canvasA.height = result.canvas1.height;
        canvasA.getContext('2d').drawImage(result.canvas1, 0, 0);

        // Copy canvas B
        canvasB.width = result.canvas2.width;
        canvasB.height = result.canvas2.height;
        canvasB.getContext('2d').drawImage(result.canvas2, 0, 0);

        // Copy diff canvas
        canvasDiff.width = result.diffCanvas.width;
        canvasDiff.height = result.diffCanvas.height;
        canvasDiff.getContext('2d').drawImage(result.diffCanvas, 0, 0);

        // Compute text diff summary
        const wordsA = (result.text1 || '').split(/\s+/);
        const wordsB = (result.text2 || '').split(/\s+/);
        const diffWords = Math.abs(wordsA.length - wordsB.length);

        if (result.diffPercentage === 0 && result.text1 === result.text2) {
          metricsBadge.innerHTML = `<span class="badge" style="background: rgba(16,185,129,0.15); color: #10b981;">✓ Identical Page Content</span>`;
          textDiffContent.innerHTML = `<span style="color: #10b981;">No textual differences found on Page ${pageNum}.</span>`;
        } else {
          metricsBadge.innerHTML = `<span class="badge" style="background: rgba(239,68,68,0.15); color: #ef4444;">Differences Found (${result.diffPercentage}% altered, ~${diffWords} words diff)</span>`;
          textDiffContent.innerHTML = `
            <div style="color: #ef4444; margin-bottom: 4px;"><strong>Document A (${docA.name}):</strong></div>
            <div style="color: var(--text-muted); margin-bottom: 8px;">${escapeHtml(result.text1.slice(0, 300))}...</div>
            <div style="color: #10b981; margin-bottom: 4px;"><strong>Document B (${docB.name}):</strong></div>
            <div style="color: var(--text-muted);">${escapeHtml(result.text2.slice(0, 300))}...</div>
          `;
        }
      } catch (err) {
        console.error('Comparison error:', err);
        metricsBadge.innerHTML = `<span class="badge" style="background: rgba(239,68,68,0.15); color: #ef4444;">${escapeHtml(err.message || 'Comparison error')}</span>`;
      }
    };

    const escapeHtml = (str) => {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    // View toggle
    container.querySelectorAll('.tab-pill-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tab-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.dataset.view;
        this.viewMode = view;
        if (view === 'split') {
          viewSplit.style.display = 'grid';
          viewOverlay.style.display = 'none';
        } else {
          viewSplit.style.display = 'none';
          viewOverlay.style.display = 'block';
        }
      });
    });

    prevBtn.addEventListener('click', () => {
      if (curPage > 1) {
        curPage--;
        this.activePage = curPage;
        runComparison(curPage);
      }
    });

    nextBtn.addEventListener('click', () => {
      if (curPage < this.maxPages) {
        curPage++;
        this.activePage = curPage;
        runComparison(curPage);
      }
    });

    setTimeout(() => runComparison(1), 200);
  },

  async process(files, options, setProgress) {
    if (files.length < 2) {
      throw new Error('Please upload 2 PDF files to generate a comparison audit report.');
    }

    const docA = files[0];
    const docB = files[1];

    setProgress(15, 'Reading document structures and page counts...');
    const pdfJsA = await loadPdfJsDoc(docA);
    const pdfJsB = await loadPdfJsDoc(docB);
    const maxPages = Math.max(pdfJsA.numPages, pdfJsB.numPages);

    setProgress(25, 'Initializing high-fidelity landscape audit report...');
    // Landscape A4 (842 x 595 pt) offers the perfect 3-column side-by-side view
    const reportPdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = reportPdf.internal.pageSize.getWidth();  // ~842 pt
    const pageH = reportPdf.internal.pageSize.getHeight(); // ~595 pt

    // Cover / Executive Summary Page
    reportPdf.setFillColor(15, 23, 42); // Dark slate
    reportPdf.rect(0, 0, pageW, 90, 'F');
    reportPdf.setTextColor(255, 255, 255);
    reportPdf.setFontSize(22);
    reportPdf.text('PDF Comparison & Visual Audit Report', 40, 42);
    reportPdf.setFontSize(10);
    reportPdf.setTextColor(148, 163, 184);
    reportPdf.text(`Generated on ${new Date().toLocaleString()} | DocuMatrix Pro Audit Studio`, 40, 68);

    // Document Information Cards
    reportPdf.setFillColor(248, 250, 252);
    reportPdf.roundedRect(40, 110, 360, 95, 6, 6, 'F');
    reportPdf.setDrawColor(226, 232, 240);
    reportPdf.roundedRect(40, 110, 360, 95, 6, 6, 'D');

    reportPdf.setTextColor(30, 41, 59);
    reportPdf.setFontSize(12);
    reportPdf.text('Document A (Original Baseline):', 55, 132);
    reportPdf.setFontSize(10);
    reportPdf.setTextColor(71, 85, 105);
    reportPdf.text(`Filename: ${docA.name}`, 55, 152);
    reportPdf.text(`Size: ${(docA.size / (1024 * 1024)).toFixed(2)} MB  |  Pages: ${pdfJsA.numPages}`, 55, 170);
    reportPdf.text(`Status: Baseline reference document`, 55, 188);

    reportPdf.setFillColor(248, 250, 252);
    reportPdf.roundedRect(440, 110, 360, 95, 6, 6, 'F');
    reportPdf.roundedRect(440, 110, 360, 95, 6, 6, 'D');

    reportPdf.setTextColor(30, 41, 59);
    reportPdf.setFontSize(12);
    reportPdf.text('Document B (Modified Document):', 455, 132);
    reportPdf.setFontSize(10);
    reportPdf.setTextColor(71, 85, 105);
    reportPdf.text(`Filename: ${docB.name}`, 455, 152);
    reportPdf.text(`Size: ${(docB.size / (1024 * 1024)).toFixed(2)} MB  |  Pages: ${pdfJsB.numPages}`, 455, 170);
    reportPdf.text(`Status: Document evaluated for differences`, 455, 188);

    // Color Legend Bar
    reportPdf.setFillColor(241, 245, 249);
    reportPdf.roundedRect(40, 220, 760, 42, 6, 6, 'F');

    reportPdf.setFontSize(10);
    reportPdf.setTextColor(30, 41, 59);
    reportPdf.text('Audit Legend:', 55, 245);

    // Red dot & text
    reportPdf.setFillColor(239, 68, 68);
    reportPdf.circle(150, 241, 4, 'F');
    reportPdf.setTextColor(239, 68, 68);
    reportPdf.text('Red: Content in Doc A only (Removed / Altered)', 160, 245);

    // Green dot & text
    reportPdf.setFillColor(16, 185, 129);
    reportPdf.circle(440, 241, 4, 'F');
    reportPdf.setTextColor(16, 185, 129);
    reportPdf.text('Green: Content in Doc B only (Added)', 450, 245);

    // Grey dot & text
    reportPdf.setFillColor(100, 116, 139);
    reportPdf.circle(680, 241, 4, 'F');
    reportPdf.setTextColor(100, 116, 139);
    reportPdf.text('Grey: Identical content', 690, 245);

    // Summary instructions
    reportPdf.setTextColor(100, 116, 139);
    reportPdf.setFontSize(11);
    reportPdf.text('The following pages contain 3-panel comparative analysis: Original vs. Modified vs. Color-Highlighted Differences.', 40, 290);

    // Process page-by-page (comparing up to total pages)
    const pagesToCompare = Math.min(maxPages, 10);

    for (let i = 1; i <= pagesToCompare; i++) {
      setProgress(30 + Math.round((i / pagesToCompare) * 60), `Analyzing & rendering Page ${i} of ${pagesToCompare}...`);
      reportPdf.addPage('a4', 'landscape');

      const result = await comparePdfPages(docA, docB, i);

      // Page Header Bar
      reportPdf.setFillColor(15, 23, 42);
      reportPdf.rect(0, 0, pageW, 44, 'F');
      reportPdf.setTextColor(255, 255, 255);
      reportPdf.setFontSize(14);
      reportPdf.text(`Page ${i} Comparative Audit Analysis`, 30, 28);

      reportPdf.setFontSize(9);
      reportPdf.setTextColor(148, 163, 184);
      reportPdf.text(`Diff: ${result.diffPercentage}% pixels altered  |  Doc A: ${docA.name}  vs  Doc B: ${docB.name}`, 350, 28);

      // 3 Columns Layout:
      // Col 1: Doc A (Original)
      // Col 2: Doc B (Modified)
      // Col 3: Highlighted Difference Map
      const marginX = 30;
      const colGap = 16;
      const colWidth = (pageW - marginX * 2 - colGap * 2) / 3; // ~244 pt
      const colHeight = 440; // available height
      const contentY = 65;

      // Titles above each column
      reportPdf.setFontSize(11);
      reportPdf.setTextColor(37, 99, 235); // Blue
      reportPdf.text('Original Document (A)', marginX, contentY);

      reportPdf.setTextColor(217, 119, 6); // Amber
      reportPdf.text('Modified Document (B)', marginX + colWidth + colGap, contentY);

      reportPdf.setTextColor(219, 39, 119); // Magenta
      reportPdf.text('Detected Differences (Red/Green)', marginX + (colWidth + colGap) * 2, contentY);

      // Capture high-res white-background images
      const imgA = result.canvas1.toDataURL('image/jpeg', 0.9);
      const imgB = result.canvas2.toDataURL('image/jpeg', 0.9);
      const imgDiff = result.diffCanvas.toDataURL('image/jpeg', 0.9);

      // Compute scaled height keeping aspect ratio
      const aspectA = result.canvas1.height / result.canvas1.width;
      const aspectB = result.canvas2.height / result.canvas2.width;
      const aspectDiff = result.diffCanvas.height / result.diffCanvas.width;

      const drawH_A = Math.min(colHeight, colWidth * aspectA);
      const drawH_B = Math.min(colHeight, colWidth * aspectB);
      const drawH_Diff = Math.min(colHeight, colWidth * aspectDiff);

      const imgY = contentY + 10;

      // Draw background borders for each image
      reportPdf.setDrawColor(226, 232, 240);
      reportPdf.rect(marginX - 2, imgY - 2, colWidth + 4, drawH_A + 4);
      reportPdf.addImage(imgA, 'JPEG', marginX, imgY, colWidth, drawH_A);

      reportPdf.rect(marginX + colWidth + colGap - 2, imgY - 2, colWidth + 4, drawH_B + 4);
      reportPdf.addImage(imgB, 'JPEG', marginX + colWidth + colGap, imgY, colWidth, drawH_B);

      reportPdf.rect(marginX + (colWidth + colGap) * 2 - 2, imgY - 2, colWidth + 4, drawH_Diff + 4);
      reportPdf.addImage(imgDiff, 'JPEG', marginX + (colWidth + colGap) * 2, imgY, colWidth, drawH_Diff);

      // Footer line
      reportPdf.setFontSize(8);
      reportPdf.setTextColor(148, 163, 184);
      reportPdf.text(`DocuMatrix Pro Audit Studio  |  Page ${i + 1} of ${pagesToCompare + 1}`, 30, pageH - 12);
    }

    setProgress(95, 'Finalizing comparison report bundle...');
    const reportBytes = reportPdf.output('arraybuffer');

    setProgress(100, 'Comparison report generated successfully!');
    return {
      data: reportBytes,
      filename: `comparison_report_${docA.name.replace(/\.pdf$/i, '')}_vs_${docB.name.replace(/\.pdf$/i, '')}.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
