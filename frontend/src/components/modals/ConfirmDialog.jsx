import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs"
        onClick={onCancel}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="relative bg-(--card-bg,#fff) rounded-2xl p-6 w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
        initial={{ opacity: 0, scale: 0.92, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {/* 图标 */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle size={22} className="text-red-500" />
          </div>
        </div>
        {/* 消息 */}
        <p className="text-[15px] text-center leading-relaxed mb-8" style={{ color: "var(--text-2,#374151)" }}>
          {message}
        </p>
        {/* 按钮 */}
        <div className="flex gap-3 mt-2">
          <button onClick={onCancel}
            className="btn-fill btn-fill-indigo flex-1 py-2.5 rounded-xl border text-[14px] font-medium cursor-pointer"
            style={{ background: "var(--card-bg,#fff)", color: "var(--text-2,#374151)", borderColor: "var(--app-border,#e5e7eb)" }}>
            取消
          </button>
          <button onClick={onConfirm}
            className="btn-fill btn-fill-danger flex-1 py-2.5 rounded-xl border-0 text-[14px] font-semibold cursor-pointer bg-red-500 text-white">
            确认
          </button>
        </div>
      </motion.div>
    </div>
  );
}
