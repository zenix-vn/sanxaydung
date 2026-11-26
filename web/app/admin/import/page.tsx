import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin';
import ImportWizard from './ImportWizard';

export const metadata: Metadata = { title: 'Nhập doanh nghiệp' };

export default async function ImportPage() {
  const { supa } = await requireAdmin('/admin/import', 'admin');
  const [{ data: cats }, { data: provs }] = await Promise.all([
    supa.from('categories').select('slug, name').order('sort_order'),
    supa.from('provinces').select('code, name').order('name'),
  ]);
  return (
    <>
      <div className="adm-h"><div>
        <h1>Nhập doanh nghiệp từ CSV</h1>
        <p>Dùng file tải về từ Google Sheets (phản hồi Google Form) hoặc file mẫu. Số điện thoại là khóa chống trùng; mã số thuế có thể để trống.</p>
      </div></div>
      <ImportWizard categories={(cats ?? []) as { slug: string; name: string }[]} provinces={(provs ?? []) as { code: string; name: string }[]} />
    </>
  );
}
