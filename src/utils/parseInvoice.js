/**
 * Parse OCR text from a Swiss invoice and extract relevant payment fields.
 * @param {string} text  Raw OCR output
 * @returns {object}    Extracted fields (may be partially empty)
 */
export function parseInvoice(text) {
  const result = {
    creditorName: '',
    creditorAddress: '',
    creditorZip: '',
    creditorCity: '',
    creditorCountry: 'CH',
    iban: '',
    amount: '',
    currency: 'CHF',
    debtorName: '',
    debtorAddress: '',
    debtorZip: '',
    debtorCity: '',
    debtorCountry: 'CH',
    reference: '',
    message: '',
  };

  // ── IBAN ──────────────────────────────────────────────────────────────
  // Swiss IBANs: CH + 2 check digits + 17 digits = 21 chars
  const ibanRaw = text.match(/\bCH\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d\b/gi);
  if (ibanRaw?.length) {
    // Clean spaces for standard format display
    const raw = ibanRaw[0].replace(/\s/g, '');
    result.iban = raw.replace(/(.{4})/g, '$1 ').trim();
  }

  // Also check for IBAN keyword followed by the number
  if (!result.iban) {
    const ibanKeyword = text.match(/IBAN[:\s]+([A-Z]{2}\d{2}[\s\d]{15,})/i);
    if (ibanKeyword) {
      const raw = ibanKeyword[1].replace(/\s/g, '').slice(0, 21);
      result.iban = raw.replace(/(.{4})/g, '$1 ').trim();
    }
  }

  // ── CURRENCY ─────────────────────────────────────────────────────────
  if (/\bEUR\b/i.test(text)) result.currency = 'EUR';

  // ── AMOUNT ────────────────────────────────────────────────────────────
  // Patterns: CHF 1'234.50 | CHF 1.234,50 | 1'234.50 CHF | 1 234.50
  const amountPatterns = [
    /(?:CHF|EUR)\s*([\d'.\s,]+\d)/gi,
    /([\d'.\s,]+\d)\s*(?:CHF|EUR)/gi,
  ];

  let bestAmount = '';
  for (const pattern of amountPatterns) {
    pattern.lastIndex = 0;
    const matches = [...text.matchAll(pattern)];
    for (const m of matches) {
      const cleaned = m[1].replace(/'/g, '').replace(/\s/g, '');
      // Handle both comma and dot as decimal separator
      const normalized = cleaned.replace(/,(\d{2})$/, '.$1');
      const num = parseFloat(normalized.replace(/[^\d.]/g, ''));
      if (!isNaN(num) && num > 0 && num < 10_000_000) {
        // Prefer amounts with 2 decimal places
        if (!bestAmount || normalized.includes('.')) {
          bestAmount = num.toFixed(2);
        }
      }
    }
    if (bestAmount) break;
  }
  result.amount = bestAmount;

  // ── QR / ESR REFERENCE ────────────────────────────────────────────────
  // 27-digit QR reference: groups of 2+5+5+5+5+5 spaces optional
  const qrRef = text.match(/\b\d{2}[\s]?\d{5}[\s]?\d{5}[\s]?\d{5}[\s]?\d{5}[\s]?\d{5}\b/);
  if (qrRef) {
    result.reference = qrRef[0].replace(/\s/g, '');
  }
  // ISO creditor reference RF...
  if (!result.reference) {
    const rfRef = text.match(/\bRF\d{2}[A-Z0-9]{1,21}\b/i);
    if (rfRef) result.reference = rfRef[0];
  }

  // ── CREDITOR ─────────────────────────────────────────────────────────
  // Look for "Zahlungsempfänger", "Empfänger", "Creditor", "Rechnungssteller"
  const creditorKeywords = /(?:Zahlungsempfänger|Empfänger|Rechnungssteller|Creditor|Beneficiary|Konto)[:\s]*/i;
  const creditorMatch = text.match(new RegExp(creditorKeywords.source + '(.+)', 'i'));
  if (creditorMatch) {
    const lines = creditorMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    result.creditorName = lines[0] || '';
    if (lines[1]) result.creditorAddress = lines[1];
    // Try to find PLZ + City in next lines
    for (let i = 1; i < Math.min(lines.length, 5); i++) {
      const plzCity = lines[i].match(/^(\d{4})\s+(.+)$/);
      if (plzCity) {
        result.creditorZip = plzCity[1];
        result.creditorCity = plzCity[2].trim();
        if (i > 1) result.creditorAddress = lines[1];
        break;
      }
    }
  }

  // Fallback: try to extract name + address from lines near the IBAN
  if (!result.creditorName && result.iban) {
    const ibanIdx = text.indexOf(result.iban.replace(/\s/g, '').slice(0, 8));
    if (ibanIdx > -1) {
      const before = text.slice(Math.max(0, ibanIdx - 400), ibanIdx);
      const lines = before.split('\n').map(l => l.trim()).filter(Boolean).slice(-6);
      // Last few non-empty lines before IBAN often contain creditor info
      if (lines.length >= 1) result.creditorName = lines[lines.length - 1];
      if (lines.length >= 2) result.creditorAddress = lines[lines.length - 2];
      // Find PLZ pattern
      for (const line of lines) {
        const plzCity = line.match(/^(\d{4})\s+(.+)$/);
        if (plzCity) {
          result.creditorZip = plzCity[1];
          result.creditorCity = plzCity[2].trim();
        }
      }
    }
  }

  // ── DEBTOR (Zahlender / Rechnungsempfänger) ───────────────────────────
  const debtorKeywords = /(?:Zahlungspflichtiger|Rechnungsempfänger|Auftraggeber|Debtor|An:|Kunde)[:\s]*/i;
  const debtorMatch = text.match(new RegExp(debtorKeywords.source + '(.+)', 'i'));
  if (debtorMatch) {
    const lines = debtorMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    result.debtorName = lines[0] || '';
    if (lines[1]) result.debtorAddress = lines[1];
    for (let i = 1; i < Math.min(lines.length, 5); i++) {
      const plzCity = lines[i].match(/^(\d{4})\s+(.+)$/);
      if (plzCity) {
        result.debtorZip = plzCity[1];
        result.debtorCity = plzCity[2].trim();
        if (i > 1) result.debtorAddress = lines[1];
        break;
      }
    }
  }

  // ── MESSAGE / PAYMENT PURPOSE ─────────────────────────────────────────
  const msgKeywords = /(?:Mitteilung|Verwendungszweck|Betreff|Rechnungs-?Nr\.?|Rechnung Nr\.?)[:\s]*(.+)/i;
  const msgMatch = text.match(msgKeywords);
  if (msgMatch) {
    result.message = msgMatch[1].trim().slice(0, 140);
  }

  return result;
}

/** Validate that an IBAN has the correct format */
export function isValidIban(iban) {
  const cleaned = iban.replace(/\s/g, '');
  return /^CH\d{19}$/.test(cleaned);
}

/** Validate that an amount string is a positive number */
export function isValidAmount(amount) {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num < 10_000_000;
}
