import type { Metadata } from 'next';
import LaunchWizard from '@/components/launch/LaunchWizard';

export const metadata: Metadata = { title: 'Launch a market group | Peridot Markets', description: 'Configure an isolated lending group for any Stellar token: markets, collateral factors, caps, yield routes, optional leverage and rewards. Every value is checked against the factory guardrails before you sign.' };

export default function LaunchPage(){return <LaunchWizard/>;}
