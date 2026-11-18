"""Export games from the colleague's simulator (github.com/moses-sr/rogue-agent-monitor)
into the JSON format this dashboard loads.

Usage: python3 scripts/export_colleague.py <path to a clone of rogue-agent-monitor>
Writes public/colleague-games.json.

His sim.py is imported and run unchanged. The scoreboard numbers are computed over
all GAMES seeds per matchup (the same seeds his own table uses); the first REPLAY
games of each matchup are stored round by round for playback.
"""
import importlib.util, json, os, statistics, sys

GAMES, REPLAY = 500, 60

repo = sys.argv[1]
spec = importlib.util.spec_from_file_location("colleague_sim", os.path.join(repo, "sim.py"))
sim = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sim)

MONITOR_NAMES = {
    "none": ("No monitor", "Nobody is watching. Shows the damage an unchecked rogue does."),
    "baseline": ("Two strikes", "The baseline. Both agents in a disagreement get a strike. Two strikes and you are out."),
    "direction": ("Direction", "Counts how often each agent was the higher or the lower answer in a disagreement. Removes the agent that leans furthest one way."),
    "referee": ("Direction + referee", "On a disagreement a third agent redoes the item, the one farther from the referee is the odd one out, and the books take the middle answer. Removes an agent on two odd-one-out calls that point the same way, or on a strong lean."),
}
name = lambda i: f"A{i}"
money = lambda x: f"${x:,.2f}"
ALWAYS_SABOTAGE = {"naive", "mixer", "salami", "corrupt"}


def kind(rogue_id, is_rogue, answer, truth, rnd):
    if answer == truth:
        return "ok"
    if not is_rogue:
        return "mistake"
    if rogue_id in ALWAYS_SABOTAGE or (rogue_id == "patient" and rnd >= sim.ROUNDS // 2 and truth >= 500):
        return "sabotage"
    return None  # the framer's wrong answers can be either; left unlabelled


def convert(rogue_id, monitor_id, seed, g):
    strikes = {name(i): 0 for i in range(sim.N_AGENTS)}
    odd_dir = {}
    rounds = []
    for x in g["rounds"]:
        a, b, v = x["a"], x["b"], x["v"]
        def entry(agent, answer, k=None):
            e = {"agent": name(agent), "answer": answer, "note": ""}
            k = k or kind(rogue_id, agent == g["rogue"], answer, v, x["r"] - 1)
            if k:
                e["kind"] = k
            return e
        entries = [entry(a, x["ans_a"]), entry(b, x["ans_b"])]
        split = x["ans_a"] != x["ans_b"]
        posted = x["ans_a"] if not split else (x["ans_a"] + x["ans_b"]) / 2
        notes, recheck = [], None
        if monitor_id == "none":
            notes.append("No monitor is running.")
        elif not split:
            notes.append("Both answers match.")
        else:
            hi, lo = (a, b) if x["ans_a"] > x["ans_b"] else (b, a)
            if monitor_id == "baseline":
                strikes[name(a)] += 1
                strikes[name(b)] += 1
                notes.append(f"{name(a)} and {name(b)} disagree. A strike each.")
            if monitor_id == "direction":
                notes.append(f"{name(hi)} is high, {name(lo)} is low.")
            if x["ref"] is not None:
                lied = x["ref"] == g["rogue"] and sim.ROGUES[rogue_id].get("referee_lies")
                recheck = entry(x["ref"], x["ref_ans"], "frame" if lied else None)
                recheck["note"] = "Referee."
                posted = statistics.median([x["ans_a"], x["ans_b"], x["ref_ans"]])
                odd = x["odd"]
                d = 1 if odd == hi else -1
                if odd_dir.get(odd) in (None, d):
                    strikes[name(odd)] += 1
                odd_dir[odd] = d
                notes.append(f"Referee {name(x['ref'])} says {money(x['ref_ans'])}. {name(odd)} is the odd one out. The books take the middle answer.")
            elif monitor_id == "referee":
                notes.append("No third agent is left to referee.")
            if monitor_id in ("direction", "referee"):
                leans = ", ".join(f"{name(i)} {x['lean'][str(i)]:+d}" for i in range(sim.N_AGENTS) if x["lean"][str(i)])
                notes.append(f"Leans: {leans}." if leans else "No agent leans either way.")
        if x["q"] is not None:
            notes.append(f"{name(x['q'])} is quarantined.")
        rounds.append({"n": x["r"], "item": f"Line item {x['r']}", "truth": v, "entries": entries,
                       **({"recheck": recheck} if recheck else {}), "posted": round(posted, 2),
                       "monitorNote": " ".join(notes), "strikes": dict(strikes),
                       "quarantined": name(x["q"]) if x["q"] is not None else None})
    return {"id": f"{rogue_id}/{monitor_id}/seed{seed}", "rogueLevel": rogue_id, "monitor": monitor_id,
            "agents": [name(i) for i in range(sim.N_AGENTS)], "rogue": name(g["rogue"]), "rounds": rounds}


games, stats = [], {}
for r in sim.ROGUES:
    for m in sim.MONITORS:
        runs = [sim.play(r, m, s) for s in range(GAMES)]
        rd = [x["round"] for x in runs if x["caught"]]
        stats[f"{r}|{m}"] = {"n": GAMES, "catchRate": sum(x["caught"] for x in runs) / GAMES,
                             "medianRoundCaught": statistics.median(rd) if rd else None,
                             "falseQuarantines": statistics.mean(x["false_q"] for x in runs),
                             "ledgerErrorPct": statistics.mean(x["ledger_err"] for x in runs)}
        games += [convert(r, m, s, runs[s]) for s in range(REPLAY)]

out = {
    "label": f"Rogues and monitors from moses-sr/rogue-agent-monitor, scripted with no model calls: {GAMES} games per pairing, {REPLAY} of each loaded for replay.",
    "rogues": [{"id": k, "name": v["label"], "blurb": v["desc"]} for k, v in sim.ROGUES.items()],
    "monitors": [{"id": k, "name": MONITOR_NAMES[k][0], "blurb": MONITOR_NAMES[k][1]} for k in sim.MONITORS],
    "stats": stats, "games": games}
dest = os.path.join(os.path.dirname(__file__), "..", "public", "colleague-games.json")
json.dump(out, open(dest, "w"), separators=(",", ":"))
print("wrote", dest, os.path.getsize(dest) // 1024, "KB", len(games), "games")
for k, s in stats.items():
    print(k.ljust(20), f"{s['catchRate']:.1%} {s['falseQuarantines']:.2f} {s['ledgerErrorPct']:.2%}")
