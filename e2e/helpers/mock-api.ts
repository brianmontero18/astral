import { Page } from "@playwright/test";
import type { AssetMeta, DesignReport } from "../../frontend/src/types";
import type { TransitExperienceResponse } from "../../frontend/src/transits/types";

type MockUsageSnapshot = {
  plan?: "free" | "basic" | "premium";
  used?: number;
  limit?: number | null;
  cycle?: string;
  resetsAt?: string;
};

const DEFAULT_USAGE: Required<MockUsageSnapshot> = {
  plan: "free",
  used: 0,
  limit: 20,
  cycle: "2026-04",
  resetsAt: "2026-05-01T00:00:00-03:00",
};

function buildUsageSnapshot(
  usage?: MockUsageSnapshot,
  messages?: Array<{ role: string }>,
) {
  return {
    plan: usage?.plan ?? DEFAULT_USAGE.plan,
    used: usage?.used ?? messages?.filter((message) => message.role === "user").length ?? DEFAULT_USAGE.used,
    limit: usage?.limit ?? DEFAULT_USAGE.limit,
    cycle: usage?.cycle ?? DEFAULT_USAGE.cycle,
    resetsAt: usage?.resetsAt ?? DEFAULT_USAGE.resetsAt,
  };
}

function isExactPath(url: string, pathname: string) {
  return new URL(url).pathname === pathname;
}

export async function mockChatStream(
  page: Page,
  chunks: string[],
  ids?: { userMsgId: number; assistantMsgId: number },
) {
  await page.route("**/api/chat/stream", async (route) => {
    const body =
      chunks.map((c) => `data: ${JSON.stringify({ content: c })}\n\n`).join("") +
      `data: ${JSON.stringify({ done: true, transits_used: "2026-03-28T00:00:00.000Z", ...ids })}\n\n`;
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body,
    });
  });
}

export async function mockChatFallback(page: Page, reply: string, ids?: { userMsgId: number; assistantMsgId: number }) {
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        json: { reply, transits_used: "2026-03-28T00:00:00.000Z", ...ids },
      });
    } else {
      await route.fallback();
    }
  });
}

export async function mockChatStreamError(page: Page) {
  await page.route("**/api/chat/stream", async (route) => {
    await route.abort("connectionfailed");
  });
}

export async function mockChatHistory(
  page: Page,
  messages: Array<{ id: number; role: string; content: string; created_at: string }>,
  usage?: MockUsageSnapshot,
) {
  await page.route("**/api/me/messages**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        json: {
          messages,
          ...buildUsageSnapshot(usage, messages),
        },
      });
    } else {
      await route.fallback();
    }
  });
}

export async function mockTruncate(page: Page, usage?: number | MockUsageSnapshot) {
  const snapshot = typeof usage === "number"
    ? buildUsageSnapshot({ used: usage })
    : buildUsageSnapshot(usage ?? { used: 1 });

  await page.route("**/api/me/messages**", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 200,
        json: {
          deleted: 1,
          ...snapshot,
        },
      });
    } else {
      await route.fallback();
    }
  });
}

export async function mockTranscribe(page: Page, text: string) {
  await page.route("**/api/transcribe", async (route) => {
    await route.fulfill({ status: 200, json: { text } });
  });
}

export async function mockTranscribeError(page: Page) {
  await page.route("**/api/transcribe", async (route) => {
    await route.fulfill({ status: 500, json: { error: "Transcription failed" } });
  });
}

export async function mockGetUser(
  page: Page,
  user: { id: string; name: string; profile: unknown; intake: unknown },
) {
  await page.route("**/api/me", async (route) => {
    if (route.request().method() === "GET" && isExactPath(route.request().url(), "/api/me")) {
      await route.fulfill({ status: 200, json: user });
    } else {
      await route.fallback();
    }
  });
}

