import { useEffect, useState, type ReactNode } from "react";
import Passwordless from "supertokens-auth-react/recipe/passwordless";
import Session from "supertokens-auth-react/recipe/session";
import { readFrontendAuthConfig } from "./config";
import {
  buildCleanAuthPath,
  buildStoredAttempt,
  getCodeConsumeErrorMessage,
  getStepForFlowType,
  hasMagicLinkAttempt,
  readRedirectToPath,
  shouldAutoConsumeMagicLink,
  type AstralAuthStep,
  type StoredPasswordlessAttempt,
} from "./helpers";

function readCurrentAuthLocation() {
  return {
    hash: window.location.hash,
    search: window.location.search,
  };
}

function AuthShell({ children }: { children: ReactNode }) {
  const { supportHref } = readFrontendAuthConfig();
  const currentYear = new Date().getFullYear();

  return (
    <div className="astral-auth-shell animate-fade-in-slow">
      <header className="astral-auth-topbar">
        <div className="astral-auth-wordmark">Astral Guide</div>
        <div className="astral-auth-topnav">
          <a
            className="astral-auth-topnav-link"
            href={supportHref}
            rel="noreferrer"
            target={supportHref.startsWith("mailto:") ? undefined : "_blank"}
          >
            <span aria-hidden="true" className="astral-auth-topnav-mark">
              ✦
            </span>
            <span>Support</span>
          </a>
        </div>
      </header>
      <main className="astral-auth-stage">{children}</main>
      <footer className="astral-auth-footer">
        <div className="astral-auth-footer-copy">
          © {currentYear} Astral Guide. Diseñado por AUREA Core.
        </div>
      </footer>
    </div>
  );
}

function AuthStatusPanel({
  title,
  body,
}: {
  body: ReactNode;
  title: string;
}) {
  return (
    <div className="astral-auth-status-card">
      <span className="astral-auth-panel-kicker">Acceso</span>
      <h1 className="astral-auth-status-title">{title}</h1>
      <div className="astral-auth-status-body">{body}</div>
    </div>
  );
}

function renderIntroTitle(step: AstralAuthStep) {
  if (step === "code") {
    return (
      <>
        <span className="astral-auth-display-line">Tu portal de</span>
        <span className="astral-auth-display-line">
          <span className="astral-auth-display-accent">claridad</span> confirma
        </span>
        <span className="astral-auth-display-line">este código</span>
      </>
    );
  }

  if (step === "magic-link-ready") {
    return (
      <>
        <span className="astral-auth-display-line">Tu portal de</span>
        <span className="astral-auth-display-line">
          <span className="astral-auth-display-accent">claridad</span> espera
        </span>
        <span className="astral-auth-display-line">tu confirmación</span>
      </>
    );
  }

  if (step === "verifying") {
    return (
      <>
        <span className="astral-auth-display-line">Tu portal de</span>
        <span className="astral-auth-display-line">
          <span className="astral-auth-display-accent">claridad</span> está
        </span>
        <span className="astral-auth-display-line">abriéndose</span>
      </>
    );
  }

  return (
    <>
      <span className="astral-auth-display-line">Tu portal de</span>
      <span className="astral-auth-display-line">
        <span className="astral-auth-display-accent">claridad</span> empieza
      </span>
      <span className="astral-auth-display-line">aquí</span>
    </>
  );
}

