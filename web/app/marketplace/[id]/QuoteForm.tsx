'use client';
import { useState } from 'react';

export default function QuoteForm({ listingId }: { listingId: string }) {
  const [price, setPrice] = useState('');
  const [timeline, setTimeline] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="notice" style={{ background: 'var(--green-soft)', borderColor: '#86efac', color: '#166534' }}>
        <svg className="ic" style={{ width: 18, height: 18 }}><use href="#ic-check" /></svg>
        Báo giá đã được gửi thành công. Chủ đầu tư sẽ liên hệ lại với bạn.
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="pill-note mb-16">
        <svg className="ic"><use href="#ic-shield-check" /></svg>
        <span>
          Đăng nhập để gửi báo giá với tư cách doanh nghiệp của bạn. Gửi báo giá sẽ tạo kết nối với chủ đầu tư.
        </span>
      </div>
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>
            Giá đề xuất (VNĐ) <span className="req">*</span>
          </label>
          <input
            className="input"
            placeholder="vd. 52.000.000.000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>Thời gian thi công</label>
          <input
            className="input"
            placeholder="vd. 18 tháng"
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
          />
        </div>
      </div>
      <div className="field-group">
        <label>Thư ngỏ / thuyết minh</label>
        <textarea
          className="textarea"
          placeholder="Giới thiệu năng lực, kinh nghiệm công trình tương tự, cam kết tiến độ..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ minHeight: 120 }}
        />
      </div>
      <div className="field-group">
        <label>Đính kèm hồ sơ dự thầu</label>
        <div
          style={{
            border: '1.5px dashed var(--line)',
            borderRadius: 10,
            padding: 22,
            textAlign: 'center',
            color: 'var(--muted)',
          }}
        >
          <svg className="ic" style={{ width: 26, height: 26, color: 'var(--orange)', margin: '0 auto 6px' }}>
            <use href="#ic-upload" />
          </svg>
          <div style={{ fontSize: 13.5 }}>
            Kéo thả hoặc <b style={{ color: 'var(--orange)' }}>chọn file</b> (PDF, tối đa 25MB)
          </div>
        </div>
      </div>
      <button className="btn btn-orange btn-lg" type="submit" disabled={loading}>
        {loading ? (
          'Đang gửi…'
        ) : (
          <>
            <svg className="ic"><use href="#ic-send" /></svg> Gửi báo giá
          </>
        )}
      </button>
    </form>
  );
}
