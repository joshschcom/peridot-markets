'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { network } from './network';
import { initializeKit, connectKit, disconnectKit, signKitTransaction, getKitNetwork } from '@/wallet/kit';

type WalletId='albedo'|'freighter';
interface WalletContextValue {
  address:string|null; walletId:WalletId; selectWallet:(wallet:WalletId)=>void;
  connect:()=>Promise<void>; disconnect:()=>void; networkMismatch:boolean;
  isConnecting:boolean; error:string|null; signTransaction:(xdr:string)=>Promise<string>;
}
const WalletContext=createContext<WalletContextValue|null>(null);
const mockAddress='GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
function message(error:unknown){return error instanceof Error?error.message:typeof error==='string'?error:error&&typeof error==='object'&&'message' in error&&typeof error.message==='string'?error.message:'Wallet request failed.';}
export function WalletProvider({children}:{children:ReactNode}){
  const [address,setAddress]=useState<string|null>(network.useMocks?mockAddress:null);
  const [walletId,setWalletId]=useState<WalletId>('albedo');
  const [networkMismatch,setMismatch]=useState(false),[isConnecting,setConnecting]=useState(false),[error,setError]=useState<string|null>(null);
  const flight=useRef(false),version=useRef(0);
  useEffect(()=>{if(!network.useMocks)void initializeKit(network.passphrase).catch(e=>setError(message(e)));},[]);
  const connect=useCallback(async()=>{
    if(network.useMocks){setAddress(mockAddress);return;}
    if(flight.current)return;
    flight.current=true;setConnecting(true);setError(null);
    const attempt=++version.current;
    try{
      const connected=await connectKit(walletId,network.passphrase);
      const current=await getKitNetwork();
      if(attempt!==version.current)return;
      setAddress(connected);setMismatch(current.networkPassphrase!==network.passphrase);
    }catch(e){if(attempt===version.current)setError(message(e));}
    finally{if(attempt===version.current){flight.current=false;setConnecting(false);}}
  },[walletId]);
  const disconnect=useCallback(()=>{
    version.current++;flight.current=false;setAddress(null);setMismatch(false);setError(null);setConnecting(false);
    if(!network.useMocks)void disconnectKit().catch(e=>setError(message(e)));
  },[]);
  const selectWallet=useCallback((wallet:WalletId)=>{
    if(flight.current)return;
    disconnect();setWalletId(wallet);
  },[disconnect]);
  const signTransaction=useCallback(async(xdr:string)=>{
    if(!address)throw new Error('Connect your wallet first.');
    if(network.useMocks)throw new Error('Mock mode does not request wallet signatures.');
    const current=await getKitNetwork();
    const wrong=current.networkPassphrase!==network.passphrase;setMismatch(wrong);
    if(wrong)throw new Error(`Switch your wallet to ${network.name} before signing.`);
    return signKitTransaction(xdr,address,network.passphrase);
  },[address]);
  const value=useMemo(()=>({address,walletId,selectWallet,connect,disconnect,networkMismatch,isConnecting,error,signTransaction}),[address,walletId,selectWallet,connect,disconnect,networkMismatch,isConnecting,error,signTransaction]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
export function useWallet():WalletContextValue{
  const wallet=useContext(WalletContext);if(!wallet)throw new Error('useWallet requires WalletProvider.');return wallet;
}
