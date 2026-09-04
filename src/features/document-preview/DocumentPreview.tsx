import { money, totals, type Party, type SwiftDocument } from "../document-editor/model";

const ITEMS_PER_PAGE = 12;
const compactParty = (party: Party) => [party.contact, party.address, party.email, party.phone, party.taxId, party.website].filter(Boolean);

export function DocumentPreview({ document }: { document: SwiftDocument }) {
  const calculated = totals(document);
  const pages = Array.from({ length: Math.max(1, Math.ceil(calculated.lines.length / ITEMS_PER_PAGE)) }, (_, index) =>
    calculated.lines.slice(index * ITEMS_PER_PAGE, (index + 1) * ITEMS_PER_PAGE),
  );

  return (
    <div className="preview-wrap">
      {pages.map((lines, pageIndex) => {
        const isLastPage = pageIndex === pages.length - 1;
        return (
          <article className={`paper ${document.template} ${document.pageSize.toLowerCase()}`} aria-label={`${document.kind} preview, page ${pageIndex + 1} of ${pages.length}`} key={pageIndex}>
            <header className="document-header">
              <div className="brand-block">{document.logo ? <img src={document.logo.dataUrl} alt="" /> : null}<h2>{document.sender.name || "Your business"}</h2>{compactParty(document.sender).map((line, index) => <p key={index}>{line}</p>)}</div>
              <div className="identity"><h1>{document.kind === "quote" ? "Quotation" : "Invoice"}</h1><p>{document.number || "Document number"}</p></div>
            </header>
            {pageIndex === 0 ? <section className="document-meta"><div><h3>Prepared for</h3><strong>{document.customer.name || "Customer name"}</strong>{compactParty(document.customer).map((line, index) => <p key={index}>{line}</p>)}</div><dl><div><dt>Issue date</dt><dd>{document.issueDate}</dd></div><div><dt>{document.kind === "quote" ? "Expiry date" : "Due date"}</dt><dd>{document.endDate}</dd></div>{document.reference ? <div><dt>Reference</dt><dd>{document.reference}</dd></div> : null}</dl></section> : <div className="continued-label">Line items continued</div>}
            <table className="document-table"><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{lines.map((entry) => <tr key={entry.id}><td><strong>{entry.description || "Line item"}</strong>{entry.unit ? <small>{entry.unit}</small> : null}</td><td>{entry.quantity}</td><td>{money(Number(entry.unitPrice) || 0, document.currency)}</td><td>{money(entry.total, document.currency)}</td></tr>)}</tbody></table>
            {isLastPage ? <><div className="document-bottom"><div className="document-copy">{document.note ? <section><h3>Note</h3><p>{document.note}</p></section> : null}{document.paymentInstructions ? <section><h3>Payment instructions</h3><p>{document.paymentInstructions}</p></section> : null}</div><dl className="document-totals"><div><dt>Subtotal</dt><dd>{money(calculated.subtotal, document.currency)}</dd></div>{calculated.discount ? <div><dt>Discount</dt><dd>-{money(calculated.discount, document.currency)}</dd></div> : null}{calculated.tax ? <div><dt>Tax</dt><dd>{money(calculated.tax, document.currency)}</dd></div> : null}{Number(document.feeAmount) ? <div><dt>{document.feeLabel || "Additional fee"}</dt><dd>{money(Number(document.feeAmount), document.currency)}</dd></div> : null}<div className="total"><dt>Total</dt><dd>{money(calculated.total, document.currency)}</dd></div>{document.kind === "invoice" ? <><div><dt>Paid</dt><dd>{money(Number(document.amountPaid) || 0, document.currency)}</dd></div><div className="balance"><dt>Balance due</dt><dd>{money(calculated.balance, document.currency)}</dd></div></> : null}</dl></div>{document.terms ? <footer><h3>Terms and conditions</h3><p>{document.terms}</p></footer> : null}</> : null}
            <p className="page-number">Page {pageIndex + 1} of {pages.length}</p>
          </article>
        );
      })}
    </div>
  );
}
