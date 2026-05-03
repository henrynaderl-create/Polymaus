import { BookOpen, Workflow, Layers, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Card = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const cards: Card[] = [
  {
    icon: BookOpen,
    title: 'Core Accounting',
    body: "AR, AP, GL — all the accounting you'd expect, done right. Complete audit trail from day one. Nothing deleted. Every change tracked.",
  },
  {
    icon: Workflow,
    title: 'AI-Enabled Workflows',
    body: 'Reconciliations and transaction categorization that learn from your patterns. Less manual review. More time on the decisions that matter.',
  },
  {
    icon: Layers,
    title: 'All Your Companies',
    body: 'Businesses, real estate, personal finances. One unified view. One login. Your accountant sees what they need without merging six exports.',
  },
  {
    icon: Lock,
    title: 'Founding Member Pricing',
    body: "Lock today's rates for life. Pricing increases as we add forecasting, AI orchestration, and more. Early adopters keep the original price.",
  },
];

export function WhatYouGet() {
  return (
    <section className="section border-t border-border-subtle/60">
      <div className="container-content">
        <div className="reveal mx-auto max-w-3xl text-center">
          <p className="eyebrow">What You Get</p>
          <h2 className="h2 mt-4 text-balance text-text-primary">
            Real accounting. AI where it earns its keep. Every business you
            run, in one place.
          </h2>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-5">
          {cards.map((c, i) => (
            <article
              key={c.title}
              className="card card-hover reveal flex flex-col"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-accent">
                <c.icon size={18} strokeWidth={1.6} />
              </div>
              <h3 className="mt-6 text-[17px] font-semibold text-text-primary">
                {c.title}
              </h3>
              <p className="mt-2.5 text-[15px] leading-[24px] text-text-secondary">
                {c.body}
              </p>
            </article>
          ))}
        </div>

        <p className="reveal mt-10 text-center font-mono text-[13px] uppercase tracking-[0.12em] text-text-tertiary">
          Forecasting and forward-looking intelligence — coming next.
        </p>
      </div>
    </section>
  );
}
