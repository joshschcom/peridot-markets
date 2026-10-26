/** Canonical DeFindex vaults a market may route into, one per supported token. Pure data, node-testable.
 *
 * The add-market flow never takes a free-form DeFindex address: the vault for the chosen token comes from this map,
 * so an owner cannot point a market at an unknown vault. The market-factory allow-list (`is_yield_vault_allowed`) is
 * still the final gate and is read live by the UI.
 *
 * Sources (mainnet):
 *   peridot-contracts/addresses.md, section "Oracle and External DeFi":
 *     "Peridot XLM DeFindex Vault", "Peridot USDC DeFindex Vault", "Peridot EURC DeFindex Vault".
 *   peridot-contracts/scripts/execute_receipt_vault_borrow_fix_mainnet.sh, STRATEGIES array (same three vaults, in the
 *     same token order as its TOKENS array XLM, USDC, EURC).
 *   app/src/lib/peridot/deployments/mainnet.json external.defindex_vaults.XLM (matches the XLM entry).
 *   Token contracts: addresses.md "Assets" (XLM, USDC, EURC Stellar Asset Contracts).
 * Verified by read-only simulation on 2026-10-26: name/symbol "DeFindex-Vault-Peridot XLM Vault" (PXLMCVault),
 * "DeFindex-Vault-Peridot USDC Vault" (PUSDCVault), "DeFindex-Vault-Peridot EURC Vault" (PEURCVault); each manages
 * exactly its token with one unpaused Blend autocompound strategy. Only the XLM vault was allow-listed by the market
 * factory at that time; USDC and EURC show "needs Peridot approval" until `set_yield_vault_allowed` is called.
 * The "Soroswap/DeFIndex USDC Vault" and "EURC Vault" lines in addresses.md are the public Soroswap Earn vaults, not
 * Peridot's, and are deliberately not used here.
 *
 * Testnet has no DeFindex deployment in the manifest, so the map is empty there and the option is disabled. */
import type { AppNetwork } from './registry';

export type DefindexSymbol = 'XLM' | 'USDC' | 'EURC';
export interface DefindexDefault {
  symbol: DefindexSymbol;
  /** Underlying token contract the vault must report in `get_assets()[0].address`. */
  token: string;
  vault: string;
  /** Where the address was taken from, for the UI tooltip. */
  source: string;
}

export const DEFINDEX_DEFAULTS: Record<AppNetwork, readonly DefindexDefault[]> = {
  mainnet: [
    { symbol: 'XLM', token: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA', vault: 'CCB2AR5X3KP4WQKE7HNSUSDS7SHFMC2WPVSZ2ZXJ6DHXOKHFFKOZE6GK', source: 'peridot-contracts/addresses.md (Peridot XLM DeFindex Vault); deployments/mainnet.json external.defindex_vaults.XLM' },
    { symbol: 'USDC', token: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75', vault: 'CAB4JOLSCNELJVDQKZLVGHKWJCLXFDBZZMITJAFL4GBGTHIKWO47PYFH', source: 'peridot-contracts/addresses.md (Peridot USDC DeFindex Vault)' },
    { symbol: 'EURC', token: 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV', vault: 'CBP2R5KYAWJCOCVDTSNTEVL3O6JBTWOOH7SZOX7DX5DLGVZCAMLBDZM3', source: 'peridot-contracts/addresses.md (Peridot EURC DeFindex Vault)' },
  ],
  testnet: [],
};

export const DEFINDEX_SYMBOLS: readonly DefindexSymbol[] = ['XLM', 'USDC', 'EURC'];

/** The default vault for a token contract on a network, or undefined when the token has no canonical DeFindex vault. */
export function defaultDefindexVault(net: AppNetwork, token: string): DefindexDefault | undefined {
  return DEFINDEX_DEFAULTS[net].find(d => d.token === token);
}

/** Lookup by symbol, for copy and manifests keyed by symbol. Case-insensitive. */
export function defaultDefindexVaultBySymbol(net: AppNetwork, symbol: string): DefindexDefault | undefined {
  const s = symbol.toUpperCase();
  return DEFINDEX_DEFAULTS[net].find(d => d.symbol === s);
}

/** Why the DeFindex option is disabled for a token, or null when it is available. */
export function defindexUnavailableReason(net: AppNetwork, token: string, symbol?: string): string | null {
  if (DEFINDEX_DEFAULTS[net].length === 0) return `No DeFindex vault is deployed on ${net}. DeFindex vaults are mainnet only.`;
  if (!token) return 'Verify a token first. DeFindex vaults exist for XLM, USDC and EURC.';
  if (defaultDefindexVault(net, token)) return null;
  const label = symbol ? symbol : 'This token';
  return `${label} has no Peridot DeFindex vault. DeFindex is available for XLM, USDC and EURC only.`;
}
