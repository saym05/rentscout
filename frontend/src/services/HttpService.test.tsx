import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../domain/errors";
import { HttpService } from "./HttpService";

const json = (status: number, body: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("HttpService", () => {
  it("builds query strings with comma-separated arrays and the demo user header", async () => {
    const f = vi.fn().mockResolvedValue(json(200, { items: [], total: 0, page: 1, pageSize: 12, currency: "EUR" }));
    await new HttpService("http://api/", "amara", f).search({ city: "Berlin", propertyTypes: ["studio", "room"], amenities: [], minPrice: 0 });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("http://api/api/listings?city=Berlin&propertyTypes=studio%2Croom&minPrice=0");
    expect(init.headers["X-Demo-User"]).toBe("amara");
  });
  it("maps the error envelope to ApiError with field details", async () => {
    const f = vi.fn().mockResolvedValue(json(400, { error: { code: "VALIDATION_ERROR", message: "Invalid", details: [{ field: "minPrice", message: "bad" }] } }));
    const e = await new HttpService("http://api", "demo", f).search({}).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 400, code: "VALIDATION_ERROR", details: [{ field: "minPrice", message: "bad" }] });
  });
  it("turns a network failure into a clear NETWORK_ERROR", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(new HttpService("http://api", "demo", f).health()).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });
  it("handles 204 and non-JSON errors", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response("oops", { status: 502 }));
    const s = new HttpService("http://api", "demo", f);
    await expect(s.addFavorite("x")).resolves.toBeUndefined();
    await expect(s.removeFavorite("x")).rejects.toMatchObject({ status: 502, code: "HTTP_ERROR" });
  });
  it("sends JSON bodies for compare", async () => {
    const f = vi.fn().mockResolvedValue(json(200, {}));
    await new HttpService("http://api", "demo", f).compare(["a", "b"], "GBP");
    expect(f.mock.calls[0]![1]).toMatchObject({ method: "POST", body: JSON.stringify({ ids: ["a", "b"], currency: "GBP" }) });
  });
});
