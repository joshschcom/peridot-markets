import { Keypair, Networks, StrKey, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';
import type { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import type { Networks as KitNetworks } from '@creit.tech/stellar-wallets-kit/types';
import { WalletRequest, WalletWindowError } from './request';
export type WalletId='albedo'|'freighter';
let kit:typeof StellarWalletsKit|undefined;
let loading:Promise<void>|undefined;
let configuredPassphrase:string|undefined;
let selected:WalletId='albedo';
let connectedAddress:string|null=null;
let generation=0;
const request=new WalletRequest();
/** A first-time Albedo or Freighter user may need to unlock, import or create an account. Blocked and closed windows fail fast, so this is only a last resort. */
export const CONNECT_TIMEOUT_MS=300_000,SIGN_TIMEOUT_MS=300_000,QUICK_TIMEOUT_MS=30_000,EXPIRY_GUARD_MS=10_000;
/** Turn wallet SDK error objects into plain, actionable messages. Never hides the wallet's own text when it is specific. */
export function describeWalletError(error:unknown,wallet:WalletId):Error{
  if(error instanceof WalletWindowError)return error;
  const raw=error instanceof Error?error.message:typeof error==='string'?error:error&&typeof error==='object'&&'message' in error&&typeof error.message==='string'?error.message:'';
  const code=error&&typeof error==='object'&&'code' in error?Number((error as {code:unknown}).code):undefined;
  if(error instanceof Error)return error;
  if(/freighter is not connected|not installed|extension.*not/i.test(raw))return new Error('Freighter was not detected. Install and unlock the Freighter extension, allow it on this site, reload this page, or choose Albedo.');
  if(/reject|declin|denied|cancel|closed the modal/i.test(raw)||code===-4)return new Error(`You declined the request in ${wallet==='albedo'?'Albedo':'Freighter'}. Nothing was signed. Try again when ready.`);
  return new Error(raw||'The wallet request failed. Try again.');
}
/** Milliseconds left before the transaction's own timebound, minus a guard so a late signature is never produced. */
export function signingWindowMs(tx:Transaction,now=Date.now()):number{
  const max=Number(tx.timeBounds?.maxTime);
  if(!Number.isFinite(max)||max<=0)return SIGN_TIMEOUT_MS;
  return Math.min(SIGN_TIMEOUT_MS,max*1000-now-EXPIRY_GUARD_MS);
}
/** The connect button must wait for initialization without consuming its click gesture. */
export function isKitReady(passphrase:string):boolean{return !!kit&&configuredPassphrase===passphrase;}
function validateNetwork(passphrase:string){
  if(passphrase!==Networks.PUBLIC&&passphrase!==Networks.TESTNET)throw new Error('This app supports Stellar mainnet and testnet only.');
}
/** Initialization loads only the two requested modules and never requests an account. */
export async function initializeKit(passphrase:string):Promise<void>{
  validateNetwork(passphrase);
  if(typeof window==='undefined')throw new Error('Wallet connections require a browser.');
  if(!loading)loading=(async()=>{
    const [{StellarWalletsKit:loaded},{AlbedoModule,ALBEDO_ID},{FreighterModule}]=await Promise.all([
      import('@creit.tech/stellar-wallets-kit/sdk'),
      import('@creit.tech/stellar-wallets-kit/modules/albedo'),
      import('@creit.tech/stellar-wallets-kit/modules/freighter'),
    ]);
    loaded.init({modules:[new AlbedoModule(),new FreighterModule()],selectedWalletId:ALBEDO_ID,network:passphrase as KitNetworks});
    kit=loaded;configuredPassphrase=passphrase;
  })().catch(error=>{loading=undefined;throw error;});
  await loading;
  if(configuredPassphrase!==passphrase){
    if(connectedAddress)throw new Error('Disconnect before changing the app network.');
    kit!.setNetwork(passphrase as KitNetworks);configuredPassphrase=passphrase;
  }
}
export async function connectKit(walletId:WalletId,passphrase:string):Promise<string>{
  if(walletId!=='albedo'&&walletId!=='freighter')throw new Error('Unsupported wallet.');
  validateNetwork(passphrase);
  if(!isKitReady(passphrase))throw new Error('Wallet is still loading. Wait a moment, then connect again.');
  if(request.isBusy)throw new Error('Another wallet request is already open. Cancel it before trying again.');
  const attempt=++generation;
  connectedAddress=null;selected=walletId;
  kit!.setWallet(walletId);
  // No await before dispatch: Safari needs window.open in this button click.
  let address:string;
  try{({address}=await request.run(()=>kit!.fetchAddress(),CONNECT_TIMEOUT_MS,{watchPopup:walletId==='albedo'}));}
  catch(error){throw describeWalletError(error,walletId);}
  if(attempt!==generation)throw new Error('Wallet selection changed. Connect again.');
  if(!StrKey.isValidEd25519PublicKey(address))throw new Error('Wallet did not return a valid Stellar account.');
  connectedAddress=address;return address;
}
/** Cancel a signature prompt without disconnecting the selected account. */
export function cancelKitRequest():void{generation++;request.cancel();}
export async function disconnectKit():Promise<void>{
  cancelKitRequest();connectedAddress=null;
  if(kit)await kit.disconnect();
}
export async function getKitNetwork():Promise<{network:string;networkPassphrase:string}>{
  if(!kit||!configuredPassphrase)throw new Error('Connect your wallet first.');
  // Albedo has no network getter. Each request specifies its network and the returned signature is verified against it.
  if(selected==='albedo')return {network:configuredPassphrase===Networks.PUBLIC?'PUBLIC':'TESTNET',networkPassphrase:configuredPassphrase};
  return request.run(()=>kit!.getNetwork(),QUICK_TIMEOUT_MS).catch(error=>{throw describeWalletError(error,'freighter');});
}
export function validateWalletSignature(unsignedXdr:string,signedXdr:string,address:string,passphrase:string,signerAddress?:string):string{
  validateNetwork(passphrase);
  if(!StrKey.isValidEd25519PublicKey(address)||signerAddress&&signerAddress!==address)throw new Error('Wallet signed with another account. Reconnect before signing.');
  const original=TransactionBuilder.fromXDR(unsignedXdr,passphrase),signed=TransactionBuilder.fromXDR(signedXdr,passphrase);
  if(!(original instanceof Transaction)||!(signed instanceof Transaction)||original.source!==address||signed.source!==address)throw new Error('Unexpected wallet transaction source or envelope.');
  const preparedHash=original.hash(),signedHash=signed.hash();
  if(preparedHash.length!==signedHash.length||preparedHash.some((byte,i)=>byte!==signedHash[i]))throw new Error('Wallet changed the prepared transaction.');
  const publicKey=Keypair.fromPublicKey(address);
  if(!signed.signatures.some(signature=>{try{return publicKey.verify(signed.hash(),signature.signature);}catch{return false;}}))throw new Error('Wallet signature does not match the selected account and network.');
  return signedXdr;
}
export async function signKitTransaction(xdr:string,address:string,passphrase:string):Promise<string>{
  validateNetwork(passphrase);
  if(!kit||!connectedAddress||connectedAddress!==address||configuredPassphrase!==passphrase)throw new Error('The connected wallet or network changed. Reconnect before signing.');
  const original=TransactionBuilder.fromXDR(xdr,passphrase);
  if(!(original instanceof Transaction)||original.source!==address)throw new Error('Unexpected wallet transaction source or envelope.');
  const attempt=generation,wallet=selected;
  // One deadline for the whole signing attempt, so the wallet never outlives the transaction's timebound.
  const deadline=Date.now()+signingWindowMs(original);
  const remaining=()=>{const left=deadline-Date.now();if(left<=0)throw new Error('Transaction expired. Review the action again.');return left;};
  let result:Awaited<ReturnType<typeof StellarWalletsKit.signTransaction>>;
  try{
    if(wallet==='freighter'){
      const current=await request.run(()=>kit!.fetchAddress(),Math.min(QUICK_TIMEOUT_MS*2,remaining()));
      if(attempt!==generation)throw new Error('Wallet selection changed. Reconnect before signing.');
      if(current.address!==address)throw new Error('The selected wallet account changed. Reconnect before signing.');
      if((await request.run(()=>kit!.getNetwork(),Math.min(QUICK_TIMEOUT_MS,remaining()))).networkPassphrase!==passphrase)throw new Error('Switch your wallet to the selected app network before signing.');
    }
    if(attempt!==generation)throw new Error('Wallet selection changed. Reconnect before signing.');
    // Sign only: never request implicit permissions or call signAndSubmitTransaction.
    result=await request.run(()=>kit!.signTransaction(xdr,{address,networkPassphrase:passphrase}),remaining(),{watchPopup:wallet==='albedo'});
  }catch(error){throw describeWalletError(error,wallet);}
  if(attempt!==generation||connectedAddress!==address)throw new Error('Wallet selection changed while signing. Reconnect and review again.');
  if(!result.signedTxXdr)throw new Error('Wallet did not return a signed transaction.');
  return validateWalletSignature(xdr,result.signedTxXdr,address,passphrase,result.signerAddress);
}
