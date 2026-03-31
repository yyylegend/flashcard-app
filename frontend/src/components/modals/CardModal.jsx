import { useState } from "react";
import { Pencil, Plus, X, Lightbulb, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CardModal({ onClose, onSave, categories, initial }) {
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[4px]" onClick={onClose} />
      <div className="relative bg-(--card-bg,#fff) rounded-2xl p-6 w-full max-w-lg shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <div className="flex justify-between items-center mb-4">
          <div className="text-[18px] font-bold text-(--text-1,#111) flex items-center gap-1.5">
            {isEdit ? <><Pencil size={16} /> 编辑卡片</> : <><Plus size={16} /> 添加卡片</>}
          </div>
          <button onClick={onClose} className="bg-transparent border-0 cursor-pointer text-[var(--text-3,#999)] inline-flex p-0.5 hover:text-[var(--text-1)]">
            <X size={20} />
          </button>
        </div>

        <label className="text-[13px] font-semibold text-(--text-color,#555) block mb-1.5">分类</label>
        <div className="flex gap-2 mb-3 flex-wrap">
          <select
            value={cat}
            onChange={e => setCat(e.target.value)}
            className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-(--app-border,#e5e7eb) bg-(--card-bg,#fff) text-(--text-color,#333) text-[14px] outline-none"
          >
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <Input
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            placeholder="或输入新分类"
            className="flex-1 bg-(--card-bg,#fff) text-(--text-color,#333) border-(--app-border,#e5e7eb)"
          />
        </div>

        <label className="text-[13px] font-semibold text-(--text-color,#555) block mb-1.5">问题 *</label>
        <Textarea
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="面试官会怎么问？"
          className="mb-3 h-[60px] resize-y bg-(--card-bg,#fff) text-(--text-color,#333) border-(--app-border,#e5e7eb)"
        />

        <label className="text-[13px] font-semibold text-(--text-color,#555) block mb-1.5 mt-3">
          答案 *（用```包裹代码块）
        </label>
        <Textarea
          value={a}
          onChange={e => setA(e.target.value)}
          placeholder={"答案要点...\n\n```python\nprint('代码放这里')\n```"}
          className="mb-3 h-[140px] resize-y text-[13px] bg-(--card-bg,#fff) text-(--text-color,#333) border-(--app-border,#e5e7eb)"
        />

        <label className="text-[13px] font-semibold text-(--text-color,#555) flex items-center gap-1 mb-1.5 mt-3">
          <Lightbulb size={13} /> 面试小贴士
        </label>
        <Input
          value={t}
          onChange={e => setT(e.target.value)}
          placeholder="一句话提示"
          className="bg-(--card-bg,#fff) text-(--text-color,#333) border-(--app-border,#e5e7eb)"
        />

        <Button
          onClick={submit}
          disabled={!q.trim() || !a.trim()}
          className="w-full mt-4 py-3 text-[15px] bg-gradient-to-br from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white border-0 font-semibold shadow-[0_2px_8px_rgba(99,102,241,0.3)] disabled:opacity-50"
        >
          {isEdit ? <><Save size={14} /> 保存修改</> : <><Plus size={14} /> 添加</>}
        </Button>
      </div>
    </div>
  );
}
