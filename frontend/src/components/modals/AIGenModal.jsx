import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, X, Loader2, Sparkles } from "lucide-react";
import { toast } from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { getToken } from "@/api";
import { fixJ } from "@/lib/jsonRepair";

export function AIGenModal({ onClose, onAdd, decks, defaultDeckId }) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [targetDeck, setTargetDeck] = useState(defaultDeckId || "new");

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(""); setProgress("AI正在生成...");
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE}/api/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` },
        body: JSON.stringify({ mode: "topic", topic, count }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      setProgress("解析中...");
      const data = await resp.json();
      const parsed = fixJ(data.result);
      if (!parsed?.length) throw new Error("解析失败");
      const cards = parsed
        .map(it => ({ category: it.category || topic, q: it.q || "", a: it.a || "", tips: it.tips || "" }))
        .filter(c => c.q && c.a);
      if (!cards.length) throw new Error("未生成有效题目");
      onAdd(cards, targetDeck === "new" ? null : targetDeck, topic);
      toast.success(`已生成 ${cards.length} 张卡片`);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); setProgress(""); }
  };

  return (
    <div className="fixed inset-0 z-1000 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        aria-hidden="true"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="aigen-modal-title"
        className="relative bg-(--card-bg,#fff) rounded-2xl p-6 w-full max-w-lg shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
        initial={{ opacity: 0, scale: 0.92, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="flex justify-between items-center mb-4">
          <div id="aigen-modal-title" className="text-[18px] font-bold text-(--text-1,#111) flex items-center gap-1.5">
            <Bot size={16} aria-hidden="true" /> AI 快速生成
          </div>
          <button onClick={onClose} aria-label="关闭" className="bg-transparent border-0 cursor-pointer text-(--text-3,#999) inline-flex p-1.5 hover:text-(--text-1)">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <label htmlFor="aigen-topic" className="text-[13px] font-semibold text-(--text-color,#555) block mb-1.5">主题</label>
        <Input
          id="aigen-topic"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="如：机器学习、Pandas、SQL..."
          className="mb-3 bg-(--card-bg,#fff) text-(--text-color,#333) border-(--app-border,#e5e7eb)"
        />

        <fieldset className="border-0 p-0 m-0 mb-4 mt-3">
          <legend className="text-[13px] font-semibold text-(--text-color,#555) mb-1.5">题数</legend>
          <div className="flex gap-2">
            {["5", "10", "15", "20"].map(n => (
              <button key={n} onClick={() => setCount(n)}
                aria-pressed={count === n}
                className={`px-4 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors ${
                  count === n
                    ? "text-white border-0 font-semibold"
                    : "border border-(--app-border,#e5e7eb) bg-(--card-bg,#fff) text-(--text-3,#777) hover:border-orange-400"
                }`}
                style={count === n ? { background: "#C05C00" } : {}}>
                {n}题
              </button>
            ))}
          </div>
        </fieldset>

        <label htmlFor="aigen-deck" className="text-[13px] font-semibold text-(--text-color,#555) block mb-1.5 mt-1">加入题库</label>
        <select
          id="aigen-deck"
          value={targetDeck}
          onChange={e => setTargetDeck(e.target.value)}
          className="w-full px-3 py-2 mb-4 rounded-lg border border-(--app-border,#e5e7eb) bg-(--card-bg,#fff) text-(--text-color,#333) text-[14px] outline-none cursor-pointer"
        >
          <option value="new">＋ 新建题库（以主题命名）</option>
          {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[13px] text-red-600 mb-3">
            {error}
          </div>
        )}
        {progress && (
          <div role="status" aria-live="polite" className="rounded-lg px-3 py-2 text-[13px] mb-3 flex items-center gap-2" style={{ background: "var(--accent-soft,#FFF4E6)", color: "var(--accent,#C05C00)", border: "1px solid var(--accent-border)" }}>
            <span className="inline-block w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent,#C05C00)", borderTopColor: "transparent" }} aria-hidden="true" />
            {progress}
          </div>
        )}

        <motion.button
          onClick={generate}
          disabled={loading || !topic.trim()}
          className="btn-fill btn-fill-primary group w-full py-3 rounded-xl text-[15px] font-semibold text-white border-0 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(192,92,0,0.4)]"
          style={{ background: "linear-gradient(135deg,#C05C00,#E07820)" }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" aria-hidden="true" /><span>生成中...</span></>
          ) : (
            <>
              <span className="inline-flex transition-transform duration-300 group-hover:rotate-12 group-hover:scale-125" aria-hidden="true">
                <Sparkles size={16} />
              </span>
              <span>生成题目</span>
            </>
          )}
        </motion.button>
      </motion.div>
    </div>
  );
}
