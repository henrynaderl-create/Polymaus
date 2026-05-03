import { Logo } from './Logo';
import { navigate } from '../lib/router';

type Props = {
  onBookCall: () => void;
};

export function Footer({ onBookCall }: Props) {
  const year = new Date().getFullYear();

  const goHome = (hash?: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.location.pathname !== '/') {
      navigate('/');
      if (hash) {
        setTimeout(
          () =>
            document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }),
          50,
        );
      }
    } else if (hash) {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goPartners = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/partners');
  };

  return (
    <footer className="border-t border-border-subtle bg-[#07080A]">
      <div className="container-content py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <Logo />
            <p className="mt-4 max-w-xs text-[15px] leading-6 text-text-secondary">
              Accounting for operators.
            </p>
            <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.12em] text-text-tertiary">
              Built in {year}
            </p>
          </div>

          <FooterCol
            title="Product"
            className="md:col-span-3"
            items={[
              { label: 'Pricing', href: '/#pricing', onClick: goHome('pricing') },
              { label: 'For CPAs', href: '/partners', onClick: goPartners },
              {
                label: 'Book a Call',
                href: '#',
                onClick: (e) => {
                  e.preventDefault();
                  onBookCall();
                },
              },
            ]}
          />

          <FooterCol
            title="Company"
            className="md:col-span-2"
            items={[
              { label: 'Founder', href: '/', onClick: goHome() },
              {
                label: 'evan@balancedlive.ai',
                href: 'mailto:evan@balancedlive.ai',
              },
            ]}
          />

          <FooterCol
            title="Legal"
            className="md:col-span-2"
            items={[
              { label: 'Privacy', href: '#' },
              { label: 'Terms', href: '#' },
            ]}
          />
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border-subtle pt-7 md:flex-row md:items-center md:justify-between">
          <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-text-tertiary">
            © BalancedLive {year}
          </p>
          <p className="text-[13px] text-text-tertiary">
            Made for entrepreneurs who run more than one thing.
          </p>
        </div>
      </div>
    </footer>
  );
}

type Item = {
  label: string;
  href: string;
  onClick?: (e: React.MouseEvent) => void;
};

function FooterCol({
  title,
  items,
  className = '',
}: {
  title: string;
  items: Item[];
  className?: string;
}) {
  return (
    <div className={className}>
      <h4 className="font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
        {title}
      </h4>
      <ul className="mt-4 space-y-3">
        {items.map((it) => (
          <li key={it.label}>
            <a
              href={it.href}
              onClick={it.onClick}
              className="text-[15px] text-text-secondary transition-colors hover:text-text-primary"
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
