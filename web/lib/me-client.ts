'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
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
      const supa = createSupabaseBrowser();
      const { data: { user } } = await supa.auth.getUser();
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
