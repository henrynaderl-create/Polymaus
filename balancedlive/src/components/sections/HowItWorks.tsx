type Step = {
  num: string;
  title: string;
  body: string;
};

const steps: Step[] = [
  {
    num: '01',
    title: 'Free 30-Minute Strategy Call',
    body: 'Book a session with a BalancedLive implementation pro. We scope your setup — entities, current tools, migration needs — and build a plan. You leave knowing exactly what onboarding looks like for your situation. No commitment. No sales pressure.',
  },
  {
    num: '02',
    title: 'Book Your Guided Setup',
    body: "For multi-entity setups, QBO migrations, or historical data imports, schedule your full guided implementation. You'll receive a pre-work checklist beforehand — exports, bank access, open AR/AP list.",
  },
  {
    num: '03',
    title: 'We Build Your Foundation',
    body: "Our team migrates your data, connects banks via Plaid, and imports up to one full year of history. You're present and involved — collaborative, not a black box.",
  },
  {
    num: '04',
    title: 'Your First Reconciliation',
    body: 'We walk through your first month-end close together. You leave with clean books, a reconciled ledger, and a system that runs.',
  },
];

export function HowItWorks() {
  return (
    <section className="section border-t border-border-subtle/60">
      <div className="container-content">
        <div className="reveal mx-auto max-w-3xl text-center">
          <p className="eyebrow">How It Works</p>
          <h2 className="h2 mt-4 text-balance text-text-primary">
            From first call to clean books — guided, not handed off.
          </h2>
          <p className="body-lg mt-5">
            A real implementation team walks you through. No black box. No
            "set it up yourself" links.
          </p>
        </div>

        <div className="relative mt-14 lg:mt-20">
          <div
            aria-hidden
            className="absolute left-[2.25rem] top-2 hidden h-[calc(100%-1rem)] w-px bg-gradient-to-b from-accent/40 via-border-subtle to-transparent lg:hidden"
          />
          <div
            aria-hidden
            className="absolute left-0 right-0 top-[34px] mx-auto hidden h-px max-w-[88%] bg-gradient-to-r from-transparent via-border-subtle to-transparent lg:block"
          />
          <ol className="grid gap-5 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li
                key={s.num}
                className="reveal relative"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="card flex h-full flex-col">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-accent">
                      {s.num}
                    </span>
                    <span className="h-px flex-1 bg-border-subtle" />
                  </div>
                  <h3 className="mt-5 text-[17px] font-semibold text-text-primary">
                    {s.title}
                  </h3>
                  <p className="mt-2.5 text-[15px] leading-[24px] text-text-secondary">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
