import type { Listing, MonthlyCost } from "../domain/types";
import { money, rateNote } from "../lib/format";

/** Monthly total first; breakdown and original price beneath. Converted prices say so, with rate, date and source. */
export function Price({ listing, cost, size = "md" }: { listing: Listing; cost: MonthlyCost | null; size?: "md" | "lg" }) {
  const original = `${money(listing.rentAmount, listing.currency)} / ${listing.rentPeriod}`;
  if (!cost) {
    return (
      <div className={`price price-${size}`}>
        <div className="price-total">{original}</div>
        <div className="price-note warn">Not converted: no exchange rate available for {listing.currency}.</div>
      </div>
    );
  }
  const note = rateNote(cost);
  const utilities = listing.utilitiesIncluded ? "utilities included"
    : cost.utilitiesKnown ? `+ ${money(cost.utilitiesMonthly, cost.native.currency)} utilities` : "utilities unknown, not included";
  return (
    <div className={`price price-${size}`}>
      <div className="price-total" title={note ?? undefined}>
        {cost.converted && <span aria-label="approximately">≈ </span>}
        {money(cost.amount, cost.currency)}<span className="per"> / month</span>
      </div>
      <div className="price-note">
        {money(cost.rentMonthly, cost.native.currency)} rent {utilities}
        {!cost.utilitiesKnown && <span className="warn"> ⚠</span>}
      </div>
      <div className="price-note muted">Listed as {original}{cost.converted ? ` (${cost.native.currency})` : ""}</div>
      {note && size === "lg" && <div className="price-note muted">{note}</div>}
    </div>
  );
}
