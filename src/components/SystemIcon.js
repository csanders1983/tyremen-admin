const paths = {
  home: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  workshop: "M4 20V8l8-5 8 5v12 M8 20v-8h8v8 M2 20h20",
  jobs: "M8 4H5v17h14V4h-3 M8 2h8v5H8z M8 11h8 M8 15h5",
  calendar: "M4 5h16v16H4z M4 10h16 M8 2v6 M16 2v6 M8 14h2 M14 14h2",
  sales: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6",
  people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4",
  stock: "M3 7l9-5 9 5v10l-9 5-9-5z M3 7l9 5 9-5 M12 12v10 M8 4l9 5",
  pricing: "M3 3h8l10 10-8 8L3 11z M7 7h.01",
  pages: "M3 4h18v16H3z M3 9h18 M8 9v11",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6",
  plus: "M12 5v14 M5 12h14", menu: "M3 6h18 M3 12h18 M3 18h18", arrow: "M5 12h14 M13 6l6 6-6 6", close: "M6 6l12 12 M18 6L6 18",
};
export default function SystemIcon({ name, size = 19 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.pages} /></svg>;
}
