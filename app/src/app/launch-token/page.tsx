import type { Metadata } from 'next';
import LaunchEntry from '@/components/launchpad/LaunchEntry';

export const metadata: Metadata = { title: 'Launch a token | Peridot Markets', description: 'Create a simple fixed-supply token, launch one on a bonding curve, or run a fixed-price ICO. Curve and simple tokens are live on Stellar mainnet (beta) and testnet; ICOs are testnet only.' };

export default function LaunchTokenPage() { return <LaunchEntry />; }
