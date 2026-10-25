import ControlPanel from '@/components/control/ControlPanel';
export default async function ControlPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  return <ControlPanel id={Number(id)}/>;
}
