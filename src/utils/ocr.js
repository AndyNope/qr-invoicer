import Tesseract from 'tesseract.js';

/**
 * Convert a dataURL image to grayscale and boost contrast before OCR.
 * Uses a contrast factor of ~50 (range -255 to 255), which works well
 * for typical scanned invoices.
 */
export async function preprocessImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const contrast = 50; // adjust in range -255..255
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < data.length; i += 4) {
        // Luminance-weighted grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Apply contrast stretch
        const boosted = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
        data[i] = data[i + 1] = data[i + 2] = boosted;
        // data[i + 3] unchanged (alpha)
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Run OCR on an array of image data URLs and return the combined text.
 * @param {string[]} imageDataUrls
 * @param {(progress: number, status: string) => void} onProgress
 * @returns {Promise<string>}
 */
export async function runOCR(imageDataUrls, onProgress) {
  const results = [];

  for (let i = 0; i < imageDataUrls.length; i++) {
    const pageLabel = imageDataUrls.length > 1 ? ` (Seite ${i + 1}/${imageDataUrls.length})` : '';
    onProgress?.(
      Math.round((i / imageDataUrls.length) * 80),
      `Texterkennung läuft${pageLabel}…`
    );

    const { data: { text } } = await Tesseract.recognize(
      imageDataUrls[i],
      'deu+eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pageBase = (i / imageDataUrls.length) * 80;
            const pageShare = 80 / imageDataUrls.length;
            onProgress?.(
              Math.round(pageBase + m.progress * pageShare),
              `Texterkennung läuft${pageLabel}…`
            );
          }
        },
      }
    );

    results.push(text);
  }

  onProgress?.(90, 'Daten werden ausgelesen…');
  return results.join('\n\n--- SEITENUMBRUCH ---\n\n');
}
