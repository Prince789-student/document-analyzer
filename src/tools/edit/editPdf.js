import { PDFDocument } from 'pdf-lib';
import { loadPdfLibDoc, loadPdfJsDoc, renderPageToCanvas } from '../../utils/pdfHelper.js';

export const editPdfTool = {
  id: 'edit-pdf',
  activeTool: 'pen',
  activeColor: '#ef4444',
  lineWidth: 3,
  isDrawing: false,

  async renderOptions(container, files, onUpdate) {
    this.activeTool = 'pen';
    this.activeColor = '#ef4444';
    this.lineWidth = 3;

    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="edit-3"></i> PDF Annotation Studio</h4>
        <p class="text-muted">Draw freehand notes, highlight text, add boxes, or type custom annotations.</p>

        <div class="canvas-toolbar">
          <div class="toolbar-group">
            <button type="button" class="tool-btn active" data-tool="pen" title="Freehand Pen"><i data-lucide="pen-tool"></i> Pen</button>
            <button type="button" class="tool-btn" data-tool="highlighter" title="Text Highlighter"><i data-lucide="highlighter"></i> Highlight</button>
            <button type="button" class="tool-btn" data-tool="rect" title="Rectangle Box"><i data-lucide="square"></i> Box</button>
            <button type="button" class="tool-btn" data-tool="text" title="Text Label"><i data-lucide="type"></i> Text</button>
          </div>

          <div class="toolbar-group">
            <label class="color-picker-label">
              <span>Color:</span>
              <input type="color" id="editor-color" value="#ef4444">
            </label>
            <button type="button" class="tool-btn" id="clear-canvas-btn" title="Clear Annotations"><i data-lucide="rotate-ccw"></i> Clear</button>
          </div>
        </div>

        <div class="canvas-viewport-container" style="margin-top: 15px; position: relative; overflow: auto; text-align: center;">
          <div id="canvas-stack" style="position: relative; display: inline-block; box-shadow: 0 4px 15px rgba(0,0,0,0.2); border-radius: 4px;">
            <canvas id="pdf-base-canvas" style="display: block;"></canvas>
            <canvas id="pdf-draw-canvas" style="position: absolute; top: 0; left: 0; cursor: crosshair;"></canvas>
          </div>
        </div>
      </div>
    `;

    const baseCanvas = container.querySelector('#pdf-base-canvas');
    const drawCanvas = container.querySelector('#pdf-draw-canvas');

    try {
      const pdfJs = await loadPdfJsDoc(files[0]);
      await renderPageToCanvas(pdfJs, 1, baseCanvas, 1.2);
      drawCanvas.width = baseCanvas.width;
      drawCanvas.height = baseCanvas.height;
    } catch (e) {
      console.error(e);
    }

    const ctx = drawCanvas.getContext('2d');
    let startX = 0;
    let startY = 0;
    let snapshot = null;

    // Tool switching
    container.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTool = btn.dataset.tool;
      });
    });

    const colorPicker = container.querySelector('#editor-color');
    colorPicker.addEventListener('change', () => {
      this.activeColor = colorPicker.value;
    });

    container.querySelector('#clear-canvas-btn').addEventListener('click', () => {
      ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    });

    const getPos = (e) => {
      const rect = drawCanvas.getBoundingClientRect();
      const scaleX = drawCanvas.width / rect.width;
      const scaleY = drawCanvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    drawCanvas.addEventListener('mousedown', (e) => {
      const pos = getPos(e);
      startX = pos.x;
      startY = pos.y;
      this.isDrawing = true;

      if (this.activeTool === 'pen') {
        ctx.strokeStyle = this.activeColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
      } else if (this.activeTool === 'highlighter') {
        ctx.strokeStyle = this.activeColor + '55'; // translucent
        ctx.lineWidth = 18;
        ctx.lineCap = 'square';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
      } else if (this.activeTool === 'rect') {
        snapshot = ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
      } else if (this.activeTool === 'text') {
        const text = prompt('Enter annotation text:');
        if (text) {
          ctx.fillStyle = this.activeColor;
          ctx.font = 'bold 20px sans-serif';
          ctx.fillText(text, startX, startY);
        }
        this.isDrawing = false;
      }
    });

    drawCanvas.addEventListener('mousemove', (e) => {
      if (!this.isDrawing) return;
      const pos = getPos(e);

      if (this.activeTool === 'pen' || this.activeTool === 'highlighter') {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (this.activeTool === 'rect' && snapshot) {
        ctx.putImageData(snapshot, 0, 0);
        ctx.strokeStyle = this.activeColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
      }
    });

    const stopDrawing = () => {
      if (this.isDrawing) {
        this.isDrawing = false;
        snapshot = null;
      }
    };

    drawCanvas.addEventListener('mouseup', stopDrawing);
    drawCanvas.addEventListener('mouseleave', stopDrawing);
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const drawCanvas = document.querySelector('#pdf-draw-canvas');

    setProgress(25, 'Capturing layer annotations...');
    const annotationDataUrl = drawCanvas.toDataURL('image/png');

    setProgress(50, 'Loading original PDF in pdf-lib...');
    const pdfDoc = await loadPdfLibDoc(file);
    const firstPage = pdfDoc.getPages()[0];
    const { width, height } = firstPage.getSize();

    setProgress(75, 'Embedding and compositing drawing layer...');
    const annotPng = await pdfDoc.embedPng(annotationDataUrl);

    firstPage.drawImage(annotPng, {
      x: 0,
      y: 0,
      width: width,
      height: height
    });

    setProgress(90, 'Saving annotated PDF...');
    const bytes = await pdfDoc.save();

    setProgress(100, 'Complete!');
    return {
      data: bytes,
      filename: `${file.name.replace(/\.pdf$/i, '')}_edited.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
