//! Generic vault factory. Peridot (admin) registers one Wasm hash per vault KIND (`set_wasm`); anyone
//! can then deploy a vault of that kind with `create_vault`, passing the constructor arguments as an
//! opaque `Vec<Val>`. The factory knows nothing about any vault's configuration: parameter validation
//! (ranges, fees, caps, cooldowns...) lives in each vault's constructor, so a bad config makes the whole
//! `create_vault` call revert atomically.
//!
//! Convention: `init_args[0]` is the vault OWNER address and must equal `owner` (checked here), so the
//! registry never lies about who controls a vault. The owner must authorize `create_vault`.
//!
//! The factory is NOT an admin of the vaults it deploys (no hidden control): each vault has its own
//! owner and its own upgrade policy. The factory admin can only add or replace wasm hashes for FUTURE
//! vaults and upgrade the factory itself.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Bytes, BytesN, Env, Symbol,
    TryFromVal, Val, Vec,
};

const TTL_THRESHOLD: u32 = 100_000;
const TTL_EXTEND_TO: u32 = 400_000;

pub const MAX_LIST_LIMIT: u32 = 50;
pub const MAX_VAULTS_PER_OWNER: u32 = 100;
pub const MAX_INIT_ARGS: u32 = 32;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FactoryError {
    NotAdmin = 1,
    UnknownKind = 2,
    OwnerMismatch = 3,
    TooManyArgs = 4,
    TooManyVaults = 5,
    NotFound = 6,
}

/// What the registry stores per vault.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultRecord {
    pub kind: Symbol,
    pub owner: Address,
    pub ledger: u32,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Count,
    Nonce,
    /// kind symbols in registration order
    Kinds,
    Wasm(Symbol),
    /// global index -> vault
    At(u32),
    Record(Address),
    OwnerList(Address),
}

#[contractevent(topics = ["wasm_set"])]
pub struct WasmSet {
    #[topic]
    pub kind: Symbol,
    pub hash: BytesN<32>,
}

#[contractevent(topics = ["created"])]
pub struct VaultCreated {
    #[topic]
    pub owner: Address,
    #[topic]
    pub kind: Symbol,
    pub vault: Address,
    pub index: u32,
}

#[contractevent(topics = ["upgraded"])]
pub struct Upgraded {
    pub hash: BytesN<32>,
}

#[contract]
pub struct VaultFactory;

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn require_admin(env: &Env, admin: &Address) -> Result<(), FactoryError> {
    let stored: Address = env.storage().instance().get(&DataKey::Admin).ok_or(FactoryError::NotAdmin)?;
    if stored != *admin {
        return Err(FactoryError::NotAdmin);
    }
    admin.require_auth();
    Ok(())
}

