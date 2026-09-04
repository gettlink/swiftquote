import { DOCUMENT_SCHEMA_VERSION, type SwiftDocument } from "./document";

const FIXTURE_TIME = "2026-09-03T09:00:00.000Z";

export function createSampleDocument(): SwiftDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id: "doc_sample",
    type: "invoice",
    number: "SQ-1001",
    currency: "USD",
    pageSize: "a4",
    templateId: "modern",
    issueDate: "2026-09-03",
    dueDate: "2026-09-17",
    reference: "Website refresh",
    sender: {
      displayName: "Northline Studio",
      contactName: "Jordan Kim",
      email: "hello@northline.example",
      phone: "+1 555 014 2280",
      address: "41 Market Street\nPortland, OR 97205",
      taxId: "REG-482019",
      website: "https://northline.example",
    },
    customer: {
      displayName: "Harbor & Field Co.",
      contactName: "Morgan Lee",
      email: "accounts@harborfield.example",
      address: "88 River Avenue\nSeattle, WA 98101",
    },
    items: [
      { id: "item_sample_1", description: "Discovery and content planning", quantity: "4", unitPriceMinor: 12500, unitLabel: "hours", taxable: true },
      { id: "item_sample_2", description: "Interface design and responsive layouts", quantity: "1", unitPriceMinor: 180000, unitLabel: "project", taxable: true },
      { id: "item_sample_3", description: "Handover documentation", quantity: "1", unitPriceMinor: 25000, unitLabel: "package", taxable: false },
    ],
    adjustment: { discountBasisPoints: 500, taxBasisPoints: 750, feeLabel: "Project setup", feeMinor: 7500, amountPaidMinor: 50000 },
    clientNote: "Thank you for the opportunity to work together.",
    paymentInstructions: "Please include the invoice number with your payment.",
    terms: "Payment is due within 14 days. Work outside the listed scope requires written approval.",
    createdAt: FIXTURE_TIME,
    updatedAt: FIXTURE_TIME,
  };
}

export function createLongDocumentFixture(itemCount = 40): SwiftDocument {
  const document = createSampleDocument();
  return {
    ...document,
    id: "doc_long_fixture",
    number: "SQ-1099",
    sender: {
      ...document.sender,
      displayName: "Northline Independent Digital Product Strategy and Communication Studio",
      address: "41 Market Street, Studio 900\nCentral Business District\nPortland, Oregon 97205\nUnited States",
    },
    customer: {
      ...document.customer,
      displayName: "Harbor and Field International Community Development Cooperative",
      address: "88 River Avenue\nBuilding Four, Procurement Department\nSeattle, Washington 98101\nUnited States",
    },
    items: Array.from({ length: itemCount }, (_, index) => ({
      id: `item_long_${index + 1}`,
      description: `Service item ${index + 1}: detailed planning, implementation, review, documentation, and coordinated handover for the agreed project workstream.`,
      quantity: index % 3 === 0 ? "1.5" : "1",
      unitPriceMinor: 12500 + index * 275,
      unitLabel: "hours",
      taxable: index % 4 !== 0,
    })),
    clientNote: "This document contains a deliberately long client note used to verify that complete sentences wrap without clipping, overlapping totals, or leaving important content outside the printable page area.\n\nPlease review each workstream and contact the sender if a scope detail needs correction before payment.",
    terms: "Payment is due within 14 days of the issue date. Each deliverable includes one consolidated review cycle. Additional revisions require written approval and may be billed separately. All supplied customer materials remain the customer's responsibility. Line breaks and extended terms must remain readable in preview and export.",
  };
}
