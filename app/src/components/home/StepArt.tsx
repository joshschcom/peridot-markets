/** Small inline illustrations for the four "how it works" steps. Colors come from CSS classes in home.css
 * (tokens only), so they follow the theme. Decorative: the parent is aria-hidden. */
export function StepArt({ step }: { step: number }) {
  if (step === 0) return <svg className="home-art" viewBox="0 0 200 70" preserveAspectRatio="xMidYMid meet">
    {/* bonding curve rising to a graduation target, then a market box */}
    <path className="ink" d="M12 58 H118" />
    <path className="acc" d="M14 56 C 50 54, 80 44, 100 14" />
    <line className="ink" x1="100" y1="10" x2="100" y2="60" strokeDasharray="3 3" />
    <circle className="acc-fill" cx="100" cy="14" r="4" />
    <text className="label" x="60" y="66" textAnchor="middle">bonding curve</text>
    <path className="ink" d="M120 36 H140" />
    <path className="ink" d="M136 32 L141 36 L136 40" />
    <rect className="soft-fill" x="146" y="18" width="46" height="36" rx="6" />
    <rect className="acc" x="146" y="18" width="46" height="36" rx="6" />
    <text className="label" x="169" y="40" textAnchor="middle">market</text>
  </svg>;
  if (step === 1) return <svg className="home-art" viewBox="0 0 200 70" preserveAspectRatio="xMidYMid meet">
    {/* a group frame with two market cards and a third being added */}
    <rect className="surface-fill" x="10" y="8" width="180" height="54" rx="8" />
    <rect className="ink-strong" x="10" y="8" width="180" height="54" rx="8" />
    <rect className="acc" x="20" y="18" width="46" height="34" rx="5" />
    <text className="label" x="43" y="33" textAnchor="middle">USDC</text>
    <text className="label" x="43" y="45" textAnchor="middle">CF 75%</text>
    <rect className="acc" x="74" y="18" width="46" height="34" rx="5" />
    <text className="label" x="97" y="33" textAnchor="middle">XLM</text>
    <text className="label" x="97" y="45" textAnchor="middle">0% borrow</text>
    <rect className="ink" x="128" y="18" width="46" height="34" rx="5" strokeDasharray="3 3" />
    <line className="acc" x1="151" y1="28" x2="151" y2="42" />
    <line className="acc" x1="144" y1="35" x2="158" y2="35" />
  </svg>;
  if (step === 2) return <svg className="home-art" viewBox="0 0 200 70" preserveAspectRatio="xMidYMid meet">
    {/* market in the middle, plugs for price, yield, leverage */}
    <rect className="soft-fill" x="76" y="22" width="48" height="28" rx="6" />
    <rect className="acc" x="76" y="22" width="48" height="28" rx="6" />
    <text className="label" x="100" y="40" textAnchor="middle">market</text>
    <path className="ink" d="M76 36 H44" /><circle className="acc-fill" cx="40" cy="36" r="3" />
    <text className="label" x="36" y="26" textAnchor="end">price</text>
    <path className="ink" d="M124 36 H156" /><circle className="acc-fill" cx="160" cy="36" r="3" />
    <text className="label" x="164" y="26" textAnchor="start">yield</text>
    <path className="ink" d="M100 22 V10" /><circle className="acc-fill" cx="100" cy="8" r="3" />
    <text className="label" x="106" y="11" textAnchor="start">leverage</text>
    <path className="ink" d="M100 50 V62" /><circle className="warn-fill" cx="100" cy="64" r="3" />
    <text className="label" x="106" y="67" textAnchor="start">rewards</text>
  </svg>;
  return <svg className="home-art" viewBox="0 0 200 70" preserveAspectRatio="xMidYMid meet">
    {/* sliders plus a 60 s countdown ring */}
    <line className="ink" x1="14" y1="18" x2="120" y2="18" /><circle className="acc-fill" cx="80" cy="18" r="5" />
    <line className="ink" x1="14" y1="36" x2="120" y2="36" /><circle className="acc-fill" cx="40" cy="36" r="5" />
    <line className="ink" x1="14" y1="54" x2="120" y2="54" /><circle className="acc-fill" cx="100" cy="54" r="5" />
    <circle className="ink" cx="160" cy="36" r="20" />
    <path className="acc" d="M160 16 A20 20 0 1 1 142.7 46" />
    <text className="label" x="160" y="39" textAnchor="middle">60 s</text>
  </svg>;
}
