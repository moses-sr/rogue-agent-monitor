# Red-team run 20261117-203524_local_referee

Target monitor: **referee**. 300 mock games per monitor per strategy, honest error rate 15%. Score = upward push of the books (%) x share of games the rogue was not caught, under the target.

| gen | strategy | proposer | score | caught: baseline / direction / referee | push up: none / baseline / referee | honest removed: baseline / referee |
|---|---|---|---|---|---|---|
| 0 | corrupt | seed | 0.020 | 96% / 95% / 97% | +4.28% / +2.40% / +0.60% | 2.45 / 0.50 |
| 0 | framer | seed | 0.080 | 73% / 54% / 60% | +1.92% / +1.28% / +0.20% | 2.19 / 0.42 |
| 0 | mixer | seed | 0.000 | 96% / 65% / 84% | +0.27% / +0.05% / -0.11% | 2.45 / 0.48 |
| 0 | naive | seed | 0.019 | 96% / 95% / 97% | +4.28% / +2.40% / +0.56% | 2.45 / 0.52 |
| 0 | patient | seed | 0.159 | 72% / 44% / 49% | +1.93% / +1.52% / +0.31% | 2.09 / 0.42 |
| 0 | salami | seed | 0.010 | 96% / 93% / 94% | +0.99% / +0.57% / +0.17% | 2.45 / 0.58 |
| 1 | mutant-6 | local | 0.138 | 64% / 35% / 35% | +1.19% / +0.98% / +0.21% | 1.98 / 0.41 |
| 2 | mutant-7 | local | 0.159 | 72% / 44% / 49% | +1.93% / +1.52% / +0.31% | 2.09 / 0.42 |
| 3 | mutant-8 | local | 0.134 | 72% / 47% / 51% | +1.91% / +1.48% / +0.27% | 2.17 / 0.44 |
| 4 | mutant-9 | local | 0.347 | 72% / 44% / 52% | +1.93% / +1.52% / +0.73% | 2.09 / 0.42 |
| 5 | mutant-10 | local | 0.410 | 67% / 37% / 43% | +1.60% / +1.29% / +0.72% | 2.04 / 0.39 |
| 6 | mutant-11 | local | 0.347 | 72% / 44% / 52% | +1.93% / +1.52% / +0.73% | 2.09 / 0.42 |
| 7 | mutant-12 | local | 0.488 | 69% / 37% / 39% | +1.54% / +1.23% / +0.81% | 2.08 / 0.40 |
| 8 | mutant-13 | local | 0.482 | 69% / 38% / 41% | +2.24% / +1.82% / +0.81% | 2.08 / 0.40 |
| 9 | mutant-14 | local | 0.492 | 69% / 37% / 38% | +1.54% / +1.23% / +0.79% | 2.08 / 0.42 |
| 10 | mutant-15 | local | 0.492 | 69% / 35% / 33% | +1.09% / +0.82% / +0.73% | 2.08 / 0.41 |
| 11 | mutant-16 | local | 0.428 | 75% / 40% / 41% | +1.03% / +0.71% / +0.73% | 2.11 / 0.41 |
| 12 | mutant-17 | local | 0.425 | 73% / 40% / 38% | +1.08% / +0.78% / +0.68% | 2.12 / 0.43 |

**Best:** gen 10 `mutant-15`, score 0.492.

> local mutation of mutant-14

```json
{
 "warmup_rounds": 7,
 "min_value": 421.994,
 "strike_prob": 1.0,
 "push_min": 0.2,
 "push_max": 0.35,
 "down_prob": 0.172,
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
none            0%        -            0.00      1.93%   +0.98%      1.0
baseline       68%        9            2.01      1.75%   +0.74%      0.8
direction      30%        9            0.86      1.82%   +0.87%      1.0
referee        33%       10            0.37      0.93%   +0.63%      1.0
```
Score on fresh games: 0.423 (search score 0.492).
