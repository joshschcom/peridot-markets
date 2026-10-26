'use client';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OctagonAlert } from 'lucide-react';
import './qol.css';

/* Adapted from PeridotV2Full 86ae3795 components/ErrorBoundary.tsx. Changes: the verbose console
 * grouping (user agent, viewport, stacks) is gone and nothing is reported anywhere; the fallback is a
 * card in the current design with Try again, Reload and collapsed technical details (message only). */

export function ErrorCard({ error, onRetry, title = 'Something went wrong', children }: { error: Error & { digest?: string }; onRetry?: () => void; title?: string; children?: ReactNode }) {
  const detail = `${error.name || 'Error'}: ${error.message || 'No message.'}${error.digest ? `\nDigest: ${error.digest}` : ''}`;
  return <div className="page">
    <section className="card error-card" role="alert">
      <span className="error-icon"><OctagonAlert size={22} aria-hidden /></span>
      <h2>{title}</h2>
      {children ?? <p>This part of the page hit an unexpected error. Your wallet and any confirmed transactions are not affected. Try again, or reload the page if it keeps happening.</p>}
      <div className="row">
        {onRetry && <button type="button" className="button" onClick={onRetry}>Try again</button>}
        <button type="button" className="button secondary" onClick={() => window.location.reload()}>Reload</button>
        <Link className="button ghost" href="/">Home</Link>
      </div>
      <details><summary>Technical details</summary><pre>{detail}</pre></details>
    </section>
  </div>;
}

interface BoundaryProps { children: ReactNode; fallback?: (error: Error, reset: () => void) => ReactNode }
interface BoundaryState { error: Error | null }

export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): BoundaryState { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') console.error('[ErrorBoundary]', error, info.componentStack);
  }
  reset = () => this.setState({ error: null });
  render() {
    if (!this.state.error) return this.props.children;
    return this.props.fallback ? this.props.fallback(this.state.error, this.reset) : <ErrorCard error={this.state.error} onRetry={this.reset} />;
  }
}

/** Boundary for page content. Re-mounts on navigation so a crash on one route never sticks to the next. */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
}
