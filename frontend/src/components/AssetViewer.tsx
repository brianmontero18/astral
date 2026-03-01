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
      <div style={{ textAlign: "center", marginTop: 60, color: "#7c6fcd", fontSize: 13 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid rgba(124,111,205,0.3)", borderTopColor: "#7c6fcd",
          animation: "spin 1s linear infinite", margin: "0 auto 16px",
        }} />
        Cargando cartas...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px", flex: 1, overflowY: "auto" }}>
      <h2 style={{ color: "#e8e0ff", fontSize: 20, marginBottom: 8, textAlign: "center", fontFamily: "Georgia, serif" }}>
        Mis Cartas
      </h2>
      <p style={{ color: "#7c6fcd", fontSize: 12, textAlign: "center", marginBottom: 24 }}>
        Archivos originales subidos para generar tu perfil
      </p>

      {error && (
        <div style={{
          background: "rgba(201,107,122,0.12)", border: "1px solid rgba(201,107,122,0.35)",
          borderRadius: 10, padding: "10px 14px", color: "#f0a0b0", fontSize: 13, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Upload button */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
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
          style={{
            background: "rgba(124,111,205,0.15)",
            border: "1px solid rgba(124,111,205,0.4)",
            color: "#b0a4e8", padding: "10px 20px",
            borderRadius: 12, cursor: "pointer", fontSize: 13,
            fontFamily: "Georgia, serif",
          }}
        >
          {uploading ? "Subiendo..." : "Subir nueva carta"}
        </button>
      </div>

      {/* Asset list */}
      {assets.length === 0 && (
        <p style={{ color: "#7c6fcd", fontSize: 13, textAlign: "center", fontStyle: "italic" }}>
          No hay archivos subidos.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {assets.map((asset) => (
          <div
            key={asset.id}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(124,111,205,0.25)",
              borderRadius: 12, padding: "14px 16px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              animation: "fadeIn 0.3s ease",
            }}
          >
            <div>
              <div style={{ color: "#e8e0ff", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                {asset.filename}
              </div>
              <div style={{ color: "#7c6fcd", fontSize: 11 }}>
                {fileTypeLabel(asset.fileType)} · {formatSize(asset.sizeBytes)} · {new Date(asset.createdAt).toLocaleDateString("es-AR")}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setPreviewAsset(asset)}
                style={{
                  background: "rgba(124,111,205,0.15)",
                  border: "1px solid rgba(124,111,205,0.3)",
                  color: "#b0a4e8", padding: "5px 12px",
                  borderRadius: 8, cursor: "pointer", fontSize: 11,
                }}
              >
                Ver
              </button>
              <button
                onClick={() => handleDelete(asset.id)}
                style={{
                  background: "rgba(201,107,122,0.1)",
                  border: "1px solid rgba(201,107,122,0.3)",
                  color: "#f0a0b0", padding: "5px 12px",
                  borderRadius: 8, cursor: "pointer", fontSize: 11,
                }}
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
            background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#110a2e",
              border: "1px solid rgba(124,111,205,0.4)",
              borderRadius: 16, padding: 20,
              maxWidth: 700, width: "100%", maxHeight: "85vh",
              overflow: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ color: "#e8e0ff", fontSize: 14, fontWeight: 600 }}>{previewAsset.filename}</span>
              <button
                onClick={() => setPreviewAsset(null)}
                style={{
                  background: "transparent", border: "none",
                  color: "#7c6fcd", fontSize: 18, cursor: "pointer",
                }}
              >
                ✕
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

  if (asset.mimeType.startsWith("image/")) {
    return <img src={url} alt={asset.filename} style={{ width: "100%", borderRadius: 8 }} />;
  }

  if (asset.mimeType === "application/pdf") {
    return <iframe src={url} title={asset.filename} style={{ width: "100%", height: "70vh", border: "none", borderRadius: 8 }} />;
  }

  if (asset.mimeType === "text/plain") {
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
      color: "#d4cef0", fontSize: 12, lineHeight: 1.6,
      background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 16,
      overflow: "auto", maxHeight: "60vh", whiteSpace: "pre-wrap",
    }}>
      {text}
    </pre>
  );
}
