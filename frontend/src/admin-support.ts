import type {
  AdminUserDetail,
  AdminUserAccessPatch,
  AdminUserAccessValues,
  AdminUserSummary,
  AppUserPlan,
  AppUserRole,
  AppUserStatus,
} from "./types";
import { getMessageLimitForPlan } from "./chat-limits";

export const ADMIN_USERS_PATH = "/admin/users";
export const ADMIN_USERS_PAGE_SIZE = 12;

export type AdminSupportRoute =
  | { kind: "users-list" }
  | { kind: "user-detail"; userId: string };

export interface AdminUserListDisplay {
  name: string;
  email: string;
  plan: string;
  status: string;
  supportHint: string | null;
}

export interface AdminSupportFieldDisplay {
  label: string;
  value: string;
}

export interface AdminUserDetailDisplay {
  header: AdminUserListDisplay;
  activity: Array<AdminSupportFieldDisplay>;
  context: Array<AdminSupportFieldDisplay>;
  technical: Array<AdminSupportFieldDisplay>;
}

const ADMIN_SUPPORT_CONNECTIVITY_MARKERS = [
  "Failed to fetch",
  "NetworkError",
  "Load failed",
] as const;

export const ADMIN_USER_DETAIL_SECTION_TITLES = [
  "Acciones de soporte",
  "Actividad y límites",
  "Contexto de la persona",
  "Datos técnicos",
] as const;

export const ADMIN_USER_DETAIL_SUPPORT_BODY =
  "Cambiá solo plan, estado o permiso interno. El resto es contexto para soporte.";

export const ADMIN_INTERNAL_PERMISSION_LABEL = "Permiso interno";

function normalizePathname(pathname: string): string {
  if (!pathname) {
    return "/";
  }

  const trimmed = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  return trimmed || "/";
}

export function parseAdminSupportRoute(
  pathname: string,
): AdminSupportRoute | null {
  const normalized = normalizePathname(pathname);

  if (normalized === ADMIN_USERS_PATH) {
    return { kind: "users-list" };
  }

  const detailPrefix = `${ADMIN_USERS_PATH}/`;

  if (!normalized.startsWith(detailPrefix)) {
    return null;
  }

  const userId = normalized.slice(detailPrefix.length);

  if (!userId || userId.includes("/")) {
    return null;
  }

  try {
    const decodedUserId = decodeURIComponent(userId);

    if (!decodedUserId || decodedUserId.includes("/")) {
      return null;
    }

    return {
      kind: "user-detail",
      userId: decodedUserId,
    };
  } catch {
    return null;
  }
}

export function buildAdminUserPath(userId: string): string {
  return `${ADMIN_USERS_PATH}/${encodeURIComponent(userId)}`;
}

export function getAdminPlanLabel(plan: AppUserPlan): string {
  switch (plan) {
    case "free":
      return "Free";
    case "basic":
      return "Basic";
    case "premium":
      return "Premium";
  }
}

export function getAdminStatusLabel(status: AppUserStatus): string {
  switch (status) {
    case "active":
      return "Activa";
    case "disabled":
      return "Deshabilitada";
    case "banned":
      return "Bloqueada";
  }
}

export function getAdminRoleLabel(role: AppUserRole): string {
  switch (role) {
    case "user":
      return "Usuario";
    case "admin":
      return "Admin";
  }
}

export function getAdminUserEmailLabel(email: string | null): string {
  return email?.trim() ? email : "Email no disponible";
}

export function getAdminUserSupportHint(
  user: Pick<AdminUserSummary, "status" | "linked" | "email">,
): string | null {
  if (user.status === "banned") {
    return "Acceso bloqueado";
  }

  if (user.status === "disabled") {
    return "Acceso pausado";
  }

  if (!user.linked) {
    return "Requiere revisión técnica de acceso";
  }

  if (!user.email?.trim()) {
    return "Falta email de contacto";
  }

  return null;
}

