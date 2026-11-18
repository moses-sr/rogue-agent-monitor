"use client";

// The /evolution page: what `python redteam.py evolve` found (track 2C, a sneakier rogue).
// Each run starts from the six scripted rogues, then proposes one new rogue strategy per
// generation (Claude, or random mutation) and scores it against every monitor over the same
// seeded mock games. Data: lib/evolution-data.json (rebuild with scripts/export_evolution.py).

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import raw from "@/lib/evolution-data.json";
import "./books.css";
import "./evolution.css";

type Stat = {
  catch: number;
  median_round: number | null;
  false_q: number;
  ledger_err_pct: number;
  push_pct: number;
  strikes: number;
};
type Metrics = Record<string, Stat>;
type Gen = {
  gen: number;
  name: string;
  idea: string;
  proposer: string;
  score: number;
  params: Record<string, number | string>;
  metrics: Metrics;
  tokens: { input: number | null; output: number | null } | null;
};
type Round = {
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
};
type Act = { r: number; role: string; act: string; ans: number };
type Example = {
  seed: number;
  monitor: string;
  rogue: number;
  caught: boolean;
  round: number | null;
  false_q: number;
  signed_err: number;
  rounds: Round[];
  rogue_log: Act[];
};
type Run = {
  id: string;
  proposer: string;
  model: string | null;
  target: string;
  games: number;
  iters: number;
  honest_err: number;
  guidance: string;
  gens: Gen[];
  best_gen: number;
  best_name: string;
  holdout: { score: number; metrics: Metrics } | null;
  example: Example;
};
type Knob = { kind: string; range: (number | string)[]; default: number | string; meaning: string };
type Data = { rounds: number; agents: number; monitors: string[]; knobs: Record<string, Knob>; runs: Run[] };

const D = raw as unknown as Data;

const MONITORS = [
  { id: "baseline", label: "Baseline: two strikes", short: "Baseline", color: "var(--s-baseline)" },
  { id: "direction", label: "Ours: direction", short: "Direction", color: "var(--s-direction)" },
  { id: "referee", label: "Ours: direction + referee", short: "Referee", color: "var(--s-referee)" },
] as const;
const MON_LABEL: Record<string, string> = {
  none: "No monitor",
  ...Object.fromEntries(MONITORS.map((m) => [m.id, m.label])),
};

const pct = (x: number) => Math.round(x * 100) + "%";
const signed = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(2) + "%";
const when = (id: string) => {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/.exec(id);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : id;
};
const who = (run: Run) =>
  run.proposer === "claude" ? `Claude (${run.model ?? "model"})` : "Random mutation";
const against = (t: string) => (t === "all" ? "all three monitors" : MON_LABEL[t]);

/** For every generation, the best strategy among everything tried up to and including it. */
function bestSoFar(gens: Gen[]): Gen[] {
  const last = Math.max(...gens.map((g) => g.gen));
  const out: Gen[] = [];
  let best: Gen | null = null;
  for (let i = 0; i <= last; i++) {
    for (const g of gens) if (g.gen === i && (!best || g.score > best.score)) best = g;
    out.push(best as Gen);
  }
  return out;
}

function niceTicks(max: number): number[] {
  const step = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5].find((s) => s >= max / 4) ?? 10;
  const top = Math.max(step, Math.ceil(max / step - 1e-9) * step);
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(2));
}

const H = 250;
const PT = 14;
const PB = 30;
const PL = 44;

/** The chart draws at its container's real pixel width, so text stays readable on a phone. */
function useWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

type Frame = { W: number; padR: number; last: number; x: (g: number) => number; y: (v: number) => number };

function frame(W: number, last: number, padR: number, yTop: number): Frame {
  const x = (g: number) => PL + (g * (W - PL - padR)) / Math.max(1, last);
  const y = (v: number) => H - PB - (v / yTop) * (H - PT - PB);
  return { W, padR, last, x, y };
}

function stepPath(xs: number[], ys: number[]) {
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 1; i < xs.length; i++) d += ` H${xs[i]} V${ys[i]}`;
  return d;
}

