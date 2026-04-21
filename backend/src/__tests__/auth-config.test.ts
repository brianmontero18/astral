import { describe, expect, it } from "vitest";
import { readSuperTokensConfig } from "../auth/config.js";
import { createAuthRuntime } from "../auth/supertokens.js";

describe("SuperTokens config", () => {
  it("stays disabled when no auth env is provided", () => {
    const config = readSuperTokensConfig({});

    expect(config.enabled).toBe(false);
    expect(config.missingEnv).toEqual([]);
  });

  it("reports partial backend env instead of silently treating it as disabled", () => {
    const config = readSuperTokensConfig({
      SUPERTOKENS_API_DOMAIN: "http://localhost:5173",
    });

    expect(config.enabled).toBe(false);
    expect(config.missingEnv).toEqual([
      "SUPERTOKENS_CONNECTION_URI",
      "SUPERTOKENS_WEBSITE_DOMAIN",
    ]);
  });

  it("does not treat cosmetic auth env alone as an activation attempt", () => {
    const config = readSuperTokensConfig({
      SUPERTOKENS_APP_NAME: "Astral Local",
      SUPERTOKENS_API_BASE_PATH: "/custom-auth",
    });

    expect(config.enabled).toBe(false);
    expect(config.missingEnv).toEqual([]);
    expect(config.emailDelivery.enabled).toBe(false);
    expect(config.emailDelivery.missingEnv).toEqual([]);
  });

  it("enables custom auth email delivery only when SMTP config is complete", () => {
    const config = readSuperTokensConfig({
      SUPERTOKENS_CONNECTION_URI: "https://example.supertokens.io",
      SUPERTOKENS_API_DOMAIN: "http://localhost:5173",
      SUPERTOKENS_WEBSITE_DOMAIN: "http://localhost:5173",
      SUPERTOKENS_SMTP_HOST: "smtp.astral.test",
      SUPERTOKENS_SMTP_PORT: "587",
      SUPERTOKENS_SMTP_PASSWORD: "secret",
      SUPERTOKENS_EMAIL_FROM: "access@astral.guide",
      SUPERTOKENS_EMAIL_FROM_NAME: "Astral Guide",
    });

    expect(config.emailDelivery.enabled).toBe(true);
    expect(config.emailDelivery.missingEnv).toEqual([]);
    expect(config.emailDelivery.smtpSettings).toMatchObject({
      host: "smtp.astral.test",
      port: 587,
      secure: false,
    });
  });

  it("reports partial SMTP config instead of silently mixing Astral and default emails", () => {
    const config = readSuperTokensConfig({
      SUPERTOKENS_CONNECTION_URI: "https://example.supertokens.io",
      SUPERTOKENS_API_DOMAIN: "http://localhost:5173",
      SUPERTOKENS_WEBSITE_DOMAIN: "http://localhost:5173",
      SUPERTOKENS_SMTP_HOST: "smtp.astral.test",
      SUPERTOKENS_EMAIL_FROM: "access@astral.guide",
    });

    expect(config.emailDelivery.enabled).toBe(false);
    expect(config.emailDelivery.missingEnv).toEqual([
      "SUPERTOKENS_SMTP_PORT",
      "SUPERTOKENS_SMTP_PASSWORD",
    ]);
  });

  it("throws when runtime creation sees an incomplete SuperTokens backend config", () => {
    const previous = {
      connectionURI: process.env.SUPERTOKENS_CONNECTION_URI,
      apiDomain: process.env.SUPERTOKENS_API_DOMAIN,
      websiteDomain: process.env.SUPERTOKENS_WEBSITE_DOMAIN,
    };

    process.env.SUPERTOKENS_CONNECTION_URI = "https://example.supertokens.io";
    process.env.SUPERTOKENS_API_DOMAIN = "http://localhost:5173";
    delete process.env.SUPERTOKENS_WEBSITE_DOMAIN;

    expect(() => createAuthRuntime()).toThrowError(
      /Incomplete SuperTokens config: SUPERTOKENS_WEBSITE_DOMAIN/,
    );

    if (previous.connectionURI === undefined) {
      delete process.env.SUPERTOKENS_CONNECTION_URI;
    } else {
      process.env.SUPERTOKENS_CONNECTION_URI = previous.connectionURI;
    }

    if (previous.apiDomain === undefined) {
      delete process.env.SUPERTOKENS_API_DOMAIN;
    } else {
      process.env.SUPERTOKENS_API_DOMAIN = previous.apiDomain;
    }

    if (previous.websiteDomain === undefined) {
      delete process.env.SUPERTOKENS_WEBSITE_DOMAIN;
    } else {
      process.env.SUPERTOKENS_WEBSITE_DOMAIN = previous.websiteDomain;
    }
  });

  it("throws when runtime creation sees an incomplete custom email delivery config", () => {
    const previous = {
      connectionURI: process.env.SUPERTOKENS_CONNECTION_URI,
      apiDomain: process.env.SUPERTOKENS_API_DOMAIN,
      websiteDomain: process.env.SUPERTOKENS_WEBSITE_DOMAIN,
      smtpHost: process.env.SUPERTOKENS_SMTP_HOST,
      smtpPort: process.env.SUPERTOKENS_SMTP_PORT,
      smtpPassword: process.env.SUPERTOKENS_SMTP_PASSWORD,
      emailFrom: process.env.SUPERTOKENS_EMAIL_FROM,
    };

    process.env.SUPERTOKENS_CONNECTION_URI = "https://example.supertokens.io";
    process.env.SUPERTOKENS_API_DOMAIN = "http://localhost:5173";
    process.env.SUPERTOKENS_WEBSITE_DOMAIN = "http://localhost:5173";
    process.env.SUPERTOKENS_SMTP_HOST = "smtp.astral.test";
    process.env.SUPERTOKENS_EMAIL_FROM = "access@astral.guide";
    delete process.env.SUPERTOKENS_SMTP_PORT;
    delete process.env.SUPERTOKENS_SMTP_PASSWORD;

    expect(() => createAuthRuntime()).toThrowError(
      /Incomplete SuperTokens email delivery config: SUPERTOKENS_SMTP_PORT, SUPERTOKENS_SMTP_PASSWORD/,
    );

    if (previous.connectionURI === undefined) {
      delete process.env.SUPERTOKENS_CONNECTION_URI;
    } else {
      process.env.SUPERTOKENS_CONNECTION_URI = previous.connectionURI;
    }

    if (previous.apiDomain === undefined) {
      delete process.env.SUPERTOKENS_API_DOMAIN;
    } else {
      process.env.SUPERTOKENS_API_DOMAIN = previous.apiDomain;
    }

    if (previous.websiteDomain === undefined) {
      delete process.env.SUPERTOKENS_WEBSITE_DOMAIN;
    } else {
      process.env.SUPERTOKENS_WEBSITE_DOMAIN = previous.websiteDomain;
    }

    if (previous.smtpHost === undefined) {
      delete process.env.SUPERTOKENS_SMTP_HOST;
    } else {
      process.env.SUPERTOKENS_SMTP_HOST = previous.smtpHost;
    }

    if (previous.smtpPort === undefined) {
      delete process.env.SUPERTOKENS_SMTP_PORT;
    } else {
      process.env.SUPERTOKENS_SMTP_PORT = previous.smtpPort;
    }

    if (previous.smtpPassword === undefined) {
      delete process.env.SUPERTOKENS_SMTP_PASSWORD;
    } else {
      process.env.SUPERTOKENS_SMTP_PASSWORD = previous.smtpPassword;
    }

    if (previous.emailFrom === undefined) {
      delete process.env.SUPERTOKENS_EMAIL_FROM;
    } else {
      process.env.SUPERTOKENS_EMAIL_FROM = previous.emailFrom;
    }
  });
});
