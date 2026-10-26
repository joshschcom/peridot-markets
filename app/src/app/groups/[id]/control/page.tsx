import type { Metadata } from 'next';
import ControlPanel from '@/components/control/ControlPanel';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const safe = /^\d+$/.test(id) ? ` #${id}` : '';
  return { title: `Control Panel${safe} | Peridot Markets`, description: 'Owner settings for an isolated market group: risk limits, rate curves, liquid buffers, price sources, rewards and leverage.' };
}

export default async function ControlPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  return <ControlPanel id={Number(id)}/>;
}
