"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { leelaStatus } from "@/lib/leela";

export type Mode = "system" | "light" | "dark";
export type BoardTheme = "slate" | "green" | "walnut" | "blue" | "rose" | "violet";
export type EngineChoice = "builtin" | "leela";
export interface Settings { mode: Mode; board: BoardTheme; engine: EngineChoice }
export interface LeelaState { status: "idle" | "checking" | "ready" | "missing"; reason?: string }

export const BOARDS: { id: BoardTheme; label: string }[] = [
  { id: "slate", label: "Slate" }, { id: "green", label: "Green" }, { id: "walnut", label: "Walnut" },
  { id: "blue", label: "Blue" }, { id: "rose", label: "Rose" }, { id: "violet", label: "Violet" },
];

const DEFAULTS: Settings = { mode: "system", board: "slate", engine: "builtin" };
const KEY = "openfile-settings";

interface Ctx {
  settings: Settings;
  set: (p: Partial<Settings>) => void;
  leela: LeelaState;
  checkLeela: () => Promise<void>;
}
const SettingsCtx = createContext<Ctx | null>(null);

export function useSettings(): Ctx {
  const c = useContext(SettingsCtx);
  if (!c) throw new Error("useSettings must be used inside SettingsProvider");
  return c;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [leela, setLeela] = useState<LeelaState>({ status: "idle" });

  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setSettings({ ...DEFAULTS, ...JSON.parse(s) }); } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = settings.mode === "dark" || (settings.mode === "system" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.dataset.board = settings.board;
    };
    apply();
    if (settings.mode === "system") { mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply); }
  }, [settings, loaded]);

  const checkLeela = useCallback(async () => {
    setLeela({ status: "checking" });
    const r = await leelaStatus();
    setLeela(r.available ? { status: "ready" } : { status: "missing", reason: r.reason });
  }, []);

  useEffect(() => { if (settings.engine === "leela" && leela.status === "idle") checkLeela(); }, [settings.engine, leela.status, checkLeela]);

  const set = useCallback((p: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...p }));
    if (p.engine === "leela") setLeela({ status: "idle" });
  }, []);

  return <SettingsCtx.Provider value={{ settings, set, leela, checkLeela }}>{children}</SettingsCtx.Provider>;
}

export function ThemeToggle() {
  const { set } = useSettings();
  return (
    <button className="iconbtn" aria-label="Switch between light and dark mode" title="Light / dark mode"
      onClick={() => set({ mode: document.documentElement.dataset.theme === "dark" ? "light" : "dark" })}>
      ◐
    </button>
  );
}
