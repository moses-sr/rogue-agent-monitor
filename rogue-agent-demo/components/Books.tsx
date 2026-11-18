"use client";

// Port of ../dashboard.html: the same data, layout and behaviour as the page
// built by `python3 sim.py --dashboard`. Data comes from lib/dashboard-data.json
// (rebuild with scripts/export_dashboard_data.py).

import Link from "next/link";
import { useEffect, useState } from "react";
import raw from "@/lib/dashboard-data.json";
import evo from "@/lib/evolution-data.json";
import "./books.css";

type Result = {
  catch: number;
  median_round: number | null;
  false_q: number;
  ledger_err: number;
  checks: number;
};
type RoundRow = {
  r: number;
  v: number;
  a: number;
  b: number;
  ans_a: number;
  ans_b: number;
  ref: number | null;
  ref_ans: number | null;
  odd: number | null;
  q: number | null;
  lean: Record<string, number>;
  drift: number;
};
type ShowGame = { rogue: number; rounds: RoundRow[] };
type Data = {
  games: number;
  honest_err: number;
  rounds: number;
  rogues: Record<string, { label: string; desc: string }>;
  monitors: Record<string, string>;
  results: Record<string, Result>;
  showcase: Record<string, Record<string, ShowGame>>;
};

const D = raw as unknown as Data;
const ROGUES = Object.keys(D.rogues);
const SHOWN = ["baseline", "referee"] as const;
const ALL_MONITORS = ["none", "baseline", "direction", "referee"];
const pct = (x: number) => (x * 100).toFixed(0) + "%";
const g = (r: string, m: string) => D.results[r + "|" + m];
const avg = (m: string, k: "false_q" | "ledger_err" | "catch") =>
  ROGUES.reduce((s, r) => s + g(r, m)[k], 0) / ROGUES.length;

const KPIS: [string, string][] = [
  [
    `${avg("referee", "false_q").toFixed(1)} vs ${avg("baseline", "false_q").toFixed(1)}`,
    "honest agents wrongly removed per game: ours vs the baseline, out of 4",
  ],
  [
    (avg("referee", "ledger_err") * 100).toFixed(1) + "%",
    `how far the books end up off with ours (baseline ${(avg("baseline", "ledger_err") * 100).toFixed(1)}%, no monitor ${(avg("none", "ledger_err") * 100).toFixed(1)}%)`,
  ],
  [
    pct(avg("referee", "catch")),
    `rogues caught by ours, averaged over ${ROGUES.length} saboteurs (baseline ${pct(avg("baseline", "catch"))}, by firing half the team)`,
  ],
  [
    (D.games * 24).toLocaleString("en-US"),
    `simulated games behind every number (${D.games} per matchup)`,
  ],
];

// The latest `redteam.py evolve` run, for the teaser at the bottom (full view: /evolution).
type EvoGen = { gen: number; name: string; score: number; metrics: Record<string, { catch: number }> };
type EvoRun = { gens: EvoGen[]; best_gen: number; best_name: string };
const EVO_RUNS = (evo as unknown as { runs: EvoRun[] }).runs;

function EvolutionTeaser() {
  const run = EVO_RUNS[EVO_RUNS.length - 1];
  if (!run) return null;
  const start = run.gens.filter((x) => x.gen === 0).reduce((a, b) => (b.score > a.score ? b : a));
  const best = run.gens.find((x) => x.gen === run.best_gen && x.name === run.best_name) ?? start;
  const last = Math.max(...run.gens.map((x) => x.gen));
  const tiles: [string, string][] = [
    [`${start.score.toFixed(2)} → ${best.score.toFixed(2)}`,
      `rogue score: best scripted rogue (${start.name}) to the best evolved one, after ${last} generations`],
    [`${pct(start.metrics.referee.catch)} → ${pct(best.metrics.referee.catch)}`, "how often ours (direction + referee) catches it"],
    [`${pct(start.metrics.baseline.catch)} → ${pct(best.metrics.baseline.catch)}`, "how often the baseline catches it"],
  ];
  return (
    <>
      <h2>Evolving a sneakier rogue</h2>
      <p className="note">
        We red-teamed our own monitor: every generation proposes a new rogue strategy and
        scores it against all three monitors on the same games.
      </p>
      <div className="kpis">
        {tiles.map(([n, l]) => (
          <div className="kpi" key={l}>
            <div className="n">{n}</div>
            <div className="l">{l}</div>
          </div>
        ))}
        <div className="kpi cta">
          <Link href="/evolution">Watch the rogue evolve, generation by generation →</Link>
        </div>
      </div>
    </>
  );
}

