import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';

// Ensure PDF.js worker is properly configured matching installed pdfjs-dist
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}


/**
 * Loads a PDF.js DocumentProxy from a File or ArrayBuffer
 */
export async function loadPdfJsDoc(fileOrBuffer, options = {}) {
  let arrayBuffer;
  if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, ...options });
  return await loadingTask.promise;
}

/**
 * Loads a pdf-lib PDFDocument from a File or ArrayBuffer
 */
export async function loadPdfLibDoc(fileOrBuffer, options = {}) {
  let arrayBuffer;
  if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }
  return await PDFDocument.load(arrayBuffer, { ignoreEncryption: true, ...options });
}

/**
 * Renders a specific page onto an HTML5 canvas
 */
export async function renderPageToCanvas(pdfJsDoc, pageNum, canvas, scale = 1.0) {
  const page = await pdfJsDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  // Fill canvas with white background so transparency doesn't render black
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport
  };

  await page.render(renderContext).promise;
  return canvas;
}


/**
 * Extracts plain text from all pages of a PDF
 */
export async function extractTextFromPdf(fileOrBuffer) {
  const pdfJsDoc = await loadPdfJsDoc(fileOrBuffer);
  const totalPages = pdfJsDoc.numPages;
  const pagesText = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdfJsDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageStrings = textContent.items.map(item => item.str).join(' ');
    pagesText.push({ page: i, text: pageStrings });
  }

  return {
    numPages: totalPages,
    pages: pagesText,
    fullText: pagesText.map(p => `--- Page ${p.page} ---\n${p.text}`).join('\n\n')
  };
}

/**
 * Generates a high-definition first page thumbnail for any file (PDF, Image, etc.)
 */
export async function generateFirstPageThumbnail(fileOrBuffer, maxDimension = 600) {
  if (!fileOrBuffer) return null;
  if (fileOrBuffer._cachedThumb) return fileOrBuffer._cachedThumb;

  // If it's a native image file, return object URL directly
  if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
    if (fileOrBuffer.type && fileOrBuffer.type.startsWith('image/')) {
      const url = URL.createObjectURL(fileOrBuffer);
      fileOrBuffer._cachedThumb = url;
      return url;
    }
  }

  try {
    const pdfJsDoc = await loadPdfJsDoc(fileOrBuffer);
    if (!pdfJsDoc || pdfJsDoc.numPages === 0) return null;

    const page = await pdfJsDoc.getPage(1);
    const defaultViewport = page.getViewport({ scale: 1.0 });

    // High resolution scale factor (at least 1.6x for razor-sharp text and graphics)
    const scale = Math.max(1.6, Math.min(maxDimension / defaultViewport.width, maxDimension / defaultViewport.height));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d', { alpha: false });

    // Crisp white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.94);

    if (fileOrBuffer instanceof Object) {
      fileOrBuffer._cachedThumb = dataUrl;
    }
    return dataUrl;
  } catch (err) {
    console.warn('First page thumbnail generation fallback:', err);
    return null;
  }
}

/**
 * Generates thumbnail data URLs for all pages with crystal clear resolution and solid white paper background
 */
export async function generatePageThumbnails(fileOrBuffer, maxDimension = 600) {
  const pdfJsDoc = await loadPdfJsDoc(fileOrBuffer);
  const numPages = pdfJsDoc.numPages;
  const thumbnails = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfJsDoc.getPage(i);
    const defaultViewport = page.getViewport({ scale: 1.0 });
    // Render at high-DPI resolution
    const scale = Math.max(1.5, Math.min(maxDimension / defaultViewport.width, maxDimension / defaultViewport.height));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d', { alpha: false });

    // Ensure solid crisp white background so pages never turn transparent/dark
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    thumbnails.push({
      pageNumber: i,
      dataUrl: canvas.toDataURL('image/jpeg', 0.94),
      width: viewport.width,
      height: viewport.height
    });
  }

  return thumbnails;
}

/**
 * Visual difference comparator for 2 PDFs with color-coded change highlighting
 */
