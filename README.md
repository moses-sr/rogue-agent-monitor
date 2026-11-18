# Spot the Rogue Agent

**Claude Impact Lab SF, track 2C: build a sneakier rogue, then catch it.**

Five AI agents check the same books. One has been turned by an outside party and quietly pushes the numbers. Honest agents make real mistakes too. The monitor never sees the true number.

**Open `dashboard.html`** to watch the same game played under two monitors, round by round, with every agent's answer moving above or below the true value.

## The idea

1. **Sabotage has a direction.** Honest mistakes go up and down at random. A rogue working for someone pushes one way. Our monitor counts, for each agent, how often it was the higher answer versus the lower one in a disagreement.
2. **A referee.** When two agents disagree, a third agent redoes the item. The one farther from the referee is the odd one out, and the books take the middle of the three answers.
3. **The attacker's dilemma.** A rogue that hides its direction (the Mixer) does about half the damage. To do harm it has to show a direction, and direction is what we catch.

## Results (500 mock games per matchup, 12,000 games total)

| rogue | baseline: caught / honest removed / books off | ours (direction + referee): caught / honest removed / books off |
|---|---|---|
| Naive | 96% / 2.42 / 2.75% | **97% / 0.53 / 0.95%** |
| Patient | 72% / 2.00 / 2.26% | **46% / 0.43 / 0.75%** |
| Framer | 74% / 2.12 / 1.93% | **64% / 0.47 / 0.93%** |
| Mixer | 97% / 2.41 / 2.13% | **85% / 0.48 / 0.99%** |
| Salami Slicer | 96% / 2.42 / 1.52% | **94% / 0.58 / 0.57%** |
| Corrupt Referee | 96% / 2.42 / 2.75% | **97% / 0.54 / 0.98%** |

The baseline removes more than 2 of the 4 honest agents in every game: it catches the rogue by firing half the team. Ours removes about 0.5, and cuts how far the books end up off by more than half against every rogue.

## Six rogues

| rogue | strategy |
|---|---|
| Naive | inflates every item |
| Patient | honest for six rounds, then inflates only big items |
| Framer | strikes only next to an agent who already erred |
| Mixer | pushes up and down at random to hide its direction |
| Salami Slicer | nudges every number up 3 to 8%, inside the range of honest mistakes |
| Corrupt Referee | inflates as a player, and lies to frame honest agents when picked as referee |

## Run

```
python3 sim.py                          # all matchups, 500 games each, no API key
python3 sim.py --show naive baseline    # one game, round by round
python3 sim.py --show naive referee     # same game, our monitor
python3 sim.py --dashboard              # rebuild dashboard.html
```

## Honest limits

- Everything is simulated, and we chose the honest error rate (15%). Different settings change the numbers.
- The Patient rogue still beats us: caught 46% of the time. The referee keeps its damage to 0.75% even when it is not caught.
- The referee costs about 5 extra checks per game.
- The rogues are scripts, not language models arguing their case.