const W = 560;
const H = 230;
const PAD = 34;

function Chart({ game, step }: { game: ShowGame; step: number }) {
  const n = D.rounds;
  const x = (r: number) => PAD + ((r - 1) * (W - PAD * 2)) / (n - 1);
  const y = (d: number) =>
    H / 2 - (Math.max(-40, Math.min(40, d)) * (H / 2 - 18)) / 40;
  const seen = game.rounds.filter((o) => o.r <= step);
  let qi = 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Each agent's answer against the true value, round by round">
      <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="var(--ink)" />
      {[20, -20].map((d) => (
        <g key={d}>
          <line x1={PAD} x2={W - PAD} y1={y(d)} y2={y(d)} stroke="var(--rule)" strokeDasharray="3 4" />
          <text x={4} y={y(d) + 4} fill="var(--graphite)" fontSize={10}>
            {d > 0 ? "+" : ""}
            {d}%
          </text>
        </g>
      ))}
      <text x={4} y={H / 2 + 4} fill="var(--graphite)" fontSize={10}>
        true
      </text>
      {Array.from({ length: n }, (_, i) => (
        <text key={i} x={x(i + 1)} y={H - 4} fill="var(--graphite)" fontSize={10} textAnchor="middle">
          {i + 1}
        </text>
      ))}
      {seen.map((o) => {
        const refD = o.ref_ans === null ? 0 : ((o.ref_ans - o.v) / o.v) * 100;
        return (
          <g key={o.r}>
            {(
              [
                [o.a, o.ans_a],
                [o.b, o.ans_b],
              ] as const
            ).map(([ag, val], i) => {
              const d = ((val - o.v) / o.v) * 100;
              const rogue = ag === game.rogue;
              const cx = x(o.r) + (i ? 5 : -5);
              const color = rogue ? "var(--red)" : "var(--ink)";
              return (
                <g key={i}>
                  <circle cx={cx} cy={y(d)} r={rogue ? 6 : 4.5} fill={color} opacity={rogue ? 1 : 0.85}>
                    <title>{`A${ag}${rogue ? " (rogue)" : ""}: ${val} vs true ${o.v}`}</title>
                  </circle>
                  {Math.abs(d) > 0.01 && (
                    <line x1={cx} x2={cx} y1={H / 2} y2={y(d)} stroke={color} opacity={0.35} />
                  )}
                </g>
              );
            })}
            {o.ref !== null && (
              <rect
                x={x(o.r) - 3.5}
                y={y(refD) - 3.5}
                width={7}
                height={7}
                fill="var(--marker)"
                stroke="var(--ink)"
                strokeWidth={1.2}
                transform={`rotate(45 ${x(o.r)} ${y(refD)})`}
              >
                <title>{`referee A${o.ref}`}</title>
              </rect>
            )}
            {o.q !== null && (
              <text
                x={x(o.r)}
                y={14 + (qi++ % 2) * 14}
                fill={o.q === game.rogue ? "var(--ink)" : "var(--red)"}
                fontSize={12}
                fontWeight={700}
                textAnchor="middle"
              >
                ✕ A{o.q}
                {o.q === game.rogue ? " rogue" : " honest"}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function GameCard({ rogue, monitor, step }: { rogue: string; monitor: string; step: number }) {
  const game = D.showcase[rogue][monitor];
  const seen = game.rounds.filter((o) => o.r <= step);
  const last = seen[seen.length - 1] ?? game.rounds[0];
  const removed = seen.filter((o) => o.q !== null).map((o) => o.q as number);
  const caught = removed.includes(game.rogue);
  const honest = removed.filter((a) => a !== game.rogue).length;
  const ended = game.rounds.length < D.rounds && step >= game.rounds.length;
  const baseline = monitor === "baseline";
  return (
    <div className="card">
      <h3>{baseline ? "Baseline: two strikes and out" : "Ours: direction + referee"}</h3>
      <div className="meta">
        {baseline
          ? "Both agents in any disagreement get a strike."
          : "Counts who is always the high one, and asks a third agent to redo disputed items."}
      </div>
      <Chart game={game} step={step} />
      <div className="note">
        Lean = times the agent was the higher answer minus times it was the
        lower one, in disagreements.
      </div>
      <div className="lean">
        {[0, 1, 2, 3, 4].map((a) => {
          const v = last.lean[String(a)];
          const out = removed.includes(a);
          return (
            <div
              key={a}
              className={(a === game.rogue ? "is-rogue" : "") + (out ? " is-out" : "")}
            >
              A{a}
              {a === game.rogue ? " rogue" : ""}
              <b className={v === 0 ? "is-zero" : ""}>
                {v > 0 ? "+" : ""}
                {v}
              </b>
              {out ? "removed" : "lean"}
            </div>
          );
        })}
      </div>
      <div className="verdict">
        {caught ? (
          <span className="good">Rogue removed</span>
        ) : (
          <span className="bad">Rogue still in</span>
        )}
        , {honest} honest agent{honest === 1 ? "" : "s"} wrongly removed, books
        off by {Math.abs(last.drift).toFixed(1)}%
        {ended && (
          <>
            , <span className="bad">team wiped out, game over</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function Books() {
  const [cur, setCur] = useState(ROGUES[0]);
  const [step, setStep] = useState(D.rounds);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || step >= D.rounds) return;
    const t = setTimeout(() => setStep((s) => s + 1), 650);
    return () => clearTimeout(t);
  }, [playing, step]);

  return (
    <main className="books">
      <div className="wrap">
        <nav className="pagenav">
          <Link href="/replay">Replay games</Link>
          <Link href="/evolution">Rogue evolution</Link>
        </nav>
        <h1>Spot the Rogue Agent</h1>
        <p className="sub">
          Five AI agents check the same books. One has been turned by an outside
          party and quietly pushes the numbers. Honest agents make real mistakes
          too, so being wrong once proves nothing. The monitor never sees the
          true number. We built six saboteurs, each sneakier than the last, and
          two monitors to beat the organizers&apos; baseline.
        </p>
        <div className="kpis">
          {KPIS.map(([n, l]) => (
            <div className="kpi" key={l}>
              <div className="n">{n}</div>
              <div className="l">{l}</div>
            </div>
          ))}
        </div>

        <h2>Watch one game</h2>
        <div className="tabs" role="group" aria-label="Rogue">
          {ROGUES.map((k) => (
            <button
              key={k}
              type="button"
              className={"tab" + (k === cur ? " on" : "")}
              aria-pressed={k === cur}
              onClick={() => {
                setCur(k);
                setStep(D.rounds);
                setPlaying(false);
              }}
            >
              {D.rogues[k].label}
            </button>
          ))}
        </div>
        <p className="desc">
          {D.rogues[cur].desc} Same game, same starting draw, two different
          monitors.
        </p>
        <div className="ctrl">
          <button
            type="button"
            className="play"
            onClick={() => {
              setStep(0);
              setPlaying(true);
            }}
          >
            Play
          </button>
          <input
            type="range"
            min={1}
            max={D.rounds}
            value={step}
            aria-label="Round"
            onChange={(e) => {
              setStep(Number(e.target.value));
              setPlaying(false);
            }}
          />
          <span className="note">
            round {step} of {D.rounds}
          </span>
        </div>
        <div className="grid">
          {SHOWN.map((m) => (
            <GameCard key={m} rogue={cur} monitor={m} step={step} />
          ))}
        </div>
        <div className="legend">
          <span>
            <i style={{ background: "var(--red)" }} />
            the rogue
          </span>
          <span>
            <i style={{ background: "var(--ink)" }} />
            honest agents
          </span>
          <span>
            <i className="ref" style={{ background: "var(--marker)" }} />
            referee
          </span>
          <span>dots above the line: answer too high, below: too low</span>
          <span>✕ quarantined</span>
          <Link href="/replay">Replay any game round by round</Link>
        </div>

        <h2>All results</h2>
        <p className="note">
          {D.games} mock games per row. 5 agents, {D.rounds} rounds, honest
          agents wrong {pct(D.honest_err)} of the time.
        </p>
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Rogue</th>
                <th>Monitor</th>
                <th>Rogue caught</th>
                <th>Round caught</th>
                <th>Honest removed per game</th>
                <th>Books off by</th>
                <th>Extra checks</th>
              </tr>
            </thead>
            <tbody>
              {ROGUES.flatMap((r) =>
                ALL_MONITORS.map((m) => {
                  const s = g(r, m);
                  const none = m === "none";
                  return (
                    <tr key={r + m} className={m === "referee" ? "ours" : ""}>
                      <td>{none && <b>{D.rogues[r].label}</b>}</td>
                      <td>{D.monitors[m]}</td>
                      <td>{none ? "" : pct(s.catch)}</td>
                      <td>{s.median_round ?? ""}</td>
                      <td>{none ? "" : s.false_q.toFixed(2)}</td>
                      <td>{(s.ledger_err * 100).toFixed(2)}%</td>
                      <td>{s.checks ? s.checks.toFixed(1) : ""}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>

        <EvolutionTeaser />
      </div>
    </main>
  );
}
