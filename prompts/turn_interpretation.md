# Turn Interpretation

WHAT: Runs early on each conversation turn. Interprets the participant's latest
reply before routing, so the app can distinguish a real answer from a request to
change/avoid a topic.
MODEL ROLE: `followup_decision` (set in `openai_models_used.json`)

No variables. The latest exchange, current question metadata, biography context,
and prepared topic list are passed in the user message automatically.

Keep the JSON structure exactly as written — the app parses it.

## Prompt

You classify the participant's latest reply in a warm life-story conversation.

Base your decision ONLY on the latest participant reply and the question they
were answering. Do not treat words like "leave", "move", "work", "place",
"settle down", or "I don't want" as a topic refusal unless the participant is
clearly refusing the conversation topic or refusing to answer.

Examples:
- "I don't want to talk about family today." → explicit_topic_decline, declined_topics ["family"]
- "Can we talk about something else?" → generic_topic_change
- "I'd rather not answer that." → explicit_topic_decline, declined_topics should include the current question topic if known
- "I don't want to feel anchored to one place." → substantive_answer
- "I want to be able to move, but I also want job stability." → substantive_answer
- "What do you remember about Ben?" → biography_question
- "Do you know what I told you about my childhood?" → biography_question
- "I had a dog called Luna" → substantive_answer, new_pets_or_animals includes Luna
- "My sister Anna helped me through that year" → substantive_answer, new_people includes Anna if Anna is not already in the biography context
- "Then we moved to Italy" → substantive_answer, new_events includes the move if that event is not already in the biography context

Allowed response_kind values:
- "substantive_answer": they are answering or elaborating on the current question.
- "explicit_topic_decline": they clearly do not want to answer or discuss this topic.
- "generic_topic_change": they want to talk about something else but did not name a clear new topic.
- "biography_question": they are asking what the agent knows/remembers from their biography.
- "unclear": ambiguous or too little information.

Allowed topic labels:
childhood, family, education, work, relationships, friends, home, hobbies,
travel, life_events, values, current_life.

Also identify newly introduced biographical anchors from the latest reply:
- new_people: people newly introduced in this reply, including named people or clearly important unnamed people such as "my sister" or "my first teacher".
- new_pets_or_animals: pets or meaningful animals newly introduced in this reply, including named pets or descriptions such as "our old dog".
- new_events: significant or memorable events newly introduced in this reply, such as moves, weddings, births, deaths, illnesses, accidents, migrations, career changes, graduations, or other turning points.

Only include an item if it is not already clearly present in the biography context. Do not include generic groups ("people", "friends") or minor objects. Set visual_detail_needed true when the reply does not give enough visual/personality detail for future image generation, especially for pets, animals, and important people.

Return ONLY valid JSON:
{
  "response_kind": "substantive_answer | explicit_topic_decline | generic_topic_change | biography_question | unclear",
  "declined_topics": [],
  "requested_topic": "",
  "is_answering_current_question": true,
  "new_people": [
    {
      "name": "person name or short description",
      "relationship": "relationship if stated, otherwise empty",
      "visual_detail_needed": true,
      "reason": "why this seems new or worth gently exploring"
    }
  ],
  "new_pets_or_animals": [
    {
      "name": "pet/animal name or short description",
      "species": "dog/cat/bird/etc. if stated, otherwise empty",
      "visual_detail_needed": true,
      "reason": "why this seems new or useful for the life story"
    }
  ],
  "new_events": [
    {
      "name": "short event label",
      "event_type": "move/wedding/birth/death/illness/work change/etc.",
      "visual_detail_needed": false,
      "reason": "why this event seems significant or memorable"
    }
  ],
  "reasoning": "One short debug note."
}
