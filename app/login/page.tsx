"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Login gagal. Coba lagi.");
        setLoading(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Tidak bisa terhubung ke server. Coba lagi.");
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border-strong)",
    color: "var(--text-primary)",
  };

  return (
    <main className="flex-1 flex items-center justify-center px-4 overflow-auto" style={{ background: "var(--bg)" }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg p-6 flex flex-col gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded flex items-center justify-center text-[15px] font-semibold"
            style={{ background: "var(--accent)", color: "white" }}
          >
            M
          </div>
          <div>
            <div className="text-[16px] font-semibold" style={{ color: "var(--text-primary)" }}>
              SIPP v34
            </div>
            <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              Sistem Informasi Produksi &amp; Pengiriman
            </div>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Username
          <input
            type="text"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-10 rounded-md px-3 text-[14px] outline-none"
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 rounded-md px-3 text-[14px] outline-none"
            style={inputStyle}
          />
        </label>

        {error && (
          <div
            role="alert"
            className="rounded-md px-3 py-2 text-[13px]"
            style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-10 rounded-md text-[14px] font-medium cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {loading ? "Memeriksa..." : "Masuk"}
        </button>
      </form>
    </main>
  );
}
