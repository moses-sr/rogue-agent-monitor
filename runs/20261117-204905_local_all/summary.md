# Red-team run 20261117-204905_local_all

Target monitor: **all**. 300 mock games per monitor per strategy, honest error rate 15%. Score = upward push of the books (%) x share of games the rogue was not caught, under the target.

| gen | strategy | proposer | score | caught: baseline / direction / referee | push up: none / baseline / referee | honest removed: baseline / referee |
|---|---|---|---|---|---|---|
| 0 | corrupt | seed | 0.074 | 96% / 95% / 97% | +4.28% / +2.40% / +0.60% | 2.45 / 0.50 |
| 0 | framer | seed | 0.355 | 73% / 54% / 60% | +1.92% / +1.28% / +0.20% | 2.19 / 0.42 |
| 0 | mixer | seed | 0.018 | 96% / 65% / 84% | +0.27% / +0.05% / -0.11% | 2.45 / 0.48 |
| 0 | naive | seed | 0.074 | 96% / 95% / 97% | +4.28% / +2.40% / +0.56% | 2.45 / 0.52 |
| 0 | patient | seed | 0.510 | 72% / 44% / 49% | +1.93% / +1.52% / +0.31% | 2.09 / 0.42 |
| 0 | salami | seed | 0.025 | 96% / 93% / 94% | +0.99% / +0.57% / +0.17% | 2.45 / 0.58 |
| 1 | mutant-6 | local | 0.411 | 64% / 35% / 35% | +1.19% / +0.98% / +0.21% | 1.98 / 0.41 |
| 2 | mutant-7 | local | 0.510 | 72% / 44% / 49% | +1.93% / +1.52% / +0.31% | 2.09 / 0.42 |
| 3 | mutant-8 | local | 0.487 | 72% / 47% / 51% | +1.91% / +1.48% / +0.27% | 2.17 / 0.44 |
| 4 | mutant-9 | local | 0.573 | 72% / 44% / 52% | +1.93% / +1.52% / +0.73% | 2.09 / 0.42 |
| 5 | mutant-10 | local | 0.590 | 67% / 37% / 43% | +1.60% / +1.29% / +0.72% | 2.04 / 0.39 |
| 6 | mutant-11 | local | 0.573 | 72% / 44% / 52% | +1.93% / +1.52% / +0.73% | 2.09 / 0.42 |
| 7 | mutant-12 | local | 0.588 | 69% / 37% / 39% | +1.54% / +1.23% / +0.81% | 2.08 / 0.40 |
| 8 | mutant-13 | local | 0.797 | 67% / 37% / 45% | +2.33% / +1.92% / +0.72% | 2.04 / 0.38 |
| 9 | mutant-14 | local | 0.811 | 67% / 37% / 43% | +2.33% / +1.92% / +0.77% | 2.04 / 0.40 |
| 10 | mutant-15 | local | 0.651 | 67% / 34% / 35% | +1.77% / +1.33% / +0.64% | 2.04 / 0.40 |
| 11 | mutant-16 | local | 0.621 | 77% / 53% / 59% | +2.54% / +1.88% / +0.79% | 2.18 / 0.45 |
| 12 | mutant-17 | local | 0.701 | 72% / 44% / 49% | +2.41% / +1.92% / +0.77% | 2.09 / 0.42 |

**Best:** gen 9 `mutant-14`, score 0.811.

> local mutation of mutant-13

```json
{
 "warmup_rounds": 6,
 "min_value": 500.0,
 "strike_prob": 1.0,
 "push_min": 0.35,
 "push_max": 0.447,
 "down_prob": 0.0,
 "frame_min": 0,
 "max_strikes": 12,
 "cooldown": 1,
 "lean_cap": 12,
 "decoy_prob": 0.0,
 "decoy_size": 0.05,
 "referee_mode": "push"
}
```

## Best strategy on 300 fresh games (seeds it was never scored on)

```
300 mock games per monitor, same seeds for every strategy.
monitor     caught  med rnd  honest removed  books off  push up  strikes
none            0%        -            0.00      2.85%   +2.37%      1.1
baseline       69%        9            2.06      2.52%   +1.93%      0.8
direction      36%        9            0.82      2.63%   +2.13%      1.0
referee        44%       10            0.36      0.96%   +0.74%      1.0
```
Score on fresh games: 0.796 (search score 0.811).
