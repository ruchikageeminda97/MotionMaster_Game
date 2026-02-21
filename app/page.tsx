"use client";

import { useState, useEffect, useRef } from "react";
import { questions, imgquestions, type Question, type ImgQuestion } from "@/data/questions-1";

// ── Constants ─────────────────────────────────────────────────────────────────
const TOTAL_PHY      = 20;
const PHY_Q_TIME     = 40;
const HINT_AT        = 5;
const WARN_AT        = 10;
const REST_TIME      = 3;
const MEM_Q_TIME     = 40;
const MEMORIZE_SECS  = 10;
const LETTER         = ["A", "B", "C", "D", "E"] as const;

// ── Types ─────────────────────────────────────────────────────────────────────
type AppPhase = "start" | "memorize" | "quiz" | "result";

interface PhyAnswer { answered: boolean; correct: boolean; }
interface MemAnswer { answered: boolean; correct: boolean; given: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffleArray<T>(arr: ReadonlyArray<T>): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function pickRandom(arr: Question[], n: number): Question[] {
  return shuffleArray(arr).slice(0, n).map(q => ({
    ...q,
    toSelect: shuffleArray(q.toSelect) as Question["toSelect"],
  }));
}

function checkMem(given: string, answer: string): boolean {
  return given.trim().toLowerCase() === answer.trim().toLowerCase();
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Page() {
  // App-level
  const [appPhase,      setAppPhase]      = useState<AppPhase>("start");
  const [memorizeLeft,  setMemorizeLeft]  = useState(MEMORIZE_SECS);
  const [selectedImg,   setSelectedImg]   = useState<ImgQuestion | null>(null);

  // Physics
  const [phyQs,       setPhyQs]       = useState<Question[]>([]);
  const [phyIdx,      setPhyIdx]       = useState(0);
  const [phyTime,     setPhyTime]      = useState(PHY_Q_TIME);
  const [phyRestLeft, setPhyRestLeft]  = useState(REST_TIME);
  const [phyPhase,    setPhyPhase]     = useState<"question"|"rest"|"done">("question");
  const [phySelected, setPhySelected]  = useState<number | null>(null);
  const [phyAnswers,  setPhyAnswers]   = useState<PhyAnswer[]>([]);
  const [phyShowHint, setPhyShowHint]  = useState(false);

  // Memory
  const [memQs,        setMemQs]        = useState<{ question: string; answer: string }[]>([]);
  const [memIdx,       setMemIdx]       = useState(0);
  const [memTime,      setMemTime]      = useState(MEM_Q_TIME);
  const [memInput,     setMemInput]     = useState("");
  const [memAnswers,   setMemAnswers]   = useState<MemAnswer[]>([]);
  const [memPhase,     setMemPhase]     = useState<"question"|"done">("question");
  const [memSubmitted, setMemSubmitted] = useState(false);
  const [memFeedback,  setMemFeedback]  = useState<"correct"|"wrong"|null>(null);

  // Refs
  const phyTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const memTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedImgRef = useRef<ImgQuestion | null>(null);
  const advancePhyRef  = useRef<(sel: number | null) => void>(() => {});
  const advanceMemRef  = useRef<(inp: string, timedOut?: boolean) => void>(() => {});

  // Keep advance functions fresh every render (avoids stale closure in timer)
  advancePhyRef.current = (selected: number | null) => {
    if (phyTimerRef.current) clearInterval(phyTimerRef.current);
    const currentQ = phyQs[phyIdx];
    const correct  = selected !== null && currentQ !== undefined && selected === currentQ.answer;
    const newAns   = [...phyAnswers, { answered: selected !== null, correct }];
    setPhyAnswers(newAns);
    setPhySelected(null);
    setPhyShowHint(false);
    if (phyIdx + 1 >= TOTAL_PHY) {
      setPhyPhase("done");
    } else {
      setPhyPhase("rest");
      setPhyRestLeft(REST_TIME);
    }
  };

  advanceMemRef.current = (inp: string, timedOut = false) => {
    if (memTimerRef.current) clearInterval(memTimerRef.current);
    const currentQ = memQs[memIdx];
    const answered = !timedOut && inp.trim() !== "";
    const correct  = answered && checkMem(inp, currentQ.answer);
    const fb: "correct" | "wrong" = correct ? "correct" : "wrong";
    if (!timedOut) setMemFeedback(fb);

    setTimeout(() => {
      const newAns = [...memAnswers, { answered, correct, given: inp.trim() }];
      setMemAnswers(newAns);
      setMemInput("");
      setMemSubmitted(false);
      setMemFeedback(null);
      if (memIdx + 1 >= memQs.length) {
        setMemPhase("done");
      } else {
        setMemIdx(i => i + 1);
        setMemTime(MEM_Q_TIME);
      }
    }, timedOut ? 0 : 700);
  };

  // ── Start ────────────────────────────────────────────────────────────────────
  function startRound() {
    const img = shuffleArray(imgquestions)[0];
    selectedImgRef.current = img;
    setSelectedImg(img);
    setMemorizeLeft(MEMORIZE_SECS);
    setAppPhase("memorize");
  }

  // ── Memorize timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (appPhase !== "memorize") return;
    const interval = setInterval(() => setMemorizeLeft(t => Math.max(0, t - 1)), 1000);
    const timeout  = setTimeout(() => {
      const img = selectedImgRef.current!;
      setPhyQs(pickRandom(questions, TOTAL_PHY));
      setPhyIdx(0); setPhyTime(PHY_Q_TIME); setPhyPhase("question");
      setPhySelected(null); setPhyAnswers([]); setPhyShowHint(false);
      setMemQs(img.imgquestions);
      setMemIdx(0); setMemTime(MEM_Q_TIME); setMemPhase("question");
      setMemInput(""); setMemAnswers([]); setMemSubmitted(false); setMemFeedback(null);
      setAppPhase("quiz");
    }, MEMORIZE_SECS * 1000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [appPhase]);

  // ── Physics question timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (appPhase !== "quiz" || phyPhase !== "question") return;
    if (phyTimerRef.current) clearInterval(phyTimerRef.current);
    phyTimerRef.current = setInterval(() => {
      setPhyTime(t => {
        if (t <= 1) { clearInterval(phyTimerRef.current!); advancePhyRef.current(null); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (phyTimerRef.current) clearInterval(phyTimerRef.current); };
  }, [appPhase, phyPhase, phyIdx]);

  useEffect(() => {
    setPhyShowHint(appPhase === "quiz" && phyPhase === "question" && phyTime <= HINT_AT);
  }, [phyTime, appPhase, phyPhase]);

  // ── Physics rest timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (appPhase !== "quiz" || phyPhase !== "rest") return;
    const interval = setInterval(() => setPhyRestLeft(r => Math.max(0, r - 1)), 1000);
    const timeout  = setTimeout(() => {
      setPhyIdx(i => i + 1);
      setPhyTime(PHY_Q_TIME);
      setPhyPhase("question");
    }, REST_TIME * 1000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [appPhase, phyPhase]);

  // ── Memory question timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (appPhase !== "quiz" || memPhase !== "question") return;
    if (memTimerRef.current) clearInterval(memTimerRef.current);
    memTimerRef.current = setInterval(() => {
      setMemTime(t => {
        if (t <= 1) { clearInterval(memTimerRef.current!); advanceMemRef.current("", true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (memTimerRef.current) clearInterval(memTimerRef.current); };
  }, [appPhase, memPhase, memIdx]);

  // ── Transition to result when both done ───────────────────────────────────────
  useEffect(() => {
    if (appPhase === "quiz" && phyPhase === "done" && memPhase === "done") {
      setTimeout(() => setAppPhase("result"), 1200);
    }
  }, [appPhase, phyPhase, memPhase]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handlePhySelect(val: number) {
    if (phySelected !== null || phyPhase !== "question") return;
    setPhySelected(val);
    if (phyTimerRef.current) clearInterval(phyTimerRef.current);
    setTimeout(() => advancePhyRef.current(val), 900);
  }

  function handleMemSubmit() {
    if (memSubmitted || memPhase !== "question" || memInput.trim() === "") return;
    setMemSubmitted(true);
    if (memTimerRef.current) clearInterval(memTimerRef.current);
    advanceMemRef.current(memInput);
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const phyQ         = phyQs[phyIdx];
  const memQ         = memQs[memIdx];
  const phyWarn      = phyPhase === "question" && phyTime <= WARN_AT;
  const phyPct       = (phyTime / PHY_Q_TIME) * 100;
  const memWarnFlag  = memPhase === "question" && memTime <= 10;
  const memPct       = (memTime / MEM_Q_TIME) * 100;
  const phyCorrect   = phyAnswers.filter(a => a.correct).length;
  const phyWrong     = phyAnswers.filter(a => a.answered && !a.correct).length;
  const phyUnanswered = phyAnswers.filter(a => !a.answered).length;
  const memCorrect   = memAnswers.filter(a => a.correct).length;
  const memWrong     = memAnswers.filter(a => a.answered && !a.correct).length;
  const memUnanswered = memAnswers.filter(a => !a.answered).length;
  const totalScore   = phyCorrect + memCorrect;
  const totalMax     = TOTAL_PHY + (memQs.length || 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Bebas+Neue&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #09090f; color: #e8e8f0;
          font-family: 'Space Mono', monospace; min-height: 100vh; overflow-x: hidden;
        }
        .noise {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          opacity: 0.4;
        }
        .wrap {
          position: relative; z-index: 1; min-height: 100vh;
          display: flex; align-items: center; justify-content: center; padding: 24px;
          background: radial-gradient(ellipse at 20% 50%, #0d1a2e 0%, transparent 60%),
                      radial-gradient(ellipse at 80% 20%, #1a0d2e 0%, transparent 50%), #09090f;
        }
        /* ── START SCREEN ─────────────────────────────────── */
        .start-card {
          width: 100%; max-width: 680px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 2px; padding: 48px 40px;
          backdrop-filter: blur(12px);
          box-shadow: 0 0 80px rgba(0,120,255,0.05), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .logo { font-family:'Bebas Neue',sans-serif; font-size:13px; letter-spacing:.3em; color:rgba(255,255,255,0.2); margin-bottom:40px; }
        .start-title { font-family:'Bebas Neue',sans-serif; font-size:clamp(48px,8vw,80px); line-height:.9; color:#fff; letter-spacing:.02em; }
        .start-accent { color:#1e90ff; }
        .start-accent2 { color:#a855f7; }
        .start-sub { font-size:11px; color:rgba(255,255,255,0.35); letter-spacing:.2em; margin:16px 0 36px; }
        .start-meta {
          display: grid; grid-template-columns: repeat(4,1fr); gap:1px;
          background: rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.06); margin-bottom:36px;
        }
        .meta-cell { background:#09090f; padding:16px; text-align:center; }
        .meta-num { font-family:'Bebas Neue',sans-serif; font-size:28px; display:block; }
        .meta-num.blue { color:#1e90ff; }
        .meta-num.purple { color:#a855f7; }
        .meta-label { font-size:9px; color:rgba(255,255,255,0.3); letter-spacing:.15em; margin-top:2px; }
        .flow-row { display:flex; align-items:center; gap:8px; margin-bottom:32px; flex-wrap:wrap; }
        .flow-step {
          font-size:10px; letter-spacing:.1em; padding:6px 12px;
          border:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.4);
        }
        .flow-arrow { color:rgba(255,255,255,0.2); font-size:12px; }
        .btn {
          display:inline-flex; align-items:center; gap:12px;
          background:#1e90ff; color:#000;
          font-family:'Space Mono',monospace; font-weight:700; font-size:13px; letter-spacing:.15em;
          padding:16px 36px; border:none; cursor:pointer;
          text-transform:uppercase; position:relative; overflow:hidden;
          transition:transform .1s, box-shadow .2s;
        }
        .btn::before { content:''; position:absolute; inset:0; background:rgba(255,255,255,.15); transform:translateX(-100%); transition:transform .3s; }
        .btn:hover::before { transform:translateX(0); }
        .btn:hover { box-shadow:0 0 32px rgba(30,144,255,.5); transform:translateY(-1px); }
        /* ── MEMORIZE SCREEN ──────────────────────────────── */
        .mem-screen {
          width:100%; max-width:900px;
          display:flex; flex-direction:column; align-items:center; gap:24px;
        }
        .mem-header { text-align:center; }
        .mem-eyebrow { font-family:'Bebas Neue',sans-serif; font-size:13px; letter-spacing:.3em; color:#a855f7; margin-bottom:8px; }
        .mem-title { font-family:'Bebas Neue',sans-serif; font-size:clamp(36px,6vw,60px); color:#fff; }
        .mem-countdown {
          font-family:'Bebas Neue',sans-serif; font-size:80px; line-height:1;
          color:#a855f7; animation:pulse-mem 1s ease-in-out infinite alternate;
        }
        @keyframes pulse-mem { from{opacity:.7} to{opacity:1} }
        .mem-img-wrap {
          width:100%; max-width:800px;
          border:1px solid rgba(168,85,247,.3);
          background:rgba(168,85,247,.05);
          overflow:hidden; position:relative;
        }
        .mem-img-wrap img { width:100%; display:block; max-height:460px; object-fit:cover; }
        .mem-bar-wrap { width:100%; max-width:800px; height:3px; background:rgba(255,255,255,.06); }
        .mem-bar { height:100%; background:#a855f7; transition:width 1s linear; }
        .mem-note { font-size:11px; color:rgba(255,255,255,.3); letter-spacing:.15em; text-align:center; }
        /* ── QUIZ SPLIT SCREEN ────────────────────────────── */
        .quiz-wrap {
          width:100%; max-width:1400px; min-height:100vh;
          display:grid; grid-template-columns:1fr 1px 1fr;
          gap:0; align-items:start; padding:24px 0;
        }
        .divider { background:rgba(255,255,255,.06); }
        .quiz-panel { padding:32px 36px; }
        .panel-tag {
          font-family:'Bebas Neue',sans-serif; font-size:11px; letter-spacing:.3em;
          margin-bottom:24px; display:flex; align-items:center; gap:8px;
        }
        .panel-tag .dot { width:6px; height:6px; border-radius:50%; }
        .panel-tag.phy-tag { color:#1e90ff; }
        .panel-tag.phy-tag .dot { background:#1e90ff; }
        .panel-tag.mem-tag { color:#a855f7; }
        .panel-tag.mem-tag .dot { background:#a855f7; }
        /* Timer bar */
        .timer-bar-wrap { height:3px; background:rgba(255,255,255,.05); margin-bottom:20px; overflow:hidden; }
        .timer-bar { height:100%; transition:width 1s linear, background .5s; }
        .timer-bar.ok { background:#1e90ff; }
        .timer-bar.warn { background:#ff4444; animation:pulse-bar .5s ease-in-out infinite alternate; }
        .timer-bar.purple-ok { background:#a855f7; }
        .timer-bar.purple-warn { background:#ff4444; animation:pulse-bar .5s ease-in-out infinite alternate; }
        @keyframes pulse-bar { from{opacity:1} to{opacity:.4} }
        .timer-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
        .timer-num { font-family:'Bebas Neue',sans-serif; font-size:24px; transition:color .3s; }
        .timer-num.ok { color:#1e90ff; }
        .timer-num.warn { color:#ff4444; animation:shake .3s ease-in-out infinite; }
        .timer-num.purple-ok { color:#a855f7; }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-2px)} 75%{transform:translateX(2px)} }
        .progress-txt { font-size:10px; color:rgba(255,255,255,.25); letter-spacing:.2em; }
        /* Question */
        .q-num { font-family:'Bebas Neue',sans-serif; font-size:12px; letter-spacing:.3em; margin-bottom:14px; color:rgba(255,255,255,.3); }
        .q-text { font-size:14px; line-height:1.7; color:#e8e8f0; margin-bottom:24px; min-height:64px; }
        /* Hint */
        .hint-box {
          border-left:2px solid #1e90ff; padding:8px 14px;
          background:rgba(30,144,255,.05); margin-bottom:20px;
          font-size:11px; color:rgba(255,255,255,.5); letter-spacing:.08em;
          animation:fade-in .4s ease;
        }
        @keyframes fade-in { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
        /* Options */
        .options { display:flex; flex-direction:column; gap:8px; }
        .opt {
          display:flex; align-items:center; gap:14px; padding:12px 16px;
          border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.02);
          cursor:pointer; transition:border-color .15s, background .15s, transform .1s;
          font-family:'Space Mono',monospace; font-size:13px; color:#e8e8f0; text-align:left;
          position:relative; overflow:hidden;
        }
        .opt::before { content:''; position:absolute; inset:0; background:rgba(30,144,255,.06); transform:scaleX(0); transform-origin:left; transition:transform .2s; }
        .opt:hover:not(.disabled)::before { transform:scaleX(1); }
        .opt:hover:not(.disabled) { border-color:rgba(30,144,255,.4); transform:translateX(3px); }
        .opt.disabled { cursor:default; }
        .opt.sel-correct { border-color:#00e676; background:rgba(0,230,118,.05); }
        .opt.sel-wrong   { border-color:#ff4444; background:rgba(255,68,68,.05); }
        .opt.reveal-correct { border-color:rgba(0,230,118,.4); }
        .opt-letter { font-family:'Bebas Neue',sans-serif; font-size:15px; color:rgba(255,255,255,.25); min-width:18px; }
        /* Rest */
        .rest-wrap { text-align:center; padding:48px 0; }
        .rest-label { font-family:'Bebas Neue',sans-serif; font-size:11px; letter-spacing:.3em; color:rgba(255,255,255,.2); margin-bottom:8px; }
        .rest-num { font-family:'Bebas Neue',sans-serif; font-size:80px; color:#1e90ff; line-height:1; animation:pulse-mem 1s ease-in-out infinite alternate; }
        /* Done panel */
        .done-panel { text-align:center; padding:48px 0; }
        .done-icon { font-size:48px; margin-bottom:16px; }
        .done-label { font-family:'Bebas Neue',sans-serif; font-size:13px; letter-spacing:.3em; color:rgba(255,255,255,.3); }
        .done-score { font-family:'Bebas Neue',sans-serif; font-size:56px; margin-top:8px; }
        .done-score.blue { color:#1e90ff; }
        .done-score.purple { color:#a855f7; }
        /* Memory input */
        .mem-input-section { margin-top:4px; }
        .mem-input-wrap { display:flex; gap:8px; margin-bottom:12px; }
        .mem-input {
          flex:1; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.12);
          color:#e8e8f0; font-family:'Space Mono',monospace; font-size:14px;
          padding:12px 16px; outline:none; transition:border-color .2s;
        }
        .mem-input:focus { border-color:rgba(168,85,247,.5); }
        .mem-input.submitted { opacity:.5; pointer-events:none; }
        .mem-submit-btn {
          background:#a855f7; color:#fff; border:none; cursor:pointer;
          font-family:'Space Mono',monospace; font-size:12px; font-weight:700;
          padding:12px 20px; letter-spacing:.1em; text-transform:uppercase;
          transition:opacity .2s, box-shadow .2s;
        }
        .mem-submit-btn:hover:not(:disabled) { opacity:.85; box-shadow:0 0 20px rgba(168,85,247,.4); }
        .mem-submit-btn:disabled { opacity:.35; cursor:default; }
        .mem-feedback {
          font-size:12px; letter-spacing:.1em; padding:8px 14px;
          border-left:2px solid; animation:fade-in .3s ease;
        }
        .mem-feedback.correct { border-color:#00e676; color:#00e676; background:rgba(0,230,118,.05); }
        .mem-feedback.wrong   { border-color:#ff4444; color:#ff4444; background:rgba(255,68,68,.05); }
        /* ── RESULT SCREEN ────────────────────────────────── */
        .result-wrap { width:100%; max-width:1100px; padding:40px 0; }
        .result-top { text-align:center; margin-bottom:48px; }
        .result-eyebrow { font-family:'Bebas Neue',sans-serif; font-size:12px; letter-spacing:.3em; color:rgba(255,255,255,.25); margin-bottom:8px; }
        .result-big { font-family:'Bebas Neue',sans-serif; font-size:clamp(60px,10vw,100px); line-height:.9; color:#fff; margin-bottom:4px; }
        .result-big span { color:#1e90ff; }
        .result-sub { font-size:11px; color:rgba(255,255,255,.25); letter-spacing:.2em; }
        .result-grade-bar { height:4px; background:rgba(255,255,255,.05); margin:24px auto; max-width:400px; }
        .result-grade-fill { height:100%; background:linear-gradient(90deg,#1e90ff,#a855f7); transition:width 1.4s cubic-bezier(.16,1,.3,1); }
        .result-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:36px; }
        .result-card {
          background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07);
          padding:28px;
        }
        .result-card-title { font-family:'Bebas Neue',sans-serif; font-size:11px; letter-spacing:.3em; margin-bottom:20px; }
        .result-card-title.blue { color:#1e90ff; }
        .result-card-title.purple { color:#a855f7; }
        .result-score-row { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.05); }
        .r-cell { background:#09090f; padding:16px; text-align:center; }
        .r-num { font-family:'Bebas Neue',sans-serif; font-size:36px; display:block; }
        .r-num.green { color:#00e676; }
        .r-num.red { color:#ff4444; }
        .r-num.gray { color:rgba(255,255,255,.25); }
        .r-label { font-size:9px; color:rgba(255,255,255,.25); letter-spacing:.15em; margin-top:3px; }
        .result-img-wrap { margin-bottom:32px; text-align:center; }
        .result-img-label { font-family:'Bebas Neue',sans-serif; font-size:11px; letter-spacing:.3em; color:#a855f7; margin-bottom:12px; }
        .result-img { max-width:480px; width:100%; border:1px solid rgba(168,85,247,.3); display:block; margin:0 auto; }
        .result-msg { font-size:12px; color:rgba(255,255,255,.3); letter-spacing:.08em; text-align:center; line-height:1.8; margin-bottom:32px; }
        .result-btns { display:flex; justify-content:center; gap:16px; flex-wrap:wrap; }
        @media (max-width:900px) {
          .quiz-wrap { grid-template-columns:1fr; }
          .divider { height:1px; width:100%; }
          .result-grid { grid-template-columns:1fr; }
          .start-meta { grid-template-columns:repeat(2,1fr); }
        }
        @media (max-width:560px) {
          .quiz-panel { padding:20px 16px; }
          .start-card { padding:32px 20px; }
        }
      `}</style>

      <div className="noise" />
      <div className="wrap">

        {/* ══ START ═══════════════════════════════════════════════════════════ */}
        {appPhase === "start" && (
          <div className="start-card">
            <div className="logo">DUAL BRAIN CHALLENGE ◆ PHYSICS + MEMORY</div>
            <div className="start-title">
              PHYSICS<br />
              <span className="start-accent">+</span>{" "}
              <span className="start-accent2">MEMORY</span>
            </div>
            <div className="start-sub">KINEMATICS MCQ · VISUAL MEMORY · SIMULTANEOUS CHALLENGE</div>
            <div className="start-meta">
              <div className="meta-cell">
                <span className="meta-num blue">{TOTAL_PHY}</span>
                <div className="meta-label">PHY QUESTIONS</div>
              </div>
              <div className="meta-cell">
                <span className="meta-num blue">{PHY_Q_TIME}s</span>
                <div className="meta-label">PER PHY Q</div>
              </div>
              <div className="meta-cell">
                <span className="meta-num purple">12</span>
                <div className="meta-label">MEM QUESTIONS</div>
              </div>
              <div className="meta-cell">
                <span className="meta-num purple">{MEM_Q_TIME}s</span>
                <div className="meta-label">PER MEM Q</div>
              </div>
            </div>
            <div className="flow-row">
              <span className="flow-step">▶ START</span>
              <span className="flow-arrow">→</span>
              <span className="flow-step">👁 MEMORIZE IMAGE ({MEMORIZE_SECS}s)</span>
              <span className="flow-arrow">→</span>
              <span className="flow-step">⚡ DUAL QUIZ</span>
              <span className="flow-arrow">→</span>
              <span className="flow-step">📊 RESULTS</span>
            </div>
            <button className="btn" onClick={startRound}>START CHALLENGE →</button>
          </div>
        )}

        {/* ══ MEMORIZE ════════════════════════════════════════════════════════ */}
        {appPhase === "memorize" && selectedImg && (
          <div className="mem-screen">
            <div className="mem-header">
              <div className="mem-eyebrow">MEMORY PHASE · STUDY THIS IMAGE</div>
              <div className="mem-title">MEMORIZE EVERY DETAIL</div>
            </div>
            <div className="mem-countdown">{memorizeLeft}s</div>
            <div className="mem-bar-wrap">
              <div className="mem-bar" style={{ width: `${(memorizeLeft / MEMORIZE_SECS) * 100}%` }} />
            </div>
            <div className="mem-img-wrap">
              <img
                src={`/pictures/${selectedImg.imageName}`}
                alt="Memorize this scene"
              />
            </div>
            <div className="mem-note">IMAGE WILL DISAPPEAR · QUIZ STARTS AUTOMATICALLY</div>
          </div>
        )}

        {/* ══ QUIZ ════════════════════════════════════════════════════════════ */}
        {appPhase === "quiz" && (
          <div className="quiz-wrap">

            {/* LEFT — Physics ───────────────────────────────────────────────── */}
            <div className="quiz-panel">
              <div className="panel-tag phy-tag">
                <div className="dot" />
                PHYSICS · EQUATIONS OF MOTION
              </div>

              {phyPhase === "question" && phyQ && (
                <>
                  <div className="timer-row">
                    <div className="progress-txt">Q {phyIdx + 1} <span style={{color:"rgba(255,255,255,.15)"}}>/ {TOTAL_PHY}</span></div>
                    <div className={`timer-num ${phyWarn ? "warn" : "ok"}`}>{phyTime}s</div>
                  </div>
                  <div className="timer-bar-wrap">
                    <div className={`timer-bar ${phyWarn ? "warn" : "ok"}`} style={{ width: `${phyPct}%` }} />
                  </div>
                  <div className="q-num">QUESTION {String(phyIdx + 1).padStart(2, "0")}</div>
                  <div className="q-text">{phyQ.question}</div>
                  {phyShowHint && (
                    <div className="hint-box">💡 HINT — use: <strong>{phyQ.hint}</strong></div>
                  )}
                  <div className="options">
                    {phyQ.toSelect.map((val, i) => {
                      let cls = "opt";
                      if (phySelected !== null) {
                        cls += " disabled";
                        if (val === phySelected)
                          cls += val === phyQ.answer ? " sel-correct" : " sel-wrong";
                        else if (val === phyQ.answer)
                          cls += " reveal-correct";
                      }
                      return (
                        <button key={val} className={cls} onClick={() => handlePhySelect(val)}>
                          <span className="opt-letter">{LETTER[i]}</span>
                          <span>{val}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {phyPhase === "rest" && (
                <div className="rest-wrap">
                  <div className="rest-label">NEXT QUESTION IN</div>
                  <div className="rest-num">{phyRestLeft}</div>
                </div>
              )}

              {phyPhase === "done" && (
                <div className="done-panel">
                  <div className="done-icon">⚡</div>
                  <div className="done-label">PHYSICS COMPLETE</div>
                  <div className="done-score blue">{phyCorrect}/{TOTAL_PHY}</div>
                  <div style={{fontSize:"11px",color:"rgba(255,255,255,.25)",marginTop:"12px",letterSpacing:".1em"}}>
                    WAITING FOR MEMORY QUIZ…
                  </div>
                </div>
              )}
            </div>

            {/* DIVIDER */}
            <div className="divider" />

            {/* RIGHT — Memory ───────────────────────────────────────────────── */}
            <div className="quiz-panel">
              <div className="panel-tag mem-tag">
                <div className="dot" />
                MEMORY · WHAT DID YOU SEE?
              </div>

              {memPhase === "question" && memQ && (
                <>
                  <div className="timer-row">
                    <div className="progress-txt">Q {memIdx + 1} <span style={{color:"rgba(255,255,255,.15)"}}>/ {memQs.length}</span></div>
                    <div className={`timer-num ${memWarnFlag ? "warn" : "purple-ok"}`}>{memTime}s</div>
                  </div>
                  <div className="timer-bar-wrap">
                    <div className={`timer-bar ${memWarnFlag ? "warn" : "purple-ok"}`} style={{ width: `${memPct}%` }} />
                  </div>
                  <div className="q-num">MEMORY Q {String(memIdx + 1).padStart(2, "0")}</div>
                  <div className="q-text">{memQ.question}</div>

                  <div className="mem-input-section">
                    <div className="mem-input-wrap">
                      <input
                        className={`mem-input${memSubmitted ? " submitted" : ""}`}
                        type="text"
                        placeholder="Type your answer…"
                        value={memInput}
                        onChange={e => setMemInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleMemSubmit(); }}
                        disabled={memSubmitted}
                        autoComplete="off"
                      />
                      <button
                        className="mem-submit-btn"
                        onClick={handleMemSubmit}
                        disabled={memSubmitted || memInput.trim() === ""}
                      >
                        SUBMIT
                      </button>
                    </div>
                    {memFeedback && (
                      <div className={`mem-feedback ${memFeedback}`}>
                        {memFeedback === "correct"
                          ? "✓ CORRECT"
                          : `✗ INCORRECT — Answer: ${memQ.answer}`}
                      </div>
                    )}
                  </div>
                </>
              )}

              {memPhase === "done" && (
                <div className="done-panel">
                  <div className="done-icon">🧠</div>
                  <div className="done-label">MEMORY COMPLETE</div>
                  <div className="done-score purple">{memCorrect}/{memQs.length}</div>
                  <div style={{fontSize:"11px",color:"rgba(255,255,255,.25)",marginTop:"12px",letterSpacing:".1em"}}>
                    WAITING FOR PHYSICS QUIZ…
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ RESULT ══════════════════════════════════════════════════════════ */}
        {appPhase === "result" && (
          <div className="result-wrap">
            <div className="result-top">
              <div className="result-eyebrow">DUAL CHALLENGE COMPLETE</div>
              <div className="result-big">{totalScore}<span>/{totalMax}</span></div>
              <div className="result-sub">COMBINED SCORE</div>
              <div className="result-grade-bar">
                <div className="result-grade-fill" style={{ width: `${(totalScore / totalMax) * 100}%` }} />
              </div>
            </div>

            {selectedImg && (
              <div className="result-img-wrap">
                <div className="result-img-label">THE IMAGE YOU MEMORIZED</div>
                <img
                  className="result-img"
                  src={`/pictures/${selectedImg.imageName}`}
                  alt="The memorized scene"
                />
              </div>
            )}

            <div className="result-grid">
              {/* Physics card */}
              <div className="result-card">
                <div className="result-card-title blue">⚡ PHYSICS — EQUATIONS OF MOTION</div>
                <div className="result-score-row">
                  <div className="r-cell">
                    <span className="r-num green">{phyCorrect}</span>
                    <div className="r-label">CORRECT</div>
                  </div>
                  <div className="r-cell">
                    <span className="r-num red">{phyWrong}</span>
                    <div className="r-label">WRONG</div>
                  </div>
                  <div className="r-cell">
                    <span className="r-num gray">{phyUnanswered}</span>
                    <div className="r-label">UNANSWERED</div>
                  </div>
                </div>
                <div style={{marginTop:"14px",fontSize:"11px",color:"rgba(255,255,255,.25)",letterSpacing:".08em"}}>
                  {phyCorrect}/{TOTAL_PHY} ·{" "}
                  {Math.round((phyCorrect / TOTAL_PHY) * 100)}%
                </div>
              </div>

              {/* Memory card */}
              <div className="result-card">
                <div className="result-card-title purple">🧠 MEMORY — VISUAL RECALL</div>
                <div className="result-score-row">
                  <div className="r-cell">
                    <span className="r-num green">{memCorrect}</span>
                    <div className="r-label">CORRECT</div>
                  </div>
                  <div className="r-cell">
                    <span className="r-num red">{memWrong}</span>
                    <div className="r-label">WRONG</div>
                  </div>
                  <div className="r-cell">
                    <span className="r-num gray">{memUnanswered}</span>
                    <div className="r-label">UNANSWERED</div>
                  </div>
                </div>
                <div style={{marginTop:"14px",fontSize:"11px",color:"rgba(255,255,255,.25)",letterSpacing:".08em"}}>
                  {memCorrect}/{memQs.length} ·{" "}
                  {memQs.length > 0 ? Math.round((memCorrect / memQs.length) * 100) : 0}%
                </div>
              </div>
            </div>

            <div className="result-msg">
              {totalScore === totalMax && "PERFECT. Both hemispheres firing at full power."}
              {totalScore >= Math.round(totalMax * 0.8) && totalScore < totalMax && "OUTSTANDING. Sharp mind, sharp memory."}
              {totalScore >= Math.round(totalMax * 0.6) && totalScore < Math.round(totalMax * 0.8) && "SOLID PERFORMANCE. Room to grow in both areas."}
              {totalScore >= Math.round(totalMax * 0.4) && totalScore < Math.round(totalMax * 0.6) && "KEEP PRACTICING. The dual challenge is tough!"}
              {totalScore < Math.round(totalMax * 0.4) && "GREAT EFFORT. Each round builds stronger neural pathways."}
            </div>

            <div className="result-btns">
              <button className="btn" onClick={startRound}>PLAY AGAIN →</button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}