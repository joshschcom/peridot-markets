import { createRequire } from 'node:module';
const require = createRequire('/Users/joshua/Peridot/peridot-markets-vaultfactory/app/package.json');
const { Keypair, TransactionBuilder, Networks, Contract, rpc, Address, nativeToScVal, xdr } = require('@stellar/stellar-sdk');
import { execFileSync } from 'node:child_process';
const kp = Keypair.fromSecret(execFileSync('stellar',['keys','secret','peridot-testnet-admin'],{encoding:'utf8'}).trim());
const server = new rpc.Server('https://soroban-testnet.stellar.org');
async function cost(contract, method, args) {
  const acct = await server.getAccount(kp.publicKey());
  const tx = new TransactionBuilder(acct,{fee:'1000000',networkPassphrase:Networks.TESTNET}).addOperation(new Contract(contract).call(method,...args)).setTimeout(60).build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) { console.log(method, 'ERR', String(sim.error).slice(0,150)); return; }
  const d = sim.transactionData.build(); const r = d.resources; console.log(method, 'instr', r.instructions, 'read', r.diskReadBytes, 'rw', d.resources.footprint?.readWrite?.length, 'fee', sim.minResourceFee);
}
const P='CA6DAGOMK5D7GKBNWVCIEAYSTPJXLQUFWFKSZOMNEM6BVOTUBDCTIT5I';
const u=(n)=>nativeToScVal(BigInt(n),{type:'u128'});
const i32=(n)=>nativeToScVal(n,{type:'i32'});
const u32=(n)=>nativeToScVal(n,{type:'u32'});
await cost(P,'get_slot0',[]);
await cost(P,'estimate_swap',[u32(1),u32(0),u(300000000)]);
await cost(P,'estimate_deposit_position',[i32(17640),i32(17760),xdr.ScVal.scvVec([u(100000000),u(100000000)])]);
await cost(P,'estimate_deposit_position',[i32(17760),i32(17880),xdr.ScVal.scvVec([u(0),u(100000000)])]);
await cost(process.argv[2],'total_value',[]);
await cost(process.argv[2],'needs_rebalance',[]);
const me = new Address(kp.publicKey()).toScVal();
await cost(P,'deposit_position',[me,i32(17100),i32(17160),xdr.ScVal.scvVec([u(0),u(50000000)]),u(1)]);
await cost(P,'swap',[me,u32(1),u32(0),u(30000000),u(1)]);
