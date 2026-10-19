import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { SUPPORTED_CURRENCIES, type Currency } from "../domain/types";
import type { ApiService } from "../services/ApiService";

export const MAX_COMPARE = 3;

interface Toast { id: number; text: string; kind: "success" | "error" }
interface AppState {
  api: ApiService;
  mode: "mock" | "http";
  currency: Currency;
  setCurrency(c: Currency): void;
  compareIds: string[];
  toggleCompare(id: string): boolean; // false when the selection is full
  clearCompare(): void;
  toasts: Toast[];
  notify(text: string, kind?: Toast["kind"]): void;
}

const Ctx = createContext<AppState | null>(null);

function load<T>(key: string, fallback: T, ok: (v: unknown) => v is T): T {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return ok(v) ? v : fallback;
  } catch { return fallback; }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable: state stays in memory */ }
}
const isCurrency = (v: unknown): v is Currency => (SUPPORTED_CURRENCIES as readonly unknown[]).includes(v);
const isIds = (v: unknown): v is string[] => Array.isArray(v) && v.length <= MAX_COMPARE && v.every((x) => typeof x === "string");

export function AppStateProvider({ api, mode, children }: { api: ApiService; mode: "mock" | "http"; children: ReactNode }) {
  const [currency, setCur] = useState<Currency>(() => load("rs.currency", "EUR", isCurrency));
  const [compareIds, setIds] = useState<string[]>(() => load("rs.compare", [], isIds));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const notify = useCallback((text: string, kind: Toast["kind"] = "success") => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const setCurrency = useCallback((c: Currency) => { setCur(c); save("rs.currency", c); }, []);
  const toggleCompare = useCallback((id: string) => {
    if (!compareIds.includes(id) && compareIds.length >= MAX_COMPARE) return false;
    const next = compareIds.includes(id) ? compareIds.filter((x) => x !== id) : [...compareIds, id];
    setIds(next);
    save("rs.compare", next);
    return true;
  }, [compareIds]);
  const clearCompare = useCallback(() => { setIds([]); save("rs.compare", []); }, []);

  const value = useMemo(() => ({ api, mode, currency, setCurrency, compareIds, toggleCompare, clearCompare, toasts, notify }),
    [api, mode, currency, setCurrency, compareIds, toggleCompare, clearCompare, toasts, notify]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppStateProvider");
  return v;
}
