import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DocumentEditor } from "./DocumentEditor";
import { sampleDocument, totals } from "./model";

afterEach(cleanup);

describe("DocumentEditor", () => {
  it("switches quote fields to invoice fields without losing document data", () => {
    let current = sampleDocument();
    const view = render(<DocumentEditor document={current} errors={{}} onChange={(next) => { current = next; view.rerender(<DocumentEditor document={current} errors={{}} onChange={() => undefined} />); }} />);
    fireEvent.click(screen.getByRole("button", { name: "Invoice" }));
    expect(screen.getByLabelText("Due date")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount paid")).toBeInTheDocument();
    expect(current.customer.name).toBe("Acme Workshop");
  });

  it("adds, duplicates, moves, and deletes line items with labelled controls", () => {
    let current = sampleDocument();
    const update = (next: typeof current) => { current = next; view.rerender(<DocumentEditor document={current} errors={{}} onChange={update} />); };
    const view = render(<DocumentEditor document={current} errors={{}} onChange={update} />);
    const ui = within(view.container);
    fireEvent.click(ui.getByRole("button", { name: "Add line item" }));
    expect(current.items).toHaveLength(3);
    fireEvent.click(ui.getByRole("button", { name: "Duplicate item 1" }));
    expect(current.items).toHaveLength(4);
    fireEvent.click(ui.getByRole("button", { name: "Move item 1 down" }));
    expect(current.items[1].description).toBe("Discovery and content planning");
    fireEvent.click(ui.getByRole("button", { name: "Delete item 1" }));
    expect(current.items).toHaveLength(3);
  });
});

describe("document totals", () => {
  it("calculates subtotal, tax, discount, fees, and invoice balance", () => {
    const document = { ...sampleDocument(), kind: "invoice" as const, discountRate: "10", taxRate: "8", feeAmount: "20", amountPaid: "100" };
    const result = totals(document);
    expect(result.subtotal).toBe(2900);
    expect(result.discount).toBe(290);
    expect(result.tax).toBe(208.8);
    expect(result.total).toBe(2838.8);
    expect(result.balance).toBe(2738.8);
  });
});
