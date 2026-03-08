---
name: handoff
description: Generate context checkpoint for session handoff or dispatch. Use when ending a session or preparing work for another agent/session.
---

# Handoff Skill

> **Propósito**: Generar context handoff para continuar trabajo en nueva sesión o dispatch.
> **Invocable por**: Cualquier agent/skill al terminar sesión, sparring, executor

---

## Input esperado

- Estado actual del trabajo (ticket, branch, commits)
- Qué se hizo durante la sesión
- Qué queda pendiente
- Decisiones tomadas (si aplica)

---

## Modos de operación

### Modo 1: Chat-to-chat handoff (default)
Output el handoff en el chat para copy/paste a nueva conversación.

### Modo 2: Dispatch handoff
Cuando el usuario dice "aprobado" o "dispatch ready":
1. Escribir `HANDOFF.md` en el directorio del spec
2. Mostrar el comando de dispatch

---

## Output format (MANDATORY)

```markdown
## Estado actual {TICKET}

**Worktree:** `{path or "pending creation"}`
**Branch:** `{branch name or "feature/{TICKET}-{description}"}`
**Spec:** `{path to spec}`

### ✅ Lo que se hizo

{List of commits or changes made, bullet points}

### 🔄 Pendiente

{What remains to be done, numbered list}

### 📋 Próximos pasos

{Concrete next actions with commands if applicable}

### 🧠 Decisiones tomadas

{Key decisions made during the session, if any}

### ❓ Preguntas abiertas

{Unresolved questions, if any}

### Notas técnicas relevantes

{Technical details the next agent needs to know}
```

---

## Rules

1. **BE CONCISE** — Solo incluir lo relevante para continuar
2. **ASSUME THE NEXT AGENT HAS THE SPEC** — No repetir contenido del spec
3. **INCLUDE COMMANDS** — Si hay próximos pasos con comandos, mostrarlos listos para copiar
4. **SKIP EMPTY SECTIONS** — Si no hay preguntas abiertas, no incluir esa sección
5. **GIT STATE IS CRITICAL** — Siempre incluir: branch, commits (pushed o no), worktree path
6. **NO FLUFF** — Sin saludos ni explicaciones, solo el output estructurado

---

## Dispatch workflow (Mode 2)

Cuando el usuario aprueba el spec y quiere despachar al executor:

1. **Escribir HANDOFF.md** en el directorio del spec:
   ```
   ~/specs/manos/{EPIC}/slices/{TICKET}/HANDOFF.md
   ```

2. **Mostrar comando de dispatch**:
   ```bash
   ~/toolkit/scripts/tk-dispatch.sh {TICKET} {description}
   ```

3. **Confirmar** que el archivo fue escrito y recordar al usuario ejecutar el comando.

---

## Ejemplo de invocación

**Modo 1 (chat-to-chat)**:
```
User: "generá handoff para continuar mañana"

Skill output:
## Estado actual FPFX-513

**Worktree:** `~/manos-FPFX-513-boards-refactor`
**Branch:** `feature/FPFX-513-boards-refactor`
**Spec:** `~/specs/manos/Boards/slices/FPFX-513/FPFX-513.spec.md`

### ✅ Lo que se hizo
- Implementado componente BoardCard
- Tests unitarios agregados
- 2 commits (no pusheados)

### 🔄 Pendiente
1. Integrar con API de boards
2. Agregar loading states

### 📋 Próximos pasos
```bash
cd ~/manos-FPFX-513-boards-refactor
git push -u origin feature/FPFX-513-boards-refactor
```
```

**Modo 2 (dispatch)**:
```
User: "aprobado, dispatch ready"

Skill output:
✅ Handoff guardado en: ~/specs/manos/Boards/slices/FPFX-513/HANDOFF.md

Para despachar al ejecutor:
```bash
~/toolkit/scripts/tk-dispatch.sh FPFX-513 boards-refactor
```
```