export async function comparePdfPages(file1, file2, pageIndex = 1) {
  const doc1 = await loadPdfJsDoc(file1);
  const doc2 = await loadPdfJsDoc(file2);

  const p1Num = Math.min(pageIndex, doc1.numPages);
  const p2Num = Math.min(pageIndex, doc2.numPages);

  const canvas1 = document.createElement('canvas');
  const canvas2 = document.createElement('canvas');

  await renderPageToCanvas(doc1, p1Num, canvas1, 1.2);
  await renderPageToCanvas(doc2, p2Num, canvas2, 1.2);

  // Extract text differences
  const page1 = await doc1.getPage(p1Num);
  const text1 = (await page1.getTextContent()).items.map(i => i.str).join(' ');

  const page2 = await doc2.getPage(p2Num);
  const text2 = (await page2.getTextContent()).items.map(i => i.str).join(' ');

  // Create High-Contrast Highlighted Diff Canvas
  const width = Math.max(canvas1.width, canvas2.width);
  const height = Math.max(canvas1.height, canvas2.height);

  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = width;
  diffCanvas.height = height;
  const dCtx = diffCanvas.getContext('2d');

  // Fill diff canvas with clean white background
  dCtx.fillStyle = '#ffffff';
  dCtx.fillRect(0, 0, width, height);

  const ctx1 = canvas1.getContext('2d');
  const ctx2 = canvas2.getContext('2d');

  const imgData1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
  const imgData2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);
  const diffData = dCtx.createImageData(width, height);

  const d1 = imgData1.data;
  const d2 = imgData2.data;
  const out = diffData.data;

  let totalDiffPixels = 0;
  const totalPixels = width * height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const outIdx = (y * width + x) * 4;

      let r1 = 255, g1 = 255, b1 = 255;
      let r2 = 255, g2 = 255, b2 = 255;

      if (x < canvas1.width && y < canvas1.height) {
        const i1 = (y * canvas1.width + x) * 4;
        r1 = d1[i1];
        g1 = d1[i1 + 1];
        b1 = d1[i1 + 2];
      }

      if (x < canvas2.width && y < canvas2.height) {
        const i2 = (y * canvas2.width + x) * 4;
        r2 = d2[i2];
        g2 = d2[i2 + 1];
        b2 = d2[i2 + 2];
      }

      // Convert to luminance (0 = black, 255 = white)
      const lum1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
      const lum2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
      const diff = Math.abs(lum1 - lum2);

      if (diff > 25) {
        totalDiffPixels++;
        if (lum1 < lum2) {
          // Present in Doc 1 (Original) but removed or altered in Doc 2 -> Highlight RED
          out[outIdx] = 239;     // R
          out[outIdx + 1] = 68;  // G
          out[outIdx + 2] = 68;  // B
          out[outIdx + 3] = 255;
        } else {
          // Added or present in Doc 2 (Modified) -> Highlight GREEN
          out[outIdx] = 16;      // R
          out[outIdx + 1] = 185; // G
          out[outIdx + 2] = 129; // B
          out[outIdx + 3] = 255;
        }
      } else {
        // Pixel is identical on both
        if (lum1 < 235) {
          // Identical text/content -> render as readable soft dark slate
          out[outIdx] = 100;
          out[outIdx + 1] = 116;
          out[outIdx + 2] = 139;
          out[outIdx + 3] = 255;
        } else {
          // Page background -> pure crisp white
          out[outIdx] = 255;
          out[outIdx + 1] = 255;
          out[outIdx + 2] = 255;
          out[outIdx + 3] = 255;
        }
      }
    }
  }

  dCtx.putImageData(diffData, 0, 0);

  const diffPercentage = parseFloat(((totalDiffPixels / totalPixels) * 100).toFixed(2));

  return {
    canvas1,
    canvas2,
    diffCanvas,
    text1,
    text2,
    doc1Pages: doc1.numPages,
    doc2Pages: doc2.numPages,
    diffPixels: totalDiffPixels,
    diffPercentage
  };
}

