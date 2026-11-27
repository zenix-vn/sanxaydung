import { Sk } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Đang tải hồ sơ">
      <div className="skel" style={{ height: 200, borderRadius: 0 }} />
      <div className="container" style={{ padding: '24px 20px' }}>
        <div className="row" style={{ gap: 16, marginBottom: 24 }}>
          <div className="skel" style={{ width: 96, height: 96, borderRadius: 18 }} />
          <div style={{ flex: 1 }}><Sk h={26} w="45%" /><Sk h={14} w="30%" /><Sk h={14} w="60%" mb={0} /></div>
        </div>
        <div className="grid-side-r" style={{ gap: 20 }}>
          <div>{[0, 1, 2].map((i) => <div key={i} className="card-block" style={{ marginBottom: 16 }}><Sk h={18} w="35%" /><Sk h={13} /><Sk h={13} /><Sk h={13} w="70%" mb={0} /></div>)}</div>
          <div className="card-block"><Sk h={120} r={60} w={120} /><Sk h={13} /><Sk h={13} mb={0} /></div>
        </div>
      </div>
    </div>
  );
}
