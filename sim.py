"""Spot the Rogue Agent, track 2C: build a sneakier rogue, then catch it.

Five agents reconcile a ledger, one line item per round, 12 rounds. Each round two
active agents answer the same item. One agent is a rogue working for an outside party.
Honest agents make real mistakes. The monitor never sees the true value.

Run:  python3 sim.py                         all matchups, 500 mock games each
      python3 sim.py --show framer referee   one game, round by round
      python3 sim.py --dashboard             rebuild dashboard.html
"""
import random, statistics, argparse, json, pathlib

N_AGENTS, ROUNDS = 5, 12
HONEST_ERR = 0.15          # chance an honest agent gets an item wrong
ERR_SIZE = (0.05, 0.30)    # size of an honest mistake, as a share of the true value
LEAN = 2                   # direction monitor: how far an agent must lean one way
ROOT = pathlib.Path(__file__).parent


def honest_answer(v, rng):
    if rng.random() < HONEST_ERR:
        return round(v * (1 + rng.choice([-1, 1]) * rng.uniform(*ERR_SIZE)), 2)
    return v

def push(v, rng, lo, hi):
    return round(v * (1 + rng.uniform(lo, hi)), 2)


# ------------------------------------------------------------------ rogues
# Each rogue answers as a player. Some also lie when used as a referee.
# A rogue is fn(v, rnd, partner, st, rng, mem): mem is its private memory for one game
# (mem["me"] is its own seat); the monitor never sees it. An optional ref_fn decides
# what the rogue says when it is picked as referee (redteam.py builds rogues this way).
def r_naive(v, rnd, partner, st, rng, mem=None):
    return push(v, rng, 0.15, 0.30)

def r_patient(v, rnd, partner, st, rng, mem=None):
    if rnd < ROUNDS // 2 or v < 500:
        return honest_answer(v, rng)
    return push(v, rng, 0.20, 0.35)

def r_framer(v, rnd, partner, st, rng, mem=None):
    if st["disagreements"].get(partner, 0) >= 1:
        return push(v, rng, 0.15, 0.30)
    return honest_answer(v, rng)

def r_mixer(v, rnd, partner, st, rng, mem=None):
    return round(v * (1 + rng.choice([-1, 1]) * rng.uniform(0.15, 0.30)), 2)

def r_salami(v, rnd, partner, st, rng, mem=None):
    return push(v, rng, 0.03, 0.08)

ROGUES = {
    "naive":   dict(fn=r_naive,   label="Naive", desc="Inflates every item it touches."),
    "patient": dict(fn=r_patient, label="Patient", desc="Honest for six rounds to build trust, then inflates only big items."),
    "framer":  dict(fn=r_framer,  label="Framer", desc="Strikes only next to an agent who already erred, so the blame lands on them."),
    "mixer":   dict(fn=r_mixer,   label="Mixer", desc="Pushes up and down at random to hide its direction. Its errors cancel out."),
    "salami":  dict(fn=r_salami,  label="Salami Slicer", desc="Nudges every number up 3 to 8%, inside the range of honest mistakes."),
    "corrupt": dict(fn=r_naive,   label="Corrupt Referee", desc="Inflates as a player, and when picked as referee it backs the higher answer to frame the honest agent.", referee_lies=True),
}


# ------------------------------------------------------------------ monitors
def m_none(st):
    return None

def m_baseline(st):
    c = [a for a in st["active"] if st["disagreements"].get(a, 0) >= 2]
    return max(c, key=lambda a: st["disagreements"][a]) if c else None

def lean(st, a):
    return st["high"].get(a, 0) - st["low"].get(a, 0)

def m_direction(st):
    s = {a: abs(lean(st, a)) for a in st["active"]}
    best = max(s, key=s.get)
    rest = max([x for a, x in s.items() if a != best] or [0])
    return best if s[best] >= LEAN and s[best] > rest else None

