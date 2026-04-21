import { SMTPService } from "supertokens-node/recipe/passwordless/emaildelivery";
import type { TypePasswordlessEmailDeliveryInput } from "supertokens-node/recipe/passwordless/types";

import type { SuperTokensPasswordlessEmailConfig } from "./config.js";

const ASTRAL_EMAIL_BACKGROUND =
  "linear-gradient(180deg, #161327 0%, #0d0b16 100%)";
const ASTRAL_PANEL_BACKGROUND = "rgba(18, 16, 31, 0.94)";
const ASTRAL_BORDER = "1px solid rgba(197, 160, 89, 0.16)";
const ASTRAL_TEXT_MAIN = "#f5efe0";
const ASTRAL_TEXT_MUTED = "#b8afc7";
const ASTRAL_TEXT_FAINT = "#8d839f";
const ASTRAL_ACCENT = "#c5a059";

export interface PasswordlessEmailContent {
  html: string;
  subject: string;
  text: string;
}

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

function buildMagicLinkMarkup(
  magicLink: string | undefined,
  fallbackText: string,
): string {
  if (!magicLink) {
    return `<p style="margin: 0; color: ${ASTRAL_TEXT_MUTED}; line-height: 1.7;">${escapeHtml(fallbackText)}</p>`;
  }

  return `
    <a
      href="${escapeHtml(magicLink)}"
      style="
        display: inline-block;
        margin-top: 16px;
        padding: 14px 22px;
        border-radius: 999px;
        background: ${ASTRAL_ACCENT};
        color: #15111f;
        text-decoration: none;
        font-weight: 700;
        letter-spacing: 0.04em;
      "
    >
      Abrir mi portal
    </a>
  `;
}

export function buildPasswordlessEmailContent(
  input: TypePasswordlessEmailDeliveryInput,
  config: Pick<
    SuperTokensPasswordlessEmailConfig,
    "appName" | "from" | "supportHref"
  >,
): PasswordlessEmailContent {
  const expiresInMinutes = formatCodeLifetimeMinutes(input.codeLifetime);
  const subject = `Tu acceso a ${config.appName}`;
  const loginCode = input.userInputCode;
  const magicLink = input.urlWithLinkCode;
  const supportHref = config.supportHref;
  const supportLabel = supportHref.startsWith("mailto:")
    ? supportHref.replace(/^mailto:/, "").split("?")[0]
    : `Soporte de ${config.appName}`;
  const appNameHtml = escapeHtml(config.appName);
  const supportHrefHtml = escapeHtml(supportHref);
  const supportLabelHtml = escapeHtml(supportLabel);
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
    `Soporte: ${supportHref}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const html = `
    <div style="margin:0; padding: 32px 16px; background: ${ASTRAL_EMAIL_BACKGROUND}; font-family: Georgia, 'Times New Roman', serif;">
      <div style="max-width: 620px; margin: 0 auto; padding: 32px 28px; background: ${ASTRAL_PANEL_BACKGROUND}; border-radius: 28px; border: ${ASTRAL_BORDER}; box-shadow: 0 30px 80px rgba(0,0,0,0.35);">
        <div style="margin-bottom: 28px; color: ${ASTRAL_TEXT_FAINT}; font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase;">
          Acceso a ${appNameHtml}
        </div>
        <h1 style="margin: 0 0 12px; color: ${ASTRAL_TEXT_MAIN}; font-size: 40px; font-weight: 400; line-height: 1.08;">
          Tu portal de <span style="color: ${ASTRAL_ACCENT}; font-style: italic;">claridad</span> te espera
        </h1>
        <p style="margin: 0 0 24px; color: ${ASTRAL_TEXT_MUTED}; font-family: Arial, sans-serif; line-height: 1.7; font-size: 15px;">
          Pediste un acceso para entrar a ${appNameHtml}. Podés usar este código o abrir el enlace mágico desde este mismo dispositivo.
        </p>

        ${
          loginCodeHtml
            ? `
              <div style="margin-bottom: 24px; padding: 24px 22px; border-radius: 22px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); text-align: center;">
                <div style="margin-bottom: 10px; color: ${ASTRAL_TEXT_FAINT}; font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;">
                  Código de acceso
                </div>
                <div style="color: ${ASTRAL_TEXT_MAIN}; font-family: Arial, sans-serif; font-size: 38px; font-weight: 700; letter-spacing: 0.18em;">
                  ${loginCodeHtml}
                </div>
              </div>
            `
            : ""
        }

        <div style="margin-bottom: 24px; padding: 24px 22px; border-radius: 22px; background: rgba(197,160,89,0.08); border: 1px solid rgba(197,160,89,0.18);">
          <div style="margin-bottom: 10px; color: ${ASTRAL_TEXT_MAIN}; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700;">
            Este acceso vence en ${expiresInMinutes} minutos.
          </div>
          <div style="color: ${ASTRAL_TEXT_MUTED}; font-family: Arial, sans-serif; line-height: 1.7; font-size: 14px;">
            Si no reconocés esta acción, podés ignorar este mensaje sin problema.
          </div>
          ${buildMagicLinkMarkup(
            magicLink,
            "Abrí el enlace mágico desde el mismo navegador donde empezaste el acceso.",
          )}
        </div>

        <div style="padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.08); color: ${ASTRAL_TEXT_FAINT}; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.7;">
          ¿Necesitás ayuda? <a href="${supportHrefHtml}" style="color: ${ASTRAL_ACCENT}; text-decoration: none;">${supportLabelHtml}</a><br />
          ${fromNameHtml} · ${fromEmailHtml}
        </div>
      </div>
    </div>
  `;

  return {
    subject,
    text,
    html,
  };
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
        const content = buildPasswordlessEmailContent(input, config);

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
