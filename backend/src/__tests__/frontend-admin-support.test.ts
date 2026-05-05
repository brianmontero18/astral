import { describe, expect, it } from "vitest";

import {
  ADMIN_INTERNAL_PERMISSION_LABEL,
  ADMIN_USER_DETAIL_SECTION_TITLES,
  ADMIN_USER_DETAIL_SUPPORT_BODY,
  applyAdminUserAccessValues,
  buildAdminUserPath,
  buildAdminUserAccessPatch,
  formatExpiresIn,
  getAdminSupportFailureMessage,
  getAdminRoleLabel,
  getAdminUserDetailDisplay,
  getAdminUserListDisplay,
  getAdminPlanLabel,
  getAdminStatusLabel,
  getAdminUserEmailLabel,
  getAdminUserSupportHint,
  parseAdminSupportRoute,
} from "../../../frontend/src/admin-support";

describe("frontend admin support helpers", () => {
  it("parses the contracted admin users routes", () => {
    expect(parseAdminSupportRoute("/")).toBeNull();
    expect(parseAdminSupportRoute("/admin")).toBeNull();
    expect(parseAdminSupportRoute("/admin/users")).toEqual({
      kind: "users-list",
    });
    expect(parseAdminSupportRoute("/admin/users/user-123")).toEqual({
      kind: "user-detail",
      userId: "user-123",
    });
    expect(parseAdminSupportRoute("/admin/users/usr%20002")).toEqual({
      kind: "user-detail",
      userId: "usr 002",
    });
    expect(parseAdminSupportRoute("/admin/users/usr%2F002")).toBeNull();
    expect(parseAdminSupportRoute("/admin/users/user-123/extra")).toBeNull();
    expect(parseAdminSupportRoute("/admin/users/%E0%A4%A")).toBeNull();
  });

  it("builds detail paths from Astral user ids", () => {
    expect(buildAdminUserPath("user-123")).toBe("/admin/users/user-123");
  });

  it("maps Daniela-first labels and support hints from contracted admin state", () => {
    expect(getAdminPlanLabel("free")).toBe("Free");
    expect(getAdminStatusLabel("active")).toBe("Activa");
    expect(getAdminUserEmailLabel(null)).toBe("Email no disponible");

    expect(getAdminUserSupportHint({
      status: "banned",
      linked: false,
      email: null,
    })).toBe("Acceso bloqueado");
    expect(getAdminUserSupportHint({
      status: "disabled",
      linked: true,
      email: "daniela@astral.test",
    })).toBe("Acceso pausado");
    expect(getAdminUserSupportHint({
      status: "active",
      linked: false,
      email: "daniela@astral.test",
    })).toBe("Requiere revisión técnica de acceso");
    expect(getAdminUserSupportHint({
      status: "active",
      linked: true,
      email: null,
    })).toBe("Falta email de contacto");
    expect(getAdminUserSupportHint({
      status: "active",
      linked: true,
      email: "daniela@astral.test",
    })).toBeNull();
  });

  it("builds Daniela-first list display data without surfacing technical metadata", () => {
    expect(getAdminUserListDisplay({
      name: "Daniela Support",
      email: "daniela@astral.test",
      plan: "premium",
      status: "active",
      linked: true,
    })).toEqual({
      name: "Daniela Support",
      email: "daniela@astral.test",
      plan: "Premium",
      status: "Activa",
      supportHint: null,
    });
  });

  it("defines the v1.1 detail section order and internal permission label", () => {
    expect(ADMIN_USER_DETAIL_SECTION_TITLES).toEqual([
      "Acciones de soporte",
      "Actividad y límites",
      "Contexto de la persona",
      "Datos técnicos",
    ]);
    expect(ADMIN_USER_DETAIL_SUPPORT_BODY).toBe(
      "Cambiá solo plan, estado o permiso interno. El resto es contexto para soporte.",
    );
    expect(ADMIN_INTERNAL_PERMISSION_LABEL).toBe("Permiso interno");
    expect(getAdminRoleLabel("user")).toBe("Usuario");
    expect(getAdminRoleLabel("admin")).toBe("Admin");
  });

  it("builds the contracted detail display with contact-first header and technical data at the end", () => {
    const display = getAdminUserDetailDisplay({
      id: "usr_777",
      name: "Daniela Support",
      email: null,
      plan: "premium",
      status: "disabled",
      role: "admin",
      linked: false,
      authIdentity: null,
      support: {
        messagesUsed: 12,
        messageLimit: 300,
        assetCount: 3,
        reportsAvailable: ["free", "premium"],
      },
      humanDesign: {
        type: "Projector",
        authority: "Emotional",
        profile: "3/5",
      },
      createdAt: "2026-04-10T10:00:00.000Z",
      updatedAt: "2026-04-12T18:10:00.000Z",
    });

    expect(display.header).toEqual({
      name: "Daniela Support",
      email: "Email no disponible",
      plan: "Premium",
      status: "Deshabilitada",
      supportHint: "Acceso pausado",
    });
    expect(display.activity).toEqual([
      { label: "Mensajes usados este mes", value: "12" },
      { label: "Límite mensual", value: "300" },
      { label: "Archivos", value: "3" },
      { label: "Reportes", value: "Free · Premium" },
    ]);
    expect(display.context).toEqual([
      { label: "Tipo", value: "Projector" },
      { label: "Autoridad", value: "Emotional" },
      { label: "Perfil", value: "3/5" },
    ]);
    expect(display.technical[0]).toEqual({
      label: "ID interno",
      value: "usr_777",
    });
    expect(display.technical[1]).toEqual({
      label: "Acceso conectado",
      value: "No",
    });
    expect(display.technical[2]).toEqual({
      label: "Proveedor",
      value: "Sin vínculo",
    });
    expect(display.technical[3]).toEqual({
      label: "ID de autenticación",
      value: "No disponible",
    });
    expect(display.technical[4]?.label).toBe("Creada en Astral");
    expect(display.technical[4]?.value).toEqual(expect.any(String));
    expect(display.technical[5]?.label).toBe("Última actualización");
    expect(display.technical[5]?.value).toEqual(expect.any(String));
  });

  it("maps admin failures to support-safe copy without surfacing backend strings", () => {
    expect(
      getAdminSupportFailureMessage(
        new Error("Admin users error 403: admin_required"),
        "fallback",
      ),
    ).toBe("Esta sesión dejó de tener permisos para operar el panel de soporte.");

    expect(
      getAdminSupportFailureMessage(
        new Error("Admin user detail error 404: User not found"),
        "fallback",
      ),
    ).toBe("No encontramos ese usuario en la base actual de Astral.");

    expect(
      getAdminSupportFailureMessage(
        new TypeError("Failed to fetch"),
        "fallback",
      ),
    ).toBe("No pudimos cargar soporte en este momento. Reintentá en unos segundos.");

    expect(
      getAdminSupportFailureMessage(
        new Error("Admin user access update error 500: boom"),
        "fallback",
      ),
    ).toBe("fallback");
  });

  it("builds a safe access patch with only changed fields", () => {
    expect(buildAdminUserAccessPatch({
      current: {
        plan: "free",
        role: "user",
        status: "active",
      },
      next: {
        plan: "premium",
        role: "user",
        status: "disabled",
      },
    })).toEqual({
      plan: "premium",
      status: "disabled",
    });
  });

  it("returns null when the detail form has no access changes", () => {
    expect(buildAdminUserAccessPatch({
      current: {
        plan: "basic",
        role: "admin",
        status: "banned",
      },
      next: {
        plan: "basic",
        role: "admin",
        status: "banned",
      },
    })).toBeNull();
  });

  it("applies access values locally without touching the rest of the detail snapshot", () => {
    expect(applyAdminUserAccessValues({
      id: "usr_002",
      name: "Lucia Portal",
      email: "lucia@astral.test",
      plan: "free",
      status: "active",
      role: "user",
      linked: true,
      authIdentity: {
        provider: "supertokens",
        subject: "st-lucia-portal",
      },
      support: {
        messagesUsed: 4,
        messageLimit: 20,
        assetCount: 2,
        reportsAvailable: ["free"],
      },
      humanDesign: {
        type: "Projector",
        authority: "Splenic",
        profile: "5/1",
      },
      createdAt: "2026-04-10T10:00:00.000Z",
      updatedAt: "2026-04-12T18:10:00.000Z",
    }, {
      plan: "premium",
      status: "disabled",
      role: "admin",
    })).toEqual({
      id: "usr_002",
      name: "Lucia Portal",
      email: "lucia@astral.test",
      plan: "premium",
      status: "disabled",
      role: "admin",
      linked: true,
      authIdentity: {
        provider: "supertokens",
        subject: "st-lucia-portal",
      },
      support: {
        messagesUsed: 4,
        messageLimit: 300,
        assetCount: 2,
        reportsAvailable: ["free"],
      },
      humanDesign: {
        type: "Projector",
        authority: "Splenic",
        profile: "5/1",
      },
      createdAt: "2026-04-10T10:00:00.000Z",
      updatedAt: "2026-04-12T18:10:00.000Z",
    });
  });
});

describe("formatExpiresIn", () => {
  const now = new Date("2026-05-04T12:00:00.000Z");

  it("renders hours when expiry is between 1 and 48 hours away", () => {
    const expiry = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    expect(formatExpiresIn(expiry, now)).toBe("Expira en ~48 h");
  });

  it("renders minutes when expiry is under an hour away", () => {
    const expiry = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    expect(formatExpiresIn(expiry, now)).toBe("Expira en ~15 min");
  });

  it("renders days when expiry is more than 48 hours away", () => {
    const expiry = new Date(
      now.getTime() + 5 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(formatExpiresIn(expiry, now)).toBe("Expira en ~5 días");
  });

  it("flags an already-expired link", () => {
    const expired = new Date(now.getTime() - 60 * 1000).toISOString();
    expect(formatExpiresIn(expired, now)).toBe("Expirado");
  });

  it("falls back gracefully on invalid input", () => {
    expect(formatExpiresIn("not a date", now)).toBe("TTL desconocido");
  });
});
