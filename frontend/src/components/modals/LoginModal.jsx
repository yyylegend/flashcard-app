import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { login, setToken } from "@/api";

export function LoginModal({ onClose, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setLoading(true); setError("");
    const res = await login(username.trim(), password);
    setLoading(false);
    if (res.token) { setToken(res.token); onLogin(res.username); onClose(); }
    else setError(res.error || "登录失败");
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
        aria-labelledby="login-modal-title"
        className="relative bg-(--card-bg,#fff) rounded-2xl p-6 w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
        initial={{ opacity: 0, scale: 0.92, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="flex justify-between items-center mb-5">
          <div id="login-modal-title" className="text-[18px] font-bold text-(--text-1,#111) flex items-center gap-1.5">
            <Lock size={16} aria-hidden="true" /> 登录
          </div>
          <button onClick={onClose} aria-label="关闭登录框" className="bg-transparent border-0 cursor-pointer text-(--text-3,#999) inline-flex p-1.5 hover:text-(--text-1)">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <label htmlFor="login-username" className="text-[13px] font-semibold text-(--text-color,#555) block mb-1.5">账号</label>
        <Input
          id="login-username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="用户名"
          autoComplete="username"
          className="mb-3 bg-(--card-bg,#fff) text-(--text-color,#333) border-(--app-border,#e5e7eb)"
        />
        <label htmlFor="login-password" className="text-[13px] font-semibold text-(--text-color,#555) block mb-1.5">密码</label>
        <Input
          id="login-password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="密码"
          autoComplete="current-password"
          className="mb-4 bg-(--card-bg,#fff) text-(--text-color,#333) border-(--app-border,#e5e7eb)"
          onKeyDown={e => e.key === "Enter" && submit()}
        />
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[13px] text-red-600 mb-3">
            {error}
          </div>
        )}
        <button
          onClick={submit}
          disabled={loading || !username.trim() || !password}
          className="w-full py-3 text-[15px] text-white border-0 font-semibold rounded-lg shadow-[0_2px_8px_rgba(192,92,0,0.3)] disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-1.5"
          style={{ background: "linear-gradient(135deg,#C05C00,#E07820)" }}
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </motion.div>
    </div>
  );
}
