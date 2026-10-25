import GroupDashboard from '@/components/groups/GroupDashboard';
export default async function GroupPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  return <GroupDashboard id={id}/>;
}
