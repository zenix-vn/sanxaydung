// SVG icon sprite (dùng lại từ mockup). Render 1 lần trong layout; tham chiếu bằng <use href="#ic-...">.
export default function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <symbol id="ic-building" viewBox="0 0 24 24"><path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 21V9h3a1 1 0 0 1 1 1v11M8 8h1M11.5 8h1M8 12h1M11.5 12h1M8 16h1M11.5 16h1" /></symbol>
      <symbol id="ic-clipboard" viewBox="0 0 24 24"><path d="M9 4h6v2H9zM8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M8.5 11h7M8.5 15h5" /></symbol>
      <symbol id="ic-people" viewBox="0 0 24 24"><path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.75" /></symbol>
      <symbol id="ic-star" viewBox="0 0 24 24"><path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47L2.6 9.35l6.5-.95L12 2.5z" /></symbol>
      <symbol id="ic-doc" viewBox="0 0 24 24"><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4zM14 3v4h4M9 12h6M9 16h6M9 8h2" /></symbol>
      <symbol id="ic-worker" viewBox="0 0 24 24"><path d="M3 14h18M5 14a7 7 0 0 1 14 0M10 5.2V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.2M3 14v1a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" /></symbol>
      <symbol id="ic-water" viewBox="0 0 24 24"><path d="M12 3s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.4 12 3 12 3zM9.5 13.5a2.5 2.5 0 0 0 2.5 2.5" /></symbol>
      <symbol id="ic-paint" viewBox="0 0 24 24"><path d="M4 4h12v4H4zM16 6h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-6a1 1 0 0 0-1 1v2M10.5 14h3v2h-3zM11 16h2v5h-2z" /></symbol>
      <symbol id="ic-gear" viewBox="0 0 24 24"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M19.4 13a1.5 1.5 0 0 0 .3 1.65l.05.05a1.8 1.8 0 1 1-2.55 2.55l-.05-.05a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.9 1.37v.13a1.8 1.8 0 0 1-3.6 0v-.06a1.5 1.5 0 0 0-1-1.37 1.5 1.5 0 0 0-1.65.3l-.05.05a1.8 1.8 0 1 1-2.55-2.55l.05-.05a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.9H4.5a1.8 1.8 0 0 1 0-3.6h.06a1.5 1.5 0 0 0 1.37-1 1.5 1.5 0 0 0-.3-1.65l-.05-.05a1.8 1.8 0 1 1 2.55-2.55l.05.05a1.5 1.5 0 0 0 1.65.3H10a1.5 1.5 0 0 0 .9-1.37V4.5a1.8 1.8 0 0 1 3.6 0v.06a1.5 1.5 0 0 0 .9 1.37 1.5 1.5 0 0 0 1.65-.3l.05-.05a1.8 1.8 0 1 1 2.55 2.55l-.05.05a1.5 1.5 0 0 0-.3 1.65V10a1.5 1.5 0 0 0 1.37.9h.13a1.8 1.8 0 0 1 0 3.6h-.06a1.5 1.5 0 0 0-1.37.9z" /></symbol>
      <symbol id="ic-bricks" viewBox="0 0 24 24"><path d="M3 4h18v16H3zM3 9.5h18M3 15h18M9 4v5.5M15 4v5.5M6 9.5V15M12 9.5V15M18 9.5V15M9 15v5M15 15v5" /></symbol>
      <symbol id="ic-ruler" viewBox="0 0 24 24"><path d="M5 4v15a1 1 0 0 0 1 1h13zM5 4l15 16M9 16v-2M12.5 12.5v-2" /></symbol>
      <symbol id="ic-grid" viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></symbol>
      <symbol id="ic-search" viewBox="0 0 24 24"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" /></symbol>
      <symbol id="ic-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
      <symbol id="ic-pin" viewBox="0 0 24 24"><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></symbol>
      <symbol id="ic-phone" viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" /></symbol>
      <symbol id="ic-mail" viewBox="0 0 24 24"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3.5 6.5l8.5 6 8.5-6" /></symbol>
      <symbol id="ic-check" viewBox="0 0 24 24"><path d="M5 12l4 4 10-10" /></symbol>
      <symbol id="ic-building-f" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M12 4a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v16h-7V4Zm-8 5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v11H4V9Zm2 2.5h2v2H6v-2Zm3 0h1v2H9v-2Zm-3 4h2v2H6v-2Zm3 0h1v2H9v-2Zm5-9.5h2v2h-2v-2Zm0 4h2v2h-2v-2Zm0 4h2v2h-2v-2Z" /></symbol>
      <symbol id="ic-clipboard-f" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M10 2.6h4a1 1 0 0 1 1 1V4h1a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 16 20.5H8A1.5 1.5 0 0 1 6.5 19V5.5A1.5 1.5 0 0 1 8 4h1v-.4a1 1 0 0 1 1-1ZM9 9.4h6v1.5H9V9.4Zm0 3.2h6v1.5H9v-1.5Zm0 3.2h4v1.5H9v-1.5Z" /></symbol>
      <symbol id="ic-people-f" viewBox="0 0 24 24"><path d="M9 10a2.8 2.8 0 1 0 0-5.6A2.8 2.8 0 0 0 9 10Zm0 1.4c-3 0-5.5 1.7-5.5 4.2v2.2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2.2c0-2.5-2.5-4.2-5.5-4.2Zm7-2a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Zm.4 1.5c-.7 0-1.3.1-1.9.3 1.2 1 1.9 2.4 1.9 4v2.1h3.6a1 1 0 0 0 1-1V16c0-2.3-2.1-3.6-4.6-3.6Z" /></symbol>
      <symbol id="ic-star-f" viewBox="0 0 24 24"><path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47L2.6 9.35l6.5-.95L12 2.5z" /></symbol>
    </svg>
  );
}
