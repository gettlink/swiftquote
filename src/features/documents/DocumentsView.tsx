import { Copy, Download, FileText, RotateCcw, Trash2, Upload } from "lucide-react";
import { money, totals, type SwiftDocument } from "../document-editor/model";

type Props = {
  documents: SwiftDocument[];
  onOpen: (document: SwiftDocument) => void;
  onDuplicate: (document: SwiftDocument) => void;
  onConvert: (document: SwiftDocument) => void;
  onDelete: (document: SwiftDocument) => void;
  onImport: () => void;
  onExport: (document: SwiftDocument) => void;
};

export function DocumentsView({ documents, onOpen, onDuplicate, onConvert, onDelete, onImport, onExport }: Props) {
  return (
    <main className="page" id="main-content">
      <div className="page-heading"><div><h1>Documents</h1><p>Documents are saved in this browser on this device. They are not backed up or synced.</p></div><button className="secondary" type="button" onClick={onImport}><Upload />Import JSON</button></div>
      {documents.length ? <div className="document-list">{documents.map((document) => {
        const total = totals(document).total;
        return <article className="document-card" key={document.id}>
          <button className="document-open" type="button" onClick={() => onOpen(document)}><FileText /><span><strong>{document.kind === "quote" ? "Quote" : "Invoice"} {document.number}</strong><small>{document.customer.name || "No customer"} · Issued {document.issueDate} · Edited {new Date(document.updatedAt).toLocaleDateString()}</small></span><b>{money(total, document.currency)}</b></button>
          <div className="card-actions"><button className="quiet" type="button" onClick={() => onExport(document)}><Download />Export JSON</button><button className="quiet" type="button" onClick={() => onDuplicate(document)}><Copy />Duplicate</button>{document.kind === "quote" ? <button className="quiet" type="button" onClick={() => onConvert(document)}><RotateCcw />Convert to invoice</button> : null}<button className="quiet destructive-text" type="button" onClick={() => onDelete(document)}><Trash2 />Delete document</button></div>
        </article>;
      })}</div> : <section className="empty-state"><FileText /><h2>No saved documents</h2><p>Create a document, then choose Import JSON or save a new document.</p><button className="secondary" type="button" onClick={onImport}><Upload />Import JSON</button></section>}
    </main>
  );
}
