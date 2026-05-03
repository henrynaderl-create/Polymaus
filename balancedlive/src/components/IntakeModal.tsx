import { useEffect, useState } from 'react';
import { X, ArrowRight, CheckCircle2 } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
};

const ENTITIES = ['1', '2–3', '4–6', '7+'] as const;
const SYSTEMS = [
  'QuickBooks',
  'Xero',
  'Spreadsheets',
  'Multiple systems',
  'Other',
] as const;
const CPA = ['Yes', 'No', 'Sometimes'] as const;

export function IntakeModal({ open, onClose }: Props) {
  const [entities, setEntities] = useState<string>('');
  const [system, setSystem] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [cpa, setCpa] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setEntities('');
        setSystem('');
        setReason('');
        setCpa('');
        setSubmitted(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = entities && system && cpa;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-0 sm:items-center sm:px-6">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-xl rounded-t-2xl border border-border-subtle bg-bg-surface shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] sm:rounded-2xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-elevated hover:text-text-primary"
        >
          <X size={18} />
        </button>

        {submitted ? (
          <div className="px-6 py-12 text-center sm:px-10">
            <CheckCircle2 size={36} className="mx-auto text-accent" />
            <h3 className="mt-5 text-xl font-semibold text-text-primary">
              Thanks — we'll reach out shortly.
            </h3>
            <p className="mt-3 text-text-secondary">
              In production this hands off to Calendly with your answers
              prefilled. For now, expect an email from{' '}
              <a
                href="mailto:evan@balancedlive.ai"
                className="text-accent hover:underline"
              >
                evan@balancedlive.ai
              </a>{' '}
              within one business day.
            </p>
            <button onClick={onClose} className="btn-secondary mt-8">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="px-6 py-8 sm:px-10 sm:py-10">
            <p className="eyebrow mb-2">Discovery Call</p>
            <h3 className="text-2xl font-semibold tracking-tight2 text-text-primary">
              Tell us about your setup
            </h3>
            <p className="mt-2 text-text-secondary">
              4 quick questions before we book — so the call is useful from
              minute one.
            </p>

            <div className="mt-7 space-y-6">
              <Question
                label="How many entities (businesses, properties, etc.) do you currently manage?"
                index="01"
              >
                <ChipGroup
                  options={ENTITIES as unknown as string[]}
                  value={entities}
                  onChange={setEntities}
                />
              </Question>

              <Question label="What accounting system are you currently using?" index="02">
                <ChipGroup
                  options={SYSTEMS as unknown as string[]}
                  value={system}
                  onChange={setSystem}
                />
              </Question>

              <Question label="What's prompting you to look for something new?" index="03">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 300))}
                  rows={3}
                  placeholder="A sentence or two is plenty."
                  className="w-full resize-none rounded-md border border-border-subtle bg-bg-primary px-3.5 py-2.5 text-[15px] text-text-primary placeholder:text-text-tertiary focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40"
                />
                <div className="mt-1 text-right font-mono text-xs text-text-tertiary">
                  {reason.length}/300
                </div>
              </Question>

              <Question label="Do you work with a CPA or external accountant?" index="04">
                <ChipGroup
                  options={CPA as unknown as string[]}
                  value={cpa}
                  onChange={setCpa}
                />
              </Question>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-primary mt-8 w-full disabled:cursor-not-allowed disabled:bg-bg-elevated disabled:text-text-tertiary disabled:shadow-none disabled:hover:translate-y-0"
            >
              Continue to scheduling <ArrowRight size={16} />
            </button>
            <p className="caption mt-3 text-center">
              Free 30-minute call. No commitment. No sales pressure.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Question({
  label,
  index,
  children,
}: {
  label: string;
  index: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-xs text-text-tertiary">{index}</span>
        <label className="text-[15px] font-medium text-text-primary">
          {label}
        </label>
      </div>
      {children}
    </div>
  );
}

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-md border px-3.5 py-2 text-sm transition-all ${
              selected
                ? 'border-accent bg-accent/10 text-text-primary'
                : 'border-border-subtle bg-bg-primary text-text-secondary hover:border-text-tertiary hover:text-text-primary'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
