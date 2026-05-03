import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { navigate } from '../lib/router';

type Props = {
  onBookCall: () => void;
  variant?: 'home' | 'partners';
};

export function Nav({ onBookCall, variant = 'home' }: Props) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goHome = (hash?: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    if (window.location.pathname !== '/') {
      navigate('/');
      if (hash) {
        setTimeout(() => {
          document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    } else if (hash) {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goPartners = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    navigate('/partners');
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'border-b border-border-subtle/60 bg-bg-primary/85 backdrop-blur-md'
          : 'bg-transparent'
      }`}
    >
      <div className="container-content flex h-16 items-center justify-between md:h-[72px]">
        <a href="/" onClick={goHome()} className="flex items-center">
          <Logo />
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {variant === 'home' ? (
            <>
              <a href="#pricing" onClick={goHome('pricing')} className="btn-ghost">
                Pricing
              </a>
              <a href="/partners" onClick={goPartners} className="btn-ghost">
                For CPAs
              </a>
            </>
          ) : (
            <>
              <a href="/#pricing" onClick={goHome('pricing')} className="btn-ghost">
                Pricing
              </a>
              <a href="/" onClick={goHome()} className="btn-ghost">
                Home
              </a>
            </>
          )}
          <button onClick={onBookCall} className="btn-primary !py-2.5 !px-5 !text-sm">
            Book a Call
          </button>
        </nav>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-2 text-text-primary md:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border-subtle bg-bg-primary md:hidden">
          <div className="container-content flex flex-col gap-1 py-4">
            {variant === 'home' ? (
              <>
                <a
                  href="#pricing"
                  onClick={goHome('pricing')}
                  className="rounded-md px-3 py-3 text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                >
                  Pricing
                </a>
                <a
                  href="/partners"
                  onClick={goPartners}
                  className="rounded-md px-3 py-3 text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                >
                  For CPAs
                </a>
              </>
            ) : (
              <>
                <a
                  href="/#pricing"
                  onClick={goHome('pricing')}
                  className="rounded-md px-3 py-3 text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                >
                  Pricing
                </a>
                <a
                  href="/"
                  onClick={goHome()}
                  className="rounded-md px-3 py-3 text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                >
                  Home
                </a>
              </>
            )}
            <button
              onClick={() => {
                setOpen(false);
                onBookCall();
              }}
              className="btn-primary mt-2 w-full"
            >
              Book a Discovery Call
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
