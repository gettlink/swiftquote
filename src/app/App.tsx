import { Check, Download, FilePlus2, Files, Printer, Save, Settings as SettingsIcon, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "../components/Dialog";
import type { CurrencyCode } from "../domain/currency";
import { convertQuoteToInvoice, type Party as DomainParty, type SwiftDocument as DomainDocument } from "../domain/document";
import { commitDocumentImport, downloadDocumentJson, readDocumentImportFile } from "../features/import-export";
import { DocumentEditor } from "../features/document-editor/DocumentEditor";
import { blankDocument, fromDomainDocument, sampleDocument, toDomainDocument, uid, validate, type Party, type SwiftDocument } from "../features/document-editor/model";
import { DocumentPreview } from "../features/document-preview/DocumentPreview";
import { DocumentsView } from "../features/documents/DocumentsView";
import { SettingsView, type Settings } from "../features/settings/SettingsView";
import {
  deleteWithUndo,
  MemorySwiftQuoteRepository,
  SerializedAutosave,
  summarizeSwiftDocument,
  swiftDocumentCodec,
  type DeleteUndoToken,
  type SwiftQuoteRepository,
} from "../storage";
import { createSwiftQuoteRepository } from "../storage/swiftquote-repository";

type View = "workspace" | "documents" | "settings";

const DEFAULT_SETTINGS: Settings = { currency: "USD", pageSize: "A4", paymentTermsDays: 14 };

function profileFromDomain(profile?: DomainParty): Party | undefined {
  if (!profile) return undefined;
  return {
    name: profile.displayName,
    contact: profile.contactName ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    taxId: profile.taxId ?? "",
    website: profile.website ?? "",
  };
}

function profileToDomain(profile?: Party): DomainParty | undefined {
  if (!profile || !Object.values(profile).some((value) => Boolean(value))) return undefined;
  return {
    displayName: profile.name,
    contactName: profile.contact || undefined,
    email: profile.email || undefined,
    phone: profile.phone || undefined,
    address: profile.address || undefined,
    taxId: profile.taxId || undefined,
    website: profile.website || undefined,
  };
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function App() {
  const [status, setStatus] = useState("Ready");
  const repositoryBundle = useMemo((): { repository: SwiftQuoteRepository<DomainDocument>; persistent: boolean } => {
    try {
      return { repository: createSwiftQuoteRepository(), persistent: true };
    } catch {
      return {
        repository: new MemorySwiftQuoteRepository(swiftDocumentCodec, summarizeSwiftDocument),
        persistent: false,
      };
    }
  }, []);
  const repository = repositoryBundle.repository;
  const [document, setDocument] = useState<SwiftDocument>(() => sampleDocument());
  const [documents, setDocuments] = useState<SwiftDocument[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("workspace");
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [deleting, setDeleting] = useState<SwiftDocument>();
  const [undoToken, setUndoToken] = useState<DeleteUndoToken<DomainDocument> | null>(null);
  const [importCollision, setImportCollision] = useState<DomainDocument>();
  const importInput = useRef<HTMLInputElement>(null);

  const autosave = useMemo(() => new SerializedAutosave<DomainDocument>({
    debounceMs: 450,
    write: (value) => repository.saveActiveDraft(value),
    onStateChange: (state) => {
      if (state.status === "dirty") setStatus("Unsaved changes");
      if (state.status === "saving") setStatus("Saving changes");
      if (state.status === "saved") setStatus("Saved on this device");
      if (state.status === "error") setStatus("Could not save locally. Keep this tab open and export a backup.");
    },
  }), [repository]);

  const refreshDocuments = async () => {
    const summaries = await repository.list();
    const loaded = await Promise.all(summaries.map((entry) => repository.get(entry.id)));
    setDocuments(loaded.filter((entry): entry is DomainDocument => Boolean(entry)).map(fromDomainDocument));
  };

  useEffect(() => {
    void (async () => {
      try {
        const [draft, localSettings] = await Promise.all([repository.getActiveDraft(), repository.getSettings()]);
        if (draft) setDocument(fromDomainDocument(draft));
        await refreshDocuments();
        setSettings({
          currency: localSettings.defaultCurrency,
          pageSize: localSettings.defaultPageSize === "a4" ? "A4" : "LETTER",
          paymentTermsDays: localSettings.defaultPaymentTermsDays,
          businessProfile: profileFromDomain(localSettings.businessProfile),
        });
        if (!repositoryBundle.persistent) setStatus("Local storage is unavailable. Keep this tab open and export a backup.");
      } catch (cause) {
        setStatus(cause instanceof Error ? cause.message : "Local storage is unavailable. Keep this tab open and export a backup.");
      } finally {
        setHydrated(true);
      }
    })();
  }, [repository]);

  useEffect(() => {
    if (hydrated) autosave.schedule(toDomainDocument(document));
  }, [autosave, document, hydrated]);

  useEffect(() => () => {
    void autosave.flush().catch(() => undefined);
  }, [autosave]);

  useEffect(() => {
    if (!hydrated) return;
    void repository.saveSettings({
      schemaVersion: 1,
      defaultCurrency: settings.currency as CurrencyCode,
      defaultPageSize: settings.pageSize === "A4" ? "a4" : "letter",
      defaultPaymentTermsDays: settings.paymentTermsDays,
      businessProfile: profileToDomain(settings.businessProfile),
    }).catch(() => setStatus("Settings could not be saved. Try again."));
  }, [hydrated, repository, settings]);

  useEffect(() => {
    if (!undoToken) return;
    const remaining = Math.max(0, undoToken.expiresAt - Date.now());
    const timer = setTimeout(() => { undoToken.commit(); setUndoToken(null); }, remaining);
    return () => clearTimeout(timer);
  }, [undoToken]);

  const errorList = useMemo(() => Object.values(errors), [errors]);
  const save = async () => {
    try {
      await autosave.flush();
      await repository.save(toDomainDocument(document));
      await refreshDocuments();
      setStatus("Document saved on this device");
    } catch {
      setStatus("Could not save this document. Export a backup and try again.");
    }
  };

  const fresh = async () => {
    await autosave.flush().catch(() => undefined);
    const next = blankDocument();
    next.currency = settings.currency;
    next.pageSize = settings.pageSize;
    next.endDate = addDays(next.issueDate, settings.paymentTermsDays);
    if (settings.businessProfile) next.sender = { ...settings.businessProfile };
    setDocument(next);
    setConfirmNew(false);
    setView("workspace");
  };

  const open = async (next: SwiftDocument) => {
    await autosave.flush().catch(() => undefined);
    setDocument(next);
    setView("workspace");
  };

  const duplicate = (source: SwiftDocument) => void open({ ...source, id: uid(), number: `${source.number}-COPY`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  const convert = (source: SwiftDocument) => void open(fromDomainDocument(convertQuoteToInvoice(toDomainDocument(source), source.number.replace(/^SQ/, "INV"))));

  const remove = async () => {
    if (!deleting) return;
    try {
      const token = await deleteWithUndo({ repository, id: deleting.id, undoMs: 8_000 });
      setDeleting(undefined);
      setUndoToken(token);
      await refreshDocuments();
      setStatus("Document deleted. You can undo this for 8 seconds.");
    } catch {
      setStatus("Could not delete this document. Try again.");
    }
  };

  const undoDelete = async () => {
    if (!undoToken) return;
    const result = await undoToken.undo();
    setUndoToken(null);
    if (result === "restored") { await refreshDocuments(); setStatus("Document restored"); }
    else if (result === "collision") setStatus("The document could not be restored because its ID is in use.");
    else setStatus("The undo period has ended.");
  };

  const download = async () => {
    const nextErrors = validate(document);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMobileTab("edit");
      setStatus("Fix the listed fields before downloading");
      setTimeout(() => globalThis.document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(), 0);
      return;
    }
    setStatus("Preparing PDF");
    try {
      const { downloadDocumentPdf } = await import("../pdf/downloadDocumentPdf");
      await downloadDocumentPdf(document);
      setStatus("PDF downloaded");
    } catch (cause) {
      console.error("PDF generation failed", cause);
      setStatus("PDF could not be created. Try again.");
    }
  };

  const clearAll = async () => {
    try {
      await repository.clearAll();
      setDocuments([]);
      setSettings(DEFAULT_SETTINGS);
      setDocument(sampleDocument());
      setConfirmClear(false);
      setView("workspace");
      setStatus("Local data cleared");
    } catch {
      setStatus("Local data could not be cleared. Try again.");
    }
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const incoming = await readDocumentImportFile(file);
      const result = await commitDocumentImport({ repository, document: incoming });
      if (result.status === "collision") { setImportCollision(incoming); return; }
      await refreshDocuments();
      setStatus("Document imported");
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "This file could not be imported.");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };

  const resolveImport = async (collision: "replace" | "copy") => {
    if (!importCollision) return;
    const result = await commitDocumentImport({ repository, document: importCollision, collision });
    if (result.status === "imported") { await refreshDocuments(); setStatus("Document imported"); }
    setImportCollision(undefined);
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <button className="wordmark" type="button" onClick={() => setView("workspace")}>SwiftQuote</button>
        <nav aria-label="Primary navigation">
          <button className="quiet" type="button" aria-current={view === "documents" ? "page" : undefined} onClick={() => setView("documents")}><Files />Documents</button>
          <button className="quiet" type="button" aria-current={view === "settings" ? "page" : undefined} onClick={() => setView("settings")}><SettingsIcon />Settings</button>
        </nav>
        {view !== "workspace" ? <span className="save-status" role="status">{status}</span> : null}
        {view === "workspace" ? <div className="top-actions"><span className="save-status" role="status"><Check />{status}</span><button className="secondary" type="button" onClick={() => setConfirmNew(true)}><FilePlus2 />New</button><button className="secondary" type="button" onClick={() => void save()}><Save />Save document</button><button className="primary" type="button" onClick={() => void download()}><Download />Download PDF</button></div> : null}
      </header>
      {view === "workspace" ? <main id="main-content" className="workspace">
        <div className="mobile-tabs" role="tablist" aria-label="Workspace view"><button role="tab" aria-selected={mobileTab === "edit"} onClick={() => setMobileTab("edit")}>Edit</button><button role="tab" aria-selected={mobileTab === "preview"} onClick={() => setMobileTab("preview")}>Preview</button></div>
        <div className={`editor-pane ${mobileTab !== "edit" ? "mobile-hidden" : ""}`}>{errorList.length ? <div className="error-summary" role="alert"><h2>Check this document</h2><ul>{errorList.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}<DocumentEditor document={document} errors={errors} onChange={(next) => { setDocument(next); setErrors({}); }} /><div className="backup-row"><button className="secondary" type="button" onClick={() => downloadDocumentJson(toDomainDocument(document))}><Download />Export JSON backup</button><p>Use a backup to move this document to another browser or device.</p></div></div>
        <aside className={`preview-pane ${mobileTab !== "preview" ? "mobile-hidden" : ""}`} aria-label="Document preview"><div className="preview-toolbar"><span>{document.pageSize === "A4" ? "A4" : "US Letter"} preview</span><button className="quiet compact" type="button" onClick={() => window.print()}><Printer />Print</button></div><DocumentPreview document={document} /></aside>
        <div className="mobile-actions"><button className="secondary" type="button" onClick={() => void save()}><Save />Save</button><button className="primary" type="button" onClick={() => void download()}><Download />Download PDF</button></div>
      </main> : null}
      {view === "documents" ? <DocumentsView documents={documents} onOpen={(entry) => void open(entry)} onDuplicate={duplicate} onConvert={convert} onDelete={setDeleting} onImport={() => importInput.current?.click()} onExport={(entry) => downloadDocumentJson(toDomainDocument(entry))} /> : null}
      {view === "settings" ? <SettingsView settings={settings} onChange={setSettings} onClear={() => setConfirmClear(true)} /> : null}
      <input className="visually-hidden" ref={importInput} type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />
      {undoToken ? <div className="undo-bar" role="status"><span>Document deleted</span><button className="secondary compact" type="button" onClick={() => void undoDelete()}><Undo2 />Undo delete</button></div> : null}
      <Dialog open={confirmNew} title="Create a blank document?" onClose={() => setConfirmNew(false)}><p>Your current draft will be replaced. Save it as a document or export a backup first if you need to keep it.</p><div className="dialog-actions"><button className="secondary" type="button" onClick={() => setConfirmNew(false)}>Keep editing</button><button className="primary" type="button" onClick={() => void fresh()}>Create blank document</button></div></Dialog>
      <Dialog open={Boolean(deleting)} title="Delete document?" onClose={() => setDeleting(undefined)}><p>This removes the saved document from this browser. You can undo it for 8 seconds.</p><div className="dialog-actions"><button className="secondary" type="button" onClick={() => setDeleting(undefined)}>Keep document</button><button className="destructive" type="button" onClick={() => void remove()}>Delete document</button></div></Dialog>
      <Dialog open={confirmClear} title="Clear all local data?" onClose={() => setConfirmClear(false)}><p>This removes every saved document and setting from this browser. Export anything you need first.</p><div className="dialog-actions"><button className="secondary" type="button" onClick={() => setConfirmClear(false)}>Keep data</button><button className="destructive" type="button" onClick={() => void clearAll()}>Clear local data</button></div></Dialog>
      <Dialog open={Boolean(importCollision)} title="A document with this ID already exists" onClose={() => setImportCollision(undefined)}><p>Replace the saved document or import a separate copy.</p><div className="dialog-actions"><button className="secondary" type="button" onClick={() => void resolveImport("copy")}>Import a copy</button><button className="primary" type="button" onClick={() => void resolveImport("replace")}>Replace document</button></div></Dialog>
    </div>
  );
}
