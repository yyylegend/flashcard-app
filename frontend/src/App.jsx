import { useState, useEffect, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion"; // eslint-disable-line no-unused-vars
import {
  Brain, BookOpen, FileText, Plus, Bot, Download, BookMarked, FlaskConical,
  Sun, Moon, User, LogOut, Lock, Pencil, Trash2, Eye, ChevronLeft, ChevronRight,
  Lightbulb,
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import go from "highlight.js/lib/languages/go";
import sql from "highlight.js/lib/languages/sql";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import "highlight.js/styles/github-dark.css";
hljs.registerLanguage("python", python);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c++", cpp);
hljs.registerLanguage("go", go);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);
const ReactConfetti = lazy(() => import("react-confetti"));
import {
  fetchDecks, createDeck, deleteDeck,
  createCard, updateCard, deleteCard as apiDeleteCard,
  fetchScores, saveScore, resetAll,
  getToken, clearToken,
} from "./api";
import NotesView from "./Notes";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import { LoginModal } from "@/components/modals/LoginModal";
import { CardModal } from "@/components/modals/CardModal";
import { AIGenModal } from "@/components/modals/AIGenModal";
import { ImportModal } from "@/components/modals/ImportModal";

/* ── Category colors ── */
const CAT_C = {
  "基础类型":   { border: "#E07820", text: "#C05C00", badge: "#FFF0DC" },
  "核心概念":   { border: "#D97706", text: "#92400E", badge: "#FEF3C7" },
  "函数":       { border: "#34D399", text: "#047857", badge: "#D1FAE5" },
  "面向对象":   { border: "#F87171", text: "#B91C1C", badge: "#FEE2E2" },
  "并发编程":   { border: "#FBBF24", text: "#B45309", badge: "#FEF9C3" },
  "高频实战":   { border: "#A3E635", text: "#3F6212", badge: "#ECFCCB" },
};
const EX_C = [
  { border: "#E07820", text: "#C05C00", badge: "#FFF0DC" },
  { border: "#34D399", text: "#047857", badge: "#D1FAE5" },
  { border: "#F87171", text: "#B91C1C", badge: "#FEE2E2" },
  { border: "#FBBF24", text: "#B45309", badge: "#FEF9C3" },
  { border: "#A3E635", text: "#3F6212", badge: "#ECFCCB" },
];
function gc(c) {
  if (CAT_C[c]) return CAT_C[c];
  let h = 0;
  for (let i = 0; i < c.length; i++) h = ((h << 5) - h + c.charCodeAt(i)) | 0;
  return EX_C[Math.abs(h) % EX_C.length];
}

function shuf(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = 0 | Math.random() * (i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/* ── Markdown renderer ── */
const _marked = new Marked();
_marked.use(markedHighlight({
  langPrefix: "hljs language-",
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlight(code, { language: "plaintext", ignoreIllegals: true }).value;
  }
}));
_marked.use({ breaks: true, gfm: true });

function Ans({ text }) {
  const html = _marked.parse(text || "");
  return <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ════════════════════════════════════
   MAIN APP
   ════════════════════════════════════ */
export default function App() {
  const [decks, setDecks] = useState([]);
  const [di, setDi] = useState(0);
  const [mode, setMode] = useState(0);       // 0=browse 1=quiz 2=review
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(false);
  const [cat, setCat] = useState("全部");
  const [scores, setScores] = useState({});
  const [quiz, setQuiz] = useState([]);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ ok: 0, fail: 0, total: 0 });
  const [showImp, setShowImp] = useState(false);
  const [showCard, setShowCard] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [authed, setAuthed] = useState(!!getToken());
  const [authUser, setAuthUser] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [dlg, setDlg] = useState(null);
  const [wIdx, setWIdx] = useState(0);
  const [mainView, setMainView] = useState(0);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("fc_theme") === "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("fc_theme", darkMode ? "dark" : "light");
  }, [darkMode]);


  useEffect(() => {
    (async () => {
      try {
        const [rawDecks, rawScores] = await Promise.all([fetchDecks(), fetchScores()]);
        const normalized = (rawDecks || []).map(dk => ({
          ...dk,
          cards: (dk.cards || []).map(c => ({ ...c, category: c.category || "未分类", tips: c.tips || "" })),
        }));
        setDecks(normalized);
        setScores(rawScores && typeof rawScores === "object" && !Array.isArray(rawScores) ? rawScores : {});
      } catch (err) { console.error("加载失败:", err); }
      setLoaded(true);
    })();
  }, []);

  const reloadScores = async () => {
    try {
      const raw = await fetchScores();
      setScores(raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {});
    } catch { setScores({}); }
  };

  // ── Derived ──
  const dk = decks[di] || decks[0];
  const all = dk?.cards || [];
  const cats = [...new Set(all.map(c => c.category))];
  const flt = cat === "全部" ? all : all.filter(c => c.category === cat);
  const cards = mode === 1 ? quiz : flt;
  const card = cards[idx];
  const ws = all.filter(q => scores[q.id] === "fail");
  const wCard = ws[wIdx] ?? null;
  const mastered = Object.values(scores).filter(v => v === "ok").length;
  const wrongs = Object.values(scores).filter(v => v === "fail").length;
  const pct = cards.length
    ? (mode === 1 ? (stats.ok + stats.fail) / stats.total * 100 : (idx + 1) / cards.length * 100)
    : 0;

  const flashSave = () => toast.success("已保存");

  // ── Quiz ──
  const startQ = () => {
    const p = flt.filter(q => scores[q.id] !== "ok");
    const o = shuf(p.length ? p : flt);
    setQuiz(o); setIdx(0); setShow(false); setDone(false);
    setStats({ ok: 0, fail: 0, total: o.length });
    setMode(1);
  };

  const mark = async r => {
    await saveScore(card.id, r).catch(() => {});
    setScores(p => ({ ...p, [card.id]: r }));
    setStats(s => ({ ...s, [r]: s[r] + 1 }));
    if (idx < cards.length - 1) { setIdx(i => i + 1); setShow(false); }
    else {
      setDone(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }
  };

  // ── CRUD ──
  const saveCard = async (c) => {
    if (c.id) {
      await updateCard(c.id, { category: c.category, q: c.q, a: c.a, tips: c.tips });
      setDecks(d => d.map((dk, i) => {
        if (i !== di) return dk;
        return { ...dk, cards: dk.cards.map(x => x.id === c.id ? c : x) };
      }));
    } else {
      await createCard(dk.id, { category: c.category, q: c.q, a: c.a, tips: c.tips });
      const fresh = await fetchDecks();
      setDecks(fresh.map(d => ({
        ...d,
        cards: (d.cards || []).map(x => ({ ...x, category: x.category || "未分类", tips: x.tips || "" })),
      })));
    }
    flashSave();
  };

  const handleDeleteCard = async (id) => {
    await apiDeleteCard(id).catch(() => {});
    setDecks(d => d.map((dk, i) => i === di ? { ...dk, cards: dk.cards.filter(c => c.id !== id) } : dk));
    if (idx >= flt.length - 1) setIdx(Math.max(0, idx - 1));
    setShow(false);
    flashSave();
  };

  const addCards = async (cs, deckId, topic) => {
    let targetId = deckId;
    if (!targetId) {
      const newDeck = await createDeck(topic || "AI生成");
      targetId = newDeck.id;
    }
    for (const c of cs) {
      await createCard(targetId, { category: c.category, q: c.q, a: c.a, tips: c.tips }).catch(() => {});
    }
    const fresh = await fetchDecks();
    const normalized = fresh.map(d => ({
      ...d,
      cards: (d.cards || []).map(x => ({ ...x, category: x.category || "未分类", tips: x.tips || "" })),
    }));
    setDecks(normalized);
    if (!deckId) setDi(normalized.findIndex(d => d.id === targetId));
    setShowAI(false);
    flashSave();
  };

  const impDeck = async (cs, name) => {
    const newDeck = await createDeck(name);
    for (const c of cs) {
      await createCard(newDeck.id, { category: c.category, q: c.q, a: c.a, tips: c.tips }).catch(() => {});
    }
    const fresh = await fetchDecks();
    const normalized = fresh.map(d => ({
      ...d,
      cards: (d.cards || []).map(x => ({ ...x, category: x.category || "未分类", tips: x.tips || "" })),
    }));
    setDecks(normalized);
    setDi(normalized.length - 1);
    setCat("全部"); setIdx(0); setMode(0);
    setShowImp(false);
    flashSave();
  };

  const rmDeck = async (i) => {
    if (i === 0) return;
    await deleteDeck(decks[i].id).catch(() => {});
    setDecks(d => d.filter((_, j) => j !== i));
    if (di >= i) setDi(Math.max(0, di - 1));
    setCat("全部"); setIdx(0); setMode(0);
  };

  const sw = (i) => { setDi(i); setCat("全部"); setIdx(0); setShow(false); setMode(0); };

  const resetData = async () => {
    await resetAll().catch(() => {});
    const fresh = await fetchDecks();
    setDecks(fresh.map(d => ({
      ...d,
      cards: (d.cards || []).map(x => ({ ...x, category: x.category || "未分类", tips: x.tips || "" })),
    })));
    setScores({});
    setDi(0); setCat("全部"); setIdx(0); setMode(0);
  };

  // ── 键盘快捷键 ──
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (showLogin || showCard !== null || showAI || showImp || dlg) return;
      if (mainView !== 0) return;
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        if (mode !== 2 && card) setShow(s => !s);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (mode === 0 && idx > 0) { setIdx(i => i - 1); setShow(false); }
        else if (mode === 2 && wIdx > 0) setWIdx(i => i - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (mode === 0 && idx < cards.length - 1) { setIdx(i => i + 1); setShow(false); }
        else if (mode === 2 && wIdx < ws.length - 1) setWIdx(i => i + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [show, idx, wIdx, card, cards, ws, mode, mainView, showLogin, showCard, showAI, showImp, dlg]);

  const cc = card ? gc(card.category) : { border: "#ccc", text: "#666", badge: "#f3f4f6" };

  if (!loaded) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--page-bg)" }}>
      <p className="text-[var(--text-3,#999)]">加载中...</p>
    </div>
  );

  return (
    <div className="min-h-screen font-sans" style={{ background: "var(--page-bg)" }}>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: 14, borderRadius: 10 } }} />
      {showConfetti && <Suspense fallback={null}><ReactConfetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={280} /></Suspense>}

      {/* Modals */}
      <AnimatePresence>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={u => { setAuthed(true); setAuthUser(u); reloadScores(); }} />}
      </AnimatePresence>
      <AnimatePresence>
        {dlg && <ConfirmDialog message={dlg.message} onConfirm={() => { dlg.onConfirm(); setDlg(null); }} onCancel={() => setDlg(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showImp && <ImportModal onClose={() => setShowImp(false)} onImport={impDeck} />}
      </AnimatePresence>
      <AnimatePresence>
        {showCard !== null && (
          <CardModal
            onClose={() => setShowCard(null)}
            onSave={saveCard}
            categories={cats.length ? cats : ["默认"]}
            initial={showCard === "add" ? null : showCard}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAI && <AIGenModal onClose={() => setShowAI(false)} onAdd={addCards} decks={decks} defaultDeckId={dk?.id} />}
      </AnimatePresence>

      {/* ── Navbar ── */}
      <div style={{ background: "var(--nav-bg)", borderBottom: "1px solid var(--nav-border)" }}>
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-[18px] font-extrabold flex items-center gap-1.5" style={{ color: "var(--nav-text)" }}>
              <Brain size={20} color="var(--nav-text)" /> 八股文速记
            </span>
            {/* View tabs */}
            <div className="flex ml-2">
              {[{ label: "闪卡", icon: <BookOpen size={14}/>, v: 0 }, { label: "笔记", icon: <FileText size={14}/>, v: 1 }].map(({ label, icon, v }) => (
                <button key={v} onClick={() => setMainView(v)}
                  className="inline-flex items-center gap-1.5 px-4 py-1 text-[13px] font-semibold cursor-pointer border-0 transition-all duration-200"
                  style={{
                    background: mainView === v ? "var(--nav-active-bg)" : "transparent",
                    color: "var(--nav-text)",
                    borderBottom: mainView === v ? "2px solid var(--nav-active-border)" : "2px solid transparent",
                  }}>
                  {icon} {label}
                </button>
              ))}
            </div>
            {mainView === 0 && (
              <span className="text-[13px]" style={{ color: "var(--nav-text-muted)" }}>
                {dk?.name} · {all.length}题 · 已掌握{" "}
                <span className="font-bold" style={{ color: "#7dd3a8" }}>{mastered}</span>
              </span>
            )}
          </div>

          <div className="flex gap-1.5 items-center">
            {mainView === 0 && (mode === 1
              ? <button onClick={() => setMode(0)} className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-(--app-border) bg-(--card-bg,#fff) cursor-pointer text-(--text-color,#777) text-[13px]">
                  <ChevronLeft size={15}/> 退出测试
                </button>
              : <>
                {authed && <>
                  <button onClick={() => setShowCard("add")} aria-label="手动添加卡片" className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 px-2 py-2 rounded-[10px] border border-dashed border-(--app-border) bg-(--card-bg,#fff) cursor-pointer text-(--text-color,#777) text-[13px]"><Plus size={15} aria-hidden="true"/></button>
                  <button onClick={() => setShowAI(true)} aria-label="AI生成卡片" className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 px-2 py-2 rounded-[10px] border border-dashed border-(--app-border) bg-(--card-bg,#fff) cursor-pointer text-(--text-color,#777) text-[13px]"><Bot size={15} aria-hidden="true"/></button>
                  <button onClick={() => setShowImp(true)} aria-label="导入文档" className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 px-2 py-2 rounded-[10px] border border-dashed border-(--app-border) bg-(--card-bg,#fff) cursor-pointer text-(--text-color,#777) text-[13px]"><Download size={15} aria-hidden="true"/></button>
                </>}
                <button onClick={() => setMode(2)} className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-(--app-border) bg-(--card-bg,#fff) cursor-pointer text-(--text-color,#777) text-[13px]">
                  <BookMarked size={15}/>{wrongs > 0 ? ` ${wrongs}` : ""}
                </button>
                <button onClick={startQ} className="btn-fill btn-fill-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border-0 font-semibold cursor-pointer text-white text-[13px] shadow-[0_2px_8px_rgba(192,92,0,.3)]" style={{ background: "linear-gradient(135deg,#C05C00,#E07820)" }}>
                  <FlaskConical size={14}/> 测试
                </button>
              </>)
            }
            {/* Theme toggle */}
            <button onClick={() => setDarkMode(d => !d)}
              aria-label={darkMode ? "切换浅色模式" : "切换深色模式"}
              className="inline-flex items-center ml-1 p-2 rounded-lg border-0 bg-transparent cursor-pointer transition-opacity hover:opacity-100"
              style={{ color: "var(--nav-text-muted)" }}>
              {darkMode ? <Sun size={17} aria-hidden="true"/> : <Moon size={17} aria-hidden="true"/>}
            </button>
            {/* Auth */}
            {authed
              ? <div className="flex items-center gap-1.5 ml-1 pl-2" style={{ borderLeft: "1px solid var(--nav-separator)" }}>
                  <span className="text-[13px] font-semibold inline-flex items-center gap-1" style={{ color: "var(--nav-text)" }}>
                    <User size={14}/> {authUser}
                  </span>
                  <button onClick={() => { clearToken(); setAuthed(false); setAuthUser(""); setScores({}); }}
                    className="btn-fill btn-fill-indigo inline-flex items-center gap-1 px-2.5 py-1 rounded-[10px] border bg-transparent cursor-pointer text-[12px]"
                    style={{ color: "var(--nav-text-muted)", borderColor: "var(--nav-separator)" }}>
                    <LogOut size={13}/> 退出
                  </button>
                </div>
              : <button onClick={() => setShowLogin(true)}
                  className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 ml-1 px-3.5 py-2 rounded-[10px] border bg-transparent cursor-pointer text-[13px]"
                  style={{ color: "var(--nav-text)", borderColor: "var(--nav-separator)" }}>
                  <Lock size={14}/> 登录
                </button>
            }
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <AnimatePresence mode="wait">
        {mainView === 1 ? (
          <motion.div key="notes"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="max-w-[1400px] mx-auto px-4 py-5">
            <NotesView authed={authed} authUser={authUser} onImportCards={impDeck} />
          </motion.div>
        ) : (
          <motion.div key="cards"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex max-w-[1400px] mx-auto px-4 py-5 gap-5 items-start">

            {/* ── Left sidebar ── */}
            <div className="w-[200px] shrink-0 flex flex-col gap-4">

              {/* Deck list */}
              {decks.length > 1 && mode === 0 && (
                <div className="rounded-[10px] p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ background: "var(--surface,#fff)" }}>
                  <div className="text-[11px] font-bold tracking-[0.08em] uppercase mb-2" style={{ color: "var(--text-3,#aaa)" }}>题库</div>
                  {decks.map((d, i) => (
                    <div key={d.id} onClick={() => sw(i)}
                      className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-[7px] text-[13px] cursor-pointer mb-0.5 relative transition-colors duration-150 hover:bg-[rgba(192,92,0,0.06)]"
                      style={{
                        color: i === di ? "#C05C00" : "var(--text-2,#555)",
                        fontWeight: i === di ? 600 : 400,
                      }}>
                      {i === di && (
                        <span className="absolute left-0 top-1 bottom-1 w-0.75 rounded-full bg-[#C05C00]" />
                      )}
                      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{d.name}</span>
                      <span className="text-[11px] opacity-60 w-6 text-right shrink-0">{d.cards.length}</span>
                      <span className="w-4 shrink-0 flex items-center justify-center">
                        {i > 0 && (
                          <span onClick={e => { e.stopPropagation(); setDlg({ message: `删除「${d.name}」？`, onConfirm: () => rmDeck(i) }); }}
                            className="text-[13px] opacity-50 cursor-pointer hover:opacity-100">×</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Category filter */}
              {mode === 0 && cats.length > 0 && (
                <div className="rounded-[10px] p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ background: "var(--surface,#fff)" }}>
                  <div className="text-[11px] font-bold tracking-[0.08em] uppercase mb-2" style={{ color: "var(--text-3,#aaa)" }}>分类</div>
                  {["全部", ...cats].map(c => {
                    const count = c === "全部" ? all.length : all.filter(q => q.category === c).length;
                    const active = cat === c;
                    return (
                      <div key={c} onClick={() => { setCat(c); setIdx(0); setShow(false); }}
                        className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-[7px] text-[13px] cursor-pointer mb-0.5 relative transition-colors duration-150 hover:bg-[rgba(192,92,0,0.06)]"
                        style={{
                          color: active ? "#C05C00" : "var(--text-2,#555)",
                          fontWeight: active ? 600 : 400,
                        }}>
                        {active && <span className="absolute left-0 top-1 bottom-1 w-0.75 rounded-full bg-[#C05C00]" />}
                        <span className="flex-1">{c}</span>
                        <span className="text-[11px] opacity-60">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Answer sheet */}
              {mode === 0 && flt.length > 0 && (
                <div className="rounded-[10px] p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ background: "var(--surface,#fff)" }}>
                  <div className="text-[11px] font-bold tracking-[0.08em] uppercase mb-2" style={{ color: "var(--text-3,#aaa)" }}>答题卡</div>
                  <div className="flex flex-wrap gap-[5px]">
                    {flt.map((c, i) => {
                      const s = scores[c.id];
                      const isCur = i === idx;
                      let bg = "#f3f4f6", color = "#888";
                      if (s === "ok") { bg = "#d1fae5"; color = "#065f46"; }
                      else if (s === "fail") { bg = "#fee2e2"; color = "#991b1b"; }
                      if (isCur) { bg = "#C05C00"; color = "#fff"; }
                      return (
                        <button key={c.id} onClick={() => { setIdx(i); setShow(false); }} title={c.q}
                          className="w-7 h-7 rounded-[6px] border-0 text-[11px] font-semibold cursor-pointer flex items-center justify-center transition-transform duration-100 hover:scale-110 hover:z-10"
                          style={{ background: bg, color }}>
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex flex-col gap-[3px]">
                    {[{ bg: "#d1fae5", label: "已掌握" }, { bg: "#fee2e2", label: "需复习" }, { bg: "#C05C00", label: "当前" }].map(({ bg, label }) => (
                      <div key={label} className="flex items-center gap-[5px] text-[11px]" style={{ color: "var(--text-3,#888)" }}>
                        <span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: bg }} />{label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Review answer sheet */}
              {mode === 2 && ws.length > 0 && (
                <div className="rounded-[10px] p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ background: "var(--surface,#fff)" }}>
                  <div className="text-[11px] font-bold tracking-[0.08em] uppercase mb-2" style={{ color: "var(--text-3,#aaa)" }}>错题卡</div>
                  <div className="flex flex-wrap gap-[5px]">
                    {ws.map((c, i) => (
                      <button key={c.id} onClick={() => setWIdx(i)} title={c.q}
                        className="w-7 h-7 rounded-[6px] border-0 text-[11px] font-semibold cursor-pointer flex items-center justify-center"
                        style={{ background: i === wIdx ? "#C05C00" : "#fee2e2", color: i === wIdx ? "#fff" : "#991b1b" }}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reset */}
              {mode === 0 && (
                <button onClick={() => { setDlg({ message: "重置所有成绩？（不会删除卡片）", onConfirm: resetData }); }}
                  className="bg-transparent border-0 text-[11px] cursor-pointer text-left py-1 hover:text-[var(--text-2)]"
                  style={{ color: "var(--text-3,#aaa)" }}>
                  重置成绩
                </button>
              )}
            </div>

            {/* ── Right content ── */}
            <div className="flex-1 min-w-0">

                {/* Review mode */}
                {mode === 2 && (
                  <div className="max-w-[740px] mx-auto px-4 py-5">
                    <div className="flex justify-between mb-4">
                      <h2 className="text-[20px] font-bold m-0 flex items-center gap-1.5" style={{ color: "var(--text-color,#111)" }}>
                        <BookMarked size={18} className="inline align-middle mr-1.5" /> 错题回顾
                      </h2>
                      <button onClick={() => setMode(0)} className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-(--app-border) bg-(--card-bg,#fff) cursor-pointer text-(--text-color,#777) text-[13px]">
                        <ChevronLeft size={14}/> 返回
                      </button>
                    </div>
                    {ws.length === 0
                      ? <div className="text-center p-10 rounded-[14px] shadow-[0_1px_4px_rgba(0,0,0,.06)]" style={{ background: "var(--card-bg,#fff)" }}>
                          <div className="text-[48px] leading-none mb-3">🎉</div>
                          <p style={{ color: "var(--text-3,#999)" }}>没有错题！</p>
                        </div>
                      : wCard && (
                        <>
                          <div className="rounded-[12px] p-[18px] mb-3.5 shadow-[0_1px_3px_rgba(0,0,0,.05)]" style={{ background: "var(--card-bg,#fff)" }}>
                            <div className="flex justify-between items-center mb-2">
                              <span className="inline-block px-2.5 py-[3px] rounded-[10px] text-[12px] font-semibold"
                                style={{ background: gc(wCard.category).badge, color: gc(wCard.category).text }}>
                                {wCard.category}
                              </span>
                              <span className="text-[12px]" style={{ color: "var(--text-3,#999)" }}>{wIdx + 1} / {ws.length}</span>
                            </div>
                            <div className="text-[15px] font-bold mt-2.5 mb-3" style={{ color: "var(--text-color,#111)" }}>{wCard.q}</div>
                            <Ans text={wCard.a} />
                            {wCard.tips && (
                              <div className="flex gap-1.5 rounded-[10px] px-3.5 py-2.5 text-[13px] leading-relaxed mb-3.5"
                                style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
                                <Lightbulb size={14} className="shrink-0" /><span>{wCard.tips}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between mt-4">
                            <button disabled={wIdx === 0} onClick={() => setWIdx(i => i - 1)}
                              className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-[10px] border border-(--app-border) bg-(--card-bg,#fff) cursor-pointer text-(--text-color,#555) text-[14px] disabled:opacity-40">
                              <ChevronLeft size={14}/> 上一题
                            </button>
                            <button disabled={wIdx === ws.length - 1} onClick={() => setWIdx(i => i + 1)}
                              className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-[10px] border border-(--app-border) bg-(--card-bg,#fff) cursor-pointer text-(--text-color,#555) text-[14px] disabled:opacity-40">
                              下一题 <ChevronRight size={14}/>
                            </button>
                          </div>
                        </>
                      )}
                  </div>
                )}

                {/* Progress bar */}
                {mode !== 2 && (
                  <>
                    <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--app-border,#e5e7eb)" }}>
                      <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#C05C00,#E07820)", width: `${pct}%`, transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)" }} />
                    </div>
                    <div className="text-[12px] text-right mb-3.5" style={{ color: "var(--text-3,#aaa)" }}>
                      {mode === 1 ? `${stats.ok + stats.fail}/${stats.total}` : `${cards.length ? idx + 1 : 0}/${cards.length}`}
                    </div>
                  </>
                )}

                {/* Card area */}
                {mode !== 2 && (cards.length === 0
                  ? <div className="text-center p-10 rounded-[14px] shadow-[0_1px_4px_rgba(0,0,0,.06)]" style={{ background: "var(--card-bg,#fff)" }}>
                      <p style={{ color: "var(--text-3,#999)" }}>暂无题目</p>
                      <button onClick={() => setShowCard("add")}
                        className="btn-fill btn-fill-primary inline-flex items-center gap-1.5 px-3.5 py-2 mt-3 rounded-[10px] border-0 font-semibold cursor-pointer text-white text-[13px] shadow-[0_2px_8px_rgba(192,92,0,.3)]"
                        style={{ background: "linear-gradient(135deg,#C05C00,#E07820)" }}>
                        ➕ 添加第一张卡片
                      </button>
                    </div>
                  : done
                    ? <div className="text-center p-10 rounded-[14px] shadow-[0_1px_4px_rgba(0,0,0,.06)]" style={{ background: "var(--card-bg,#fff)" }}>
                        <div className="text-[52px] mb-3">
                          {stats.ok === stats.total ? "🏆" : stats.ok > stats.fail ? "🎯" : "💪"}
                        </div>
                        <h2 className="text-[20px] font-bold mb-5" style={{ color: "var(--text-color,#111)" }}>测试完成！</h2>
                        <div className="flex justify-center gap-8 mb-6">
                          <div><div className="text-[30px] font-extrabold text-emerald-500">{stats.ok}</div><div className="text-[13px]" style={{ color: "var(--text-3,#999)" }}>掌握</div></div>
                          <div className="w-px h-10" style={{ background: "var(--app-border,#e5e7eb)" }} />
                          <div><div className="text-[30px] font-extrabold text-red-500">{stats.fail}</div><div className="text-[13px]" style={{ color: "var(--text-3,#999)" }}>复习</div></div>
                          <div className="w-px h-10" style={{ background: "var(--app-border,#e5e7eb)" }} />
                          <div><div className="text-[30px] font-extrabold" style={{ color: "#C05C00" }}>{stats.total ? Math.round(stats.ok / stats.total * 100) : 0}%</div><div className="text-[13px]" style={{ color: "var(--text-3,#999)" }}>正确率</div></div>
                        </div>
                        <div className="flex gap-2 justify-center">
                          <button onClick={startQ} className="btn-fill btn-fill-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border-0 font-semibold cursor-pointer text-white text-[13px] shadow-[0_2px_8px_rgba(192,92,0,.3)]" style={{ background: "linear-gradient(135deg,#C05C00,#E07820)" }}>再来一轮</button>
                          <button onClick={() => setMode(2)} className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-(--app-border) bg-(--card-bg,#fff) cursor-pointer text-(--text-color,#777) text-[13px]">查看错题</button>
                        </div>
                      </div>
                    : card
                      ? <div className="rounded-[14px] p-6 shadow-[0_1px_4px_rgba(0,0,0,.06)]" style={{ background: "var(--surface,#fff)" }}>
                          <div className="flex justify-between items-center">
                            <span className="inline-block px-2.5 py-[3px] rounded-[10px] text-[12px] font-semibold"
                              style={{ background: cc.badge, color: cc.text }}>
                              {card.category}
                            </span>
                            <div className="flex gap-2 items-center">
                              {mode === 0 && authed && <>
                                <button onClick={() => setShowCard(card)} aria-label="编辑卡片" className="bg-transparent border-0 cursor-pointer p-1.5 inline-flex hover:opacity-80" style={{ color: "var(--text-3,#aaa)" }}><Pencil size={14} aria-hidden="true"/></button>
                                <button onClick={() => { setDlg({ message: "删除这张卡片？", onConfirm: () => handleDeleteCard(card.id) }); }} aria-label="删除卡片" className="bg-transparent border-0 cursor-pointer p-1.5 inline-flex hover:opacity-80" style={{ color: "var(--text-3,#aaa)" }}><Trash2 size={14} aria-hidden="true"/></button>
                              </>}
                              <span className="text-[13px] font-semibold" style={{ color: "var(--text-3,#aaa)" }}>#{idx + 1}</span>
                            </div>
                          </div>
                          <AnimatePresence mode="wait" initial={false}>
                          <motion.div key={card.id}
                            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                            transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}>
                          <div className="text-[17px] font-bold leading-[1.5] my-3.5" style={{ color: "var(--text-1,#111)" }}>{card.q}</div>
                          <AnimatePresence mode="wait">
                            {!show
                              ? <motion.button key="show-btn" onClick={() => setShow(true)}
                                  className="w-full p-3.5 rounded-[12px] text-[15px] cursor-pointer font-semibold flex items-center justify-center gap-1.5 hover:border-orange-400 hover:text-orange-700"
                                  style={{ background: "var(--surface-2,#f9fafb)", border: "2px dashed var(--app-border,#e5e7eb)", color: "var(--text-3,#888)", animation: "pulse-border 1.8s ease-in-out infinite" }}
                                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                                  <Eye size={15}/> 查看答案
                                </motion.button>
                              : <motion.div key="answer"
                                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                  transition={{ duration: 0.2, ease: "easeOut" }}>
                                  <Ans text={card.a} />
                                  {card.tips && (
                                    <div className="flex gap-1.5 rounded-[10px] px-3.5 py-2.5 text-[13px] leading-relaxed mb-3.5"
                                      style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
                                      <Lightbulb size={14} className="shrink-0" /><span>{card.tips}</span>
                                    </div>
                                  )}
                                  {mode === 1
                                    ? <div className="flex gap-3">
                                        <button onClick={() => mark("fail")} className="btn-fill btn-fill-danger flex-1 p-3 rounded-xl text-[15px] cursor-pointer font-semibold active:scale-[0.97]" style={{ background: "#fef2f2", border: "2px solid #fecaca", color: "#dc2626" }}>😵 没记住</button>
                                        <button onClick={() => mark("ok")} className="btn-fill btn-fill-success flex-1 p-3 rounded-xl text-[15px] cursor-pointer font-semibold active:scale-[0.97]" style={{ background: "#f0fdf4", border: "2px solid #bbf7d0", color: "#16a34a" }}>✅ 记住了</button>
                                      </div>
                                    : <div className="flex justify-between gap-3">
                                        <button disabled={idx === 0} onClick={() => { setIdx(i => i - 1); setShow(false); }}
                                          className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-[10px] border border-(--app-border) bg-(--card-bg,#fff) cursor-pointer text-(--text-color,#555) text-[14px] disabled:opacity-40">
                                          <ChevronLeft size={14}/> 上一题
                                        </button>
                                        <button disabled={idx === cards.length - 1} onClick={() => { setIdx(i => i + 1); setShow(false); }}
                                          className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-[10px] border border-(--app-border) bg-(--card-bg,#fff) cursor-pointer text-(--text-color,#555) text-[14px] disabled:opacity-40">
                                          下一题 <ChevronRight size={14}/>
                                        </button>
                                      </div>
                                  }
                                </motion.div>
                            }
                          </AnimatePresence>
                          </motion.div>
                          </AnimatePresence>
                        </div>
                      : null
                )}

                {/* Quiz score bar */}
                {mode === 1 && !done && (
                  <div className="text-center mt-3.5 text-[15px] font-semibold">
                    <span className="text-emerald-500">✓ {stats.ok}</span>
                    <span className="mx-2.5" style={{ color: "var(--text-3,#aaa)" }}>|</span>
                    <span className="text-red-500">✗ {stats.fail}</span>
                  </div>
                )}
              </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
