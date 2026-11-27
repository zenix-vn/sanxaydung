import { Act } from '@/components/admin/ui';
import { ROLE_LABEL, type PlatformRole } from '@/lib/admin-roles';

const ROLE_HELP = 'Chủ sở hữu: toàn quyền, phân quyền cho người khác. Quản trị viên: mọi thao tác vận hành, khóa tài khoản. Kiểm duyệt viên: chỉ xử lý xác minh, claim, đăng ký đối tác và kiểm duyệt nội dung.';

/** Nút phân quyền / khóa / mở khóa một tài khoản (dùng ở danh sách và trang chi tiết). */
export default function UserActions({ user: u, label, self, isOwner }: {
  user: { id: string; role: PlatformRole | null; banned: boolean; deleted: boolean };
  label: string; self: boolean; isOwner: boolean;
}) {
  if (self || u.deleted) return null;
  return (
    <>
      {isOwner && !u.banned && (
        <Act label="Phân quyền" icon="ic-shield-check" fn="admin_set_user_role" args={{ _user: u.id }} fieldArgs={{ role: '_role' }}
          confirm={{
            title: `Phân quyền · ${label}`, message: ROLE_HELP, confirmLabel: 'Lưu',
            fields: [{ key: 'role', label: 'Vai trò', type: 'select', defaultValue: u.role ?? 'member', options: [
              { value: 'member', label: ROLE_LABEL.member }, { value: 'moderator', label: ROLE_LABEL.moderator },
              { value: 'admin', label: ROLE_LABEL.admin }, { value: 'owner', label: ROLE_LABEL.owner },
            ] }],
          }} success="Đã cập nhật vai trò" />
      )}
      {!u.role && (u.banned ? (
        <Act label="Mở khóa" tone="p" fn="admin_set_user_banned" args={{ _user: u.id, _ban: false }}
          confirm={{ title: `Mở khóa ${label}?`, message: 'Người dùng đăng nhập lại được bình thường.', confirmLabel: 'Mở khóa' }} success="Đã mở khóa" />
      ) : (
        <Act label="Khóa" tone="d" fn="admin_set_user_banned" args={{ _user: u.id, _ban: true }} fieldArgs={{ reason: '_reason' }}
          confirm={{ title: `Khóa tài khoản ${label}?`, message: 'Đăng xuất khỏi mọi thiết bị và không đăng nhập lại được cho tới khi mở khóa. Hồ sơ doanh nghiệp của họ vẫn giữ nguyên.', confirmLabel: 'Khóa tài khoản', fields: [{ key: 'reason', label: 'Lý do', type: 'textarea', required: true }] }} success="Đã khóa tài khoản" />
      ))}
    </>
  );
}
