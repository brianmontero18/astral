import { useState, useEffect, useRef } from "react";
import { getUserAssets, uploadAsset, deleteAsset } from "../api";
import { getAssetFailureMessage } from "../asset-errors";
import type { AssetMeta } from "../types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(ft: string): string {
  if (ft === "natal") return "Carta Natal";
  if (ft === "hd") return "Diseño Humano";
  return ft;
}

interface PreviewContentProps {
  asset: AssetMeta;
}

interface TextPreviewProps {
  url: string;
}

export function AssetViewer() {
  const [assets, setAssets] = useState<AssetMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<AssetMeta | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAssets = () => {
    setLoading(true);
    setError(null);
    getUserAssets()
      .then(({ assets: a }) => setAssets(a))
      .catch((e) =>
        setError(getAssetFailureMessage(e, "No pudimos cargar tus archivos ahora.")),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAssets(); }, []);

  useEffect(() => {
    if (!previewAsset) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewAsset(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewAsset]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      await uploadAsset(file, "natal");
      loadAssets();
    } catch (e) {
      setError(getAssetFailureMessage(e, "No pudimos sincronizar el archivo."));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Querés eliminar este archivo? Esta acción no se puede deshacer.")) return;
    setError(null);
    try {
      await deleteAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      if (previewAsset?.id === id) setPreviewAsset(null);
    } catch (e) {
      setError(getAssetFailureMessage(e, "No pudimos eliminar el archivo."));
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: 60 }} className="animate-fade-in-slow">
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid rgba(33, 41, 30, 0.12)", borderTopColor: "var(--color-gold-deep)",
          animation: "spin 1s linear infinite", margin: "0 auto 16px",
        }} />
        <span style={{ color: "var(--text-on-light-muted)", fontSize: "13px", letterSpacing: "0.05em" }}>Cargando archivos...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px", flex: 1, overflowY: "auto", width: "100%", boxSizing: "border-box" as const }} className="animate-fade-in-slow">
      <h2 style={{ color: "var(--text-on-light)", fontSize: "26px", marginBottom: "8px", textAlign: "center", fontFamily: "var(--font-serif)", fontWeight: 500 }}>
        Mis Cartas
      </h2>
      <p style={{ color: "var(--text-on-light-muted)", fontSize: "14px", textAlign: "center", marginBottom: "32px", fontWeight: 400, lineHeight: 1.6 }}>
        Archivos originales sincronizados con tu perfil de Diseño Humano.
      </p>

      {error && (
        <div style={{
          background: "rgba(196, 96, 96, 0.14)",
          border: "1px solid rgba(196, 96, 96, 0.4)",
          borderRadius: 12,
          padding: "12px 16px",
          color: "#9a3737", fontSize: "13px", marginBottom: "24px", textAlign: "center"
        }}>
          {error}
        </div>
      )}

      {/* Upload button */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-primary"
        >
          {uploading ? "Sincronizando..." : "Agregar nueva carta"}
        </button>
      </div>

      {/* Asset list */}
      {assets.length === 0 && (
        <p style={{ color: "var(--text-on-light-faint)", fontSize: "14px", textAlign: "center", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
          Todavía no subiste archivos.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="glass-panel"
            style={{
              padding: "20px 24px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              animation: "fadeIn 0.4s ease",
              gap: 16,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "var(--text-main)", fontSize: "15px", fontWeight: 600, marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {asset.filename}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "12px", fontFamily: "var(--font-sans)" }}>
                {fileTypeLabel(asset.fileType)} · {formatSize(asset.sizeBytes)} · {new Date(asset.createdAt).toLocaleDateString("es-AR")}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button
                onClick={() => setPreviewAsset(asset)}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(248, 244, 232, 0.2)",
                  color: "var(--text-main)", padding: "6px 14px",
                  borderRadius: "20px", cursor: "pointer", fontSize: "11px",
                  letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; e.currentTarget.style.color = "var(--color-primary)"; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = "rgba(248, 244, 232, 0.2)"; e.currentTarget.style.color = "var(--text-main)"; }}
              >
                Ver
              </button>
              <button
                onClick={() => handleDelete(asset.id)}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(248, 244, 232, 0.16)",
                  color: "var(--text-muted)", padding: "6px 14px",
                  borderRadius: "20px", cursor: "pointer", fontSize: "11px",
                  letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = "rgba(196, 96, 96, 0.18)"; e.currentTarget.style.borderColor = "rgba(196, 96, 96, 0.5)"; e.currentTarget.style.color = "#f3c2c2"; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(248, 244, 232, 0.16)"; e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {previewAsset && (
        <div
          onClick={() => setPreviewAsset(null)}
          role="presentation"
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(33, 41, 30, 0.78)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
            animation: "fadeIn 0.3s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-preview-title"
            style={{
              padding: "24px",
              maxWidth: 800, width: "100%", maxHeight: "85vh",
              overflow: "auto",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "20px" }}>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: "var(--color-primary)",
                    fontSize: "9px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    marginBottom: "8px",
                  }}
                >
                  Vista previa
                </div>
                <div
                  id="asset-preview-title"
                  style={{ color: "var(--text-main)", fontSize: "16px", fontWeight: 500, fontFamily: "var(--font-serif)", lineHeight: 1.2, wordBreak: "break-word" }}
                >
                  {previewAsset.filename}
                </div>
                <div
                  style={{
                    marginTop: "8px",
                    color: "var(--text-muted)",
                    fontSize: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  {fileTypeLabel(previewAsset.fileType)} · {formatSize(previewAsset.sizeBytes)}
                </div>
              </div>
              <button
                onClick={() => setPreviewAsset(null)}
                aria-label="Cerrar vista previa"
                style={{
                  background: "transparent", border: "none",
                  color: "var(--text-muted)", fontSize: "24px", cursor: "pointer",
                  lineHeight: 1, padding: "0 8px", transition: "color 0.2s ease"
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = "var(--text-main)" }}
                onMouseOut={(e) => { e.currentTarget.style.color = "var(--text-muted)" }}
              >
                ×
              </button>
            </div>
            <PreviewContent asset={previewAsset} />
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewContent({ asset }: PreviewContentProps) {
  const url = `/api/assets/${asset.id}`;
  const mime = asset.mimeType ?? "";

  if (mime.startsWith("image/")) {
    return <img src={url} alt={asset.filename} style={{ width: "100%", borderRadius: 8 }} />;
  }

  if (mime === "application/pdf") {
    return <iframe src={url} title={asset.filename} style={{ width: "100%", height: "70vh", border: "none", borderRadius: 8 }} />;
  }

  if (mime === "text/plain") {
    return <TextPreview url={url} />;
  }

  return (
    <div
      style={{
        padding: "18px 20px",
        borderRadius: 12,
        border: "1px solid rgba(248, 244, 232, 0.1)",
        background: "rgba(248, 244, 232, 0.05)",
        color: "var(--text-muted)",
        fontSize: 13,
        lineHeight: 1.7,
      }}
    >
      Este archivo está guardado correctamente, pero no tiene vista previa dentro de Astral.
    </div>
  );
}

function TextPreview({ url }: TextPreviewProps) {
  const [text, setText] = useState("Cargando archivo...");

  useEffect(() => {
    let cancelled = false;

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("preview_unavailable");
        }

        return response.text();
      })
      .then((value) => {
        if (!cancelled) {
          setText(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setText("No pudimos mostrar este archivo ahora.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <pre style={{
      color: "var(--text-main)", fontSize: "13px", lineHeight: 1.8,
      background: "var(--surface-deeper)", border: "1px solid rgba(248, 244, 232, 0.1)",
      borderRadius: "12px", padding: "20px",
      overflow: "auto", maxHeight: "60vh", whiteSpace: "pre-wrap",
      fontFamily: "var(--font-sans)", fontWeight: 400
    }}>
      {text}
    </pre>
  );
}
