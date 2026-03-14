/**
 * Comprehensive Swiss invoice parser.
 * Handles digital PDFs (pdfjs text layer), Swiss QR SPC payloads and OCR text.
 */

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/** Replace Swiss apostrophe thousands separators: 2'407.27 → 2407.27 */
export function normalizeNumbers(text) {
  return text.replace(/(\d)[\u2019\u2018'](\d{3})/g, '$1$2');
}

/** Clean a raw IBAN string – strip spaces, force uppercase, verify CH+19 */
function cleanIban(raw) {
  const stripped = raw.replace(/\s/g, '').toUpperCase();
  const m = stripped.match(/CH\d{19}/);
  return m ? m[0] : stripped.replace(/[^A-Z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// Swiss SPC / QR-Rechnung parser
// ---------------------------------------------------------------------------

/**
 * Parse the SPC QR-code text (Swiss Payment Standard 2.0) into an invoice object.
 * Returns null if the text doesn't look like a valid SPC payload.
 */
export function parseSwissQR(qrText) {
  const lines = qrText.split(/[\r\n]+/).map(l => l.trim());
  if (lines[0] !== 'SPC') return null;

  // Positions per SPC 2.0 spec
  const iban            = lines[2]  || '';
  const creditorName    = lines[4]  || '';
  const creditorAddr1   = lines[5]  || '';
  const creditorAddr2   = lines[6]  || '';
  const creditorZip     = lines[7]  || '';
  const creditorCity    = lines[8]  || '';
  const creditorCountry = lines[9]  || 'CH';
  const amountRaw       = lines[17] || '';
  const currency        = lines[18] || 'CHF';
  const debtorName      = lines[20] || '';
  const debtorAddr1     = lines[21] || '';
  const debtorAddr2     = lines[22] || '';
  const debtorZip       = lines[23] || '';
  const debtorCity      = lines[24] || '';
  const reference       = lines[27] || '';
  const message         = lines[28] || '';

  const amount = parseFloat(normalizeNumbers(amountRaw)) || 0;

  return {
    creditorName,
    creditorAddress: [creditorAddr1, creditorAddr2].filter(Boolean).join(', '),
    creditorZip,
    creditorCity,
    creditorCountry,
    iban: cleanIban(iban),
    amount: amount > 0 ? amount.toFixed(2) : '',
    currency,
    debtorName,
    debtorAddress: [debtorAddr1, debtorAddr2].filter(Boolean).join(', '),
    debtorZip,
    debtorCity,
    debtorCountry: 'CH',
    reference,
    message,
    _source: 'qr',
  };
}

// ---------------------------------------------------------------------------
// Text-based parser (pdfjs text layer or OCR)
// ---------------------------------------------------------------------------

const SKIP_LINE_RE = /^(IBAN|Konto|Account|Datum|Date|Betrag|Mwst|MwSt|CHF|EUR|Total|Seite|Page|\d|www\.|http)/i;

function findIban(text) {
  const patterns = [
    // "IBAN CH68 ..."
    /\bIBAN[:\s]*([Cc][Hh]\s*\d{2}(?:\s*\d{4}){4}\s*\d{3})/g,
    // "Bankverbindung: Bank AG, IBAN CH68 ..."
    /Bankverbindung[^,\n]*,\s*([Cc][Hh]\s*\d{2}(?:\s*\d{4}){4}\s*\d{3})/g,
    // bare IBAN anywhere
    /\b([Cc][Hh]\d{2}(?:\s*\d{4}){4}\s*\d{3})\b/g,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) return cleanIban(m[1]);
  }
  return '';
}

function findAmount(text) {
  const norm = normalizeNumbers(text);
  const lines = norm.split('\n');

  // Patterns on a single line – ordered by confidence
  const inline = [
    /(?:Rechnungsbetrag|Zahlbetrag|Endsumme|Gesamttotal|Gesamtbetrag|Total\s*(?:zu meinen Gunsten|fällig)?|Summe|Betrag)[^\n\d]{0,20}([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})/i,
    /(?:CHF|Fr\.?)\s*([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})/i,
    /([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:CHF|EUR)/i,
    /Total[^:\n]*[:\s]+([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})/i,
  ];

  for (const pattern of inline) {
    const m = norm.match(pattern);
    if (m) {
      const val = parseFloat(m[1].replace(/[',\s]/g, '').replace(',', '.'));
      if (!isNaN(val) && val > 0) return val.toFixed(2);
    }
  }

  // Multi-line: keyword on one line, amount alone on next
  const kwRe  = /Rechnungsbetrag|Zahlbetrag|Endsumme|Gesamttotal|Gesamtbetrag|Total|Betrag fällig/i;
  const numRe = /^\s*([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:CHF|EUR|Fr\.?)?\s*$/;

  for (let i = 0; i < lines.length - 1; i++) {
    if (kwRe.test(lines[i])) {
      const m = lines[i + 1]?.trim().match(numRe);
      if (m) {
        const val = parseFloat(m[1].replace(/[',\s]/g, '').replace(',', '.'));
        if (!isNaN(val) && val > 0) return val.toFixed(2);
      }
    }
  }

  return '';
}

function findCreditor(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Find IBAN line index
  let ibanIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/CH\d{2}[\d\s]{17}/i.test(lines[i]) || /IBAN/i.test(lines[i])) {
      ibanIdx = i;
      break;
    }
  }

  if (ibanIdx > 0) {
    // Walk backwards from IBAN to find the nearest plausible name
    for (let i = Math.max(0, ibanIdx - 5); i < ibanIdx; i++) {
      if (lines[i].length > 3 && !SKIP_LINE_RE.test(lines[i])) return lines[i];
    }
  }

  // Fallback: first non-skip line near top
  for (const l of lines.slice(0, 15)) {
    if (l.length > 4 && !SKIP_LINE_RE.test(l)) return l;
  }
  return '';
}

function findBankName(text) {
  const m = text.match(/Bankverbindung[:\s]+([^,\n]+?)(?:,|\bIBAN\b)/i)
         || text.match(/(?:^|\n)Bank[:\s]+([^\n,]{4,50})/im);
  return m ? m[1].trim() : '';
}

function findZipCity(lines) {
  for (const l of lines) {
    const m = l.match(/^(\d{4})\s+(.+)$/);
    if (m) return { zip: m[1], city: m[2].trim() };
  }
  return { zip: '', city: '' };
}

function findDebtor(text) {
  const kwRe = /(?:Zahlungspflichtiger|Rechnungsempfänger|Auftraggeber|Debtor|Kunde)[:\s]*/i;
  const m = text.match(new RegExp(kwRe.source + '(.+)', 'i'));
  if (!m) return { debtorName: '', debtorAddress: '', debtorZip: '', debtorCity: '', debtorCountry: 'CH' };
  const lines = m[1].split('\n').map(l => l.trim()).filter(Boolean);
  const { zip, city } = findZipCity(lines.slice(1, 5));
  return {
    debtorName:    lines[0] || '',
    debtorAddress: lines[1] || '',
    debtorZip:     zip,
    debtorCity:    city,
    debtorCountry: 'CH',
  };
}

function parseText(text) {
  const iban         = findIban(text);
  const amount       = findAmount(text);
  const creditorName = findCreditor(text);
  const bankName     = findBankName(text);
  const debtor       = findDebtor(text);

  // Try to locate address / zip / city lines near the IBAN
  const lines  = text.split('\n').map(l => l.trim()).filter(Boolean);
  const ibanI  = lines.findIndex(l => /CH\d{2}/i.test(l));
  const nearby = ibanI > 0 ? lines.slice(Math.max(0, ibanI - 6), ibanI) : lines.slice(0, 8);
  const { zip, city } = findZipCity(nearby);

  // QR-Ref or RF-Ref
  const qrRef = text.match(/\b\d{2}[\s]?\d{5}[\s]?\d{5}[\s]?\d{5}[\s]?\d{5}[\s]?\d{5}\b/);
  const rfRef = !qrRef && text.match(/\bRF\d{2}[A-Z0-9]{1,21}\b/i);
  const reference = qrRef ? qrRef[0].replace(/\s/g, '') : rfRef ? rfRef[0] : '';

  const msgM   = text.match(/(?:Mitteilung|Verwendungszweck|Betreff|Rechnungs-?Nr\.?)[:\s]*(.+)/i);
  const message = msgM ? msgM[1].trim().slice(0, 140) : '';

  const currency = /\bEUR\b/i.test(text) ? 'EUR' : 'CHF';

  return {
    creditorName,
    creditorAddress: '',
    creditorZip:     zip,
    creditorCity:    city,
    creditorCountry: 'CH',
    iban,
    amount,
    currency,
    ...debtor,
    reference,
    message,
    _bank:   bankName,
    _source: iban ? 'text' : 'text-partial',
  };
}

// ---------------------------------------------------------------------------
// Unified entry point
// ---------------------------------------------------------------------------

/**
 * Parse text from OCR, pdfjs text layer, or a raw SPC QR payload.
 * Always returns a flat object matching the InvoiceForm state shape.
 */
export function parseInvoice(text) {
  if (!text) return parseText('');

  const trimmed = text.trimStart();
  if (trimmed.startsWith('SPC\n') || trimmed.startsWith('SPC\r')) {
    const qr = parseSwissQR(trimmed);
    if (qr) return qr;
  }

  return parseText(text);
}

/** Validate that an IBAN has the correct format */
export function isValidIban(iban) {
  const cleaned = (iban || '').replace(/\s/g, '');
  return /^CH\d{19}$/.test(cleaned);
}

/** Validate that an amount string is a positive number */
export function isValidAmount(amount) {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num < 10_000_000;
}
