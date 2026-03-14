import * as pdfjsLib from 'pdfjs-dist';
import { BrowserMultiFormatReader } from '@zxing/browser';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const qrReader = new BrowserMultiFormatReader();

/**
 * Extract plain text from all PDF pages using the pdfjs text layer.
 * Works perfectly for digital/vector PDFs without any OCR.
 */
export async function extractPdfTextDirect(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Join items; use space for large gaps, empty for tiny gaps (preserves numbers)
    const items = content.items;
    let text = '';
    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      const str = item.str ?? '';
      if (j > 0 && str) {
        const prev = items[j - 1];
        const gap = item.transform?.[4] - (prev.transform?.[4] + (prev.width ?? 0));
        text += gap < 3 ? str : ' ' + str;
      } else {
        text += str;
      }
      // Insert newline when Y position changes significantly
      if (j < items.length - 1) {
        const nextY = items[j + 1]?.transform?.[5] ?? 0;
        const currY = item.transform?.[5] ?? 0;
        if (Math.abs(nextY - currY) > 2) text += '\n';
      }
    }
    pageTexts.push(text);
  }

  return pageTexts.join('\n\n--- SEITE ---\n\n');
}

/**
 * Render each PDF page to a canvas at the given scale and return canvases.
 */
async function pdfToCanvases(arrayBuffer, scale = 2) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const canvases = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
}

/**
 * Try to decode a QR code from a canvas element.
 */
async function decodeQrFromCanvas(canvas) {
  try {
    const result = await qrReader.decodeFromCanvas(canvas);
    return result.getText();
  } catch {
    return null;
  }
}

/**
 * Scan all PDF pages for a Swiss QR code (tries multiple scales for small QR).
 * Returns the SPC QR text if found, or null.
 */
export async function scanQrFromPdf(arrayBuffer) {
  for (const scale of [2, 3, 4]) {
    try {
      const canvases = await pdfToCanvases(arrayBuffer, scale);
      for (const canvas of canvases) {
        const text = await decodeQrFromCanvas(canvas);
        if (text?.startsWith('SPC')) return text;
      }
    } catch {
      // try next scale
    }
  }
  return null;
}

/**
 * Scan an image dataURL for a Swiss QR code (tries multiple scales).
 */
export async function scanQrFromImage(dataUrl) {
  // Try original
  try {
    const result = await qrReader.decodeFromImageUrl(dataUrl);
    const text = result.getText();
    if (text?.startsWith('SPC')) return text;
  } catch {
    // fall through
  }

  // Try at higher scales using canvas
  const bitmap = await createImageBitmap(await fetch(dataUrl).then(r => r.blob()));
  for (const scale of [2, 3]) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width * scale;
      canvas.height = bitmap.height * scale;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const text = await decodeQrFromCanvas(canvas);
      if (text?.startsWith('SPC')) return text;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Render a PDF to data URL images for OCR (fallback when text layer is empty).
 */
export async function pdfToImages(arrayBuffer, scale = 2.5) {
  const canvases = await pdfToCanvases(arrayBuffer, scale);
  return canvases.map(c => c.toDataURL('image/png'));
}
