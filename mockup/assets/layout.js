/* Header + Footer dùng chung. Trang khai báo:
   <body data-nav="directory" data-auth="guest|user">  */
(function () {
  var NAV = [
    ['index.html', 'home', 'Trang chủ'],
    ['directory.html', 'directory', 'Doanh nghiệp'],
    ['marketplace.html', 'marketplace', 'Nhu cầu / Báo giá'],
    ['feed.html', 'feed', 'Tin tức'],
    ['pricing.html', 'pricing', 'Bảng giá'],
  ];

  function header(active, auth) {
    var links = NAV.map(function (n) {
      return '<a href="' + n[0] + '"' + (n[1] === active ? ' class="active"' : '') + '>' + n[2] + '</a>';
    }).join('');

    var actions = auth === 'user'
      ? '<a class="nav-icon" href="marketplace.html" title="Nhu cầu"><svg class="ic"><use href="#ic-briefcase"/></svg></a>' +
        '<a class="nav-icon" href="chat.html" title="Tin nhắn"><svg class="ic"><use href="#ic-chat"/></svg><span class="dot"></span></a>' +
        '<a class="nav-icon" href="dashboard.html" title="Thông báo"><svg class="ic"><use href="#ic-bell"/></svg><span class="dot"></span></a>' +
        '<a class="avatar-btn" href="dashboard.html">' +
          '<span class="logo-txt ava round" style="width:32px;height:32px;background:#12439c;font-size:12px">HB</span>' +
          '<span class="who">Hòa Bình<br><small>Quản trị viên</small></span>' +
        '</a>'
      : '<a class="btn btn-ghost" href="auth.html">Đăng nhập</a>' +
        '<a class="btn btn-orange" href="auth.html#register">Đăng ký</a>';

    return '' +
    '<header class="site"><div class="container nav">' +
      '<a class="brand" href="index.html">' +
        '<img class="logo" src="assets/logo.png" alt="Sàn Xây Dựng" onerror="this.style.display=\'none\'"/>' +
        '<div><b>SÀN XÂY DỰNG</b><span>Kết nối · Tương lai vững chắc</span></div>' +
      '</a>' +
      '<input type="checkbox" id="navtoggle" class="nav-toggle"/>' +
      '<label for="navtoggle" class="hamburger" aria-label="Mở menu"><span></span><span></span><span></span></label>' +
      '<div class="nav-menu-wrap">' +
        '<nav class="menu">' + links + '</nav>' +
        '<div class="nav-actions">' + actions + '</div>' +
      '</div>' +
    '</div></header>';
  }

  function footer() {
    return '' +
    '<footer class="site"><div class="container">' +
      '<div class="foot-grid">' +
        '<div>' +
          '<div class="brand" style="display:flex;gap:10px;align-items:center">' +
            '<img src="assets/logo.png" alt="" style="width:42px;height:42px;border-radius:9px" onerror="this.style.display=\'none\'"/>' +
            '<div><b>SÀN XÂY DỰNG</b><br><span style="font-size:11px">Kết nối · Tương lai vững chắc</span></div>' +
          '</div>' +
          '<p class="foot-desc">Nền tảng B2B kết nối hệ sinh thái doanh nghiệp xây dựng Việt Nam: nhà thầu, đội thi công, nhà cung cấp và chủ đầu tư — hồ sơ năng lực số & Trust Score minh bạch.</p>' +
        '</div>' +
        '<div><h4>Khám phá</h4><ul>' +
          '<li><a href="directory.html">Tìm doanh nghiệp</a></li>' +
          '<li><a href="marketplace.html">Nhu cầu &amp; báo giá</a></li>' +
          '<li><a href="feed.html">Tin tức ngành</a></li>' +
          '<li><a href="company.html">Hồ sơ mẫu</a></li>' +
        '</ul></div>' +
        '<div><h4>Dành cho doanh nghiệp</h4><ul>' +
          '<li><a href="auth.html#register">Đăng ký / Claim hồ sơ</a></li>' +
          '<li><a href="verify.html">Xác minh doanh nghiệp</a></li>' +
          '<li><a href="pricing.html">Gói thành viên</a></li>' +
          '<li><a href="dashboard.html">Bảng điều khiển</a></li>' +
        '</ul></div>' +
        '<div><h4>Liên hệ</h4><ul>' +
          '<li><svg class="ic"><use href="#ic-phone"/></svg> 1900 xxxx</li>' +
          '<li><svg class="ic"><use href="#ic-mail"/></svg> hotro@sanxaydung.vn</li>' +
          '<li><svg class="ic"><use href="#ic-pin"/></svg> Hà Nội, Việt Nam</li>' +
        '</ul></div>' +
      '</div>' +
      '<div class="foot-bottom">© 2026 Sàn Xây Dựng · Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.</div>' +
    '</div></footer>';
  }

  function build() {
    var active = document.body.getAttribute('data-nav') || '';
    var auth = document.body.getAttribute('data-auth') || 'guest';
    var h = document.querySelector('[data-slot="header"]');
    var f = document.querySelector('[data-slot="footer"]');
    if (h) h.outerHTML = header(active, auth);
    if (f) f.outerHTML = footer();
  }
  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
