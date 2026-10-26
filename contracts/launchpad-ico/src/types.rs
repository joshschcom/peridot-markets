use soroban_sdk::{contracttype, Address};

pub const SCALE: i128 = 10_000_000;
/// Conservative bounds also keep quote * SCALE within i128.
pub const MAX_AMOUNT: i128 = 10_000_000_000_000_000_000;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IcoParams {
    pub quote_token: Address,
    /// Token supply in base units, with seven decimals.
    pub supply: i128,
    /// Quote base units per whole token. Quote must have seven decimals.
    pub price: i128,
    pub soft_cap: i128,
    pub hard_cap: i128,
    pub start: u64,
    pub end: u64,
    /// Cumulative quote per buyer; zero disables the cap.
    pub buyer_cap: i128,
}

impl IcoParams {
    pub fn valid(&self, now: u64) -> bool {
        self.start >= now && self.end.checked_sub(self.start).is_some_and(|d| (600..=2_592_000).contains(&d))
            && self.supply > 0 && self.supply <= MAX_AMOUNT
            && self.price > 0 && self.price <= MAX_AMOUNT
            && self.soft_cap > 0 && self.soft_cap <= self.hard_cap && self.hard_cap <= MAX_AMOUNT
            && self.buyer_cap >= 0 && self.buyer_cap <= self.hard_cap
            && self.hard_cap * SCALE / self.price <= self.supply
            && self.hard_cap * SCALE / self.price > 0
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config { pub token: Address, pub creator: Address, pub params: IcoParams }

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct State {
    /// 0 = open, 1 = succeeded, 2 = failed. Finalization only after end.
    pub phase: u32,
    pub raised: i128,
    pub allocated: i128,
    pub paused: bool,
    pub withdrawn: bool,
}

#[contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct Position { pub paid: i128, pub tokens: i128, pub claimed: bool, pub refunded: bool }
