import { randomUUID } from "node:crypto";
import {
  getUser,
  replaceUserBodygraphState,
  updateUserBodygraph,
} from "../../db.js";
import { parseActiveChartName } from "../../active-chart-name.js";
import { calculateBodygraph, type BirthData } from "../../bodygraph/calculate.js";
import { renderBodygraphPdf } from "../../bodygraph/render-pdf.js";
import { renderFullDocument } from "../../bodygraph/render-svg.js";
import type { UserProfile } from "../../types/agent.js";
import { autocompletePlaces, PlacesProviderError } from "../../places/geonames.js";
import { deleteObject as r2DeleteObject } from "../../storage/r2.js";
import {
  beginBodygraphReplace,
  UserOperationConflictError,
} from "../../services/user-operation-locks.js";
import {
  ACTIVE_BODYGRAPH_IMAGE_RESOURCE_URI,
  ACTIVE_BODYGRAPH_PDF_RESOURCE_URI,
  BODYGRAPH_FORM_RESOURCE_URI,
} from "../resources.js";
import type { McpToolBudget } from "../budgets.js";
import {
  McpToolCallError,
  type McpToolCallResult,
} from "../tool-contract.js";
import type { McpToolContext } from "../tools.js";

export const OPEN_BODYGRAPH_FORM_TOOL_NAME = "open_bodygraph_form_v1";
export const SEARCH_BIRTH_PLACES_TOOL_NAME = "search_birth_places_v1";
export const CREATE_BODYGRAPH_FROM_BIRTH_TOOL_NAME = "create_my_bodygraph_from_birth_v1";
export const GET_ACTIVE_BODYGRAPH_IMAGE_TOOL_NAME = "get_active_bodygraph_image_v1";
export const GET_ACTIVE_BODYGRAPH_PDF_TOOL_NAME = "get_active_bodygraph_pdf_v1";

const READ_HD_SCOPE = "mcp:read_hd";
const WRITE_BODYGRAPH_SCOPE = "mcp:write_bodygraph";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const BODYGRAPH_WRITE_BUDGET: McpToolBudget = {
  dailyLimit: 20,
  monthlyLimit: 80,
};

const BODYGRAPH_READ_BUDGET: McpToolBudget = {
  dailyLimit: 100,
  monthlyLimit: 500,
};

function textResult(text: string, structuredContent: Record<string, unknown>, meta?: Record<string, unknown>): McpToolCallResult {
  return {
    content: [{ type: "text", text }],
    structuredContent,
    ...(meta ? { _meta: meta } : {}),
  };
}

function resourceResult(input: {
  text: string;
  uri: string;
  mimeType: string;
  resourceText?: string;
  blob?: string;
  structuredContent: Record<string, unknown>;
}): McpToolCallResult {
  return {
    content: [
      { type: "text", text: input.text },
      {
        type: "resource",
        resource: {
          uri: input.uri,
          mimeType: input.mimeType,
          ...(input.resourceText !== undefined ? { text: input.resourceText } : {}),
          ...(input.blob !== undefined ? { blob: input.blob } : {}),
        },
      },
    ],
    structuredContent: input.structuredContent,
  };
}

function bodygraphDownloadUrl(path: "/api/me/bodygraph/image" | "/api/me/bodygraph/pdf"): string | null {
  const raw = process.env.MCP_RESOURCE_URL?.trim();
  if (!raw) return null;

  try {
    return new URL(path, raw).toString();
  } catch {
    return null;
  }
}

function readArgsObject(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new McpToolCallError(-32602, "Invalid params", {
      reason: "arguments_required",
    });
  }
  return args as Record<string, unknown>;
}

function readString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new McpToolCallError(-32602, "Invalid params", {
      reason: `${key}_required`,
      param: key,
    });
  }
  return value.trim();
}

function readOptionalBoolean(args: Record<string, unknown>, key: string): boolean {
  const value = args[key];
  return value === true || value === "true";
}

