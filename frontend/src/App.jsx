import { useState, useCallback, useRef, useEffect } from "react";
import {
  fetchDecks, createDeck, deleteDeck,
  createCard, updateCard, deleteCard as apiDeleteCard,
  fetchScores, saveScore, resetAll,
} from "./api";

/* ── Category colors ── */
const CAT_C = {
  "基础类型":   { border: "#FB923C", text: "#C2410C", badge: "#FFEDD5" },
  "核心概念":   { border: "#60A5FA", text: "#1D4ED8", badge: "#DBEAFE" },
  "函数":       { border: "#34D399", text: "#047857", badge: "#D1FAE5" },
  "面向对象":   { border: "#A78BFA", text: "#6D28D9", badge: "#EDE9FE" },
  "并发编程":   { border: "#FBBF24", text: "#B45309", badge: "#FEF9C3" },
  "高频实战":   { border: "#F472B6", text: "#BE185D", badge: "#FCE7F3" },
};
const EX_C = [
  { border: "#F87171", text: "#B91C1C", badge: "#FEE2E2" },
  { border: "#38BDF8", text: "#0369A1", badge: "#E0F2FE" },
  { border: "#4ADE80", text: "#15803D", badge: "#DCFCE7" },
  { border: "#E879F9", text: "#A21CAF", badge: "#FAE8FF" },
  { border: "#2DD4BF", text: "#0F766E", badge: "#CCFBF1" },
];
function gc(c) {
  if (CAT_C[c]) return CAT_C[c];
  let h = 0;
  for (let i = 0; i < c.length; i++) h = ((h << 5) - h + c.charCodeAt(i)) | 0;
  return EX_C[Math.abs(h) % EX_C.length];
}

/* ── Shuffle ── */
function shuf(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = 0 | Math.random() * (i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/* ── JSON repair for AI output ── */
function fixJ(raw) {
  let s = raw.replace(/```json|```/g, "").trim();
  try { const r = JSON.parse(s); if (Array.isArray(r)) return r; } catch (e) { void e; }
  const a = s.indexOf("[");
  if (a < 0) return null;
  s = s.slice(a);
  try { const r = JSON.parse(s); if (Array.isArray(r)) return r; } catch (e) { void e; }
  let last = -1, d = 0, inS = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inS = !inS; continue; }
    if (inS) continue;
    if (c === "{") d++;
    if (c === "}") { d--; if (d === 0) last = i; }
  }
  if (last > 0) {
    let t = s.slice(0, last + 1) + "]";
    if (!t.startsWith("[")) t = "[" + t;
    try { const r = JSON.parse(t); if (Array.isArray(r)) return r; } catch (e) { void e; }
  }
  const objs = [];
  const re = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    try { const o = JSON.parse(m[0]); if (o.q || o.question) objs.push(o); } catch (e) { void e; }
  }
  return objs.length ? objs : null;
}

/* ── PDF / DOCX loaders ── */
async function loadPdf() {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      const l = window.pdfjsLib;
      l.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      res(l);
    };
    s.onerror = () => rej(new Error("pdf.js加载失败"));
    document.head.appendChild(s);
  });
}
async function pdfTxt(f) {
  const lib = await loadPdf();
  const buf = await f.arrayBuffer();
  const pdf = await lib.getDocument({ data: buf }).promise;
  let t = "";
  for (let i = 1; i <= pdf.numPages && t.length < 30000; i++) {
    const p = await pdf.getPage(i);
    const c = await p.getTextContent();
    t += c.items.map(x => x.str).join(" ") + "\n\n";
  }
  return t.slice(0, 30000);
}
async function docTxt(f) {
  return (await f.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 30000);
}

/* ── Code block renderer ── */
function Ans({ text }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div>
      {parts.map((p, i) => {
        if (p.startsWith("```")) {
          const lines = p.slice(3, -3);
          const nl = lines.indexOf("\n");
          return <pre key={i} style={codeSt}><code>{nl > -1 ? lines.slice(nl + 1) : lines}</code></pre>;
        }
        if (!p.trim()) return null;
        return <pre key={i} style={txtSt}>{p}</pre>;
      })}
    </div>
  );
}

