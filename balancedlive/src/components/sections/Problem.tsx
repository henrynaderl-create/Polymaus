export function Problem() {
  return (
    <section className="section border-t border-border-subtle/60">
      <div className="container-content">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="reveal lg:col-span-7">
            <p className="eyebrow">The Reality</p>
            <h2 className="h2 mt-4 text-text-primary">
              You're running six businesses.
              <br />
              Your books are in twelve places.
            </h2>
            <div className="mt-7 space-y-5 body-lg">
              <p>
                Multiple accounting files. Spreadsheets that never quite agree.
                Personal finances tangled with business. Real estate in its own
                silo. When an investor asks for the consolidated view, you spend
                the weekend stitching it together yourself.
              </p>
              <p>
                The problem isn't you. The tools were built to handle one
                company at a time — by people who haven't had to run more than
                one.
              </p>
            </div>
          </div>

          <div className="reveal lg:col-span-5">
            <ScatteredTiles />
          </div>
        </div>
      </div>
    </section>
  );
}

function ScatteredTiles() {
  const tiles = [
    { label: 'Holdings LLC', x: '4%', y: '8%', delay: '0s', tone: 'a' },
    { label: 'Real Estate', x: '54%', y: '2%', delay: '1.2s', tone: 'b' },
    { label: 'Personal', x: '70%', y: '38%', delay: '2.4s', tone: 'a' },
    { label: 'Operating Co.', x: '8%', y: '46%', delay: '3.6s', tone: 'b' },
    { label: 'Side Project', x: '38%', y: '64%', delay: '0.6s', tone: 'a' },
    { label: 'Property #2', x: '60%', y: '72%', delay: '4.8s', tone: 'b' },
  ];

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface p-1 sm:aspect-[5/4]">
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      {tiles.map((t, i) => (
        <div
          key={i}
          className="absolute animate-drift rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]"
          style={{
            left: t.x,
            top: t.y,
            animationDelay: t.delay,
            animationDuration: `${6 + i}s`,
          }}
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
            {t.tone === 'a' ? 'GL' : 'AR/AP'}
          </div>
          <div className="text-[13px] font-medium text-text-primary">
            {t.label}
          </div>
          <div className="mt-1.5 flex gap-1">
            <div className="h-1 w-8 rounded-full bg-border-subtle" />
            <div className="h-1 w-4 rounded-full bg-border-subtle" />
          </div>
        </div>
      ))}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-surface via-transparent to-transparent"
      />
    </div>
  );
}
