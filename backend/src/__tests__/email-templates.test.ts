import { describe, expect, it } from "vitest";

import {
  buildInviteEmailContent,
  buildLoginEmailContent,
  createPasswordlessEmailService,
} from "../auth/email-templates.js";

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

const baseInput = {
  type: "PASSWORDLESS_LOGIN" as const,
  isFirstFactor: true,
  email: "daniela@astral.test",
  userInputCode: "839935",
  urlWithLinkCode: "http://localhost:5173/auth/verify?token=magic#linkcode",
  codeLifetime: 15 * 60 * 1000,
  preAuthSessionId: "pre-auth-session-1",
  tenantId: "public",
};

describe("buildLoginEmailContent", () => {
  it("renders Spanish branded login email with OTP and magic link CTA", () => {
    const content = buildLoginEmailContent(baseInput, config);

    expect(content.subject).toBe("Tu acceso a Astral Guide");
    expect(content.text).toContain("Código de acceso: 839935");
    expect(content.text).toContain("Este acceso vence en 15 minutos.");
    expect(content.html).toContain("Tu portal de");
    expect(content.html).toContain("claridad");
    expect(content.html).toContain("839935");
    expect(content.html).toContain("Abrir mi portal");
    expect(content.html).toContain("access@astral.guide");
    // Login copy is "Pediste un acceso" — invite copy must NOT show up here.
    expect(content.html).toContain("Pediste un acceso");
    expect(content.html).not.toContain("Una persona del equipo");
  });

  it("escapes HTML content and URL params", () => {
    const content = buildLoginEmailContent(
      {
        ...baseInput,
        urlWithLinkCode:
          "https://auth.astral.guide/auth?token=magic&next=%2Fchat",
      },
      {
        ...config,
        appName: "Astral <Guide> & Ritual",
        from: {
          email: "access+ritual@astral.guide",
          name: "Astral <Guide>",
        },
        supportHref: "https://support.astral.guide/?source=email&lang=es",
      },
    );

    expect(content.html).toContain("Acceso a Astral &lt;Guide&gt; &amp; Ritual");
    expect(content.html).toContain(
      "entrar a Astral &lt;Guide&gt; &amp; Ritual",
    );
    expect(content.html).toContain(
      "Astral &lt;Guide&gt; · access+ritual@astral.guide",
    );
    expect(content.html).toContain(
      "https://auth.astral.guide/auth?token=magic&amp;next=%2Fchat",
    );
    expect(content.html).toContain(
      "https://support.astral.guide/?source=email&amp;lang=es",
    );
  });
});

describe("buildInviteEmailContent", () => {
  it("renders an invite-specific subject and copy distinct from login", () => {
    const content = buildInviteEmailContent(baseInput, config);

    expect(content.subject).toBe(
      "Tu portal de claridad te espera en Astral Guide",
    );
    // Invite copy explains it was admin-driven.
    expect(content.text).toContain("Una persona del equipo");
    expect(content.text).toContain("Te invitamos a entrar a Astral Guide");
    expect(content.html).toContain("Una persona del equipo");
    expect(content.html).toContain("Invitación a Astral Guide");
    expect(content.html).toContain("Entrar a Astral Guide");
    // OTP must NOT be foregrounded in the invite email.
    expect(content.html).not.toContain("Código de acceso");
    expect(content.html).not.toContain("839935");
    // Login copy must NOT bleed into invite.
    expect(content.html).not.toContain("Pediste un acceso");
  });

  it("includes the magic link as the primary CTA", () => {
    const content = buildInviteEmailContent(baseInput, config);
    expect(content.html).toContain(
      "http://localhost:5173/auth/verify?token=magic#linkcode",
    );
    expect(content.text).toContain(
      "http://localhost:5173/auth/verify?token=magic#linkcode",
    );
  });

  it("personalizes the headline when recipientName is provided", () => {
    const content = buildInviteEmailContent(baseInput, config, {
      recipientName: "Marina",
    });
    expect(content.html).toContain("Marina, tu portal de");
    expect(content.text.startsWith("Marina, te invitamos")).toBe(true);
  });

  it("starts the text with a capitalised greeting when no recipientName", () => {
    const content = buildInviteEmailContent(baseInput, config);
    expect(content.text.startsWith("Te invitamos")).toBe(true);
  });

  it("escapes the recipient name to prevent HTML injection", () => {
    const content = buildInviteEmailContent(baseInput, config, {
      recipientName: "<script>alert(1)</script>",
    });
    expect(content.html).not.toContain("<script>alert(1)</script>");
    expect(content.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("falls back to the generic headline when recipientName is empty or whitespace", () => {
    const trimmed = buildInviteEmailContent(baseInput, config, {
      recipientName: "   ",
    });
    expect(trimmed.html).not.toContain(",   tu portal");
    expect(trimmed.text.startsWith("Te invitamos")).toBe(true);
  });

  it("aligns the expiry copy with the actual codeLifetime", () => {
    const longLifetime = buildInviteEmailContent(
      { ...baseInput, codeLifetime: 48 * 60 * 60 * 1000 },
      config,
    );
    // HTML callout uses the uppercase tracked label format from DESIGN.md.
    expect(longLifetime.html).toContain(`Vence en ${48 * 60} minutos`);
    // Plain-text body keeps the full sentence for clients that strip HTML.
    expect(longLifetime.text).toContain(
      `Esta invitación vence en ${48 * 60} minutos.`,
    );
  });
});

describe("createPasswordlessEmailService", () => {
  it("builds the SMTP-backed service only when SMTP config is enabled", () => {
    const service = createPasswordlessEmailService(config);
    expect(service).toBeDefined();
    expect(typeof service?.sendEmail).toBe("function");

    expect(
      createPasswordlessEmailService({ ...config, enabled: false }),
    ).toBeUndefined();
    expect(
      createPasswordlessEmailService({ ...config, smtpSettings: undefined }),
    ).toBeUndefined();
  });
});
