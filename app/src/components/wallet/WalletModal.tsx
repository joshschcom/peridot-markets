'use client';

import { useEffect, useRef, useState } from 'react';
import { buildOptions, shortAddress, walletInfo, type Hint, type KitWallet, type WalletId, type WalletOption } from '@/wallet/catalog';
import './wallet-modal.css';

export interface WalletModalProps {
  open:boolean; address:string|null; walletId:WalletId; lastWallet:WalletId|null;
  isConnecting:boolean; error:string|null; mock:boolean; walletConnect:boolean;
  detect:()=>Promise<KitWallet[]|null>;
  onPick:(id:WalletId)=>void; onClose:()=>void; onDisconnect:()=>void;
}
const hintText:Record<Hint,string>={popup:'Popup',installed:'Installed','not-installed':'Not installed',checking:'Checking...',scan:'QR code'};
function Icon({option}:{option:WalletOption}){
  const [failed,setFailed]=useState(false);
  return <span className="wm-icon" aria-hidden>{option.icon&&!failed?<img src={option.icon} alt="" loading="lazy" onError={()=>setFailed(true)}/>:option.name.slice(0,1)}</span>;
}
/** The connect modal. A native dialog gives the focus trap, Esc handling and inert background. Each wallet button calls onPick synchronously, so the wallet's own window opens directly inside the click. */
export function WalletModal(p:WalletModalProps){
  const ref=useRef<HTMLDialogElement|null>(null);
  const [detected,setDetected]=useState<KitWallet[]|null>(null);
  const [copied,setCopied]=useState(false);
  useEffect(()=>{
    const dialog=ref.current;if(!dialog)return;
    if(p.open&&!dialog.open)dialog.showModal();
    if(!p.open&&dialog.open)dialog.close();
  },[p.open]);
  useEffect(()=>{
    if(!p.open||p.address)return;
    let live=true;setDetected(null);
    if(p.mock){setDetected([]);return;}
    void p.detect().then(result=>{if(live)setDetected(result);});
    return()=>{live=false;};
  // detect is stable for the provider's lifetime
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[p.open,p.address,p.mock]);
  const options=buildOptions(detected,p.lastWallet,p.walletConnect);
  const connected=p.address?walletInfo(p.walletId):undefined;
  const connectingName=walletInfo(p.walletId)?.name??'your wallet';
  return <dialog ref={ref} className="wm" aria-labelledby="wm-title" data-testid="wallet-modal"
    onCancel={e=>{e.preventDefault();p.onClose();}}
    onClick={e=>{if(e.target===ref.current)p.onClose();}}
    onClose={()=>{if(p.open)p.onClose();}}>
    <div className="wm-head">
      <div><h2 id="wm-title">{p.address?'Wallet connected':'Connect a wallet'}</h2>
        <p className="wm-sub">{p.address?'Your account is connected to Peridot Markets.':'Choose a Stellar wallet. You approve every transaction in the wallet itself.'}</p></div>
      <button type="button" className="wm-close" aria-label="Close" onClick={p.onClose}>✕</button>
    </div>
    <div className="wm-body">
      {p.address?<>
        <div className="wm-account"><strong>{p.mock?'Demo account':connected?.name??'Wallet'}</strong><code title={p.address}>{p.mock?shortAddress(p.address):p.address}</code></div>
        <div className="wm-actions">
          {!p.mock&&<button type="button" className="button secondary" onClick={()=>{void navigator.clipboard?.writeText(p.address!).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1500);}).catch(()=>{/* Clipboard may be blocked. */});}}>{copied?'Copied':'Copy address'}</button>}
          <button type="button" className="button" onClick={()=>{p.onDisconnect();p.onClose();}}>Disconnect</button>
        </div>
      </>:<>
        <ul className="wm-list" aria-label="Wallet providers">
          {options.map(o=><li key={o.id} className="wm-item">
            <button type="button" className="wm-pick" data-wallet={o.id} disabled={p.isConnecting} onClick={()=>p.onPick(o.id)}>
              <Icon option={o}/>
              <span className="wm-text"><span className="wm-name">{o.name}{o.lastUsed&&<span className="wm-tag last">Last used</span>}<span className={`wm-tag ${o.hint==='installed'?'installed':o.hint==='not-installed'?'missing':''}`}>{hintText[o.hint]}</span></span><span className="wm-blurb">{o.blurb}</span></span>
            </button>
            {o.hint==='not-installed'&&<a className="wm-install" href={o.url} target="_blank" rel="noopener noreferrer" aria-label={`Install ${o.name}`}>Install</a>}
          </li>)}
        </ul>
        {p.isConnecting&&<p className="wm-status" role="status">Waiting for {connectingName}. If no window appeared, allow pop-ups for this site and try again.</p>}
        {p.error&&!p.isConnecting&&<p className="wm-error" role="alert">{p.error}</p>}
        <p className="wm-foot">{p.mock?'Demo mode: choosing a wallet connects a demo account. No wallet is contacted.':'Peridot never holds your keys. Popup wallets open in a new window; extensions answer in the browser.'}</p>
      </>}
    </div>
  </dialog>;
}
