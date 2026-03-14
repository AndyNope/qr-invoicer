import { useCallback, useRef, useState } from 'react';

export default function DropZone({ onFile }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

  const handleFile = useCallback(
    (file) => {
      if (!file) return;
      if (!ACCEPTED.includes(file.type)) {
        alert('Bitte eine PDF-, PNG-, JPG- oder WEBP-Datei hochladen.');
        return;
      }
      onFile(file);
    },
    [onFile]
  );

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };
  const onInputChange = (e) => {
    handleFile(e.target.files[0]);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] sm:min-h-[60vh]">
      {/* Swiss cross logo */}
      <div className="mb-6 flex items-center gap-3">
        <SwissCrossIcon />
        <h1 className="text-2xl font-bold text-gray-800">QR-Rechnung Generator</h1>
      </div>

      <p className="text-gray-500 text-sm mb-8 text-center max-w-md">
        Lade eine Rechnung als PDF oder Bild hoch. Beträge, IBAN, Empfänger und Zahlender werden
        automatisch per OCR erkannt und in ein QR-Rechnungsformular übertragen.
      </p>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`
          w-full max-w-lg cursor-pointer border-2 border-dashed rounded-2xl
          flex flex-col items-center justify-center gap-4 py-10 sm:py-16 px-6 sm:px-8
          transition-all duration-200 select-none
          ${isDragging
            ? 'border-swiss-red bg-swiss-red/5 scale-[1.01]'
            : 'border-gray-300 bg-white hover:border-swiss-red/50 hover:bg-gray-50'
          }
        `}
      >
        <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-swiss-red/10' : 'bg-gray-100'}`}>
          <UploadIcon className={`w-10 h-10 ${isDragging ? 'text-swiss-red' : 'text-gray-400'}`} />
        </div>

        <div className="text-center">
          <p className="font-semibold text-gray-700 mb-1">
            PDF oder Bild hierher ziehen oder{' '}
            <span className="text-swiss-red">auswählen</span>
          </p>
          <p className="text-xs text-gray-400">PDF, PNG, JPG, WEBP • Max. 50 MB</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onInputChange}
      />

      {/* Info box */}
      <div className="mt-8 max-w-lg w-full bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700">
        <strong>Hinweis:</strong> Die Verarbeitung erfolgt vollständig im Browser.
        Es werden keine Daten an einen Server übertragen. Unterstützt PDF, PNG, JPG und WEBP.
      </div>
    </div>
  );
}

function UploadIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function SwissCrossIcon() {
  return (
    <div className="w-9 h-9 bg-swiss-red rounded-md flex items-center justify-center shadow-md">
      <svg viewBox="0 0 100 100" className="w-5 h-5" fill="white">
        <rect x="40" y="10" width="20" height="80" />
        <rect x="10" y="40" width="80" height="20" />
      </svg>
    </div>
  );
}
