import type { Metadata } from 'next';
import { Audiences, Closing, Hero, HowItWorks, Problem, Solution } from '@/components/home/HomeSections';
import { LiveProof } from '@/components/home/LiveProof';

export const metadata: Metadata = {
  title: 'Peridot Markets | Isolated lending markets for any Stellar token',
  description: 'Lending and leverage on Stellar Soroban. Any project gets its own isolated market group with a guarded price feed, optional yield vaults and up to 5x leverage. Launchpad tokens graduate straight into a market.',
};

export default function HomePage() {
  return <div className="home">
    <Hero />
    <Problem />
    <Solution />
    <HowItWorks />
    <LiveProof />
    <Audiences />
    <Closing />
  </div>;
}
