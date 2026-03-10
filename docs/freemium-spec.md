# Freemium Paywall — Spec

## Objetivo

Limitar a 15 mensajes gratuitos por usuario. Al alcanzar el límite, mostrar CTA a WhatsApp para desbloquear plan Pro.

## Constante

```
FREE_MESSAGE_LIMIT = 15
```

Cuenta solo mensajes con `role = 'user'` en `chat_messages`.

---

## Backend

### 1. `db.ts` — Nueva función

```typescript
export async function getUserMessageCount(userId: string): Promise<number> {
  const result = await client.execute({
    sql: "SELECT COUNT(*) as count FROM chat_messages WHERE user_id = ? AND role = 'user'",
    args: [userId],
  });
  return (result.rows[0]?.count as number) ?? 0;
}
```

### 2. `routes/chat.ts` — Enforcement

En AMBOS handlers (`POST /chat` y `POST /chat/stream`), después de resolver el usuario pero ANTES de llamar al LLM o escribir headers SSE:

```typescript
const used = await getUserMessageCount(userId);
if (used >= FREE_MESSAGE_LIMIT) {
  return reply.status(403).send({
    error: "message_limit_reached",
    used,
    limit: FREE_MESSAGE_LIMIT,
  });
}
```

En el stream: mover `reply.raw.writeHead(200, ...)` a DESPUÉS de este check para que el 403 sea JSON, no SSE.

### 3. `routes/chat.ts` — Enriquecer GET `/messages`

```typescript
// En GET /users/:userId/messages
const count = await getUserMessageCount(userId);
return reply.send({ messages, used: count, limit: FREE_MESSAGE_LIMIT });
```

---

## Frontend

### 4. `types.ts` — Nuevo tipo

```typescript
export interface MessageLimitError {
  error: "message_limit_reached";
  used: number;
  limit: number;
}
```

### 5. `api.ts` — Manejar 403

En `sendChat` y `sendChatStream`, antes del throw genérico:

```typescript
if (res.status === 403) {
  const data = await res.json();
  if (data.error === "message_limit_reached") {
    const err = new Error("message_limit_reached") as any;
    err.used = data.used;
    err.limit = data.limit;
    throw err;
  }
}
```

Actualizar `getChatHistory` para retornar `{ messages, used, limit }`.

### 6. `ChatView.tsx` — UI

**Estado nuevo:**

```typescript
const [messageUsage, setMessageUsage] = useState<{ used: number; limit: number } | null>(null);
const [limitReached, setLimitReached] = useState(false);
```

**Contador (cuando NO se alcanzó el límite):**

Arriba del input, alineado a la derecha:

```
{used}/{limit} mensajes
```

Estilo: `color: var(--text-faint)`, `fontSize: 11px`, `fontFamily: var(--font-sans)`.

Incrementar `used` optimísticamente al enviar mensaje.

**Paywall (cuando se alcanza el límite):**

Reemplazar el footer/input con:

```
    ✦

    Tu ventana al cosmos se ha completado

    Has usado tus 15 mensajes de exploración.
    Para seguir recibiendo guía estelar personalizada,
    accedé al plan completo.

    [ Desbloquear Astral Guide ✦ ]
        ↓
    https://wa.me/5491153446030
```

Estilo del botón: `glass-panel-gold`, padding `14px 36px`, border-radius `24px`, color dorado, font serif.

El link abre en nueva pestaña (`target="_blank"`).

---

## Flujo completo

```
1. ChatView monta → GET /users/:id/messages → recibe { messages, used, limit }
   → Si used >= limit → limitReached = true, mostrar paywall
   → Si no → mostrar contador + input normal

2. Usuario envía mensaje → POST /chat/stream
   → Backend: getUserMessageCount()
     → Si >= 15 → 403 { error: "message_limit_reached" }
       → Frontend: catch → setLimitReached(true), mostrar paywall
     → Si < 15 → procesar normal, stream respuesta

3. Paywall visible → usuario toca botón → abre WhatsApp en nueva pestaña
```

## No incluido (futuro)

- Autenticación
- Stripe/pagos automáticos
- Desbloqueo programático post-pago
- Rate limiting por tiempo
