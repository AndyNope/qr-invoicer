import { SwissQRBill } from 'swissqrbill/svg';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';

/**
 * Build the swissqrbill Data object from form values.
 * @param {object} fields
 * @returns {object}  swissqrbill-compatible Data
 */
export function buildQRBillData(fields) {
  const data = {
    currency: fields.currency || 'CHF',
    creditor: {
      account: fields.iban.replace(/\s/g, ''),
      name: fields.creditorName,
      address: fields.creditorAddress || '',
      zip: fields.creditorZip || '',
      city: fields.creditorCity || '',
      country: fields.creditorCountry || 'CH',
    },
  };

  if (fields.amount && parseFloat(fields.amount) > 0) {
    data.amount = parseFloat(fields.amount);
  }

  if (fields.debtorName) {
    data.debtor = {
      name: fields.debtorName,
      address: fields.debtorAddress || '',
      zip: fields.debtorZip || '',
      city: fields.debtorCity || '',
      country: fields.debtorCountry || 'CH',
    };
  }

  if (fields.reference) {
    data.reference = fields.reference;
  }

  if (fields.message) {
    data.message = fields.message.slice(0, 140);
  }

  return data;
}

/**
 * Generate a Swiss QR Bill SVG string.
 * @param {object} fields  Form field values
 * @returns {string}  SVG markup
 */
export function generateQRBillSVG(fields) {
  const data = buildQRBillData(fields);
  const bill = new SwissQRBill(data, { language: 'DE' });
  return bill.toString();
}

/**
 * Generate a Swiss QR Bill and trigger PDF download.
 * The PDF is a single page (A4) with the QR slip at the bottom.
 * @param {object}  fields       Form field values
 * @param {string}  [fileName]   Output filename (without extension)
 */
export async function downloadQRBillPdf(fields, fileName = 'qr-rechnung') {
  const svgString = generateQRBillSVG(fields);

  // Parse SVG string into a DOM element
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgElement = svgDoc.documentElement;

  // QR slip: 210mm wide × 105mm tall (Swiss standard)
  const slipW = 210;
  const slipH = 105;

  // Create A4 PDF: 210mm × 297mm (portrait)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Add a light separator line above the QR slip
  const yOffset = 297 - slipH; // top of QR slip area
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.3);
  pdf.line(0, yOffset, 210, yOffset);

  // Render SVG into the bottom portion of the A4 page
  await svg2pdf(svgElement, pdf, {
    x: 0,
    y: yOffset,
    width: slipW,
    height: slipH,
  });

  pdf.save(`${fileName}.pdf`);
}
