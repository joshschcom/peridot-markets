import type { Metadata } from 'next';
import { Audiences, Closing, Hero, HowItWorks, Problem, Solution } from '@/components/home/HomeSections';
import { LiveProof } from '@/components/home/LiveProof';

export const metadata: Metadata = {
  title: 'SuperMarkets | Everything your Stellar token needs, under one roof',
  description: 'Launch a token, lend and borrow it, earn yield on it and trade it with leverage on Stellar Soroban, from one app. Every token gets its own isolated market with a guarded price feed, and launchpad tokens graduate straight into one.',
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
