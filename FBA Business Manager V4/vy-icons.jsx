// Lucide-style icon registry for the Vyonix Order Shell prototype.
// Mirrors the icon set used by src/components/layout in the repo.

const VY_ICON_PATHS = {
  // chrome
  chevronLeft:   <polyline points="15 18 9 12 15 6" />,
  chevronRight:  <polyline points="9 18 15 12 9 6" />,
  chevronDown:   <polyline points="6 9 12 15 18 9" />,
  chevronUp:     <polyline points="18 15 12 9 6 15" />,
  chevronsLeft:  <g><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></g>,
  chevronsRight: <g><polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" /></g>,
  menu:          <g><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></g>,
  x:             <g><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></g>,
  search:        <g><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.65" y2="16.65" /></g>,
  bell:          <g><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a2 2 0 0 0 3.4 0" /></g>,
  sun:           <g><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.07" y2="4.93" /></g>,
  moon:          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  plus:          <g><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></g>,
  more:          <g><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></g>,
  settings:      <g><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></g>,
  arrowRight:    <g><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></g>,
  arrowUpRight:  <g><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></g>,
  check:         <polyline points="20 6 9 17 4 12" />,
  alert:         <g><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></g>,
  info:          <g><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></g>,
  activity:      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  externalLink:  <g><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></g>,
  pencil:        <g><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4z" /></g>,
  user:          <g><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></g>,

  // nav (sidebar groups + items)
  dashboard:     <g><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></g>,
  amazon:        <g><path d="M3 7h18" /><path d="M5 7v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></g>,
  ops:           <g><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" /><polyline points="3.27 7 12 12 20.73 7" /><line x1="12" y1="22" x2="12" y2="12" /></g>,
  catalog:       <g><path d="M6 2h12v6H6z" /><path d="M3 8h18l-1.5 12.5a2 2 0 0 1-2 1.5h-11a2 2 0 0 1-2-1.5z" /></g>,
  money:         <g><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><line x1="6" y1="12" x2="6.01" y2="12" /><line x1="18" y1="12" x2="18.01" y2="12" /></g>,
  marketing:     <g><polygon points="3 11 13 11 21 3 21 21 13 13 3 13" /></g>,
  account:       <g><path d="M22 12s-3-7-10-7-10 7-10 7 3 7 10 7 10-7 10-7z" /><circle cx="12" cy="12" r="3" /></g>,
  business:      <g><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></g>,

  // operations / orders subnav
  orderHome:     <g><path d="M3 12 12 3l9 9" /><path d="M5 10v10h14V10" /></g>,
  cube:          <g><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" /><polyline points="3.27 7 12 12 20.73 7" /><line x1="12" y1="22" x2="12" y2="12" /></g>,
  hammer:        <g><path d="m15 12-8.5 8.5a2.12 2.12 0 0 1-3-3L12 9" /><path d="m17.64 15 3.18-3.18a4 4 0 0 0-5.66-5.66l-7.5 7.5" /></g>,
  truck:         <g><path d="M1 17h2V5h13v12h2" /><path d="M21 17V11l-3-3h-2v9" /><circle cx="6.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></g>,
  clipboard:     <g><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></g>,
  receipt:       <g><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="13" x2="14" y2="13" /></g>,
  closeout:      <g><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 9h6" /><path d="M9 13h6" /><path d="M9 17h4" /><circle cx="17.5" cy="17.5" r="2.5" /><path d="m16 17 1 1 2-2" /></g>,
  factory:       <g><path d="M2 20V8l5 3V8l5 3V8l5 3v9z" /><path d="M2 20h20" /><rect x="6" y="14" width="2" height="3" /><rect x="11" y="14" width="2" height="3" /><rect x="16" y="14" width="2" height="3" /></g>,
  route:         <g><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11A3.5 3.5 0 0 1 6 5h9" /><circle cx="18" cy="5" r="3" /></g>,
  calendar:      <g><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></g>,
  package:       <g><path d="M16.5 9.4 7.55 4.24" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></g>,
  ship:          <g><path d="M2 17a3 3 0 0 0 3 2h14a3 3 0 0 0 3-2" /><path d="M4 17 6 9h12l2 8" /><path d="M9 5h6v4H9z" /><line x1="12" y1="9" x2="12" y2="17" /></g>,
  shield:        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  mapPin:        <g><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></g>,
  dollar:        <g><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 1 1 0 7H6" /></g>,
  filter:        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,

  // shipping section
  link:          <g><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></g>,
  refresh:       <g><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></g>,
  fileText:      <g><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></g>,
  upload:        <g><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></g>,
  download:      <g><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></g>,
  trash:         <g><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></g>,
  boxes:         <g><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></g>,
  calculator:    <g><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="8" y2="10" /><line x1="12" y1="10" x2="12" y2="10" /><line x1="16" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="8" y2="14" /><line x1="12" y1="14" x2="12" y2="14" /><line x1="16" y1="14" x2="16" y2="18" /><line x1="8" y1="18" x2="12" y2="18" /></g>,
};

function VyIcon({ name, size = 14, strokeWidth = 2, style = {} }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none", display: "inline-block", ...style }}
      aria-hidden="true"
    >
      {VY_ICON_PATHS[name] || VY_ICON_PATHS.more}
    </svg>
  );
}

Object.assign(window, { VyIcon, VY_ICON_PATHS });
