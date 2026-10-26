import type { Metadata } from 'next';
import LaunchEntry from '@/components/launchpad/LaunchEntry';

export const metadata: Metadata = { title: 'Launch a token | Peridot Markets', description: 'Create a simple fixed-supply token or launch one on a bonding curve. Live on Stellar mainnet (beta) and testnet.' };

export default function LaunchTokenPage() { return <LaunchEntry />; }
