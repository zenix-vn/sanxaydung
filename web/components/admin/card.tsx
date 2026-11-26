/** Khung thẻ dùng ở các trang chi tiết. */
export function Card({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return <section className="adm-card"><div className="hd"><h2>{title}</h2>{extra}</div>{children}</section>;
}
export const None = ({ children }: { children: React.ReactNode }) => <div className="adm-none">{children}</div>;
