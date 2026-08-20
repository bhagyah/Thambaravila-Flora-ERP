import type { ReactNode } from 'react';

function BaseIcon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export function DashboardIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M4 12.5V6.5C4 5.67 4.67 5 5.5 5H10.5V12.5H4Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M13.5 5H18.5C19.33 5 20 5.67 20 6.5V10.5H13.5V5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M13.5 13.5H20V17.5C20 18.33 19.33 19 18.5 19H13.5V13.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 15.5V17.5C4 18.33 4.67 19 5.5 19H10.5V15.5H4Z" stroke="currentColor" strokeWidth="1.7" />
    </BaseIcon>
  );
}

export function AiIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M12 3.5L13.9 8.3L18.7 10.2L13.9 12.1L12 16.9L10.1 12.1L5.3 10.2L10.1 8.3L12 3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M19 15L19.8 17.2L22 18L19.8 18.8L19 21L18.2 18.8L16 18L18.2 17.2L19 15Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function AccountsIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M4.5 8.5H19.5M4.5 12H19.5M4.5 15.5H19.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8" cy="8.5" r="1" fill="currentColor" />
      <circle cx="15.5" cy="12" r="1" fill="currentColor" />
    </BaseIcon>
  );
}

export function TransactionsIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M7 7H17M17 7L13.5 3.5M17 7L13.5 10.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 17H7M7 17L10.5 13.5M7 17L10.5 20.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function ReportsIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M6 4.5H16.5L19.5 7.5V19.5H6C5.17 19.5 4.5 18.83 4.5 18V6C4.5 5.17 5.17 4.5 6 4.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 12H16M8 15.5H14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function SettingsIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M12 8.2C13.5 8.2 14.7 9.4 14.7 10.9C14.7 12.4 13.5 13.6 12 13.6C10.5 13.6 9.3 12.4 9.3 10.9C9.3 9.4 10.5 8.2 12 8.2Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.8 12.5L4.7 11.2L5.6 9.8L4.7 8.4L5.8 7.1L7.4 7.5L8.6 6.5L10.2 5.9L10.6 4.3H13.4L13.8 5.9L15.4 6.5L16.6 7.5L18.2 7.1L19.3 8.4L18.4 9.8L19.3 11.2L18.2 12.5L16.6 12.1L15.4 13.1L13.8 13.7L13.4 15.3H10.6L10.2 13.7L8.6 13.1L7.4 12.1L5.8 12.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function SunIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 2.5V4.5M12 19.5V21.5M2.5 12H4.5M19.5 12H21.5M5.2 5.2L6.6 6.6M17.4 17.4L18.8 18.8M5.2 18.8L6.6 17.4M17.4 6.6L18.8 5.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function MoonIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M15.5 4.5C13.7 4.8 12.2 6.1 11.6 7.8C10.5 10.9 12.1 14.3 15.2 15.4C16.3 15.8 17.4 15.8 18.4 15.6C17.5 17.6 15.4 19 13 19C9.7 19 7 16.3 7 13C7 9.7 9.7 7 13 7C13.9 7 14.8 7.2 15.5 7.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function PlusIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function BellIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M12 19.5C13.1 19.5 14 18.6 14 17.5H10C10 18.6 10.9 19.5 12 19.5Z" fill="currentColor" />
      <path d="M17 16V11.5C17 9 15.4 7.1 13 6.5V6C13 5.4 12.6 5 12 5C11.4 5 11 5.4 11 6V6.5C8.6 7.1 7 9 7 11.5V16L5.5 17.5H18.5L17 16Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function CardIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <rect x="4.5" y="6" width="15" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 10H19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 14H10.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function ChartIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M5 18.5H19.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 16V11.5M12 16V8.5M17 16V5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function SparkIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M12 3.5L13.7 8.1L18.5 9.8L13.7 11.5L12 16.1L10.3 11.5L5.5 9.8L10.3 8.1L12 3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function WalletIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M5.5 7.5H19C19.55 7.5 20 7.95 20 8.5V17C20 18.1 19.1 19 18 19H6.5C5.12 19 4 17.88 4 16.5V9C4 8.17 4.67 7.5 5.5 7.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M17 12H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="16.7" cy="12" r="0.9" fill="currentColor" />
    </BaseIcon>
  );
}
