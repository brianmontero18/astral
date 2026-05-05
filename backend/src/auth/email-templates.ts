import { SMTPService } from "supertokens-node/recipe/passwordless/emaildelivery";
import type { TypePasswordlessEmailDeliveryInput } from "supertokens-node/recipe/passwordless/types";

import type { SuperTokensPasswordlessEmailConfig } from "./config.js";

// Astral Guide design tokens — mirror DESIGN.md verbatim. Email clients
// can't load Google Fonts reliably, so we keep Georgia/Arial as the
// serif/sans fallbacks while the rest of the system stays on Cormorant
// Garamond + Inter.
const FOREST_DEEP = "#21291e";
const FOREST = "#294c38";
const CREAM = "#f8f4e8";
const CREAM_SOFT = "#f1ebdb";
const TEXT_MUTED = "rgba(248, 244, 232, 0.72)";
const TEXT_FAINT = "rgba(248, 244, 232, 0.45)";
const BORDER_SUBTLE = "rgba(248, 244, 232, 0.10)";
const BORDER_GOLD = "rgba(207, 172, 108, 0.32)";
const GOLD = "#cfac6c";

const SERIF_STACK = "Georgia, 'Times New Roman', serif";
const SANS_STACK = "Arial, Helvetica, sans-serif";

export interface PasswordlessEmailContent {
  html: string;
  subject: string;
  text: string;
}

type EmailTemplateConfig = Pick<
  SuperTokensPasswordlessEmailConfig,
  "appName" | "from" | "supportHref"
>;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCodeLifetimeMinutes(codeLifetime: number): string {
  const minutes = Math.max(1, Math.round(codeLifetime / 60000));
  return `${minutes}`;
}

// Primary CTA button. Mirrors DESIGN.md `button-primary`: gold gradient,
// 10px corners, uppercase tracked label, forest-deep text. Email clients
// won't render the inset shadow consistently, so we keep the outer
// gradient + border and skip the box-shadow stack.
function buildCtaButton(
  magicLink: string | undefined,
  label: string,
  fallbackText: string,
): string {
  if (!magicLink) {
    return `<p style="margin: 16px 0 0; color: ${TEXT_MUTED}; font-family: ${SERIF_STACK}; line-height: 1.85; font-size: 15px;">${escapeHtml(fallbackText)}</p>`;
  }

  return `
    <a
      href="${escapeHtml(magicLink)}"
      style="
        display: inline-block;
        margin-top: 18px;
        padding: 14px 28px;
        border-radius: 10px;
        background: linear-gradient(135deg, #f1d59a 0%, #c19b5b 100%);
        border: 1px solid #e8c984;
        color: ${FOREST_DEEP};
        text-decoration: none;
        font-family: ${SANS_STACK};
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      "
    >
      ${escapeHtml(label)}
    </a>
  `;
}

interface ShellInput {
  bodyHtml: string;
  fromEmailHtml: string;
  fromNameHtml: string;
  kicker: string;
  supportHrefHtml: string;
  supportLabelHtml: string;
  titleHtml: string;
}

// Outer "letter" shell. Cream-soft envelope wrapping a forest card —
// surface-card on warm-banner background, mirroring how the in-app
// surface stack reads against sage-soft. No drop shadows: DESIGN.md
// uses tonal elevation only.
function renderEmailShell(input: ShellInput): string {
  return `
    <div style="margin: 0; padding: 32px 16px; background: ${CREAM_SOFT}; font-family: ${SERIF_STACK};">
      <div style="max-width: 600px; margin: 0 auto; padding: 28px 28px 24px; background: ${FOREST}; border-radius: 18px; border: 1px solid ${BORDER_GOLD};">
        <div style="margin-bottom: 22px; color: ${GOLD}; font-family: ${SANS_STACK}; font-size: 11px; font-weight: 700; letter-spacing: 0.20em; text-transform: uppercase;">
          ${input.kicker}
        </div>
        <h1 style="margin: 0 0 16px; color: ${CREAM}; font-family: ${SERIF_STACK}; font-size: 28px; font-weight: 500; line-height: 1.2; letter-spacing: 0;">
          ${input.titleHtml}
        </h1>
        ${input.bodyHtml}
        <div style="margin-top: 28px; padding-top: 18px; border-top: 1px solid ${BORDER_SUBTLE}; color: ${TEXT_FAINT}; font-family: ${SANS_STACK}; font-size: 11px; font-weight: 500; line-height: 1.6; letter-spacing: 0.04em;">
          ¿Necesitás ayuda? <a href="${input.supportHrefHtml}" style="color: ${GOLD}; text-decoration: none;">${input.supportLabelHtml}</a><br />
          ${input.fromNameHtml} · ${input.fromEmailHtml}
        </div>
      </div>
    </div>
  `;
}

