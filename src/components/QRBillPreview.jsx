import { useEffect, useRef, useState } from 'react';
import { generateQRBillSVG, downloadQRBillPdf } from '../utils/generateQRBill';

export default function QRBillPreview({ fields, onBack, onReset }) {
  const previewRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const svg = generateQRBillSVG(fields);
      setSvgContent(svg);
    } catch (err) {
      console.error('SVG generation error:', err);
      setError(`Fehler beim Generieren: ${err.message}`);
    }
  }, [fields]);

  const handleDownload = async () => {
    setIsGenerating(true);
    setError('');
    try {
      await downloadQRBillPdf(fields, 'qr-rechnung');
    } catch (err) {
      console.error('PDF generation error:', err);
      setError(`Fehler beim PDF-Export: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadSvg = () => {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qr-rechnung.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = async () => {
    setIsGenerating(true);
    setError('');
    try {
      // Parse SVG dimensions
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgEl = svgDoc.documentElement;

      // Swiss QR slip: 210mm × 105mm – render at 300 dpi (≈2480×1240 px)
      const scale = 4; // 4× → crisp at any size
      const mmToPx = (mm) => Math.round((mm / 25.4) * 96 * scale);
      const W = mmToPx(210);
      const H = mmToPx(105);

      svgEl.setAttribute('width', String(W));
      svgEl.setAttribute('height', String(H));

      const serialized = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = W;
          canvas.height = H;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, W, H);
          ctx.drawImage(img, 0, 0, W, H);
          URL.revokeObjectURL(svgUrl);
          canvas.toBlob((blob) => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'qr-rechnung.png';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            resolve();
          }, 'image/png');
        };
        img.onerror = (e) => { URL.revokeObjectURL(svgUrl); reject(e); };
        img.src = svgUrl;
      });
    } catch (err) {
      console.error('PNG generation error:', err);
      setError(`Fehler beim PNG-Export: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">QR-Rechnung bereit</h2>
            <p className="text-sm text-gray-500">
              Überprüfe den Zahlungsabschnitt und lade ihn herunter.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="flex gap-2">
              <button onClick={onBack} className="btn-secondary flex-1 sm:flex-none justify-center">
                <ArrowLeftIcon /> Bearbeiten
              </button>
              <button onClick={handleDownloadSvg} className="btn-secondary flex-1 sm:flex-none justify-center" disabled={!svgContent || isGenerating}>
                <SvgIcon /> SVG
              </button>
              <button onClick={handleDownloadPng} className="btn-secondary flex-1 sm:flex-none justify-center" disabled={!svgContent || isGenerating}>
                <PngIcon /> PNG
              </button>
            </div>
            <button onClick={handleDownload} className="btn-primary w-full sm:w-auto justify-center" disabled={isGenerating || !svgContent}>
              {isGenerating ? (
                <><SpinnerIcon /> Wird erstellt…</>
              ) : (
                <><DownloadIcon /> Als PDF herunterladen</>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* QR Bill Preview */}
      <div className="card overflow-hidden">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Vorschau – Zahlungsabschnitt (QR-Teil)
        </h3>
        {svgContent ? (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div
              ref={previewRef}
              className="border border-gray-200 rounded-xl overflow-hidden bg-white min-w-[320px]"
              style={{ maxWidth: '840px', margin: '0 auto' }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          </div>
        ) : !error ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <SpinnerIcon className="w-6 h-6 mr-2 animate-spin" />
            Vorschau wird geladen…
          </div>
        ) : null}
      </div>

      {/* Summary */}
      <div className="card">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Zusammenfassung
        </h3>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <SummaryItem label="Empfänger" value={fields.creditorName} />
          <SummaryItem label="IBAN" value={fields.iban} mono />
          <SummaryItem
            label="Betrag"
            value={fields.amount ? `${fields.currency} ${parseFloat(fields.amount).toFixed(2)}` : '— (offen)'}
            highlight={!!fields.amount}
          />
          {fields.debtorName && <SummaryItem label="Zahlender" value={fields.debtorName} />}
          {fields.reference && <SummaryItem label="Referenz" value={fields.reference} mono />}
          {fields.message && <SummaryItem label="Mitteilung" value={fields.message} />}
        </dl>
      </div>

      {/* New invoice button */}
      <div className="text-center">
        <button onClick={onReset} className="btn-secondary">
          <RefreshIcon /> Neue Rechnung verarbeiten
        </button>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, mono, highlight }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 font-medium mb-0.5">{label}</dt>
      <dd className={`font-medium ${mono ? 'font-mono text-xs' : 'text-sm'} ${highlight ? 'text-swiss-red' : 'text-gray-700'}`}>
        {value || '–'}
      </dd>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
function SvgIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}
function PngIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function SpinnerIcon({ className = 'w-4 h-4 animate-spin' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 000 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
