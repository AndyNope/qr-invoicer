import { useState } from 'react';
import { isValidIban, isValidAmount } from '../utils/parseInvoice';

const COUNTRIES = [
  { code: 'CH', label: 'Schweiz' },
  { code: 'DE', label: 'Deutschland' },
  { code: 'AT', label: 'Österreich' },
  { code: 'FR', label: 'Frankreich' },
  { code: 'IT', label: 'Italien' },
  { code: 'LI', label: 'Liechtenstein' },
];

function Field({ label, id, error, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input
        id={id}
        className={`input-field ${error ? 'error' : ''}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function SelectField({ label, id, options, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} className="input-field" {...props}>
        {options.map((o) => (
          <option key={o.code} value={o.code}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-swiss-red/10 text-swiss-red flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function InvoiceForm({ initial, onSubmit, onBack }) {
  const [fields, setFields] = useState(initial);
  const [errors, setErrors] = useState({});

  const set = (key) => (e) =>
    setFields((prev) => ({ ...prev, [key]: e.target.value }));

  const validate = () => {
    const errs = {};
    const ibanClean = (fields.iban || '').replace(/\s/g, '');
    if (!ibanClean) {
      errs.iban = 'IBAN ist erforderlich';
    } else if (!/^CH[A-Z0-9]{19}$/i.test(ibanClean)) {
      errs.iban = 'Format ungültig – Schweizer IBAN: CH + 19 Ziffern';
    }
    // Checksum is shown as a live warning but does NOT block submission
    // (user can correct it manually; swissqrbill validates at generation time)
    if (fields.amount && !isValidAmount(fields.amount))
      errs.amount = 'Ungültiger Betrag';
    if (!fields.creditorName.trim())
      errs.creditorName = 'Empfängername ist erforderlich';
    if (!fields.creditorCity.trim())
      errs.creditorCity = 'Ort ist erforderlich';
    if (!fields.creditorZip.trim())
      errs.creditorZip = 'PLZ ist erforderlich';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) onSubmit(fields);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Zahlungsempfänger ── */}
        <div className="card">
          <SectionHeader
            icon={<BankIcon />}
            title="Zahlungsempfänger (Creditor)"
            subtitle="Person oder Firma, die das Geld erhält"
          />
          <div className="space-y-3">
            {/* IBAN with live checksum hint */}
            <div>
              <label htmlFor="iban" className="label">IBAN *</label>
              <input
                id="iban"
                className={`input-field ${errors.iban ? 'error' : ''}`}
                value={fields.iban}
                onChange={set('iban')}
                placeholder="CH56 0483 5012 3456 7000 0"
              />
              {errors.iban
                ? <p className="text-xs text-red-500 mt-1">{errors.iban}</p>
                : (() => {
                    const c = (fields.iban || '').replace(/\s/g, '').toUpperCase();
                    if (!c) return null;
                    if (!/^CH\d{19}$/.test(c))
                      return <p className="text-xs text-amber-500 mt-1">Format: CH + 19 Ziffern</p>;
                    if (!isValidIban(fields.iban))
                      return <p className="text-xs text-amber-500 mt-1">⚠ Prüfziffer ungültig – bitte IBAN prüfen</p>;
                    return <p className="text-xs text-green-600 mt-1">✓ IBAN gültig</p>;
                  })()
              }
            </div>
            <Field
              label="Name / Firma *"
              id="creditorName"
              value={fields.creditorName}
              onChange={set('creditorName')}
              placeholder="Muster AG"
              error={errors.creditorName}
            />
            <Field
              label="Strasse / Nr."
              id="creditorAddress"
              value={fields.creditorAddress}
              onChange={set('creditorAddress')}
              placeholder="Musterstrasse 1"
            />
            <div className="grid grid-cols-3 gap-2">
              <Field
                label="PLZ *"
                id="creditorZip"
                value={fields.creditorZip}
                onChange={set('creditorZip')}
                placeholder="8000"
                error={errors.creditorZip}
              />
              <div className="col-span-2">
                <Field
                  label="Ort *"
                  id="creditorCity"
                  value={fields.creditorCity}
                  onChange={set('creditorCity')}
                  placeholder="Zürich"
                  error={errors.creditorCity}
                />
              </div>
            </div>
            <SelectField
              label="Land"
              id="creditorCountry"
              value={fields.creditorCountry}
              onChange={set('creditorCountry')}
              options={COUNTRIES}
            />
          </div>
        </div>

        {/* ── Betrag + Mitteilung ── */}
        <div className="space-y-6">
          <div className="card">
            <SectionHeader
              icon={<MoneyIcon />}
              title="Betrag"
            />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="currency" className="label">Währung</label>
                <select
                  id="currency"
                  className="input-field"
                  value={fields.currency}
                  onChange={set('currency')}
                >
                  <option value="CHF">CHF</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div className="col-span-2">
                <Field
                  label="Betrag"
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={fields.amount}
                  onChange={set('amount')}
                  placeholder="0.00"
                  error={errors.amount}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <SectionHeader
              icon={<MsgIcon />}
              title="Mitteilung / Referenz"
            />
            <div className="space-y-3">
              <Field
                label="Referenznummer"
                id="reference"
                value={fields.reference}
                onChange={set('reference')}
                placeholder="21 00000 00003 13947 14300 09017"
              />
              <div>
                <label htmlFor="message" className="label">Mitteilung</label>
                <textarea
                  id="message"
                  className="input-field resize-none"
                  rows={2}
                  maxLength={140}
                  value={fields.message}
                  onChange={set('message')}
                  placeholder="Rechnungs-Nr. 1234"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {fields.message?.length || 0}/140
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Zahlungspflichtiger ── */}
        <div className="card md:col-span-2">
          <SectionHeader
            icon={<PersonIcon />}
            title="Zahlungspflichtiger (Debtor)"
            subtitle="Optional – Person oder Firma, die zahlt"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field
              label="Name"
              id="debtorName"
              value={fields.debtorName}
              onChange={set('debtorName')}
              placeholder="Max Muster"
            />
            <Field
              label="Strasse / Nr."
              id="debtorAddress"
              value={fields.debtorAddress}
              onChange={set('debtorAddress')}
              placeholder="Musterstrasse 1"
            />
            <Field
              label="PLZ"
              id="debtorZip"
              value={fields.debtorZip}
              onChange={set('debtorZip')}
              placeholder="8000"
            />
            <Field
              label="Ort"
              id="debtorCity"
              value={fields.debtorCity}
              onChange={set('debtorCity')}
              placeholder="Zürich"
            />
          </div>
        </div>

      </div>

      {/* Action buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mt-6">
        <button type="button" onClick={onBack} className="btn-secondary justify-center">
          <ArrowLeftIcon />
          Zurück
        </button>
        <button type="submit" className="btn-primary justify-center">
          QR-Rechnung generieren
          <ArrowRightIcon />
        </button>
      </div>
    </form>
  );
}

/* ── Icon helpers ── */
function BankIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M9 10V6a3 3 0 016 0v4M5 10v8a2 2 0 002 2h10a2 2 0 002-2v-8" />
    </svg>
  );
}
function MoneyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-6h6M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
    </svg>
  );
}
function MsgIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6m-9 8l4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function ArrowLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
