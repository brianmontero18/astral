# Admin invite — runbook

How to provision premium / basic users while there is no payment gateway,
and how to delete or reinvite an account.

Operational layer of epic `astral-0xw` (MVP) + epic `astral-b7u` (polish:
branded invite email, auto-login UX, delete user, neutral copy).

## Setup operativo (una sola vez)

### TTL del magic link

El TTL del magic link de la invitación está acoplado al **SuperTokens core**
(no al backend de Astral). En Cloud, configurar:

1. SuperTokens dashboard → Core configuration → `passwordless_code_lifetime`.
2. Setear a `172800000` (= 48h en milisegundos).

Esto afecta también el sign-in normal con magic link (ese tradeoff fue
decidido en el epic — un TTL per-call no existe en el SDK passwordless
y reimplementar es over-engineering MVP).

El backend ya **no** hardcodea 48h: el `expiresAt` que devuelve
`POST /api/admin/users` y la copy "Expira en ~X h" del panel admin se
calculan dinámicamente desde `createCodeResult.codeLifetime`. Si dev y
prod divergen, el panel lo refleja sin mentir.

### SMTP

El email de invitación se envía por un transporte separado del email de
login (no usa `Passwordless.sendEmail`). Comparten la misma config SMTP
de `backend/.env`:

```
SUPERTOKENS_SMTP_HOST
SUPERTOKENS_SMTP_PORT
SUPERTOKENS_SMTP_USERNAME
SUPERTOKENS_SMTP_PASSWORD
SUPERTOKENS_SMTP_SECURE
SUPERTOKENS_EMAIL_FROM
SUPERTOKENS_EMAIL_FROM_NAME
SUPERTOKENS_EMAIL_SUPPORT_HREF
```

Si SMTP no está configurado (env incompleto), `POST /api/admin/users`
responde `503 email_delivery_unavailable` y la fila `users` queda igual.
**No** hay fallback al email default de SuperTokens — preferimos un
fallo ruidoso a un email feo.

En dev local sin SMTP, configurá MailHog/Resend dev key o saltá la
prueba real (los tests backend mockean el transporte).

## Invitar a una persona nueva

1. Loguearse al panel admin.
2. Tab **Personas** → botón **Invitar persona** (top right).
3. Llenar:
   - **Email** (required).
   - **Plan** (default: Premium).
   - **Nombre** (opcional — si lo cargás, la persona salta el step
     "nombre" en el onboarding).
4. **Enviar invitación**.

El email que llega es **branded como invite**, separado del email de
login normal:

- Subject: `Tu portal de claridad te espera en Astral Guide`.
- Copy: "Una persona del equipo te abrió tu acceso a Astral Guide…".
- Sin foreground del código OTP — el CTA es el magic link.

Resultados posibles en el panel:

- **Invitación enviada (plan premium)** + magic link copiable + nota
  dinámica "Expira en ~48 h" (o lo que dicte el core).
- **Plan actualizado a premium — la cuenta ya existía como free, no se
  duplicó**. La cuenta conserva su onboarding completo y queda
  upgradeada; el magic link sirve como nueva sesión si querés ayudar a
  entrar.
- **Cuenta creada pero el email falló** (502 `invite_send_failed` o 503
  `email_delivery_unavailable`). La fila `users` existe; usá el link
  "Abrir detalle" o entrá manualmente al detalle y clickeá **Reinvitar**.

Si querés mandar el link por WhatsApp, copiá desde el panel. El botón
**Copiar link** muestra "✓ Copiado" por 2s + mensaje aria-live para SR.

## Magic link auto-login

El link generado lleva `&intent=invite` antes del fragment con el
`linkCode`. El frontend usa ese flag como señal explícita para
**autoconsumir** el link aunque el navegador del destinatario no haya
iniciado el login. Resultado: la persona clickea el botón del email y
entra directo, sin pantalla intermedia.

El login normal (persona escribiendo su email en `/auth`) **no** lleva
ese flag y mantiene el gate "Continuar con este enlace" cuando llega
desde otro browser. Eso preserva el posture original de CSRF para
links self-served.

### Edge: invite con sesión activa de otra cuenta

Si la persona abre el invite link mientras ya tiene sesión activa en el
mismo navegador (otra cuenta de Astral, una sesión vieja, etc.), el
bootstrap **no** redirige silenciosamente. Muestra una pantalla
intermedia "Hay una sesión activa en este navegador" con dos opciones:

- **Cerrar sesión y abrir mi invitación** → `Session.signOut` +
  `consumeCode` con el link actual.
- **Volver a Astral con la cuenta actual** → descarta el invite, redirige
  a `/`.

Esto evita "quemar" un invite válido por un redirect silencioso.

## Reinvitar (link expiró o el email no llegó)

1. Tab **Personas** → buscar por email o nombre → abrir detalle.
2. Sección **Onboarding y acceso** → si la cuenta está en `Pendiente`
   con origen `Invitación admin`, aparece el botón **Reinvitar**.
3. Click → genera un magic link nuevo, reenvía el email + lo muestra
   copiable en el panel con la TTL actual.

El endpoint detrás (`POST /api/admin/users`) es idempotente por email
case-insensitive: nunca duplica la cuenta, solo regenera el link.

## Cambiar plan de una cuenta existente

