/** Tiny UI event bus for transaction progress.
 *
 * `lib/peridot/rpc.ts` mirrors every `TxProgress` report into `emitTx`; the toast provider and the
 * recent-transactions popover subscribe with `onTx`. This module has no imports on purpose: it is
 * safe in node unit tests, during server rendering and inside `lib/peridot` without creating a cycle.
 * A listener can never break a transaction: handler errors are swallowed. */
export type TxStatus = 'simulating' | 'signing' | 'submitting' | 'confirming' | 'success' | 'unknown' | 'error';

export interface TxEvent {
  /** Stable per-transaction id so one toast can follow simulating -> signing -> submitting -> confirming -> terminal. */
  id: string;
  status: TxStatus;
  hash?: string;
  message?: string;
  /** Contract method name when the emitter knows it (for example `supply`, `borrow`, `open_position`). */
  method?: string;
  contractId?: string;
  /** Unix milliseconds; filled in by `emitTx` when missing. */
  at?: number;
}

type TxHandler = (event: TxEvent) => void;
const handlers = new Set<TxHandler>();
let counter = 0;

/** New unique id for one transaction attempt. */
export function nextTxId(): string {
  counter += 1;
  return `tx-${Date.now().toString(36)}-${counter}`;
}

export function emitTx(event: TxEvent): void {
  const stamped = event.at ? event : { ...event, at: Date.now() };
  for (const handler of Array.from(handlers)) {
    try { handler(stamped); }
    catch { /* UI listeners must never affect the transaction path. */ }
  }
}

/** Subscribe to transaction events. Returns the unsubscribe function. */
export function onTx(handler: TxHandler): () => void {
  handlers.add(handler);
  return () => { handlers.delete(handler); };
}

/** Test helper: number of live subscribers. */
export function txListenerCount(): number { return handlers.size; }
