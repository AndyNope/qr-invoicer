import Tesseract from 'tesseract.js';

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
