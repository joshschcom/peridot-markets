import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { WalletProvider } from '@/lib/peridot/wallet';
import { AppShell } from '@/components/ui/AppShell';
import { themeScript } from '@/components/ui/ThemeToggle';
import { ToastProvider } from '@/components/ui/Toast';
import { PageErrorBoundary } from '@/components/ui/ErrorBoundary';
import { RiskDisclaimer } from '@/components/ui/RiskDisclaimer';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Peridot Markets | Any Stellar token gets its own money market',
  description: 'Any Stellar token gets its own money market in a few transactions: lending, borrowing, leverage and rewards, with idle liquidity routed into the best yield on Stellar.',
  icons: { icon: '/peridot.ico' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#0b100d' }, { media: '(prefers-color-scheme: light)', color: '#f4f7f4' }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="dark" suppressHydrationWarning className={inter.variable}>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body><WalletProvider><ToastProvider><AppShell><PageErrorBoundary>{children}</PageErrorBoundary></AppShell><RiskDisclaimer /></ToastProvider></WalletProvider></body>
  </html>;
}
