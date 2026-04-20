import type { CSSProperties, ReactNode } from "react";

export type IconName =
  | "dashboard" | "calendar" | "bookings" | "user" | "users"
  | "broom" | "moon" | "cash" | "settings" | "search"
  | "plus" | "bell" | "sun" | "chevRight" | "chevLeft" | "chevDown"
  | "filter" | "download" | "more" | "arrowUp" | "arrowDown"
  | "check" | "x" | "alert" | "info" | "clock" | "logout"
  | "key" | "bed" | "star" | "flag" | "print" | "refresh"
  | "sparkles" | "menu" | "command" | "help";

const paths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  bookings: (
    <>
      <path d="M4 4h12l4 4v12H4z" />
      <path d="M16 4v4h4M8 12h8M8 16h5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="4" />
      <circle cx="17" cy="10" r="3" />
      <path d="M2 21c0-4 3-6 7-6s7 2 7 6M14 21c0-3 2-5 5-5s3 2 3 5" />
    </>
  ),
  broom: (
    <>
      <path d="M14 4l6 6" />
      <path d="M10 8l6 6-5 5-6-6z" />
      <path d="M3 21l3-3" />
    </>
  ),
  moon: <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />,
  cash: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 10v4M18 10v4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.4l2-1.6-2-3.4-2.4.9a7 7 0 0 0-2.4-1.4L13.7 3h-3.4l-.4 2.1a7 7 0 0 0-2.4 1.4l-2.4-.9-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.4l-2 1.6 2 3.4 2.4-.9a7 7 0 0 0 2.4 1.4l.4 2.1h3.4l.4-2.1a7 7 0 0 0 2.4-1.4l2.4.9 2-3.4-2-1.6A7 7 0 0 0 19 12z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  bell: (
    <>
      <path d="M18 16V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  chevRight: <path d="M9 6l6 6-6 6" />,
  chevLeft: <path d="M15 6l-9 6 9 6" />,
  chevDown: <path d="M6 9l6 6 6-6" />,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 21h16" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  check: <path d="M4 12l5 5 11-11" />,
  x: <path d="M6 6l12 12M18 6l-12 12" />,
  alert: (
    <>
      <path d="M10.3 3.2L2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v5M12 17.5v.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01M11 12h1v5h1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  logout: (
    <>
      <path d="M15 17l5-5-5-5M20 12H9M9 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M17 6l3 3M15 8l3 3" />
    </>
  ),
  bed: (
    <>
      <path d="M2 18V8M22 18v-5a3 3 0 0 0-3-3H6" />
      <rect x="2" y="12" width="20" height="6" />
      <circle cx="7" cy="11" r="2" />
    </>
  ),
  star: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z" />,
  flag: (
    <>
      <path d="M4 22V4" />
      <path d="M4 4h13l-2 4 2 4H4" />
    </>
  ),
  print: (
    <>
      <path d="M6 9V4h12v5M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      <path d="M19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    </>
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  command: <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.4V13" />
      <path d="M12 17v.01" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
}

export function Icon({ name, size = 16, style, className }: IconProps) {
  const content = paths[name] ?? <circle cx="12" cy="12" r="8" />;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `ic ${className}` : "ic"}
      style={style}
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}
