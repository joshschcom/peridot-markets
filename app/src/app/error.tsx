'use client';
import { ErrorCard } from '@/components/ui/ErrorBoundary';

/** Next.js route error UI: rendered inside the shell when a page throws during render or data loading. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorCard error={error} onRetry={reset} title="This page could not be shown" />;
}
