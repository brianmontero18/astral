/**
 * MyChartView — pantalla "Mi carta" (Dirección B refinada).
 *
 * Modelo "una carta activa" reconstruida desde data: no se muestra el PDF
 * original, sólo la versión rendereada. El chart vive como hero (SVG
 * chart-only, sin paneles ni header embebidos — esos elementos están en el
 * shell HTML alrededor y evitan la doble lectura).
 *
 * Layout:
 *   - Cluster de acciones responsive (desktop inline, mobile stack).
 *   - Identity card forest con nombre, tipo, perfil/autoridad/etc.
 *   - Origin band con lugar, momento, coordenadas.
 *   - Hero grid 60/40: chart SVG | panel derecho con Canales / Diseño /
 *     Personalidad (variable labels canónicas).
 *
 * Exports: PNG y PDF usan el full document SVG / renderBodygraphPdf — esos
 * siguen siendo standalone, con todo el contexto embebido.
 */
import { useEffect, useRef, useState } from "react";
import type { LocalUser, UserProfile } from "../types";
import type { ReplaceBodygraphResponse } from "../api";
import { MyChartReplaceView } from "./MyChartReplaceView";

interface Props {
  user: LocalUser;
  profile: UserProfile;
  onBodygraphReplaced: (result: ReplaceBodygraphResponse) => void;
}

