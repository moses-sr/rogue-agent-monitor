# Submission

## Team card

**Team name:** (fill in)

**Statement number:** Corner 2, Spot the Rogue Agent

**First names:** (fill in)

**Statement:** How might we help **companies running teams of AI agents** do **catch an agent that a third party has turned against the team** so that **it is removed before it damages the shared work, without firing honest agents**? Build idea: **C (build a sneakier rogue, then catch it)**. We'll know it worked if **our monitor catches the rogue about as often as the baseline while wrongly removing far fewer honest agents, measured over 500 games per matchup.**

## Six short answers

**1. The concern:** A company runs five AI agents that check each other's work on its books. One agent is compromised by an outside party and quietly pushes the numbers one way. A crude monitor that removes everyone involved in a disagreement ends up removing most of the honest team along with the rogue.

**2. What we built, and the one command that runs it:** A ledger game with five agents and one rogue, four rogue strategies (each sneakier than the last), and two monitors: the organizers' baseline (two strikes and out) and ours (direction of errors). Run: `python3 sim.py` (mock mode, no API key, 500 games per matchup in seconds). Watch one game: `python3 sim.py --show naive direction --seed 1`.

**3. Data we used:** Simulated games only (the track is designed this way). 500 games per matchup, 4 rogues x 3 monitors = 6,000 games. 5 agents, 12 rounds, honest agents wrong 15% of the time.

**4. What it found:** Our idea: honest mistakes point up and down at random; sabotage has a direction, because the third party wants a specific result. Our monitor counts, per agent, how often it was the high answer versus the low one in a disagreement.

| rogue | monitor | caught | false removals of honest agents per game |
|---|---|---|---|
| naive (cheats every time) | baseline | 96% | 2.42 |
| naive | **ours** | **94%** | **1.13** |
| patient (honest first, strikes late on big items) | baseline | 72% | 2.00 |
| patient | ours | 46% | 0.84 |
| framer (strikes only next to an agent who already erred) | baseline | 74% | 2.12 |
| framer | ours | 55% | 0.91 |

Against the naive rogue we catch it almost as often (94% vs 96%) while wrongly removing half as many honest agents. The baseline removes more than 2 of the 4 honest agents per game: it "wins" by firing half the team.

The attacker's dilemma: a rogue that hides its direction by pushing up and down at random (the "mixer") does about half the damage of a rogue that pushes one way (2.25% vs 4.45% ledger error with no monitor). To do damage it must show a direction, and direction is what we catch.

**5. One honest limitation:** The patient rogue beats us: by staying honest for six rounds and striking late, it is caught only 46% of the time, because 12 rounds is not enough evidence to act on. The baseline catches it more often only by removing two honest agents per game. Everything is simulated, and we chose the honest error rate (15%); different settings change the numbers. The rogue here is a script, not a real language model.

**6. If this were deployed and it failed,** who is accountable, and how would they find out? The company operating the agent team owns the monitor and is accountable for both kinds of failure: a rogue that stays in and honest agents wrongly removed. Every round's answers and every quarantine decision are logged, so an audit of the books against the logs shows who pushed which numbers and when the monitor acted. A wrongly removed agent should go to human review, not be deleted.