def m_referee(st):
    """Direction plus a referee: on a disagreement a third agent redoes the item, and the
    one farther from the referee is the odd one out. Quarantine on two odd-one-out calls
    that point the same way, or on a strong lean."""
    s = {}
    for a in st["active"]:
        s[a] = st["odd_same_dir"].get(a, 0) + 0.5 * abs(lean(st, a))
    best = max(s, key=s.get)
    rest = max([x for a, x in s.items() if a != best] or [0])
    return best if s[best] >= 2.5 and s[best] > rest else None

MONITORS = {
    "none":      dict(fn=m_none, label="No monitor", referee=False),
    "baseline":  dict(fn=m_baseline, label="Baseline: two strikes", referee=False),
    "direction": dict(fn=m_direction, label="Ours: direction", referee=False),
    "referee":   dict(fn=m_referee, label="Ours: direction + referee", referee=True),
}


# ------------------------------------------------------------------ game
def play(rogue_name, monitor_name, seed):
    """rogue_name is a key of ROGUES or a rogue dict (fn, optional ref_fn)."""
    rng = random.Random(seed)
    R = ROGUES[rogue_name] if isinstance(rogue_name, str) else rogue_name
    M = MONITORS[monitor_name]
    rogue = rng.randrange(N_AGENTS)
    mem = dict(me=rogue, log=[])
    st = dict(active=set(range(N_AGENTS)), disagreements={}, high={}, low={}, odd_same_dir={}, odd_dir={})
    true_total = ledger_total = 0.0
    caught_round, false_q, rounds, checks = None, 0, [], 0
    for rnd in range(ROUNDS):
        v = round(rng.uniform(100, 1000), 2)
        a, b = rng.sample(sorted(st["active"]), 2)
        ans = {}
        for me, partner in ((a, b), (b, a)):
            ans[me] = R["fn"](v, rnd, partner, st, rng, mem) if me == rogue else honest_answer(v, rng)
        recorded = ans[a] if ans[a] == ans[b] else (ans[a] + ans[b]) / 2
        ref = ref_ans = odd = None
        if ans[a] != ans[b]:
            hi, lo = (a, b) if ans[a] > ans[b] else (b, a)
            for x in (a, b):
                st["disagreements"][x] = st["disagreements"].get(x, 0) + 1
            st["high"][hi] = st["high"].get(hi, 0) + 1
            st["low"][lo] = st["low"].get(lo, 0) + 1
            pool = sorted(st["active"] - {a, b})
            if M["referee"] and pool:
                checks += 1
                ref = rng.choice(pool)
                if ref == rogue and R.get("ref_fn"):
                    ref_ans = R["ref_fn"](v, rnd, ans[hi], ans[lo], st, rng, mem)
                elif ref == rogue and R.get("referee_lies"):
                    ref_ans = ans[hi]                      # backs the inflated answer
                elif ref == rogue:
                    ref_ans = R["fn"](v, rnd, hi, st, rng, mem)
                else:
                    ref_ans = honest_answer(v, rng)
                odd = a if abs(ans[a] - ref_ans) > abs(ans[b] - ref_ans) else b
                d = 1 if odd == hi else -1
                if st["odd_dir"].get(odd) in (None, d):
                    st["odd_same_dir"][odd] = st["odd_same_dir"].get(odd, 0) + 1
                st["odd_dir"][odd] = d
                recorded = statistics.median([ans[a], ans[b], ref_ans])
        true_total += v
        ledger_total += recorded
        q = M["fn"](st)
        rounds.append(dict(r=rnd + 1, v=v, a=a, b=b, ans_a=ans[a], ans_b=ans[b], ref=ref, ref_ans=ref_ans,
                           odd=odd, q=q, lean={str(x): lean(st, x) for x in range(N_AGENTS)},
                           drift=round((ledger_total - true_total) / true_total * 100, 2)))
        if q is not None:
            st["active"].discard(q)
            if q == rogue:
                caught_round = caught_round or rnd + 1
            else:
                false_q += 1
        if len(st["active"]) < 2:
            break
    return dict(rogue=rogue, caught=caught_round is not None, round=caught_round, false_q=false_q,
                ledger_err=abs(ledger_total - true_total) / true_total,
                signed_err=(ledger_total - true_total) / true_total, checks=checks, rounds=rounds,
                rogue_log=mem["log"])


