import type { Metadata } from 'next';
import { WalletProvider } from '@/lib/peridot/wallet';
import { AppShell } from '@/components/peridot/AppShell';
import './globals.css';
export const metadata: Metadata = { title: 'Peridot Markets | Your token. Your money market.', description: 'Launch isolated lending markets on Stellar with configurable rates, yield routes, rewards and leverage.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><WalletProvider><AppShell>{children}</AppShell></WalletProvider></body></html>;
}
