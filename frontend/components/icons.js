// Single-path icons drawn at 24×24, matching the imported design. Kept as raw path
// data so they can be handed to both <Icon> and inline SVGs in charts and tiles.
export const ICON = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  pos: 'M4 4h2l2.7 12.4a1 1 0 0 0 1 .8h7.7a1 1 0 0 0 1-.8L21 8H6 M9 21h.01 M18 21h.01',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10',
  truck: 'M1 8h13v9H1z M14 11h4l3 3v3h-7z M5.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1 M17 5a3 3 0 0 1 0 6',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  tag: 'M20 12l-8 8-9-9V3h8z M7 7h.01',
  shield: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z M9 12l2 2 4-4',
  money: 'M2 7h20v10H2z M2 11h20',
  card: 'M3 5h18v14H3z M3 10h18',
  mobile: 'M7 2h10v20H7z M11 18h2',
  cart: 'M4 4h2l2.7 12.4a1 1 0 0 0 1 .8h7.7a1 1 0 0 0 1-.8L21 8H6',
  profit: 'M3 17l6-6 4 4 8-8 M14 7h7v7',
  alert: 'M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  check: 'M20 6 9 17l-5-5',
  db: 'M12 8c5 0 8-1.3 8-3s-3-3-8-3-8 1.3-8 3 3 3 8 3z M4 5v14c0 1.7 3 3 8 3s8-1.3 8-3V5',
  edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  barcode: 'M3 5v14 M7 5v14 M11 5v14 M15 5v14 M19 5v14',
  plus: 'M12 5v14 M5 12h14',
  print: 'M6 9V3h12v6 M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2 M6 14h12v7H6z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  home: 'M3 9l9-6 9 6v10a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1z',
  undo: 'M3 7v6h6 M3.5 13a9 9 0 1 0 2.6-6.4L3 9',
  trash: 'M3 6h18 M8 6V4h8v2 M19 6l-1 15H6L5 6',
  key: 'M14.5 10.5a4 4 0 1 0-5 3.9V17h2v2h2v-2.2l1-1V13h2v-2.5z',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  close: 'M18 6 6 18 M6 6l12 12',
  wallet: 'M3 6h15a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1z M17 13h.01',
  download: 'M12 3v12 M7 11l5 5 5-5 M4 21h16',
  signal: 'M4 20v-4 M9 20V11 M14 20V7 M19 20V3',
  receipt: 'M5 21V3h14v18l-3-2-2 2-2-2-2 2-2-2z M9 8h6 M9 12h6'
};

/** 24×24 stroked glyph. `d` is one of the ICON entries. */
export default function Icon({ d, size = 20, stroke = 'currentColor', width = 1.8, style }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={stroke}
      strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
      <path d={d}></path>
    </svg>
  );
}
