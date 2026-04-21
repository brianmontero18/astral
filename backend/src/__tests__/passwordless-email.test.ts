import { describe, expect, it } from "vitest";

import {
  buildPasswordlessEmailContent,
  createPasswordlessEmailService,
} from "../auth/passwordless-email.js";

describe("passwordless auth email", () => {
  const config = {
    enabled: true,
    appName: "Astral Guide",
    from: {
      email: "access@astral.guide",
      name: "Astral Guide",
    },
    supportHref: "mailto:hello@astral.guide?subject=Soporte%20Astral",
    smtpSettings: {
      authUsername: "mailer",
      from: {
        email: "access@astral.guide",
        name: "Astral Guide",
      },
      host: "smtp.astral.test",
      password: "secret",
      port: 587,
      secure: false,
    },
  } as const;

  it("builds a Spanish branded email with OTP and magic link", () => {
    const content = buildPasswordlessEmailContent(
      {
        type: "PASSWORDLESS_LOGIN",
        isFirstFactor: true,
        email: "daniela@astral.test",
        userInputCode: "839935",
        urlWithLinkCode: "http://localhost:5173/auth?token=magic",
        codeLifetime: 15 * 60 * 1000,
        preAuthSessionId: "pre-auth-session-1",
        tenantId: "public",
      },
      config,
    );

    expect(content.subject).toBe("Tu acceso a Astral Guide");
    expect(content.text).toContain("Código de acceso: 839935");
    expect(content.text).toContain("Este acceso vence en 15 minutos.");
    expect(content.html).toContain("Tu portal de");
    expect(content.html).toContain("claridad");
    expect(content.html).toContain("839935");
    expect(content.html).toContain("Abrir mi portal");
    expect(content.html).toContain("access@astral.guide");
  });

  it("can build the SMTP-backed service only when config is enabled", () => {
    const service = createPasswordlessEmailService(config);

    expect(service).toBeDefined();
    expect(typeof service?.sendEmail).toBe("function");
    expect(
      createPasswordlessEmailService({
        ...config,
        enabled: false,
      }),
    ).toBeUndefined();
    expect(
      createPasswordlessEmailService({
        ...config,
        smtpSettings: undefined,
      }),
    ).toBeUndefined();
  });

  it("escapes branded HTML content and URLs before rendering", () => {
    const content = buildPasswordlessEmailContent(
      {
        type: "PASSWORDLESS_LOGIN",
        isFirstFactor: true,
        email: "daniela@astral.test",
        userInputCode: "839935",
        urlWithLinkCode:
          "https://auth.astral.guide/auth?token=magic&next=%2Fchat",
        codeLifetime: 15 * 60 * 1000,
        preAuthSessionId: "pre-auth-session-2",
        tenantId: "public",
      },
      {
        ...config,
        appName: "Astral <Guide> & Ritual",
        from: {
          email: "access+ritual@astral.guide",
          name: "Astral <Guide>",
        },
        supportHref:
          "https://support.astral.guide/?source=email&lang=es",
      },
    );

    expect(content.html).toContain("Acceso a Astral &lt;Guide&gt; &amp; Ritual");
    expect(content.html).toContain(
      "entrar a Astral &lt;Guide&gt; &amp; Ritual",
    );
    expect(content.html).toContain("Astral &lt;Guide&gt; · access+ritual@astral.guide");
    expect(content.html).toContain(
      "https://auth.astral.guide/auth?token=magic&amp;next=%2Fchat",
    );
    expect(content.html).toContain(
      "https://support.astral.guide/?source=email&amp;lang=es",
    );
  });
});
