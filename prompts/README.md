# Editable LLM Prompts

Every instruction the app sends to an LLM lives in a plain-text file you can edit.
Change a file, save, and it takes effect on the **next turn — no restart needed**
(files are re-read on every call).

## How a prompt file is structured

- Everything **above** the `## Prompt` line is notes for you and is NOT sent to the model.
- Everything **below** `## Prompt` is the actual instruction text.
- `$variables` (e.g. `$followup_depth`) are filled in by the app. Each file's notes
  list which variables it has. An unknown `$word` is left untouched, so ordinary `$`
  is usually fine — but avoid stray `$name` patterns you don't intend as variables.
- If a file is deleted or emptied, the app falls back to the last version that loaded
  successfully this run, so a bad save won't kill a live session.

## The conversation prompts (this folder)

| File | When it runs | Model |
|------|--------------|-------|
| `session_plan.md`           | start of each session — greeting + question pool | QUESTION_PREPARATION_MODEL |
| `turn_interpretation.md`     | early each turn — answer vs topic decline vs topic change vs biography question | FOLLOWUP_DECISION_MODEL |
| `followup_decision.md`      | every turn — follow-up vs move-on, significance, memory acknowledgment | FOLLOWUP_DECISION_MODEL |
| `consent_interpretation.md` | after a "keep talking or move on?" checkpoint — reads the yes/no | FOLLOWUP_DECISION_MODEL |
| `biography_update.md`       | end of each session — rewrites the biography | FOLLOWUP_DECISION_MODEL |

`session_plan.md` returns structured question objects (`text`, `topic`, `mode`,
`keywords`, `source`, `fills_gap`, `sensitivity`). The server still accepts old
plain-string questions, but topic-aware selection works best when the structured
fields are present. Keep `topic` broad and generic; put person-specific names,
places, professions, hobbies, pets, schools, jobs, and cities in `keywords`.

## The image prompts (in `../portrait_generation.md`)

All portrait/image text lives in one file at the repo root, `portrait_generation.md`,
because it also holds the image settings and shared art style:

- `## Settings` — model, size, quality, etc. (`KEY = value` lines)
- `## Instructions` — the shared Ghibli art style (prepended to every image prompt)
- `## Scene Brief Rules` — turns the biography into a scene description (text model)
- `## Base Portrait` — the one-time locked portrait of the person
- `## Scene` — the per-session scene built around them

## Numbers / models (in `../session_config.md`)

- `QUESTION_PREPARATION_MODEL`, `FOLLOWUP_DECISION_MODEL` — which OpenAI models
- `MAX_TURNS` — hard cap on turns per session
- `MAX_FOLLOWUP_DEPTH` — default follow-ups before moving on (consent can extend)

## What stays in code (server.py) — and why

The *wording and judgments* are here in the files; the *enforcement* is in code, on
purpose. The follow-up cap, the checkpoint/consent routing, and JSON parsing live in
`server.py` (`next_question`) because the model can't be trusted to reliably count or
gate itself. Editing the prompt files changes how the model *judges*; it cannot break
those safety limits. To change the limits themselves, edit `session_config.md`.
