/**
 * TypeScript mirror of `contracts/peridot-interfaces` (Rust is canonical).
 * Follows the `stellar contract bindings typescript` conventions so these types
 * can be used with generated clients: enums are tagged unions, u128/i128 are
 * bigint, Address is a strkey string, BytesN is a Buffer, Option<T> is T | undefined.
 *
 * Only Lead A edits this file. Changes are announced in docs/COORDINATION.md.
 */

export type Address = string;

// Reflector types, identical layout to core simple-peridottroller/src/reflector.rs
export type Asset =
  | { tag: "Stellar"; values: readonly [Address] }
  | { tag: "Other"; values: readonly [string] };

export interface PriceData {
  price: bigint;
  timestamp: bigint;
}

// 6.1 YieldVault
export interface VaultState {
  kind: string;
  underlying: Address;
  total_shares: bigint;
  total_value: bigint;
  principal: bigint;
  reserve: bigint;
  last_harvest_ts: bigint;
  last_harvest_amount: bigint;
  apy_hint_bps: number;
  paused: boolean;
}

// 6.2 PriceRouter
export type PriceConfig =
  | { tag: "ReflectorOnly"; values: readonly [{ oracle: Address; asset: Asset }] }
  | {
      tag: "ReflectorWithAquariusGuard";
      values: readonly [
        {
          oracle: Address;
          asset: Asset;
          pool: Address;
          quote_token: Address;
          max_dev_bps: number;
        },
      ];
    }
  | { tag: "AquariusOnly"; values: readonly [{ pool: Address; quote_token: Address }] };

/** status: "ok" | "stale" | "deviation" | "unavailable" */
export interface PriceCheck {
  mode: string;
  reflector_price: bigint | undefined;
  aquarius_price: bigint | undefined;
  deviation_bps: number | undefined;
  status: string;
  timestamp: bigint;
}

// 6.4 Factory types
export interface RateModel {
  base: bigint;
  multiplier: bigint;
  jump: bigint;
  kink: bigint;
}

export type YieldRoute =
  | { tag: "None"; values: void }
  | { tag: "Defindex"; values: readonly [{ vault: Address }] }
  | { tag: "Blend"; values: readonly [{ fee_vault: Address }] }
  | {
      tag: "Aquarius";
      values: readonly [
        { pool: Address; pair_token: Address; reserve_cut_bps: number; reserve_cap_bps: number },
      ];
    }
  | {
      tag: "Zenex";
      values: readonly [
        { market: Address; vault: Address; target_buffer_bps: number; min_buffer_bps: number },
      ];
    }
  | { tag: "Xoxno"; values: readonly [{ hub_id: number; spoke_id: number }] };

export interface MarketConfig {
  token: Address;
  /** 1e6 scale */
  collateral_factor: bigint;
  supply_cap: bigint;
  borrow_cap: bigint;
  /** 1e6 scale */
  reserve_factor: bigint;
  rates: RateModel;
  idle_buffer_bps: number;
  yield_route: YieldRoute;
  price: PriceConfig;
  margin_enabled: boolean;
  supply_reward_per_sec: bigint;
  borrow_reward_per_sec: bigint;
}

export type MarginVariant = { tag: "Audited"; values: void } | { tag: "Custom"; values: void };

export interface GroupMarginConfig {
  variant: MarginVariant;
  max_leverage: bigint;
  /** 1e6 scale */
  max_slippage: bigint;
  /** 1e6 scale */
  liquidation_incentive: bigint;
  /** 1e6 scale */
  liquidation_fee: bigint;
}

export interface MarginInfo {
  controller: Address;
  swap_adapter: Address;
  variant: MarginVariant;
  cfg: GroupMarginConfig;
  enabled_markets: Array<Address>;
}

export type KeeperMode =
  | { tag: "None"; values: void }
  | { tag: "PeridotHosted"; values: void }
  | { tag: "SelfHosted"; values: readonly [Address] };

export interface Group {
  id: number;
  owner: Address;
  name: string;
  controller: Address;
  price_router: Address;
  reward_distributor: Address | undefined;
  margin_controller: Address | undefined;
  markets: Array<Address>;
  created_at: bigint;
  keeper_mode: KeeperMode;
  keeper_paid_until: bigint;
}

export interface WasmHashes {
  controller: Buffer;
  receipt_vault: Buffer;
  jump_rate: Buffer;
  price_router: Buffer;
  reward_distributor: Buffer;
  swap_adapter: Buffer;
  blend_adapter: Buffer | undefined;
  aquarius_vault: Buffer | undefined;
  aquarius_reserve: Buffer | undefined;
  zenex_adapter: Buffer | undefined;
  xoxno_adapter: Buffer | undefined;
}

// 6.5 deployments/<network>.json
export interface Deployments {
  network: "mainnet" | "testnet";
  core_commit: string;
  factory: string;
  margin_factory: string;
  wasm: Record<string, string>;
  external: Record<string, string | Record<string, string>>;
  swap_adapter: string;
  demo: { group_id: number; markets: Record<string, string> };
}

// Guardrail constants shown in the UI (mirrors contracts/market-factory/src/guardrails.rs)
export const GUARDRAILS = {
  MAX_CF_REFLECTOR: 750_000n,
  MAX_CF_AQUARIUS_ONLY: 500_000n,
  MIN_IDLE_BUFFER_BPS: 1_000,
  MAX_IDLE_BUFFER_BPS: 10_000,
  MAX_RESERVE_FACTOR: 500_000n,
  MAX_GROUP_LEVERAGE: 5n,
  MIN_LIQUIDATION_INCENTIVE: 1_020_000n,
  MAX_LIQUIDATION_INCENTIVE: 1_150_000n,
  MAX_SLIPPAGE: 100_000n,
  STAGED_PARAM_DELAY_SECS: 60,
} as const;
