/** Pure wallet catalogue logic: which providers the connect modal lists, their order, hints and the remembered choice. No browser or kit imports, so it is unit tested. */
export type WalletId='albedo'|'freighter'|'xbull'|'lobstr'|'hana'|'wallet_connect';
/** popup: the wallet opens its own window, so signing goes through the in-app review step (a fresh click opens the window). extension: the browser extension answers without a window. */
export type WalletKind='popup'|'extension'|'walletconnect';
export interface WalletInfo{id:WalletId;name:string;kind:WalletKind;url:string;blurb:string}
/** Albedo and Freighter are the primary, tested wallets; the others use the same kit signing path and are listed after them. */
export const WALLETS:readonly WalletInfo[]=[
  {id:'albedo',name:'Albedo',kind:'popup',url:'https://albedo.link',blurb:'Web wallet, no install'},
  {id:'freighter',name:'Freighter',kind:'extension',url:'https://freighter.app',blurb:'Browser extension'},
  {id:'xbull',name:'xBull',kind:'popup',url:'https://xbull.app',blurb:'Web wallet'},
  {id:'lobstr',name:'LOBSTR',kind:'extension',url:'https://lobstr.co',blurb:'Browser extension'},
  {id:'hana',name:'Hana',kind:'extension',url:'https://hanawallet.io',blurb:'Browser extension'},
  {id:'wallet_connect',name:'WalletConnect',kind:'walletconnect',url:'https://walletconnect.com',blurb:'Mobile wallets by QR code'},
];
export const DEFAULT_WALLET:WalletId='albedo';
export const walletStorageKey='peridot:wallet';
export function walletInfo(id:string):WalletInfo|undefined{return WALLETS.find(w=>w.id===id);}
export function isWalletId(value:unknown):value is WalletId{return typeof value==='string'&&WALLETS.some(w=>w.id===value);}
/** Popup wallets need the review step before signing; extensions sign directly. */
export function usesReviewStep(id:string):boolean{return walletInfo(id)?.kind==='popup';}
/** Only Freighter exposes the network it is set to. For others, each request names the network and the signature is verified against it. */
export function reportsNetwork(id:string):boolean{return id==='freighter';}
export type Hint='popup'|'installed'|'not-installed'|'checking'|'scan';
export interface WalletOption extends WalletInfo{hint:Hint;lastUsed:boolean;icon?:string}
export interface KitWallet{id:string;isAvailable:boolean;icon?:string;url?:string}
/** Merge the kit's detection results into display options. WalletConnect is listed only when a project id is configured. */
export function buildOptions(detected:readonly KitWallet[]|null,last:WalletId|null,walletConnectEnabled=false):WalletOption[]{
  const found=new Map((detected??[]).map(w=>[w.id,w]));
  const options:WalletOption[]=WALLETS.filter(w=>w.id!=='wallet_connect'||walletConnectEnabled).map(w=>{
    const hit=found.get(w.id);
    const hint:Hint=w.kind==='popup'?'popup':w.kind==='walletconnect'?'scan':detected===null?'checking':hit?.isAvailable?'installed':'not-installed';
    return {...w,hint,lastUsed:w.id===last,icon:hit?.icon};
  });
  const rank=(o:WalletOption)=>o.id==='albedo'?0:o.id==='freighter'?1:o.lastUsed?2:o.hint==='installed'?3:o.hint==='popup'||o.hint==='scan'?4:o.hint==='checking'?5:6;
  return options.map((o,i)=>({o,i})).sort((a,b)=>rank(a.o)-rank(b.o)||a.i-b.i).map(x=>x.o);
}
type Store=Pick<Storage,'getItem'|'setItem'>;
export function readLastWallet(store?:Store):WalletId|null{
  try{const v=(store??window.localStorage).getItem(walletStorageKey);return isWalletId(v)?v:null;}catch{return null;}
}
export function writeLastWallet(id:WalletId,store?:Store):void{
  try{(store??window.localStorage).setItem(walletStorageKey,id);}catch{/* Persisting the choice is a convenience only. */}
}
export function shortAddress(address:string):string{return address.length>12?`${address.slice(0,4)}…${address.slice(-4)}`:address;}
