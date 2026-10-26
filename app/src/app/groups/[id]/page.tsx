import GroupDashboard from '@/components/groups/GroupDashboard';
import { GroupGuard } from '@/components/groups/GroupGuard';
export default async function GroupPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  return <GroupGuard id={id}><GroupDashboard id={id}/></GroupGuard>;
}
