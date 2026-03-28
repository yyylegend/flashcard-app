import { useState, useEffect, useCallback, useMemo } from "react";
import { FilePlus, Upload, Sparkles, Pencil, Trash2, Eye, EyeOff, Lock, Loader2, FileText } from "lucide-react";
import { toast } from "react-hot-toast";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import markedKatex from "marked-katex-extension";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";
import { fetchNotes, fetchNote, createNote, updateNote, deleteNote, getToken } from "./api";

// ── Build a fresh Marked instance with heading IDs + highlight.js + KaTeX ──
function renderMd(content) {
  const counts = {};
  const instance = new Marked();
  instance.use(markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    }
  }));
  instance.use(markedKatex({ throwOnError: false, output: "html" }));
  instance.use({
    breaks: true,
    gfm: true,
    renderer: {
      heading({ text, depth }) {
        const clean = text.replace(/<[^>]+>/g, "");
        let slug = clean.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "");
        counts[slug] = (counts[slug] || 0) + 1;
        if (counts[slug] > 1) slug = `${slug}-${counts[slug]}`;
        return `<h${depth} id="${slug}">${text}</h${depth}>\n`;
      }
    }
  });
  return instance.parse(content || "");
}

// ── Extract h2-only headings, skip code blocks ──
function extractHeadings(md) {
  const headings = [];
  const counts = {};
  let inCode = false;
  for (const line of (md || "").split("\n")) {
    if (line.trimStart().startsWith("```")) { inCode = !inCode; continue; }
    if (inCode) continue;
    const m = line.match(/^##\s+(.+)/);
    if (!m) continue;
    const text = m[1].replace(/[*_`[\]()]/g, "").trim();
    let slug = text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "");
    counts[slug] = (counts[slug] || 0) + 1;
    if (counts[slug] > 1) slug = `${slug}-${counts[slug]}`;
    headings.push({ level: 2, text, slug });
  }
  return headings;
}

const btnP = { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 600, cursor: "pointer", fontSize: 13, boxShadow: "0 2px 8px rgba(99,102,241,.25)" };
const btnG = { background: "var(--surface,#fff)", color: "var(--text-2,#374151)", border: "1px solid var(--app-border,#e5e7eb)", borderRadius: 8, padding: "6px 14px", fontWeight: 500, cursor: "pointer", fontSize: 13 };
const btnR = { background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 14px", fontWeight: 500, cursor: "pointer", fontSize: 13 };
const inp = { border: "1px solid var(--app-border,#e5e7eb)", borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit", background: "var(--surface,#fff)", color: "var(--text-2,#374151)" };

function ConfirmDlg({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ background: "var(--surface,#fff)", borderRadius: 14, padding: 28, maxWidth: 360, width: "90%", boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
        <p style={{ margin: "0 0 22px", fontSize: 15, color: "var(--text-2,#374151)", lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={btnG}>取消</button>
          <button onClick={onConfirm} style={{ ...btnP, background: "#ef4444", boxShadow: "none" }}>确认删除</button>
        </div>
      </div>
    </div>
  );
}

function TagBadge({ tag }) {
  return (
    <span style={{ background: "#eef2ff", color: "#4f46e5", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 500 }}>
      #{tag.trim()}
    </span>
  );
}

// ── Table of Contents sidebar (h2 only) ──
function TocPanel({ headings, activeSlug }) {
  if (!headings.length) return null;
  return (
    <div style={{ width: 160, flexShrink: 0, position: "sticky", top: 20, alignSelf: "flex-start", background: "var(--surface,#fff)", borderRadius: 12, border: "1px solid var(--app-border,#e5e7eb)", padding: "14px 12px", maxHeight: "80vh", overflowY: "auto" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3,#aaa)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>目录</div>
      {headings.map((h, i) => (
        <div
          key={i}
          onClick={() => {
            const el = document.getElementById(h.slug);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          style={{
            padding: "5px 8px",
            fontSize: 12,
            lineHeight: 1.45,
            cursor: "pointer",
            borderRadius: 5,
            color: activeSlug === h.slug ? "#6366f1" : "var(--text-2,#555)",
            fontWeight: activeSlug === h.slug ? 600 : 400,
            background: activeSlug === h.slug ? "var(--accent-soft,#eef2ff)" : "transparent",
            marginBottom: 2,
            wordBreak: "break-all",
          }}
        >
          {h.text}
        </div>
      ))}
    </div>
  );
}

function fmtDate(s) {
  if (!s) return "";
  const d = new Date(s + (s.includes("T") ? "" : "Z"));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NotesView({ authed, authUser, onImportCards }) {
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ title: "", content: "", tags: "" });
  const [creating, setCreating] = useState(false);
  const [loadingNote, setLoadingNote] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [dlg, setDlg] = useState(null);
  const [preview, setPreview] = useState(false);
  const [activeSlug, setActiveSlug] = useState("");

  const loadNotes = useCallback(async () => {
    if (!authed) return;
    try {
      const data = await fetchNotes();
      setNotes(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  }, [authed]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // Track active heading via IntersectionObserver
  useEffect(() => {
    if (!note || editing) return;
    const headings = document.querySelectorAll(".md-preview h1, .md-preview h2, .md-preview h3, .md-preview h4");
    if (!headings.length) return;
    const obs = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length) setActiveSlug(visible[0].target.id);
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 }
    );
    headings.forEach(h => obs.observe(h));
    return () => obs.disconnect();
  }, [note, editing]);

  const openNote = async (id) => {
    setCreating(false);
    setEditing(false);
    setSelected(id);
    setGenMsg("");
    setActiveSlug("");
    setLoadingNote(true);
    try {
      const data = await fetchNote(id);
      setNote(data);
    } catch (e) { console.error(e); }
    setLoadingNote(false);
  };

  const startEdit = () => {
    setEditData({ title: note.title, content: note.content, tags: note.tags || "" });
    setPreview(false);
    setEditing(true);
  };

  const saveEdit = async () => {
    await updateNote(note.id, editData);
    setNote({ ...note, ...editData });
    setNotes(notes.map(n => n.id === note.id ? { ...n, title: editData.title, tags: editData.tags } : n));
    setEditing(false);
    toast.success("笔记已保存");
  };

  const handleDelete = () => {
    setDlg({
      message: `确认删除笔记「${note.title}」？此操作不可撤销。`,
      onConfirm: async () => {
        await deleteNote(note.id);
        setNotes(notes.filter(n => n.id !== note.id));
        setSelected(null);
        setNote(null);
        setDlg(null);
      }
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const content = await file.text();
    const title = file.name.replace(/\.md$/i, "");
    const res = await createNote({ title, content, tags: "" });
    await loadNotes();
    openNote(res.id);
  };

  const startCreate = () => {
    setCreating(true);
    setSelected(null);
    setNote(null);
    setEditing(false);
    setPreview(false);
    setEditData({ title: "", content: "", tags: "" });
    setGenMsg("");
  };

  const saveCreate = async () => {
    if (!editData.title.trim()) return;
    const res = await createNote(editData);
    await loadNotes();
    setCreating(false);
    openNote(res.id);
    toast.success("笔记已创建");
  };

  const generateCards = async () => {
    if (!note || genLoading) return;
    setGenLoading(true);
    setGenMsg("🤖 AI 正在解析笔记，请稍候...");
    try {
      const sys = `从以下Markdown笔记中提取面试题闪卡。规则：1.问题用中文对话式表达。2.答案简洁（≤150字），代码块使用\`\`\`python。3.创建3-6个分类。4.仅返回完整JSON数组：[{"category":"...","q":"...","a":"...","tips":"..."}]。5.全部用中文。`;
      const resp = await fetch(`${import.meta.env.VITE_API_BASE}/api/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          system: sys,
          messages: [{ role: "user", content: `笔记标题：${note.title}\n\n${note.content.slice(0, 15000)}` }]
        })
      });
      const data = await resp.json();
      const raw = data.content?.[0]?.text || "";
      let cards = null;
      const cleaned = raw.replace(/```json|```/g, "").trim();
      try { cards = JSON.parse(cleaned); } catch (_) { void _; }
      if (!Array.isArray(cards)) {
        const a = cleaned.indexOf("[");
        if (a >= 0) { try { cards = JSON.parse(cleaned.slice(a)); } catch (_) { void _; } }
      }
      if (Array.isArray(cards) && cards.length > 0) {
        onImportCards(cards, note.title);
        setGenMsg(`✅ 已从笔记生成 ${cards.length} 张闪卡，已导入为新题库「${note.title}」`);
      } else {
        setGenMsg("❌ 生成失败，请检查 AI 配置或重试");
      }
    } catch (e) {
      setGenMsg("❌ 出错: " + e.message);
    }
    setGenLoading(false);
  };

  // Memoize rendered HTML and headings to avoid re-renders
  const viewContent = note?.content || "";
  const renderedHtml = useMemo(() => renderMd(viewContent), [viewContent]);
  const tocHeadings = useMemo(() => extractHeadings(viewContent), [viewContent]);

  const editContent = editData.content;
  const renderedEditHtml = useMemo(() => renderMd(editContent), [editContent]);

  if (!authed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, color: "var(--text-3,#9ca3af)", gap: 12 }}>
        <Lock size={40} strokeWidth={1.5}/>
        <div style={{ fontSize: 15 }}>请先登录后查看笔记</div>
      </div>
    );
  }

  const showToc = !creating && !editing && note && tocHeadings.length > 0;

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", width: "100%" }}>
      {dlg && <ConfirmDlg message={dlg.message} onConfirm={dlg.onConfirm} onCancel={() => setDlg(null)} />}

      {/* ── Left sidebar: note list ── */}
      <div style={{ width: 220, flexShrink: 0, background: "var(--surface,#fff)", borderRadius: 12, border: "1px solid var(--app-border,#e5e7eb)", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
          <button onClick={startCreate} style={{ ...btnP, flex: 1, padding: "7px 8px", fontSize: 12, display:"inline-flex", alignItems:"center", justifyContent:"center", gap:5 }}><FilePlus size={13}/> 新建</button>
          <label style={{ ...btnG, padding: "7px 10px", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems:"center", gap:5 }}>
            <Upload size={13}/> 上传
            <input type="file" accept=".md" style={{ display: "none" }} onChange={handleFileUpload} />
          </label>
        </div>

        {notes.length === 0 ? (
          <div style={{ color: "var(--text-3,#9ca3af)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>暂无笔记</div>
        ) : (
          notes.map(n => (
            <div
              key={n.id}
              onClick={() => openNote(n.id)}
              style={{
                padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                background: selected === n.id ? "var(--accent-soft,#eef2ff)" : "var(--surface-2,#f9fafb)",
                border: `1px solid ${selected === n.id ? "#a5b4fc" : "var(--app-border,#f3f4f6)"}`,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1,#111)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {n.title}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3,#9ca3af)" }}>{n.uploaded_by} · {fmtDate(n.created_at)}</div>
              {n.tags && (
                <div style={{ fontSize: 11, color: "#6366f1", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {n.tags.split(",").filter(t => t.trim()).map(t => `#${t.trim()}`).join(" ")}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Center: note content ── */}
      <div style={{ flex: 1, background: "var(--surface,#fff)", borderRadius: 12, border: "1px solid var(--app-border,#e5e7eb)", padding: 28, minHeight: 460, minWidth: 0 }}>

        {/* Creating new note */}
        {creating && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1,#111)", marginBottom: 4, display:"flex", alignItems:"center", gap:7 }}><FilePlus size={16}/> 新建笔记</div>
            <input value={editData.title} onChange={e => setEditData(d => ({ ...d, title: e.target.value }))}
              placeholder="笔记标题 *" style={inp} autoFocus />
            <input value={editData.tags} onChange={e => setEditData(d => ({ ...d, tags: e.target.value }))}
              placeholder="标签（逗号分隔，如：Python, 算法）" style={inp} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2,#374151)" }}>内容（Markdown）</span>
              <button onClick={() => setPreview(p => !p)} style={{ ...btnG, padding: "3px 10px", fontSize: 12, display:"inline-flex", alignItems:"center", gap:4 }}>
                {preview ? <><Pencil size={12}/> 编辑</> : <><Eye size={12}/> 预览</>}
              </button>
            </div>
            {preview ? (
              <div className="md-preview" style={{ border: "1px solid var(--app-border,#e5e7eb)", borderRadius: 8, padding: 16, minHeight: 200 }}
                dangerouslySetInnerHTML={{ __html: renderedEditHtml }} />
            ) : (
              <textarea value={editData.content} onChange={e => setEditData(d => ({ ...d, content: e.target.value }))}
                placeholder="在此输入 Markdown 内容，支持数学公式 $E=mc^2$ 或 $$\sum$$" rows={14}
                style={{ ...inp, fontFamily: "Menlo,Monaco,Consolas,monospace", fontSize: 13, resize: "vertical", lineHeight: 1.65 }} />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveCreate} disabled={!editData.title.trim()} style={{ ...btnP, opacity: editData.title.trim() ? 1 : .5 }}>保存</button>
              <button onClick={() => setCreating(false)} style={btnG}>取消</button>
            </div>
          </div>
        )}

        {/* Note view / edit */}
        {!creating && note && !loadingNote && (
          <div>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editing ? (
                  <input value={editData.title} onChange={e => setEditData(d => ({ ...d, title: e.target.value }))}
                    style={{ ...inp, fontSize: 18, fontWeight: 700 }} autoFocus />
                ) : (
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text-1,#111)", wordBreak: "break-word" }}>{note.title}</h2>
                )}
                <div style={{ fontSize: 12, color: "var(--text-3,#9ca3af)", marginTop: 5 }}>
                  上传者: <span style={{ color: "#6366f1", fontWeight: 600 }}>{note.uploaded_by}</span>
                  &nbsp;· {fmtDate(note.created_at)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {!editing && (
                  <>
                    <button onClick={generateCards} disabled={genLoading}
                      style={{ ...btnG, borderColor: "#6366f1", color: "#6366f1", opacity: genLoading ? .6 : 1, display:"inline-flex", alignItems:"center", gap:5 }}>
                      {genLoading ? <><Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/> 生成中...</> : <><Sparkles size={13}/> 生成闪卡</>}
                    </button>
                    {note.uploaded_by === authUser && (
                      <>
                        <button onClick={startEdit} style={{ ...btnG, display:"inline-flex", alignItems:"center", gap:5 }}><Pencil size={13}/> 编辑</button>
                        <button onClick={handleDelete} style={{ ...btnR, display:"inline-flex", alignItems:"center", gap:5 }}><Trash2 size={13}/> 删除</button>
                      </>
                    )}
                  </>
                )}
                {editing && (
                  <>
                    <button onClick={() => setPreview(p => !p)} style={{ ...btnG, display:"inline-flex", alignItems:"center", gap:5 }}>{preview ? <><Pencil size={13}/> 编辑</> : <><Eye size={13}/> 预览</>}</button>
                    <button onClick={saveEdit} style={btnP}>保存</button>
                    <button onClick={() => setEditing(false)} style={btnG}>取消</button>
                  </>
                )}
              </div>
            </div>

            {/* Tags */}
            {editing ? (
              <input value={editData.tags} onChange={e => setEditData(d => ({ ...d, tags: e.target.value }))}
                placeholder="标签（逗号分隔）" style={{ ...inp, marginBottom: 14, fontSize: 13 }} />
            ) : (
              note.tags && note.tags.trim() && (
                <div style={{ marginBottom: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {note.tags.split(",").filter(t => t.trim()).map((t, i) => <TagBadge key={i} tag={t} />)}
                </div>
              )
            )}

            {/* Gen message */}
            {genMsg && (
              <div style={{
                marginBottom: 14, padding: "9px 14px", borderRadius: 8, fontSize: 13,
                background: genMsg.startsWith("✅") ? "#f0fdf4" : genMsg.startsWith("🤖") ? "#eff6ff" : "#fef2f2",
                border: `1px solid ${genMsg.startsWith("✅") ? "#bbf7d0" : genMsg.startsWith("🤖") ? "#bfdbfe" : "#fecaca"}`,
                color: genMsg.startsWith("✅") ? "#065f46" : genMsg.startsWith("🤖") ? "#1d4ed8" : "#b91c1c",
              }}>
                {genMsg}
              </div>
            )}

            {/* Content */}
            {editing ? (
              preview ? (
                <div className="md-preview" style={{ border: "1px solid var(--app-border,#e5e7eb)", borderRadius: 8, padding: 20, minHeight: 300 }}
                  dangerouslySetInnerHTML={{ __html: renderedEditHtml }} />
              ) : (
                <textarea value={editData.content} onChange={e => setEditData(d => ({ ...d, content: e.target.value }))}
                  rows={22} style={{ ...inp, fontFamily: "Menlo,Monaco,Consolas,monospace", fontSize: 13, resize: "vertical", lineHeight: 1.65 }} />
              )
            ) : (
              <div className="md-preview" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
            )}
          </div>
        )}

        {loadingNote && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-3,#9ca3af)", fontSize: 14 }}>
            加载中...
          </div>
        )}

        {!creating && !note && !loadingNote && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, color: "var(--text-3,#9ca3af)", gap: 12 }}>
            <FileText size={52} strokeWidth={1}/>
            <div style={{ fontSize: 15 }}>从左侧选择笔记，或上传 .md 文件</div>
            <div style={{ fontSize: 13 }}>支持 Markdown · 数学公式 · 一键生成闪卡</div>
          </div>
        )}
      </div>

      {/* ── Right: TOC ── */}
      {showToc && <TocPanel headings={tocHeadings} activeSlug={activeSlug} />}
    </div>
  );
}
