import type { Metadata } from 'next';
import VaultsPage from '@/components/vaults/VaultsPage';

export const metadata: Metadata = { title: 'Vaults | Peridot Markets', description: 'Every yield venue a Peridot market can use, and the Aquarius pools with USDC you could build a vault on.' };

export default function Page() { return <VaultsPage />; }