Para cambios cosméticos (free ↔ basic ↔ premium) sin enviar invite, usá
la sección **Acciones de soporte** del detalle. Esa ruta NO toca
`access_source`; el origen del alta queda como vino
(manual / self / payment).

Si en cambio querés "upgradear y avisarle con un link nuevo", usá el
flujo de Invitar (idempotente por email).

## Eliminar una cuenta

Desde el detalle, sección **Zona de cuidado** (al final, debajo de
"Datos técnicos"):

1. Click en **Eliminar cuenta**.
2. Confirmación con copy específica que nombra a la persona y lista lo
   que se va a borrar: mensajes, reportes, intake, identidad de auth,
   assets en R2.
3. Click **Eliminar** → `DELETE /api/admin/users/:id`.
4. Vuelve al listado de personas.

Lo que se borra:

- Todos los rows DB con `ON DELETE CASCADE` en `users.id`: assets,
  chat_messages, hd_reports, llm_calls, user_identities, etc.
- Todos los objetos R2 referenciados por `assets.storage_key`. Si la
  llamada a R2 falla en alguno (transient 503, key inexistente), el
  delete del usuario **continúa** y la response trae `r2Errors[]` con
  los detalles para limpieza manual.

Lo que **no** se borra:

- Backups o snapshots de la DB.
- Logs externos (Fly.io, OTel sink).
- Links/recibos de WhatsApp/Slack (out of scope).

Self-delete está **bloqueado**: el botón aparece deshabilitado con
tooltip "No podés eliminar tu propia cuenta admin" cuando
`currentUserId === userId`. El backend también devuelve
`400 cannot_delete_self` por defensa en profundidad.

El endpoint legacy `DELETE /api/users/:id` se mantiene para un futuro
flujo de self-delete (GDPR), pero **no** se usa desde el panel.

## Qué pasa cuando la persona abre el link

1. SuperTokens consume el link → crea la sesión con el `subject` propio.
2. Primer `/api/me` detecta que el subject está unlinked y busca un row
   pending por email. Si match (y `access_source='manual'`, sin identity
   previa), se crea automáticamente el `user_identities`.
3. `/api/me` ahora retorna `onboardingStatus='pending'` + el
   `onboardingStep` persistido. El frontend rutea a OnboardingFlow en
   modo *resume* y arranca exactamente en ese paso.
4. Cada paso del wizard persiste vía `PATCH /api/me/onboarding`. Si la
   persona refresca, retoma desde el último checkpoint.
5. Submit del intake → `complete: true` → `onboarding_status='complete'`
   → próxima carga rutea al chat con el plan locked desde la invitación.

## Edge cases

- **Self-signup en paralelo**: si la persona con email X firmó por su
  cuenta antes de que la invitemos, el invite la upgradeará al plan
  elegido. El onboarding no se reabre (ya está complete).
- **Email vacío o malformado**: 400 `invalid_email`.
- **Plan inválido**: 400 `invalid_plan`.
- **Sesión sin permisos admin**: 403 `admin_required`.
- **SMTP no configurado**: 503 `email_delivery_unavailable` (la fila
  `users` queda intacta para retry).
- **Cuenta `disabled`/`banned`**: el invite igual genera link, pero el
  guard de sesión bloquea el acceso al chat hasta que admin reactive la
  cuenta desde el detalle.
- **Persona pending intenta usar chat o report sin completar
  onboarding**: 403 `onboarding_required`. Transits muestran la vista
  colectiva (sin `impact` personalizado). El frontend ya rutea a
  onboarding antes de que esto ocurra; los 403 son el cinturón de
  seguridad.
- **Self-invite admin**: permitido. Si el admin se invita a sí mismo,
  el upgrade de plan vía `markUserAdminProvisioned` se aplica; el
  `PATCH /api/admin/users/:id/access` sigue bloqueando self-mutation.
- **Self-delete admin**: bloqueado en UI y backend.

## Validaciones técnicas (referencia)

- Tabla `users` agregó `onboarding_status`, `onboarding_step`,
  `access_source` (`astral-w72`).
- `POST /api/admin/users`, `PATCH /api/me/onboarding`,
  `DELETE /api/admin/users/:id` viven en `backend/src/routes/users.ts`
  (`astral-wlx` + `astral-4ub` + `astral-cwh`).
- Templates separados de email (login vs invite) en
  `backend/src/auth/email-templates.ts` (`astral-8xt`).
- Transporte de invite con guard SMTP en
  `backend/src/auth/admin-invite-email.ts` (`astral-gqn`).
- `intent=invite` en `buildMagicLink` y auto-consume en
  `frontend/src/auth/helpers.ts` (`astral-qhc`).
- Pantalla intermedia "invite con sesión activa" en
  `frontend/src/auth/AuthScreen.tsx` (`astral-pmk`).
- Auto-link por email en `backend/src/auth/current-user.ts`
  (`astral-4ub`).
- UI delete en `frontend/src/components/AdminUserDetailView.tsx` y
  hook `useCopyToClipboard` en `frontend/src/admin-support.ts`
  (`astral-whd` + `astral-46c`).
- Specs E2E:
  `e2e/specs/25-admin-invite-flow.spec.ts` (`astral-bgk`, activado en
  `astral-o2g`),
  `e2e/specs/26-admin-delete-user.spec.ts` (`astral-o2g`),
  `e2e/specs/27-invite-magic-link-auto-login.spec.ts` (`astral-o2g`).
