// Hand-drawn UI icon set (24×24 viewBox). Resource icons are multi-colour, tool icons use currentColor.
const s = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;

export const ICON = {
  coin: s(`<circle cx="12" cy="12" r="10" fill="#f2b024"/><circle cx="12" cy="12" r="7.6" fill="#ffd45c"/><path d="M12 6.8v10.4M9.2 9.2c0-1.2 1.2-1.9 2.8-1.9s2.8.8 2.8 1.9-1 1.6-2.8 2-2.9.9-2.9 2.1 1.3 2 2.9 2 2.9-.8 2.9-2" stroke="#b97a0e" stroke-width="1.6" fill="none" stroke-linecap="round"/>`),
  crystal: s(`<path d="M12 2.5 20 9l-8 12.5L4 9z" fill="#2bb6e3"/><path d="M12 2.5 16 9h-8z" fill="#8fe3ff"/><path d="M8 9h8l-4 12.5z" fill="#1592c6"/><path d="M4 9h4l4 12.5z" fill="#46c9f0"/>`),
  people: s(`<circle cx="9" cy="8" r="3.4" fill="#7cc4ff"/><path d="M2.8 19.5c.4-3.8 3-5.9 6.2-5.9s5.8 2.1 6.2 5.9z" fill="#7cc4ff"/><circle cx="16.5" cy="9" r="2.8" fill="#4d9de6"/><path d="M14 13.9c3.6-.6 6.7 1.4 7.2 5.6h-5c-.2-2.4-1-4.2-2.2-5.6z" fill="#4d9de6"/>`),
  smile: s(`<circle cx="12" cy="12" r="10" fill="#ffd34d"/><circle cx="8.6" cy="10" r="1.3" fill="#7a5200"/><circle cx="15.4" cy="10" r="1.3" fill="#7a5200"/><path d="M7.8 14c1 1.7 2.5 2.6 4.2 2.6s3.2-.9 4.2-2.6" stroke="#7a5200" stroke-width="1.7" fill="none" stroke-linecap="round"/>`),
  meh: s(`<circle cx="12" cy="12" r="10" fill="#ffb84d"/><circle cx="8.6" cy="10" r="1.3" fill="#6b3d00"/><circle cx="15.4" cy="10" r="1.3" fill="#6b3d00"/><path d="M8 15.5h8" stroke="#6b3d00" stroke-width="1.7" stroke-linecap="round"/>`),
  sad: s(`<circle cx="12" cy="12" r="10" fill="#ff7a5c"/><circle cx="8.6" cy="10" r="1.3" fill="#5a1400"/><circle cx="15.4" cy="10" r="1.3" fill="#5a1400"/><path d="M7.8 16.6c1-1.6 2.5-2.4 4.2-2.4s3.2.8 4.2 2.4" stroke="#5a1400" stroke-width="1.7" fill="none" stroke-linecap="round"/>`),
  box: s(`<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" fill="#d79a55"/><path d="M3 7.5 12 12l9-4.5L12 3z" fill="#f0bb78"/><path d="M12 12v9l9-4.5v-9z" fill="#b97a3c"/><path d="m7.4 5.3 9 4.5v3.4" stroke="#fff3df" stroke-width="1.6" fill="none"/>`),
  xp: s(`<path d="m12 2.6 2.8 5.8 6.3.8-4.6 4.4 1.2 6.3L12 16.8l-5.7 3.1 1.2-6.3L2.9 9.2l6.3-.8z" fill="#ffd34d" stroke="#e8a210" stroke-width="1.2" stroke-linejoin="round"/>`),
  power: s(`<path d="M13.5 2 5 13.5h6L9.8 22 19 9.8h-6.2z" fill="#ffc531" stroke="#d68f00" stroke-width="1" stroke-linejoin="round"/>`),
  water: s(`<path d="M12 2.8c3.6 4.6 6.4 8.4 6.4 11.6a6.4 6.4 0 0 1-12.8 0C5.6 11.2 8.4 7.4 12 2.8z" fill="#3fb0ef"/><path d="M9 14.4a3 3 0 0 0 3 3" stroke="#d5f1ff" stroke-width="1.6" fill="none" stroke-linecap="round"/>`),
  sewage: s(`<rect x="3" y="9" width="18" height="6" rx="3" fill="#8b7a5a"/><circle cx="7.5" cy="12" r="1.4" fill="#d9c9a3"/><circle cx="12" cy="12" r="1.4" fill="#d9c9a3"/><circle cx="16.5" cy="12" r="1.4" fill="#d9c9a3"/>`),
  waste: s(`<path d="M6 7h12l-1.2 13.2a1.6 1.6 0 0 1-1.6 1.5H8.8a1.6 1.6 0 0 1-1.6-1.5z" fill="#6aa86a"/><rect x="4.5" y="4.6" width="15" height="2.6" rx="1.2" fill="#4f8a4f"/><rect x="10" y="2.6" width="4" height="2.2" rx="1" fill="#4f8a4f"/><path d="M10 10v8M14 10v8" stroke="#e4f5e4" stroke-width="1.5" stroke-linecap="round"/>`),
  fire: s(`<path d="M12 2.5c1 3.4 4.8 5.2 4.8 10.2a4.8 4.8 0 0 1-9.6 0c0-2.2 1-3.6 2.1-4.6.2 1.6.9 2.5 1.8 2.9C10.6 8 11 5.2 12 2.5z" fill="#ff6a3d"/><path d="M12 12.5c.8 1.4 2 2 2 3.6a2 2 0 0 1-4 0c0-1.3.9-2.1 2-3.6z" fill="#ffd34d"/>`),
  police: s(`<path d="M12 2.6 19.5 5.4v5.8c0 5-3.2 8.6-7.5 10.2-4.3-1.6-7.5-5.2-7.5-10.2V5.4z" fill="#2f6ddb"/><path d="m12 7.2 1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill="#ffd34d"/>`),
  health: s(`<rect x="3" y="3" width="18" height="18" rx="5" fill="#ff5d6c"/><path d="M12 7v10M7 12h10" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>`),
  road: s(`<path d="M7 2 3 22h18L17 2z" fill="#596270"/><path d="M12 4v3M12 10v3.5M12 17v3.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`),
  home: s(`<path d="M3.5 11 12 3.8l8.5 7.2V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" fill="#ff8a5b"/><path d="M2.4 11.6 12 3.4l9.6 8.2" stroke="#c94f2a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="9.6" y="13.6" width="4.8" height="7.4" rx=".6" fill="#7a3a1f"/>`),
  bolt: s(`<path d="M13.5 2 5 13.5h6L9.8 22 19 9.8h-6.2z" fill="#ffc531" stroke="#d68f00" stroke-width="1" stroke-linejoin="round"/>`),
  shield: s(`<path d="M12 2.6 19.5 5.4v5.8c0 5-3.2 8.6-7.5 10.2-4.3-1.6-7.5-5.2-7.5-10.2V5.4z" fill="#4d8de6"/><path d="M12 6v12M8 10h8" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`),
  factory: s(`<path d="M2.5 21V11l5 3V11l5 3V11l5 3V4h4v17z" fill="#8c9aab"/><rect x="5" y="16" width="3" height="3" fill="#ffd34d"/><rect x="10" y="16" width="3" height="3" fill="#ffd34d"/><rect x="15" y="16" width="3" height="3" fill="#ffd34d"/>`),
  shop: s(`<rect x="3.5" y="10" width="17" height="11" rx="1" fill="#f3efe6"/><path d="M2.5 9.5 4.6 4h14.8l2.1 5.5c0 1.5-1.2 2.5-2.6 2.5-1.5 0-2.7-1-2.7-2.5 0 1.5-1.2 2.5-2.6 2.5S11 11 11 9.5c0 1.5-1.2 2.5-2.6 2.5S5.7 11 5.7 9.5C5.7 11 4.6 12 3.6 12z" fill="#ff6a5c"/><rect x="9.4" y="14" width="5.2" height="7" rx=".5" fill="#5b8fd6"/>`),
  tree: s(`<rect x="10.8" y="14" width="2.4" height="7.5" rx=".8" fill="#8a5a36"/><circle cx="12" cy="9.5" r="6.8" fill="#53b04c"/><circle cx="9.4" cy="8" r="2.6" fill="#78cc68"/>`),
  close: s(`<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>`),
  check: s(`<path d="m4.5 12.5 5 5L19.5 7" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  rotate: s(`<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M19.8 3.5v5.2h-5.2" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  move: s(`<path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="m9 5.6 3-3 3 3M9 18.4l3 3 3-3M5.6 9l-3 3 3 3M18.4 9l3 3-3 3" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  bulldoze: s(`<path d="M3 15h11.5l2-5H8.6L7 13H3z" fill="currentColor"/><rect x="2.5" y="16" width="13" height="4.2" rx="2.1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16.5 10.5 21 8.5v9l-4.5-1.5" fill="currentColor"/>`),
  eye: s(`<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>`),
  list: s(`<rect x="4" y="3" width="16" height="18" rx="2.5" fill="#fffaf0" stroke="#c99a4e" stroke-width="1.6"/><path d="M8 8.5h8M8 12.5h8M8 16.5h5" stroke="#c99a4e" stroke-width="1.8" stroke-linecap="round"/>`),
  gear: s(`<path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zm8.4 5.1-1.9.4a6.9 6.9 0 0 1-.8 1.9l1.1 1.6-1.9 1.9-1.6-1.1a6.9 6.9 0 0 1-1.9.8l-.4 1.9h-2.7l-.4-1.9a6.9 6.9 0 0 1-1.9-.8l-1.6 1.1-1.9-1.9 1.1-1.6a6.9 6.9 0 0 1-.8-1.9l-1.9-.4v-2.7l1.9-.4c.2-.7.4-1.3.8-1.9L4.4 6.6l1.9-1.9 1.6 1.1c.6-.4 1.2-.6 1.9-.8l.4-1.9h2.7l.4 1.9c.7.2 1.3.4 1.9.8l1.6-1.1 1.9 1.9-1.1 1.6c.4.6.6 1.2.8 1.9l1.9.4z" fill="currentColor"/>`),
  up: s(`<circle cx="12" cy="12" r="10" fill="#36c26b"/><path d="M12 17V7.5M7.5 11.5 12 7l4.5 4.5" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  clock: s(`<circle cx="12" cy="12" r="9.5" fill="#fff" stroke="currentColor" stroke-width="2"/><path d="M12 6.8V12l3.4 2.2" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>`),
  train: s(`<rect x="5" y="3" width="14" height="14" rx="3" fill="#e2574c"/><rect x="7.2" y="5.4" width="9.6" height="5" rx="1" fill="#cfe8ff"/><circle cx="8.6" cy="13.8" r="1.3" fill="#ffd34d"/><circle cx="15.4" cy="13.8" r="1.3" fill="#ffd34d"/><path d="m7 21 2-4M17 21l-2-4" stroke="#4b5563" stroke-width="2" stroke-linecap="round"/>`),
  market: s(`<path d="M3 9.2h18l-1.6-5H4.6z" fill="#3cae7e"/><path d="M3 9.2c0 1.4 1 2.3 2.3 2.3s2.2-.9 2.2-2.3c0 1.4 1 2.3 2.2 2.3s2.3-.9 2.3-2.3c0 1.4 1 2.3 2.2 2.3s2.3-.9 2.3-2.3c0 1.4 1 2.3 2.2 2.3S21 10.6 21 9.2" fill="#fff" stroke="#3cae7e" stroke-width="1.2"/><rect x="4.5" y="11.6" width="15" height="9.4" rx="1" fill="#f6efe2"/><rect x="9.5" y="14.4" width="5" height="6.6" fill="#c08a4a"/>`),
  land: s(`<path d="M2.5 18.5 9 6l4.5 8 2.5-4 5.5 8.5z" fill="#6aa84f"/><path d="M9 6l1.8 3.3-1.8-.6-1.6.9z" fill="#fff"/><path d="M15.5 4v6" stroke="#8a5a36" stroke-width="1.5"/><path d="M15.5 4h4l-1.2 1.4 1.2 1.4h-4z" fill="#ff5d5d"/>`),
  stats: s(`<rect x="3.5" y="12" width="4" height="8.5" rx="1" fill="#4d9de6"/><rect x="10" y="7" width="4" height="13.5" rx="1" fill="#36c26b"/><rect x="16.5" y="3.5" width="4" height="17" rx="1" fill="#ffb84d"/>`),
  lock: s(`<rect x="5" y="10.5" width="14" height="10.5" rx="2.4" fill="#9aa4b0"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="#9aa4b0" stroke-width="2.4" fill="none"/>`),
  zzz: s(`<path d="M5 7h5l-5 6h5M13 4h4l-4 5h4M15.5 13h4.5l-4.5 6h4.5" stroke="#7d8da0" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  sound: s(`<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.6a7.6 7.6 0 0 1 0 10.8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>`),
  cloud: s(`<path d="M7 19a5 5 0 0 1-.6-9.96A6.5 6.5 0 0 1 19 9.5 4.75 4.75 0 0 1 18.2 19z" fill="#8fd0ff"/><path d="M12 11v6M9.5 14.5 12 17l2.5-2.5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
};

export function icon(name, cls = '') {
  return `<span class="ic ${cls}">${ICON[name] || ''}</span>`;
}