/* ── Edit / Add Card Modal ── */
function CardModal({ onClose, onSave, categories, initial }) {
  const isEdit = !!initial;
  const [q, setQ] = useState(initial?.q || "");
  const [a, setA] = useState(initial?.a || "");
  const [t, setT] = useState(initial?.tips || "");
  const [cat, setCat] = useState(initial?.category || categories[0] || "");
  const [newCat, setNewCat] = useState("");

  const submit = () => {
    if (!q.trim() || !a.trim()) return;
    const c = newCat.trim() || cat;
    onSave({ id: initial?.id, category: c, q: q.trim(), a: a.trim(), tips: t.trim() });
    onClose();
  };

  return (
    <div style={overlay}>
      <div style={overlayBg} onClick={onClose} />
      <div style={modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-color,#111)" }}>
            {isEdit ? "✏️ 编辑卡片" : "➕ 添加卡片"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#999" }}>✕</button>
        </div>
        <label style={lb}>分类</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...inp, flex: 1, minWidth: 120 }}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="或输入新分类" style={{ ...inp, flex: 1 }} />
        </div>
        <label style={lb}>问题 *</label>
        <textarea value={q} onChange={e => setQ(e.target.value)} placeholder="面试官会怎么问？" style={{ ...inp, height: 60, resize: "vertical" }} />
        <label style={{ ...lb, marginTop: 12 }}>答案 *（用```包裹代码块）</label>
        <textarea value={a} onChange={e => setA(e.target.value)}
          placeholder={"答案要点...\n\n```python\nprint('代码放这里')\n```"}
          style={{ ...inp, height: 140, resize: "vertical", fontFamily: "Menlo,monospace", fontSize: 13 }} />
        <label style={{ ...lb, marginTop: 12 }}>💡 面试小贴士</label>
        <input value={t} onChange={e => setT(e.target.value)} placeholder="一句话提示" style={inp} />
        <button onClick={submit} disabled={!q.trim() || !a.trim()}
          style={{ ...btnP, width: "100%", marginTop: 16, padding: 12, fontSize: 15, opacity: (!q.trim() || !a.trim()) ? .5 : 1 }}>
          {isEdit ? "💾 保存修改" : "➕ 添加"}
        </button>
      </div>
    </div>
  );
}

/* ── AI Generate Modal ── */
function AIGenModal({ onClose, onAdd }) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(""); setProgress("AI正在生成...");
    try {
      const sys = `Generate ${count} interview flashcards about "${topic}". Rules: 1.Questions in conversational Chinese. 2.Answers concise ≤150 words, use \`\`\`python for code. 3.Create 3-5 categories. 4.JSON array only:[{"category":"...","q":"...","a":"...","tips":"..."}] 5.Complete the array. 6.All Chinese.`;
      const resp = await fetch(`${import.meta.env.VITE_API_BASE}/api/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 8000, system: sys, messages: [{ role: "user", content: `生成「${topic}」的${count}道面试题` }] }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      setProgress("解析中...");
      const data = await resp.json();
      const parsed = fixJ(data.content.map(b => b.text || "").join(""));
      if (!parsed?.length) throw new Error("解析失败");
      const cards = parsed
        .map(it => ({ category: it.category || topic, q: it.q || "", a: it.a || "", tips: it.tips || "" }))
        .filter(c => c.q && c.a);
      if (!cards.length) throw new Error("未生成有效题目");
      onAdd(cards);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); setProgress(""); }
  };

  return (
    <div style={overlay}><div style={overlayBg} onClick={onClose} /><div style={modal}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-color,#111)" }}>🤖 AI 快速生成</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#999" }}>✕</button>
      </div>
      <label style={lb}>主题</label>
      <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="如：机器学习、Pandas、SQL..." style={inp} />
      <label style={{ ...lb, marginTop: 12 }}>题数</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["5", "10", "15", "20"].map(n => (
          <button key={n} onClick={() => setCount(n)}
            style={{ padding: "6px 16px", borderRadius: 8, border: count === n ? "none" : "1px solid #e5e7eb", background: count === n ? "#6366f1" : "var(--card-bg,#fff)", color: count === n ? "#fff" : "#777", cursor: "pointer", fontSize: 13 }}>
            {n}题
          </button>
        ))}
      </div>
      {error && <div style={errSt}>{error}</div>}
      {progress && <div style={progSt}><span style={spin} />{progress}</div>}
      <button onClick={generate} disabled={loading || !topic.trim()}
        style={{ ...btnP, width: "100%", padding: 12, fontSize: 15, opacity: (!topic.trim() || loading) ? .5 : 1 }}>
        {loading ? "⏳ 生成中..." : "🎯 生成题目"}
      </button>
    </div></div>
  );
}

/* ── Import Modal ── */
function ImportModal({ onClose, onImport }) {
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [fn, setFn] = useState("");
  const fr = useRef();

  const hf = async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(""); setFn(f.name);
    const ext = f.name.split(".").pop().toLowerCase();
    if (!topic) setTopic(f.name.replace(/\.[^.]+$/, ""));
    try {
      setProgress("读取...");
      let c = "";
      if (ext === "pdf") c = await pdfTxt(f);
      else if (ext === "docx" || ext === "doc") c = await docTxt(f);
      else c = await f.text();
      if (!c || c.trim().length < 20) { setError("文件为空"); setProgress(""); return; }
      setText(c.slice(0, 30000)); setProgress("");
    } catch (err) { setError(err.message); setProgress(""); }
  };

  const hp = async () => {
    if (!text.trim()) return;
    setLoading(true); setError(""); setProgress("分析...");
    try {
      const n = text.length > 10000 ? 20 : text.length > 5000 ? 15 : 12;
      const sys = `Extract ${n} interview questions. Conversational Chinese, ≤150 word answers with \`\`\`python, 3-6 categories, JSON array only, complete it.`;
      const resp = await fetch(`${import.meta.env.VITE_API_BASE}/api/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 8000, system: sys, messages: [{ role: "user", content: `Topic:${topic || "未指定"}\n\n${text.slice(0, 15000)}` }] }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      setProgress("生成...");
      const data = await resp.json();
      const parsed = fixJ(data.content.map(b => b.text || "").join(""));
      if (!parsed?.length) throw new Error("解析失败");
      const cards = parsed
        .map(it => ({ category: it.category || topic || "导入", q: it.q || "", a: it.a || "", tips: it.tips || "" }))
        .filter(c => c.q && c.a);
      if (!cards.length) throw new Error("未解析出题目");
      onImport(cards, topic || "自定义");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); setProgress(""); }
  };

  return (
    <div style={overlay}><div style={overlayBg} onClick={onClose} /><div style={{ ...modal, maxHeight: "85vh", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-color,#111)" }}>📥 导入文档</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#999" }}>✕</button>
      </div>
      <label style={lb}>题库名称</label>
      <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="如：机器学习" style={inp} />
      <label style={{ ...lb, marginTop: 12 }}>上传或粘贴</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <button onClick={() => fr.current?.click()} style={{ ...btnG, padding: "6px 14px" }}>📎 选择文件</button>
        {fn ? <span style={{ fontSize: 13, color: "#10b981" }}>✓ {fn}</span> : <span style={{ fontSize: 12, color: "#999" }}>PDF/TXT/MD/DOCX</span>}
      </div>
      <input ref={fr} type="file" accept=".pdf,.txt,.md,.csv,.json,.html,.docx,.doc" onChange={hf} style={{ display: "none" }} />
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="粘贴笔记/面试题..."
        style={{ ...inp, height: 150, resize: "vertical", fontFamily: "inherit" }} />
      {error && <div style={{ ...errSt, marginTop: 8 }}>{error}</div>}
      {progress && <div style={{ ...progSt, marginTop: 8 }}><span style={spin} />{progress}</div>}
      <button onClick={hp} disabled={loading || !text.trim()}
        style={{ ...btnP, width: "100%", marginTop: 12, padding: 12, fontSize: 15, opacity: (!text.trim() || loading) ? .5 : 1 }}>
        {loading ? "⏳ 解析中..." : "🤖 AI解析"}
      </button>
    </div></div>
  );
}

/* ════════════════════════════════════
   MAIN APP
   ════════════════════════════════════ */
export default function App() {
  // ── State ──
  const [decks, setDecks] = useState([]);          // [{id, name, cards:[]}]
  const [di, setDi] = useState(0);                 // active deck index
  const [mode, setMode] = useState(0);             // 0=browse 1=quiz 2=review
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(false);
  const [cat, setCat] = useState("全部");
  const [scores, setScores] = useState({});        // {card_id: 'ok'|'fail'}
  const [quiz, setQuiz] = useState([]);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ ok: 0, fail: 0, total: 0 });
  const [showImp, setShowImp] = useState(false);
  const [showCard, setShowCard] = useState(null);  // null | 'add' | card_object
  const [showAI, setShowAI] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // ── Load from backend on mount ──
  useEffect(() => {
    (async () => {
      try {
        const [rawDecks, rawScores] = await Promise.all([fetchDecks(), fetchScores()]);
        const normalized = (rawDecks || []).map(dk => ({
          ...dk,
          cards: (dk.cards || []).map(c => ({ ...c, category: c.category || "未分类", tips: c.tips || "" })),
        }));
        setDecks(normalized);
        // rawScores: [{card_id, result}]
        const scoreMap = {};
        (rawScores || []).forEach(s => { scoreMap[s.card_id] = s.result; });
        setScores(scoreMap);
      } catch (e) { console.error("加载失败:", e); }
      setLoaded(true);
    })();
  }, []);

  // ── Derived ──
  const dk = decks[di] || decks[0];
  const all = dk?.cards || [];
  const cats = [...new Set(all.map(c => c.category))];
  const flt = cat === "全部" ? all : all.filter(c => c.category === cat);
  const cards = mode === 1 ? quiz : flt;
  const card = cards[idx];
  const mastered = Object.values(scores).filter(v => v === "ok").length;
  const wrongs = Object.values(scores).filter(v => v === "fail").length;
  const pct = cards.length
    ? (mode === 1 ? (stats.ok + stats.fail) / stats.total * 100 : (idx + 1) / cards.length * 100)
    : 0;

  const flashSave = () => { setSaveMsg("已保存 ✓"); setTimeout(() => setSaveMsg(""), 1500); };

  // ── Quiz ──
  const startQ = useCallback(() => {
    const p = flt.filter(q => scores[q.id] !== "ok");
    const o = shuf(p.length ? p : flt);
    setQuiz(o); setIdx(0); setShow(false); setDone(false);
    setStats({ ok: 0, fail: 0, total: o.length });
    setMode(1);
  }, [flt, scores]);

  const mark = async r => {
    await saveScore(card.id, r).catch(() => {});
    setScores(p => ({ ...p, [card.id]: r }));
    setStats(s => ({ ...s, [r]: s[r] + 1 }));
    if (idx < cards.length - 1) { setIdx(i => i + 1); setShow(false); }
    else setDone(true);
  };

  // ── CRUD ──
  const saveCard = async (c) => {
    if (c.id) {
      // edit existing
      await updateCard(c.id, { category: c.category, q: c.q, a: c.a, tips: c.tips });
      setDecks(d => d.map((dk, i) => {
        if (i !== di) return dk;
        const cards = dk.cards.map(x => x.id === c.id ? c : x);
        return { ...dk, cards };
      }));
    } else {
      // add new
      await createCard(dk.id, { category: c.category, q: c.q, a: c.a, tips: c.tips });
      // re-fetch deck to get server-assigned id
      const fresh = await fetchDecks();
      const normalized = fresh.map(d => ({
        ...d,
        cards: (d.cards || []).map(x => ({ ...x, category: x.category || "未分类", tips: x.tips || "" })),
      }));
      setDecks(normalized);
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

  // AI-generated cards → add to current deck
  const addCards = async (cs) => {
    for (const c of cs) {
      await createCard(dk.id, { category: c.category, q: c.q, a: c.a, tips: c.tips }).catch(() => {});
    }
    const fresh = await fetchDecks();
    const normalized = fresh.map(d => ({
      ...d,
      cards: (d.cards || []).map(x => ({ ...x, category: x.category || "未分类", tips: x.tips || "" })),
    }));
    setDecks(normalized);
    setShowAI(false);
    flashSave();
  };

  // Import → create new deck
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
    if (i === 0) return; // protect first deck
    await deleteDeck(decks[i].id).catch(() => {});
    setDecks(d => d.filter((_, j) => j !== i));
    if (di >= i) setDi(Math.max(0, di - 1));
    setCat("全部"); setIdx(0); setMode(0);
  };

  const sw = (i) => { setDi(i); setCat("全部"); setIdx(0); setShow(false); setMode(0); };

  const resetData = async () => {
    await resetAll().catch(() => {});
    const fresh = await fetchDecks();
    const normalized = fresh.map(d => ({
      ...d,
      cards: (d.cards || []).map(x => ({ ...x, category: x.category || "未分类", tips: x.tips || "" })),
    }));
    setDecks(normalized);
    setScores({});
    setDi(0); setCat("全部"); setIdx(0); setMode(0);
  };

  // ── Color for current card ──
  const cc = card ? gc(card.category) : { border: "#ccc", text: "#666", badge: "#f3f4f6" };

  if (!loaded) return <div style={{ ...W, textAlign: "center", paddingTop: 80 }}><p style={{ color: "#999" }}>加载中...</p></div>;

  // ── Review mode ──
  if (mode === 2) {
    const ws = all.filter(q => scores[q.id] === "fail");
    return (
      <div style={W}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={H2}>📖 错题回顾</h2>
          <button onClick={() => setMode(0)} style={btnG}>← 返回</button>
        </div>
        {ws.length === 0
          ? <div style={ctr}><div style={{ fontSize: 48 }}>🎉</div><p style={{ color: "#999", marginTop: 12 }}>没有错题！</p></div>
          : ws.map(q => {
            const c = gc(q.category);
            return (
              <div key={q.id} style={rCard}>
                <span style={{ ...bdg, background: c.badge, color: c.text }}>{q.category}</span>
                <div style={{ fontSize: 15, fontWeight: 700, margin: "10px 0 12px", color: "var(--text-color,#111)" }}>{q.q}</div>
                <Ans text={q.a} />
                {q.tips && <div style={tip}><span>💡</span><span>{q.tips}</span></div>}
              </div>
            );
          })}
      </div>
    );
  }

  // ── Main layout ──
  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', minHeight: "100vh", background: "#f8f8fa" }}>
      {showImp && <ImportModal onClose={() => setShowImp(false)} onImport={impDeck} />}
      {showCard !== null && (
        <CardModal
          onClose={() => setShowCard(null)}
          onSave={saveCard}
          categories={cats.length ? cats : ["默认"]}
          initial={showCard === "add" ? null : showCard}
        />
      )}
      {showAI && <AIGenModal onClose={() => setShowAI(false)} onAdd={addCards} />}

      {/* Top header bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>🧠 八股文速记</span>
          <span style={{ marginLeft: 12, color: "#999", fontSize: 13 }}>
            {dk?.name} · {all.length}题 · 已掌握 <span style={{ color: "#10b981", fontWeight: 700 }}>{mastered}</span>
            {saveMsg && <span style={{ marginLeft: 8, color: "#10b981", fontSize: 12 }}>{saveMsg}</span>}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {mode === 1
            ? <button onClick={() => setMode(0)} style={btnG}>← 退出测试</button>
            : <>
              <button onClick={() => setShowCard("add")} style={{ ...btnG, borderStyle: "dashed" }} title="手动添加">➕</button>
              <button onClick={() => setShowAI(true)} style={{ ...btnG, borderStyle: "dashed" }} title="AI生成">🤖</button>
              <button onClick={() => setShowImp(true)} style={{ ...btnG, borderStyle: "dashed" }} title="导入文档">📥</button>
              <button onClick={() => setMode(2)} style={btnG}>📖{wrongs > 0 ? ` ${wrongs}` : ""}</button>
              <button onClick={startQ} style={btnP}>🧪 测试</button>
            </>}
        </div>
      </div>

      <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "20px 16px", gap: 20, alignItems: "flex-start" }}>

        {/* ── Left sidebar ── */}
        <div style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Deck list */}
          {decks.length > 1 && mode === 0 && (
            <div style={sideSection}>
              <div style={sideLabel}>题库</div>
              {decks.map((d, i) => (
                <div key={d.id} onClick={() => sw(i)}
                  style={{ ...sideItem, background: i === di ? "#6366f1" : "transparent", color: i === di ? "#fff" : "#555", fontWeight: i === di ? 600 : 400 }}>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                  <span style={{ fontSize: 11, opacity: .6 }}>{d.cards.length}</span>
                  {i > 0 && (
                    <span onClick={e => { e.stopPropagation(); if (confirm(`删除「${d.name}」？`)) rmDeck(i); }}
                      style={{ fontSize: 13, opacity: .5, cursor: "pointer", marginLeft: 2 }}>×</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Category filter */}
          {mode === 0 && cats.length > 0 && (
            <div style={sideSection}>
              <div style={sideLabel}>分类</div>
              {["全部", ...cats].map(c => {
                const count = c === "全部" ? all.length : all.filter(q => q.category === c).length;
                const active = cat === c;
                return (
                  <div key={c} onClick={() => { setCat(c); setIdx(0); setShow(false); }}
                    style={{ ...sideItem, background: active ? "#6366f1" : "transparent", color: active ? "#fff" : "#555", fontWeight: active ? 600 : 400 }}>
                    <span style={{ flex: 1 }}>{c}</span>
                    <span style={{ fontSize: 11, opacity: .6 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Answer sheet */}
          {mode === 0 && flt.length > 0 && (
            <div style={sideSection}>
              <div style={sideLabel}>答题卡</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {flt.map((c, i) => {
                  const s = scores[c.id];
                  const isCur = i === idx;
                  let bg = "#f3f4f6";
                  let color = "#888";
                  if (s === "ok") { bg = "#d1fae5"; color = "#065f46"; }
                  else if (s === "fail") { bg = "#fee2e2"; color = "#991b1b"; }
                  if (isCur) { bg = "#6366f1"; color = "#fff"; }
                  return (
                    <button key={c.id} onClick={() => { setIdx(i); setShow(false); }}
                      title={c.q}
                      style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: bg, color, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#888" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "#d1fae5", display: "inline-block" }} />已掌握
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#888" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "#fee2e2", display: "inline-block" }} />需复习
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#888" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "#6366f1", display: "inline-block" }} />当前
                </div>
              </div>
            </div>
          )}

          {/* Reset */}
          {mode === 0 && (
            <button onClick={() => { if (confirm("重置所有成绩？（不会删除卡片）")) resetData(); }}
              style={{ background: "none", border: "none", color: "#ccc", fontSize: 11, cursor: "pointer", textAlign: "left", padding: "4px 0" }}>
              重置成绩
            </button>
          )}
        </div>

        {/* ── Right content ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Progress bar */}
          <div style={{ height: 4, background: "#e5e7eb", borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 4, transition: "width .3s", width: `${pct}%` }} />
          </div>
          <div style={{ fontSize: 12, color: "#ccc", textAlign: "right", marginBottom: 14 }}>
            {mode === 1 ? `${stats.ok + stats.fail}/${stats.total}` : `${cards.length ? idx + 1 : 0}/${cards.length}`}
          </div>

          {/* Card area */}
          {cards.length === 0
            ? <div style={ctr}>
              <p style={{ color: "#999" }}>暂无题目</p>
              <button onClick={() => setShowCard("add")} style={{ ...btnP, marginTop: 12 }}>➕ 添加第一张卡片</button>
            </div>
            : done
              ? <div style={ctr}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>
                  {stats.ok === stats.total ? "🏆" : stats.ok > stats.fail ? "🎯" : "💪"}
                </div>
                <h2 style={{ ...H2, marginBottom: 20 }}>测试完成！</h2>
                <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 24 }}>
                  <div><div style={{ fontSize: 30, fontWeight: 800, color: "#10b981" }}>{stats.ok}</div><div style={{ color: "#999", fontSize: 13 }}>掌握</div></div>
                  <div style={{ width: 1, height: 40, background: "#e5e7eb" }} />
                  <div><div style={{ fontSize: 30, fontWeight: 800, color: "#ef4444" }}>{stats.fail}</div><div style={{ color: "#999", fontSize: 13 }}>复习</div></div>
                  <div style={{ width: 1, height: 40, background: "#e5e7eb" }} />
                  <div><div style={{ fontSize: 30, fontWeight: 800, color: "#6366f1" }}>{stats.total ? Math.round(stats.ok / stats.total * 100) : 0}%</div><div style={{ color: "#999", fontSize: 13 }}>正确率</div></div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button onClick={startQ} style={btnP}>再来一轮</button>
                  <button onClick={() => setMode(2)} style={btnG}>查看错题</button>
                </div>
              </div>
              : card
                ? <div style={{ background: "#fff", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderLeft: `4px solid ${cc.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ ...bdg, background: cc.badge, color: cc.text }}>{card.category}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {mode === 0 && <>
                        <button onClick={() => setShowCard(card)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#aaa", padding: 2 }} title="编辑">✏️</button>
                        <button onClick={() => { if (confirm("删除这张卡片？")) handleDeleteCard(card.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#aaa", padding: 2 }} title="删除">🗑️</button>
                      </>}
                      <span style={{ color: "#ddd", fontSize: 13, fontWeight: 600 }}>#{idx + 1}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.5, margin: "14px 0 18px", color: "#111" }}>{card.q}</div>
                  {!show
                    ? <button onClick={() => setShow(true)} style={showB}>👁 查看答案</button>
                    : <>
                      <Ans text={card.a} />
                      {card.tips && <div style={tip}><span>💡</span><span>{card.tips}</span></div>}
                      {mode === 1
                        ? <div style={{ display: "flex", gap: 12 }}>
                          <button onClick={() => mark("fail")} style={{ flex: 1, padding: 12, background: "#fef2f2", border: "2px solid #fecaca", borderRadius: 12, fontSize: 15, cursor: "pointer", color: "#dc2626", fontWeight: 600 }}>😵 没记住</button>
                          <button onClick={() => mark("ok")} style={{ flex: 1, padding: 12, background: "#f0fdf4", border: "2px solid #bbf7d0", borderRadius: 12, fontSize: 15, cursor: "pointer", color: "#16a34a", fontWeight: 600 }}>✅ 记住了</button>
                        </div>
                        : <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <button disabled={idx === 0} onClick={() => { setIdx(i => i - 1); setShow(false); }} style={btnN}>← 上一题</button>
                          <button disabled={idx === cards.length - 1} onClick={() => { setIdx(i => i + 1); setShow(false); }} style={btnN}>下一题 →</button>
                        </div>}
                    </>}
                </div>
                : null}

          {/* Quiz score bar */}
          {mode === 1 && !done && (
            <div style={{ textAlign: "center", marginTop: 14, fontSize: 15, fontWeight: 600 }}>
              <span style={{ color: "#10b981" }}>✓ {stats.ok}</span>
              <span style={{ color: "#ccc", margin: "0 10px" }}>|</span>
              <span style={{ color: "#ef4444" }}>✗ {stats.fail}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Styles ── */
const W = { maxWidth: 740, margin: "0 auto", padding: "20px 16px", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' };
const H2 = { fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text-color,#111)" };
const btnG = { padding: "8px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "var(--card-bg,#fff)", cursor: "pointer", color: "#777", fontSize: 13 };
const btnP = { padding: "8px 14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13, boxShadow: "0 2px 8px rgba(99,102,241,.3)" };
const btnN = { padding: "9px 18px", borderRadius: 10, border: "1px solid #e5e7eb", background: "var(--card-bg,#fff)", cursor: "pointer", color: "#555", fontSize: 14 };
const ctr = { textAlign: "center", padding: 40, background: "var(--card-bg,#fff)", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)" };
const tip = { display: "flex", gap: 6, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#92400e", lineHeight: 1.5, marginBottom: 14 };
const bdg = { display: "inline-block", padding: "3px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600 };
const showB = { width: "100%", padding: 14, background: "linear-gradient(135deg,#f9fafb,#f3f4f6)", border: "2px dashed #e5e7eb", borderRadius: 12, fontSize: 15, cursor: "pointer", color: "#888", fontWeight: 600 };
const rCard = { background: "var(--card-bg,#fff)", borderRadius: 12, padding: 18, marginBottom: 14, boxShadow: "0 1px 3px rgba(0,0,0,.05)" };
const overlay = { position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const overlayBg = { position: "absolute", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(4px)" };
const modal = { position: "relative", background: "var(--card-bg,#fff)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,.2)" };
const lb = { fontSize: 13, fontWeight: 600, color: "var(--text-color,#555)", display: "block", marginBottom: 6 };
const inp = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, boxSizing: "border-box", background: "var(--card-bg,#fff)", color: "var(--text-color,#333)", outline: "none" };
const sideSection = { background: "#fff", borderRadius: 10, padding: "12px", boxShadow: "0 1px 3px rgba(0,0,0,.06)" };
const sideLabel = { fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 };
const sideItem = { display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 7, fontSize: 13, cursor: "pointer", marginBottom: 2 };
const codeSt = { background: "#1e1e2e", color: "#cdd6f4", padding: "14px 16px", borderRadius: 10, fontSize: 13, lineHeight: 1.6, overflowX: "auto", margin: "6px 0 10px", fontFamily: "Menlo,Monaco,monospace", border: "1px solid #313244", whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "left" };
const txtSt = { background: "transparent", padding: 0, margin: "0 0 4px", fontSize: 13.5, lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: '-apple-system,sans-serif', color: "var(--text-color,#374151)", textAlign: "left" };
const errSt = { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#dc2626", marginBottom: 12 };
const progSt = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#2563eb", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 };
const spin = { display: "inline-block", width: 16, height: 16, border: "2px solid #93c5fd", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" };
