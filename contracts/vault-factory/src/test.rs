extern crate std;

use soroban_sdk::{
    testutils::Address as _, vec, Address, Bytes, BytesN, Env, IntoVal, Symbol, Val, Vec,
};

use crate::{FactoryError, VaultFactory, VaultFactoryClient};

// Rebuild: stellar contract build --package mock-kind-vault && cp target/wasm32v1-none/release/mock_kind_vault.wasm contracts/vault-factory/testdata/
const KIND_WASM: &[u8] = include_bytes!("../testdata/mock_kind_vault.wasm");

struct Ctx<'a> {
    env: Env,
    f: VaultFactoryClient<'a>,
    admin: Address,
    hash: BytesN<32>,
}

fn setup<'a>() -> Ctx<'a> {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(VaultFactory, (&admin,));
    let f = VaultFactoryClient::new(&env, &id);
    let hash = env.deployer().upload_contract_wasm(Bytes::from_slice(&env, KIND_WASM));
    f.set_wasm(&admin, &Symbol::new(&env, "mock"), &hash);
    Ctx { env, f, admin, hash }
}

fn args(env: &Env, owner: &Address, n: u32) -> Vec<Val> {
    vec![env, owner.into_val(env), n.into_val(env)]
}

#[test]
fn create_registers_and_lists() {
    let c = setup();
    let owner = Address::generate(&c.env);
    let kind = Symbol::new(&c.env, "mock");
    let salt = BytesN::from_array(&c.env, &[7u8; 32]);
    let v = c.f.create_vault(&owner, &kind, &salt, &args(&c.env, &owner, 3));
    assert_eq!(c.f.vault_count(), 1);
    assert_eq!(c.f.list_vaults(&0, &10), vec![&c.env, v.clone()]);
    assert_eq!(c.f.vaults_of(&owner), vec![&c.env, v.clone()]);
    let (k, o, _l) = c.f.get_vault(&v);
    assert_eq!((k, o), (kind.clone(), owner.clone()));
    // same salt again still gives a distinct address
    let v2 = c.f.create_vault(&owner, &kind, &salt, &args(&c.env, &owner, 4));
    assert_ne!(v, v2);
    assert_eq!(c.f.list_vaults(&1, &10), vec![&c.env, v2]);
    assert_eq!(c.f.kinds(), vec![&c.env, kind]);
    assert_eq!(c.f.get_wasm(&Symbol::new(&c.env, "mock")), Some(c.hash.clone()));
}

#[test]
fn constructor_validation_reverts_creation() {
    let c = setup();
    let owner = Address::generate(&c.env);
    let kind = Symbol::new(&c.env, "mock");
    let salt = BytesN::from_array(&c.env, &[1u8; 32]);
    assert!(c.f.try_create_vault(&owner, &kind, &salt, &args(&c.env, &owner, 0)).is_err());
    assert!(c.f.try_create_vault(&owner, &kind, &salt, &args(&c.env, &owner, 11)).is_err());
    assert_eq!(c.f.vault_count(), 0);
    assert_eq!(c.f.vaults_of(&owner).len(), 0);
}

#[test]
fn owner_must_match_first_arg_and_kind_must_exist() {
    let c = setup();
    let owner = Address::generate(&c.env);
    let other = Address::generate(&c.env);
    let salt = BytesN::from_array(&c.env, &[1u8; 32]);
    let kind = Symbol::new(&c.env, "mock");
    assert_eq!(
        c.f.try_create_vault(&owner, &kind, &salt, &args(&c.env, &other, 2)).unwrap_err().unwrap(),
        FactoryError::OwnerMismatch
    );
    assert_eq!(
        c.f.try_create_vault(&owner, &kind, &salt, &Vec::new(&c.env)).unwrap_err().unwrap(),
        FactoryError::OwnerMismatch
    );
    assert_eq!(
        c.f.try_create_vault(&owner, &Symbol::new(&c.env, "nope"), &salt, &args(&c.env, &owner, 2))
            .unwrap_err()
            .unwrap(),
        FactoryError::UnknownKind
    );
    // a non-address first arg is rejected
    let bad: Vec<Val> = vec![&c.env, 5u32.into_val(&c.env)];
    assert_eq!(c.f.try_create_vault(&owner, &kind, &salt, &bad).unwrap_err().unwrap(), FactoryError::OwnerMismatch);
}

#[test]
fn only_admin_sets_wasm_and_removes_kind() {
    let c = setup();
    let intruder = Address::generate(&c.env);
    let k2 = Symbol::new(&c.env, "other");
    assert_eq!(c.f.try_set_wasm(&intruder, &k2, &c.hash).unwrap_err().unwrap(), FactoryError::NotAdmin);
    assert_eq!(c.f.try_remove_kind(&intruder, &k2).unwrap_err().unwrap(), FactoryError::NotAdmin);
    assert_eq!(c.f.try_upgrade(&intruder, &c.hash).unwrap_err().unwrap(), FactoryError::NotAdmin);
    c.f.set_wasm(&c.admin, &k2, &c.hash);
    assert_eq!(c.f.kinds().len(), 2);
    c.f.remove_kind(&c.admin, &Symbol::new(&c.env, "mock"));
    assert_eq!(c.f.kinds(), vec![&c.env, k2]);
    let owner = Address::generate(&c.env);
    let salt = BytesN::from_array(&c.env, &[1u8; 32]);
    assert_eq!(
        c.f.try_create_vault(&owner, &Symbol::new(&c.env, "mock"), &salt, &args(&c.env, &owner, 2))
            .unwrap_err()
            .unwrap(),
        FactoryError::UnknownKind
    );
}

#[test]
fn owner_signature_is_required() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let id = env.register(VaultFactory, (&admin,));
    let f = VaultFactoryClient::new(&env, &id);
    let owner = Address::generate(&env);
    let salt = BytesN::from_array(&env, &[1u8; 32]);
    assert!(f
        .try_create_vault(&owner, &Symbol::new(&env, "mock"), &salt, &args(&env, &owner, 2))
        .is_err());
}

#[test]
fn per_owner_cap_and_paging() {
    let c = setup();
    let owner = Address::generate(&c.env);
    let kind = Symbol::new(&c.env, "mock");
    let salt = BytesN::from_array(&c.env, &[3u8; 32]);
    c.env.cost_estimate().budget().reset_unlimited();
    for _ in 0..crate::MAX_VAULTS_PER_OWNER {
        c.f.create_vault(&owner, &kind, &salt, &args(&c.env, &owner, 2));
    }
    assert_eq!(
        c.f.try_create_vault(&owner, &kind, &salt, &args(&c.env, &owner, 2)).unwrap_err().unwrap(),
        FactoryError::TooManyVaults
    );
    assert_eq!(c.f.list_vaults(&0, &1000).len(), 50);
    assert_eq!(c.f.list_vaults(&90, &1000).len(), 10);
    assert_eq!(c.f.list_vaults(&100, &10).len(), 0);
}

#[test]
fn admin_can_be_transferred() {
    let c = setup();
    let new_admin = Address::generate(&c.env);
    c.f.transfer_admin(&c.admin, &new_admin);
    assert_eq!(c.f.admin(), new_admin);
    assert_eq!(
        c.f.try_set_wasm(&c.admin, &Symbol::new(&c.env, "x"), &c.hash).unwrap_err().unwrap(),
        FactoryError::NotAdmin
    );
    c.f.set_wasm(&new_admin, &Symbol::new(&c.env, "x"), &c.hash);
}
