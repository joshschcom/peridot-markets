import test from 'node:test';
import assert from 'node:assert/strict';
import {Account,Contract,Keypair,Networks,TransactionBuilder} from '@stellar/stellar-sdk';
import {validateWalletSignature} from './kit';
const signer=Keypair.random(),other=Keypair.random();
const contract='CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';
const transaction=(network=Networks.PUBLIC,method='symbol')=>new TransactionBuilder(new Account(signer.publicKey(),'1'),{fee:'100',networkPassphrase:network}).addOperation(new Contract(contract).call(method)).setTimeout(120).build();
test('accepts an unchanged Soroban envelope signed by the expected account',()=>{
 const tx=transaction(),unsigned=tx.toXDR();tx.sign(signer);
 assert.equal(validateWalletSignature(unsigned,tx.toXDR(),signer.publicKey(),Networks.PUBLIC,signer.publicKey()),tx.toXDR());
 assert.equal(validateWalletSignature(unsigned,tx.toXDR(),signer.publicKey(),Networks.PUBLIC),tx.toXDR());
});
test('rejects changed transaction, wrong account, network and unsigned response',()=>{
 const tx=transaction(),unsigned=tx.toXDR();
 assert.throws(()=>validateWalletSignature(unsigned,unsigned,signer.publicKey(),Networks.PUBLIC),/signature/);
 const changed=transaction(Networks.PUBLIC,'decimals');changed.sign(signer);
 assert.throws(()=>validateWalletSignature(unsigned,changed.toXDR(),signer.publicKey(),Networks.PUBLIC),/changed/);
 tx.sign(other);assert.throws(()=>validateWalletSignature(unsigned,tx.toXDR(),signer.publicKey(),Networks.PUBLIC),/signature/);
 const wrongNetwork=TransactionBuilder.fromXDR(unsigned,Networks.TESTNET);wrongNetwork.sign(signer);
 assert.throws(()=>validateWalletSignature(unsigned,wrongNetwork.toXDR(),signer.publicKey(),Networks.PUBLIC),/network/);
 const valid=TransactionBuilder.fromXDR(unsigned,Networks.PUBLIC);valid.sign(signer);
 assert.throws(()=>validateWalletSignature(unsigned,valid.toXDR(),signer.publicKey(),Networks.PUBLIC,other.publicKey()),/another account/);
});
import {describeWalletError,signingWindowMs,SIGN_TIMEOUT_MS,EXPIRY_GUARD_MS} from './kit';
test('wallet errors become actionable messages',()=>{
 assert.match(describeWalletError({code:-1,message:'Freighter is not connected'},'freighter').message,/Install and unlock the Freighter extension/);
 assert.match(describeWalletError({code:-4,message:'Action rejected by user'},'albedo').message,/declined the request in Albedo/);
 assert.match(describeWalletError({message:'The user rejected this request.'},'freighter').message,/declined the request in Freighter/);
 const own=new Error('Wallet request cancelled. Close its window before trying again.');
 assert.equal(describeWalletError(own,'albedo'),own);
 assert.match(describeWalletError({message:'Some specific wallet text'},'albedo').message,/Some specific wallet text/);
 assert.match(describeWalletError(undefined,'albedo').message,/Try again/);
});
test('the signing window never outlives the transaction timebound',()=>{
 const now=1_700_000_000_000;
 const tx=(max:number)=>{const t=new TransactionBuilder(new Account(signer.publicKey(),'1'),{fee:'100',networkPassphrase:Networks.PUBLIC}).addOperation(new Contract(contract).call('symbol')).setTimebounds(0,max).build();return t;};
 assert.equal(signingWindowMs(tx(Math.floor(now/1000)+120),now),120_000-EXPIRY_GUARD_MS);
 assert.equal(signingWindowMs(tx(Math.floor(now/1000)+3600),now),SIGN_TIMEOUT_MS);
 assert.ok(signingWindowMs(tx(Math.floor(now/1000)-5),now)<0);
 assert.equal(signingWindowMs(tx(0),now),SIGN_TIMEOUT_MS);
});
