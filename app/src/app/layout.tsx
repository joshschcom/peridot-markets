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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://markets.peridot.finance';
const TITLE = 'Peridot Markets | Any Stellar token gets its own money market';
const DESCRIPTION = 'Any Stellar token gets its own money market in a few transactions: lending, borrowing, leverage and rewards, with idle liquidity routed into the best yield on Stellar.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'Peridot Markets',
  icons: { icon: '/peridot.ico' },
  openGraph: { type: 'website', siteName: 'Peridot Markets', title: TITLE, description: DESCRIPTION, url: '/' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#0b100d' }, { media: '(prefers-color-scheme: light)', color: '#f4f7f4' }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="dark" suppressHydrationWarning className={inter.variable}>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body><a className="skip-link" href="#main-content">Skip to content</a><WalletProvider><ToastProvider><AppShell><PageErrorBoundary>{children}</PageErrorBoundary></AppShell><RiskDisclaimer /></ToastProvider></WalletProvider></body>
  </html>;
}