export function MyChartView({ user, profile, onBodygraphReplaced }: Props) {
  const [replacing, setReplacing] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [replaceNotice, setReplaceNotice] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!downloadMenuOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      if (!downloadMenuRef.current) return;
      if (!downloadMenuRef.current.contains(ev.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [downloadMenuOpen]);

  if (replacing) {
    return (
      <MyChartReplaceView
        onCancel={() => setReplacing(false)}
        onBodygraphReplaced={(result) => {
          onBodygraphReplaced(result);
          setReplaceNotice(true);
          setReplacing(false);
        }}
      />
    );
  }

  const hd = profile.humanDesign;
  const birth = profile.birthData;
  const hasBodygraph = (hd?.activatedGates?.length ?? 0) > 0;

  const handleDownloadImage = async () => {
    setDownloadMenuOpen(false);
    setExportError(null);
    setExporting("png");
    try {
      await downloadFullDocumentAsPng(slugFilename(profile.name || user.name) || "bodygraph");
    } catch (err) {
      setExportError(
        err instanceof Error
          ? `No pudimos generar la imagen (${err.message}).`
          : "No pudimos generar la imagen.",
      );
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadPdf = () => {
    setDownloadMenuOpen(false);
    setExportError(null);
    setExporting("pdf");
    const link = document.createElement("a");
    link.href = "/api/me/bodygraph/pdf";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => setExporting(null), 1200);
  };

  if (!hasBodygraph) {
    return (
      <section className="mychart-shell">
        <div className="page-header">
          <div className="page-header-kicker">Mi carta</div>
          <h2 className="page-header-title">Todavía no calculaste tu carta</h2>
          <p className="page-header-description">
            Cargá tus datos de nacimiento o subí un PDF de Genetic Matrix o Jovian Archive para empezar.
          </p>
        </div>
        <div className="mychart-empty">
          <button className="astral-auth-primary" onClick={() => setReplacing(true)}>
            Cargar mi carta
          </button>
        </div>
      </section>
    );
  }

  // ─── Metadata para la identity card ────────────────────────────────────
  // Grid 2-col con 8 entries (4 rows). Origen + Nacimiento van adentro del
  // mismo grid (no más profile-wide aparte) para mantener el ritmo visual
  // pedido por founder: "Nacimiento a la derecha de Origen / debajo de Cruz".
  const profileLine = hd.profile ? `${hd.profile}${hd.profileName ? ` — ${hd.profileName}` : ""}` : "—";
  const cross = hd.incarnationCross || "—";
  const placeLine = birth?.placeLabel ?? "";
  const birthLine = birth?.dateLocalIso ? formatMoment(birth.dateLocalIso) : "";
  const meta: Array<{ label: string; value: string }> = [
    { label: "Perfil", value: profileLine },
    { label: "Autoridad", value: hd.authority || "—" },
    { label: "Definición", value: hd.definition || "—" },
    { label: "Estrategia", value: hd.strategy || "—" },
    { label: "No-self", value: hd.notSelfTheme || "—" },
    { label: "Cruz", value: cross },
  ];
  if (placeLine) meta.push({ label: "Origen", value: placeLine });
  if (birthLine) meta.push({ label: "Nacimiento", value: birthLine });

  // ─── Side panel rows ────────────────────────────────────────────────────
  const labels = hd.variableLabels;
  const designRows: Array<[string, string]> = [];
  if (hd.design?.date) designRows.push(["Fecha del Diseño", formatDesignDate(hd.design.date)]);
  if (labels) {
    designRows.push(
      ["Cerebro", labels.brain],
      ["Determinación", labels.determination],
      ["Cognición", labels.cognition],
      ["Ambiente", labels.environmentDetail],
      ["Estilo de Ambiente", labels.environmentStyle],
    );
  }
  const personalityRows: Array<[string, string]> = labels
    ? [
        ["Personalidad", labels.personality],
        ["Motivación", labels.motivation],
        ["Sentido", labels.sense],
        ["Trayectoria", labels.trajectory],
        ["Perspectiva", labels.viewPerspective],
        ["Visión", labels.view],
        ["Motivación Transferida", labels.transferredMotivation],
        ["Visión Transferida", labels.transferredView],
      ]
    : [];

  return (
    <section className="mychart-shell">
      {exportError && (
        <div className="mychart-export-error" role="alert">{exportError}</div>
      )}
      {replaceNotice && (
        <div className="astral-auth-feedback astral-auth-feedback-success" role="status">
          Carta reemplazada. Tu chat, memoria e informes se reiniciaron.
        </div>
      )}

      {/* (b) Identity card — kicker, nombre, tipo, acciones y metadata. En
          desktop las acciones se ubican arriba a la derecha; en mobile se
          apilan debajo del tipo para evitar CTAs desbalanceados. */}
      <div className="mychart-identity-card">
        <div className="mychart-identity-header">
          <div className="mychart-identity-kicker">Identidad</div>
        </div>
        <h2 className="mychart-name">{user.name || profile.name}</h2>
        {hd.type && (
          <div className="mychart-type">
            {hd.typeQualifier ? `${hd.typeQualifier} ${hd.type}` : hd.type}
          </div>
        )}
        <div className="mychart-actions">
          <div ref={downloadMenuRef} className="mychart-download-wrap">
            <button
              type="button"
              className="astral-auth-primary mychart-action-pill"
              onClick={() => setDownloadMenuOpen((v) => !v)}
              disabled={exporting !== null}
              aria-haspopup="menu"
              aria-expanded={downloadMenuOpen}
            >
              {exporting === "png" ? "Generando imagen…" : exporting === "pdf" ? "Generando PDF…" : "Descargar ▾"}
            </button>
            {downloadMenuOpen && (
              <div role="menu" className="mychart-menu">
                <button role="menuitem" className="mychart-menu-item" onClick={handleDownloadImage}>
                  Como imagen
                </button>
                <button role="menuitem" className="mychart-menu-item" onClick={handleDownloadPdf}>
                  Como PDF
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="astral-auth-secondary mychart-action-pill"
            onClick={() => {
              setReplaceNotice(false);
              setReplacing(true);
            }}
          >
            Reemplazar carta
          </button>
        </div>
        <div className="mychart-meta-divider" />
        <div className="profile-grid">
          {meta.map((m) => (
            <div key={m.label} className="profile-field">
              <span className="profile-label">{m.label}</span>
              <span className="profile-value">{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* (c) Hero card forest. El SVG bodygraph queda como "lámina" con su
          fondo blanco interno. Side panel ahora usa pills gold para canales
          (parity con .transit-insight-channel) y pills gold/subtle para
          centros, replicando la jerarquía visual de Tránsitos. */}
      <div className="mychart-hero-card">
        <div className="mychart-hero-grid">
          <div className="mychart-hero">
            <img
              src="/api/me/bodygraph/chart-svg?width=900"
              alt="Bodygraph"
              className="mychart-hero-img"
            />
          </div>

          <aside className="mychart-side-panel" aria-label="Canales y centros">
            <section className="mychart-side-section">
              <h3 className="mychart-side-title">Canales activos</h3>
              {hd.channels.length > 0 ? (
                <ul className="mychart-channel-pills">
                  {hd.channels.map((ch) => (
                    <li key={ch.id} className="mychart-channel-pill">
                      <span className="mychart-channel-pill-name">{stripChannelPrefix(ch.name)}</span>
                      <span className="mychart-channel-pill-meta">
                        {padGateId(ch.id)} · {ch.circuit}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mychart-side-empty">Sin canales activos.</p>
              )}
            </section>

            {(hd.definedCenters.length > 0 || hd.undefinedCenters.length > 0) && (
              <section className="mychart-side-section">
                <h3 className="mychart-side-title">Centros</h3>
                <div className="mychart-centers-block">
                  <div>
                    <h4 className="mychart-centers-subtitle">Definidos</h4>
                    <p className="mychart-side-caption">
                      Tu energía consistente, lo que irradiás siempre.
                    </p>
                    {hd.definedCenters.length > 0 ? (
                      <ul className="mychart-center-pills">
                        {hd.definedCenters.map((c) => (
                          <li key={c} className="mychart-center-pill is-defined">
                            {CENTER_LABELS[c] ?? c}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mychart-side-empty">Sin centros definidos.</p>
                    )}
                  </div>
                  <div>
                    <h4 className="mychart-centers-subtitle">Abiertos</h4>
                    <p className="mychart-side-caption">
                      Lo que recibís del entorno y aprendés a discernir.
                    </p>
                    {hd.undefinedCenters.length > 0 ? (
                      <ul className="mychart-center-pills">
                        {hd.undefinedCenters.map((c) => (
                          <li key={c} className="mychart-center-pill">
                            {CENTER_LABELS[c] ?? c}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mychart-side-empty">Sin centros abiertos.</p>
                    )}
                  </div>
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>

      {/* (d) Variables footer — glass-panel forest envolviendo Diseño +
          Personalidad. Sub-titles gold puro arriba de cada bloque, filas con
          profile-field sobre forest. Antes vivía sobre sage-soft directo y los
          labels/values "se desangraban" sin contraste. */}
      {(designRows.length > 0 || personalityRows.length > 0) && (
        <div className="mychart-variables-card">
          <div className="mychart-variables-kicker">Variables</div>
          <div className="mychart-variables-grid">
            {designRows.length > 0 && (
              <section>
                <h3 className="mychart-variables-title">Diseño</h3>
                <div className="profile-wide">
                  {designRows.map(([k, v]) => (
                    <div key={`d-${k}`} className="profile-field">
                      <span className="profile-label">{k}</span>
                      <span className="profile-value">{v || "—"}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {personalityRows.length > 0 && (
              <section>
                <h3 className="mychart-variables-title">Personalidad</h3>
                <div className="profile-wide">
                  {personalityRows.map(([k, v]) => (
                    <div key={`p-${k}`} className="profile-field">
                      <span className="profile-label">{k}</span>
                      <span className="profile-value">{v || "—"}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// Labels canónicos en español de los 9 centros HD. Reusable acá; si crece
// el footprint, mover a hd-meta del frontend.
const CENTER_LABELS: Record<string, string> = {
  Head: "Cabeza",
  Ajna: "Ajna",
  Throat: "Garganta",
  G: "G",
  Heart: "Corazón",
  Spleen: "Bazo",
  Sacral: "Sacral",
  SolarPlexus: "Plexo Solar",
  Root: "Raíz",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Formato natural y simple para una audiencia no técnica: "18 de febrero
 * de 1989 · 12:00 pm". Sin "LOCAL" ni UTC offset, mes en lowercase, hora en
 * 12h con am/pm (founder feedback: 12:00 sin pm/am es ambiguo, mediodía o
 * medianoche). */
function formatMoment(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const datePart = new Intl.DateTimeFormat("es-AR", {
      day: "numeric", month: "long", year: "numeric",
    }).format(d);
    const m = iso.match(/T(\d{2}):(\d{2})/);
    let timePart = "";
    if (m) {
      const h24 = parseInt(m[1], 10);
      const mm = m[2];
      const period = h24 >= 12 ? "pm" : "am";
      const h12 = h24 % 12 || 12;
      timePart = `${h12}:${mm} ${period}`;
    }
    return [datePart, timePart].filter(Boolean).join(" · ");
  } catch {
    return "";
  }
}

function formatDesignDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric", month: "short", year: "numeric",
    }).format(d).replace(/\.$/, "");
  } catch {
    return "";
  }
}

function padGateId(id: string): string {
  // "20-34" → "20—34" con em-dash, gates con padding a 2 digits.
  const parts = id.split("-").map((p) => p.padStart(2, "0"));
  return parts.join("—");
}

function stripChannelPrefix(name: string): string {
  return name.replace(/^Canal\s+(de\s+l[ao]s?\s+|del\s+|de\s+)/i, "");
}

async function downloadFullDocumentAsPng(basename: string): Promise<void> {
  const res = await fetch("/api/me/bodygraph/full-svg?width=1400");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const svgText = await res.text();

  const widthMatch = svgText.match(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/);
  const heightMatch = svgText.match(/<svg[^>]*\sheight="(\d+(?:\.\d+)?)"/);
  const baseWidth = widthMatch ? Number(widthMatch[1]) : 1400;
  const baseHeight = heightMatch ? Number(heightMatch[1]) : 2000;

  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("img_load_failed"));
      img.src = url;
    });

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = baseWidth * scale;
    canvas.height = baseHeight * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_unsupported");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("blob_unavailable");

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `bodygraph-${basename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  } finally {
    URL.revokeObjectURL(url);
  }
}
