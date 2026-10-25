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
