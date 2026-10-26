'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { network } from './network';
import { Transaction, TransactionBuilder } from '@stellar/stellar-sdk';
import { initializeKit, isKitReady, cancelKitRequest, connectKit, disconnectKit, signKitTransaction, getKitNetwork } from '@/wallet/kit';
import { WalletWindowError } from '@/wallet/request';
import { DEFAULT_WALLET, readLastWallet, writeLastWallet, usesReviewStep, reportsNetwork, walletInfo, type WalletId } from '@/wallet/catalog';
import { WalletModal } from '@/components/wallet/WalletModal';
import { detectWallets, walletConnectProjectId } from '@/wallet/kit';

interface WalletContextValue {
  address:string|null; walletId:WalletId; selectWallet:(wallet:WalletId)=>void;
  /** Opens the wallet picker. Choosing a wallet in it starts the connection inside that click. */
  connect:()=>void; openModal:()=>void; closeModal:()=>void; modalOpen:boolean; lastWallet:WalletId|null; connectWith:(wallet:WalletId)=>void; disconnect:()=>void; networkMismatch:boolean;
  isConnecting:boolean; isReady:boolean; error:string|null; signTransaction:(xdr:string)=>Promise<string>;
}
interface SignatureRequest { xdr:string; address:string; method:string; fee:string; expires:number; resolve:(value:string)=>void; reject:(error:Error)=>void; timer:ReturnType<typeof setTimeout> }
const WalletContext=createContext<WalletContextValue|null>(null);
const mockAddress='GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
function message(error:unknown){return error instanceof Error?error.message:typeof error==='string'?error:error&&typeof error==='object'&&'message' in error&&typeof error.message==='string'?error.message:'Wallet request failed.';}
export function WalletProvider({children}:{children:ReactNode}){
  const [isReady,setReady]=useState(network.useMocks);
  const [signature,setSignature]=useState<SignatureRequest|null>(null),[signing,setSigning]=useState(false),[signNotice,setSignNotice]=useState('');
  const walletIdRef=useRef<WalletId>(DEFAULT_WALLET);
  const signatureRef=useRef<SignatureRequest|null>(null),dialogRef=useRef<HTMLDialogElement|null>(null),signingRef=useRef(false);
  const settleSignature=useCallback((request:SignatureRequest,result:string|Error)=>{
    if(signatureRef.current!==request)return;
    if(result instanceof Error)cancelKitRequest();
    clearTimeout(request.timer);signatureRef.current=null;signingRef.current=false;setSignature(null);setSigning(false);setSignNotice('');
    if(result instanceof Error)request.reject(result);else request.resolve(result);
  },[]);
  const cancelSignature=useCallback(()=>{const pending=signatureRef.current;if(pending)settleSignature(pending,new Error(`Signature request cancelled. No transaction submitted. Close the ${walletInfo(walletIdRef.current)?.name??'wallet'} window before trying again.`));},[settleSignature]);
  useEffect(()=>{if(signature&&!dialogRef.current?.open)dialogRef.current?.showModal();},[signature]);
  useEffect(()=>()=>{const pending=signatureRef.current;if(pending){cancelKitRequest();clearTimeout(pending.timer);pending.reject(new Error('Wallet was closed before signing.'));signatureRef.current=null;}},[]);
  const [address,setAddress]=useState<string|null>(network.useMocks?mockAddress:null);
  const [walletId,setWalletId]=useState<WalletId>(DEFAULT_WALLET),[lastWallet,setLastWallet]=useState<WalletId|null>(null),[modalOpen,setModalOpen]=useState(false);
  const [networkMismatch,setMismatch]=useState(false),[isConnecting,setConnecting]=useState(false),[error,setError]=useState<string|null>(null);
  const flight=useRef(false),version=useRef(0);
  useEffect(()=>{walletIdRef.current=walletId;},[walletId]);
  useEffect(()=>{const saved=readLastWallet();if(saved){setWalletId(saved);setLastWallet(saved);}},[]);
  const loadKit=useCallback(()=>initializeKit(network.passphrase).then(()=>{setReady(true);setError(null);}).catch(e=>setError(`The wallet module failed to load: ${message(e)} Reload the page, or try another browser. Safari needs site data enabled.`)),[]);
  useEffect(()=>{if(!network.useMocks)void loadKit();},[loadKit]);
  const openModal=useCallback(()=>{setError(null);setModalOpen(true);},[]);
  /** Runs inside the wallet button's click: nothing is awaited before connectKit starts, so the wallet window may open. */
  const connectWith=useCallback((id:WalletId)=>{
    if(flight.current)return;
    if(network.useMocks){setWalletId(id);setLastWallet(id);writeLastWallet(id);setAddress(mockAddress);setModalOpen(false);return;}
    if(!isKitReady(network.passphrase)){setError('Wallet is still loading. Choose the wallet again in a moment.');void loadKit();return;}
    flight.current=true;setConnecting(true);setError(null);setWalletId(id);walletIdRef.current=id;
    const attempt=++version.current;
    void (async()=>{
      try{
        const connected=await connectKit(id,network.passphrase);
        const current=await getKitNetwork();
        if(attempt!==version.current)return;
        setAddress(connected);setMismatch(current.networkPassphrase!==network.passphrase);setLastWallet(id);writeLastWallet(id);setModalOpen(false);
      }catch(e){if(attempt===version.current)setError(message(e));}
      finally{if(attempt===version.current){flight.current=false;setConnecting(false);}}
    })();
  },[loadKit]);
  const disconnect=useCallback(()=>{
    cancelSignature();version.current++;flight.current=false;setAddress(null);setMismatch(false);setError(null);setConnecting(false);
    if(!network.useMocks)void disconnectKit().catch(e=>setError(message(e)));
  },[cancelSignature]);
  /** Closing while a wallet request is open cancels it, like the header Cancel button. */
  const closeModal=useCallback(()=>{setModalOpen(false);if(flight.current)disconnect();},[disconnect]);
  const selectWallet=useCallback((wallet:WalletId)=>{
    if(flight.current)return;
    disconnect();setWalletId(wallet);writeLastWallet(wallet);setLastWallet(wallet);
  },[disconnect]);
  // Freighter has no network-change event the app can rely on. Re-check when the user returns from switching networks, otherwise the mismatch banner would never clear.
  useEffect(()=>{
    if(network.useMocks||!address||!networkMismatch||!reportsNetwork(walletId))return;
    const recheck=()=>{void getKitNetwork().then(current=>setMismatch(current.networkPassphrase!==network.passphrase)).catch(()=>{/* Keep the banner until the wallet answers. */});};
    window.addEventListener('focus',recheck);document.addEventListener('visibilitychange',recheck);
    return()=>{window.removeEventListener('focus',recheck);document.removeEventListener('visibilitychange',recheck);};
  },[address,networkMismatch,walletId]);
  const signTransaction=useCallback(async(xdr:string)=>{
    if(!address)throw new Error('Connect your wallet first.');
    if(network.useMocks)throw new Error('Mock mode does not request wallet signatures.');
    if(usesReviewStep(walletId)){
      if(signatureRef.current)throw new Error('Another signature request is already waiting.');
      const tx=TransactionBuilder.fromXDR(xdr,network.passphrase);
      if(!(tx instanceof Transaction)||tx.source!==address)throw new Error('Unexpected transaction source.');
      const expires=Number(tx.timeBounds?.maxTime)*1000;
      if(!Number.isSafeInteger(expires)||expires<=Date.now()+10_000)throw new Error('Transaction expired. Review the action again.');
      const operation=tx.operations[0];
      const method=operation?.type==='invokeHostFunction'&&operation.func.type==='hostFunctionTypeInvokeContract'?operation.func.invokeContract.functionName.toString():operation?.type==='changeTrust'?'Add asset trustline':'Transaction';
      return new Promise<string>((resolve,reject)=>{
        const request:SignatureRequest={xdr,address,method,fee:tx.fee,expires,resolve,reject,timer:setTimeout(()=>settleSignature(request,new Error('Transaction review expired. Review the action again.')),expires-Date.now()-10_000)};
        signatureRef.current=request;setSignature(request);
      });
    }
    const current=await getKitNetwork();
    const wrong=current.networkPassphrase!==network.passphrase;setMismatch(wrong);
    if(wrong)throw new Error(`Switch your wallet to ${network.name} before signing.`);
    return signKitTransaction(xdr,address,network.passphrase);
  },[address,walletId,settleSignature]);
  const openSignature=()=>{
    const request=signatureRef.current;if(!request||signingRef.current)return;
    if(request.address!==address||request.expires<=Date.now()+10_000){settleSignature(request,new Error('Wallet changed or transaction expired. Review again.'));return;}
    signingRef.current=true;setSigning(true);setSignNotice('');
    // Invoke synchronously from this click: Safari requires a new gesture after simulation.
    void signKitTransaction(request.xdr,request.address,network.passphrase).then(result=>settleSignature(request,request.expires>Date.now()+10_000?result:new Error('Transaction expired. Review the action again.'))).catch(e=>{
      // A blocked or closed Albedo window is fixable in place: keep the reviewed transaction and let the user try again without re-simulating.
      if(e instanceof WalletWindowError&&signatureRef.current===request&&request.expires>Date.now()+10_000){signingRef.current=false;setSigning(false);setSignNotice(e.message);return;}
      settleSignature(request,new Error(message(e)));
    });
  };
  const walletName=walletInfo(walletId)?.name??'wallet';
  const value=useMemo(()=>({address,walletId,selectWallet,connect:openModal,openModal,closeModal,modalOpen,lastWallet,connectWith,disconnect,networkMismatch,isConnecting,isReady,error,signTransaction}),[address,walletId,selectWallet,openModal,closeModal,modalOpen,lastWallet,connectWith,disconnect,networkMismatch,isConnecting,isReady,error,signTransaction]);
  return <WalletContext.Provider value={value}>{children}<WalletModal open={modalOpen} address={address} walletId={walletId} lastWallet={lastWallet} isConnecting={isConnecting} error={error} mock={network.useMocks} walletConnect={!!walletConnectProjectId} detect={detectWallets} onPick={connectWith} onClose={closeModal} onDisconnect={disconnect}/>{signature&&<dialog ref={dialogRef} aria-labelledby="albedo-sign-title" onCancel={e=>{e.preventDefault();cancelSignature();}} style={{margin:'auto',background:'var(--surface)',color:'var(--text)',border:'1px solid var(--border)',borderRadius:16,padding:24,maxWidth:460,width:'calc(100% - 32px)'}}>
    <div className="stack"><h2 id="albedo-sign-title">Ready to sign with {walletName}</h2><p>The transaction check is complete. Open {walletName} below to review and sign.</p><p>Action: <strong>{signature.method.replaceAll('_',' ')}</strong><br/>Network: {network.name}<br/>Maximum fee: {(Number(signature.fee)/10_000_000).toFixed(7)} XLM<br/>Account: {signature.address.slice(0,6)}…{signature.address.slice(-6)}</p>{signing&&<p role="status">Waiting for {walletName}. If no window appeared, allow pop-ups for this site, then cancel and try again.</p>}{signNotice&&<p role="alert">{signNotice}</p>}<div className="row"><button type="button" className="button" disabled={signing} onClick={openSignature}>{signing?`Waiting for ${walletName}...`:signNotice?'Try again':`Open ${walletName} to sign`}</button><button type="button" className="button secondary" onClick={cancelSignature}>Cancel signing</button></div></div>
  </dialog>}</WalletContext.Provider>;
}
export function useWallet():WalletContextValue{
  const wallet=useContext(WalletContext);if(!wallet)throw new Error('useWallet requires WalletProvider.');return wallet;
}
