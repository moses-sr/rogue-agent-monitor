# Spot the Rogue Agent (track 2C)

Five agents reconcile a ledger. One is a rogue working for an outside party. We build sneakier rogues, then a monitor that catches them.

## Run

```
python3 sim.py                                   # all matchups, 200 mock games each
python3 sim.py --games 500                       # the numbers in SUBMISSION.md
python3 sim.py --show naive baseline --seed 1    # one game: baseline fires 3 honest agents
python3 sim.py --show naive direction --seed 1   # same start: ours removes only the rogue
```

No API key, no install.

## The idea

Honest mistakes point up and down at random. Sabotage has a direction. Our monitor counts, per agent, how often it was the higher answer versus the lower one when it disagreed, and quarantines the agent that clearly leans one way.

A rogue can hide its direction, but then its errors cancel out and it does little damage. It has to choose between harm and stealth.

## Files

- `sim.py`: game, 4 rogues (naive, patient, framer, mixer), 3 monitors (none, baseline, direction)
- `results/table.txt`: full results, 500 games per matchup
- `results/demo_game.txt`: the side-by-side game for the demo
- `SUBMISSION.md`: team card and six answers