export function AuthScreen() {
  const config = readFrontendAuthConfig();
  const [step, setStep] = useState<AstralAuthStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [attempt, setAttempt] = useState<StoredPasswordlessAttempt | null>(null);
  const [booting, setBooting] = useState(config.enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const introBody =
    step === "code"
      ? "Ingresa el código que te enviamos por email para mantener la atmósfera intacta."
      : step === "magic-link-ready"
      ? "Abre el enlace en este mismo dispositivo o continúa manualmente desde aquí."
      : step === "verifying"
      ? "Estamos verificando tu acceso para devolverte a la experiencia de Astral Guide."
      : "Entra con un enlace mágico por email para mantener la atmósfera intacta.";

  const destination =
    attempt?.contactInfo ?? (step === "email" ? "" : email.trim());

  async function clearAttemptState(nextStep: AstralAuthStep = "email") {
    const redirectToPath = readRedirectToPath(window.location.search);

    await Passwordless.clearLoginAttemptInfo();
    window.history.replaceState(
      {},
      "",
      buildCleanAuthPath(config.websiteBasePath, redirectToPath),
    );

    setAttempt(null);
    setCode("");
    setNotice(null);
    setStep(nextStep);
  }

  async function finishAuth(currentAttempt: StoredPasswordlessAttempt | null) {
    const redirectToPath =
      currentAttempt?.redirectToPath ??
      readRedirectToPath(window.location.search) ??
      "/";

    await Passwordless.clearLoginAttemptInfo();
    window.location.assign(redirectToPath);
  }

  async function consumeMagicLink(currentAttempt: StoredPasswordlessAttempt | null) {
    setBusy(true);
    setError(null);
    setNotice(null);
    setStep("verifying");

    try {
      const result = await Passwordless.consumeCode();

      if (result.status === "OK") {
        await finishAuth(currentAttempt);
        return;
      }

      if (result.status === "RESTART_FLOW_ERROR") {
        await clearAttemptState();
        setError("Este enlace ya no está disponible. Pedí uno nuevo.");
        return;
      }

      if (result.status === "SIGN_IN_UP_NOT_ALLOWED") {
        setError(result.reason);
        setStep("magic-link-ready");
        return;
      }

      setError("No pudimos validar este enlace. Probá otra vez.");
      setStep("magic-link-ready");
    } catch {
      setError("No pudimos validar este enlace. Probá otra vez.");
      setStep("magic-link-ready");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!config.enabled) {
      return;
    }

    let active = true;

    async function bootstrapAuth() {
      try {
        if (await Session.doesSessionExist()) {
          window.location.assign(readRedirectToPath(window.location.search) ?? "/");
          return;
        }

        const storedAttempt =
          await Passwordless.getLoginAttemptInfo<StoredPasswordlessAttempt>();

        if (!active) {
          return;
        }

        setAttempt(storedAttempt ?? null);
        setEmail(storedAttempt?.contactInfo ?? "");

        const location = readCurrentAuthLocation();

        if (hasMagicLinkAttempt(location.search, location.hash)) {
          if (
            shouldAutoConsumeMagicLink(
              location.search,
              location.hash,
              storedAttempt,
            )
          ) {
            setStep("verifying");
            setBooting(false);
            void consumeMagicLink(storedAttempt ?? null);
            return;
          }

          setStep("magic-link-ready");
          return;
        }

        if (storedAttempt) {
          setStep(getStepForFlowType(storedAttempt.flowType));
          return;
        }

        setStep("email");
      } catch {
        if (!active) {
          return;
        }

        setError("No pudimos preparar el acceso. Volvé a intentar.");
        setStep("email");
      } finally {
        if (active) {
          setBooting(false);
        }
      }
    }

    void bootstrapAuth();

    return () => {
      active = false;
    };
  }, [config.enabled]);

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Ingresa tu email.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const redirectToPath = readRedirectToPath(window.location.search);
      const result = await Passwordless.createCode({ email: normalizedEmail });

      if (result.status !== "OK") {
        setError(result.reason);
        return;
      }

      const nextAttempt = buildStoredAttempt({
        contactInfo: normalizedEmail,
        deviceId: result.deviceId,
        flowType: result.flowType,
        preAuthSessionId: result.preAuthSessionId,
        redirectToPath,
      });

      await Passwordless.setLoginAttemptInfo({
        attemptInfo: nextAttempt,
      });

      setAttempt(nextAttempt);
      setCode("");
      setStep(getStepForFlowType(nextAttempt.flowType));
      setNotice(
        nextAttempt.flowType === "MAGIC_LINK"
          ? "Revisá tu bandeja. El enlace está en camino."
          : "Revisá tu bandeja. El código tiene 6 dígitos y vence en 10 minutos.",
      );
    } catch {
      setError("No pudimos enviarte el acceso. Volvé a intentar.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(rawCode: string) {
    const normalizedCode = rawCode.trim();

    if (!normalizedCode) {
      setError("Ingresa el código que recibiste por email.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const result = await Passwordless.consumeCode({
        userInputCode: normalizedCode,
      });

      if (result.status === "OK") {
        await finishAuth(attempt);
        return;
      }

      if (
        result.status === "INCORRECT_USER_INPUT_CODE_ERROR" ||
        result.status === "EXPIRED_USER_INPUT_CODE_ERROR"
      ) {
        setError(getCodeConsumeErrorMessage(result));
        setCode("");
        return;
      }

      if (result.status === "RESTART_FLOW_ERROR") {
        await clearAttemptState();
        setError("Ese acceso ya expiró. Pedí uno nuevo.");
        return;
      }

      if (result.status === "SIGN_IN_UP_NOT_ALLOWED") {
        setError(result.reason);
        return;
      }

      setError("No pudimos validar ese acceso. Volvé a intentar.");
    } catch {
      setError("No pudimos validar el código. Volvé a intentar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCodeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitCode(code);
  }

  function handleCodeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(next);
    if (next.length === 6 && !busy) {
      void submitCode(next);
    }
  }

  async function handleResend() {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const result = await Passwordless.resendCode();

      if (result.status === "RESTART_FLOW_ERROR") {
        await clearAttemptState();
        setError("Ese acceso ya expiró. Pedí uno nuevo.");
        return;
      }

      const nextAttempt = attempt
        ? {
            ...attempt,
            lastResendAt: Date.now(),
          }
        : null;

      if (nextAttempt) {
        await Passwordless.setLoginAttemptInfo({
          attemptInfo: nextAttempt,
        });
        setAttempt(nextAttempt);
      }

      setNotice("Acabamos de reenviarte el acceso. Revisá tu bandeja.");
    } catch {
      setError("No pudimos reenviar el acceso. Volvé a intentar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUseAnotherEmail() {
    setError(null);
    await clearAttemptState();
  }

  function renderCustomAuth() {
    if (booting) {
      return (
        <AuthStatusPanel
          title="Preparando acceso"
          body={
            <div className="astral-auth-loading">
              <div className="astral-auth-spinner" />
              <p>Sincronizando tu portal para entrar sin fricción.</p>
            </div>
          }
        />
      );
    }

    return (
      <section className="astral-auth-portal">
        <div className="astral-auth-card">
          <div className="astral-auth-card-header">
            <div className="astral-auth-card-mark">✦</div>
            <span className="astral-auth-kicker">Acceso a Astral Guide</span>
            <h1 className="astral-auth-display">{renderIntroTitle(step)}</h1>
            <p className="astral-auth-hero-copy">{introBody}</p>
          </div>

          <div className="astral-auth-card-body">
            {destination ? (
              <div className="astral-auth-inline-note">
                <strong>Destino</strong>
                <span>{destination}</span>
              </div>
            ) : null}

            {error ? (
              <div className="astral-auth-feedback astral-auth-feedback-error">
                {error}
              </div>
            ) : null}

            {notice ? (
              <div className="astral-auth-feedback astral-auth-feedback-success">
                {notice}
              </div>
            ) : null}

            {step === "email" ? (
              <form className="astral-auth-form" onSubmit={handleEmailSubmit}>
                <label
                  className="astral-auth-field astral-auth-field-minimal"
                  htmlFor="astral-auth-email"
                >
                  <input
                    id="astral-auth-email"
                    className="astral-auth-input astral-auth-input-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    aria-label="Email"
                    placeholder="tu@universo.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <button
                  className="astral-auth-primary"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? "Enviando..." : "Enviar enlace mágico"}
                </button>
                <p className="astral-auth-form-hint">
                  Sin contraseñas. Te enviamos un enlace de un solo uso.
                </p>
              </form>
            ) : null}

            {step === "code" ? (
              <>
                <form className="astral-auth-form" onSubmit={handleCodeSubmit}>
                  <label className="astral-auth-field" htmlFor="astral-auth-code">
                    <span>Código de acceso</span>
                    <input
                      id="astral-auth-code"
                      className="astral-auth-input astral-auth-code-input"
                      autoComplete="one-time-code"
                      autoFocus
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="123456"
                      value={code}
                      onChange={handleCodeChange}
                    />
                  </label>
                  <button
                    className="astral-auth-primary"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? "Validando..." : "Entrar a mi espacio"}
                  </button>
                </form>
                <div className="astral-auth-secondary-row">
                  <button
                    className="astral-auth-text-link"
                    disabled={busy}
                    onClick={() => void handleResend()}
                    type="button"
                  >
                    Reenviar código
                  </button>
                  <span aria-hidden="true" className="astral-auth-text-divider">
                    ·
                  </span>
                  <button
                    className="astral-auth-text-link"
                    disabled={busy}
                    onClick={() => void handleUseAnotherEmail()}
                    type="button"
                  >
                    Usar otro correo
                  </button>
                </div>
              </>
            ) : null}

            {step === "link-sent" ? (
              <>
                <button
                  className="astral-auth-primary"
                  disabled={busy}
                  onClick={() => void handleResend()}
                  type="button"
                >
                  {busy ? "Reenviando..." : "Reenviar enlace"}
                </button>

                <div className="astral-auth-secondary-row">
                  <button
                    className="astral-auth-text-link"
                    disabled={busy}
                    onClick={() => setStep("code")}
                    type="button"
                  >
                    Entrar con código
                  </button>
                  <span aria-hidden="true" className="astral-auth-text-divider">
                    ·
                  </span>
                  <button
                    className="astral-auth-text-link"
                    disabled={busy}
                    onClick={() => void handleUseAnotherEmail()}
                    type="button"
                  >
                    Usar otro correo
                  </button>
                </div>
              </>
            ) : null}

            {step === "magic-link-ready" ? (
              <div className="astral-auth-actions astral-auth-actions-stack">
                <button
                  className="astral-auth-primary"
                  disabled={busy}
                  onClick={() => void consumeMagicLink(attempt)}
                  type="button"
                >
                  {busy ? "Validando..." : "Continuar con este enlace"}
                </button>
                <button
                  className="astral-auth-secondary"
                  disabled={busy}
                  onClick={() => void handleUseAnotherEmail()}
                  type="button"
                >
                  Pedir otro acceso
                </button>
              </div>
            ) : null}

            {step === "verifying" ? (
              <div className="astral-auth-loading">
                <div className="astral-auth-spinner" />
                <p>Verificando tu enlace para abrir Astral Guide.</p>
              </div>
            ) : null}
          </div>

          {step !== "email" ? (
            <div className="astral-auth-card-footer">
              <div className="astral-auth-support-copy">
                Si algo no llega, revisá spam o pedí un nuevo enlace.
              </div>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (!config.enabled) {
    return (
        <AuthShell>
          <AuthStatusPanel
            title="Acceso no configurado"
            body={
              <p style={{ margin: 0 }}>
                El acceso por email todavía no está disponible en este entorno.
              </p>
            }
          />
        </AuthShell>
    );
  }

  return <AuthShell>{renderCustomAuth()}</AuthShell>;
}
