'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { network } from './network';
import { Transaction, TransactionBuilder } from '@stellar/stellar-sdk';
import { initializeKit, isKitReady, cancelKitRequest, connectKit, disconnectKit, signKitTransaction, getKitNetwork } from '@/wallet/kit';
import { WalletWindowError } from '@/wallet/request';

type WalletId='albedo'|'freighter';
interface WalletContextValue {
  address:string|null; walletId:WalletId; selectWallet:(wallet:WalletId)=>void;
  connect:()=>Promise<void>; disconnect:()=>void; networkMismatch:boolean;
  isConnecting:boolean; isReady:boolean; error:string|null; signTransaction:(xdr:string)=>Promise<string>;
}
interface SignatureRequest { xdr:string; address:string; method:string; fee:string; expires:number; resolve:(value:string)=>void; reject:(error:Error)=>void; timer:ReturnType<typeof setTimeout> }
const WalletContext=createContext<WalletContextValue|null>(null);
const walletKey='peridot:wallet';
function readWalletChoice():WalletId|null{try{const v=window.localStorage.getItem(walletKey);return v==='albedo'||v==='freighter'?v:null;}catch{return null;}}
function writeWalletChoice(v:WalletId){try{window.localStorage.setItem(walletKey,v);}catch{/* Persisting the choice is a convenience only. */}}
const mockAddress='GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
function message(error:unknown){return error instanceof Error?error.message:typeof error==='string'?error:error&&typeof error==='object'&&'message' in error&&typeof error.message==='string'?error.message:'Wallet request failed.';}
export function WalletProvider({children}:{children:ReactNode}){
  const [isReady,setReady]=useState(network.useMocks);
  const [signature,setSignature]=useState<SignatureRequest|null>(null),[signing,setSigning]=useState(false),[signNotice,setSignNotice]=useState('');
  const signatureRef=useRef<SignatureRequest|null>(null),dialogRef=useRef<HTMLDialogElement|null>(null),signingRef=useRef(false);
  const settleSignature=useCallback((request:SignatureRequest,result:string|Error)=>{
    if(signatureRef.current!==request)return;
    if(result instanceof Error)cancelKitRequest();
    clearTimeout(request.timer);signatureRef.current=null;signingRef.current=false;setSignature(null);setSigning(false);setSignNotice('');
    if(result instanceof Error)request.reject(result);else request.resolve(result);
  },[]);
  const cancelSignature=useCallback(()=>{const pending=signatureRef.current;if(pending)settleSignature(pending,new Error('Signature request cancelled. No transaction submitted. Close the Albedo window before trying again.'));},[settleSignature]);
  useEffect(()=>{if(signature&&!dialogRef.current?.open)dialogRef.current?.showModal();},[signature]);
  useEffect(()=>()=>{const pending=signatureRef.current;if(pending){cancelKitRequest();clearTimeout(pending.timer);pending.reject(new Error('Wallet was closed before signing.'));signatureRef.current=null;}},[]);
  const [address,setAddress]=useState<string|null>(network.useMocks?mockAddress:null);
  const [walletId,setWalletId]=useState<WalletId>('albedo');
  const [networkMismatch,setMismatch]=useState(false),[isConnecting,setConnecting]=useState(false),[error,setError]=useState<string|null>(null);
  const flight=useRef(false),version=useRef(0);
  useEffect(()=>{const saved=readWalletChoice();if(saved)setWalletId(saved);},[]);
  const loadKit=useCallback(()=>initializeKit(network.passphrase).then(()=>{setReady(true);setError(null);}).catch(e=>setError(`The wallet module failed to load: ${message(e)} Reload the page, or try another browser. Safari needs site data enabled.`)),[]);
  useEffect(()=>{if(!network.useMocks)void loadKit();},[loadKit]);
  const connect=useCallback(async()=>{
    if(network.useMocks){setAddress(mockAddress);return;}
    if(flight.current)return;
    if(!isKitReady(network.passphrase)){setError('Wallet is still loading. Click Connect wallet again in a moment.');void loadKit();return;}
    flight.current=true;setConnecting(true);setError(null);
    const attempt=++version.current;
    try{
      const connected=await connectKit(walletId,network.passphrase);
      const current=await getKitNetwork();
      if(attempt!==version.current)return;
      setAddress(connected);setMismatch(current.networkPassphrase!==network.passphrase);
    }catch(e){if(attempt===version.current)setError(message(e));}
    finally{if(attempt===version.current){flight.current=false;setConnecting(false);}}
  },[walletId,loadKit]);
  const disconnect=useCallback(()=>{
    cancelSignature();version.current++;flight.current=false;setAddress(null);setMismatch(false);setError(null);setConnecting(false);
    if(!network.useMocks)void disconnectKit().catch(e=>setError(message(e)));
  },[cancelSignature]);
  const selectWallet=useCallback((wallet:WalletId)=>{
    if(flight.current)return;
    disconnect();setWalletId(wallet);writeWalletChoice(wallet);
  },[disconnect]);
  // Freighter has no network-change event the app can rely on. Re-check when the user returns from switching networks, otherwise the mismatch banner would never clear.
  useEffect(()=>{
    if(network.useMocks||!address||!networkMismatch||walletId!=='freighter')return;
    const recheck=()=>{void getKitNetwork().then(current=>setMismatch(current.networkPassphrase!==network.passphrase)).catch(()=>{/* Keep the banner until the wallet answers. */});};
    window.addEventListener('focus',recheck);document.addEventListener('visibilitychange',recheck);
    return()=>{window.removeEventListener('focus',recheck);document.removeEventListener('visibilitychange',recheck);};
  },[address,networkMismatch,walletId]);
  const signTransaction=useCallback(async(xdr:string)=>{
    if(!address)throw new Error('Connect your wallet first.');
    if(network.useMocks)throw new Error('Mock mode does not request wallet signatures.');
    if(walletId==='albedo'){
      if(signatureRef.current)throw new Error('Another signature request is already waiting.');
      const tx=TransactionBuilder.fromXDR(xdr,network.passphrase);
      if(!(tx instanceof Transaction)||tx.source!==address)throw new Error('Unexpected transaction source.');
      const expires=Number(tx.timeBounds?.maxTime)*1000;
      if(!Number.isSafeInteger(expires)||expires<=Date.now()+10_000)throw new Error('Transaction expired. Review the action again.');
      const operation=tx.operations[0];
      const method=operation?.type==='invokeHostFunction'&&operation.func.type==='hostFunctionTypeInvokeContract'?operation.func.invokeContract.functionName.toString():'Transaction';
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
  const value=useMemo(()=>({address,walletId,selectWallet,connect,disconnect,networkMismatch,isConnecting,isReady,error,signTransaction}),[address,walletId,selectWallet,connect,disconnect,networkMismatch,isConnecting,isReady,error,signTransaction]);
  return <WalletContext.Provider value={value}>{children}{signature&&<dialog ref={dialogRef} aria-labelledby="albedo-sign-title" onCancel={e=>{e.preventDefault();cancelSignature();}} style={{background:'var(--surface)',color:'var(--text)',border:'1px solid var(--border)',borderRadius:16,padding:24,maxWidth:460,width:'calc(100% - 32px)'}}>
    <div className="stack"><h2 id="albedo-sign-title">Ready to sign with Albedo</h2><p>The transaction check is complete. Open Albedo below to review and sign.</p><p>Action: <strong>{signature.method.replaceAll('_',' ')}</strong><br/>Network: {network.name}<br/>Maximum fee: {(Number(signature.fee)/10_000_000).toFixed(7)} XLM<br/>Account: {signature.address.slice(0,6)}…{signature.address.slice(-6)}</p>{signing&&<p role="status">Waiting for Albedo. If no window appeared, allow pop-ups for this site, then cancel and try again.</p>}{signNotice&&<p role="alert">{signNotice}</p>}<div className="row"><button type="button" className="button" disabled={signing} onClick={openSignature}>{signing?'Waiting for Albedo...':signNotice?'Try again':'Open Albedo to sign'}</button><button type="button" className="button secondary" onClick={cancelSignature}>Cancel signing</button></div></div>
  </dialog>}</WalletContext.Provider>;
}
export function useWallet():WalletContextValue{
  const wallet=useContext(WalletContext);if(!wallet)throw new Error('useWallet requires WalletProvider.');return wallet;
}
