import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

export function Dialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current; if (!dialog) return; if (open && !dialog.open) dialog.showModal(); if (!open && dialog.open) dialog.close(); }, [open]);
  useEffect(() => { const dialog = ref.current; const close = () => onClose(); dialog?.addEventListener("close", close); return () => dialog?.removeEventListener("close", close); }, [onClose]);
  return <dialog ref={ref} className="dialog" aria-labelledby={titleId}><div className="dialog-head"><h2 id={titleId}>{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label={`Close ${title}`}><X /></button></div>{children}</dialog>;
}
