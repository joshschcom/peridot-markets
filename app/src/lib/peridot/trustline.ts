/** Classic trustline preparation only. Never requests a signature or submits a transaction. */
import { Account, Asset, Networks, Operation, StrKey, Transaction, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { network } from './network';
import { assertRpcNetwork, getRpc, readContract } from './rpc';

export interface TrustlineAsset { token:string; code:string; issuer:string; asset:Asset }
export interface TrustlineSnapshot {
  address:string; sequence:bigint; balanceStroops:bigint; sellingLiabilitiesStroops:bigint;
  subentries:number; sponsoring:number; sponsored:number;
  baseReserveStroops:bigint; baseFeeStroops:bigint; inclusionFeeStroops:bigint;
  ledger:number; ledgerCloseTime:number; exists:boolean; issuerAuthorizationRequired:boolean;
}
export interface PreparedTrustline {
  xdr:string; token:string; address:string; code:string; issuer:string; limit:string;
  networkPassphrase:string; additionalReserveStroops:bigint; minimumBalanceAfterStroops:bigint;
  feeStroops:bigint; balanceStroops:bigint; availableAfterStroops:bigint;
  ledger:number; expiresAt:number; issuerAuthorizationRequired:boolean;
}
const LIMIT='922337203685.4775807';
function supportedNetwork(passphrase:string){
  if(passphrase!==Networks.PUBLIC&&passphrase!==Networks.TESTNET)throw new Error('Unsupported trustline network.');
}
/** A token's name is only a hint: deterministic SAC derivation must match the actual token. */
export async function resolveTrustlineAsset(token:string,readName:(token:string)=>Promise<string>=token=>readContract<string>(token,'name'),passphrase:string=network.passphrase):Promise<TrustlineAsset>{
  supportedNetwork(passphrase);
  if(!StrKey.isValidContract(token))throw new Error('Invalid token contract address.');
  if(token===Asset.native().contractId(passphrase))throw new Error('XLM does not require a trustline.');
  const name=await readName(token);
  const match=typeof name==='string'?/^([a-zA-Z0-9]{1,12}):(G[A-Z2-7]{55})$/.exec(name):null;
  if(!match||!StrKey.isValidEd25519PublicKey(match[2]))throw new Error('This token is not a verified classic Stellar asset.');
  const asset=new Asset(match[1],match[2]);
  if(asset.contractId(passphrase)!==token)throw new Error('Asset issuer does not match the token contract. A trustline cannot be created safely.');
  return {token,code:match[1],issuer:match[2],asset};
}

/** Pure budget and envelope builder, separated so all reserve checks can be regression tested. */
export function buildTrustlinePreparation(resolved:TrustlineAsset,address:string,snapshot:TrustlineSnapshot,passphrase:string=network.passphrase,now=Math.floor(Date.now()/1000)):PreparedTrustline{
  supportedNetwork(passphrase);
  if(!StrKey.isValidEd25519PublicKey(address)||snapshot.address!==address)throw new Error('Trustline account changed. Review again.');
  if(resolved.asset.isNative()||resolved.asset.contractId(passphrase)!==resolved.token||resolved.asset.code!==resolved.code||resolved.asset.issuer!==resolved.issuer)throw new Error('Trustline asset or network changed. Review again.');
  if(address===resolved.issuer)throw new Error('The issuer does not need a trustline to its own asset.');
  if(snapshot.exists)throw new Error('This trustline already exists. Refresh balances; issuer authorization may still be required.');
  if(!Number.isSafeInteger(now)||!Number.isSafeInteger(snapshot.ledgerCloseTime)||now-snapshot.ledgerCloseTime>120||snapshot.ledgerCloseTime-now>30)throw new Error('Ledger data is stale. Refresh before preparing a trustline.');
  if(!Number.isSafeInteger(snapshot.ledger)||snapshot.ledger<=0||snapshot.sequence<0n||snapshot.balanceStroops<0n||snapshot.sellingLiabilitiesStroops<0n||snapshot.baseReserveStroops<=0n||snapshot.baseFeeStroops<=0n||snapshot.inclusionFeeStroops<0n)throw new Error('Invalid account or ledger budget data.');
  if([snapshot.subentries,snapshot.sponsoring,snapshot.sponsored].some(value=>!Number.isSafeInteger(value)||value<0))throw new Error('Invalid account reserve counts.');
  const units=2n+BigInt(snapshot.subentries)+BigInt(snapshot.sponsoring)-BigInt(snapshot.sponsored);
  if(units<0n)throw new Error('Invalid sponsored reserve data.');
  const minimumBalanceAfterStroops=(units+1n)*snapshot.baseReserveStroops;
  const feeStroops=snapshot.inclusionFeeStroops>snapshot.baseFeeStroops?snapshot.inclusionFeeStroops:snapshot.baseFeeStroops;
  if(feeStroops>0xffffffffn)throw new Error('Network fee estimate is out of range. Try again later.');
  const availableAfterStroops=snapshot.balanceStroops-snapshot.sellingLiabilitiesStroops-minimumBalanceAfterStroops-feeStroops;
  if(availableAfterStroops<0n)throw new Error('Not enough available XLM for this trustline reserve and network fee. Fund the wallet, then review again.');
  const expiresAt=now+180;
  const tx=new TransactionBuilder(new Account(address,snapshot.sequence.toString()),{fee:feeStroops.toString(),networkPassphrase:passphrase})
    .addOperation(Operation.changeTrust({asset:resolved.asset,limit:LIMIT})).setTimebounds(Math.max(0,now-10),expiresAt).build();
  return {xdr:tx.toXDR(),token:resolved.token,address,code:resolved.code,issuer:resolved.issuer,limit:LIMIT,networkPassphrase:passphrase,
    additionalReserveStroops:snapshot.baseReserveStroops,minimumBalanceAfterStroops,feeStroops,balanceStroops:snapshot.balanceStroops,
    availableAfterStroops,ledger:snapshot.ledger,expiresAt,issuerAuthorizationRequired:snapshot.issuerAuthorizationRequired};
}
function accountKey(address:string){return xdr.LedgerKey.account(new xdr.LedgerKeyAccount({accountId:xdr.PublicKey.publicKeyTypeEd25519(StrKey.decodeEd25519PublicKey(address))}));}

/** Fresh public reads only. The caller must later sign and submit through the guarded wallet pipeline. */
export async function prepareTrustline(token:string,address:string):Promise<PreparedTrustline>{
  if(network.useMocks)throw new Error('Demo mode does not prepare real trustlines.');
  if(network.readOnly)throw new Error('This preview is read-only. Trustline transactions are not enabled.');
  if(!StrKey.isValidEd25519PublicKey(address))throw new Error('Connect a Stellar account before adding a trustline.');
  const resolved=await resolveTrustlineAsset(token);
  if(address===resolved.issuer)throw new Error('The issuer does not need a trustline to its own asset.');
  await assertRpcNetwork();
  const client=getRpc(),ownerKey=accountKey(address),issuerKey=accountKey(resolved.issuer);
  const trustKey=xdr.LedgerKey.trustline(new xdr.LedgerKeyTrustLine({accountId:xdr.PublicKey.publicKeyTypeEd25519(StrKey.decodeEd25519PublicKey(address)),asset:resolved.asset.toTrustLineXDRObject()}));
  const [latest,fees,entries]=await Promise.all([client.getLatestLedger(),client.getFeeStats(),client.getLedgerEntries(ownerKey,issuerKey,trustKey)]);
  const entry=(key:xdr.LedgerKey)=>entries.entries.find(item=>item.key.toXDR('base64')===key.toXDR('base64'))?.val;
  const owner=entry(ownerKey),issuer=entry(issuerKey),trust=entry(trustKey);
  if(!owner||owner.type!=='account')throw new Error('This account is not funded or account data is unavailable.');
  if(!issuer||issuer.type!=='account')throw new Error('The asset issuer account is unavailable.');
  if(trust&&trust.type!=='trustline')throw new Error('Unexpected trustline ledger response.');
  const account=owner.account;
  if(StrKey.encodeEd25519PublicKey(account.accountId.ed25519.value)!==address)throw new Error('RPC returned another account.');
  const ext=account.ext.type==='v1'?account.ext.v1:undefined;
  const sponsorship=ext?.ext.type==='v2'?ext.ext.v2:undefined;
  const header=latest.headerXdr;
  if(!header||!Number.isSafeInteger(header.baseReserve)||!Number.isSafeInteger(header.baseFee)||!/^\d+$/.test(fees.inclusionFee.p90))throw new Error('Current network reserve or fee data is unavailable.');
  return buildTrustlinePreparation(resolved,address,{address,sequence:account.seqNum,balanceStroops:account.balance,
    sellingLiabilitiesStroops:ext?.liabilities.selling??0n,subentries:account.numSubEntries,sponsoring:sponsorship?.numSponsoring??0,sponsored:sponsorship?.numSponsored??0,
    baseReserveStroops:BigInt(header.baseReserve),baseFeeStroops:BigInt(header.baseFee),inclusionFeeStroops:BigInt(fees.inclusionFee.p90),
    ledger:latest.sequence,ledgerCloseTime:Number(latest.closeTime),exists:!!trust,issuerAuthorizationRequired:(issuer.account.flags&1)!==0});
}

/** Recheck review identity and expiry immediately before invoking the wallet. */
export function validatePreparedTrustline(prepared:PreparedTrustline,address:string,passphrase:string=network.passphrase,now=Math.floor(Date.now()/1000)):Transaction{
  supportedNetwork(passphrase);
  if(prepared.address!==address||prepared.networkPassphrase!==passphrase)throw new Error('Wallet or network changed. Review this trustline again.');
  if(!Number.isSafeInteger(now)||prepared.expiresAt<=now+10)throw new Error('Trustline review expired. Review again.');
  const tx=TransactionBuilder.fromXDR(prepared.xdr,passphrase),asset=new Asset(prepared.code,prepared.issuer);
  if(!(tx instanceof Transaction)||tx.source!==address||tx.signatures.length||tx.operations.length!==1||asset.contractId(passphrase)!==prepared.token||tx.fee!==prepared.feeStroops.toString()||Number(tx.timeBounds?.maxTime)!==prepared.expiresAt)throw new Error('Trustline review does not match its prepared transaction.');
  const op=tx.operations[0];
  if(op.type!=='changeTrust'||op.source&&op.source!==address||!('code' in op.line)||op.line.code!==prepared.code||op.line.issuer!==prepared.issuer||op.limit!==prepared.limit)throw new Error('Unexpected trustline operation.');
  return tx;
}
