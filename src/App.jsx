import { useState, useCallback } from 'react';
import StepIndicator from './components/StepIndicator';
import DropZone from './components/DropZone';
import InvoiceForm from './components/InvoiceForm';
import QRBillPreview from './components/QRBillPreview';
import { pdfToImages } from './utils/pdfToImages';
import { runOCR } from './utils/ocr';
import { parseInvoice } from './utils/parseInvoice';

const STEP = { UPLOAD: 0, PROCESSING: 1, REVIEW: 2, PREVIEW: 3 };

const EMPTY_FIELDS = {
  iban: '',
  creditorName: '',
  creditorAddress: '',
  creditorZip: '',
  creditorCity: '',
  creditorCountry: 'CH',
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

export default function App() {
  const [step, setStep] = useState(STEP.UPLOAD);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [ocrError, setOcrError] = useState('');
  const [extractedFields, setExtractedFields] = useState(EMPTY_FIELDS);
  const [finalFields, setFinalFields] = useState(null);

  const handleFile = useCallback(async (file) => {
    setStep(STEP.PROCESSING);
    setOcrError('');
    setProgress(5);
    setProgressLabel('Datei wird geladen…');

    try {
      let images;
      const isImage = file.type.startsWith('image/');

      if (isImage) {
        // Images can be passed directly to Tesseract as a data URL
        setProgress(20);
        setProgressLabel('Bild wird vorbereitet…');
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        images = [dataUrl];
      } else {
        const arrayBuffer = await file.arrayBuffer();
        setProgress(15);
        setProgressLabel('PDF wird gerendert…');
        images = await pdfToImages(arrayBuffer);
      }

      setProgress(30);
      setProgressLabel(`${images.length} Seite(n) erkannt, OCR läuft…`);

      const text = await runOCR(images, (pct, label) => {
        setProgress(pct);
        setProgressLabel(label);
      });

      setProgress(92);
      setProgressLabel('Felder werden extrahiert…');
      const parsed = parseInvoice(text);

      setProgress(100);
      setProgressLabel('Fertig!');

      await new Promise((r) => setTimeout(r, 500));
      setExtractedFields({ ...EMPTY_FIELDS, ...parsed });
      setStep(STEP.REVIEW);
    } catch (err) {
      console.error('Processing error:', err);
      setOcrError(`Fehler bei der Verarbeitung: ${err.message}`);
    }
  }, []);

  const handleFormSubmit = (fields) => {
    setFinalFields(fields);
    setStep(STEP.PREVIEW);
  };

  const handleReset = () => {
    setStep(STEP.UPLOAD);
    setExtractedFields(EMPTY_FIELDS);
    setFinalFields(null);
    setOcrError('');
    setProgress(0);
    setProgressLabel('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-7 h-7 bg-swiss-red rounded flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-4 h-4" fill="white">
              <rect x="40" y="10" width="20" height="80" />
              <rect x="10" y="40" width="80" height="20" />
            </svg>
          </div>
          <span className="font-semibold text-gray-800 text-sm tracking-tight">
            QR-Rechnung Generator
          </span>
          <span className="ml-auto text-xs text-gray-400">Schweizer Standard (SPS 2.0)</span>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {step !== STEP.UPLOAD && <StepIndicator current={step} />}

        {/* Step 0: Upload */}
        {step === STEP.UPLOAD && <DropZone onFile={handleFile} />}

        {/* Step 1: Processing */}
        {step === STEP.PROCESSING && (
          <div className="card max-w-lg mx-auto">
            {ocrError ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800 mb-2">Fehler</h3>
                <p className="text-sm text-red-600 mb-4">{ocrError}</p>
                <button onClick={handleReset} className="btn-secondary">
                  Neue Datei auswählen
                </button>
              </div>
            ) : (
              <div className="py-6">
                <div className="flex justify-center mb-6">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
                    <div className="absolute inset-0 rounded-full border-4 border-swiss-red border-t-transparent animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-6 h-6 text-swiss-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <h3 className="text-center font-semibold text-gray-800 mb-1">Rechnung wird analysiert</h3>
                <p className="text-center text-sm text-gray-500 mb-6 min-h-[1.25rem]">{progressLabel}</p>
                <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-swiss-red h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-right text-xs text-gray-400 mt-1">{progress}%</p>
                <ul className="mt-6 space-y-2">
                  {[
                    { label: 'PDF laden & rendern', done: progress >= 30 },
                    { label: 'Texterkennung (OCR)', done: progress >= 90 },
                    { label: 'Felder extrahieren', done: progress >= 100 },
                  ].map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-green-500' : 'bg-gray-200'}`}>
                        {s.done && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className={s.done ? 'text-gray-700' : 'text-gray-400'}>{s.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review */}
        {step === STEP.REVIEW && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-1">Daten prüfen und ergänzen</h2>
              <p className="text-sm text-gray-500">
                Die erkannten Felder sind vorausgefüllt. Bitte prüfe und korrigiere die Angaben.
              </p>
            </div>
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex gap-2 items-start">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>
                OCR-Ergebnisse können ungenau sein. Prüfe insbesondere <strong>IBAN</strong> und <strong>Betrag</strong> sorgfältig.
              </span>
            </div>
            <InvoiceForm initial={extractedFields} onSubmit={handleFormSubmit} onBack={handleReset} />
          </div>
        )}

        {/* Step 3: Preview */}
        {step === STEP.PREVIEW && finalFields && (
          <QRBillPreview fields={finalFields} onBack={() => setStep(STEP.REVIEW)} onReset={handleReset} />
        )}
      </main>

      <footer className="mt-16 border-t border-gray-100 py-6">
        <p className="text-center text-xs text-gray-400">
          QR-Rechnung nach Schweizer Payment Standard 2.0 (SPS) •
          Verarbeitung vollständig im Browser • Keine Daten werden übertragen
        </p>
      </footer>
    </div>
  );
}
