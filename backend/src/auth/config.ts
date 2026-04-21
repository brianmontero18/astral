export interface SuperTokensAppInfo {
  apiBasePath: string;
  apiDomain: string;
  appName: string;
  websiteBasePath: string;
  websiteDomain: string;
}

export interface SuperTokensRuntimeConfig {
  apiKey?: string;
  appInfo: SuperTokensAppInfo;
  connectionURI: string;
  dashboardApiKey?: string;
  emailDelivery: SuperTokensPasswordlessEmailConfig;
  enabled: boolean;
  missingEnv: Array<string>;
}

export interface SuperTokensPasswordlessEmailConfig {
  enabled: boolean;
  appName: string;
  from: {
    email: string;
    name: string;
  };
  missingEnv: Array<string>;
  smtpSettings?: {
    authUsername?: string;
    from: {
      email: string;
      name: string;
    };
    host: string;
    password: string;
    port: number;
    secure: boolean;
  };
  supportHref: string;
}

const DEFAULT_APP_NAME = "Astral Guide";
const DEFAULT_API_BASE_PATH = "/auth";
const DEFAULT_WEBSITE_BASE_PATH = "/auth";
const DEFAULT_SUPPORT_HREF =
  "mailto:hello@astral.guide?subject=Astral%20Guide%20Support";

function readOptionalNumberEnv(
  env: NodeJS.ProcessEnv,
  key: string,
): number | undefined {
  const value = readOptionalEnv(env, key);

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readOptionalBooleanEnv(
  env: NodeJS.ProcessEnv,
  key: string,
): boolean | undefined {
  const value = readOptionalEnv(env, key)?.toLowerCase();

  if (!value) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

function readOptionalEnv(
  env: NodeJS.ProcessEnv,
  key: string,
): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function readSuperTokensConfig(
  env: NodeJS.ProcessEnv = process.env,
): SuperTokensRuntimeConfig {
  const providedEnvKeys = [
    "SUPERTOKENS_CONNECTION_URI",
    "SUPERTOKENS_API_KEY",
    "SUPERTOKENS_API_DOMAIN",
    "SUPERTOKENS_WEBSITE_DOMAIN",
    "SUPERTOKENS_DASHBOARD_API_KEY",
  ].filter((key) => readOptionalEnv(env, key) !== undefined);
  const connectionURI = readOptionalEnv(env, "SUPERTOKENS_CONNECTION_URI");
  const apiDomain = readOptionalEnv(env, "SUPERTOKENS_API_DOMAIN");
  const websiteDomain = readOptionalEnv(env, "SUPERTOKENS_WEBSITE_DOMAIN");
  const appName =
    readOptionalEnv(env, "SUPERTOKENS_APP_NAME") ?? DEFAULT_APP_NAME;
  const smtpHost = readOptionalEnv(env, "SUPERTOKENS_SMTP_HOST");
  const smtpPort = readOptionalNumberEnv(env, "SUPERTOKENS_SMTP_PORT");
  const smtpPassword = readOptionalEnv(env, "SUPERTOKENS_SMTP_PASSWORD");
  const smtpUsername = readOptionalEnv(env, "SUPERTOKENS_SMTP_USERNAME");
  const emailFromName =
    readOptionalEnv(env, "SUPERTOKENS_EMAIL_FROM_NAME") ?? appName;
  const emailFromAddress = readOptionalEnv(env, "SUPERTOKENS_EMAIL_FROM");
  const supportHref =
    readOptionalEnv(env, "SUPERTOKENS_EMAIL_SUPPORT_HREF") ??
    DEFAULT_SUPPORT_HREF;
  const smtpSecure =
    readOptionalBooleanEnv(env, "SUPERTOKENS_SMTP_SECURE") ??
    smtpPort === 465;
  const providedEmailEnvKeys = [
    "SUPERTOKENS_SMTP_HOST",
    "SUPERTOKENS_SMTP_PORT",
    "SUPERTOKENS_SMTP_USERNAME",
    "SUPERTOKENS_SMTP_PASSWORD",
    "SUPERTOKENS_SMTP_SECURE",
    "SUPERTOKENS_EMAIL_FROM",
    "SUPERTOKENS_EMAIL_FROM_NAME",
    "SUPERTOKENS_EMAIL_SUPPORT_HREF",
  ].filter((key) => readOptionalEnv(env, key) !== undefined);
  const emailMissingEnv = [
    providedEmailEnvKeys.length > 0 && !smtpHost && "SUPERTOKENS_SMTP_HOST",
    providedEmailEnvKeys.length > 0 && !smtpPort && "SUPERTOKENS_SMTP_PORT",
    providedEmailEnvKeys.length > 0 &&
      !smtpPassword &&
      "SUPERTOKENS_SMTP_PASSWORD",
    providedEmailEnvKeys.length > 0 &&
      !emailFromAddress &&
      "SUPERTOKENS_EMAIL_FROM",
  ].filter((value): value is string => Boolean(value));

  const missingEnv = [
    providedEnvKeys.length > 0 && !connectionURI && "SUPERTOKENS_CONNECTION_URI",
    !apiDomain && "SUPERTOKENS_API_DOMAIN",
    !websiteDomain && "SUPERTOKENS_WEBSITE_DOMAIN",
  ].filter((value): value is string => Boolean(value));

  return {
    enabled: Boolean(connectionURI) && missingEnv.length === 0,
    connectionURI: connectionURI ?? "",
    apiKey: readOptionalEnv(env, "SUPERTOKENS_API_KEY"),
    dashboardApiKey: readOptionalEnv(env, "SUPERTOKENS_DASHBOARD_API_KEY"),
    emailDelivery: {
      enabled:
        emailMissingEnv.length === 0 &&
        Boolean(smtpHost && smtpPort && smtpPassword && emailFromAddress),
      appName,
      from: {
        email: emailFromAddress ?? "no-reply@astral.guide",
        name: emailFromName,
      },
      missingEnv:
        providedEmailEnvKeys.length > 0 ? emailMissingEnv : [],
      smtpSettings:
        smtpHost && smtpPort && smtpPassword && emailFromAddress
          ? {
              authUsername: smtpUsername,
              from: {
                email: emailFromAddress,
                name: emailFromName,
              },
              host: smtpHost,
              password: smtpPassword,
              port: smtpPort,
              secure: smtpSecure,
            }
          : undefined,
      supportHref,
    },
    missingEnv: connectionURI || providedEnvKeys.length > 0 ? missingEnv : [],
    appInfo: {
      appName,
      apiBasePath: readOptionalEnv(env, "SUPERTOKENS_API_BASE_PATH") ?? DEFAULT_API_BASE_PATH,
      apiDomain: apiDomain ?? "",
      websiteBasePath:
        readOptionalEnv(env, "SUPERTOKENS_WEBSITE_BASE_PATH") ?? DEFAULT_WEBSITE_BASE_PATH,
      websiteDomain: websiteDomain ?? "",
    },
  };
}
