---
name: react-patterns
description: Verify React code follows Manos patterns. Use when reviewing hooks, effects, data fetching, or state management decisions.
---

# React Patterns Skill

> **Propósito**: Verificar que el código React siga los patterns del proyecto Manos.
> **Fuente de verdad**: `~/toolkit/templates/rules/react-patterns/RULE.md`
> **Invocable por**: pr-reviewer, executor, cualquier agent/skill

---

## Input esperado

Archivos `.tsx` / `.ts` del PR que contengan componentes React o hooks.

---

## Checklist de verificación

### 1. Data Fetching

| ❌ Incorrecto | ✅ Correcto |
|---------------|-------------|
| `useState` + `useEffect` para API data | TanStack Query (`useQuery`) |
| Fetch manual en `useEffect` | Query con `queryFn` |
| Loading/error state manual | Estados de Query (`isLoading`, `error`) |

**Ejemplo de violación:**
```typescript
// ❌ BAD
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
useEffect(() => {
  fetchData().then(setData).finally(() => setLoading(false));
}, []);

// ✅ GOOD
const { data, isLoading } = useQuery({
  queryKey: ['resource'],
  queryFn: fetchData,
});
```

### 2. State Placement

| Tipo de estado | Herramienta correcta |
|----------------|---------------------|
| Server/API data | TanStack Query |
| Shared client state | Zustand store |
| Local UI state | `useState` |

**Red flag:** Datos de API guardados en `useState` o Zustand.

### 3. useEffect Usage

| ❌ Prohibido | ✅ Permitido |
|--------------|-------------|
| Data fetching | Subscriptions (websocket, events) |
| Deps deshabilitadas (`// eslint-disable`) | Sync con sistemas externos |
| Transformar data (usar `useMemo`) | Cleanup operations |

**Ejemplo de violación:**
```typescript
// ❌ BAD - Fetching in useEffect
useEffect(() => {
  fetchUsers().then(setUsers);
}, []);

// ❌ BAD - Disabled deps
useEffect(() => {
  doSomething(props.value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// ❌ BAD - Transform in effect (use useMemo)
useEffect(() => {
  setFilteredUsers(users.filter(u => u.active));
}, [users]);
```

### 4. Memoization

| Cuándo usar | Cuándo NO usar |
|-------------|----------------|
| Cálculos costosos | Valores primitivos |
| Objetos/arrays pasados a children memoizados | "Por las dudas" |
| Callbacks pasados a children | Cálculos simples |

**Red flag:** `useMemo` para primitivos o cálculos triviales.

### 5. Hook Extraction

| Señal | Acción |
|-------|--------|
| Componente > 400 líneas | Extraer lógica a custom hook |
| Lógica de estado compleja | Mover a `hooks/useFeatureLogic.ts` |
| Lógica repetida en 2+ componentes | Extraer hook compartido |

---

## Output format

Para cada issue encontrado:

```markdown
### ❌/⚠️ [React Patterns] {título}

- **Archivo**: `path/to/file.tsx:42`
- **Problema**: {descripción}
- **Regla**: Ver `react-patterns/RULE.md` - {sección}
- **Fix**: {código o instrucción concreta}
```

---

## Severidad

| Severidad | Criterio |
|-----------|----------|
| ❌ Blocker | useState + useEffect para API data, deps deshabilitadas |
| ⚠️ Warning | Memoization innecesaria, componente grande sin extraer |
| 💡 Suggestion | Oportunidad de mejorar pero no viola regla |
