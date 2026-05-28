import type { FastifyInstance } from "fastify";
import { getUser } from "../db.js";
import { renderBodygraphPdf } from "../bodygraph/render-pdf.js";
import { renderFullDocument } from "../bodygraph/render-svg.js";
import type { UserProfile } from "../types/agent.js";
import type { McpPrincipal } from "./auth.js";
import type { McpToolBudget } from "./budgets.js";

export const BODYGRAPH_FORM_RESOURCE_URI = "ui://astral/bodygraph-form-v1.html";
export const ACTIVE_BODYGRAPH_IMAGE_RESOURCE_URI = "astral://bodygraph/active/image";
export const ACTIVE_BODYGRAPH_PDF_RESOURCE_URI = "astral://bodygraph/active/pdf";
const LEGACY_ACTIVE_BODYGRAPH_FULL_SVG_RESOURCE_URI = "astral://bodygraph/active/full-svg";

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  requiredScopes: ReadonlyArray<string>;
  budget?: McpToolBudget;
  sideEffectsMode?: "mcp_read_only";
  read(context: McpResourceContext): Promise<McpResourceReadResult>;
}

export interface McpResourceContext {
  app: FastifyInstance;
  principal: McpPrincipal;
}

export interface McpResourceReadResult {
  contents: Array<{
    uri: string;
    mimeType: string;
    text?: string;
    blob?: string;
    _meta?: Record<string, unknown>;
  }>;
}

function profileHasCalculatedBodygraph(profile: unknown): profile is UserProfile {
  const candidate = profile as {
    humanDesign?: { activatedGates?: Array<unknown> };
  };
  return Boolean(candidate?.humanDesign?.activatedGates?.length);
}

function userHasActiveBodygraph(user: Awaited<ReturnType<typeof getUser>>): boolean {
  if (!user) return false;
  return Boolean(user.profile_asset_id || profileHasCalculatedBodygraph(user.profile));
}

async function getActiveProfile(principal: McpPrincipal): Promise<UserProfile> {
  const user = await getUser(principal.userId);
  if (!user) {
    throw new Error("user_not_found");
  }

  if (!profileHasCalculatedBodygraph(user.profile)) {
    throw new Error("no_active_bodygraph");
  }

  return user.profile as UserProfile;
}

const MCP_APPS_SDK_MODULE_URL = "https://cdn.jsdelivr.net/npm/@modelcontextprotocol/ext-apps@1.7.2/+esm";

