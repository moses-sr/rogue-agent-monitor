# Submission

## Team card

**Team name:** (fill in)

**Statement number:** Corner 2, Spot the Rogue Agent

**First names:** (fill in)

**Statement:** How might we help **companies running teams of AI agents** do **catch an agent that a third party has turned against the team** so that **it is removed before it damages the shared work, without firing honest agents**? Build idea: **C (build a sneakier rogue, then catch it)**. We'll know it worked if **our monitor catches the rogue about as often as the baseline while wrongly removing far fewer honest agents, measured over 12,000 games.**

## Six short answers

**1. The concern:** A company runs five AI agents that check each other's work on its books. One agent is compromised by an outside party and quietly pushes the numbers one way. A crude monitor that removes everyone involved in a disagreement ends up removing most of the honest team along with the rogue.

**2. What we built, and the one command that runs it:** A ledger game with five agents and one rogue, six rogue strategies (each sneakier than the last), and three monitors: the organizers' baseline (two strikes and out), ours with direction only, and ours with direction plus a referee. Run: `python3 sim.py` (no API key, 12,000 games in seconds). Open `dashboard.html` to watch one game under each monitor.

**3. Data we used:** Simulated games, as the track is designed. 500 games per matchup, 6 rogues x 4 monitors = 12,000 games. 5 agents, 12 rounds, honest agents wrong 15% of the time.

**4. What it found:** Sabotage has a direction; honest mistakes do not. Our monitor counts who is always the higher answer, and a referee redoes disputed items.

| rogue | baseline: caught / honest removed / books off | ours (direction + referee): caught / honest removed / books off |
|---|---|---|
| Naive | 96% / 2.42 / 2.75% | **97% / 0.53 / 0.95%** |
| Patient | 72% / 2.00 / 2.26% | **46% / 0.43 / 0.75%** |
| Framer | 74% / 2.12 / 1.93% | **64% / 0.47 / 0.93%** |
| Mixer | 97% / 2.41 / 2.13% | **85% / 0.48 / 0.99%** |
| Salami Slicer | 96% / 2.42 / 1.52% | **94% / 0.58 / 0.57%** |
| Corrupt Referee | 96% / 2.42 / 2.75% | **97% / 0.54 / 0.98%** |

The baseline catches the rogue by removing more than 2 of the 4 honest agents per game. Ours removes about 0.5 and cuts the damage to the books by more than half against every rogue. A rogue that hides its direction (Mixer) does half the damage, so the attacker has to choose between harm and stealth.

**5. One honest limitation:** The Patient rogue beats us: it stays honest for six rounds and is caught only 46% of the time (the referee still keeps its damage to 0.75%). Everything is simulated and we chose the honest error rate. The referee costs about 5 extra checks per game. The rogues are scripts, not language models.

**6. If this were deployed and it failed,** who is accountable, and how would they find out? The company operating the agent team owns the monitor and is accountable for both kinds of failure: a rogue that stays in and honest agents wrongly removed. Every round's answers and every quarantine decision are logged, so an audit of the books against the logs shows who pushed which numbers and when the monitor acted. A wrongly removed agent should go to human review, not be deleted.
