# Admin invite — runbook

How to provision premium / basic users while there is no payment gateway.
Closes the operational side of epic `astral-0xw`.

## Setup operativo (una sola vez)

El TTL del magic link de la invitación está acoplado al **SuperTokens core**
(no al backend de Astral). En Cloud, configurar:

1. SuperTokens dashboard → Core configuration → `passwordless_code_lifetime`.
2. Setear a `172800000` (= 48h en milisegundos).

Esto afecta también el sign-in normal con magic link (ese tradeoff fue
decidido en el epic — un TTL per-call no existe en el SDK passwordless
y reimplementar es over-engineering MVP).

## Invitar a una usuaria nueva

1. Loguearse al panel admin.
2. Tab **Personas** → botón **Invitar usuaria** (top right).
3. Llenar:
   - **Email** (required).
   - **Plan** (default: Premium).
   - **Nombre** (opcional — si lo cargás, la usuaria salta el step "nombre"
     en el onboarding).
4. **Enviar invitación**.

Resultados posibles:

- **Invitación enviada (plan premium)** + magic link copiable + nota "expira
  en 48h". El email también sale automáticamente desde el SMTP configurado.
- **Plan actualizado a premium — la cuenta ya existía como free, no se
  duplicó**. La usuaria conserva su onboarding completo y queda upgradeada;
  el magic link sirve como nueva sesión si la querés ayudar a entrar.
- **Cuenta creada pero el email falló** (502). La fila users existe; usá el
  link "Abrir detalle" o entrá manualmente al detalle y clickeá **Reinvitar**.

Si querés mandar el link por WhatsApp, copiá desde el panel.

## Reinvitar (link expiró o el email no llegó)

1. Tab **Personas** → buscar a la usuaria por email o nombre → abrir detalle.
2. Sección **Onboarding y acceso** → si la usuaria está en `Pendiente` con
   origen `Invitación admin`, aparece el botón **Reinvitar**.
3. Click → genera un magic link nuevo (48h), reenvía el email + lo muestra
   copiable en el panel.

El endpoint detrás (`POST /api/admin/users`) es idempotente por email
case-insensitive: nunca duplica la cuenta, solo regenera el link.

## Cambiar plan de una cuenta existente

Para cambios cosméticos (free ↔ basic ↔ premium) sin enviar invite, usá la
sección **Acciones de soporte** del detalle. Esa ruta NO toca `access_source`;
el origen del alta queda como vino (manual / self / payment).

Si en cambio querés "upgradear y avisarle a la usuaria con un link nuevo",
usá el flujo de Invitar (idempotente por email).

## Qué pasa cuando la usuaria abre el link

1. SuperTokens consume el link → crea la sesión con el `subject` propio.
2. Primer `/api/me` detecta que el subject está unlinked y busca un row
   pending por email. Si match (y `access_source='manual'`, sin identity
   previa), se crea automáticamente el `user_identities`.
3. `/api/me` ahora retorna `onboardingStatus='pending'` + el
   `onboardingStep` persistido. El frontend rutea a OnboardingFlow en
   modo *resume* y arranca exactamente en ese paso.
4. Cada paso del wizard persiste vía `PATCH /api/me/onboarding`. Si la
   usuaria refresca, retoma desde el último checkpoint.
5. Submit del intake → `complete: true` → `onboarding_status='complete'`
   → próxima carga rutea al chat con el plan locked desde la invitación.

## Edge cases

- **Self-signup en paralelo**: si una usuaria con email X firmó por su
  cuenta antes de que la invitemos, el invite la upgradeará al plan que
  elijas. El onboarding no se reabre (ya está complete).
- **Email vacío o malformado**: 400 `invalid_email` desde el endpoint.
- **Plan inválido**: 400 `invalid_plan`.
- **Sesión sin permisos admin**: 403 `admin_required`.
- **Cuenta `disabled`/`banned`**: el invite igual genera link, pero el
  guard de sesión bloquea el acceso al chat hasta que admin reactive
  la cuenta desde el detalle.
- **Usuaria pending que intenta usar chat o report sin completar
  onboarding**: 403 `onboarding_required`. Transits muestran la vista
  colectiva (sin `impact` personalizado). El frontend ya rutea a
  onboarding antes de que esto ocurra; los 403 son el cinturón de
  seguridad.

## Validaciones técnicas (referencia)

- Tabla `users` agregó `onboarding_status`, `onboarding_step`,
  `access_source` (`astral-w72`).
- Endpoint `POST /api/admin/users` y `PATCH /api/me/onboarding` viven
  en `backend/src/routes/users.ts` (`astral-wlx` + `astral-4ub`).
- Auto-link por email vive en `backend/src/auth/current-user.ts`
  (`astral-4ub`).
- Modal y reinvite UI: `frontend/src/components/AdminInviteModal.tsx`
  + bloque "Onboarding y acceso" en `AdminUserDetailView.tsx`
  (`astral-e59`).
- Resume del wizard: `frontend/src/App.tsx` + `OnboardingFlow.tsx`
  (`astral-3wx`).
- Spec E2E del flujo: `e2e/specs/25-admin-invite-flow.spec.ts`
  (`astral-bgk`, cierre en `astral-6o4`).
