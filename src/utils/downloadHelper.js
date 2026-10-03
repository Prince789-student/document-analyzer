import confetti from 'canvas-confetti';
import { toast } from './toast.js';

export function downloadFile(data, filename, mimeType = 'application/pdf') {
  try {
    let blob;
    if (data instanceof Blob) {
      blob = data;
    } else if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      blob = new Blob([data], { type: mimeType });
    } else if (typeof data === 'string' && data.startsWith('data:')) {
      const parts = data.split(';base64,');
      const contentType = parts[0].split(':')[1];
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }
      blob = new Blob([uInt8Array], { type: contentType });
    } else if (typeof data === 'string') {
      blob = new Blob([data], { type: mimeType });
    } else {
      throw new Error('Unsupported data format for download');
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Trigger celebration confetti
    triggerConfetti();
    toast.success(`Successfully generated "${filename}" (${formatFileSize(blob.size)})`);

    // Record in history
    saveToHistory(filename, blob.size);
  } catch (err) {
    console.error('Download failed:', err);
    toast.error('Failed to download file: ' + err.message);
  }
}

export function triggerConfetti() {
  try {
    confetti({
      particleCount: 65,
      spread: 70,
      origin: { y: 0.75 },
      colors: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6']
    });
  } catch (e) {
    // Ignore if canvas-confetti is not loaded
  }
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function saveToHistory(filename, size) {
  try {
    const history = JSON.parse(localStorage.getItem('pdf_suite_history') || '[]');
    history.unshift({
      id: Date.now(),
      filename,
      size: formatFileSize(size),
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    // Keep last 15 items
    localStorage.setItem('pdf_suite_history', JSON.stringify(history.slice(0, 15)));
  } catch (e) {
    // Ignore storage issues
  }
}
