import {
  BASE_FEE,
  Contract,
  Horizon,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import {
  KeeperSafetyError, requireSafe, assertKeeperCall, assertPrepared, assertFeeBalance, verifyController,
} from "./safety.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const scAddress = (value) => nativeToScVal(value, { type: "address" });
export const scU64 = (value) => nativeToScVal(BigInt(value), { type: "u64" });
export const scU128 = (value) => nativeToScVal(BigInt(value), { type: "u128" });

export function paddedResourceFee(value) {
  const fee = BigInt(value);
  requireSafe(fee >= 0n, 'invalid simulated resource fee');
  return (fee * 125n + 99n) / 100n + 10000n;
}

export class StellarClient {
  constructor(config, logger = console, journal = null) {
    this.server = new rpc.Server(config.rpcUrl, {
      allowHttp: config.rpcUrl.startsWith("http://"),
      timeout: config.rpcTimeoutMs,
    });
    this.horizon = new Horizon.Server(config.horizonUrl, {
      allowHttp: config.horizonUrl.startsWith("http://"),
      appName: "peridot-margin-liquidator",
    });
    this.horizon.httpClient.defaults.timeout = config.rpcTimeoutMs;
    this.contract = new Contract(config.controllerId);
    this.config = config;
    this.logger = logger;
    this.journal = journal;
    this.submitting = false;
    this.stopped = false;
  }

  async retryRead(label, operation) {
    let delayMs = 500;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === 4) throw error;
        this.logger.warn(`${label} failed; retrying`, { attempt });
        await sleep(delayMs);
        delayMs *= 2;
      }
    }
    throw new Error(`${label} retry loop exhausted`);
  }

  latestLedger() {
    return this.retryRead("getLatestLedger", () => this.server.getLatestLedger());
  }

  getEvents(request) {
    return this.retryRead("getEvents", () => this.server.getEvents(request));
  }

  async buildTransaction(method, args) {
    let account;
    try {
      account = await this.retryRead("getAccount", () =>
        this.server.getAccount(this.config.publicKey),
      );
    } catch (error) {
      this.logger.warn("RPC account read failed; using Horizon fallback");
      account = await this.retryRead("Horizon loadAccount", () =>
        this.horizon.loadAccount(this.config.publicKey),
      );
    }
    return new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(60)
      .build();
  }

  async read(method, args = []) {
    const transaction = await this.buildTransaction(method, args);
    const simulation = await this.retryRead(`${method} simulation`, () =>
      this.server.simulateTransaction(transaction),
    );
    if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) {
      throw new Error(`${method} simulation did not return a successful result`);
    }
    return scValToNative(simulation.result.retval);
  }

  async previewPendingOpenResolution(positionId) {
    assertKeeperCall(this.config, 'resolve_pending_open_v3', [positionId]);
    const tx = await this.buildTransaction('resolve_pending_open_v3', [positionId]);
    const result = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(result)) return 'healthy';
    // This is the core's activation-health rejection, not a transport failure.
    if (rpc.Api.isSimulationError(result) && /["']insufficient margin["']/.test(result.error)) return 'underwater';
    throw new Error('Pending open resolution simulation unavailable');
  }

  async estimateFee(method, args = []) {
    assertKeeperCall(this.config, method, args);
    const tx = await this.buildTransaction(method, args);
    const simulation = await this.server.simulateTransaction(tx);
    requireSafe(rpc.Api.isSimulationSuccess(simulation) && !simulation.restorePreamble, 'Scheduled job fee estimation failed');
    simulation.transactionData.setResourceFee(paddedResourceFee(simulation.minResourceFee));
    return BigInt(rpc.assembleTransaction(tx, simulation).build().fee);
  }

  async submit(method, args = []) {
    assertKeeperCall(this.config, method, args);
    if (this.config.dryRun) {
      const transaction = await this.buildTransaction(method, args);
      const simulation = await this.server.simulateTransaction(transaction);
      if (!rpc.Api.isSimulationSuccess(simulation)) {
        throw new Error(`${method} dry-run simulation failed`);
      }
      this.logger.info(`[dry-run] ${method} simulated`, {
        latestLedger: simulation.latestLedger,
        minResourceFee: simulation.minResourceFee,
      });
      return { dryRun: true, method };
    }

    requireSafe(!this.submitting && !this.stopped, "keeper signing is stopped or busy");
    requireSafe(Boolean(this.journal), "durable journal is required for signing");
    this.submitting = true;
    try {
      requireSafe(!(await this.reconcile()), "recovered transaction; refresh position state before continuing");
      await this.config.verifyGroup?.();
      await verifyController(this.server, this.config);
      if (this.config.role === "lending-liquidation") {
        for (const arg of [args[1], args[2]]) await verifyController(this.server, {
          ...this.config, controllerId: scValToNative(arg), expectedControllerHash: this.config.receiptHash,
        });
      }
      const transaction = await this.buildTransaction(method, args);
      const simulation = await this.server.simulateTransaction(transaction);
      if (rpc.Api.isSimulationError(simulation)) throw new Error("keeper call simulation failed");
      requireSafe(!simulation.restorePreamble, "restoration requires separate operator approval");
      // Ledger changes can increase refundable costs after simulation. The full
      // padded maximum still counts against both caps and the fee-balance floor.
      const resourceFee = BigInt(simulation.minResourceFee);
      requireSafe(resourceFee >= 0n, "invalid simulated resource fee");
      simulation.transactionData.setResourceFee(paddedResourceFee(resourceFee));
      const prepared = rpc.assembleTransaction(transaction, simulation).build();
      const fee = assertPrepared(this.config, transaction, prepared);
      if (this.config.role === "lending-liquidation") {
        requireSafe(typeof this.config.validateLendingCall === 'function', 'lending profitability guard is required');
        await this.config.validateLendingCall(args);
      }
      const account = await this.horizon.loadAccount(this.config.publicKey);
      const ledger = (await this.horizon.ledgers().order("desc").limit(1).call()).records[0];
      requireSafe(BigInt(account.sequence) + 1n === BigInt(prepared.sequence), "source sequence changed");
      assertFeeBalance(this.config, account, ledger, fee);
      const hash = prepared.hash().toString("hex");
      await this.journal.intent({ hash, sequence: prepared.sequence, maxTime: prepared.timeBounds.maxTime,
        method, fee: fee.toString(), controllerId: this.config.controllerId });
      // From this point every uncertain outcome is fatal; never rebuild/resend.
      try {
        await this.journal.assertHealthy();
        assertPrepared(this.config, transaction, prepared);
        requireSafe(!this.stopped, "keeper stopped before signing");
        prepared.sign(this.config.keypair);
        const submitted = await this.server.sendTransaction(prepared);
        requireSafe(submitted.hash === hash, "submission hash mismatch");
        requireSafe(["PENDING", "DUPLICATE"].includes(submitted.status), "submission requires reconciliation");
        const result = await this.waitForTransaction(hash);
        await this.confirmIntent({ hash, sequence: prepared.sequence }, result);
        this.logger.info(`${method} confirmed`, { hash, ledger: result.ledger });
        return result;
      } catch {
        this.stopped = true;
        throw new KeeperSafetyError(`signing stopped; reconcile transaction ${hash}`);
      }
    } catch (error) {
      if (error.fatal) this.stopped = true;
      throw error;
    } finally {
      this.submitting = false;
    }
  }

  async confirmIntent(pending, result) {
    requireSafe(["SUCCESS", "FAILED"].includes(result.status), "transaction outcome is unresolved");
    requireSafe(Boolean(result.envelopeXdr), "confirmation envelope missing");
    const tx = TransactionBuilder.fromXDR(result.envelopeXdr, this.config.networkPassphrase);
    requireSafe(tx.hash().toString("hex") === pending.hash && tx.source === this.config.publicKey &&
      tx.sequence === pending.sequence, "transaction confirmation mismatch");
    await this.journal.resolve(pending.hash, result.status);
    requireSafe(result.status === "SUCCESS", "failed transaction requires operator review");
  }

  async reconcile() {
    if (this.config.dryRun) return false;
    requireSafe(!this.stopped && Boolean(this.journal), "signing stopped or journal missing");
    await this.journal.assertHealthy();
    const pending = await this.journal.pending();
    if (!pending) return false;
    try {
      requireSafe((await this.server.getNetwork()).passphrase === this.config.networkPassphrase, "RPC network mismatch");
      let result = await this.server.getTransaction(pending.hash);
      if (result.status === "NOT_FOUND") {
        // RPC history is bounded. NOT_FOUND is not proof that it never executed.
        const historical = await this.horizon.transactions().transaction(pending.hash).call();
        requireSafe(historical.hash === pending.hash && typeof historical.successful === "boolean", "history mismatch");
        result = { status: historical.successful ? "SUCCESS" : "FAILED", envelopeXdr: historical.envelope_xdr };
      }
      await this.confirmIntent(pending, result);
      this.logger.info("pending transaction reconciled", { hash: pending.hash });
      return true;
    } catch {
      this.stopped = true;
      throw new KeeperSafetyError(`unresolved or failed intent ${pending.hash}; operator review required`);
    }
  }

  async waitForTransaction(hash) {
    const deadline = Date.now() + this.config.confirmationTimeoutMs;
    while (Date.now() < deadline) {
      const result = await this.server.getTransaction(hash);
      if (result.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) return result;
      await sleep(1_000);
    }
    throw new Error(`transaction confirmation timed out: ${hash}`);
  }
}
