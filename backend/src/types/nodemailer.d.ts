// Minimal ambient type for nodemailer. The real package ships without types
// and @types/nodemailer is not installed in this environment. We only depend
// on createTransport(...).sendMail(...) so we keep the surface tight and
// document the assumption.
declare module "nodemailer" {
  export interface Transporter {
    sendMail(mail: {
      from?: string;
      to: string;
      subject: string;
      text?: string;
      html?: string;
    }): Promise<unknown>;
  }

  export interface SmtpAuth {
    user: string;
    pass: string;
  }

  export interface SmtpTransportOptions {
    host: string;
    port: number;
    secure?: boolean;
    auth?: SmtpAuth;
  }

  export function createTransport(options: SmtpTransportOptions): Transporter;

  const _default: { createTransport: typeof createTransport };
  export default _default;
}