#[contractimpl]
impl VaultFactory {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Count, &0u32);
        env.storage().instance().set(&DataKey::Nonce, &0u32);
        env.storage().instance().set(&DataKey::Kinds, &Vec::<Symbol>::new(&env));
        bump_instance(&env);
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Hands the admin role to `new_admin` (immediate; used to move from a deploy key to the Peridot admin).
    pub fn transfer_admin(env: Env, admin: Address, new_admin: Address) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        new_admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        bump_instance(&env);
        Ok(())
    }

    /// Registers or replaces the Wasm for `kind`. Only affects vaults created afterwards.
    pub fn set_wasm(env: Env, admin: Address, kind: Symbol, hash: BytesN<32>) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        let mut kinds: Vec<Symbol> = env.storage().instance().get(&DataKey::Kinds).unwrap();
        if !kinds.contains(&kind) {
            kinds.push_back(kind.clone());
            env.storage().instance().set(&DataKey::Kinds, &kinds);
        }
        env.storage().instance().set(&DataKey::Wasm(kind.clone()), &hash);
        bump_instance(&env);
        WasmSet { kind, hash }.publish(&env);
        Ok(())
    }

    /// Removes a kind so no new vaults of it can be created (existing vaults are untouched).
    pub fn remove_kind(env: Env, admin: Address, kind: Symbol) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        let kinds: Vec<Symbol> = env.storage().instance().get(&DataKey::Kinds).unwrap();
        let mut out = Vec::new(&env);
        for k in kinds.iter() {
            if k != kind {
                out.push_back(k);
            }
        }
        env.storage().instance().set(&DataKey::Kinds, &out);
        env.storage().instance().remove(&DataKey::Wasm(kind));
        bump_instance(&env);
        Ok(())
    }

    pub fn kinds(env: Env) -> Vec<Symbol> {
        env.storage().instance().get(&DataKey::Kinds).unwrap()
    }

    pub fn get_wasm(env: Env, kind: Symbol) -> Option<BytesN<32>> {
        env.storage().instance().get(&DataKey::Wasm(kind))
    }

    /// Immediate upgrade of the factory itself.
    pub fn upgrade(env: Env, admin: Address, hash: BytesN<32>) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        Upgraded { hash: hash.clone() }.publish(&env);
        env.deployer().update_current_contract_wasm(hash);
        Ok(())
    }

    /// Deploys the registered Wasm for `kind` with constructor arguments `init_args` and records the
    /// vault. `init_args[0]` must be `owner`. `salt` is mixed with a global counter, so addresses cannot
    /// collide or be front-run. A constructor panic (invalid config) reverts the whole call.
    pub fn create_vault(
        env: Env,
        owner: Address,
        kind: Symbol,
        salt: BytesN<32>,
        init_args: Vec<Val>,
    ) -> Result<Address, FactoryError> {
        owner.require_auth();
        if init_args.len() > MAX_INIT_ARGS {
            return Err(FactoryError::TooManyArgs);
        }
        let first = init_args.get(0).ok_or(FactoryError::OwnerMismatch)?;
        match Address::try_from_val(&env, &first) {
            Ok(a) if a == owner => {}
            _ => return Err(FactoryError::OwnerMismatch),
        }
        let hash: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::Wasm(kind.clone()))
            .ok_or(FactoryError::UnknownKind)?;

        let okey = DataKey::OwnerList(owner.clone());
        let mut mine: Vec<Address> = env.storage().persistent().get(&okey).unwrap_or(Vec::new(&env));
        if mine.len() >= MAX_VAULTS_PER_OWNER {
            return Err(FactoryError::TooManyVaults);
        }

        let nonce: u32 = env.storage().instance().get(&DataKey::Nonce).unwrap();
        env.storage().instance().set(&DataKey::Nonce, &(nonce + 1));
        let mut b = Bytes::new(&env);
        b.extend_from_array(&salt.to_array());
        b.extend_from_array(&nonce.to_be_bytes());
        let real_salt: BytesN<32> = env.crypto().sha256(&b).to_bytes();
        let vault = env.deployer().with_current_contract(real_salt).deploy_v2(hash, init_args);

        let index: u32 = env.storage().instance().get(&DataKey::Count).unwrap();
        env.storage().instance().set(&DataKey::Count, &(index + 1));
        let at = DataKey::At(index);
        env.storage().persistent().set(&at, &vault);
        bump_persistent(&env, &at);
        let rkey = DataKey::Record(vault.clone());
        env.storage().persistent().set(
            &rkey,
            &VaultRecord { kind: kind.clone(), owner: owner.clone(), ledger: env.ledger().sequence() },
        );
        bump_persistent(&env, &rkey);
        mine.push_back(vault.clone());
        env.storage().persistent().set(&okey, &mine);
        bump_persistent(&env, &okey);
        bump_instance(&env);

        VaultCreated { owner, kind, vault: vault.clone(), index }.publish(&env);
        Ok(vault)
    }

    pub fn vault_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    /// Page of vaults in creation order (`limit` capped at 50).
    pub fn list_vaults(env: Env, start: u32, limit: u32) -> Vec<Address> {
        let count = Self::vault_count(env.clone());
        let limit = limit.min(MAX_LIST_LIMIT);
        let mut out = Vec::new(&env);
        let mut i = start;
        while i < count && out.len() < limit {
            if let Some(v) = env.storage().persistent().get::<_, Address>(&DataKey::At(i)) {
                out.push_back(v);
            }
            i += 1;
        }
        out
    }

    pub fn vaults_of(env: Env, owner: Address) -> Vec<Address> {
        env.storage().persistent().get(&DataKey::OwnerList(owner)).unwrap_or(Vec::new(&env))
    }

    /// `(kind, owner, ledger)`.
    pub fn get_vault(env: Env, vault: Address) -> Result<(Symbol, Address, u32), FactoryError> {
        let r: VaultRecord = env.storage().persistent().get(&DataKey::Record(vault)).ok_or(FactoryError::NotFound)?;
        Ok((r.kind, r.owner, r.ledger))
    }
}

#[cfg(test)]
mod test;
