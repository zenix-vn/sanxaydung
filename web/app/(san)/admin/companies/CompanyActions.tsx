import { Act } from '@/components/admin/ui';
import { TIER } from '@/lib/admin-labels';

/** Nút thao tác trên một doanh nghiệp (dùng ở danh sách và trang chi tiết). */
export default function CompanyActions({ company: c, plans }: {
  company: { id: string; name: string; status: string; verified_tier: string };
  plans: { value: string; label: string }[];
}) {
  return (
    <>
      <Act label="Hạng" icon="ic-award" fn="admin_set_company_tier" args={{ _company: c.id }} fieldArgs={{ tier: '_tier' }}
        confirm={{ title: `Hạng xác minh · ${c.name}`, message: 'Đặt thủ công (vd. cấp Đối tác vàng). Trust Score được tính lại.', confirmLabel: 'Lưu', fields: [{ key: 'tier', label: 'Hạng', type: 'select', defaultValue: c.verified_tier, options: Object.entries(TIER).map(([value, t]) => ({ value, label: t.l })) }] }} success="Đã đổi hạng" />
      {plans.length > 0 && (
        <Act label="Cấp gói" icon="ic-coin" fn="admin_grant_plan" args={{ _company: c.id }} fieldArgs={{ plan: '_plan', months: '_months' }}
          confirm={{ title: `Cấp gói · ${c.name}`, message: 'Dùng khi đã nhận chuyển khoản. Gói đang chạy (nếu có) sẽ bị thay thế.', confirmLabel: 'Cấp gói', fields: [{ key: 'plan', label: 'Gói', type: 'select', options: plans }, { key: 'months', label: 'Số tháng', type: 'number', defaultValue: '1', required: true }] }} success="Đã cấp gói" />
      )}
      {c.status === 'suspended' ? (
        <Act label="Mở lại" tone="p" fn="admin_set_company_status" args={{ _company: c.id, _status: 'published' }} confirm={{ title: 'Mở lại doanh nghiệp?', confirmLabel: 'Mở lại' }} success="Đã mở lại" />
      ) : (
        <>
          {c.status === 'draft' && <Act label="Công khai" tone="p" fn="admin_set_company_status" args={{ _company: c.id, _status: 'published' }} confirm={{ title: `Công khai ${c.name}?`, message: 'Hồ sơ sẽ hiện trong danh bạ và trang công khai.', confirmLabel: 'Công khai' }} success="Đã công khai" />}
          <Act label="Đình chỉ" tone="d" fn="admin_set_company_status" args={{ _company: c.id, _status: 'suspended' }} fieldArgs={{ reason: '_reason' }}
            confirm={{ title: `Đình chỉ ${c.name}?`, message: 'Hồ sơ sẽ bị gỡ khỏi danh bạ và trang công khai.', confirmLabel: 'Đình chỉ', fields: [{ key: 'reason', label: 'Lý do', type: 'textarea', required: true }] }} success="Đã đình chỉ" />
        </>
      )}
    </>
  );
}
