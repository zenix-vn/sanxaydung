import { Fragment } from 'react';
import { parseRichText, type Inline } from '@/lib/richtext';

const inline = (parts: Inline[]) =>
  parts.map((p, i) =>
    p.t === 'bold' ? <b key={i}>{p.v}</b>
    : p.t === 'link' ? <a key={i} href={p.href} target="_blank" rel="nofollow ugc noopener noreferrer">{p.v}</a>
    : <Fragment key={i}>{p.v}</Fragment>,
  );

/** Hiển thị văn bản định dạng tối giản (dùng được cả server lẫn client). Kiểu dáng: .rich trong globals.css */
export default function RichText({ text }: { text: string }) {
  return (
    <div className="rich prose">
      {parseRichText(text).map((b, i) => {
        if (b.t === 'h') return b.level === 3 ? <h3 key={i}>{inline(b.c)}</h3> : <h4 key={i}>{inline(b.c)}</h4>;
        if (b.t === 'img')
          return (
            <figure key={i}>
              <img src={b.src} alt={b.alt} loading="lazy" />
              {b.alt && <figcaption>{b.alt}</figcaption>}
            </figure>
          );
        if (b.t === 'ul') return <ul key={i}>{b.items.map((x, j) => <li key={j}>{inline(x)}</li>)}</ul>;
        if (b.t === 'ol') return <ol key={i} start={b.start}>{b.items.map((x, j) => <li key={j}>{inline(x)}</li>)}</ol>;
        return <p key={i}>{b.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>;
      })}
    </div>
  );
}
