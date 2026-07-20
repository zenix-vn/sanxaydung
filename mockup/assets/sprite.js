/* Sàn Xây Dựng — bộ icon dùng chung cho toàn bộ mockup.
   Inject 1 lần vào đầu <body>; các trang tham chiếu qua <use href="#ic-...">. */
(function () {
  var SPRITE = `
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <symbol id="ic-building" viewBox="0 0 24 24"><path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 21V9h3a1 1 0 0 1 1 1v11M8 8h1M11.5 8h1M8 12h1M11.5 12h1M8 16h1M11.5 16h1"/></symbol>
    <symbol id="ic-clipboard" viewBox="0 0 24 24"><path d="M9 4h6v2H9zM8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M8.5 11h7M8.5 15h5"/></symbol>
    <symbol id="ic-people" viewBox="0 0 24 24"><path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.75"/></symbol>
    <symbol id="ic-star" viewBox="0 0 24 24"><path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47L2.6 9.35l6.5-.95L12 2.5z"/></symbol>
    <symbol id="ic-star-f" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47L2.6 9.35l6.5-.95L12 2.5z"/></symbol>
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
    <symbol id="ic-bell" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></symbol>
    <symbol id="ic-chat" viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 20.5l1.5-5.1A8.4 8.4 0 1 1 21 11.5z"/></symbol>
    <symbol id="ic-heart" viewBox="0 0 24 24"><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l1.7 1.7L12 21.5l7.1-7.1 1.7-1.7a5 5 0 0 0 0-7.1z"/></symbol>
    <symbol id="ic-eye" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></symbol>
    <symbol id="ic-filter" viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/></symbol>
    <symbol id="ic-map" viewBox="0 0 24 24"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></symbol>
    <symbol id="ic-upload" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v13"/></symbol>
    <symbol id="ic-download" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V2"/></symbol>
    <symbol id="ic-edit" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></symbol>
    <symbol id="ic-shield" viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3z"/></symbol>
    <symbol id="ic-shield-check" viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3z"/><path d="M9 12l2 2 4-4"/></symbol>
    <symbol id="ic-chevron-down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></symbol>
    <symbol id="ic-chevron-right" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></symbol>
    <symbol id="ic-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
    <symbol id="ic-arrow-left" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></symbol>
    <symbol id="ic-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
    <symbol id="ic-calendar" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></symbol>
    <symbol id="ic-tag" viewBox="0 0 24 24"><path d="M20.5 13.5 12 22l-9-9V4a1 1 0 0 1 1-1h9l7.5 7.5a2 2 0 0 1 0 3z"/><circle cx="7.5" cy="7.5" r="1.5"/></symbol>
    <symbol id="ic-briefcase" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></symbol>
    <symbol id="ic-coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5a3 3 0 0 0-3-1.5c-1.6 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2a3 3 0 0 1-3-1.5"/></symbol>
    <symbol id="ic-send" viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></symbol>
    <symbol id="ic-image" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5L5 20"/></symbol>
    <symbol id="ic-video" viewBox="0 0 24 24"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/></symbol>
    <symbol id="ic-lock" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></symbol>
    <symbol id="ic-users" viewBox="0 0 24 24"><path d="M17 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 20v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></symbol>
    <symbol id="ic-chart" viewBox="0 0 24 24"><path d="M3 3v18h18M7 15v3M12 10v8M17 6v12"/></symbol>
    <symbol id="ic-trending" viewBox="0 0 24 24"><path d="M22 7l-8.5 8.5-4-4L2 19M16 7h6v6"/></symbol>
    <symbol id="ic-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
    <symbol id="ic-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></symbol>
    <symbol id="ic-logout" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></symbol>
    <symbol id="ic-camera" viewBox="0 0 24 24"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/><circle cx="12" cy="13" r="3.5"/></symbol>
    <symbol id="ic-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.8 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.8-3.8-9S9.5 5.6 12 3z"/></symbol>
    <symbol id="ic-award" viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="M8.2 13.5 7 22l5-3 5 3-1.2-8.5"/></symbol>
    <symbol id="ic-layers" viewBox="0 0 24 24"><path d="M12 2 2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5"/></symbol>
    <symbol id="ic-folder" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></symbol>
    <symbol id="ic-hardhat" viewBox="0 0 24 24"><path d="M3 16a9 9 0 0 1 18 0M2 16h20v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2zM10 7.2V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2.2"/></symbol>
    <symbol id="ic-thumb" viewBox="0 0 24 24"><path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zM7 10l4-8a2.5 2.5 0 0 1 2.5 2.5V8h5a2 2 0 0 1 2 2.3l-1.2 8a2 2 0 0 1-2 1.7H7"/></symbol>
    <symbol id="ic-dots" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></symbol>
    <symbol id="ic-sliders" viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="16" cy="18" r="2"/></symbol>
    <symbol id="ic-file-text" viewBox="0 0 24 24"><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4zM14 3v4h4"/><path d="M9 13h6M9 17h4"/></symbol>
    <symbol id="ic-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></symbol>
    <symbol id="ic-gift" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8S9.5 3 7 5s0 3 5 3zM12 8s2.5-5 5-3-0 3-5 3z"/></symbol>
    <symbol id="ic-menu" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></symbol>
  </svg>`;
  function inject() {
    var d = document.createElement('div');
    d.innerHTML = SPRITE;
    document.body.insertBefore(d.firstElementChild, document.body.firstChild);
  }
  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject);
})();
