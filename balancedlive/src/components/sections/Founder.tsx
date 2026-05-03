export function Founder() {
  return (
    <section className="section border-t border-border-subtle/60">
      <div className="container-content">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="reveal lg:col-span-5">
            <div className="sticky top-28 space-y-5">
              <FounderMark />
              <div>
                <p className="eyebrow">Why This Exists</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight2 text-text-primary">
                  Evan
                </h3>
                <p className="mt-1 font-mono text-[13px] uppercase tracking-[0.12em] text-text-tertiary">
                  Founder · CPA · 25-Year Operator
                </p>
              </div>
            </div>
          </div>

          <div className="reveal lg:col-span-7">
            <h2 className="h2 text-text-primary">
              Built by someone who's run the businesses you run.
            </h2>
            <div className="mt-7 space-y-5 body-lg">
              <p>
                I'm Evan. I've spent 25 years building and running businesses —
                usually more than one at a time. I'm a CPA. I've seen every
                version of accounting software the industry has thrown at
                operators like us. None of them were built for what we actually
                do.
              </p>
              <p>
                Every multi-entity owner I know has the same setup: separate
                accounting files, spreadsheets in between, a mental map only
                they hold. Their accountant spends hours reconstructing history
                that should already exist. The tools were built for one
                business, owned by one person, run from one place. That's not
                the world we operate in.
              </p>
              <p>
                So I built BalancedLive. Not as a software company solving a
                problem from the outside — as an operator solving a problem
                I've lived for 25 years. If you're running more than one
                business and you're tired of stitching your own books together,
                this is the system I wish I'd had.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FounderMark() {
  return (
    <div className="relative aspect-square w-44 overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-br from-bg-elevated to-bg-surface">
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 20%, rgba(201,243,120,0.18), transparent 55%)',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[64px] font-semibold tracking-tighter text-text-primary">
          E
        </span>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
          backgroundSize: '6px 6px',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}
