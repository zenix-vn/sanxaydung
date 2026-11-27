import { Sk } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Đang tải">
      <Sk h={26} w={280} />
      <Sk h={14} w={420} mb={22} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16, marginBottom: 24 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 100, borderRadius: 14 }} />)}
      </div>
      <div className="skel" style={{ height: 300, borderRadius: 14 }} />
    </div>
  );
}
