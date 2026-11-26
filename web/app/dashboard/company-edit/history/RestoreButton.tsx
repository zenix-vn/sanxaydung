'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import type { Revision } from './labels';

/** Đưa mục về trạng thái trước thay đổi này. Quyền do RLS & trigger trong CSDL quyết định. */
export default function RestoreButton({ companyId, rev }: { companyId: string; rev: Revision }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [err, setErr] = useState<string | null>(null);

  async function restore() {
    const ask = rev.action === 'delete' ? 'Khôi phục mục đã xóa này?' : 'Đưa các trường nói trên về giá trị trước khi sửa?';
    if (!confirm(ask)) return;
    setState('busy');
    setErr(null);
    const supa = createSupabaseBrowser();
    const { data, error } = rev.action === 'delete'
      ? await supa.from(rev.entity).insert({ ...rev.before, id: rev.entity_id, company_id: companyId }).select('id')
      : await supa.from(rev.entity).update(rev.before!).eq('id', rev.entity_id).select('id');
    if (error || !data?.length) {
      setState('idle');
      setErr(
        error?.code === '23505' ? (rev.action === 'delete' ? 'Mục này đã được khôi phục rồi.' : 'Giá trị cũ đang trùng với một hồ sơ khác.')
        : error?.code === '42501' ? error.message
        : error ? `Không khôi phục được: ${error.message}`
        : 'Mục này không còn nữa.',
      );
      return;
    }
    setState('done');
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 220, textAlign: 'right' }}>
      {state === 'done' ? (
        <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: 13 }}>Đã khôi phục</span>
      ) : (
        <button type="button" className="btn btn-outline btn-sm" onClick={restore} disabled={state === 'busy'}>
          {state === 'busy' ? 'Đang khôi phục…' : 'Khôi phục'}
        </button>
      )}
      {err && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
