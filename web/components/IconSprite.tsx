// SVG icon sprite — render once in layout; reference with <use href="#ic-...">.
export default function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      {/* ── Layout & homepage ── */}
      <symbol id="ic-building" viewBox="0 0 24 24"><path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 21V9h3a1 1 0 0 1 1 1v11M8 8h1M11.5 8h1M8 12h1M11.5 12h1M8 16h1M11.5 16h1"/></symbol>
      <symbol id="ic-clipboard" viewBox="0 0 24 24"><path d="M9 4h6v2H9zM8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M8.5 11h7M8.5 15h5"/></symbol>
      <symbol id="ic-people" viewBox="0 0 24 24"><path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.75"/></symbol>
      <symbol id="ic-star" viewBox="0 0 24 24"><path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47L2.6 9.35l6.5-.95L12 2.5z"/></symbol>
      <symbol id="ic-doc" viewBox="0 0 24 24"><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4zM14 3v4h4M9 12h6M9 16h6M9 8h2"/></symbol>
      <symbol id="ic-worker" viewBox="0 0 24 24"><path d="M3 14h18M5 14a7 7 0 0 1 14 0M10 5.2V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.2M3 14v1a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1"/></symbol>
      <symbol id="ic-water" viewBox="0 0 24 24"><path d="M12 3s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.4 12 3 12 3zM9.5 13.5a2.5 2.5 0 0 0 2.5 2.5"/></symbol>
      <symbol id="ic-paint" viewBox="0 0 24 24"><path d="M4 4h12v4H4zM16 6h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-6a1 1 0 0 0-1 1v2M10.5 14h3v2h-3zM11 16h2v5h-2z"/></symbol>
      <symbol id="ic-gear" viewBox="0 0 24 24"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 13a1.5 1.5 0 0 0 .3 1.65l.05.05a1.8 1.8 0 1 1-2.55 2.55l-.05-.05a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.9 1.37v.13a1.8 1.8 0 0 1-3.6 0v-.06a1.5 1.5 0 0 0-1-1.37 1.5 1.5 0 0 0-1.65.3l-.05.05a1.8 1.8 0 1 1-2.55-2.55l.05-.05a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.9H4.5a1.8 1.8 0 0 1 0-3.6h.06a1.5 1.5 0 0 0 1.37-1 1.5 1.5 0 0 0-.3-1.65l-.05-.05a1.8 1.8 0 1 1 2.55-2.55l.05.05a1.5 1.5 0 0 0 1.65.3H10a1.5 1.5 0 0 0 .9-1.37V4.5a1.8 1.8 0 0 1 3.6 0v.06a1.5 1.5 0 0 0 .9 1.37 1.5 1.5 0 0 0 1.65-.3l.05-.05a1.8 1.8 0 1 1 2.55 2.55l-.05.05a1.5 1.5 0 0 0-.3 1.65V10a1.5 1.5 0 0 0 1.37.9h.13a1.8 1.8 0 0 1 0 3.6h-.06a1.5 1.5 0 0 0-1.37.9z"/></symbol>
      <symbol id="ic-bricks" viewBox="0 0 24 24"><path d="M3 4h18v16H3zM3 9.5h18M3 15h18M9 4v5.5M15 4v5.5M6 9.5V15M12 9.5V15M18 9.5V15M9 15v5M15 15v5"/></symbol>
      <symbol id="ic-ruler" viewBox="0 0 24 24"><path d="M5 4v15a1 1 0 0 0 1 1h13zM5 4l15 16M9 16v-2M12.5 12.5v-2"/></symbol>
      <symbol id="ic-grid" viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></symbol>
      <symbol id="ic-search" viewBox="0 0 24 24"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35"/></symbol>
      <symbol id="ic-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
      <symbol id="ic-pin" viewBox="0 0 24 24"><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></symbol>
      <symbol id="ic-phone" viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z"/></symbol>
      <symbol id="ic-mail" viewBox="0 0 24 24"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3.5 6.5l8.5 6 8.5-6"/></symbol>
      <symbol id="ic-check" viewBox="0 0 24 24"><path d="M5 12l4 4 10-10"/></symbol>
      {/* ── Filled variants ── */}
      <symbol id="ic-building-f" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M12 4a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v16h-7V4Zm-8 5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v11H4V9Zm2 2.5h2v2H6v-2Zm3 0h1v2H9v-2Zm-3 4h2v2H6v-2Zm3 0h1v2H9v-2Zm5-9.5h2v2h-2v-2Zm0 4h2v2h-2v-2Zm0 4h2v2h-2v-2Z"/></symbol>
      <symbol id="ic-clipboard-f" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M10 2.6h4a1 1 0 0 1 1 1V4h1a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 16 20.5H8A1.5 1.5 0 0 1 6.5 19V5.5A1.5 1.5 0 0 1 8 4h1v-.4a1 1 0 0 1 1-1ZM9 9.4h6v1.5H9V9.4Zm0 3.2h6v1.5H9v-1.5Zm0 3.2h4v1.5H9v-1.5Z"/></symbol>
      <symbol id="ic-people-f" viewBox="0 0 24 24"><path d="M9 10a2.8 2.8 0 1 0 0-5.6A2.8 2.8 0 0 0 9 10Zm0 1.4c-3 0-5.5 1.7-5.5 4.2v2.2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2.2c0-2.5-2.5-4.2-5.5-4.2Zm7-2a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Zm.4 1.5c-.7 0-1.3.1-1.9.3 1.2 1 1.9 2.4 1.9 4v2.1h3.6a1 1 0 0 0 1-1V16c0-2.3-2.1-3.6-4.6-3.6Z"/></symbol>
      <symbol id="ic-star-f" viewBox="0 0 24 24"><path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47L2.6 9.35l6.5-.95L12 2.5z"/></symbol>
      {/* ── Navigation ── */}
      <symbol id="ic-chevron-right" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></symbol>
      <symbol id="ic-chevron-left" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></symbol>
      <symbol id="ic-chevron-down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></symbol>
      <symbol id="ic-x" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></symbol>
      {/* ── Actions & UI ── */}
      <symbol id="ic-edit" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></symbol>
      <symbol id="ic-download" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></symbol>
      <symbol id="ic-upload" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></symbol>
      <symbol id="ic-send" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></symbol>
      <symbol id="ic-dots" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></symbol>
      <symbol id="ic-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></symbol>
      <symbol id="ic-lock" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></symbol>
      <symbol id="ic-eye" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></symbol>
      {/* ── Status & badges ── */}
      <symbol id="ic-shield" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></symbol>
      <symbol id="ic-shield-check" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></symbol>
      <symbol id="ic-award" viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="M8.56 15.66L8 21l4-2.5L16 21l-.56-5.34"/><path d="M9.5 7l1 1.5L12 7l1.5 1.5L15 7"/></symbol>
      <symbol id="ic-heart" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></symbol>
      <symbol id="ic-tag" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/></symbol>
      <symbol id="ic-trending" viewBox="0 0 24 24"><path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6"/></symbol>
      <symbol id="ic-thumb" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></symbol>
      {/* ── Content ── */}
      <symbol id="ic-file-text" viewBox="0 0 24 24"><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4zM14 3v4h4M9 13h6M9 17h4M9 9h2"/></symbol>
      <symbol id="ic-image" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l5-5 4 4 3-3 4 4"/><circle cx="8.5" cy="8.5" r="1.5"/></symbol>
      <symbol id="ic-video" viewBox="0 0 24 24"><path d="M22.59 6.59l-6.59 4V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.59l6.59 4A1 1 0 0 0 24 17V7a1 1 0 0 0-1.41-.41z"/></symbol>
      <symbol id="ic-folder" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></symbol>
      <symbol id="ic-layers" viewBox="0 0 24 24"><path d="M12 2l10 6.5L12 15 2 8.5 12 2zM2 15.5L12 22l10-6.5M2 12l10 6.5 10-6.5"/></symbol>
      {/* ── Communication ── */}
      <symbol id="ic-chat" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></symbol>
      <symbol id="ic-bell" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></symbol>
      {/* ── Time & info ── */}
      <symbol id="ic-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></symbol>
      <symbol id="ic-calendar" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></symbol>
      {/* ── Business ── */}
      <symbol id="ic-briefcase" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v.01M8 12h8"/></symbol>
      <symbol id="ic-coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v1m0 8v1M9.5 9.5c.5-1 1.4-1.5 2.5-1.5s2.5.7 2.5 2-1 1.5-2.5 2-2.5 1-2.5 2.5 1.3 2 2.5 2 2.2-.5 2.5-1.5"/></symbol>
      <symbol id="ic-users" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></symbol>
      <symbol id="ic-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></symbol>
      <symbol id="ic-camera" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></symbol>
      <symbol id="ic-gift" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M21 12v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9M8 8a2 2 0 0 1 0-4c2 0 4 4 4 4M16 8a2 2 0 0 0 0-4c-2 0-4 4-4 4"/></symbol>
    </svg>
  );
}
