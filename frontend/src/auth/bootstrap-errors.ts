import type { AppUserStatus } from "../types";

export interface BootstrapErrorDisplay {
  title: string;
  body: string;
  retryable: boolean;
}

export function getInactiveAccountErrorDisplay(
  status: AppUserStatus,
): BootstrapErrorDisplay {
  if (status === "banned") {
    return {
      title: "Cuenta bloqueada",
      body: "Tu cuenta fue bloqueada. Contactanos si necesitás revisar el acceso.",
      retryable: false,
    };
  }

  if (status === "active") {
    return {
      title: "No se pudo validar la cuenta",
      body: "No se pudo validar el estado de tu cuenta. Volvé a intentar.",
      retryable: true,
    };
  }

  return {
    title: "Cuenta deshabilitada",
    body: "Tu cuenta está deshabilitada por ahora. Contactanos para reactivarla.",
    retryable: false,
  };
}

export function getAuthRedirectFailureDisplay(): BootstrapErrorDisplay {
  return {
    title: "No se pudo abrir Astral Guide",
    body: "No pudimos iniciar tu acceso en este momento. Reintentá en unos segundos.",
    retryable: true,
  };
}

export function getAuthRequiredConfigDisplay(): BootstrapErrorDisplay {
  return {
    title: "Acceso no disponible",
    body: "Ahora mismo no pudimos abrir tu acceso. Probá de nuevo más tarde.",
    retryable: false,
  };
}

export function getCurrentUserFailureDisplay(
  error: unknown,
): BootstrapErrorDisplay {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("Load failed")
  ) {
    return {
      title: "No se pudo conectar con Astral Guide",
      body: "No pudimos recuperar tu sesión en este momento. Revisá tu conexión y reintentá.",
      retryable: true,
    };
  }

  return {
    title: "No se pudo abrir Astral Guide",
    body: "No pudimos abrir tu espacio en este momento. Reintentá en unos segundos.",
    retryable: true,
  };
}