export function getAdminUserListDisplay(
  user: Pick<AdminUserSummary, "name" | "email" | "plan" | "status" | "linked">,
): AdminUserListDisplay {
  return {
    name: user.name,
    email: getAdminUserEmailLabel(user.email),
    plan: getAdminPlanLabel(user.plan),
    status: getAdminStatusLabel(user.status),
    supportHint: getAdminUserSupportHint(user),
  };
}

export function getAdminSupportFailureMessage(
  error: unknown,
  fallback: string,
): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message.includes("cannot_modify_self_access")) {
    return "Astral sigue bloqueando la autoedición de permisos para esta cuenta.";
  }

  if (
    message.includes("admin_required") ||
    message.includes("authentication_required")
  ) {
    return "Esta sesión dejó de tener permisos para operar el panel de soporte.";
  }

  if (message.includes("User not found")) {
    return "No encontramos ese usuario en la base actual de Astral.";
  }

  if (
    ADMIN_SUPPORT_CONNECTIVITY_MARKERS.some((marker) => message.includes(marker))
  ) {
    return "No pudimos cargar soporte en este momento. Reintentá en unos segundos.";
  }

  return fallback;
}

function formatAdminDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatAdminMessageLimit(limit: number | null): string {
  return limit === null ? "—" : String(limit);
}

function formatAdminReportsAvailable(
  reportsAvailable: AdminUserDetail["support"]["reportsAvailable"],
): string {
  return reportsAvailable.length > 0
    ? reportsAvailable.map(getAdminPlanLabel).join(" · ")
    : "Ninguno";
}

function getAdminConnectedAccessLabel(linked: boolean): string {
  return linked ? "Sí" : "No";
}

export function getAdminUserDetailDisplay(
  detail: AdminUserDetail,
): AdminUserDetailDisplay {
  return {
    header: getAdminUserListDisplay(detail),
    activity: [
      {
        label: "Mensajes usados este mes",
        value: String(detail.support.messagesUsed),
      },
      {
        label: "Límite mensual",
        value: formatAdminMessageLimit(detail.support.messageLimit),
      },
      {
        label: "Archivos",
        value: String(detail.support.assetCount),
      },
      {
        label: "Reportes",
        value: formatAdminReportsAvailable(detail.support.reportsAvailable),
      },
    ],
    context: [
      {
        label: "Tipo",
        value: detail.humanDesign.type ?? "—",
      },
      {
        label: "Autoridad",
        value: detail.humanDesign.authority ?? "—",
      },
      {
        label: "Perfil",
        value: detail.humanDesign.profile ?? "—",
      },
    ],
    technical: [
      {
        label: "ID interno",
        value: detail.id,
      },
      {
        label: "Acceso conectado",
        value: getAdminConnectedAccessLabel(detail.linked),
      },
      {
        label: "Proveedor",
        value: detail.authIdentity?.provider ?? "Sin vínculo",
      },
      {
        label: "ID de autenticación",
        value: detail.authIdentity?.subject ?? "No disponible",
      },
      {
        label: "Creada en Astral",
        value: formatAdminDate(detail.createdAt),
      },
      {
        label: "Última actualización",
        value: formatAdminDate(detail.updatedAt),
      },
    ],
  };
}

export function buildAdminUserAccessPatch({
  current,
  next,
}: {
  current: AdminUserAccessValues;
  next: AdminUserAccessValues;
}): AdminUserAccessPatch | null {
  const patch: AdminUserAccessPatch = {
    ...(current.plan !== next.plan ? { plan: next.plan } : {}),
    ...(current.status !== next.status ? { status: next.status } : {}),
    ...(current.role !== next.role ? { role: next.role } : {}),
  };

  return Object.keys(patch).length > 0 ? patch : null;
}

export function applyAdminUserAccessValues(
  detail: AdminUserDetail,
  next: AdminUserAccessValues,
): AdminUserDetail {
  return {
    ...detail,
    plan: next.plan,
    status: next.status,
    role: next.role,
    support: {
      ...detail.support,
      messageLimit: getMessageLimitForPlan(next.plan),
    },
  };
}
