'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

type V = { id: string; kind: 'tax' | 'business_license' | 'capability_cert'; status: 'pending' | 'verified' | 'rejected'; reference: string | null; cert_class: string | null; created_at: string; verified_at: string | null };

const KIND_LBL: Record<V['kind'], string> = { tax: 'Mã số thuế', business_license: 'Giấy phép kinh doanh', capability_cert: 'Chứng chỉ năng lực' };
const ST_LBL: Record<V['status'], string> = { pending: 'Đang xử lý', verified: 'Đã xác minh', rejected: 'Bị từ chối' };
const ST_CLS: Record<V['status'], string> = { pending: 'orange', verified: 'green', rejected: 'gray' };
const MAX = 10 * 1024 * 1024;
const OK_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export default function VerifyClient({ company, trust, canRequest, verifications }: {
  company: { id: string; name: string; tax_code: string | null; tier: string };
  trust: number; canRequest: boolean; verifications: V[];
}) {
  const router = useRouter();
  const supa = useMemo(() => createSupabaseBrowser(), []);
  const [kind, setKind] = useState<V['kind']>('capability_cert');
  const [ref, setRef] = useState('');
  const [cls, setCls] = useState('Hạng I');
  const [scope, setScope] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const has = (k: V['kind'], st: V['status']) => verifications.some((v) => v.kind === k && v.status === st);
  const legalDone = company.tier !== 'none';
  const capDone = company.tier === 'capability' || company.tier === 'gold';
  const capPending = has('capability_cert', 'pending');
  const legalPending = has('tax', 'pending') || has('business_license', 'pending');
  const pending = verifications.some((v) => v.kind === kind && v.status === 'pending');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!ref.trim()) return setMsg({ ok: false, text: kind === 'tax' ? 'Nhập mã số thuế.' : 'Nhập số giấy tờ.' });
    if (kind === 'tax' && !/^\d{10}(-?\d{3})?$/.test(ref.trim())) return setMsg({ ok: false, text: 'Mã số thuế gồm 10 hoặc 13 chữ số.' });
    if (kind !== 'tax' && !file) return setMsg({ ok: false, text: 'Vui lòng tải file bằng chứng (PDF/JPG/PNG).' });
    if (file && (!OK_TYPES.includes(file.type) || file.size > MAX)) return setMsg({ ok: false, text: 'File phải là PDF/JPG/PNG, tối đa 10MB.' });
    if (pending) return setMsg({ ok: false, text: 'Đã có yêu cầu cùng loại đang chờ xử lý.' });

    setBusy(true);
    try {
      let evidence: string | null = null;
      if (file) {
        const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
        evidence = `${company.id}/${kind}-${Date.now()}.${ext}`;
        const { error } = await supa.storage.from('verification-docs').upload(evidence, file, { contentType: file.type });
        if (error) throw error;
      }
      const isCap = kind === 'capability_cert';
      const { error } = await supa.rpc('request_verification', {
        _company: company.id, _kind: kind, _reference: ref.trim(), _evidence_url: evidence,
        _cert_class: isCap ? cls : null,
        _meta: isCap && scope.trim() ? { scope: scope.trim() } : {},
      });
      if (error) throw error;
      setMsg({ ok: true, text: 'Đã gửi yêu cầu. Kết quả sẽ cập nhật huy hiệu & Trust Score và gửi thông báo cho bạn.' });
      setRef(''); setScope(''); setFile(null);
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const flowStep = pending || capPending || legalPending ? 2 : 1;

  return (
    <>
      <style>{`
        .tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:26px}
        .tier{border:1px solid var(--line);border-radius:16px;padding:22px;background:#fff;box-shadow:var(--shadow-sm);position:relative}
        .tier.done{border-color:var(--green);background:linear-gradient(0deg,#f6fdf9,#fff)}
        .tier.active{border-color:var(--orange);box-shadow:0 8px 30px rgba(241,138,28,.16)}
        .tier .step{position:absolute;top:-11px;left:22px;font-size:11px;font-weight:700;background:var(--navy);color:#fff;padding:3px 12px;border-radius:20px}
        .tier .badge-lg{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;margin-bottom:14px}
        .tier h3{font-size:17px;font-weight:800;color:var(--navy);display:flex;align-items:center;gap:8px}
        .tier p{font-size:13px;color:var(--muted);margin:8px 0 14px}
        .tier ul{list-style:none;padding:0;margin:0}
        .tier li{font-size:13px;color:var(--text);display:flex;align-items:center;gap:8px;padding:4px 0}
        .tier li svg{width:15px;height:15px;color:var(--green);flex:none}
        .tier .vstatus{margin-top:14px;font-size:12.5px;font-weight:700;display:flex;align-items:center;gap:6px}
        .lookup-result{background:#f6fdf9;border:1px solid #b6e6c9;border-radius:12px;padding:16px;margin-top:16px}
        .lookup-result .kv{display:flex;justify-content:space-between;font-size:13.5px;padding:6px 0;border-bottom:1px dashed #cbead6}
        .lookup-result .kv:last-child{border-bottom:none}
        .lookup-result .kv .k{color:#4a7a5f}.lookup-result .kv .v{font-weight:600;color:var(--navy)}
        .steps-flow{display:flex;gap:8px;align-items:center;margin-bottom:22px;flex-wrap:wrap}
        .steps-flow .s{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
        .steps-flow .s .n{width:26px;height:26px;border-radius:50%;background:var(--line);color:var(--muted);display:grid;place-items:center;font-size:12px;font-weight:700;flex:none}
        .steps-flow .s.done .n{background:var(--green);color:#fff}
        .steps-flow .s.active .n{background:var(--orange);color:#fff}
        .steps-flow .s.active{color:var(--navy);font-weight:600}
        .steps-flow .line{flex:1;height:2px;background:var(--line);min-width:20px}
        .upload-zone{border:1.5px dashed var(--line);border-radius:10px;padding:20px;text-align:center;color:var(--muted)}
        @media(max-width:900px){.tiers{grid-template-columns:1fr}}
      `}</style>
      <section className="pagehead">
        <div className="container">
          <div className="crumb">
            <a href="/dashboard">Bảng điều khiển</a>
            <svg className="ic"><use href="#ic-chevron-right" /></svg>
            Xác minh doanh nghiệp
          </div>
          <h1>Xác minh doanh nghiệp</h1>
          <p>Gắn dữ liệu gốc (MST, chứng chỉ năng lực) để nâng huy hiệu tin cậy &amp; tăng Trust Score. Xác minh giúp bạn nhận nhiều báo giá &amp; cơ hội hơn.</p>
        </div>
      </section>

      <section className="block" style={{ paddingTop: 28 }}>
        <div className="container">
          <div className="tiers">
            <div className={`tier ${legalDone ? 'done' : 'active'}`}>
              <span className="step">Bước 1</span>
              <div className="badge-lg" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><svg className="ic" style={{ width: 28, height: 28 }}><use href="#ic-shield-check" /></svg></div>
              <h3>Xác minh pháp lý</h3>
              <p>Đối chiếu Mã số thuế / Giấy phép kinh doanh với Cổng thông tin quốc gia về ĐKDN.</p>
              <ul>
                <li><svg className="ic"><use href="#ic-check" /></svg> Huy hiệu &ldquo;Đã xác minh pháp lý&rdquo;</li>
                <li><svg className="ic"><use href="#ic-check" /></svg> Tăng Trust Score</li>
                <li><svg className="ic"><use href="#ic-check" /></svg> Được đăng tin &amp; báo giá</li>
              </ul>
              <div className="vstatus" style={{ color: legalDone ? 'var(--green)' : legalPending ? 'var(--orange)' : 'var(--muted)' }}>
                <svg className="ic" style={{ width: 15, height: 15 }}><use href={legalDone ? '#ic-check' : '#ic-clock'} /></svg>
                {legalDone ? 'Đã hoàn tất' : legalPending ? 'Đang xử lý' : 'Chưa gửi yêu cầu'}
              </div>
            </div>
            <div className={`tier ${capDone ? 'done' : legalDone ? 'active' : ''}`}>
              <span className="step">Bước 2</span>
              <div className="badge-lg" style={{ background: '#eaf7ee', color: 'var(--green)' }}><svg className="ic" style={{ width: 28, height: 28 }}><use href="#ic-award" /></svg></div>
              <h3>Xác minh năng lực</h3>
              <p>Chứng chỉ năng lực hoạt động xây dựng hạng I/II/III do Bộ Xây dựng cấp.</p>
              <ul>
                <li><svg className="ic"><use href="#ic-check" /></svg> Huy hiệu &ldquo;Đã xác minh năng lực&rdquo;</li>
                <li><svg className="ic"><use href="#ic-check" /></svg> Tăng Trust Score</li>
                <li><svg className="ic"><use href="#ic-check" /></svg> Lọc theo hạng năng lực</li>
              </ul>
              <div className="vstatus" style={{ color: capDone ? 'var(--green)' : capPending ? 'var(--orange)' : 'var(--muted)' }}>
                <svg className="ic" style={{ width: 15, height: 15 }}><use href={capDone ? '#ic-check' : '#ic-clock'} /></svg>
                {capDone ? 'Đã hoàn tất' : capPending ? 'Đang xử lý' : 'Chưa gửi yêu cầu'}
              </div>
            </div>
            <div className={`tier ${company.tier === 'gold' ? 'done' : ''}`}>
              <span className="step">Bước 3</span>
              <div className="badge-lg" style={{ background: 'linear-gradient(135deg,#fff2d1,#ffe4a3)', color: '#8a6d1a' }}><svg className="ic" style={{ width: 28, height: 28 }}><use href="#ic-star-f" /></svg></div>
              <h3>Đối tác vàng</h3>
              <p>Đạt ngưỡng Trust Score + số dự án + đánh giá xác thực để nhận huy hiệu cao nhất.</p>
              <ul>
                <li><svg className="ic"><use href="#ic-check" /></svg> Huy hiệu &ldquo;Đối tác vàng&rdquo;</li>
                <li><svg className="ic"><use href="#ic-check" /></svg> Ưu tiên hiển thị tìm kiếm</li>
                <li><svg className="ic"><use href="#ic-check" /></svg> Nổi bật trong bảng xếp hạng</li>
              </ul>
              <div className="vstatus" style={{ color: company.tier === 'gold' ? 'var(--green)' : 'var(--muted)' }}>
                <svg className="ic" style={{ width: 15, height: 15 }}><use href={company.tier === 'gold' ? '#ic-check' : '#ic-lock'} /></svg>
                {company.tier === 'gold' ? 'Đã đạt' : 'Cần Trust Score ≥ 90'}
              </div>
            </div>
          </div>

          <div className="grid-side-r">
            <div>
              <form className="card-block" onSubmit={submit}>
                <h2>Gửi yêu cầu xác minh</h2>
                <p className="muted mb-16">Nhập thông tin để hệ thống đối chiếu; file bằng chứng được lưu riêng tư — chỉ admin công ty &amp; đội ngũ xác minh xem được.</p>

                {!canRequest && <div className="pill-note mb-16"><span>Chỉ Owner/Admin của công ty mới gửi được yêu cầu xác minh.</span></div>}

                <div className="steps-flow">
                  <div className="s done"><span className="n"><svg className="ic" style={{ width: 13, height: 13 }}><use href="#ic-check" /></svg></span> Nhập thông tin</div>
                  <span className="line" />
                  <div className={`s ${flowStep === 2 ? 'active' : ''}`}><span className="n">2</span> Đối chiếu dữ liệu</div>
                  <span className="line" />
                  <div className={`s ${legalDone || capDone ? 'done' : ''}`}><span className="n">3</span> Cấp huy hiệu</div>
                </div>

                <div className="field-group">
                  <label>Loại xác minh</label>
                  <select className="select" value={kind} onChange={(e) => { setKind(e.target.value as V['kind']); setRef(''); setFile(null); setMsg(null); }}>
                    <option value="capability_cert">Chứng chỉ năng lực hoạt động xây dựng</option>
                    <option value="tax">Mã số thuế</option>
                    <option value="business_license">Giấy phép kinh doanh</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="field-group">
                    <label>{kind === 'tax' ? 'Mã số thuế' : kind === 'business_license' ? 'Số GPKD' : 'Số chứng chỉ năng lực'} <span className="req">*</span></label>
                    <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={kind === 'tax' ? (company.tax_code ?? '0312345678') : 'BXD-01234/2023'} />
                  </div>
                  {kind === 'capability_cert' && (
                    <div className="field-group">
                      <label>Hạng</label>
                      <select className="select" value={cls} onChange={(e) => setCls(e.target.value)}>
                        <option>Hạng I</option><option>Hạng II</option><option>Hạng III</option>
                      </select>
                    </div>
                  )}
                </div>
                {kind === 'capability_cert' && (
                  <div className="field-group">
                    <label>Lĩnh vực hoạt động trên chứng chỉ</label>
                    <input className="input" value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Thi công xây dựng công trình dân dụng, công nghiệp" />
                  </div>
                )}
                <div className="field-group">
                  <label>File bằng chứng {kind !== 'tax' && <span className="req">*</span>}</label>
                  <div className="upload-zone" style={{ cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
                    <svg className="ic" style={{ width: 26, height: 26, color: 'var(--orange)', margin: '0 auto 6px', display: 'block' }}><use href="#ic-upload" /></svg>
                    <div style={{ fontSize: 13.5 }}>
                      {file ? <><b style={{ color: 'var(--navy)' }}>{file.name}</b> · {(file.size / 1048576).toFixed(1)} MB</> : 'Bấm để chọn file PDF/JPG/PNG (tối đa 10MB)'}
                    </div>
                    <small>Lưu ở bucket riêng tư <code>verification-docs</code>.</small>
                  </div>
                  <input ref={fileRef} type="file" hidden accept=".pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>

                <div className="pill-note mb-16">
                  <svg className="ic"><use href="#ic-shield" /></svg>
                  <span>Việc xác minh chạy trên <b>Edge Function</b> với quyền hệ thống. Kết quả sẽ tự cập nhật huy hiệu &amp; Trust Score.</span>
                </div>
                {msg && <p style={{ color: msg.ok ? 'var(--green)' : '#c0392b', fontSize: 13, marginBottom: 12 }}>{msg.text}</p>}
                <button className="btn btn-orange btn-lg" disabled={busy || !canRequest} type="submit">
                  <svg className="ic"><use href="#ic-shield-check" /></svg> {busy ? 'Đang gửi…' : 'Gửi yêu cầu xác minh'}
                </button>
              </form>

              <div className="card-block">
                <h2>Lịch sử yêu cầu</h2>
                {verifications.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13 }}>Chưa có yêu cầu xác minh nào.</p>
                ) : (
                  <div className="lookup-result" style={{ background: '#fff', borderColor: 'var(--line)' }}>
                    {verifications.map((v) => (
                      <div key={v.id} className="kv" style={{ borderColor: 'var(--line-2)', alignItems: 'center', gap: 10 }}>
                        <span className="k" style={{ color: 'var(--text)' }}>
                          <b>{KIND_LBL[v.kind]}</b><br /><small style={{ color: 'var(--muted)' }}>{v.reference ?? '—'} · {new Date(v.created_at).toLocaleDateString('vi-VN')}</small>
                        </span>
                        <span className={`badge ${ST_CLS[v.status]}`}>{ST_LBL[v.status]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside>
              <div className="card-block" style={{ textAlign: 'center' }}>
                <div className="trust-ring" style={{ ['--val' as never]: trust, margin: '0 auto 12px' }}>
                  <div className="inner"><b>{trust}</b><small>/100</small></div>
                </div>
                <h2 style={{ fontSize: 16 }}>Trust Score hiện tại</h2>
                <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Hoàn tất xác minh để tăng điểm và nâng huy hiệu cho <b>{company.name}</b>.</p>
              </div>
              <div className="card-block">
                <h2 style={{ fontSize: 15 }}>Vì sao nên xác minh?</h2>
                <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line-2)', fontSize: 13, alignItems: 'flex-start' }}>
                  <svg className="ic" style={{ width: 18, height: 18, color: 'var(--green)', flexShrink: 0 }}><use href="#ic-trending" /></svg>
                  Doanh nghiệp đã xác minh dễ nhận báo giá hơn
                </div>
                <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line-2)', fontSize: 13, alignItems: 'flex-start' }}>
                  <svg className="ic" style={{ width: 18, height: 18, color: 'var(--green)', flexShrink: 0 }}><use href="#ic-shield-check" /></svg>
                  Chống công ty ma, tăng niềm tin đối tác
                </div>
                <div style={{ display: 'flex', gap: 10, padding: '10px 0', fontSize: 13, alignItems: 'flex-start' }}>
                  <svg className="ic" style={{ width: 18, height: 18, color: 'var(--green)', flexShrink: 0 }}><use href="#ic-award" /></svg>
                  Điều kiện để lên &ldquo;Đối tác vàng&rdquo;
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
