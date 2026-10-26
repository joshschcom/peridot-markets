import type { Metadata } from 'next';
import { GroupsList } from '@/components/groups/GroupsList';

export const metadata: Metadata = { title: 'Market groups | Peridot Markets', description: 'Explore isolated lending groups on Stellar: supply, borrow, claim rewards or open a leveraged position.' };

export default function GroupsPage() { return <GroupsList />; }
