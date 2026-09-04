import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { StoredLogo } from "../domain/document";

const MAX_LOGO_BYTES = 1024 * 1024;

function dataUrlByteSize(dataUrl: string): number {
  const encoded = dataUrl.split(",")[1] ?? "";
  return Math.floor((encoded.length * 3) / 4) - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
}

async function normalizeLogo(file: File): Promise<StoredLogo> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ascii = (start: number, end: number) => new TextDecoder().decode(bytes.slice(start, end));
  const signatureMatches =
    (file.type === "image/png" && bytes[0] === 0x89 && ascii(1, 4) === "PNG") ||
    (file.type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (file.type === "image/webp" && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP");
  if (!signatureMatches) throw new Error("The image contents do not match the selected file type.");

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("This image could not be read."));
      element.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot process the image.");
    context.drawImage(image, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    const byteSize = dataUrlByteSize(dataUrl);
    if (byteSize > MAX_LOGO_BYTES) throw new Error("The processed image is larger than 1 MB. Choose a smaller image.");
    return { mimeType: "image/png", dataUrl, byteSize, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function LogoField({ value, onChange }: { value?: StoredLogo; onChange: (value?: StoredLogo) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const pick = async (file?: File) => {
    if (!file) return;
    if (!(["image/png", "image/jpeg", "image/webp"].includes(file.type))) { setError("Choose a PNG, JPEG, or WebP image."); return; }
    if (file.size > MAX_LOGO_BYTES) { setError("Choose an image smaller than 1 MB."); return; }
    try { onChange(await normalizeLogo(file)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "This image could not be processed."); }
  };
  return <div className="logo-field"><span className="control-label">Business logo</span>{value ? <img src={value.dataUrl} alt="Uploaded business logo" /> : <p>No logo selected. Images stay on this device.</p>}<div className="button-row"><button className="secondary" type="button" onClick={() => input.current?.click()}><ImagePlus />{value ? "Replace logo" : "Add logo"}</button>{value ? <button className="quiet destructive-text" type="button" onClick={() => onChange()}><Trash2 />Remove logo</button> : null}</div><input ref={input} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void pick(event.target.files?.[0])} />{error ? <p className="field-error" role="alert">{error}</p> : null}</div>;
}
