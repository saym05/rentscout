import type { ApiService } from "./ApiService";
import { HttpService } from "./HttpService";
import { MockService } from "./mockService";

/** Composition root: the only place that picks an implementation. UI code receives ApiService via context. */
export function createApiService(env: ImportMetaEnv = import.meta.env): { api: ApiService; mode: "mock" | "http" } {
  if (env.VITE_API_MODE === "http") return { api: new HttpService(env.VITE_API_URL ?? "http://localhost:8091"), mode: "http" };
  return { api: new MockService({ latencyMs: 200 }), mode: "mock" };
}
