import { useState, useEffect, useRef } from "react";
import { getUserAssets, uploadAsset, deleteAsset } from "../api";
import type { AssetMeta } from "../types";

interface Props {
  userId: string;
}

export function AssetViewer({ userId }: Props) {
  const [assets, setAssets] = useState<AssetMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<AssetMeta | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAssets = () => {
    setLoading(true);
    getUserAssets(userId)
      .then(({ assets: a }) => setAssets(a))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAssets(); }, [userId]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      await uploadAsset(userId, file, "natal");
      loadAssets();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este archivo?")) return;
    try {
      await deleteAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      if (previewAsset?.id === id) setPreviewAsset(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fileTypeLabel = (ft: string) => {
    if (ft === "natal") return "Carta Natal";
    if (ft === "hd") return "Diseño Humano";
    return ft;
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: 60 }} className="animate-fade-in-slow">
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid var(--color-primary-faint)", borderTopColor: "var(--color-primary)",
          animation: "spin 1s linear infinite", margin: "0 auto 16px",
        }} />
        <span style={{ color: "var(--text-faint)", fontSize: "13px", letterSpacing: "0.05em" }}>Cargando códices...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px", flex: 1, overflowY: "auto", width: "100%", boxSizing: "border-box" as const }} className="animate-fade-in-slow">
      <h2 style={{ color: "var(--text-main)", fontSize: "24px", marginBottom: "8px", textAlign: "center", fontFamily: "var(--font-serif)", fontWeight: 400 }}>
        Mis Cartas
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginBottom: "32px", fontWeight: 300 }}>
        Archivos originales sincronizados con tu perfil astral.
      </p>

      {error && (
        <div className="glass-panel" style={{
          borderColor: "rgba(201,107,122,0.3)", padding: "12px 16px",
          color: "#f0a0b0", fontSize: "13px", marginBottom: "24px", textAlign: "center"
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
          className="btn-secondary"
        >
          {uploading ? "SINCRONIZANDO..." : "AGREGAR NUEVA CARTA"}
        </button>
      </div>

      {/* Asset list */}
      {assets.length === 0 && (
        <p style={{ color: "var(--text-faint)", fontSize: "14px", textAlign: "center", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
          El vacío cósmico. No hay archivos subidos.
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
            }}
          >
            <div>
              <div style={{ color: "var(--text-main)", fontSize: "15px", fontWeight: 500, marginBottom: "4px" }}>
                {asset.filename}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "12px", fontFamily: "var(--font-serif)" }}>
                {fileTypeLabel(asset.fileType)} · {formatSize(asset.sizeBytes)} · {new Date(asset.createdAt).toLocaleDateString("es-AR")}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setPreviewAsset(asset)}
                style={{
                  background: "transparent",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-main)", padding: "6px 14px",
                  borderRadius: "20px", cursor: "pointer", fontSize: "11px",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--color-primary-dim)" }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)" }}
              >
                Ver
              </button>
              <button
                onClick={() => handleDelete(asset.id)}
                style={{
                  background: "rgba(201,107,122,0.1)",
                  border: "1px solid rgba(201,107,122,0.3)",
                  color: "#f0a0b0", padding: "6px 14px",
                  borderRadius: "20px", cursor: "pointer", fontSize: "11px",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = "rgba(201,107,122,0.2)" }}
                onMouseOut={(e) => { e.currentTarget.style.background = "rgba(201,107,122,0.1)" }}
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
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(10, 9, 16, 0.85)",
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
            style={{
              padding: "24px",
              maxWidth: 800, width: "100%", maxHeight: "85vh",
              overflow: "auto",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <span style={{ color: "var(--text-main)", fontSize: "16px", fontWeight: 500, fontFamily: "var(--font-serif)" }}>{previewAsset.filename}</span>
              <button
                onClick={() => setPreviewAsset(null)}
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

function PreviewContent({ asset }: { asset: AssetMeta }) {
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

  return <p style={{ color: "#7c6fcd", fontSize: 13 }}>Vista previa no disponible para este tipo de archivo.</p>;
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState("Cargando...");

  useEffect(() => {
    fetch(url).then((r) => r.text()).then(setText).catch(() => setText("Error cargando archivo."));
  }, [url]);

  return (
    <pre style={{
      color: "var(--text-main)", fontSize: "13px", lineHeight: 1.8,
      background: "var(--bg-dark)", border: "1px solid var(--glass-border)", 
      borderRadius: "12px", padding: "20px",
      overflow: "auto", maxHeight: "60vh", whiteSpace: "pre-wrap",
      fontFamily: "var(--font-sans)", fontWeight: 300
    }}>
      {text}
    </pre>
  );
}
