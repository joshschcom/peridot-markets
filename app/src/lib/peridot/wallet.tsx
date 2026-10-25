'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAddress, getNetwork, isConnected, requestAccess, signTransaction as freighterSign } from '@stellar/freighter-api';
import { network } from './network';

interface WalletContextValue {
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  networkMismatch: boolean;
  isConnecting: boolean;
  error: string | null;
  signTransaction: (xdr: string) => Promise<string>;
}
const WalletContext = createContext<WalletContextValue | null>(null);
function message(error: unknown) { return error instanceof Error ? error.message : typeof error === 'string' ? error : 'Wallet request failed.'; }
export function WalletProvider({ children }: {children: ReactNode}) {
  const [address, setAddress] = useState<string | null>(network.useMocks ? 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF' : null);
  const [networkMismatch, setMismatch] = useState(false);
  const [isConnecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkNetwork = useCallback(async () => {
    const result = await getNetwork();
    if (result.error) throw new Error(message(result.error));
    const wrong = result.networkPassphrase !== network.passphrase;
    setMismatch(wrong);
    return wrong;
  }, []);
  useEffect(() => {
    if (network.useMocks) return;
    let alive = true;
    void (async () => {
      try {
        const installed = await isConnected();
        if (!installed.isConnected || installed.error) return;
        const result = await getAddress();
        if (!alive || result.error || !result.address) return;
        setAddress(result.address);
        await checkNetwork();
      } catch { /* Explicit connection shows errors; silent restore stays quiet. */ }
    })();
    return () => { alive = false; };
  }, [checkNetwork]);
  const connect = useCallback(async () => {
    if (network.useMocks) { setAddress('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'); return; }
    setConnecting(true); setError(null);
    try {
      const installed = await isConnected();
      if (!installed.isConnected || installed.error) throw new Error('Install Freighter to connect your Stellar wallet.');
      const access = await requestAccess();
      if (access.error || !access.address) throw new Error(message(access.error || 'Wallet access was not granted.'));
      setAddress(access.address);
      await checkNetwork();
    } catch (reason) { setError(message(reason)); }
    finally { setConnecting(false); }
  }, [checkNetwork]);
  const disconnect = useCallback(() => { setAddress(null); setMismatch(false); setError(null); }, []);
  const signTransaction = useCallback(async (xdr: string) => {
    if (!address) throw new Error('Connect your wallet first.');
    if (network.useMocks) throw new Error('Mock mode does not request wallet signatures.');
    const current = await getAddress();
    if (current.error || current.address !== address) throw new Error('The selected wallet account changed. Reconnect before signing.');
    if (await checkNetwork()) throw new Error(`Switch Freighter to ${network.name} before signing.`);
    const result = await freighterSign(xdr, { networkPassphrase: network.passphrase, address });
    if (result.error || !result.signedTxXdr) throw new Error(message(result.error || 'Wallet did not return a signed transaction.'));
    return result.signedTxXdr;
  }, [address, checkNetwork]);
  const value = useMemo(() => ({ address, connect, disconnect, networkMismatch, isConnecting, error, signTransaction }), [address, connect, disconnect, networkMismatch, isConnecting, error, signTransaction]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
export function useWallet(): WalletContextValue {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error('useWallet requires WalletProvider.');
  return wallet;
}
