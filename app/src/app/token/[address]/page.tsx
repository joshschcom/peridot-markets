import TokenPage from '@/components/launchpad/TokenPage';

export default async function TokenRoute({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return <TokenPage address={address} />;
}
