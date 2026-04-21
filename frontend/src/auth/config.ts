import SuperTokens from "supertokens-auth-react";
import Passwordless from "supertokens-auth-react/recipe/passwordless";
import Session from "supertokens-auth-react/recipe/session";

export interface FrontendAuthConfig {
  apiBasePath: string;
  apiDomain: string;
  appName: string;
  enabled: boolean;
  supportHref: string;
  websiteBasePath: string;
  websiteDomain: string;
}

const DEFAULT_APP_NAME = "Astral Guide";
const DEFAULT_BASE_PATH = "/auth";
const DEFAULT_SUPPORT_HREF = "mailto:hello@astral.guide?subject=Astral%20Guide%20Support";

let isInitialised = false;

function getWindowOrigin(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
}

export function readFrontendAuthConfig(): FrontendAuthConfig {
  const origin = getWindowOrigin();

  return {
    enabled: import.meta.env.VITE_SUPERTOKENS_AUTH_ENABLED === "true",
    appName: import.meta.env.VITE_SUPERTOKENS_APP_NAME ?? DEFAULT_APP_NAME,
    apiDomain: import.meta.env.VITE_SUPERTOKENS_API_DOMAIN ?? origin,
    supportHref: import.meta.env.VITE_SUPPORT_HREF ?? DEFAULT_SUPPORT_HREF,
    websiteDomain: import.meta.env.VITE_SUPERTOKENS_WEBSITE_DOMAIN ?? origin,
    apiBasePath: import.meta.env.VITE_SUPERTOKENS_API_BASE_PATH ?? DEFAULT_BASE_PATH,
    websiteBasePath:
      import.meta.env.VITE_SUPERTOKENS_WEBSITE_BASE_PATH ?? DEFAULT_BASE_PATH,
  };
}

export function ensureFrontendAuthInit(): FrontendAuthConfig {
  const config = readFrontendAuthConfig();

  if (!config.enabled || isInitialised) {
    return config;
  }

  SuperTokens.init({
    appInfo: {
      appName: config.appName,
      apiDomain: config.apiDomain,
      websiteDomain: config.websiteDomain,
      apiBasePath: config.apiBasePath,
      websiteBasePath: config.websiteBasePath,
    },
    recipeList: [
      Session.init(),
      Passwordless.init({
        contactMethod: "EMAIL",
      }),
    ],
  });

  isInitialised = true;

  return config;
}

export function isAuthRoute(pathname: string = window.location.pathname): boolean {
  return pathname.startsWith(readFrontendAuthConfig().websiteBasePath);
}
