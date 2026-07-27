import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Tin nhắn' };

const CONVS = [
  { initials: 'SG', bg: '#0d6b3f', name: 'CTCP Đầu tư Sài Gòn', time: '10:24', last: 'Bên mình xem hồ sơ rồi, mời qua trao đổi…', online: true, active: true },
  { initials: 'CT', bg: '#111', name: 'Coteccons', time: '09:12', last: 'Đã gửi báo giá 49 tỷ', unread: 2, bold: true },
  { initials: 'DL', bg: '#17479e', name: 'Delta Group', time: 'Hôm qua', last: 'Cảm ơn anh, mình sẽ gửi bản vẽ…', online: true },
  { initials: 'HP', bg: '#b5610f', name: 'Thép Hòa Phát', time: 'T2', last: 'Giá thép D16 hôm nay là…' },
];

export default function ChatPage() {
  return (
    <>
      <style>{`
        .chat-wrap{display:grid;grid-template-columns:320px 1fr 280px;height:calc(100vh - 66px);background:#fff}
        .clist{border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
        .clist .csearch{padding:14px;border-bottom:1px solid var(--line)}
        .clist .csearch .input{padding:9px 9px 9px 36px;background:#f6f8fb;border:none;font-size:13.5px;width:100%;border-radius:8px}
        .conv{display:flex;gap:11px;padding:13px 14px;border-bottom:1px solid var(--line-2);cursor:pointer}
        .conv:hover{background:#fafbfc}
        .conv.active{background:var(--orange-soft)}
        .conv .ava{width:46px;height:46px;border-radius:11px;font-weight:800;color:#fff;display:grid;place-items:center;flex:none;position:relative;font-size:15px}
        .conv .ava .on{position:absolute;bottom:-1px;right:-1px;width:12px;height:12px;background:var(--green);border:2px solid #fff;border-radius:50%}
        .conv .mid{flex:1;min-width:0}
        .conv .mid .r1{display:flex;justify-content:space-between;gap:8px}
        .conv h4{font-size:13.5px;font-weight:700;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .conv small{font-size:11px;color:var(--muted);white-space:nowrap}
        .conv p{font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
        .conv .unread{background:var(--orange);color:#fff;font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:grid;place-items:center;padding:0 5px}
        .cthread{display:flex;flex-direction:column;min-height:0;flex:1}
        .cthead{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line)}
        .cthead .ava{width:42px;height:42px;border-radius:10px;font-weight:800;color:#fff;display:grid;place-items:center;flex:none;font-size:15px}
        .cthead h3{font-size:15px;font-weight:700;color:var(--navy);display:flex;align-items:center;gap:6px}
        .cthead small{font-size:12px;color:var(--green)}
        .ctx-bar{background:#fafbfc;border-bottom:1px solid var(--line);padding:10px 18px;font-size:12.5px;color:var(--muted);display:flex;align-items:center;gap:8px}
        .ctx-bar svg{width:15px;height:15px;color:var(--orange)}
        .msgs{flex:1;overflow-y:auto;padding:20px 18px;display:flex;flex-direction:column;gap:12px;background:#f7f9fb}
        .day{text-align:center;font-size:11.5px;color:var(--muted);margin:6px 0}
        .msg{max-width:70%;padding:10px 14px;border-radius:14px;font-size:13.5px;line-height:1.5}
        .msg.them{background:#fff;border:1px solid var(--line);border-bottom-left-radius:4px;align-self:flex-start}
        .msg.me{background:var(--navy);color:#fff;border-bottom-right-radius:4px;align-self:flex-end}
        .msg .t{font-size:10.5px;opacity:.6;margin-top:4px;text-align:right}
        .quote-msg{align-self:flex-start;max-width:78%;background:#fff;border:1px solid var(--orange);border-radius:14px;overflow:hidden}
        .quote-msg .qh{background:var(--orange-soft);padding:10px 14px;font-size:12.5px;font-weight:700;color:var(--orange);display:flex;align-items:center;gap:6px}
        .quote-msg .qb{padding:12px 14px}
        .quote-msg .amt{font-size:20px;font-weight:800;color:var(--green)}
        .quote-msg .row2{display:flex;gap:8px;margin-top:10px}
        .composer2{border-top:1px solid var(--line);padding:12px 16px;display:flex;gap:10px;align-items:center}
        .composer2 .tools{display:flex;gap:4px}
        .composer2 .tools a{width:38px;height:38px;border-radius:9px;display:grid;place-items:center;color:var(--muted);cursor:pointer}
        .composer2 .tools a:hover{background:#f6f8fb;color:var(--orange)}
        .composer2 input{flex:1;border:1px solid var(--line);border-radius:22px;padding:11px 16px;font-size:14px;background:#f6f8fb}
        .cinfo{border-left:1px solid var(--line);padding:20px 16px;overflow-y:auto;min-width:0}
        .cinfo .ava-lg{width:64px;height:64px;border-radius:14px;font-weight:800;color:#fff;display:grid;place-items:center;font-size:22px;margin:0 auto 10px}
        .cinfo .kv{display:flex;justify-content:space-between;font-size:13px;padding:7px 0;border-bottom:1px dashed var(--line-2)}
        .cinfo .kv .k{color:var(--muted)}.cinfo .kv .v{font-weight:600;color:var(--navy)}
        @media(max-width:1024px){.chat-wrap{grid-template-columns:300px 1fr}.cinfo{display:none}}
        @media(max-width:760px){.chat-wrap{grid-template-columns:1fr}.clist{display:none}}
      `}</style>

      <div className="chat-wrap">
        {/* Conversation list */}
        <div className="clist">
          <div className="csearch">
            <div style={{ position: 'relative' }}>
              <svg className="ic" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--muted)' }}>
                <use href="#ic-search" />
              </svg>
              <input className="input" placeholder="Tìm hội thoại…" />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {CONVS.map((c) => (
              <div key={c.name} className={`conv${c.active ? ' active' : ''}`}>
                <span className="ava" style={{ background: c.bg }}>
                  {c.initials}
                  {c.online && <span className="on" />}
                </span>
                <div className="mid">
                  <div className="r1">
                    <h4>{c.name}</h4>
                    <small>{c.time}</small>
                  </div>
                  <p style={c.bold ? { color: 'var(--navy)', fontWeight: 600 } : {}}>{c.last}</p>
                </div>
                {c.unread && <span className="unread">{c.unread}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className="cthread">
          <div className="cthead">
            <span className="ava" style={{ background: '#0d6b3f' }}>SG</span>
            <div style={{ flex: 1 }}>
              <h3>
                CTCP Đầu tư Sài Gòn
                <svg className="ic" style={{ width: 15, height: 15, color: 'var(--green)' }}><use href="#ic-shield-check" /></svg>
              </h3>
              <small>● Đang hoạt động</small>
            </div>
            <a className="btn btn-icon btn-outline" style={{ border: 'none' }} href="/cong-ty/dau-tu-sai-gon">
              <svg className="ic"><use href="#ic-eye" /></svg>
            </a>
            <a className="btn btn-icon btn-outline" style={{ border: 'none' }}>
              <svg className="ic"><use href="#ic-dots" /></svg>
            </a>
          </div>
          <div className="ctx-bar">
            <svg className="ic"><use href="#ic-briefcase" /></svg>
            Hội thoại gắn với tin: <b style={{ color: 'var(--navy)' }}>&nbsp;Cần tổng thầu tòa văn phòng 15 tầng</b>
            &nbsp;·&nbsp;
            <a href="/marketplace/1" style={{ color: 'var(--orange)', fontWeight: 600 }}>Xem tin</a>
          </div>

          <div className="msgs">
            <div className="day">Hôm nay</div>
            <div className="msg them">
              Chào Hòa Bình, bên mình đã xem hồ sơ năng lực của công ty. Rất ấn tượng với các công trình cao tầng đã thực hiện.
              <div className="t">10:05</div>
            </div>
            <div className="msg me">
              Cảm ơn anh! Hòa Bình có thể sắp xếp buổi khảo sát mặt bằng và trình bày biện pháp thi công chi tiết ạ.
              <div className="t">10:10</div>
            </div>
            <div className="quote-msg">
              <div className="qh">
                <svg className="ic"><use href="#ic-file-text" /></svg> Báo giá đã gửi
              </div>
              <div className="qb">
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Thi công tổng thầu · 18 tháng</div>
                <div className="amt">52.000.000.000 ₫</div>
                <div className="row2">
                  <a className="btn btn-outline btn-sm">
                    <svg className="ic"><use href="#ic-file-text" /></svg> Hồ sơ đính kèm.pdf
                  </a>
                </div>
              </div>
            </div>
            <div className="msg them">
              Bên mình xem hồ sơ rồi, mời qua văn phòng trao đổi chi tiết vào thứ 5 tuần này nhé. 14h chiều được không?
              <div className="t">10:24</div>
            </div>
            <div className="msg me">
              Dạ được ạ, Hòa Bình sẽ có mặt lúc 14h thứ 5. Em gửi trước bản tiến độ để anh tham khảo.
              <div className="t">10:26</div>
            </div>
          </div>

          <div className="composer2">
            <div className="tools">
              <a title="Đính kèm"><svg className="ic"><use href="#ic-folder" /></svg></a>
              <a title="Gửi báo giá"><svg className="ic"><use href="#ic-coin" /></svg></a>
              <a title="Ảnh"><svg className="ic"><use href="#ic-image" /></svg></a>
            </div>
            <input placeholder="Nhập tin nhắn…" />
            <button className="btn btn-orange btn-icon">
              <svg className="ic"><use href="#ic-send" /></svg>
            </button>
          </div>
        </div>

        {/* Info panel */}
        <aside className="cinfo">
          <div style={{ textAlign: 'center' }}>
            <div className="ava-lg" style={{ background: '#0d6b3f' }}>SG</div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)' }}>CTCP Đầu tư Sài Gòn</h3>
            <div className="verify legal" style={{ margin: '8px auto', display: 'inline-flex' }}>
              <svg className="ic"><use href="#ic-shield-check" /></svg> Đã xác minh
            </div>
            <a className="btn btn-outline btn-block btn-sm mt-8" href="/cong-ty/dau-tu-sai-gon">
              Xem hồ sơ
            </a>
          </div>
          <div className="divider" />
          <div className="kv"><span className="k">Trust Score</span><span className="v" style={{ color: 'var(--green)' }}>88</span></div>
          <div className="kv"><span className="k">Lĩnh vực</span><span className="v">Chủ đầu tư</span></div>
          <div className="kv"><span className="k">Khu vực</span><span className="v">TP.HCM</span></div>
          <div className="divider" />
          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Tài liệu đã chia sẻ</h4>
          <a className="row" style={{ gap: 10, padding: '8px 0', fontSize: 13, textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }} href="#">
            <svg className="ic" style={{ color: 'var(--blue)' }}><use href="#ic-file-text" /></svg> Hồ sơ mời thầu.pdf
          </a>
          <a className="row" style={{ gap: 10, padding: '8px 0', fontSize: 13, textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }} href="#">
            <svg className="ic" style={{ color: 'var(--red)' }}><use href="#ic-file-text" /></svg> Báo giá Hòa Bình.pdf
          </a>
          <a className="row" style={{ gap: 10, padding: '8px 0', fontSize: 13, textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }} href="#">
            <svg className="ic" style={{ color: 'var(--green)' }}><use href="#ic-image" /></svg> Phối cảnh dự án.jpg
          </a>
        </aside>
      </div>
    </>
  );
}
