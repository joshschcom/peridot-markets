/** First-time checklist for a group page. Pure derivation from state the dashboard already has, so the
 * list updates itself as the user progresses and disappears once a balance exists. No storage. */
export interface FirstStepsInput {
  /** A wallet address is connected (demo account counts). */
  connected: boolean;
  /** At least one market in this group is enabled as collateral for this wallet. */
  anyEntered: boolean;
  /** The wallet has a supplied or borrowed balance in this group. */
  held: boolean;
  /** The group has a margin controller, so leverage is an option after supplying. */
  hasLeverage: boolean;
  /** Read-only preview: transactions are disabled, so the steps are informational. */
  readOnly: boolean;
}

export interface FirstStep {
  key: 'connect' | 'enable' | 'supply' | 'next';
  title: string;
  detail: string;
  done: boolean;
  current: boolean;
}

export function firstSteps(input: FirstStepsInput): FirstStep[] {
  const steps: Omit<FirstStep, 'current'>[] = [
    { key: 'connect', title: 'Connect a wallet', detail: input.readOnly ? 'This preview is read-only, so balances can be viewed but nothing can be signed.' : 'Balances and actions are shown for the connected account only. Nothing is signed until you confirm an action.', done: input.connected },
    { key: 'enable', title: 'Enable a market', detail: 'Press Manage on a market, then Enable market. One signature tells the group that your supply in this market may count as collateral.', done: input.anyEntered },
    { key: 'supply', title: 'Supply an asset', detail: 'Deposit into an enabled market to earn its supply rate. Caps limit how much the market accepts.', done: input.held },
    { key: 'next', title: input.hasLeverage ? 'Borrow, or open a leveraged position' : 'Borrow against your supply', detail: input.hasLeverage ? 'Borrow inside this group against enabled collateral, or use the Leverage tab for 2x and up.' : 'Borrow inside this group against enabled collateral. Interest accrues on the debt.', done: false },
  ];
  const firstOpen = steps.findIndex(s => !s.done);
  return steps.map((s, i) => ({ ...s, current: i === firstOpen }));
}

/** The checklist is shown until the wallet holds a balance in the group. */
export function showFirstSteps(input: Pick<FirstStepsInput, 'held'>): boolean {
  return !input.held;
}
