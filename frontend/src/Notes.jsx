import { useState, useEffect, useCallback, useMemo } from "react";
import { FilePlus, Upload, Sparkles, Pencil, Trash2, Eye, Lock, Loader2, FileText } from "lucide-react";
import { toast } from "react-hot-toast";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import markedKatex from "marked-katex-extension";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";
import { fetchNotes, fetchNote, createNote, updateNote, deleteNote, getToken } from "./api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function renderMd(content) {
  const counts = {};
  const instance = new Marked();
  instance.use(markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
      return hljs.highlight(code, { language: "plaintext", ignoreIllegals: true }).value;
    }
  }));
  instance.use(markedKatex({ throwOnError: false, output: "html" }));
  instance.use({
    breaks: true, gfm: true,
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

function extractHeadings(md) {
  const headings = [], counts = {};
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

function ConfirmDlg({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-2000">
      <div className="rounded-xl p-7 max-w-sm w-[90%] shadow-[0_8px_40px_rgba(0,0,0,0.18)]" style={{ background: "var(--surface,#fff)" }}>
        <p className="m-0 mb-5.5 text-[15px] leading-normal" style={{ color: "var(--text-2,#374151)" }}>{message}</p>
        <div className="flex gap-2.5 justify-end">
          <button onClick={onCancel}
            className="btn-fill btn-fill-indigo px-3.5 py-1.5 rounded-lg border text-[13px] font-medium cursor-pointer"
            style={{ background: "var(--surface,#fff)", color: "var(--text-2,#374151)", borderColor: "var(--app-border,#e5e7eb)" }}>
            取消
          </button>
          <button onClick={onConfirm}
            className="btn-fill btn-fill-danger px-3.5 py-1.5 rounded-lg border-0 text-[13px] font-semibold cursor-pointer bg-red-500 text-white">
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

function TagBadge({ tag }) {
  return (
    <span className="bg-[#eef2ff] text-indigo-600 rounded-[20px] px-2.5 py-0.5 text-[12px] font-medium">
      #{tag.trim()}
    </span>
  );
}

function TocPanel({ headings, activeSlug }) {
  if (!headings.length) return null;
  return (
    <div className="w-40 shrink-0 sticky top-5 self-start rounded-xl border p-3.5 max-h-[80vh] overflow-y-auto"
      style={{ background: "var(--surface,#fff)", borderColor: "var(--app-border,#e5e7eb)" }}>
      <div className="text-[11px] font-bold tracking-[0.08em] uppercase mb-2.5" style={{ color: "var(--text-3,#aaa)" }}>目录</div>
      {headings.map((h, i) => (
        <div key={i}
          onClick={() => document.getElementById(h.slug)?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="px-2 py-1.25 text-[12px] leading-[1.45] cursor-pointer rounded-[5px] mb-0.5 break-all transition-colors"
          style={{
            color: activeSlug === h.slug ? "#6366f1" : "var(--text-2,#555)",
            fontWeight: activeSlug === h.slug ? 600 : 400,
            background: activeSlug === h.slug ? "var(--accent-soft,#eef2ff)" : "transparent",
          }}>
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
    } catch (err) { console.error(err); }
  }, [authed]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

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
    setCreating(false); setEditing(false); setSelected(id);
    setGenMsg(""); setActiveSlug(""); setLoadingNote(true);
    try { setNote(await fetchNote(id)); } catch (err) { console.error(err); }
    setLoadingNote(false);
  };

  const startEdit = () => {
    setEditData({ title: note.title, content: note.content, tags: note.tags || "" });
    setPreview(false); setEditing(true);
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
        setSelected(null); setNote(null); setDlg(null);
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
    setCreating(true); setSelected(null); setNote(null);
    setEditing(false); setPreview(false);
    setEditData({ title: "", content: "", tags: "" }); setGenMsg("");
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
      const resp = await fetch(`${import.meta.env.VITE_API_BASE}/api/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` },
        body: JSON.stringify({ mode: "notes", note_title: note.title, content: note.content.slice(0, 15000) })
      });
      const data = await resp.json();
      const raw = data.result || "";
      let cards = null;
      const cleaned = raw.replace(/```json|```/g, "").trim();
      try { cards = JSON.parse(cleaned); } catch { void 0; }
      if (!Array.isArray(cards)) {
        const a = cleaned.indexOf("[");
        if (a >= 0) { try { cards = JSON.parse(cleaned.slice(a)); } catch { void 0; } }
      }
      if (Array.isArray(cards) && cards.length > 0) {
        onImportCards(cards, note.title);
        setGenMsg(`✅ 已从笔记生成 ${cards.length} 张闪卡，已导入为新题库「${note.title}」`);
      } else {
        setGenMsg("❌ 生成失败，请检查 AI 配置或重试");
      }
    } catch (err) {
      setGenMsg("❌ 出错: " + err.message);
    }
    setGenLoading(false);
  };

  const viewContent = note?.content || "";
  const renderedHtml = useMemo(() => renderMd(viewContent), [viewContent]);
  const tocHeadings = useMemo(() => extractHeadings(viewContent), [viewContent]);
  const renderedEditHtml = useMemo(() => renderMd(editData.content), [editData.content]);

  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center h-75 gap-3" style={{ color: "var(--text-3,#9ca3af)" }}>
        <Lock size={40} strokeWidth={1.5} />
        <div className="text-[15px]">请先登录后查看笔记</div>
      </div>
    );
  }

  const showToc = !creating && !editing && note && tocHeadings.length > 0;

  // shared input classes
  const inputCls = "bg-[var(--surface,#fff)] text-[var(--text-2,#374151)] border-[var(--app-border,#e5e7eb)]";

  return (
    <div className="flex gap-5 items-start w-full">
      {dlg && <ConfirmDlg message={dlg.message} onConfirm={dlg.onConfirm} onCancel={() => setDlg(null)} />}

      {/* ── Left sidebar ── */}
      <div className="w-55 shrink-0 rounded-xl border p-3 flex flex-col gap-2"
        style={{ background: "var(--surface,#fff)", borderColor: "var(--app-border,#e5e7eb)" }}>
        <div className="flex gap-1.5 mb-1">
          <button onClick={startCreate}
            className="btn-fill btn-fill-primary flex-1 inline-flex items-center justify-center gap-1.5 py-1.75 px-2 rounded-lg border-0 text-[12px] font-semibold cursor-pointer text-white shadow-[0_2px_8px_rgba(99,102,241,.25)]"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            <FilePlus size={13} /> 新建
          </button>
          <label className="inline-flex items-center justify-center gap-1.5 py-[7px] px-2.5 rounded-lg border text-[12px] font-medium cursor-pointer"
            style={{ background: "var(--surface,#fff)", color: "var(--text-2,#374151)", borderColor: "var(--app-border,#e5e7eb)" }}>
            <Upload size={13} /> 上传
            <input type="file" accept=".md" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        {notes.length === 0
          ? <div className="text-[13px] text-center py-6" style={{ color: "var(--text-3,#9ca3af)" }}>暂无笔记</div>
          : notes.map(n => (
            <div key={n.id} onClick={() => openNote(n.id)}
              className="px-3 py-2.5 rounded-xl cursor-pointer border transition-colors"
              style={{
                background: selected === n.id ? "var(--accent-soft,#eef2ff)" : "var(--surface-2,#f9fafb)",
                borderColor: selected === n.id ? "#a5b4fc" : "var(--app-border,#f3f4f6)",
              }}>
              <div className="font-semibold text-[13px] whitespace-nowrap overflow-hidden text-ellipsis mb-0.5"
                style={{ color: "var(--text-1,#111)" }}>{n.title}</div>
              <div className="text-[11px]" style={{ color: "var(--text-3,#9ca3af)" }}>{n.uploaded_by} · {fmtDate(n.created_at)}</div>
              {n.tags && (
                <div className="text-[11px] text-indigo-500 mt-0.75 whitespace-nowrap overflow-hidden text-ellipsis">
                  {n.tags.split(",").filter(t => t.trim()).map(t => `#${t.trim()}`).join(" ")}
                </div>
              )}
            </div>
          ))
        }
      </div>

      {/* ── Center: note content ── */}
      <div className="flex-1 min-w-0 rounded-xl border p-7 min-h-115"
        style={{ background: "var(--surface,#fff)", borderColor: "var(--app-border,#e5e7eb)" }}>

        {/* Creating */}
        {creating && (
          <div className="flex flex-col gap-3">
            <div className="text-[16px] font-bold mb-1 flex items-center gap-1.5" style={{ color: "var(--text-1,#111)" }}>
              <FilePlus size={16} /> 新建笔记
            </div>
            <Input value={editData.title} onChange={e => setEditData(d => ({ ...d, title: e.target.value }))}
              placeholder="笔记标题 *" className={inputCls} autoFocus />
            <Input value={editData.tags} onChange={e => setEditData(d => ({ ...d, tags: e.target.value }))}
              placeholder="标签（逗号分隔，如：Python, 算法）" className={inputCls} />
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold" style={{ color: "var(--text-2,#374151)" }}>内容（Markdown）</span>
              <button onClick={() => setPreview(p => !p)}
                className="btn-fill btn-fill-indigo inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[12px] cursor-pointer"
                style={{ background: "var(--surface,#fff)", color: "var(--text-2,#374151)", borderColor: "var(--app-border,#e5e7eb)" }}>
                {preview ? <><Pencil size={12} /> 编辑</> : <><Eye size={12} /> 预览</>}
              </button>
            </div>
            {preview
              ? <div className="md-preview border rounded-lg p-4 min-h-50"
                  style={{ borderColor: "var(--app-border,#e5e7eb)" }}
                  dangerouslySetInnerHTML={{ __html: renderedEditHtml }} />
              : <Textarea value={editData.content} onChange={e => setEditData(d => ({ ...d, content: e.target.value }))}
                  placeholder="在此输入 Markdown 内容，支持数学公式 $E=mc^2$ 或 $$\sum$$" rows={14}
                  className={`${inputCls} font-mono text-[13px] resize-y leading-relaxed`} />
            }
            <div className="flex gap-2">
              <button onClick={saveCreate} disabled={!editData.title.trim()}
                className="btn-fill btn-fill-primary px-4 py-1.5 rounded-lg border-0 text-[13px] font-semibold cursor-pointer text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>保存</button>
              <button onClick={() => setCreating(false)}
                className="btn-fill btn-fill-indigo px-4 py-1.5 rounded-lg border text-[13px] font-medium cursor-pointer"
                style={{ background: "var(--surface,#fff)", color: "var(--text-2,#374151)", borderColor: "var(--app-border,#e5e7eb)" }}>取消</button>
            </div>
          </div>
        )}

        {/* View / edit */}
        {!creating && note && !loadingNote && (
          <div>
            {/* Header */}
            <div className="flex justify-between items-start mb-3.5 gap-3">
              <div className="flex-1 min-w-0">
                {editing
                  ? <Input value={editData.title} onChange={e => setEditData(d => ({ ...d, title: e.target.value }))}
                      className={`${inputCls} text-[18px] font-bold`} autoFocus />
                  : <h2 className="m-0 text-[20px] font-extrabold wrap-break-word" style={{ color: "var(--text-1,#111)" }}>{note.title}</h2>
                }
                <div className="text-[12px] mt-1.25" style={{ color: "var(--text-3,#9ca3af)" }}>
                  上传者: <span className="text-indigo-500 font-semibold">{note.uploaded_by}</span>
                  &nbsp;· {fmtDate(note.created_at)}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                {!editing && <>
                  <button onClick={generateCards} disabled={genLoading}
                    className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium cursor-pointer disabled:opacity-60 text-indigo-500"
                    style={{ background: "var(--surface,#fff)", borderColor: "#6366f1" }}>
                    {genLoading ? <><Loader2 size={13} className="animate-spin" /> 生成中...</> : <><Sparkles size={13} /> 生成闪卡</>}
                  </button>
                  {note.uploaded_by === authUser && <>
                    <button onClick={startEdit}
                      className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium cursor-pointer"
                      style={{ background: "var(--surface,#fff)", color: "var(--text-2,#374151)", borderColor: "var(--app-border,#e5e7eb)" }}>
                      <Pencil size={13} /> 编辑
                    </button>
                    <button onClick={handleDelete}
                      className="btn-fill btn-fill-danger inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium cursor-pointer bg-red-50 text-red-700 border-red-200">
                      <Trash2 size={13} /> 删除
                    </button>
                  </>}
                </>}
                {editing && <>
                  <button onClick={() => setPreview(p => !p)}
                    className="btn-fill btn-fill-indigo inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium cursor-pointer"
                    style={{ background: "var(--surface,#fff)", color: "var(--text-2,#374151)", borderColor: "var(--app-border,#e5e7eb)" }}>
                    {preview ? <><Pencil size={13} /> 编辑</> : <><Eye size={13} /> 预览</>}
                  </button>
                  <button onClick={saveEdit}
                    className="btn-fill btn-fill-primary px-4 py-1.5 rounded-lg border-0 text-[13px] font-semibold cursor-pointer text-white"
                    style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>保存</button>
                  <button onClick={() => setEditing(false)}
                    className="btn-fill btn-fill-indigo px-3 py-1.5 rounded-lg border text-[13px] font-medium cursor-pointer"
                    style={{ background: "var(--surface,#fff)", color: "var(--text-2,#374151)", borderColor: "var(--app-border,#e5e7eb)" }}>取消</button>
                </>}
              </div>
            </div>

            {/* Tags */}
            {editing
              ? <Input value={editData.tags} onChange={e => setEditData(d => ({ ...d, tags: e.target.value }))}
                  placeholder="标签（逗号分隔）" className={`${inputCls} mb-3.5 text-[13px]`} />
              : note.tags?.trim() && (
                <div className="mb-3.5 flex gap-1.5 flex-wrap">
                  {note.tags.split(",").filter(t => t.trim()).map((t, i) => <TagBadge key={i} tag={t} />)}
                </div>
              )
            }

            {/* Gen message */}
            {genMsg && (
              <div className="mb-3.5 px-3.5 py-2.5 rounded-lg text-[13px]"
                style={{
                  background: genMsg.startsWith("✅") ? "#f0fdf4" : genMsg.startsWith("🤖") ? "#eff6ff" : "#fef2f2",
                  border: `1px solid ${genMsg.startsWith("✅") ? "#bbf7d0" : genMsg.startsWith("🤖") ? "#bfdbfe" : "#fecaca"}`,
                  color: genMsg.startsWith("✅") ? "#065f46" : genMsg.startsWith("🤖") ? "#1d4ed8" : "#b91c1c",
                }}>
                {genMsg}
              </div>
            )}

            {/* Content */}
            {editing
              ? preview
                ? <div className="md-preview border rounded-lg p-5 min-h-75"
                    style={{ borderColor: "var(--app-border,#e5e7eb)" }}
                    dangerouslySetInnerHTML={{ __html: renderedEditHtml }} />
                : <Textarea value={editData.content} onChange={e => setEditData(d => ({ ...d, content: e.target.value }))}
                    rows={22} className={`${inputCls} font-mono text-[13px] resize-y leading-[1.65]`} />
              : <div className="md-preview" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
            }
          </div>
        )}

        {loadingNote && (
          <div className="flex items-center justify-center h-50 text-[14px]" style={{ color: "var(--text-3,#9ca3af)" }}>
            加载中...
          </div>
        )}

        {!creating && !note && !loadingNote && (
          <div className="flex flex-col items-center justify-center h-75 gap-3" style={{ color: "var(--text-3,#9ca3af)" }}>
            <FileText size={52} strokeWidth={1} />
            <div className="text-[15px]">从左侧选择笔记，或上传 .md 文件</div>
            <div className="text-[13px]">支持 Markdown · 数学公式 · 一键生成闪卡</div>
          </div>
        )}
      </div>

      {/* ── Right: TOC ── */}
      {showToc && <TocPanel headings={tocHeadings} activeSlug={activeSlug} />}
    </div>
  );
}
