import test from 'node:test';
import assert from 'node:assert/strict';
import {Asset,Keypair,Networks,TransactionBuilder} from '@stellar/stellar-sdk';
import {buildTrustlinePreparation,resolveTrustlineAsset,validatePreparedTrustline,type TrustlineSnapshot} from './trustline';
const issuer=Keypair.random().publicKey(),address=Keypair.random().publicKey(),asset=new Asset('USDC',issuer);
const token=asset.contractId(Networks.PUBLIC),now=2_000_000_000;
const resolved={token,code:'USDC',issuer,asset};
const snapshot:TrustlineSnapshot={address,sequence:100n,balanceStroops:50_000_000n,sellingLiabilitiesStroops:0n,subentries:0,sponsoring:0,sponsored:0,baseReserveStroops:5_000_000n,baseFeeStroops:100n,inclusionFeeStroops:200n,ledger:100,ledgerCloseTime:now-3,exists:false,issuerAuthorizationRequired:false};
test('classic asset name must derive exactly the selected SAC and network',async()=>{
 const result=await resolveTrustlineAsset(token,async()=>`USDC:${issuer}`,Networks.PUBLIC);
 assert.equal(result.code,'USDC');assert.equal(result.issuer,issuer);
 await assert.rejects(resolveTrustlineAsset(token,async()=>`USDC:${Keypair.random().publicKey()}`,Networks.PUBLIC),/issuer does not match/);
 await assert.rejects(resolveTrustlineAsset(token,async()=>`USDC:${issuer}`,Networks.TESTNET),/issuer does not match/);
 await assert.rejects(resolveTrustlineAsset(token,async()=>'custom token',Networks.PUBLIC),/not a verified classic/);
});
test('native XLM is rejected before looking up its name',async()=>{
 let reads=0;await assert.rejects(resolveTrustlineAsset(Asset.native().contractId(Networks.PUBLIC),async()=>{reads++;return 'native';},Networks.PUBLIC),/does not require/);assert.equal(reads,0);
});
test('preparation contains exactly one unsigned changeTrust with current fee and reserve',()=>{
 const prepared=buildTrustlinePreparation(resolved,address,snapshot,Networks.PUBLIC,now);
 const tx=validatePreparedTrustline(prepared,address,Networks.PUBLIC,now);
 assert.equal(tx.signatures.length,0);assert.equal(tx.sequence,'101');assert.equal(tx.operations.length,1);
 assert.equal(tx.operations[0].type,'changeTrust');assert.equal(tx.fee,'200');
 assert.equal(prepared.additionalReserveStroops,5_000_000n);assert.equal(prepared.minimumBalanceAfterStroops,15_000_000n);
 assert.equal(prepared.availableAfterStroops,34_999_800n);assert.equal(prepared.expiresAt,now+180);
});
test('reserve budget includes sponsorship counts and native selling liabilities',()=>{
 const prepared=buildTrustlinePreparation(resolved,address,{...snapshot,subentries:4,sponsoring:2,sponsored:1,sellingLiabilitiesStroops:1_000_000n},Networks.PUBLIC,now);
 assert.equal(prepared.minimumBalanceAfterStroops,40_000_000n);assert.equal(prepared.availableAfterStroops,8_999_800n);
 assert.throws(()=>buildTrustlinePreparation(resolved,address,{...snapshot,balanceStroops:15_000_199n},Networks.PUBLIC,now),/Not enough available XLM/);
 assert.throws(()=>buildTrustlinePreparation(resolved,address,{...snapshot,balanceStroops:20_000_000n,sellingLiabilitiesStroops:6_000_000n},Networks.PUBLIC,now),/Not enough available XLM/);
});
test('preparation rejects existing lines, stale ledgers and mismatched accounts',()=>{
 assert.throws(()=>buildTrustlinePreparation(resolved,address,{...snapshot,exists:true},Networks.PUBLIC,now),/already exists/);
 assert.throws(()=>buildTrustlinePreparation(resolved,address,{...snapshot,ledgerCloseTime:now-121},Networks.PUBLIC,now),/stale/);
 assert.throws(()=>buildTrustlinePreparation(resolved,address,{...snapshot,address:issuer},Networks.PUBLIC,now),/account changed/);
 assert.throws(()=>buildTrustlinePreparation(resolved,issuer,{...snapshot,address:issuer},Networks.PUBLIC,now),/issuer does not need/);
 assert.throws(()=>buildTrustlinePreparation(resolved,address,{...snapshot,baseReserveStroops:0n},Networks.PUBLIC,now),/Invalid account or ledger/);
});
test('review validation rejects expiry, wallet/network changes and altered transaction metadata',()=>{
 const p=buildTrustlinePreparation(resolved,address,snapshot,Networks.PUBLIC,now);
 assert.throws(()=>validatePreparedTrustline(p,address,Networks.PUBLIC,now+171),/expired/);
 assert.throws(()=>validatePreparedTrustline(p,issuer,Networks.PUBLIC,now),/Wallet or network changed/);
 assert.throws(()=>validatePreparedTrustline(p,address,Networks.TESTNET,now),/Wallet or network changed/);
 assert.throws(()=>validatePreparedTrustline({...p,feeStroops:201n},address,Networks.PUBLIC,now),/does not match/);
 assert.throws(()=>validatePreparedTrustline({...p,limit:'100'},address,Networks.PUBLIC,now),/Unexpected trustline/);
 assert.equal(TransactionBuilder.fromXDR(p.xdr,Networks.PUBLIC).signatures.length,0);
});
