import type { Metadata } from 'next';
import GroupDashboard from '@/components/groups/GroupDashboard';
import { GroupGuard } from '@/components/groups/GroupGuard';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const safe = /^\d+$/.test(id) ? ` #${id}` : '';
  return { title: `Market group${safe} | Peridot Markets`, description: `Supply, borrow, claim rewards or open a leveraged position in an isolated market group${safe} on Peridot Markets.` };
}

export default async function GroupPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  return <GroupGuard id={id}><GroupDashboard id={id}/></GroupGuard>;
}
