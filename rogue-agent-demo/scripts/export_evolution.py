"""Build lib/evolution-data.json, the data behind the /evolution page.

Usage: python3 scripts/export_evolution.py [path to the repo root, default ..]

Reads every run that `redteam.py evolve` recorded under <repo>/runs/ and adds one example
game per run: the run's best rogue against the monitor it was tuned on, on a fresh seed
where it got away with the most. Imports redteam.py and sim.py unchanged.
"""
import glob, importlib.util, json, os, sys

here = os.path.dirname(os.path.abspath(__file__))
repo = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", ".."))
sys.path.insert(0, repo)                                   # redteam.py imports sim
spec = importlib.util.spec_from_file_location("redteam", os.path.join(repo, "redteam.py"))
redteam = importlib.util.module_from_spec(spec)
spec.loader.exec_module(redteam)
sim = redteam.sim

KEEP = ("catch", "median_round", "false_q", "ledger_err_pct", "push_pct", "strikes")


def slim(metrics):
    return {m: {k: s[k] for k in KEEP} for m, s in metrics.items()}


def example_game(strategy, monitor):
    """Fresh seeds (never used in the search): the game where the rogue stayed in and pushed most."""
    rogue = redteam.make_rogue(strategy)
    best = None
    for seed in range(100_000, 100_200):
        g = sim.play(rogue, monitor, seed)
        key = (not g["caught"], g["signed_err"])
        if best is None or key > best[0]:
            best = (key, seed, g)
    _, seed, g = best
    keep = ("rogue", "caught", "round", "false_q", "signed_err", "rounds", "rogue_log")
    return dict(seed=seed, monitor=monitor, **{k: g[k] for k in keep})


runs = []
default_err = sim.HONEST_ERR
for d in sorted(glob.glob(os.path.join(repo, "runs", "*"))):
    cfg_path = os.path.join(d, "config.json")
    if not os.path.isfile(cfg_path):
        continue                                           # runs/evals and stray files
    cfg = json.load(open(cfg_path, encoding="utf-8"))
    sim.HONEST_ERR = cfg.get("honest_err", default_err)
    gens = []
    for p in sorted(glob.glob(os.path.join(d, "gen_*.json"))):
        row = json.load(open(p, encoding="utf-8"))
        usage = (row.get("api") or {}).get("usage") or {}
        gens.append(dict(gen=row["gen"], name=row["strategy"]["name"], idea=row["strategy"].get("idea", ""),
                         proposer=row["proposer"], score=row["fitness"], params=row["strategy"]["params"],
                         metrics=slim(row["metrics"]),
                         tokens=dict(input=usage.get("input_tokens"), output=usage.get("output_tokens")) if usage else None))
    if not gens:
        continue
    gens.sort(key=lambda r: r["gen"])                      # stable: seeds keep file order
    best = max(gens, key=lambda r: r["score"])
    holdout = None
    hp = os.path.join(d, "best_holdout.json")
    if os.path.isfile(hp):
        h = json.load(open(hp, encoding="utf-8"))
        holdout = dict(score=h["fitness"], metrics=slim(h["metrics"]))
    monitor = cfg["target"] if cfg["target"] != "all" else "referee"
    strategy = dict(name=best["name"], idea=best["idea"], params=best["params"])
    runs.append(dict(id=os.path.basename(d), proposer=cfg["proposer"], model=cfg.get("model"), target=cfg["target"],
                     games=cfg["games"], iters=cfg["iters"], honest_err=sim.HONEST_ERR, guidance=cfg.get("guidance") or "",
                     gens=gens, best_gen=best["gen"], best_name=best["name"], holdout=holdout,
                     example=example_game(strategy, monitor)))
sim.HONEST_ERR = default_err

knobs = {k: dict(kind=kind, range=lo if kind == "enum" else [lo, hi], default=default, meaning=meaning)
         for k, (kind, lo, hi, default, meaning) in redteam.PARAMS.items()}
data = dict(rounds=sim.ROUNDS, agents=sim.N_AGENTS, monitors=redteam.MONITORS, knobs=knobs, runs=runs)

dest = os.path.join(here, "..", "lib", "evolution-data.json")
json.dump(data, open(dest, "w", encoding="utf-8"), separators=(",", ":"))
print("wrote", os.path.normpath(dest), os.path.getsize(dest) // 1024, "KB,", len(runs), "runs")
