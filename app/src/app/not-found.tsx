'use client';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';

export default function NotFound() {
  return <div className="page">
    <EmptyState icon={SearchX} title="Page not found" role="status" action={<div className="row"><Link className="button" href="/">Home</Link><Link className="button secondary" href="/groups">Explore groups</Link></div>}>
      <p>This address does not exist on Peridot Markets. Check the link, or start from the groups list.</p>
    </EmptyState>
  </div>;
}
