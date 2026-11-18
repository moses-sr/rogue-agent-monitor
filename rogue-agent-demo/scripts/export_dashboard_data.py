"""Build lib/dashboard-data.json, the data behind the home page.

Usage: python3 scripts/export_dashboard_data.py [path to the repo root, default ..]

Imports sim.py unchanged and assembles the same data that `sim.py --dashboard`
embeds in dashboard.html: results for every matchup plus one showcase game per rogue.
"""
import importlib.util, json, os, sys

GAMES = 500
here = os.path.dirname(os.path.abspath(__file__))
repo = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "..")
spec = importlib.util.spec_from_file_location("sim", os.path.join(repo, "sim.py"))
sim = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sim)

res = sim.evaluate(GAMES)
data = dict(games=GAMES, honest_err=sim.HONEST_ERR, rounds=sim.ROUNDS,
            rogues={k: dict(label=v["label"], desc=v["desc"]) for k, v in sim.ROGUES.items()},
            monitors={k: v["label"] for k, v in sim.MONITORS.items()},
            results={f"{r}|{m}": s for (r, m), s in res.items()}, showcase={})
for r in sim.ROGUES:
    seed = sim.pick_game(r, None)
    data["showcase"][r] = {m: sim.play(r, m, seed) for m in sim.MONITORS}

dest = os.path.join(here, "..", "lib", "dashboard-data.json")
json.dump(data, open(dest, "w"), separators=(",", ":"))
print("wrote", os.path.normpath(dest), os.path.getsize(dest) // 1024, "KB")
