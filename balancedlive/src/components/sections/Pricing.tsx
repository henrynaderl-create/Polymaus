import { Check, ArrowRight } from 'lucide-react';

type Tier = {
  name: string;
  price: string;
  unit?: string;
  for: string;
  features: string[];
  cta: string;
  popular?: boolean;
};

const tiers: Tier[] = [
  {
    name: 'Starter',
    price: '$49',
    unit: '/month',
    for: 'Single-entity operators, simple bookkeeping',
    features: [
      'Core accounting (AR, AP, GL)',
      '1 entity',
      'Bank connections via Plaid',
      'Audit trail from day one',
      'Email support',
    ],
    cta: 'Book a Call',
  },
  {
    name: 'Growth',
    price: '$99',
    unit: '/month',
    for: 'Multi-entity small business',
    features: [
      'Everything in Starter',
      'Up to 3 entities',
      'AI reconciliations',
      'Transaction categorization',
      'Priority email support',
    ],
    cta: 'Book a Call',
  },
  {
    name: 'Scale',
    price: '$199',
    unit: '/month',
    for: 'Multi-entity + complex needs',
    features: [
      'Everything in Growth',
      'Unlimited entities (businesses, real estate, personal)',
      'Advanced AI workflows',
      'Accountant access (read + comment)',
      'Priority support',
    ],
    cta: 'Book a Call',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    for: 'Large operators, holding structures',
    features: [
      'Everything in Scale',
      'Custom integrations',
      'Dedicated implementation',
      'SLA + named support',
    ],
    cta: 'Talk to Evan',
  },
];

type Props = { onBookCall: () => void };

export function Pricing({ onBookCall }: Props) {
  return (
    <section id="pricing" className="section border-t border-border-subtle/60">
      <div className="container-content">
        <div className="reveal mx-auto max-w-3xl text-center">
          <p className="eyebrow">Pricing</p>
          <h2 className="h2 mt-4 text-balance text-text-primary">
            Founding member rates. Locked for life.
          </h2>
          <p className="body-lg mt-5">
            Pricing increases as we add AI capabilities and workflow modules.
            What you pay today is what you pay forever.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((t, i) => (
            <article
              key={t.name}
              className={`reveal flex flex-col rounded-xl border p-7 transition-all ${
                t.popular
                  ? 'border-accent/50 bg-bg-surface shadow-[0_0_0_1px_rgba(201,243,120,0.15),0_24px_60px_-20px_rgba(201,243,120,0.18)] lg:-translate-y-2'
                  : 'border-border-subtle bg-bg-surface hover:border-text-tertiary/50'
              }`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-semibold text-text-primary">
                  {t.name}
                </h3>
                {t.popular && (
                  <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
                    Most Popular
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tighter text-text-primary">
                  {t.price}
                </span>
                {t.unit && (
                  <span className="text-sm text-text-tertiary">{t.unit}</span>
                )}
              </div>

              <p className="mt-2 text-sm leading-5 text-text-secondary">
                {t.for}
              </p>

              <div className="my-6 h-px bg-border-subtle" />

              <ul className="flex-1 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-[14px] leading-[22px] text-text-secondary">
                    <Check
                      size={16}
                      strokeWidth={2}
                      className="mt-0.5 shrink-0 text-accent"
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={onBookCall}
                className={`mt-7 inline-flex items-center justify-center gap-1.5 rounded-md py-3 text-sm font-medium transition-all duration-200 hover:-translate-y-px ${
                  t.popular
                    ? 'bg-accent text-bg-primary hover:bg-[#d6f88c]'
                    : 'border border-border-subtle bg-bg-elevated text-text-primary hover:border-text-secondary'
                }`}
              >
                {t.cta} <ArrowRight size={14} />
              </button>
            </article>
          ))}
        </div>

        <div className="reveal mt-12 rounded-xl border border-border-subtle bg-bg-surface p-6 md:p-8">
          <p className="text-[15px] leading-7 text-text-secondary md:text-base md:leading-8">
            <span className="font-semibold text-text-primary">
              Running multiple companies?
            </span>{' '}
            A 6-entity setup elsewhere costs $540/month minimum — six separate
            subscriptions. Scale gives you all of it for $199. The math works
            before features enter the conversation.
          </p>
        </div>

        <p className="reveal caption mt-6 text-center">
          Starts with a free 30-minute strategy call — no commitment. Full
          guided implementation available for complex setups ($300).
        </p>
      </div>
    </section>
  );
}
