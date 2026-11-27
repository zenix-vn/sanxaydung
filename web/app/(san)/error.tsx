'use client';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="errpage">
      <div className="code">:(</div>
      <h1>Đã có lỗi xảy ra</h1>
      <p>Hệ thống gặp sự cố khi tải trang này. Bạn thử tải lại; nếu vẫn lỗi, vui lòng liên hệ hotro@sanxaydung.vn{error.digest ? ` (mã lỗi ${error.digest})` : ''}.</p>
      <div className="row">
        <button className="btn btn-orange" onClick={() => reset()}><svg className="ic"><use href="#ic-refresh" /></svg> Thử lại</button>
        <a className="btn btn-outline" href="/">Về trang chủ</a>
      </div>
    </div>
  );
}
