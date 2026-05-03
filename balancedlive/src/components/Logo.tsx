type Props = { className?: string };

export function Logo({ className = '' }: Props) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width="22"
        height="22"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect width="32" height="32" rx="7" fill="#14161A" />
        <rect
          x="0.5"
          y="0.5"
          width="31"
          height="31"
          rx="6.5"
          stroke="#23272E"
        />
        <path
          d="M9 22V10h6.2c2.5 0 4.1 1.2 4.1 3.2 0 1.4-.8 2.4-2 2.8 1.6.4 2.6 1.5 2.6 3.1 0 2-1.7 3.3-4.4 3.3H9zm2.4-7.1h3.4c1.3 0 2.1-.6 2.1-1.6s-.8-1.6-2.1-1.6h-3.4v3.2zm0 5.2h3.7c1.4 0 2.2-.6 2.2-1.7s-.8-1.7-2.2-1.7h-3.7v3.4z"
          fill="#C9F378"
        />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight2 text-text-primary">
        BalancedLive
      </span>
    </div>
  );
}
