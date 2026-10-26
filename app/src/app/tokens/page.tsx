import type { Metadata } from 'next';
import { TokenList } from '@/components/launchpad/TokenList';

export const metadata: Metadata = { title: 'Launchpad | Peridot Markets', description: 'Tokens launched on a bonding curve that graduate into an Aquarius pool and their own lending market. Live on Stellar mainnet (beta) and testnet.' };

export default function TokensPage() { return <TokenList />; }