function resolveSupportLabelHtml(
  supportHref: string,
  appName: string,
): string {
  if (supportHref.startsWith("mailto:")) {
    return escapeHtml(supportHref.replace(/^mailto:/, "").split("?")[0]);
  }
  return escapeHtml(`Soporte de ${appName}`);
}

// Expiry callout: gold-tinted card with the CTA button. Matches the
// `card-gold` token from DESIGN.md (rgba gold tint + gold border).
function buildExpiryCalloutHtml(input: {
  expiresInMinutes: string;
  ctaHtml: string;
}): string {
  return `
    <div style="margin: 24px 0 0; padding: 20px 22px; border-radius: 14px; background: rgba(207, 172, 108, 0.08); border: 1px solid ${BORDER_GOLD};">
      <div style="margin-bottom: 8px; color: ${CREAM}; font-family: ${SANS_STACK}; font-size: 12px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase;">
        Vence en ${input.expiresInMinutes} minutos
      </div>
      <div style="color: ${TEXT_MUTED}; font-family: ${SERIF_STACK}; line-height: 1.85; font-size: 15px;">
        Si no reconocés esta acción, podés ignorar este mensaje sin problema.
      </div>
      ${input.ctaHtml}
    </div>
  `;
}

export function buildLoginEmailContent(
  input: TypePasswordlessEmailDeliveryInput,
  config: EmailTemplateConfig,
): PasswordlessEmailContent {
  const expiresInMinutes = formatCodeLifetimeMinutes(input.codeLifetime);
  const subject = `Tu acceso a ${config.appName}`;
  const loginCode = input.userInputCode;
  const magicLink = input.urlWithLinkCode;
  const appNameHtml = escapeHtml(config.appName);
  const supportHrefHtml = escapeHtml(config.supportHref);
  const supportLabelHtml = resolveSupportLabelHtml(
    config.supportHref,
    config.appName,
  );
  const fromNameHtml = escapeHtml(config.from.name);
  const fromEmailHtml = escapeHtml(config.from.email);
  const loginCodeHtml = loginCode ? escapeHtml(loginCode) : null;

  const text = [
    `${config.appName} te envió un acceso para iniciar sesión.`,
    "",
    loginCode ? `Código de acceso: ${loginCode}` : null,
    magicLink ? `Enlace mágico: ${magicLink}` : null,
    "",
    `Este acceso vence en ${expiresInMinutes} minutos.`,
    `Si no fuiste vos, podés ignorar este mensaje.`,
    `Soporte: ${config.supportHref}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  // Code box: subtle inset card with serif numerals tracked. Visually
  // separates from the surrounding body text without competing with
  // the gold CTA below.
  const codeBoxHtml = loginCodeHtml
    ? `
      <div style="margin: 24px 0 0; padding: 20px 22px; border-radius: 14px; background: rgba(248, 244, 232, 0.04); border: 1px solid ${BORDER_SUBTLE}; text-align: center;">
        <div style="margin-bottom: 10px; color: ${TEXT_FAINT}; font-family: ${SANS_STACK}; font-size: 11px; font-weight: 600; letter-spacing: 0.20em; text-transform: uppercase;">
          Código de acceso
        </div>
        <div style="color: ${CREAM}; font-family: ${SERIF_STACK}; font-size: 28px; font-weight: 500; letter-spacing: 0.20em;">
          ${loginCodeHtml}
        </div>
      </div>
    `
    : "";

  const bodyHtml = `
    <p style="margin: 0; color: ${TEXT_MUTED}; font-family: ${SERIF_STACK}; line-height: 1.85; font-size: 15px;">
      Pediste un acceso para entrar a ${appNameHtml}. Podés usar este código o abrir el enlace mágico desde este mismo dispositivo.
    </p>
    ${codeBoxHtml}
    ${buildExpiryCalloutHtml({
      expiresInMinutes,
      ctaHtml: buildCtaButton(
        magicLink,
        "Abrir mi portal",
        "Abrí el enlace mágico desde el mismo navegador donde empezaste el acceso.",
      ),
    })}
  `;

  const html = renderEmailShell({
    bodyHtml,
    fromEmailHtml,
    fromNameHtml,
    kicker: `Acceso a ${appNameHtml}`,
    supportHrefHtml,
    supportLabelHtml,
    titleHtml: `Tu portal de <span style="color: ${GOLD}; font-style: italic;">claridad</span> te espera`,
  });

  return { subject, text, html };
}

export interface BuildInviteEmailOptions {
  recipientName?: string | null;
}

export function buildInviteEmailContent(
  input: TypePasswordlessEmailDeliveryInput,
  config: EmailTemplateConfig,
  options: BuildInviteEmailOptions = {},
): PasswordlessEmailContent {
  const expiresInMinutes = formatCodeLifetimeMinutes(input.codeLifetime);
  const magicLink = input.urlWithLinkCode;
  const appName = config.appName;
  const subject = `Tu portal de claridad te espera en ${appName}`;
  const appNameHtml = escapeHtml(appName);
  const supportHrefHtml = escapeHtml(config.supportHref);
  const supportLabelHtml = resolveSupportLabelHtml(
    config.supportHref,
    appName,
  );
  const fromNameHtml = escapeHtml(config.from.name);
  const fromEmailHtml = escapeHtml(config.from.email);
  const recipientName = options.recipientName?.trim() || null;
  const titleHtml = recipientName
    ? `${escapeHtml(recipientName)}, tu portal de <span style="color: ${GOLD}; font-style: italic;">claridad</span> te espera`
    : `Tu portal de <span style="color: ${GOLD}; font-style: italic;">claridad</span> te espera`;

  const greeting = recipientName
    ? `${recipientName}, te invitamos a entrar a ${appName}.`
    : `Te invitamos a entrar a ${appName}.`;

  const text = [
    greeting,
    "",
    "Una persona del equipo te abrió tu acceso para empezar tu camino con Diseño Humano.",
    "",
    magicLink ? `Abrí tu acceso: ${magicLink}` : null,
    "",
    `Esta invitación vence en ${expiresInMinutes} minutos.`,
    `Si no esperabas este mensaje, podés ignorarlo sin problema.`,
    `Soporte: ${config.supportHref}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const bodyHtml = `
    <p style="margin: 0; color: ${TEXT_MUTED}; font-family: ${SERIF_STACK}; line-height: 1.85; font-size: 15px;">
      Una persona del equipo te abrió tu acceso a ${appNameHtml}. Entrá con un toque y empezá tu camino con Diseño Humano — sin contraseñas, sin fricción.
    </p>
    ${buildExpiryCalloutHtml({
      expiresInMinutes,
      ctaHtml: buildCtaButton(
        magicLink,
        "Entrar a Astral Guide",
        "Abrí el enlace que te enviamos por email para entrar a tu cuenta.",
      ),
    })}
  `;

  const html = renderEmailShell({
    bodyHtml,
    fromEmailHtml,
    fromNameHtml,
    kicker: `Invitación a ${appNameHtml}`,
    supportHrefHtml,
    supportLabelHtml,
    titleHtml,
  });

  return { subject, text, html };
}

export function createPasswordlessEmailService(
  config: SuperTokensPasswordlessEmailConfig,
) {
  if (!config.enabled || !config.smtpSettings) {
    return undefined;
  }

  return new SMTPService({
    smtpSettings: config.smtpSettings,
    override: (originalImplementation) => ({
      ...originalImplementation,
      getContent: async (input) => {
        const content = buildLoginEmailContent(input, config);

        return {
          body: content.html,
          isHtml: true,
          subject: content.subject,
          toEmail: input.email,
        };
      },
    }),
  });
}
