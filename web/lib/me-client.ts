'use client';
import { useEffect, useState } from 'react';
import { supa as loadSupa } from '@/lib/supabase/lazy';
import type { MyCompany } from '@/lib/roles';

/** Hook client: người dùng + doanh nghiệp của họ. `ready=false` khi đang tải. */
export function useMe() {
  const [state, setState] = useState<{ ready: boolean; userId: string | null; companies: MyCompany[] }>({
    ready: false,
    userId: null,
    companies: [],
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const supa = await loadSupa();
      // Chỉ để hiển thị giao diện → đọc phiên tại chỗ; quyền thật vẫn do RLS kiểm tra phía máy chủ
      const { data: { session } } = await supa.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        if (alive) setState({ ready: true, userId: null, companies: [] });
        return;
      }
      const { data } = await supa
        .from('company_members')
        .select('role, companies ( id, name, slug, logo_url )')
        .eq('user_id', user.id)
        .eq('status', 'active');
      const companies = ((data ?? []) as unknown as { role: string; companies: Omit<MyCompany, 'role'> | null }[])
        .filter((r) => r.companies)
        .map((r) => ({ ...r.companies!, role: r.role }));
      if (alive) setState({ ready: true, userId: user.id, companies });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