function isValidDate(date: string): boolean {
  const [yearText, monthText, dayText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isValidTime(time: string): boolean {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function readBirthData(args: Record<string, unknown>): BirthData {
  const date = readString(args, "date");
  if (!DATE_RE.test(date) || !isValidDate(date)) {
    throw new McpToolCallError(-32602, "Invalid params", {
      reason: "invalid_date",
      message: "date must be YYYY-MM-DD",
    });
  }

  const time = readString(args, "time");
  if (!TIME_RE.test(time) || !isValidTime(time)) {
    throw new McpToolCallError(-32602, "Invalid params", {
      reason: "invalid_time",
      message: "time must be HH:mm",
    });
  }

  const place = args.place;
  if (!place || typeof place !== "object" || Array.isArray(place)) {
    throw new McpToolCallError(-32602, "Invalid params", {
      reason: "invalid_place",
      message: "place must be { lat, lon, label }",
    });
  }

  const p = place as { lat?: unknown; lon?: unknown; label?: unknown };
  if (typeof p.lat !== "number" || Number.isNaN(p.lat) || p.lat < -90 || p.lat > 90) {
    throw new McpToolCallError(-32602, "Invalid params", {
      reason: "invalid_place",
      message: "place.lat must be a number in [-90, 90]",
    });
  }
  if (typeof p.lon !== "number" || Number.isNaN(p.lon) || p.lon < -180 || p.lon > 180) {
    throw new McpToolCallError(-32602, "Invalid params", {
      reason: "invalid_place",
      message: "place.lon must be a number in [-180, 180]",
    });
  }
  if (typeof p.label !== "string" || p.label.trim().length === 0) {
    throw new McpToolCallError(-32602, "Invalid params", {
      reason: "invalid_place",
      message: "place.label must be a non-empty string",
    });
  }

  return {
    date,
    time,
    coordinates: { lat: p.lat, lon: p.lon },
    placeLabel: p.label.trim(),
    name: typeof args.name === "string" ? args.name.trim() : undefined,
  };
}

function hasActiveBodygraph(user: Awaited<ReturnType<typeof getUser>>): boolean {
  if (!user) return false;
  const profile = user.profile as {
    humanDesign?: { activatedGates?: Array<unknown> };
  };
  return Boolean(
    user.profile_asset_id ||
    (profile.humanDesign?.activatedGates?.length ?? 0) > 0,
  );
}

function profileHasCalculatedBodygraph(profile: unknown): profile is UserProfile {
  const candidate = profile as {
    humanDesign?: { activatedGates?: Array<unknown> };
  };
  return Boolean(candidate?.humanDesign?.activatedGates?.length);
}

async function getActiveProfile(userId: string): Promise<UserProfile> {
  const user = await getUser(userId);
  if (!user) {
    throw new McpToolCallError(-32010, "user_not_found");
  }
  if (!profileHasCalculatedBodygraph(user.profile)) {
    throw new McpToolCallError(-32019, "no_active_bodygraph");
  }
  return user.profile as UserProfile;
}

function serializeProfileSummary(profile: UserProfile) {
  return {
    name: profile.name,
    type: profile.humanDesign.type,
    strategy: profile.humanDesign.strategy,
    authority: profile.humanDesign.authority,
    profile: profile.humanDesign.profile,
    definition: profile.humanDesign.definition,
    incarnationCross: profile.humanDesign.incarnationCross,
    definedCenters: profile.humanDesign.definedCenters,
    channels: profile.humanDesign.channels,
    activatedGateCount: profile.humanDesign.activatedGates.length,
  };
}

function confirmationRequiredResult(): McpToolCallResult {
  return textResult(
    "Para reemplazar tu carta activa, confirma explicitamente confirmReplace=true. Astral va a limpiar chat, memoria, intake e informes de la carta anterior.",
    {
      status: "confirmation_required",
      hasActiveBodygraph: true,
      requiredArgument: "confirmReplace",
      replacementPolicy:
        "Replacing an active chart wipes chat, memory, intake, and reports tied to the previous chart.",
    },
  );
}

export const openBodygraphFormToolDefinition = {
  name: OPEN_BODYGRAPH_FORM_TOOL_NAME,
  description:
    "Open Astral's embedded birth-data form so the authenticated user can replace their active Human Design bodygraph from name, birth date, local birth time, and birthplace.",
  inputSchema: {
    type: "object",
    properties: {},
  },
  outputSchema: {
    type: "object",
    properties: {
      status: { type: "string" },
      uiResourceUri: { type: "string" },
      hasActiveBodygraph: { type: "boolean" },
      model: { type: "string" },
      replacementPolicy: { type: "string" },
    },
    required: ["status", "uiResourceUri", "hasActiveBodygraph", "model", "replacementPolicy"],
  },
  requiredScopes: [WRITE_BODYGRAPH_SCOPE],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  _meta: {
    ui: {
      resourceUri: BODYGRAPH_FORM_RESOURCE_URI,
    },
    "openai/outputTemplate": BODYGRAPH_FORM_RESOURCE_URI,
    "openai/widgetAccessible": true,
    "openai/toolInvocation/invoking": "Abriendo el formulario de Astral",
    "openai/toolInvocation/invoked": "Formulario de Astral listo",
  },
} as const;

export const searchBirthPlacesToolDefinition = {
  name: SEARCH_BIRTH_PLACES_TOOL_NAME,
  description:
    "Search public birthplace candidates for Astral's bodygraph form. Returns city names and coordinates; does not persist user data.",
  inputSchema: {
    type: "object",
    properties: {
      q: {
        type: "string",
        minLength: 2,
        description: "Birthplace search query, usually a city name.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        description: "Maximum number of places to return.",
      },
      lang: {
        type: "string",
        description: "Preferred response language, default es.",
      },
    },
    required: ["q"],
  },
  outputSchema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            geonameId: { type: "integer" },
            name: { type: "string" },
            admin1: { type: "string" },
            country: { type: "string" },
            countryCode: { type: "string" },
            lat: { type: "number" },
            lon: { type: "number" },
            population: { type: "integer" },
          },
          required: ["geonameId", "name", "admin1", "country", "countryCode", "lat", "lon", "population"],
        },
      },
    },
    required: ["results"],
  },
  requiredScopes: [WRITE_BODYGRAPH_SCOPE],
  budget: BODYGRAPH_READ_BUDGET,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  _meta: {
    "openai/widgetAccessible": true,
    "openai/toolInvocation/invoking": "Buscando lugares",
    "openai/toolInvocation/invoked": "Lugares encontrados",
  },
} as const;

