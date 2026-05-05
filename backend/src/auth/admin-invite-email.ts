import nodemailer, { type Transporter } from "nodemailer";

import { readSuperTokensConfig } from "./config.js";
import { buildInviteEmailContent } from "./email-templates.js";

// Admin invite email is sent through a transport separate from the
// SuperTokens passwordless service so the copy can diverge from the
// login email without overriding SuperTokens' content callbacks. The
// magic link itself is still produced by Passwordless.createCode in the
// route handler — this module only owns delivery + template selection.
//
// nodemailer comes in transitively via supertokens-node. If that ever
// changes, we'll need to add it as a direct dependency.

export class AdminInviteEmailUnavailableError extends Error {
  constructor(message = "SMTP delivery is not configured for admin invites") {
    super(message);
    this.name = "AdminInviteEmailUnavailableError";
  }
}

export interface SendAdminInviteEmailInput {
  codeLifetime: number;
  email: string;
  magicLink: string;
  preAuthSessionId: string;
  recipientName?: string | null;
  tenantId: string;
  userInputCode?: string;
}

interface TransportFactory {
  (): Transporter | null;
}

let transportFactoryOverride: TransportFactory | null = null;

export function __setAdminInviteTransportForTesting(
  factory: TransportFactory | null,
): void {
  transportFactoryOverride = factory;
}

function buildTransport(): Transporter | null {
  if (transportFactoryOverride) {
    return transportFactoryOverride();
  }

  const config = readSuperTokensConfig();
  const smtp = config.emailDelivery.smtpSettings;
  if (!config.emailDelivery.enabled || !smtp) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.password
      ? {
          user: smtp.authUsername ?? smtp.from.email,
          pass: smtp.password,
        }
      : undefined,
  });
}

export async function sendAdminInviteEmail(
  input: SendAdminInviteEmailInput,
): Promise<void> {
  const transport = buildTransport();
  if (!transport) {
    throw new AdminInviteEmailUnavailableError();
  }

  const config = readSuperTokensConfig();
  const emailConfig = config.emailDelivery;

  const content = buildInviteEmailContent(
    {
      type: "PASSWORDLESS_LOGIN",
      isFirstFactor: true,
      email: input.email,
      codeLifetime: input.codeLifetime,
      preAuthSessionId: input.preAuthSessionId,
      urlWithLinkCode: input.magicLink,
      userInputCode: input.userInputCode,
      tenantId: input.tenantId,
    },
    emailConfig,
    { recipientName: input.recipientName ?? null },
  );

  await transport.sendMail({
    from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
    to: input.email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}