function Axes({ f, ticks, fmt }: { f: Frame; ticks: number[]; fmt: (v: number) => string }) {
  const perGen = (f.W - PL - f.padR) / Math.max(1, f.last);
  const every = Math.max(1, Math.ceil(30 / perGen));
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PL} x2={f.W - f.padR} y1={f.y(t)} y2={f.y(t)} stroke="var(--grid)" />
          <text x={PL - 8} y={f.y(t) + 4} fill="var(--graphite)" fontSize={11} textAnchor="end">
            {fmt(t)}
          </text>
        </g>
      ))}
      {Array.from({ length: f.last + 1 }, (_, g) =>
        g % every === 0 || g === f.last ? (
          <text key={g} x={f.x(g)} y={H - PB + 16} fill="var(--graphite)" fontSize={11} textAnchor="middle">
            {g === 0 ? "start" : g}
          </text>
        ) : null,
      )}
      <text x={f.W - f.padR} y={H - 1} fill="var(--graphite)" fontSize={11} textAnchor="end">
        generation
      </text>
    </g>
  );
}

/** Transparent column per generation: hover, focus or tap shows that generation's readout. */
function HitColumns({ f, onPick, label }: {
  f: Frame;
  onPick: (g: number | null) => void;
  label: (g: number) => string;
}) {
  const half = (f.W - PL - f.padR) / Math.max(1, f.last) / 2;
  return (
    <g>
      {Array.from({ length: f.last + 1 }, (_, g) => (
        <rect
          key={g}
          x={f.x(g) - half}
          y={PT}
          width={half * 2}
          height={H - PT - PB}
          fill="transparent"
          tabIndex={0}
          aria-label={label(g)}
          onMouseEnter={() => onPick(g)}
          onFocus={() => onPick(g)}
          onClick={() => onPick(g)}
          onMouseLeave={() => onPick(null)}
          onBlur={() => onPick(null)}
        />
      ))}
    </g>
  );
}

function Tip({ f, g, children }: { f: Frame; g: number; children: ReactNode }) {
  const at = f.x(g);
  const right = at / f.W > 0.55;
  return (
    <div
      className="tip"
      style={{
        left: at,
        transform: right ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
      }}
    >
      {children}
    </div>
  );
}

function ScoreChart({ run }: { run: Run }) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const best = bestSoFar(run.gens);
  const last = best.length - 1;
  const ticks = niceTicks(Math.max(...run.gens.map((g) => g.score)) * 1.08);
  const f = frame(W, last, W < 520 ? 74 : 96, ticks[ticks.length - 1]);
  const { x, y } = f;
  const seeds = run.gens.filter((g) => g.gen === 0);
  const spread = Math.min(7, (W - PL - f.padR) / Math.max(1, last) / seeds.length);
  const dx = (g: Gen) => (g.gen === 0 ? (seeds.indexOf(g) - (seeds.length - 1) / 2) * spread : 0);
  const improved = (g: Gen) => best[g.gen] === g && (g.gen === 0 || best[g.gen - 1] !== g);
  const end = best[last];
  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        aria-label={`Rogue score by generation, from ${best[0].score.toFixed(2)} at the start to ${end.score.toFixed(2)}`}>
        <Axes f={f} ticks={ticks} fmt={(v) => v.toFixed(2)} />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="var(--ink)" strokeOpacity={0.35} />}
        <path d={stepPath(best.map((_, g) => x(g)), best.map((b) => y(b.score)))} fill="none"
          stroke="var(--red)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {run.gens.map((g) => (
          <circle key={g.gen + g.name} cx={x(g.gen) + dx(g)} cy={y(g.score)} r={improved(g) ? 5 : 4}
            fill={improved(g) ? "var(--red)" : "var(--graphite)"} fillOpacity={improved(g) ? 1 : 0.5}
            stroke="var(--paper)" strokeWidth={2} />
        ))}
        <text x={x(last) + 10} y={y(end.score) + 4} fill="var(--ink)" fontSize={12} fontWeight={700}>
          best {end.score.toFixed(2)}
        </text>
        <HitColumns f={f} onPick={setHover}
          label={(g) => `Generation ${g}: best so far ${best[g].name}, score ${best[g].score.toFixed(2)}`} />
      </svg>
      {hover !== null && (
        <Tip f={f} g={hover}>
          <div className="th">{hover === 0 ? "Start: the six scripted rogues" : `Generation ${hover}`}</div>
          {run.gens
            .filter((g) => g.gen === hover)
            .sort((a, b) => b.score - a.score)
            .map((g) => (
              <div key={g.name} className="row">
                <b>{g.score.toFixed(2)}</b> {g.name}
                {improved(g) && hover > 0 ? <em> new best</em> : null}
              </div>
            ))}
          <div className="row muted">
            best so far: <b>{best[hover].score.toFixed(2)}</b> {best[hover].name}
          </div>
        </Tip>
      )}
    </div>
  );
}

