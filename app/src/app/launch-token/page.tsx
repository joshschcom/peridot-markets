import type { Metadata } from 'next';
import LaunchTokenForm from '@/components/launchpad/LaunchTokenForm';

export const metadata: Metadata = { title: 'Launch a test token | Peridot Markets', description: 'Launch a fixed-supply test token on a bonding curve. Testnet only.' };

export default function LaunchTokenPage() { return <LaunchTokenForm />; }