export const createBodygraphFromBirthToolDefinition = {
  name: CREATE_BODYGRAPH_FROM_BIRTH_TOOL_NAME,
  description:
    "Calculate and persist the authenticated user's active Astral bodygraph from birth data. V1 replaces the single active chart only after explicit confirmReplace=true.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        minLength: 1,
        description: "Display name for the active chart.",
      },
      date: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "Local birth date at the birth place, YYYY-MM-DD.",
      },
      time: {
        type: "string",
        pattern: "^\\d{2}:\\d{2}$",
        description: "Local birth time at the birth place, HH:mm 24h.",
      },
      place: {
        type: "object",
        properties: {
          lat: { type: "number", minimum: -90, maximum: 90 },
          lon: { type: "number", minimum: -180, maximum: 180 },
          label: { type: "string", minLength: 1 },
        },
        required: ["lat", "lon", "label"],
      },
      confirmReplace: {
        type: "boolean",
        description:
          "Must be true when replacing an active chart. Replacement wipes chat, memory, intake, and reports tied to the previous chart.",
      },
    },
    required: ["name", "date", "time", "place"],
  },
  outputSchema: {
    type: "object",
    properties: {
      status: { type: "string" },
      profile: { type: "object" },
      resources: { type: "object" },
      hasActiveBodygraph: { type: "boolean" },
      requiredArgument: { type: "string" },
      replacementPolicy: { type: "string" },
    },
    required: ["status"],
  },
  requiredScopes: [WRITE_BODYGRAPH_SCOPE],
  budget: BODYGRAPH_WRITE_BUDGET,
  sideEffectsMode: "mcp_write_bodygraph",
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
  _meta: {
    "openai/widgetAccessible": true,
    "openai/toolInvocation/invoking": "Calculando bodygraph en Astral",
    "openai/toolInvocation/invoked": "Bodygraph guardado",
  },
} as const;

export const getActiveBodygraphImageToolDefinition = {
  name: GET_ACTIVE_BODYGRAPH_IMAGE_TOOL_NAME,
  description:
    "Return the authenticated user's active Astral bodygraph image export. Use this when the user asks to view, export, or download their bodygraph as an image, matching Astral web app's Mi Carta > Descargar > Como imagen flow.",
  inputSchema: {
    type: "object",
    properties: {},
  },
  outputSchema: {
    type: "object",
    properties: {
      status: { type: "string" },
      resourceUri: { type: "string" },
      mimeType: { type: "string" },
      image: { type: "string" },
      downloadUrl: { type: "string" },
    },
    required: ["status", "resourceUri", "mimeType", "image"],
  },
  requiredScopes: [READ_HD_SCOPE],
  budget: BODYGRAPH_READ_BUDGET,
  sideEffectsMode: "mcp_read_only",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  _meta: {
    "openai/toolInvocation/invoking": "Preparando imagen del bodygraph",
    "openai/toolInvocation/invoked": "Imagen del bodygraph lista",
  },
} as const;

