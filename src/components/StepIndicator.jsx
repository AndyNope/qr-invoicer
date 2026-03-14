const STEPS = [
  { id: 0, label: 'Hochladen', labelLong: 'PDF hochladen' },
  { id: 1, label: 'OCR', labelLong: 'Texterkennung' },
  { id: 2, label: 'Prüfen', labelLong: 'Daten prüfen' },
  { id: 3, label: 'QR-Slip', labelLong: 'QR-Rechnung' },
];

export default function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, idx) => (
        <div key={step.id} className="flex items-center">
          {/* Step circle */}
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                current > step.id
                  ? 'bg-swiss-red border-swiss-red text-white'
                  : current === step.id
                  ? 'bg-swiss-red border-swiss-red text-white shadow-lg shadow-swiss-red/30'
                  : 'bg-white border-gray-300 text-gray-400'
              }`}
            >
              {current > step.id ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.id + 1
              )}
            </div>
            <span
              className={`mt-1 text-xs font-medium whitespace-nowrap ${
                current >= step.id ? 'text-gray-700' : 'text-gray-400'
              }`}
            >
              <span className="sm:hidden">{step.label}</span>
              <span className="hidden sm:inline">{step.labelLong}</span>
            </span>
          </div>

          {/* Connector line */}
          {idx < STEPS.length - 1 && (
            <div
              className={`w-6 xs:w-10 sm:w-16 h-0.5 mx-1 mb-5 flex-shrink-0 transition-all duration-300 ${
                current > step.id ? 'bg-swiss-red' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
