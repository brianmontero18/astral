---
name: typescript
description: Verify TypeScript code follows Manos patterns. Use when checking for any types, props typing, null handling, or type definitions.
---

# TypeScript Skill

> **Propósito**: Verificar que el código TypeScript siga los patterns del proyecto Manos.
> **Fuente de verdad**: `~/toolkit/templates/rules/typescript-patterns/RULE.md`
> **Invocable por**: pr-reviewer, executor, cualquier agent/skill

---

## Input esperado

Archivos `.ts` / `.tsx` del PR.

---

## Checklist de verificación

### 1. No `any` (ZERO TOLERANCE)

| ❌ Prohibido | ✅ Alternativas |
|--------------|-----------------|
| `any` | `unknown` si realmente no sabés el tipo |
| `as any` | Type assertion específica o type guard |
| `// @ts-ignore` sin justificación | Arreglar el tipo |

**Esto es un BLOCKER. No aprobar PRs con `any`.**

```typescript
// ❌ BAD
const data: any = response.data;
const result = someFunction() as any;

// ✅ GOOD
const data: unknown = response.data;
if (isExpectedType(data)) {
  // usar data tipado
}
```

### 2. Props Typing

| ❌ Incorrecto | ✅ Correcto |
|---------------|-------------|
| Props inline | Interface explícita |
| `React.FC<{...}>` con props inline | Interface + function component |

```typescript
// ❌ BAD - Inline props
const Component = ({ name, value }: { name: string; value: number }) => ...

// ✅ GOOD - Explicit interface
interface ComponentProps {
  name: string;
  value: number;
}

const Component = ({ name, value }: ComponentProps) => ...
```

### 3. Null Handling

| Patrón | Uso |
|--------|-----|
| Optional chaining | `user?.name` |
| Nullish coalescing | `value ?? defaultValue` |
| Early returns | `if (!data) return null;` |

**Red flag:** Chequeos manuales como `data && data.value` en lugar de `data?.value`.

### 4. Type Definitions Location

| Tipo | Ubicación |
|------|-----------|
| Feature-specific | `feature/types/index.ts` |
| Shared | `app/types/index.ts` |
| API response | Junto al hook que lo usa |

---

## Output format

Para cada issue encontrado:

```markdown
### ❌/⚠️ [TypeScript] {título}

- **Archivo**: `path/to/file.ts:42`
- **Problema**: {descripción}
- **Regla**: Ver `typescript-patterns/RULE.md` - {sección}
- **Fix**: {código o instrucción concreta}
```

---

## Severidad

| Severidad | Criterio |
|-----------|----------|
| ❌ Blocker | `any` type, `@ts-ignore` sin justificación |
| ⚠️ Warning | Props inline |
| 💡 Suggestion | Podría mejorar tipado pero funciona |
