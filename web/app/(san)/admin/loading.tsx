export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Đang tải">
      <div className="sk" style={{ height: 28, width: 220, marginBottom: 10 }} />
      <div className="sk" style={{ height: 14, width: 340, marginBottom: 24 }} />
      <div className="adm-kpis">
        {[0, 1, 2, 3].map((i) => <div key={i} className="sk" style={{ height: 82, borderRadius: 14 }} />)}
      </div>
      <div className="sk" style={{ height: 320, borderRadius: 14 }} />
    </div>
  );
}