export const getActiveBodygraphPdfToolDefinition = {
  name: GET_ACTIVE_BODYGRAPH_PDF_TOOL_NAME,
  description:
    "Return the authenticated user's active Astral bodygraph as a PDF file. Use this when the user asks to export or download their bodygraph PDF.",
  inputSchema: {
    type: "object",
    properties: {},
  },
  outputSchema: {
    type: "object",
    properties: {
      status: { type: "string" },
      resourceUri: { type: "string" },
      mimeType: { type: "string" },
      filename: { type: "string" },
      base64: { type: "string" },
      downloadUrl: { type: "string" },
    },
    required: ["status", "resourceUri", "mimeType", "filename", "base64"],
  },
  requiredScopes: [READ_HD_SCOPE],
  budget: BODYGRAPH_READ_BUDGET,
  sideEffectsMode: "mcp_read_only",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  _meta: {
    "openai/toolInvocation/invoking": "Preparando PDF del bodygraph",
    "openai/toolInvocation/invoked": "PDF del bodygraph listo",
  },
} as const;

export async function callOpenBodygraphFormV1(
  _args: unknown,
  context: McpToolContext,
): Promise<McpToolCallResult> {
  const user = await getUser(context.principal.userId);
  if (!user) {
    throw new McpToolCallError(-32010, "user_not_found");
  }

  return textResult(
    "Abri el formulario de Astral para calcular o reemplazar la carta activa. Si tu host no muestra UI, usa create_my_bodygraph_from_birth_v1 con name, date, time y place; agrega confirmReplace=true solo si hasActiveBodygraph=true.",
    {
      status: "form_ready",
      uiResourceUri: BODYGRAPH_FORM_RESOURCE_URI,
      hasActiveBodygraph: hasActiveBodygraph(user),
      model: "v1_single_active_chart",
      replacementPolicy:
        "Replacing an active chart wipes chat, memory, intake, and reports tied to the previous chart.",
    },
    {
      ui: {
        resourceUri: BODYGRAPH_FORM_RESOURCE_URI,
      },
      "openai/outputTemplate": BODYGRAPH_FORM_RESOURCE_URI,
    },
  );
}

export async function callSearchBirthPlacesV1(
  args: unknown,
): Promise<McpToolCallResult> {
  const input = readArgsObject(args);
  const q = readString(input, "q");
  const rawLimit = input.limit;
  const limit = typeof rawLimit === "number" && Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 20)
    : 8;
  const lang = typeof input.lang === "string" && input.lang.trim()
    ? input.lang.trim()
    : "es";

  try {
    const results = await autocompletePlaces(q, { limit, lang });
    return textResult(JSON.stringify({ results }), { results });
  } catch (err) {
    if (err instanceof PlacesProviderError) {
      throw new McpToolCallError(-32016, "places_unavailable", {
        message: err.message,
      });
    }
    throw err;
  }
}

export async function callGetActiveBodygraphImageV1(
  _args: unknown,
  context: McpToolContext,
): Promise<McpToolCallResult> {
  const profile = await getActiveProfile(context.principal.userId);
  const image = renderFullDocument(profile, { width: 1400 });
  const downloadUrl = bodygraphDownloadUrl("/api/me/bodygraph/image");
  return resourceResult({
    text: downloadUrl
      ? `Imagen del bodygraph activo lista. Link web: ${downloadUrl}`
      : "Imagen del bodygraph activo lista.",
    uri: ACTIVE_BODYGRAPH_IMAGE_RESOURCE_URI,
    mimeType: "image/svg+xml",
    resourceText: image,
    structuredContent: {
      status: "ready",
      resourceUri: ACTIVE_BODYGRAPH_IMAGE_RESOURCE_URI,
      mimeType: "image/svg+xml",
      image,
      ...(downloadUrl ? { downloadUrl } : {}),
    },
  });
}

