import type { Metadata } from 'next';
import { Suspense } from 'react';
import ChatClient from './ChatClient';

export const metadata: Metadata = { title: 'Tin nhắn' };

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
        .att-img{display:block;margin-top:6px}
        .att-img img{max-width:240px;max-height:220px;border-radius:10px;display:block}
        .att-file{display:flex;align-items:center;gap:10px;margin-top:6px;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.18);border:1px solid rgba(0,0,0,.08);color:inherit;text-decoration:none;min-width:200px}
        .att-file span{flex:1;min-width:0}
        .att-file b{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .att-file small{font-size:11px;opacity:.75}
        .att-file svg{width:18px;height:18px;flex:none}
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
              .chat-wrap.has-conv .back{display:inline-flex}
        .back{display:none}
        .cempty{flex:1;display:grid;place-items:center;color:var(--muted);text-align:center;padding:24px}
        .msg .qline{font-size:12px;opacity:.8;margin-top:4px}
        .csel{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;margin-top:10px;background:#fff}
        @media(max-width:760px){.chat-wrap.has-conv{grid-template-columns:1fr}.chat-wrap.has-conv .clist{display:none}.chat-wrap:not(.has-conv) .cthread{display:none}.chat-wrap:not(.has-conv) .clist{display:flex}}
      `}</style>
      <Suspense fallback={null}>
        <ChatClient />
      </Suspense>
    </>
  );
}