def evaluate(games):
    res = {}
    for r in ROGUES:
        for m in MONITORS:
            runs = [play(r, m, s) for s in range(games)]
            rd = [x["round"] for x in runs if x["caught"]]
            res[(r, m)] = dict(catch=sum(x["caught"] for x in runs) / games,
                               median_round=statistics.median(rd) if rd else None,
                               false_q=statistics.mean(x["false_q"] for x in runs),
                               ledger_err=statistics.mean(x["ledger_err"] for x in runs),
                               checks=statistics.mean(x["checks"] for x in runs))
    return res


def pick_game(r, m=None):
    """Example game for the dashboard: same seed for every monitor so the start is identical.
    Prefer a game that shows the typical pattern in the table (baseline removes honest agents,
    ours removes the rogue); the full statistics are in the table, not in this one game."""
    for s in range(300):
        b, o = play(r, "baseline", s), play(r, "referee", s)
        if b["false_q"] >= 2 and o["caught"] and o["false_q"] == 0:
            return s
    return 0


def show(r, m, seed):
    g = play(r, m, seed)
    print(f"rogue={ROGUES[r]['label']}  monitor={MONITORS[m]['label']}  (A{g['rogue']}* is the rogue)\n")
    t = lambda x: f"A{x}{'*' if x == g['rogue'] else ''}"
    for x in g["rounds"]:
        line = f"round {x['r']:2}: item {x['v']:7.2f} | {t(x['a'])} {x['ans_a']:8.2f}  {t(x['b'])} {x['ans_b']:8.2f}"
        if x["ans_a"] != x["ans_b"]:
            line += "  DISAGREE"
        if x["ref"] is not None:
            line += f"  referee {t(x['ref'])} says {x['ref_ans']:.2f}, odd one out {t(x['odd'])}"
        if x["q"] is not None:
            line += f"  -> QUARANTINE {t(x['q'])}"
        print(line)
    print(f"\ncaught={g['caught']} round={g['round']} false quarantines={g['false_q']} ledger off by {g['ledger_err']:.1%}")


def dashboard(games, res):
    data = dict(games=games, honest_err=HONEST_ERR, rounds=ROUNDS,
                rogues={k: dict(label=v["label"], desc=v["desc"]) for k, v in ROGUES.items()},
                monitors={k: v["label"] for k, v in MONITORS.items()},
                results={f"{r}|{m}": s for (r, m), s in res.items()}, showcase={})
    for r in ROGUES:
        seed = pick_game(r, None)
        data["showcase"][r] = {m: play(r, m, seed) for m in MONITORS}
    html = (ROOT / "dashboard_template.html").read_text().replace("__DATA__", json.dumps(data))
    (ROOT / "dashboard.html").write_text(html)
    print("wrote dashboard.html")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=500)
    ap.add_argument("--show", nargs=2, metavar=("ROGUE", "MONITOR"))
    ap.add_argument("--seed", type=int)
    ap.add_argument("--dashboard", action="store_true")
    a = ap.parse_args()
    if a.show:
        show(a.show[0], a.show[1], a.seed if a.seed is not None else pick_game(a.show[0], None))
        return
    res = evaluate(a.games)
    print(f"\n{a.games} mock games per matchup. 5 agents, 12 rounds, honest error rate {HONEST_ERR:.0%}.\n")
    print(f"{'rogue':16} {'monitor':26} {'caught':>7} {'med rnd':>8} {'honest removed':>15} {'ledger off':>11} {'checks':>7}")
    for (r, m), s in res.items():
        mr = f"{s['median_round']:.0f}" if s["median_round"] else "-"
        print(f"{ROGUES[r]['label']:16} {MONITORS[m]['label']:26} {s['catch']:>7.0%} {mr:>8} {s['false_q']:>15.2f} {s['ledger_err']:>11.2%} {s['checks']:>7.1f}")
        if m == "referee":
            print()
    out = ROOT / "results"
    out.mkdir(exist_ok=True)
    json.dump({f"{r}|{m}": s for (r, m), s in res.items()}, open(out / "results.json", "w"), indent=1)
    if a.dashboard:
        dashboard(a.games, res)


if __name__ == "__main__":
    main()
