import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./domain/errors";
import type { ApiService } from "./services/ApiService";
import { MockService } from "./services/mockService";
import { renderApp } from "./test/renderApp";

const cards = () => screen.getAllByRole("article");
const totals = () => cards().map((c) => Number(c.querySelector(".price-total")!.textContent!.replace(/\/ month|[^0-9.]/g, "")));

describe("landing", () => {
  it("submits a search with city and budget", async () => {
    renderApp("/");
    await userEvent.type(screen.getByLabelText("City"), "Berlin");
    await userEvent.type(screen.getByLabelText(/Monthly budget/), "1000");
    await userEvent.click(screen.getByRole("button", { name: "Search rentals" }));
    await screen.findByRole("heading", { name: /listings?$/ });
    for (const c of cards()) expect(c).toHaveTextContent("Berlin");
    for (const t of totals()) expect(t).toBeLessThanOrEqual(1000);
  });
  it("rejects a non-numeric budget", async () => {
    renderApp("/");
    await userEvent.type(screen.getByLabelText(/Monthly budget/), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Search rentals" }));
    expect(screen.getByRole("alert")).toHaveTextContent("positive number");
  });
  it("labels demo data in the footer", () => {
    renderApp("/");
    expect(screen.getByRole("contentinfo")).toHaveTextContent(/marked DEMO are sample data/);
  });
});

describe("search", () => {
  it("shows results with DEMO badges and a monthly total", async () => {
    renderApp("/search");
    expect(await screen.findByRole("heading", { name: "27 listings" })).toBeInTheDocument();
    expect(cards()).toHaveLength(12);
    expect(within(cards()[0]!).getByText("DEMO")).toBeInTheDocument();
  });
  it("sorts by lowest monthly cost", async () => {
    renderApp("/search?sort=price_asc");
    await screen.findByRole("heading", { name: "27 listings" });
    const t = totals();
    expect(t).toEqual([...t].sort((a, b) => a - b));
  });
  it("filters by type through the filter form", async () => {
    renderApp("/search");
    await screen.findByRole("heading", { name: "27 listings" });
    await userEvent.click(screen.getByRole("checkbox", { name: "House" }));
    await userEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await screen.findByRole("heading", { name: "3 listings" });
  });
  it("validates min > max price without calling the API", async () => {
    const { api } = renderApp("/search");
    await screen.findByRole("heading", { name: "27 listings" });
    const spy = vi.spyOn(api, "search");
    await userEvent.type(screen.getByLabelText(/Min \/ month/), "900");
    await userEvent.type(screen.getByLabelText(/Max \/ month/), "100");
    await userEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(screen.getByText("Minimum price is above the maximum.")).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
  it("shows an empty state", async () => {
    renderApp("/search?q=nothing-matches-this");
    expect(await screen.findByText("No listings match these filters")).toBeInTheDocument();
  });
  it("shows an error state with retry", async () => {
    renderApp("/search", { forceError: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Service temporarily unavailable");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
  it("paginates", async () => {
    renderApp("/search");
    await screen.findByRole("heading", { name: "27 listings" });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 3");
  });
  it("labels converted prices with ≈ and keeps the original price", async () => {
    renderApp("/search?city=London");
    await screen.findByRole("heading", { name: /listings/ });
    const card = cards()[0]!;
    expect(within(card).getByLabelText("approximately")).toBeInTheDocument();
    expect(card).toHaveTextContent(/Listed as £/);
  });
});

describe("favorites and saved page", () => {
  it("saves from search and removes on the saved page", async () => {
    renderApp("/search");
    await screen.findByRole("heading", { name: "27 listings" });
    const first = cards()[0]!;
    const title = within(first).getByRole("heading").textContent!;
    await userEvent.click(within(first).getByRole("button", { name: `Save ${title}` }));
    await screen.findByText("Saved to your list");
    await userEvent.click(screen.getByRole("link", { name: "Saved" }));
    await screen.findByRole("heading", { name: "Saved listings" });
    await waitFor(() => expect(cards()).toHaveLength(1));
    await userEvent.click(screen.getByRole("button", { name: `Remove ${title} from saved` }));
    expect(await screen.findByText("Nothing saved yet")).toBeInTheDocument();
  });
  it("reverts the heart when saving fails", async () => {
    const api = new MockService();
    vi.spyOn(api, "addFavorite").mockRejectedValue(new ApiError(503, "X", "down"));
    renderApp("/search", { api });
    await screen.findByRole("heading", { name: "27 listings" });
    const btn = within(cards()[0]!).getAllByRole("button")[0]!;
    await userEvent.click(btn);
    expect(await screen.findByText(/Could not update saved listings/)).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });
});

describe("compare", () => {
  it("compares up to three and refuses a fourth", async () => {
    renderApp("/search?sort=price_asc");
    await screen.findByRole("heading", { name: "27 listings" });
    const boxes = screen.getAllByRole("checkbox", { name: "Compare" });
    for (const b of boxes.slice(0, 4)) await userEvent.click(b);
    expect(await screen.findByText(/compare up to 3 listings/)).toBeInTheDocument();
    expect(boxes[3]).not.toBeChecked();
    await userEvent.click(screen.getByRole("link", { name: /Compare/ }));
    expect(await screen.findByRole("heading", { name: "Compare 3 listings" })).toBeInTheDocument();
    expect(screen.getAllByText("Cheapest").length).toBeGreaterThan(0);
  });
  it("asks for at least two", async () => {
    renderApp("/compare");
    expect(screen.getByText("Pick 2 or 3 listings to compare")).toBeInTheDocument();
  });
});

describe("detail", () => {
  it("shows breakdown, original link and probable duplicate with reasons", async () => {
    renderApp("/listings/demo-berlin-2");
    expect(await screen.findByRole("heading", { name: "Monthly cost" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View original listing/ })).toHaveAttribute("href", expect.stringContaining("example.invalid"));
    expect(screen.getByText(/Probably the same flat/)).toBeInTheDocument();
    expect(screen.getByText(/Why: same neighborhood/)).toBeInTheDocument();
  });
  it("shows not found for a missing listing", async () => {
    renderApp("/listings/nope");
    expect(await screen.findByRole("heading", { name: "Not found" })).toBeInTheDocument();
  });
});

describe("add listing", () => {
  it("validates and creates a manual listing", async () => {
    renderApp("/listings/new");
    await userEvent.click(screen.getByRole("button", { name: "Add listing" }));
    expect(screen.getByText("Rent must be greater than 0.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Title"), "My room");
    await userEvent.type(screen.getByLabelText("City"), "Berlin");
    await userEvent.type(screen.getByLabelText("Neighborhood"), "Mitte");
    await userEvent.type(screen.getByLabelText("Rent"), "120");
    await userEvent.selectOptions(screen.getByLabelText("Per"), "week");
    await userEvent.click(screen.getByRole("button", { name: "Add listing" }));
    expect(await screen.findByRole("heading", { name: "My room" })).toBeInTheDocument();
    expect(screen.getByText("Added by you")).toBeInTheDocument();
    expect(screen.getByText(/weekly × 52 ÷ 12/)).toBeInTheDocument();
  });
});

describe("sources", () => {
  it("refreshes and reports a partial failure", async () => {
    renderApp("/sources", { failingSources: ["demo-b"] });
    await screen.findByRole("heading", { name: /Demo Source A/ });
    await userEvent.click(screen.getByRole("button", { name: "Refresh sources" }));
    expect(await screen.findByText(/1 source\(s\) failed/)).toBeInTheDocument();
    const b = screen.getByRole("listitem", { name: /Demo Source B/ });
    await waitFor(() => expect(b).toHaveTextContent("Failed"));
    expect(b).toHaveTextContent(/Listings stored\s*12/);
  });
  it("shows the 409 message when a refresh is already running", async () => {
    const api = new MockService();
    vi.spyOn(api, "refreshSources").mockRejectedValue(new ApiError(409, "REFRESH_IN_PROGRESS", "A refresh is already running"));
    renderApp("/sources", { api: api as ApiService });
    await userEvent.click(await screen.findByRole("button", { name: "Refresh sources" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already running");
  });
});

describe("currency", () => {
  it("re-prices results when the display currency changes", async () => {
    renderApp("/search?city=Berlin");
    await screen.findByRole("heading", { name: /listings/ });
    await userEvent.selectOptions(screen.getByLabelText("Show prices in"), "GBP");
    await waitFor(() => expect(cards()[0]).toHaveTextContent("≈ £"));
  });
});
