import { ArrowRight } from 'lucide-react';

type Props = { onBookCall: () => void };

export function CtaRepeat({ onBookCall }: Props) {
  return (
    <section className="section relative overflow-hidden border-t border-border-subtle/60">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cta-glow"
      />
      <div className="container-content relative">
        <div className="reveal mx-auto max-w-prose2 text-center">
          <h2 className="h2 text-balance text-text-primary">
            Ready to see what your books should look like?
          </h2>
          <p className="body-lg mt-6">
            Book a free 30-minute strategy call. We'll scope your setup,
            answer your questions, and show you what onboarding looks like
            for your specific situation.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4">
            <button onClick={onBookCall} className="btn-primary">
              Book a Discovery Call <ArrowRight size={16} />
            </button>
            <p className="caption">
              No commitment. No sales pressure. Just a real conversation.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
