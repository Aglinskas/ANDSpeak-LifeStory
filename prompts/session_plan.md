# Session Plan

WHAT: Runs once at the start of each session. Generates the opening greeting and
the pool of 8–10 biographical questions for the whole session.
MODEL ROLE: `question_preparation` (set in `openai_models_used.json`)
ALSO SEES: agent_personality.md and the whole of session_config.md (topic areas,
opening-question guidance, etc.) are prepended automatically — edit those for the
bulk of the behavior. This file is just the task framing + output format.

Variables the app fills in:
  $user_id      – the participant's name
  $session_num  – which session this is (1 = first ever)

Keep the JSON structure exactly as written — the app parses it.

## Prompt

Your task: generate a session plan for $user_id's conversation (session #$session_num).

Return ONLY valid JSON with this exact structure:
{
  "greeting": "...",
  "questions": [
    {
      "text": "...",
      "brief_description": "...",
      "opening_lead_in": "...",
      "topic": "childhood|family|education|work|relationships|friends|home|hobbies|travel|life_events|values|current_life",
      "mode": "deepen_existing|new_direction",
      "keywords": ["short", "person-specific", "terms"],
      "source": "brief note: what known biography detail this builds on, or 'biography gap'",
      "fills_gap": "brief note: what this question would add to the biography",
      "sensitivity": "low|medium|high"
    }
  ]
}

The app selects an opening from the question pool using recent-opening history.
For every question, write an `opening_lead_in` that could be spoken immediately
before that question if it is selected. Make it warm and personal, use their
name, and let it flow naturally into that question. It should not ask a separate
question of its own. For session 1, briefly introduce yourself and say that they
can choose another subject if they prefer. For later sessions, briefly recall a
known detail connected to that question so they feel remembered, while also
making clear that they may choose another subject. Do not repeat the full
question in the lead-in. Set the top-level `greeting` to the same text as
`questions[0].opening_lead_in` for backwards compatibility.

The questions array is a pool of 8–10 biographical questions ordered by natural
conversation flow, prioritising gaps in the existing biography. `questions[0]`
is your preferred opening question, so it must be easy, low-sensitivity, and
inviting. Recent opening questions may be supplied with the participant context.
Do not repeat or closely paraphrase them at the start, and rotate away from their
most recent topics when another gentle direction is available.

Build the question pool like a good biographer, not like a checklist. Include a
balanced mix:
- About half should deepen something already present in the biography, using a
  concrete remembered detail.
- About half should open a new direction or fill an obvious gap in the life
  story.
- Cover different broad areas of a life: where they were born or grew up, age
  and life stage, childhood, parents and family, education, work, partner or
  children, friends, significant life events, hobbies, goals, values, philosophy,
  and current life.
- Do not cluster adjacent questions in the same broad topic. For example, do
  not put three family questions in a row. If one question is about a parent,
  the next prepared question should usually be about work, education,
  relationships, current life, values, hobbies, or another distinct area.
- Avoid over-focusing on the first vivid facts in the biography. Use them, but
  also look for missing parts of the biography that would make the life story
  fuller.
- Put person-specific words in `keywords`, not in `topic`. Good keywords are
  names, places, roles, hobbies, pets, schools, jobs, cities, and distinctive
  objects from this person's biography or from the biography keyword hints. For
  example, use `topic: "work"` and keywords like a profession or workplace; use
  `topic: "travel"` and keywords like specific cities or countries.

Each question should stand alone naturally if asked later in the conversation.
Ask only one question at a time. Keep the wording spoken, warm, and concise.

For every question, write a `brief_description` for a topic-choice button. It
must be a concrete, participant-friendly subject label of about 3–7 words, not a
question or a sentence. Use recognizable details when helpful (for example,
"School memories in Lithuania", "Moving to Bangor", or "Current hobbies").
Keep descriptions distinct from one another and avoid unnecessarily exposing
sensitive details.
