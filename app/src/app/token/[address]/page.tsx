import TokenRoute from '@/components/launchpad/TokenRoute';

export default async function TokenRoutePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return <TokenRoute address={address} />;
}