export async function mockUpdateUser(page: Page) {
  await page.route("**/api/me", async (route) => {
    if (route.request().method() === "PUT" && isExactPath(route.request().url(), "/api/me")) {
      await route.fulfill({ status: 200, json: { ok: true } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockUpdateUserError(page: Page) {
  await page.route("**/api/me", async (route) => {
    if (route.request().method() === "PUT" && isExactPath(route.request().url(), "/api/me")) {
      await route.fulfill({ status: 500, json: { error: "Internal error" } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockGetReport(page: Page, report: DesignReport | null) {
  await page.route("**/api/me/report**", async (route) => {
    if (route.request().method() === "GET" && isExactPath(route.request().url(), "/api/me/report")) {
      if (report) {
        await route.fulfill({ status: 200, json: report });
      } else {
        await route.fulfill({ status: 404, json: { error: "No report found" } });
      }
    } else {
      await route.fallback();
    }
  });
}

export async function mockGetReportStale(
  page: Page,
  tier: "free" | "premium" = "free",
) {
  await page.route("**/api/me/report**", async (route) => {
    if (route.request().method() === "GET" && isExactPath(route.request().url(), "/api/me/report")) {
      await route.fulfill({
        status: 409,
        json: { error: "report_stale", tier },
      });
    } else {
      await route.fallback();
    }
  });
}

export async function mockGenerateReport(page: Page, report: DesignReport) {
  await page.route("**/api/me/report", async (route) => {
    if (route.request().method() === "POST" && isExactPath(route.request().url(), "/api/me/report")) {
      await route.fulfill({ status: 200, json: report });
    } else {
      await route.fallback();
    }
  });
}

export async function mockGenerateReportError(page: Page, status = 500) {
  await page.route("**/api/me/report", async (route) => {
    if (route.request().method() === "POST" && isExactPath(route.request().url(), "/api/me/report")) {
      await route.fulfill({ status, json: { error: "Generation failed" } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockUploadAsset(page: Page, asset: Partial<AssetMeta> = {}) {
  await page.route("**/api/me/assets", async (route) => {
    if (route.request().method() === "POST" && isExactPath(route.request().url(), "/api/me/assets")) {
      await route.fulfill({
        status: 200,
        json: {
          id: asset.id ?? "asset-123",
          filename: asset.filename ?? "chart.pdf",
          mimeType: asset.mimeType ?? "application/pdf",
          fileType: asset.fileType ?? "hd",
          sizeBytes: asset.sizeBytes ?? 1024,
          createdAt: asset.createdAt ?? "2026-03-28T09:00:00.000Z",
        },
      });
    } else {
      await route.fallback();
    }
  });
}

export async function mockReplaceBodygraph(
  page: Page,
  response: {
    user: unknown;
    profile: unknown;
    asset?: Partial<AssetMeta>;
  },
) {
  await page.route("**/api/me/bodygraph", async (route) => {
    if (route.request().method() === "POST" && isExactPath(route.request().url(), "/api/me/bodygraph")) {
      await route.fulfill({
        status: 201,
        json: {
          user: response.user,
          profile: response.profile,
          asset: {
            id: response.asset?.id ?? "asset-bodygraph-123",
            filename: response.asset?.filename ?? "chart.pdf",
            mimeType: response.asset?.mimeType ?? "application/pdf",
            fileType: response.asset?.fileType ?? "hd",
            sizeBytes: response.asset?.sizeBytes ?? 1024,
            createdAt: response.asset?.createdAt ?? "2026-03-28T09:00:00.000Z",
            isActive: response.asset?.isActive ?? true,
          },
        },
      });
    } else {
      await route.fallback();
    }
  });
}

export async function mockShareReport(page: Page, url = "http://localhost:3000/api/report/shared/abc") {
  await page.route("**/api/me/report/share", async (route) => {
    if (route.request().method() === "POST" && isExactPath(route.request().url(), "/api/me/report/share")) {
      await route.fulfill({ status: 200, json: { token: "abc", url } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockShareReportError(page: Page) {
  await page.route("**/api/me/report/share", async (route) => {
    if (route.request().method() === "POST" && isExactPath(route.request().url(), "/api/me/report/share")) {
      await route.fulfill({ status: 500, json: { error: "Share failed" } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockChatStreamLimit(
  page: Page,
  used: number,
  limit: number,
  usage?: Omit<MockUsageSnapshot, "used" | "limit">,
) {
  const snapshot = buildUsageSnapshot({ ...usage, used, limit });

  await page.route("**/api/chat/stream", async (route) => {
    await route.fulfill({
      status: 403,
      json: { error: "message_limit_reached", ...snapshot },
    });
  });
}

export async function mockHealth(page: Page) {
  await page.route("**/api/health", async (route) => {
    await route.fulfill({ status: 200, json: { status: "ok" } });
  });
}

export const TRANSIT_EXPERIENCE_TODAY_TIMELINE: TransitExperienceResponse = {
  version: "transits.v2",
  mode: "today",
  timeZone: "Etc/UTC",
  generatedAt: "2026-05-10T08:16:00.000Z",
  selectedAt: "2026-05-10T08:15:00.000Z",
  range: {
    kind: "today",
    label: "Hoy",
    startsAt: "2026-05-10T00:00:00.000Z",
    endsAt: "2026-05-10T23:59:59.999Z",
    step: "hour",
  },
  selectedSnapshotId: "instant:2026-05-10T08:15:00.000Z",
  snapshots: [
    {
      id: "instant:2026-05-10T08:15:00.000Z",
      targetAt: "2026-05-10T08:15:00.000Z",
      calculatedAt: "2026-05-10T08:16:00.000Z",
      label: "Ahora",
      collective: {
        planets: [
          {
            name: "Sol",
            longitude: 123.45,
            sign: "Tauro",
            degree: 3.45,
            isRetrograde: false,
            hdGate: 55,
            hdLine: 2,
          },
          {
            name: "Marte",
            longitude: 16.01,
            sign: "Aries",
            degree: 16.01,
            isRetrograde: false,
            hdGate: 36,
            hdLine: 3,
          },
        ],
        activatedGates: [
          { gate: 55, lines: [2], planets: ["Sol"], center: "Root" },
          { gate: 36, lines: [3], planets: ["Marte"], center: "SolarPlexus" },
        ],
        activatedChannels: [],
        activatedCenters: [
          { id: "Root", displayName: "Raíz", gates: [55], channels: [] },
          { id: "SolarPlexus", displayName: "Plexo Solar", gates: [36], channels: [] },
        ],
        temporarilyDefinedCenters: [],
      },
      personal: {
        reinforcedGates: [{ gate: 55, planet: "Sol", center: "Root" }],
        personalChannels: [
          {
            channelId: "35-36",
            channelName: "Canal de lo Transitorio",
            userGate: 35,
            transitGate: 36,
            transitPlanet: "Marte",
            gates: [35, 36],
            centers: ["Throat", "SolarPlexus"],
          },
        ],
        educationalChannels: [],
        conditionedCenters: [
          {
            center: "SolarPlexus",
            displayName: "Plexo Solar",
            gates: [{ gate: 36, planet: "Marte" }],
          },
        ],
        activatedCenters: [
          { id: "Root", displayName: "Raíz", gates: [55], channels: [] },
        ],
        temporarilyDefinedCenters: [
          {
            id: "Throat",
            displayName: "Garganta",
            channels: [
              {
                id: "35-36",
                name: "Canal de lo Transitorio",
                gates: [35, 36],
                centers: ["Throat", "SolarPlexus"],
              },
            ],
          },
        ],
      },
    },
    {
      id: "hour:2026-05-10T08:00:00.000Z",
      targetAt: "2026-05-10T08:00:00.000Z",
      calculatedAt: "2026-05-10T08:16:00.000Z",
      label: "08:00",
      collective: {
        planets: [
          {
            name: "Sol",
            longitude: 123.45,
            sign: "Tauro",
            degree: 3.45,
            isRetrograde: false,
            hdGate: 55,
            hdLine: 2,
          },
        ],
        activatedGates: [{ gate: 55, lines: [2], planets: ["Sol"], center: "Root" }],
        activatedChannels: [],
        activatedCenters: [{ id: "Root", displayName: "Raíz", gates: [55], channels: [] }],
        temporarilyDefinedCenters: [],
      },
    },
    {
      id: "hour:2026-05-10T14:00:00.000Z",
      targetAt: "2026-05-10T14:00:00.000Z",
      calculatedAt: "2026-05-10T08:16:00.000Z",
      label: "14:00",
      collective: {
        planets: [
          {
            name: "Venus",
            longitude: 14.55,
            sign: "Aries",
            degree: 14.55,
            isRetrograde: false,
            hdGate: 35,
            hdLine: 5,
          },
          {
            name: "Marte",
            longitude: 16.01,
            sign: "Aries",
            degree: 16.01,
            isRetrograde: false,
            hdGate: 36,
            hdLine: 3,
          },
        ],
        activatedGates: [
          { gate: 35, lines: [5], planets: ["Venus"], center: "Throat" },
          { gate: 36, lines: [3], planets: ["Marte"], center: "SolarPlexus" },
        ],
        activatedChannels: [
          {
            id: "35-36",
            name: "Canal de lo Transitorio",
            gates: [35, 36],
            centers: ["Throat", "SolarPlexus"],
          },
        ],
        activatedCenters: [
          { id: "Throat", displayName: "Garganta", gates: [35], channels: [] },
          { id: "SolarPlexus", displayName: "Plexo Solar", gates: [36], channels: [] },
        ],
        temporarilyDefinedCenters: [
          {
            id: "Throat",
            displayName: "Garganta",
            channels: [
              {
                id: "35-36",
                name: "Canal de lo Transitorio",
                gates: [35, 36],
                centers: ["Throat", "SolarPlexus"],
              },
            ],
          },
          {
            id: "SolarPlexus",
            displayName: "Plexo Solar",
            channels: [
              {
                id: "35-36",
                name: "Canal de lo Transitorio",
                gates: [35, 36],
                centers: ["Throat", "SolarPlexus"],
              },
            ],
          },
        ],
      },
      personal: {
        reinforcedGates: [],
        personalChannels: [],
        educationalChannels: [
          {
            channelId: "35-36",
            channelName: "Canal de lo Transitorio",
            planet1: "Venus",
            planet2: "Marte",
            gates: [35, 36],
            centers: ["Throat", "SolarPlexus"],
          },
        ],
        conditionedCenters: [
          {
            center: "SolarPlexus",
            displayName: "Plexo Solar",
            gates: [{ gate: 36, planet: "Marte" }],
          },
        ],
        activatedCenters: [],
        temporarilyDefinedCenters: [
          {
            id: "Throat",
            displayName: "Garganta",
            channels: [
              {
                id: "35-36",
                name: "Canal de lo Transitorio",
                gates: [35, 36],
                centers: ["Throat", "SolarPlexus"],
              },
            ],
          },
        ],
      },
    },
    {
      id: "hour:2026-05-10T20:00:00.000Z",
      targetAt: "2026-05-10T20:00:00.000Z",
      calculatedAt: "2026-05-10T08:16:00.000Z",
      label: "20:00",
      collective: {
        planets: [],
        activatedGates: [],
        activatedChannels: [],
        activatedCenters: [],
        temporarilyDefinedCenters: [],
      },
    },
  ],
};

export const TRANSIT_EXPERIENCE_NEXT7_PANORAMA: TransitExperienceResponse = {
  ...TRANSIT_EXPERIENCE_TODAY_TIMELINE,
  mode: "next7Days",
  selectedAt: "2026-05-10T00:00:00.000Z",
  range: {
    kind: "next7Days",
    label: "10 may - 16 may",
    startsAt: "2026-05-10T00:00:00.000Z",
    endsAt: "2026-05-16T23:59:59.999Z",
    step: "panorama",
  },
  selectedSnapshotId: "instant:2026-05-10T08:15:00.000Z",
  snapshots: [TRANSIT_EXPERIENCE_TODAY_TIMELINE.snapshots[0]],
  dayKeyFacts: [
    {
      id: "day:2026-05-10:today",
      atTargetIso: "2026-05-10T12:00:00.000Z",
      dayLabel: "Hoy dom",
      kind: "today",
      summary: "Canal de lo Transitorio ya está activo.",
      impactLabel: "Garganta",
    },
    {
      id: "day:2026-05-12:channelClose",
      atTargetIso: "2026-05-12T12:00:00.000Z",
      dayLabel: "mar 12",
      kind: "channelClose",
      summary: "Cierra Canal de lo Transitorio.",
      impactLabel: "Garganta + Plexo Solar",
    },
    {
      id: "day:2026-05-14:planetMove",
      atTargetIso: "2026-05-14T12:00:00.000Z",
      dayLabel: "jue 14",
      kind: "planetMove",
      summary: "Marte cambia a Puerta 40.",
    },
  ],
};

export const TRANSIT_EXPERIENCE_COLLECTIVE_ONLY: TransitExperienceResponse = {
  ...TRANSIT_EXPERIENCE_TODAY_TIMELINE,
  snapshots: TRANSIT_EXPERIENCE_TODAY_TIMELINE.snapshots.map((snapshot) => ({
    ...snapshot,
    personal: undefined,
  })),
};

export async function mockTransits(page: Page) {
  await page.route("**/api/transits**", async (route) => {
    if (isExactPath(route.request().url(), "/api/transits/experience")) {
      await route.fulfill({
        status: 200,
        json: TRANSIT_EXPERIENCE_TODAY_TIMELINE,
      });
      return;
    }

    await route.fulfill({
      status: 200,
      json: {
        fetchedAt: "2026-03-28T00:00:00.000Z",
        weekRange: "Mar 28 – Apr 3, 2026",
        planets: [],
        activatedChannels: [],
      },
    });
  });
}

export async function mockTransitExperienceToday(
  page: Page,
  response: TransitExperienceResponse = TRANSIT_EXPERIENCE_TODAY_TIMELINE,
) {
  await page.route("**/api/transits/experience**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") === "today") {
      await route.fulfill({ status: 200, json: response });
    } else {
      await route.fallback();
    }
  });
}

export async function mockTransitExperienceNext7Days(
  page: Page,
  response: TransitExperienceResponse = TRANSIT_EXPERIENCE_NEXT7_PANORAMA,
) {
  await page.route("**/api/transits/experience**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") === "next7Days") {
      await route.fulfill({ status: 200, json: response });
    } else {
      await route.fallback();
    }
  });
}

export async function mockTransitExperienceError(
  page: Page,
  status = 500,
  error = "Internal error",
) {
  await page.route("**/api/transits/experience**", async (route) => {
    await route.fulfill({
      status,
      json: { error },
    });
  });
}

export async function mockTransitsError(
  page: Page,
  status = 500,
  error = "Internal error",
) {
  await page.route("**/api/transits**", async (route) => {
    await route.fulfill({
      status,
      json: { error },
    });
  });
}

export async function mockGetAssets(page: Page, assets: AssetMeta[]) {
  await page.route("**/api/me/assets", async (route) => {
    if (route.request().method() === "GET" && isExactPath(route.request().url(), "/api/me/assets")) {
      await route.fulfill({
        status: 200,
        json: { assets },
      });
    } else {
      await route.fallback();
    }
  });
}

export async function mockExtractProfile(page: Page, profile: unknown) {
  await page.route("**/api/extract-profile", async (route) => {
    if (route.request().method() === "POST" && isExactPath(route.request().url(), "/api/extract-profile")) {
      await route.fulfill({ status: 200, json: { profile } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockGetAssetsError(
  page: Page,
  status = 500,
  error = "Internal error",
) {
  await page.route("**/api/me/assets", async (route) => {
    if (route.request().method() === "GET" && isExactPath(route.request().url(), "/api/me/assets")) {
      await route.fulfill({
        status,
        json: { error },
      });
    } else {
      await route.fallback();
    }
  });
}
