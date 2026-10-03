import { jsPDF } from 'jspdf';
import { toast } from '../../utils/toast.js';

export const scanToPdfTool = {
  id: 'scan-to-pdf',
  stream: null,
  capturedPages: [], // array of data URLs

  renderOptions(container, files, onUpdate) {
    this.capturedPages = [];
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="camera"></i> Document Scanner Studio</h4>
        <p class="text-muted">Use your webcam/device camera or uploaded photos to capture pages and build a scanned PDF.</p>

        <div class="scanner-interface">
          <div class="camera-viewport-card">
            <video id="scanner-video" autoplay playsinline style="display:none; width: 100%; max-height: 280px; border-radius: 8px; background: #000; object-fit: contain;"></video>
            <canvas id="scanner-canvas" style="display:none;"></canvas>
            <div id="camera-placeholder" class="camera-placeholder">
              <i data-lucide="video"></i>
              <p>Camera is currently stopped</p>
              <button type="button" class="btn btn-primary" id="start-camera-btn">
                <i data-lucide="camera"></i> Start Camera Scanner
              </button>
            </div>
          </div>

          <div class="scanner-controls" style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary" id="capture-page-btn" disabled>
              <i data-lucide="disc"></i> Capture Page
            </button>
            <button type="button" class="btn btn-outline" id="stop-camera-btn" style="display:none;">
              Stop Camera
            </button>
            <label class="btn btn-outline file-upload-btn">
              <i data-lucide="upload"></i> Upload Photos
              <input type="file" id="scanner-photo-input" accept="image/*" multiple style="display:none;">
            </label>
          </div>

          <div class="filter-controls" style="margin-top: 15px;">
            <label class="input-label">Enhancement Filter:</label>
            <div class="filter-pills">
              <label><input type="radio" name="scanFilter" value="none" checked> Normal Color</label>
              <label><input type="radio" name="scanFilter" value="bw"> B&W High Contrast</label>
              <label><input type="radio" name="scanFilter" value="gray"> Grayscale Document</label>
            </div>
          </div>

          <div class="captured-pages-section" style="margin-top: 20px;">
            <h5>Scanned Pages (<span id="scanned-count">0</span>)</h5>
            <div class="scanned-grid" id="scanned-grid">
              <p class="text-muted small">No pages captured yet. Click "Capture Page" or upload photos.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    const video = container.querySelector('#scanner-video');
    const canvas = container.querySelector('#scanner-canvas');
    const placeholder = container.querySelector('#camera-placeholder');
    const startBtn = container.querySelector('#start-camera-btn');
    const captureBtn = container.querySelector('#capture-page-btn');
    const stopBtn = container.querySelector('#stop-camera-btn');
    const fileInput = container.querySelector('#scanner-photo-input');

    const startCamera = async () => {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        video.srcObject = this.stream;
        video.style.display = 'block';
        placeholder.style.display = 'none';
        captureBtn.disabled = false;
        stopBtn.style.display = 'inline-flex';
      } catch (err) {
        toast.error('Unable to access camera. Please check browser permissions.');
      }
    };

    const stopCamera = () => {
      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
      }
      video.style.display = 'none';
      placeholder.style.display = 'flex';
      captureBtn.disabled = true;
      stopBtn.style.display = 'none';
    };

    startBtn.addEventListener('click', startCamera);
    stopBtn.addEventListener('click', stopCamera);

    captureBtn.addEventListener('click', () => {
      if (!video.videoWidth) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      this.applyFilter(ctx, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      this.addCapturedPage(dataUrl, container);
    });

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      for (const f of files) {
        const url = await readFileAsDataUrl(f);
        this.addCapturedPage(url, container);
      }
    });

    // If pre-uploaded image files were provided
    if (files && files.length > 0) {
      files.forEach(async (f) => {
        if (f.type.startsWith('image/')) {
          const url = await readFileAsDataUrl(f);
          this.addCapturedPage(url, container);
        }
      });
    }
  },

  applyFilter(ctx, width, height) {
    const filter = document.querySelector('input[name="scanFilter"]:checked')?.value || 'none';
    if (filter === 'none') return;

    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (filter === 'bw') {
        // High-contrast threshold
        const v = gray > 140 ? 255 : 0;
        d[i] = v; d[i + 1] = v; d[i + 2] = v;
      } else if (filter === 'gray') {
        d[i] = gray; d[i + 1] = gray; d[i + 2] = gray;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  },

  addCapturedPage(dataUrl, container) {
    this.capturedPages.push(dataUrl);
    const countEl = container.querySelector('#scanned-count');
    if (countEl) countEl.innerText = this.capturedPages.length;

    const grid = container.querySelector('#scanned-grid');
    if (grid) {
      grid.innerHTML = this.capturedPages.map((url, i) => `
        <div class="scanned-thumb-item">
          <img src="${url}" alt="Page ${i + 1}"/>
          <span class="scanned-page-badge">${i + 1}</span>
        </div>
      `).join('');
    }
  },

  async process(files, options, setProgress) {
    if (this.capturedPages.length === 0) {
      throw new Error('Please capture or upload at least one page to generate the scanned PDF.');
    }

    setProgress(20, 'Initializing PDF creator...');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    const total = this.capturedPages.length;
    for (let i = 0; i < total; i++) {
      setProgress(20 + Math.round((i / total) * 70), `Compiling scanned page ${i + 1} of ${total}...`);
      if (i > 0) pdf.addPage('a4', 'portrait');

      const imgData = this.capturedPages[i];
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
      const w = imgProps.width * ratio;
      const h = imgProps.height * ratio;
      const x = (pdfWidth - w) / 2;
      const y = (pdfHeight - h) / 2;

      pdf.addImage(imgData, 'JPEG', x, y, w, h);
    }

    setProgress(95, 'Finalizing scanned document...');
    const pdfBlob = pdf.output('blob');

    // Clean up camera stream if active
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }

    setProgress(100, 'Done!');
    return {
      data: pdfBlob,
      filename: 'scanned_document.pdf',
      mimeType: 'application/pdf'
    };
  }
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
