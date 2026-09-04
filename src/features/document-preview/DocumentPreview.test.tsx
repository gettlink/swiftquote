import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createLongDocumentFixture } from "../../domain/fixtures";
import { fromDomainDocument } from "../document-editor/model";
import { DocumentPreview } from "./DocumentPreview";

describe("DocumentPreview", () => {
  it("shows explicit page boundaries for long documents", () => {
    render(<DocumentPreview document={fromDomainDocument(createLongDocumentFixture())} />);
    expect(screen.getByLabelText("invoice preview, page 1 of 4")).toBeInTheDocument();
    expect(screen.getByLabelText("invoice preview, page 4 of 4")).toBeInTheDocument();
    expect(screen.getAllByText("Line items continued")).toHaveLength(3);
  });
});
