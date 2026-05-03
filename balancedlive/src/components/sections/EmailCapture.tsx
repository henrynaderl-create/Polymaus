import { useState } from 'react';
import { Check } from 'lucide-react';

export function EmailCapture() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    setDone(true);
  };

  return (
    <section className="border-t border-border-subtle/60 py-16 md:py-20">
      <div className="container-content">
        <div className="reveal mx-auto max-w-xl text-center">
          <h3 className="h3 text-text-primary">
            Not ready yet? Lock in your founding member rate.
          </h3>
          <p className="mt-3 text-text-secondary">
            We'll email you once before founding member pricing closes. That's
            it. No newsletter.
          </p>

          {done ? (
            <div className="mt-7 inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-[15px] text-text-primary">
              <Check size={16} className="text-accent" />
              Saved. Your rate is locked.
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              className="mt-7 flex flex-col gap-2 sm:flex-row sm:gap-2"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourcompany.com"
                className="flex-1 rounded-md border border-border-subtle bg-bg-surface px-4 py-3 text-[15px] text-text-primary placeholder:text-text-tertiary focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40"
              />
              <button type="submit" className="btn-primary !py-3">
                Save my rate
              </button>
            </form>
          )}

          <p className="caption mt-3">One email. No follow-ups. Promise.</p>
        </div>
      </div>
    </section>
  );
}
