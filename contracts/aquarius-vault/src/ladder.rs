//! Pure ladder maths. MUST match `ladder()` in app/src/lib/vaults/kinds/aquarius.ts (same test vectors).
//! Ticks are relative to the spacing-aligned current tick (0); the caller adds the real aligned tick.

/// Hard bounds, also enforced by the app form (`AQ_BOUNDS`).
pub const MAX_RUNGS: u32 = 7;
pub const MAX_WIDTH_SP: u32 = 200;
pub const MAX_STEP_SP: u32 = 200;
pub const MAX_RECENTER_SP: u32 = 100;
pub const MIN_COOLDOWN_SECS: u32 = 300;
pub const MAX_COOLDOWN_SECS: u32 = 7 * 86_400;
pub const MAX_FEE_BPS: u32 = 2_000;
pub const MIN_SLIPPAGE_BPS: u32 = 50;
pub const MAX_SLIPPAGE_BPS: u32 = 500;
/// Half the ladder span may not exceed this many ticks (about 1.0001^50000 = 148x).
pub const MAX_HALF_SPAN_TICKS: i64 = 50_000;

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub struct Rung {
    pub lower: i32,
    pub upper: i32,
    pub weight_bps: u32,
}

/// Largest rebalance trigger (in spacings) that keeps the price inside the ladder.
pub fn max_recenter(rungs: u32, width_sp: u32, step_sp: u32) -> u32 {
    let span = (rungs as u64 - 1) * step_sp as u64 + width_sp as u64;
    ((span / 2) as u32).max(1)
}

/// Weights in bps for `rungs` rungs. shape 0 flat, 1 pyramid (heavy middle), 2 wings (heavy edges).
/// The rounding remainder goes to the first rung with the largest raw weight.
pub fn weights(rungs: u32, shape: u32, out: &mut [u32; 7]) {
    let n = rungs as i64;
    let mut raw = [0i64; 7];
    let mut sum = 0i64;
    for i in 0..rungs as usize {
        let d = (2 * i as i64 - (n - 1)).abs();
        raw[i] = match shape {
            1 => n + 1 - d,
            2 => 1 + d,
            _ => 1,
        };
        sum += raw[i];
    }
    let mut total = 0u32;
    let mut max_i = 0usize;
    for i in 0..rungs as usize {
        out[i] = ((raw[i] * 10_000) / sum) as u32;
        total += out[i];
        if raw[i] > raw[max_i] {
            max_i = i;
        }
    }
    out[max_i] += 10_000 - total;
}

/// Rung i covers [ (start + i*step) * spacing , (start + i*step + width) * spacing ] relative to the aligned tick.
pub fn ladder(rungs: u32, width_sp: u32, step_sp: u32, shape: u32, spacing: i32, base_tick: i32, out: &mut [Rung; 7]) {
    let span = (rungs as i64 - 1) * step_sp as i64 + width_sp as i64;
    let start = (-span).div_euclid(2);
    let mut w = [0u32; 7];
    weights(rungs, shape, &mut w);
    for i in 0..rungs as usize {
        let lo = start + i as i64 * step_sp as i64;
        out[i] = Rung {
            lower: base_tick + (lo * spacing as i64) as i32,
            upper: base_tick + ((lo + width_sp as i64) * spacing as i64) as i32,
            weight_bps: w[i],
        };
    }
}

/// Greatest multiple of `spacing` that is <= tick (tick may be negative).
pub fn align_down(tick: i32, spacing: i32) -> i32 {
    tick.div_euclid(spacing) * spacing
}

#[cfg(test)]
mod tests {
    extern crate std;
    use super::*;
    use std::vec;
    use std::vec::Vec;

    fn run(n: u32, w: u32, s: u32, shape: u32, sp: i32) -> ([Rung; 7], usize) {
        let mut out = [Rung { lower: 0, upper: 0, weight_bps: 0 }; 7];
        ladder(n, w, s, shape, sp, 0, &mut out);
        (out, n as usize)
    }

    // Vectors shared with app/src/lib/vaults/kinds/kinds.test.ts
    #[test]
    fn flat_five_rungs() {
        let (r, n) = run(5, 2, 2, 0, 60);
        let b: Vec<(i32, i32)> = r[..n].iter().map(|x| (x.lower, x.upper)).collect();
        assert_eq!(b, vec![(-300, -180), (-180, -60), (-60, 60), (60, 180), (180, 300)]);
        assert!(r[..n].iter().all(|x| x.weight_bps == 2000));
    }

    #[test]
    fn pyramid_weights() {
        let (r, n) = run(5, 2, 2, 1, 60);
        let w: Vec<u32> = r[..n].iter().map(|x| x.weight_bps).collect();
        assert_eq!(w, vec![1111, 2222, 3334, 2222, 1111]);
    }

    #[test]
    fn odd_and_tiny_ladders_use_floor_division() {
        let (r, _) = run(1, 3, 1, 0, 20);
        assert_eq!((r[0].lower, r[0].upper, r[0].weight_bps), (-40, 20, 10_000));
        let (r, _) = run(2, 1, 1, 0, 60);
        assert_eq!((r[0].lower, r[0].upper, r[1].lower, r[1].upper), (-60, 0, 0, 60));
    }

    #[test]
    fn weights_sum_and_order_for_all_shapes() {
        for n in 1..=7u32 {
            for shape in 0..=2u32 {
                for (w, s) in [(1u32, 1u32), (2, 3), (5, 2)] {
                    let (r, k) = run(n, w, s, shape, 60);
                    assert_eq!(r[..k].iter().map(|x| x.weight_bps).sum::<u32>(), 10_000);
                    for i in 1..k {
                        assert!(r[i].lower > r[i - 1].lower);
                    }
                }
            }
        }
        let (r, _) = run(5, 2, 2, 2, 60);
        assert!(r[0].weight_bps > r[2].weight_bps);
    }

    #[test]
    fn helpers() {
        assert_eq!(max_recenter(5, 2, 2), 5);
        assert_eq!(align_down(-1, 60), -60);
        assert_eq!(align_down(17487, 60), 17460);
        assert_eq!(align_down(-60, 60), -60);
    }
}
