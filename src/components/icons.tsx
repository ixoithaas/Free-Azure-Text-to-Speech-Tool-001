type IconProps = { className?: string };

const DEFAULT = "h-4 w-4";

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? DEFAULT} fill="none">
      {children}
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? DEFAULT} fill="currentColor">
      <path d="M8.14 5.05v13.9c0 .82.9 1.31 1.58.86l10.4-6.95a1.03 1.03 0 0 0 0-1.72L9.72 4.19a1.03 1.03 0 0 0-1.58.86Z" />
    </svg>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? DEFAULT} fill="currentColor">
      <rect x="6.5" y="4.5" width="3.9" height="15" rx="1.3" />
      <rect x="13.6" y="4.5" width="3.9" height="15" rx="1.3" />
    </svg>
  );
}

export function StopIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? DEFAULT} fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3.75v10.5m0 0 3.75-3.75M12 14.25l-3.75-3.75" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 16.5v1.9c0 1 .8 1.85 1.8 1.85h11.4c1 0 1.8-.85 1.8-1.85v-1.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function StarIcon({ className, filled }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? DEFAULT} fill={filled ? "currentColor" : "none"}>
      <path
        d="m12 4.2 2.35 4.86 5.3.74-3.85 3.7.93 5.3L12 16.28 7.27 18.8l.93-5.3-3.85-3.7 5.3-.74L12 4.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4.8 6.6h14.4M9.6 6.6V5.1c0-.7.6-1.3 1.3-1.3h2.2c.7 0 1.3.6 1.3 1.3v1.5m2.4 0-.7 12a1.7 1.7 0 0 1-1.7 1.6H8.6A1.7 1.7 0 0 1 6.9 18.6l-.7-12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="10.8" cy="10.8" r="6.1" stroke="currentColor" strokeWidth="1.7" />
      <path d="m15.4 15.4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function SpinnerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`${className ?? DEFAULT} animate-spin-slow`} fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.4" />
      <path d="M20.5 12A8.5 8.5 0 0 0 12 3.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function WaveMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? DEFAULT} fill="none">
      <path d="M3 12h1.8M7 7.2v9.6M11 4v16M15 8.4v7.2M19 10.5v3M21.6 12H21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m5 12.8 4.2 4.2L19 7.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 8.4v4.8m0 3.1h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M10.6 4.1 3.4 16.7c-.6 1.1.2 2.4 1.4 2.4h14.4c1.2 0 2-1.3 1.4-2.4L13.4 4.1a1.6 1.6 0 0 0-2.8 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m6.4 6.4 11.2 11.2m0-11.2L6.4 17.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M19.8 4.4v4.2h-4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SlidersIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 6.5h14M5 12h14M5 17.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9.5" cy="6.5" r="2" fill="var(--color-ink-900)" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="15" cy="12" r="2" fill="var(--color-ink-900)" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="17.5" r="2" fill="var(--color-ink-900)" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

export function MicIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="9" y="3.2" width="6" height="10.6" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0M12 17.8v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function DocumentIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M13.6 3.4H7.2a1.8 1.8 0 0 0-1.8 1.8v13.6c0 1 .8 1.8 1.8 1.8h9.6c1 0 1.8-.8 1.8-1.8V8.2l-4.8-4.8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13.4 3.6v4.6h4.7M8.6 13h6.8M8.6 16.4h4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.4V12l3 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SparkIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3.6 13.7 9l5.4 1.7-5.4 1.7L12 17.8 10.3 12.4 4.9 10.7 10.3 9 12 3.6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18.4 16.2 19.2 18.6 21.6 19.4 19.2 20.2 18.4 22.6 17.6 20.2 15.2 19.4 17.6 18.6 18.4 16.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </Svg>
  );
}
