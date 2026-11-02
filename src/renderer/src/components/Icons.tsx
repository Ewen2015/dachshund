interface IconProps {
  size?: number
  className?: string
}

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true
})

export function MemoryIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 8.5 12 4l8 4.5-8 4.5-8-4.5Z" />
      <path d="m4 12.5 8 4.5 8-4.5" />
      <path d="m4 16.5 8 4.5 8-4.5" />
    </svg>
  )
}

export function AgentsIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="6" cy="7" r="2.4" />
      <circle cx="18" cy="7" r="2.4" />
      <circle cx="12" cy="18" r="2.4" />
      <path d="M8.4 7h7.2M7.2 9.2l3.6 6.6M16.8 9.2l-3.6 6.6" />
    </svg>
  )
}

export function PulseIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M3.5 18.5h17" />
      <path d="M6 15.5V12M10 15.5V8M14 15.5v-5M18 15.5V4.5" />
    </svg>
  )
}

export function ConnectorsIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M10 13a4 4 0 0 0 5.7.1l2.2-2.2a4 4 0 0 0-5.7-5.7L11 6.4" />
      <path d="M14 11a4 4 0 0 0-5.7-.1l-2.2 2.2a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </svg>
  )
}

export function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4 4" />
    </svg>
  )
}

export function PlusIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function CloseIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export function ExpandIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </svg>
  )
}

export function CollapseIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" />
    </svg>
  )
}

export function ArrowUpRightIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  )
}

export function DownloadIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 4v10M8 10l4 4 4-4" />
      <path d="M5 18.5h14" />
    </svg>
  )
}

export function LockIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
    </svg>
  )
}

export function CopyIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 9V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h4" />
    </svg>
  )
}

export function ArchiveIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6" />
    </svg>
  )
}

export function RefreshIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M6.1 9a7 7 0 0 1 11.5-1.4L20 12M4 12l2.4 4.4A7 7 0 0 0 17.9 15" />
    </svg>
  )
}

export function CheckIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="m5 12.5 4.5 4.5L19 6.5" />
    </svg>
  )
}

export function FolderIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M3.5 6.5h6l2 2h9v9.5h-17z" />
    </svg>
  )
}

export function SparkIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z" />
    </svg>
  )
}

export function ShieldIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3.5 19 6v5.3c0 4.2-2.8 7.5-7 9.2-4.2-1.7-7-5-7-9.2V6l7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function FileIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 3.5h7l5 5v12H6z" />
      <path d="M13 3.5v5h5M9 13h6M9 16.5h6" />
    </svg>
  )
}

export function ChevronRightIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

export function MenuBarIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M3 8.5h18" />
      <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SidebarToggleIcon({ size = 17, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M9 4.5v15" />
    </svg>
  )
}
