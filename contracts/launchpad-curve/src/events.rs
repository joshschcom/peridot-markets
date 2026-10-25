use soroban_sdk::{contractevent, Address, BytesN};

use crate::types::Phase;

#[contractevent(topics = ["buy"])]
pub struct Buy {
    #[topic]
    pub user: Address,
    /// Quote charged, including the fee.
    pub quote_in: i128,
    pub fee: i128,
    pub tokens_out: i128,
    /// True when the buy was clamped at the graduation target.
    pub clamped: bool,
    pub real_quote: i128,
    pub sold: i128,
}

#[contractevent(topics = ["sell"])]
pub struct Sell {
    #[topic]
    pub user: Address,
    pub tokens_in: i128,
    /// Quote paid to the seller, after the fee.
    pub quote_out: i128,
    pub fee: i128,
    pub real_quote: i128,
    pub sold: i128,
}

#[contractevent(topics = ["state_changed"])]
pub struct StateChanged {
    pub from: Phase,
    pub to: Phase,
    pub real_quote: i128,
}

#[contractevent(topics = ["fees_claimed"])]
pub struct FeesClaimed {
    pub treasury_amount: i128,
    pub creator_amount: i128,
}

#[contractevent(topics = ["upgraded"])]
pub struct Upgraded {
    pub wasm_hash: BytesN<32>,
}

#[contractevent(topics = ["pool_created"])]
pub struct PoolCreated {
    #[topic]
    pub pool: Address,
    pub pool_index: BytesN<32>,
    pub share_token: Address,
    pub payer: Address,
    pub quote_amount: i128,
    pub token_amount: i128,
    pub lp_shares_burned: i128,
    pub unsold_burned: i128,
    pub fee_token: Address,
    pub fee_paid: i128,
}

#[contractevent(topics = ["group_created"])]
pub struct GroupCreated {
    #[topic]
    pub group_id: u32,
}

#[contractevent(topics = ["market_added"])]
pub struct MarketAdded {
    #[topic]
    pub group_id: u32,
    pub market: Address,
    pub underlying: Address,
    pub is_quote: bool,
}

#[contractevent(topics = ["market_activated"])]
pub struct MarketActivated {
    #[topic]
    pub group_id: u32,
    pub market: Address,
    pub is_quote: bool,
}

#[contractevent(topics = ["graduated"])]
pub struct Graduated {
    #[topic]
    pub token: Address,
    pub pool: Address,
    pub group_id: u32,
}

#[contractevent(topics = ["group_claimed"])]
pub struct GroupClaimed {
    #[topic]
    pub group_id: u32,
    pub owner: Address,
}
