import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AdminInviteEmailUnavailableError,
  __setAdminInviteTransportForTesting,
  sendAdminInviteEmail,
} from "../auth/admin-invite-email.js";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
}

afterEach(() => {
  __setAdminInviteTransportForTesting(null);
  resetEnv();
});

function configureSmtpEnv() {
  process.env.SUPERTOKENS_CONNECTION_URI = "http://localhost:3567";
  process.env.SUPERTOKENS_API_DOMAIN = "http://localhost:3000";
  process.env.SUPERTOKENS_WEBSITE_DOMAIN = "http://localhost:5173";
  process.env.SUPERTOKENS_SMTP_HOST = "smtp.astral.test";
  process.env.SUPERTOKENS_SMTP_PORT = "587";
  process.env.SUPERTOKENS_SMTP_PASSWORD = "secret";
  process.env.SUPERTOKENS_SMTP_USERNAME = "mailer";
  process.env.SUPERTOKENS_EMAIL_FROM = "access@astral.guide";
  process.env.SUPERTOKENS_EMAIL_FROM_NAME = "Astral Guide";
}

function clearSmtpEnv() {
  delete process.env.SUPERTOKENS_SMTP_HOST;
  delete process.env.SUPERTOKENS_SMTP_PORT;
  delete process.env.SUPERTOKENS_SMTP_PASSWORD;
  delete process.env.SUPERTOKENS_SMTP_USERNAME;
  delete process.env.SUPERTOKENS_EMAIL_FROM;
  delete process.env.SUPERTOKENS_EMAIL_FROM_NAME;
}

describe("sendAdminInviteEmail", () => {
  it("throws AdminInviteEmailUnavailableError when SMTP is not configured", async () => {
    resetEnv();
    clearSmtpEnv();

    await expect(
      sendAdminInviteEmail({
        email: "marina@coach.test",
        magicLink: "https://app.test/auth/verify?x=1#abc",
        codeLifetime: 48 * 60 * 60 * 1000,
        preAuthSessionId: "preauth-1",
        userInputCode: "111111",
        tenantId: "public",
      }),
    ).rejects.toBeInstanceOf(AdminInviteEmailUnavailableError);
  });

  it("sends the invite via the configured transport with branded copy", async () => {
    configureSmtpEnv();
    const sendMail = vi.fn().mockResolvedValue(undefined);
    __setAdminInviteTransportForTesting(() => ({
      sendMail,
      // Other transport methods aren't used by sendAdminInviteEmail. Cast to
      // satisfy the Transporter type — the test only depends on sendMail.
    }) as never);

    await sendAdminInviteEmail({
      email: "marina@coach.test",
      magicLink: "https://app.test/auth/verify?intent=invite&x=1#abc",
      codeLifetime: 48 * 60 * 60 * 1000,
      preAuthSessionId: "preauth-1",
      userInputCode: "111111",
      tenantId: "public",
      recipientName: "Marina",
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const call = sendMail.mock.calls[0][0];
    expect(call.to).toBe("marina@coach.test");
    expect(call.from).toBe("Astral Guide <access@astral.guide>");
    expect(call.subject).toBe(
      "Tu portal de claridad te espera en Astral Guide",
    );
    // Invite copy must show up, login copy must not.
    expect(call.text).toContain("Una persona del equipo");
    expect(call.text).not.toContain("Pediste un acceso");
    expect(call.html).toContain("Marina, tu portal de");
    expect(call.html).toContain(
      "https://app.test/auth/verify?intent=invite&amp;x=1#abc",
    );
    // OTP must not be foregrounded in invite emails.
    expect(call.html).not.toContain("Código de acceso");
  });
});
