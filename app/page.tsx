"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { questions, type Question } from "@/data/questions-1";

// ── Constants ────────────────────────────────────────────────────────────────
const TOTAL_Q       = 20;
const QUESTION_TIME = 50;
const HINT_AT       = 2;  // show hint when ≤15 s remain (after 25 s)
const WARN_AT       = 15;  // red warning when ≤10 s remain
const REST_TIME     = 3;

// ── Types ────────────────────────────────────────────────────────────────────
type Phase = "start" | "question" | "rest" | "result";

interface AnswerRecord {
  answered: boolean;
  correct:  boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// Must be defined BEFORE pickRandom so TS can see it
function shuffleArray<T>(arr: ReadonlyArray<T>): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function pickRandom(arr: Question[], n: number): Question[] {
  return shuffleArray(arr)
    .slice(0, n)
    .map((q) => ({
      ...q,
      toSelect: shuffleArray(q.toSelect) as Question["toSelect"],
    }));
}

const LETTER = ["A", "B", "C", "D", "E"] as const;

// ── Component ────────────────────────────────────────────────────────────────
export default function Page() {
  const [phase,     setPhase]     = useState<Phase>("start");
  const [roundQs,   setRoundQs]   = useState<Question[]>([]);
  const [qIndex,    setQIndex]    = useState(0);
  const [timeLeft,  setTimeLeft]  = useState(QUESTION_TIME);
  const [restLeft,  setRestLeft]  = useState(REST_TIME);
  const [selected,  setSelected]  = useState<number | null>(null);
  const [answers,   setAnswers]   = useState<AnswerRecord[]>([]);
  const [showHint,  setShowHint]  = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentQ: Question | undefined = roundQs[qIndex];

  // ── Start a new round ───────────────────────────────────────────────────────
  function startRound() {
    setRoundQs(pickRandom(questions, TOTAL_Q));
    setQIndex(0);
    setAnswers([]);
    setSelected(null);
    setShowHint(false);
    setTimeLeft(QUESTION_TIME);
    setPhase("question");
  }

  // ── Move to next question or results ────────────────────────────────────────
  const advance = useCallback(
    (ans: number | null) => {
      const correct =
        ans !== null && currentQ !== undefined && ans === currentQ.answer;
      const newAnswers: AnswerRecord[] = [
        ...answers,
        { answered: ans !== null, correct },
      ];
      setAnswers(newAnswers);

      if (qIndex + 1 >= TOTAL_Q) {
        setPhase("result");
      } else {
        setPhase("rest");
        setRestLeft(REST_TIME);
      }
    },
    [answers, currentQ, qIndex]
  );

  // ── Question countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "question") return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          advance(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qIndex]);

  // ── Hint visibility ─────────────────────────────────────────────────────────
  useEffect(() => {
    setShowHint(phase === "question" && timeLeft <= HINT_AT);
  }, [timeLeft, phase]);

  // ── Rest countdown ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "rest") return;

    const timeout = setTimeout(() => {
      setQIndex((i) => i + 1);
      setPhase("question");
      setTimeLeft(QUESTION_TIME);
      setSelected(null);
      setShowHint(false);
    }, REST_TIME * 1000);

    const interval = setInterval(() => {
      setRestLeft((r) => Math.max(0, r - 1));
    }, 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [phase]);

  // ── Handle option click ─────────────────────────────────────────────────────
  function handleSelect(val: number) {
    if (selected !== null) return;
    setSelected(val);
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(() => advance(val), 900);
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const isWarning  = phase === "question" && timeLeft <= WARN_AT;
  const pct        = (timeLeft / QUESTION_TIME) * 100;
  const correct    = answers.filter((a) => a.correct).length;
  const wrong      = answers.filter((a) => a.answered && !a.correct).length;
  const unanswered = answers.filter((a) => !a.answered).length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Bebas+Neue&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #09090f;
          color: #e8e8f0;
          font-family: 'Space Mono', monospace;
          min-height: 100vh;
          overflow-x: hidden;
        }

        .wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background:
            radial-gradient(ellipse at 20% 50%, #0d1a2e 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, #1a0d2e 0%, transparent 50%),
            #09090f;
        }

        .noise {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          opacity: 0.4;
        }

        .card {
          position: relative; z-index: 1;
          width: 100%; max-width: 680px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 2px;
          padding: 48px 40px;
          backdrop-filter: blur(12px);
          box-shadow: 0 0 80px rgba(0,120,255,0.05), inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .logo {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 13px;
          letter-spacing: 0.3em;
          color: rgba(255,255,255,0.2);
          margin-bottom: 48px;
        }

        /* ── START ── */
        .start-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(48px, 8vw, 80px);
          line-height: 0.9;
          color: #ffffff;
          margin-bottom: 8px;
          letter-spacing: 0.02em;
        }
        .start-accent { color: #1e90ff; }
        .start-sub {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.2em;
          margin-bottom: 40px;
          margin-top: 16px;
        }
        .start-meta {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 40px;
        }
        .meta-cell { background: #09090f; padding: 16px; text-align: center; }
        .meta-num  { font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: #1e90ff; display: block; }
        .meta-label { font-size: 10px; color: rgba(255,255,255,0.3); letter-spacing: 0.15em; margin-top: 2px; }
        .eqs { font-size: 11px; color: rgba(255,255,255,0.15); line-height: 2; margin-bottom: 40px; letter-spacing: 0.05em; }

        /* ── BUTTON ── */
        .btn {
          display: inline-flex; align-items: center; gap: 12px;
          background: #1e90ff; color: #000;
          font-family: 'Space Mono', monospace;
          font-weight: 700; font-size: 13px; letter-spacing: 0.15em;
          padding: 16px 36px; border: none; cursor: pointer;
          text-transform: uppercase; position: relative; overflow: hidden;
          transition: transform 0.1s, box-shadow 0.2s;
        }
        .btn::before {
          content: ''; position: absolute; inset: 0;
          background: rgba(255,255,255,0.15);
          transform: translateX(-100%); transition: transform 0.3s ease;
        }
        .btn:hover::before { transform: translateX(0); }
        .btn:hover { box-shadow: 0 0 32px rgba(30,144,255,0.5); transform: translateY(-1px); }
        .btn:active { transform: translateY(0); }

        /* ── TIMER ── */
        .timer-bar-wrap { background: rgba(255,255,255,0.05); height: 3px; margin-bottom: 32px; overflow: hidden; }
        .timer-bar { height: 100%; transition: width 1s linear, background 0.5s; }
        .timer-bar.ok   { background: #1e90ff; }
        .timer-bar.warn { background: #ff4444; animation: pulse-bar 0.5s ease-in-out infinite alternate; }
        @keyframes pulse-bar { from { opacity: 1; } to { opacity: 0.4; } }

        .timer-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .timer-num { font-family: 'Bebas Neue', sans-serif; font-size: 28px; transition: color 0.3s; }
        .timer-num.ok   { color: #1e90ff; }
        .timer-num.warn { color: #ff4444; animation: shake 0.3s ease-in-out infinite; }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          25%     { transform: translateX(-2px); }
          75%     { transform: translateX(2px); }
        }
        .progress-txt { font-size: 10px; color: rgba(255,255,255,0.25); letter-spacing: 0.2em; }

        /* ── QUESTION ── */
        .q-num  { font-family: 'Bebas Neue', sans-serif; font-size: 13px; color: #1e90ff; letter-spacing: 0.3em; margin-bottom: 20px; }
        .q-text { font-size: 16px; line-height: 1.7; color: #e8e8f0; margin-bottom: 32px; min-height: 80px; }

        .hint-box {
          border-left: 2px solid #1e90ff; padding: 10px 16px;
          background: rgba(30,144,255,0.05); margin-bottom: 28px;
          font-size: 12px; color: rgba(255,255,255,0.5); letter-spacing: 0.1em;
          animation: fade-in 0.4s ease;
        }
        @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

        /* ── OPTIONS ── */
        .options { display: flex; flex-direction: column; gap: 10px; }
        .opt {
          display: flex; align-items: center; gap: 16px;
          padding: 14px 18px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, transform 0.1s;
          font-family: 'Space Mono', monospace; font-size: 14px;
          color: #e8e8f0; text-align: left; position: relative; overflow: hidden;
        }
        .opt::before {
          content: ''; position: absolute; inset: 0;
          background: rgba(30,144,255,0.06);
          transform: scaleX(0); transform-origin: left; transition: transform 0.2s ease;
        }
        .opt:hover:not(.disabled)::before { transform: scaleX(1); }
        .opt:hover:not(.disabled) { border-color: rgba(30,144,255,0.4); transform: translateX(4px); }
        .opt.disabled { cursor: default; }
        .opt.sel-correct { border-color: #00e676; background: rgba(0,230,118,0.05); }
        .opt.sel-correct::before { display: none; }
        .opt.sel-wrong   { border-color: #ff4444; background: rgba(255,68,68,0.05); }
        .opt.sel-wrong::before   { display: none; }
        .opt.reveal-correct { border-color: rgba(0,230,118,0.4); }

        .opt-letter { font-family: 'Bebas Neue', sans-serif; font-size: 16px; color: rgba(255,255,255,0.25); min-width: 20px; }
        .opt-val    { flex: 1; }
        .opt-unit   { font-size: 11px; color: rgba(255,255,255,0.3); }

        /* ── REST ── */
        .rest-wrap  { text-align: center; padding: 40px 0; }
        .rest-label { font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 0.3em; color: rgba(255,255,255,0.2); margin-bottom: 12px; }
        .rest-num   { font-family: 'Bebas Neue', sans-serif; font-size: 96px; color: #1e90ff; line-height: 1; animation: pulse-rest 1s ease-in-out infinite alternate; }
        @keyframes pulse-rest { from { opacity: 0.6; } to { opacity: 1; } }
        .rest-sub   { font-size: 11px; color: rgba(255,255,255,0.2); letter-spacing: 0.2em; margin-top: 16px; }

        /* ── RESULT ── */
        .result-title { font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 0.3em; color: rgba(255,255,255,0.25); margin-bottom: 32px; }
        .score-big    { font-family: 'Bebas Neue', sans-serif; font-size: clamp(72px, 14vw, 120px); line-height: 0.9; color: #fff; margin-bottom: 8px; }
        .score-big span { color: #1e90ff; }
        .score-sub    { font-size: 11px; color: rgba(255,255,255,0.25); letter-spacing: 0.2em; margin-bottom: 40px; }

        .result-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 40px;
        }
        .r-cell  { background: #09090f; padding: 20px 16px; text-align: center; }
        .r-num   { font-family: 'Bebas Neue', sans-serif; font-size: 40px; display: block; }
        .r-num.green { color: #00e676; }
        .r-num.red   { color: #ff4444; }
        .r-num.gray  { color: rgba(255,255,255,0.25); }
        .r-label { font-size: 10px; color: rgba(255,255,255,0.25); letter-spacing: 0.15em; margin-top: 4px; }

        .grade-bar  { height: 4px; background: rgba(255,255,255,0.05); margin-bottom: 40px; overflow: hidden; }
        .grade-fill { height: 100%; background: linear-gradient(90deg, #1e90ff, #00e676); transition: width 1.2s cubic-bezier(0.16, 1, 0.3, 1); }
        .grade-msg  { font-size: 12px; color: rgba(255,255,255,0.3); letter-spacing: 0.1em; margin-bottom: 32px; line-height: 1.8; }

        @media (max-width: 520px) {
          .card { padding: 32px 20px; }
          .opt  { padding: 12px 14px; font-size: 13px; }
        }
      `}</style>

      <div className="noise" />
      <div className="wrap">
        <div className="card">
          <div className="logo">EQUATIONS OF MOTION ◆ PHYSICS MCQ</div>

          {/* ══ START ══════════════════════════════════════════════════════════ */}
          {phase === "start" && (
            <>
              <div className="start-title">
                MOTION<br />
                <span className="start-accent">QUIZ</span>
              </div>
              <div className="start-sub">KINEMATICS · SUVAT EQUATIONS · MCQ CHALLENGE</div>
              <div className="start-meta">
                <div className="meta-cell">
                  <span className="meta-num">20</span>
                  <div className="meta-label">QUESTIONS</div>
                </div>
                <div className="meta-cell">
                  <span className="meta-num">50</span>
                  <div className="meta-label">SEC / QUESTION</div>
                </div>
                <div className="meta-cell">
                  <span className="meta-num">{questions.length}</span>
                  <div className="meta-label">QUESTION BANK</div>
                </div>
              </div>
              <div className="eqs">
                v = u + at &nbsp;·&nbsp; s = ut + ½at² &nbsp;·&nbsp; v² = u² + 2as &nbsp;·&nbsp; s = ((u+v)/2)·t
              </div>
              <button className="btn" onClick={startRound}>START ROUND →</button>
            </>
          )}

          {/* ══ QUESTION ════════════════════════════════════════════════════════ */}
          {phase === "question" && currentQ && (
            <>
              <div className="timer-row">
                <div className="progress-txt">
                  Q {qIndex + 1}{" "}
                  <span style={{ color: "rgba(255,255,255,0.15)" }}>/ {TOTAL_Q}</span>
                </div>
                <div className={`timer-num ${isWarning ? "warn" : "ok"}`}>{timeLeft}s</div>
              </div>

              <div className="timer-bar-wrap">
                <div
                  className={`timer-bar ${isWarning ? "warn" : "ok"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="q-num">QUESTION {String(qIndex + 1).padStart(2, "0")}</div>
              <div className="q-text">{currentQ.question}</div>

              {showHint && (
                <div className="hint-box">
                  💡 HINT — use: <strong>{currentQ.hint}</strong>
                </div>
              )}

              <div className="options">
                {currentQ.toSelect.map((val, i) => {
                  let cls = "opt";
                  if (selected !== null) {
                    cls += " disabled";
                    if (val === selected) {
                      cls += val === currentQ.answer ? " sel-correct" : " sel-wrong";
                    } else if (val === currentQ.answer) {
                      cls += " reveal-correct";
                    }
                  }
                  return (
                    <button key={val} className={cls} onClick={() => handleSelect(val)}>
                      <span className="opt-letter">{LETTER[i]}</span>
                      <span className="opt-val">{val}</span>
                      <span className="opt-unit">m/s or m or s</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ══ REST ════════════════════════════════════════════════════════════ */}
          {phase === "rest" && (
            <div className="rest-wrap">
              <div className="rest-label">NEXT QUESTION IN</div>
              <div className="rest-num">{restLeft}</div>
              <div className="rest-sub">TAKE A BREATH · STAY FOCUSED</div>
            </div>
          )}

          {/* ══ RESULT ══════════════════════════════════════════════════════════ */}
          {phase === "result" && (
            <>
              <div className="result-title">ROUND COMPLETE</div>
              <div className="score-big">
                {correct}<span>/{TOTAL_Q}</span>
              </div>
              <div className="score-sub">FINAL SCORE</div>

              <div className="grade-bar">
                <div className="grade-fill" style={{ width: `${(correct / TOTAL_Q) * 100}%` }} />
              </div>

              <div className="result-grid">
                <div className="r-cell">
                  <span className="r-num green">{correct}</span>
                  <div className="r-label">CORRECT</div>
                </div>
                <div className="r-cell">
                  <span className="r-num red">{wrong}</span>
                  <div className="r-label">WRONG</div>
                </div>
                <div className="r-cell">
                  <span className="r-num gray">{unanswered}</span>
                  <div className="r-label">UNANSWERED</div>
                </div>
              </div>

              <div className="grade-msg">
                {correct === 25 && "PERFECT SCORE. Pure kinematics mastery."}
                {correct >= 20 && correct < 25 && "EXCELLENT. Strong command of SUVAT equations."}
                {correct >= 15 && correct < 20 && "GOOD. A bit more practice and you'll ace it."}
                {correct >= 10 && correct < 15 && "FAIR. Review the equations and try again."}
                {correct < 10  && "KEEP GOING. Every attempt builds understanding."}
              </div>

              <button className="btn" onClick={startRound}>PLAY AGAIN →</button>
            </>
          )}

        </div>
      </div>
    </>
  );
}