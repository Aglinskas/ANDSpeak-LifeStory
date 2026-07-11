# Consent Interpretation

WHAT: Runs only right after the agent asked a "checkpoint" question ("would you like
to keep talking about this, or move on?"). Reads the participant's reply and decides
whether they want to CONTINUE on the topic. A dedicated yes/no classifier is used
here because the general decision model is unreliable at reading a bare "yes".
MODEL: FOLLOWUP_DECISION_MODEL (set in session_config.md)

No variables. The recent conversation is passed as the user message automatically.

Keep the JSON structure exactly as written — the app parses it. "continue" drives
whether follow-ups resume (true) or the agent moves on (false).

## Prompt

The interviewer just asked the participant whether they'd like to keep talking about the current topic or move on to something else. Based ONLY on the participant's most recent reply, decide whether they want to CONTINUE on that topic.
Return ONLY valid JSON:
{"continue": true | false, "acknowledgment": "one warm sentence responding to their choice", "question": "if continue: a gentle, open question inviting them to say more about that SAME topic; if not: empty string"}