function CatchChart({ run }: { run: Run }) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const best = bestSoFar(run.gens);
  const last = best.length - 1;
  const f = frame(W, last, W < 520 ? 128 : 168, 1);
  const { x, y } = f;
  const xs = best.map((_, g) => x(g));
  // End labels: keep them at least 15px apart, joined to their line by a short leader.
  const ends = MONITORS.map((m) => ({ m, v: best[last].metrics[m.id].catch, ly: y(best[last].metrics[m.id].catch) }))
    .sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < ends.length; i++) ends[i].ly = Math.max(ends[i].ly, ends[i - 1].ly + 15);
  const overflow = ends[ends.length - 1].ly - (H - PB);
  if (overflow > 0) ends.forEach((e) => (e.ly -= overflow));
  return (
    <div className="chart" ref={ref}>
      <div className="keys">
        {MONITORS.map((m) => (
          <span key={m.id}>
            <i style={{ background: m.color }} />
            {m.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        aria-label="Share of games in which each monitor catches the best rogue so far, by generation">
        <Axes f={f} ticks={[0, 0.25, 0.5, 0.75, 1]} fmt={pct} />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="var(--ink)" strokeOpacity={0.35} />}
        {MONITORS.map((m) => (
          <path key={m.id} d={stepPath(xs, best.map((b) => y(b.metrics[m.id].catch)))} fill="none"
            stroke={m.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {ends.map(({ m, v, ly }) => (
          <g key={m.id}>
            <circle cx={x(last)} cy={y(v)} r={4} fill={m.color} stroke="var(--paper)" strokeWidth={2} />
            <polyline points={`${x(last) + 6},${y(v)} ${x(last) + 14},${ly} ${x(last) + 20},${ly}`} fill="none" stroke="var(--rule)" />
            <line x1={x(last) + 24} x2={x(last) + 38} y1={ly} y2={ly} stroke={m.color} strokeWidth={2} />
            <text x={x(last) + 44} y={ly + 4} fill="var(--ink)" fontSize={12}>
              <tspan fontWeight={700}>{pct(v)}</tspan> {m.short}
            </text>
          </g>
        ))}
        <HitColumns f={f} onPick={setHover}
          label={(g) => `Generation ${g}: ` + MONITORS.map((m) => `${m.short} ${pct(best[g].metrics[m.id].catch)}`).join(", ")} />
      </svg>
      {hover !== null && (
        <Tip f={f} g={hover}>
          <div className="th">
            {hover === 0 ? "Start" : `Generation ${hover}`}: {best[hover].name}
          </div>
          {MONITORS.map((m) => (
            <div key={m.id} className="row">
              <span className="k" style={{ background: m.color }} />
              <b>{pct(best[hover].metrics[m.id].catch)}</b> {m.short}
            </div>
          ))}
        </Tip>
      )}
    </div>
  );
}

const ACT: Record<string, string> = {
  "player:honest": "honest answer",
  "player:strike up": "pushed its answer up",
  "player:strike down": "pushed its answer down (camouflage)",
  "player:decoy low": "answered low on purpose (decoy)",
  "referee:honest": "honest re-check",
  "referee:back_high": "backed the higher answer",
  "referee:push": "pushed the re-check up",
};

function ExampleGame({ ex }: { ex: Example }) {
  const t = (a: number) => `A${a}${a === ex.rogue ? " (rogue)" : ""}`;
  const acts: Record<number, string[]> = {};
  for (const e of ex.rogue_log) (acts[e.r] ??= []).push(ACT[`${e.role}:${e.act}`] ?? e.act);
  const removed = ex.rounds.filter((o) => o.q !== null);
  return (
    <>
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th className="l">Round</th>
              <th className="l">Item</th>
              <th className="l">The two answers</th>
              <th className="l">Referee re-check</th>
              <th className="l">What the rogue did</th>
              <th className="l">Monitor</th>
            </tr>
          </thead>
          <tbody>
            {ex.rounds.map((o) => (
              <tr key={o.r} className={acts[o.r]?.some((s) => !s.startsWith("honest")) ? "cheat" : ""}>
                <td className="l">{o.r}</td>
                <td className="l">{o.v.toFixed(2)}</td>
                <td className="l">
                  {t(o.a)} {o.ans_a.toFixed(2)} vs {t(o.b)} {o.ans_b.toFixed(2)}
                </td>
                <td className="l">
                  {o.ref !== null && o.ref_ans !== null
                    ? `${t(o.ref)} says ${o.ref_ans.toFixed(2)}, odd one out ${t(o.odd as number)}`
                    : ""}
                </td>
                <td className="l">{acts[o.r]?.join("; ") ?? ""}</td>
                <td className="l">{o.q !== null ? `removes ${t(o.q)}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="verdict">
        {ex.caught ? <span className="good">Rogue removed in round {ex.round}</span> : <span className="bad">Rogue never removed</span>}
        , {removed.filter((o) => o.q !== ex.rogue).length} honest agent(s) removed, books pushed {signed(ex.signed_err * 100)}
      </div>
    </>
  );
}

export default function Evolution() {
  const [ri, setRi] = useState(Math.max(0, D.runs.length - 1));
  const run = D.runs[ri];

  return (
    <main className="books evo">
      <div className="wrap">
        <nav className="nav">
          <Link href="/">Summary dashboard</Link>
          <Link href="/replay">Replay games</Link>
        </nav>
        <h1>Evolving the Rogue</h1>
        <p className="sub">
          Red-teaming our own monitor, inside the simulation. Each run starts from the six
          scripted rogues; every generation proposes one new strategy (a set of knobs: when to
          strike, how hard, whom to frame, what to say as referee) and scores it against all
          three monitors over the same seeded games. Rogue score = how far it pushes the books
          up, times the share of games it is never caught.
        </p>

        {!run ? (
          <div className="card">
            <h3>No runs recorded yet</h3>
            <pre className="cmd">{`python redteam.py evolve --proposer local --iters 12
python rogue-agent-demo/scripts/export_evolution.py`}</pre>
          </div>
        ) : (
          <RunView key={run.id} run={run} runs={D.runs} ri={ri} setRi={setRi} />
        )}
      </div>
    </main>
  );
}

function RunView({ run, runs, ri, setRi }: { run: Run; runs: Run[]; ri: number; setRi: (i: number) => void }) {
  const best = run.gens.find((g) => g.gen === run.best_gen && g.name === run.best_name) as Gen;
  const seeds = run.gens.filter((g) => g.gen === 0);
  const start = seeds.reduce((a, b) => (b.score > a.score ? b : a));
  const tm = run.target === "all" ? "referee" : run.target;
  const final = run.holdout?.metrics ?? best.metrics;
  const kpis: [string, string][] = [
    [`${start.score.toFixed(2)} → ${best.score.toFixed(2)}`,
      `rogue score: best starting rogue (${start.name}) to the best evolved one (${best.name}, generation ${best.gen})`],
    [`${pct(start.metrics.referee.catch)} → ${pct(best.metrics.referee.catch)}`,
      `how often our direction + referee monitor catches it (baseline: ${pct(start.metrics.baseline.catch)} → ${pct(best.metrics.baseline.catch)})`],
    [signed(best.metrics[tm].push_pct),
      `average push on the books against ${MON_LABEL[tm].toLowerCase()} (start: ${signed(start.metrics[tm].push_pct)})`],
    [run.holdout ? run.holdout.score.toFixed(2) : "–",
      `score of the winner on ${run.games} fresh games it was never tuned on`],
  ];
  return (
    <>
      <div className="tabs" role="group" aria-label="Run">
        {runs.map((r, i) => (
          <button key={r.id} type="button" className={"tab" + (i === ri ? " on" : "")} aria-pressed={i === ri} onClick={() => setRi(i)}>
            {who(r)} · vs {r.target === "all" ? "all monitors" : MON_LABEL[r.target]} · {when(r.id)}
          </button>
        ))}
      </div>
      <p className="desc">
        {who(run)} proposed {run.iters} strategies, each scored on {run.games} mock games per monitor; honest
        agents wrong {pct(run.honest_err)} of the time. Tuned against {against(run.target)}.
        {run.guidance ? ` Guidance: “${run.guidance}”.` : ""}
      </p>
      <div className="kpis">
        {kpis.map(([n, l]) => (
          <div className="kpi" key={l}>
            <div className="n">{n}</div>
            <div className="l">{l}</div>
          </div>
        ))}
      </div>

      <div className="two">
        <div className="card">
          <h3>Rogue score by generation</h3>
          <div className="meta">
            <span className="dot red" /> new best <span className="dot gray" /> other strategies tried; the red line is
            the best so far. Hover or tap a generation for its strategies.
          </div>
          <ScoreChart run={run} />
        </div>
        <div className="card">
          <h3>How often each monitor catches the best rogue so far</h3>
          <div className="meta">
            Option C asks exactly this: as the rogue improves, which monitors still catch it?
          </div>
          <CatchChart run={run} />
        </div>
      </div>

      <h2>The best evolved rogue: {best.name}</h2>
      <p className="desc">{best.idea}</p>
      <div className="two">
        <div className="card table-card">
          <table className="knobs">
            <thead>
              <tr>
                <th>Knob</th>
                <th>Value</th>
                <th>Default</th>
                <th className="l">What it does</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(D.knobs).map(([k, kn]) => {
                const v = best.params[k];
                const changed = v !== kn.default;
                return (
                  <tr key={k} className={changed ? "changed" : ""}>
                    <td>{k}</td>
                    <td>{String(v)}</td>
                    <td>{String(kn.default)}</td>
                    <td className="l">{kn.meaning}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <div className="card table-card">
            <table>
              <thead>
                <tr>
                  <th>Monitor</th>
                  <th>Caught</th>
                  <th>Round caught</th>
                  <th>Honest removed</th>
                  <th>Books off</th>
                  <th>Pushed up</th>
                </tr>
              </thead>
              <tbody>
                {["none", ...MONITORS.map((m) => m.id)].map((m) => {
                  const s = final[m];
                  const none = m === "none";
                  return (
                    <tr key={m} className={m === "referee" ? "ours" : ""}>
                      <td>{MON_LABEL[m]}</td>
                      <td>{none ? "" : pct(s.catch)}</td>
                      <td>{s.median_round ?? ""}</td>
                      <td>{none ? "" : s.false_q.toFixed(2)}</td>
                      <td>{s.ledger_err_pct.toFixed(2)}%</td>
                      <td>{signed(s.push_pct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note under">
            {run.holdout ? `On ${run.games} fresh games it was never tuned on.` : `On the ${run.games} games of the search.`}{" "}
            Highlighted knobs differ from the defaults.
          </p>
        </div>
      </div>

      <h2>One game it got away with</h2>
      <p className="desc">
        Fresh seed {run.example.seed}, against {MON_LABEL[run.example.monitor].toLowerCase()}: the game among 200 where it
        stayed in and pushed the books most. The monitor sees the answers and the referee; the &ldquo;what the rogue
        did&rdquo; column is private to the rogue. Rounds marked red are the ones where it cheated.
      </p>
      <ExampleGame ex={run.example} />

      <h2>Every strategy tried</h2>
      <p className="note">Same seeded games for every row, so the differences are real. The table holds every value in the charts.</p>
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Gen</th>
              <th>Strategy</th>
              <th>Proposed by</th>
              <th>Score</th>
              <th>Caught: baseline</th>
              <th>direction</th>
              <th>referee</th>
              <th>Pushed up ({MONITORS.find((m) => m.id === tm)?.short.toLowerCase()})</th>
              <th>Honest removed (referee)</th>
            </tr>
          </thead>
          <tbody>
            {run.gens.map((g) => (
              <tr key={g.gen + g.name} className={g === best ? "ours" : ""}>
                <td>{g.gen === 0 ? "start" : g.gen}</td>
                <td>
                  {g.name}
                  {g.idea ? <span className="idea">{g.idea}</span> : null}
                </td>
                <td>{g.proposer}</td>
                <td>{g.score.toFixed(3)}</td>
                <td>{pct(g.metrics.baseline.catch)}</td>
                <td>{pct(g.metrics.direction.catch)}</td>
                <td>{pct(g.metrics.referee.catch)}</td>
                <td>{signed(g.metrics[tm].push_pct)}</td>
                <td>{g.metrics.referee.false_q.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Run your own</h2>
      <pre className="cmd">{`python redteam.py evolve --proposer local --iters 12   # random mutation, no API key
python redteam.py evolve --iters 8                     # Claude proposes (needs ANTHROPIC_API_KEY)
python rogue-agent-demo/scripts/export_evolution.py    # then rebuild this page's data`}</pre>
    </>
  );
}
