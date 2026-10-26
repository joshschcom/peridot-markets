import { Keypair, TransactionBuilder, Networks, xdr } from '@stellar/stellar-sdk';
import type { Signer } from '../../src/lib/peridot/rpc';

/** Wallets (Albedo/Freighter tx intents) sign the envelope only. Flag non-source credentials. */
export function addressCredentialAuth(txXdr: string, passphrase: string): string[] {
  const tx: any = TransactionBuilder.fromXDR(txXdr, passphrase);
  const out: string[] = [];
  for (const op of tx.operations ?? []) for (const a of op.auth ?? []) {
    if (a.credentials?.type === 'sorobanCredentialsAddress') out.push(String(a.rootInvocation?.function?.invokeContract?.functionName ?? '?'));
  }
  return out;
}
export const authWarnings: string[] = [];
export interface Resources { instructions: number; readBytes: number; writeBytes: number; readOnlyEntries: number; readWriteEntries: number; ledgerEntries: number; resourceFee: string }
export function resourcesFromEnvelope(env: any): Resources | null {
  const ext = env?.v1?.tx?.ext;
  if (!ext || ext.type !== 'sorobanData') return null;
  const d = ext.sorobanData, r = d.resources, fp = r.footprint;
  return { instructions: Number(r.instructions), readBytes: Number(r.diskReadBytes ?? r.readBytes ?? 0), writeBytes: Number(r.writeBytes),
    readOnlyEntries: fp.readOnly.length, readWriteEntries: fp.readWrite.length, ledgerEntries: fp.readOnly.length + fp.readWrite.length, resourceFee: String(d.resourceFee) };
}
export function resourcesOf(txXdr: string, passphrase: string): Resources | null {
  const tx: any = TransactionBuilder.fromXDR(txXdr, passphrase);
  return resourcesFromEnvelope(tx.toEnvelope());
}
/** Signs exactly like a wallet's signTransaction: parse the prepared XDR, sign the envelope, hand it back. */
export function keypairSigner(kp: Keypair, passphrase: string, hooks?: { onPrepared?: (xdrB64: string, r: Resources | null) => void }): Signer {
  return {
    address: kp.publicKey(),
    signTransaction: async (xdrB64: string) => {
      const addrAuth = addressCredentialAuth(xdrB64, passphrase);
      if (addrAuth.length) authWarnings.push(`address-credential auth entries: ${addrAuth.length}`);
      hooks?.onPrepared?.(xdrB64, resourcesOf(xdrB64, passphrase));
      const tx = TransactionBuilder.fromXDR(xdrB64, passphrase);
      tx.sign(kp);
      return tx.toXDR();
    },
  };
}
/** Dry-run signer: records the app's prepared (simulated + assembled) tx, then refuses. */
export function dryRunSigner(address: string, passphrase: string, sink: { last?: { xdr: string; resources: Resources | null; fee: string } }): Signer {
  return {
    address,
    signTransaction: async (xdrB64: string) => {
      const tx: any = TransactionBuilder.fromXDR(xdrB64, passphrase);
      sink.last = { xdr: xdrB64, resources: resourcesOf(xdrB64, passphrase), fee: String(tx.fee) };
      throw new Error('dry run');
    },
  };
}
export { Networks };
