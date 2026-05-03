import { ArrowRight } from 'lucide-react';

type Props = { onBookCall: () => void };

export function Hero({ onBookCall }: Props) {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28 lg:pt-48 lg:pb-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-hero-glow bg-[length:140%_140%] animate-gradient-drift"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-px w-[80%] -translate-x-1/2 bg-gradient-to-r from-transparent via-accent/20 to-transparent opacity-50"
      />

      <div className="container-content relative">
        <div className="mx-auto flex max-w-narrow flex-col items-center text-center">
          <p className="eyebrow reveal">Accounting for Operators</p>

          <h1 className="h1 reveal mt-5 text-text-primary" style={{ transitionDelay: '60ms' }}>
            All your companies.
            <br />
            <span className="text-text-primary">One system.</span>
          </h1>

          <p
            className="body-lg reveal mt-7 max-w-2xl text-balance"
            style={{ transitionDelay: '120ms' }}
          >
            Real accounting, AI workflows, and a complete audit trail —
            built by an operator who's run businesses for 25 years.
          </p>

          <div
            className="reveal mt-10 flex flex-col items-center gap-4"
            style={{ transitionDelay: '180ms' }}
          >
            <button onClick={onBookCall} className="btn-primary">
              Book a Discovery Call <ArrowRight size={16} />
            </button>
            <p className="caption">
              Free 30-minute call. No commitment. No sales pressure.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