function bodygraphFormHtml(initialHasActiveBodygraph: boolean): string {
  const destructiveConfirmCopy = "Confirmo que quiero guardar esta carta como activa. Si ya existe una carta activa, Astral la reemplaza y limpia chat, memoria, contexto e informes asociados a la carta anterior.";
  const firstChartConfirmCopy = "Confirmo que quiero guardar esta carta como activa en Astral.";
  const confirmCopy = initialHasActiveBodygraph
    ? destructiveConfirmCopy
    : firstChartConfirmCopy;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Astral bodygraph</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #1f2933;
      --muted: #5d6875;
      --line: #d9dee7;
      --surface: #fbfaf7;
      --accent: #0f766e;
      --accent-dark: #0b5f59;
      --danger: #9f1239;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--surface);
    }
    main {
      width: min(100%, 680px);
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 22px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    p {
      margin: 0 0 18px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.45;
    }
    form {
      display: grid;
      gap: 14px;
    }
    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    label {
      display: grid;
      gap: 6px;
      font-size: 13px;
      font-weight: 650;
    }
    input {
      width: 100%;
      min-height: 42px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 9px 11px;
      font: inherit;
      background: white;
      color: var(--ink);
    }
    input:focus {
      outline: 2px solid rgba(15, 118, 110, 0.22);
      border-color: var(--accent);
    }
    .place-wrap { position: relative; }
    .results {
      position: absolute;
      z-index: 2;
      inset-inline: 0;
      top: calc(100% + 4px);
      border: 1px solid var(--line);
      border-radius: 8px;
      background: white;
      box-shadow: 0 14px 30px rgba(31, 41, 51, 0.12);
      overflow: hidden;
    }
    .result {
      width: 100%;
      border: 0;
      background: white;
      padding: 10px 12px;
      text-align: left;
      color: var(--ink);
      font: inherit;
      cursor: pointer;
    }
    .result:hover, .result:focus {
      background: #eef7f5;
      outline: none;
    }
    .result small {
      display: block;
      margin-top: 2px;
      color: var(--muted);
    }
    .confirm {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: white;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.4;
    }
    .confirm input {
      width: 18px;
      min-height: 18px;
      margin-top: 1px;
      flex: 0 0 auto;
    }
    button.primary {
      min-height: 44px;
      border: 0;
      border-radius: 8px;
      padding: 10px 14px;
      background: var(--accent);
      color: white;
      font: inherit;
      font-weight: 750;
      cursor: pointer;
    }
    button.primary:hover { background: var(--accent-dark); }
    button.primary:disabled {
      opacity: .62;
      cursor: wait;
    }
    .status {
      min-height: 20px;
      font-size: 13px;
      line-height: 1.45;
      color: var(--muted);
    }
    .status.error { color: var(--danger); }
    @media (max-width: 520px) {
      main { padding: 16px; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Calcular bodygraph</h1>
    <p>Usamos fecha, hora y lugar para calcular tu carta activa en Astral.</p>
    <form id="bodygraph-form">
      <label>
        Nombre de la carta
        <input id="name" name="name" autocomplete="name" required maxlength="80" />
      </label>
      <div class="grid">
        <label>
          Fecha de nacimiento
          <input id="date" name="date" type="date" required />
        </label>
        <label>
          Hora local
          <input id="time" name="time" type="time" required />
        </label>
      </div>
      <label class="place-wrap">
        Lugar de nacimiento
        <input id="place" name="place" autocomplete="off" required placeholder="Ciudad, provincia, pais" />
        <div id="results" class="results" hidden></div>
      </label>
      <label class="confirm">
        <input id="confirm" type="checkbox" />
        <span id="confirm-text">${confirmCopy}</span>
      </label>
      <button id="submit" class="primary" type="submit">Calcular y guardar</button>
      <div id="status" class="status" role="status" aria-live="polite"></div>
    </form>
  </main>
  <script type="module">
    const MCP_APPS_SDK_MODULE_URL = "${MCP_APPS_SDK_MODULE_URL}";
    const destructiveConfirmCopy = ${JSON.stringify(destructiveConfirmCopy)};
    const firstChartConfirmCopy = ${JSON.stringify(firstChartConfirmCopy)};
    const state = { selectedPlace: null, searchTimer: null, hasActiveBodygraph: ${initialHasActiveBodygraph ? "true" : "false"} };
    const pendingRpc = new Map();
    let nextRpcId = 1;
    let mcpAppsBridge = null;
    const form = document.getElementById("bodygraph-form");
    const nameInput = document.getElementById("name");
    const dateInput = document.getElementById("date");
    const timeInput = document.getElementById("time");
    const placeInput = document.getElementById("place");
    const confirmInput = document.getElementById("confirm");
    const confirmText = document.getElementById("confirm-text");
    const resultsEl = document.getElementById("results");
    const submitButton = document.getElementById("submit");
    const statusEl = document.getElementById("status");

    function setStatus(message, isError = false) {
      statusEl.textContent = message;
      statusEl.className = isError ? "status error" : "status";
    }

    function updateActiveBodygraphState(candidate) {
      if (candidate && typeof candidate.hasActiveBodygraph === "boolean") {
        state.hasActiveBodygraph = candidate.hasActiveBodygraph;
        confirmText.textContent = state.hasActiveBodygraph ? destructiveConfirmCopy : firstChartConfirmCopy;
      }
    }

    function mcpRpc(method, params) {
      if (window.parent === window) {
        return Promise.reject(new Error("Este host no expone un iframe MCP Apps."));
      }
      const id = nextRpcId++;
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          pendingRpc.delete(id);
          reject(new Error("El host MCP Apps no respondio a tiempo."));
        }, 12000);
        pendingRpc.set(id, { resolve, reject, timeout });
        window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
      });
    }

    async function connectMcpAppsBridge() {
      try {
        const { App } = await import(MCP_APPS_SDK_MODULE_URL);
        const app = new App(
          { name: "Astral Bodygraph Form", version: "1.0.0" },
          {},
        );
        app.ontoolinput = (params) => updateActiveBodygraphState(params?.arguments);
        app.ontoolresult = (params) => {
          updateActiveBodygraphState(params?.structuredContent);
          updateActiveBodygraphState(params?.result?.structuredContent);
        };
        await app.connect();
        mcpAppsBridge = app;
        return app;
      } catch {
        return null;
      }
    }

    const mcpAppsReady = connectMcpAppsBridge();

    function withTimeout(promise, ms) {
      return Promise.race([
        promise,
        new Promise((resolve) => window.setTimeout(() => resolve(null), ms)),
      ]);
    }

    async function callTool(name, args) {
      if (mcpAppsBridge && typeof mcpAppsBridge.callServerTool === "function") {
        return mcpAppsBridge.callServerTool({ name, arguments: args });
      }
      if (window.openai && typeof window.openai.callTool === "function") {
        return window.openai.callTool(name, args);
      }
      const bridge = await withTimeout(mcpAppsReady, 1400);
      if (bridge && typeof bridge.callServerTool === "function") {
        return bridge.callServerTool({ name, arguments: args });
      }
      return mcpRpc("tools/call", { name, arguments: args });
    }

    function closeWidgetSoon() {
      window.setTimeout(async () => {
        if (mcpAppsBridge && typeof mcpAppsBridge.requestTeardown === "function") {
          await mcpAppsBridge.requestTeardown();
          return;
        }
        if (window.openai && typeof window.openai.requestClose === "function") {
          window.openai.requestClose();
        }
      }, 650);
    }

    function placeLabel(place) {
      return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
    }

    function renderResults(places) {
      resultsEl.innerHTML = "";
      if (!places.length) {
        resultsEl.hidden = true;
        return;
      }
      for (const place of places) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "result";
        button.innerHTML = "<strong></strong><small></small>";
        button.querySelector("strong").textContent = placeLabel(place);
        button.querySelector("small").textContent = String(place.population || "") + " habitantes";
        button.addEventListener("click", () => {
          state.selectedPlace = place;
          placeInput.value = placeLabel(place);
          resultsEl.hidden = true;
          setStatus("");
        });
        resultsEl.appendChild(button);
      }
      resultsEl.hidden = false;
    }

    placeInput.addEventListener("input", () => {
      state.selectedPlace = null;
      window.clearTimeout(state.searchTimer);
      const q = placeInput.value.trim();
      if (q.length < 2) {
        renderResults([]);
        return;
      }
      state.searchTimer = window.setTimeout(async () => {
        try {
          setStatus("Buscando lugar...");
          const result = await callTool("search_birth_places_v1", { q, limit: 8 });
          renderResults(result?.structuredContent?.results || result?.results || []);
          setStatus("");
        } catch (err) {
          renderResults([]);
          setStatus(err instanceof Error ? err.message : String(err), true);
        }
      }, 250);
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!state.selectedPlace) {
        setStatus("Elegi un lugar de la lista para resolver la zona horaria.", true);
        return;
      }
      if (!confirmInput.checked) {
        setStatus("Necesitamos la confirmacion para guardar esta carta activa.", true);
        return;
      }
      submitButton.disabled = true;
      setStatus("Calculando y guardando...");
      try {
        const result = await callTool("create_my_bodygraph_from_birth_v1", {
          name: nameInput.value.trim(),
          date: dateInput.value,
          time: timeInput.value,
          place: {
            lat: state.selectedPlace.lat,
            lon: state.selectedPlace.lon,
            label: placeLabel(state.selectedPlace)
          },
          confirmReplace: state.hasActiveBodygraph === true
        });
        const status = result?.structuredContent?.status || result?.status;
        if (status === "saved") {
          setStatus("Bodygraph guardado. Ya podes pedir tu carta, SVG o PDF.");
          closeWidgetSoon();
        } else if (status === "confirmation_required") {
          updateActiveBodygraphState(result?.structuredContent || result);
          confirmInput.checked = false;
          setStatus("Esta accion reemplaza una carta activa. Revisá la confirmacion y volve a enviar.", true);
        } else {
          setStatus(JSON.stringify(result?.structuredContent || result), true);
        }
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), true);
      } finally {
        submitButton.disabled = false;
      }
    });

    window.addEventListener("message", (event) => {
      if (event.source !== window.parent) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (typeof data.id === "number" && pendingRpc.has(data.id) && ("result" in data || "error" in data)) {
        const pending = pendingRpc.get(data.id);
        pendingRpc.delete(data.id);
        window.clearTimeout(pending.timeout);
        if (data.error) {
          pending.reject(new Error(data.error.message || String(data.error)));
        } else {
          pending.resolve(data.result);
        }
        return;
      }
    });
  </script>
