import { useState, useRef } from "react";
import { Download, X, Loader2, Bot, Paperclip } from "lucide-react";
import { toast } from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getToken } from "@/api";
import { fixJ } from "@/lib/jsonRepair";
import { pdfTxt, docTxt } from "@/lib/fileLoaders";

export function ImportModal({ onClose, onImport }) {
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
      const resp = await fetch(`${import.meta.env.VITE_API_BASE}/api/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` },
        body: JSON.stringify({ mode: "text", topic: topic || "", content: text.slice(0, 15000) }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      setProgress("生成...");
      const data = await resp.json();
      const parsed = fixJ(data.result);
      if (!parsed?.length) throw new Error("解析失败");
      const cards = parsed
        .map(it => ({ category: it.category || topic || "导入", q: it.q || "", a: it.a || "", tips: it.tips || "" }))
        .filter(c => c.q && c.a);
      if (!cards.length) throw new Error("未解析出题目");
      onImport(cards, topic || "自定义");
      toast.success(`已导入 ${cards.length} 张卡片`);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); setProgress(""); }
  };

  return (
    <div className="fixed inset-0 z-1000 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-(--card-bg,#fff) rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-auto shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <div className="flex justify-between items-center mb-4">
          <div className="text-[18px] font-bold text-(--text-1,#111) flex items-center gap-1.5">
            <Download size={16} /> 导入文档
          </div>
          <button onClick={onClose} className="bg-transparent border-0 cursor-pointer text-(--text-3,#999) inline-flex p-0.5 hover:text-(--text-1)">
            <X size={20} />
          </button>
        </div>

        <label className="text-[13px] font-semibold text-(--text-color,#555) block mb-1.5">题库名称</label>
        <Input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="如：机器学习"
          className="mb-3 bg-(--card-bg,#fff) text-(--text-color,#333) border-(--app-border,#e5e7eb)"
        />

        <label className="text-[13px] font-semibold text-(--text-color,#555) block mb-1.5 mt-3">上传或粘贴</label>
        <div className="flex gap-2 mb-2 items-center">
          <button onClick={() => fr.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-(--app-border,#e5e7eb) bg-(--card-bg,#fff) text-(--text-color,#555) text-[13px] cursor-pointer hover:bg-(--surface-2)">
            <Paperclip size={14} /> 选择文件
          </button>
          {fn
            ? <span className="text-[13px] text-emerald-500">✓ {fn}</span>
            : <span className="text-[12px] text-(--text-3,#999)">PDF/TXT/MD/DOCX</span>
          }
        </div>
        <input ref={fr} type="file" accept=".pdf,.txt,.md,.csv,.json,.html,.docx,.doc" onChange={hf} className="hidden" />

        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="粘贴笔记/面试题..."
          className="h-[150px] resize-y bg-(--card-bg,#fff) text-(--text-color,#333) border-(--app-border,#e5e7eb) font-[inherit]"
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[13px] text-red-600 mt-2">
            {error}
          </div>
        )}
        {progress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-[13px] text-blue-600 mt-2 flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-full border-2 border-blue-300 border-t-transparent animate-spin" />
            {progress}
          </div>
        )}

        <button
          onClick={hp}
          disabled={loading || !text.trim()}
          className="w-full mt-3 py-3 text-[15px] bg-linear-to-br from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white border-0 font-semibold rounded-lg shadow-[0_2px_8px_rgba(99,102,241,0.3)] disabled:opacity-50 cursor-pointer"
        >
          {loading
            ? <><Loader2 size={14} className="animate-spin" /> 解析中...</>
            : <><Bot size={14} /> AI解析</>
          }
        </button>
      </div>
    </div>
  );
}
