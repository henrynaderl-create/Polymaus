import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';

type Props = { onBookCall: () => void };

export function Partners({ onBookCall }: Props) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    setDone(true);
  };

  return (
    <>
      <Nav onBookCall={onBookCall} variant="partners" />
      <main>
        <section className="relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-20 lg:pt-48">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-hero-glow"
          />
          <div className="container-content relative">
            <div className="mx-auto max-w-prose2">
              <p className="eyebrow reveal">For Accountants & CPA Firms</p>
              <h1 className="h1 reveal mt-5 text-balance text-text-primary">
                Bring your clients to a system built for the work you actually do.
              </h1>
              <p
                className="body-lg reveal mt-7"
                style={{ transitionDelay: '80ms' }}
              >
                BalancedLive gives accountants what no other system does — a
                complete audit trail, multi-entity views, and clean books that
                don't require weekend cleanup. Talk to us about partnership.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-border-subtle/60 py-16 md:py-20">
          <div className="container-content">
            <div className="reveal mx-auto max-w-prose2">
              <p className="body-lg">
                BalancedLive was built by a CPA. We know what it takes to
                support a multi-entity client — and how much time gets lost to
                reconstructing history that the software let someone delete.
                We're partnering with select CPA firms to bring BL to their
                client base, with revenue share and direct support.
              </p>

              <div className="mt-10 flex flex-col gap-4">
                <button onClick={onBookCall} className="btn-primary self-start">
                  Book a Partnership Call <ArrowRight size={16} />
                </button>

                <div className="mt-2 rounded-xl border border-border-subtle bg-bg-surface p-6">
                  {done ? (
                    <div className="inline-flex items-center gap-2 text-[15px] text-text-primary">
                      <Check size={16} className="text-accent" />
                      Saved. We'll be in touch.
                    </div>
                  ) : (
                    <>
                      <h3 className="text-[15px] font-medium text-text-primary">
                        Get notified about partner program updates
                      </h3>
                      <form
                        onSubmit={onSubmit}
                        className="mt-3 flex flex-col gap-2 sm:flex-row"
                      >
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="firm@example.com"
                          className="flex-1 rounded-md border border-border-subtle bg-bg-primary px-4 py-2.5 text-[15px] text-text-primary placeholder:text-text-tertiary focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40"
                        />
                        <button type="submit" className="btn-secondary">
                          Notify me
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer onBookCall={onBookCall} />
    </>
  );
}