</body>
</html>`;
}

const READ_HD_SCOPE = "mcp:read_hd";
const WRITE_BODYGRAPH_SCOPE = "mcp:write_bodygraph";
const ACTIVE_BODYGRAPH_RESOURCE_BUDGET: McpToolBudget = {
  dailyLimit: 100,
  monthlyLimit: 500,
};

const MCP_RESOURCES: McpResourceDefinition[] = [
  {
    uri: BODYGRAPH_FORM_RESOURCE_URI,
    name: "Astral bodygraph birth-data form",
    description: "Embedded UI for replacing the authenticated user's active Astral bodygraph from birth data.",
    mimeType: "text/html;profile=mcp-app",
    requiredScopes: [WRITE_BODYGRAPH_SCOPE],
    async read(context) {
      const user = await getUser(context.principal.userId);
      if (!user) {
        throw new Error("user_not_found");
      }
      return {
        contents: [
          {
            uri: BODYGRAPH_FORM_RESOURCE_URI,
            mimeType: "text/html;profile=mcp-app",
            text: bodygraphFormHtml(userHasActiveBodygraph(user)),
            _meta: {
              ui: {
                csp: {
                  resourceDomains: ["https://cdn.jsdelivr.net"],
                },
                prefersBorder: true,
              },
              "openai/widgetCSP": {
                resource_domains: ["https://cdn.jsdelivr.net"],
              },
              "openai/widgetPrefersBorder": true,
            },
          },
        ],
      };
    },
  },
  {
    uri: ACTIVE_BODYGRAPH_IMAGE_RESOURCE_URI,
    name: "Active bodygraph image",
    description: "Image export source for the authenticated user's active Astral bodygraph.",
    mimeType: "image/svg+xml",
    requiredScopes: [READ_HD_SCOPE],
    budget: ACTIVE_BODYGRAPH_RESOURCE_BUDGET,
    sideEffectsMode: "mcp_read_only",
    async read(context) {
      const profile = await getActiveProfile(context.principal);
      return {
        contents: [
          {
            uri: ACTIVE_BODYGRAPH_IMAGE_RESOURCE_URI,
            mimeType: "image/svg+xml",
            text: renderFullDocument(profile, { width: 1400 }),
          },
        ],
      };
    },
  },
  {
    uri: ACTIVE_BODYGRAPH_PDF_RESOURCE_URI,
    name: "Active bodygraph PDF",
    description: "Vector PDF for the authenticated user's active Astral bodygraph.",
    mimeType: "application/pdf",
    requiredScopes: [READ_HD_SCOPE],
    budget: ACTIVE_BODYGRAPH_RESOURCE_BUDGET,
    sideEffectsMode: "mcp_read_only",
    async read(context) {
      const profile = await getActiveProfile(context.principal);
      const pdf = await renderBodygraphPdf(profile);
      return {
        contents: [
          {
            uri: ACTIVE_BODYGRAPH_PDF_RESOURCE_URI,
            mimeType: "application/pdf",
            blob: pdf.toString("base64"),
          },
        ],
      };
    },
  },
];

export function allMcpResources(): ReadonlyArray<McpResourceDefinition> {
  return MCP_RESOURCES;
}

export function findMcpResource(uri: string): McpResourceDefinition | null {
  if (uri === LEGACY_ACTIVE_BODYGRAPH_FULL_SVG_RESOURCE_URI) {
    return MCP_RESOURCES.find(
      (resource) => resource.uri === ACTIVE_BODYGRAPH_IMAGE_RESOURCE_URI,
    ) ?? null;
  }
  return MCP_RESOURCES.find((resource) => resource.uri === uri) ?? null;
}

export function serializeMcpResource(resource: McpResourceDefinition) {
  return {
    uri: resource.uri,
    name: resource.name,
    description: resource.description,
    mimeType: resource.mimeType,
  };
}