export async function callGetActiveBodygraphPdfV1(
  _args: unknown,
  context: McpToolContext,
): Promise<McpToolCallResult> {
  const profile = await getActiveProfile(context.principal.userId);
  const pdf = await renderBodygraphPdf(profile);
  const base64 = pdf.toString("base64");
  const downloadUrl = bodygraphDownloadUrl("/api/me/bodygraph/pdf");
  return resourceResult({
    text: downloadUrl
      ? `PDF del bodygraph activo listo. Link web de descarga: ${downloadUrl}`
      : "PDF del bodygraph activo listo para descargar.",
    uri: ACTIVE_BODYGRAPH_PDF_RESOURCE_URI,
    mimeType: "application/pdf",
    blob: base64,
    structuredContent: {
      status: "ready",
      resourceUri: ACTIVE_BODYGRAPH_PDF_RESOURCE_URI,
      mimeType: "application/pdf",
      filename: "astral-bodygraph.pdf",
      base64,
      ...(downloadUrl ? { downloadUrl } : {}),
    },
  });
}

export async function callCreateBodygraphFromBirthV1(
  args: unknown,
  context: McpToolContext,
): Promise<McpToolCallResult> {
  const input = readArgsObject(args);
  const displayName = parseActiveChartName(input.name);
  if (!displayName.ok) {
    throw new McpToolCallError(-32602, "Invalid params", {
      reason: displayName.error,
      message: displayName.message,
    });
  }

  const birth = readBirthData({ ...input, name: displayName.name });
  const user = await getUser(context.principal.userId);
  if (!user) {
    throw new McpToolCallError(-32010, "user_not_found");
  }

  const needsReplaceConfirmation = hasActiveBodygraph(user);
  if (needsReplaceConfirmation && !readOptionalBoolean(input, "confirmReplace")) {
    return confirmationRequiredResult();
  }

  let profile: UserProfile;
  try {
    profile = await calculateBodygraph(birth);
  } catch (err) {
    throw new McpToolCallError(-32017, "calculation_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
  profile.name = displayName.name;

  const correlationId = randomUUID();
  let releaseReplace: (() => void) | null = null;
  try {
    releaseReplace = beginBodygraphReplace(user.id);
    const currentUser = await getUser(user.id);
    if (!currentUser) {
      throw new McpToolCallError(-32010, "user_not_found");
    }

    const replacingActiveBodygraph = hasActiveBodygraph(currentUser);
    if (replacingActiveBodygraph && !readOptionalBoolean(input, "confirmReplace")) {
      return confirmationRequiredResult();
    }
    if (!replacingActiveBodygraph && readOptionalBoolean(input, "confirmReplace")) {
      throw new McpToolCallError(-32602, "Invalid params", {
        reason: "confirm_replace_without_active_bodygraph",
        message: "confirmReplace=true is only valid after Astral reports an active chart.",
      });
    }

    if (!replacingActiveBodygraph) {
      const updated = await updateUserBodygraph(user.id, profile, null, displayName.name);
      if (!updated) {
        throw new McpToolCallError(-32010, "user_not_found");
      }
    } else {
      const result = await replaceUserBodygraphState({
        userId: user.id,
        displayName: displayName.name,
        profile,
        profileAssetId: null,
      });
      if (result.deletedPreviousAsset && result.previousAssetStorageKey) {
        try {
          await r2DeleteObject(result.previousAssetStorageKey);
        } catch (err) {
          context.app.log.warn(
            {
              err,
              correlationId,
              userId: user.id,
              previousAssetId: result.previousProfileAssetId,
              storageKey: result.previousAssetStorageKey,
            },
            "Failed to delete previous bodygraph object after MCP replace",
          );
        }
      }
      context.app.log.info(
        {
          correlationId,
          userId: user.id,
          previousAssetId: result.previousProfileAssetId,
          deletedChatMessages: result.deletedChatMessages,
          deletedReportShares: result.deletedReportShares,
          deletedReports: result.deletedReports,
          deletedPreviousAsset: result.deletedPreviousAsset,
        },
        "mcp_bodygraph_replace_completed",
      );
    }
  } catch (err) {
    if (err instanceof UserOperationConflictError) {
      throw new McpToolCallError(-32018, err.code);
    }
    if (err instanceof Error && err.message === "user_not_found") {
      throw new McpToolCallError(-32010, "user_not_found");
    }
    throw err;
  } finally {
    releaseReplace?.();
  }

  const summary = serializeProfileSummary(profile);
  return textResult(
    `Bodygraph guardado para ${summary.name}. Tipo: ${summary.type}. Autoridad: ${summary.authority}. Perfil: ${summary.profile}.`,
    {
      status: "saved",
      profile: summary,
      resources: {
        image: ACTIVE_BODYGRAPH_IMAGE_RESOURCE_URI,
        pdf: ACTIVE_BODYGRAPH_PDF_RESOURCE_URI,
      },
    },
    {
      "openai/closeWidget": true,
    },
  );
}
