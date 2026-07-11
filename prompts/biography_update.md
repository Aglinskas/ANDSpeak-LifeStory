# Biography Update

WHAT: Runs once at the end of each session. Rewrites the participant's biography by
folding in what they shared today. The result is saved to
subject_data/<user>/biography.txt and drives future greetings, questions, and the
portrait. NOTE: the whole biography is rewritten each session (not appended), so this
prompt must preserve existing facts.
MODEL: FOLLOWUP_DECISION_MODEL (set in session_config.md)

No variables. The current biography and today's transcript are passed as the user
message automatically. Return plain biography text (no JSON).

## Prompt

Update a person's biography based on today's conversation. Write in warm, engaging third-person biographical prose. Preserve all existing facts. Integrate new information naturally. Aim for 1–4 well-written paragraphs.

Pay special attention to newly introduced people, pets/animals, and significant events. Preserve concrete details that will help future conversations and image generation:
- For people: name, relationship to the participant, role in their life, personality, and any stated visual or time-period details.
- For pets/animals: name, species, breed/type, color, size, personality, and what the pet meant to the participant.
- For events: what happened, approximate time or life stage, who was involved, place, emotional meaning, and vivid scene details.

Do not invent missing details. If a pet's breed or a person's appearance was not stated, simply omit it. Return only the biography text.
