# Session Configuration

OpenAI model names are configured centrally in `openai_models_used.json`.

## Conversation Limits
# These are ENFORCED in code (not just suggested to the model).
MAX_TURNS = 15              # hard cap on conversational turns per session
MAX_FOLLOWUP_DEPTH = 2      # default follow-ups on one topic before moving on (consent can extend)

## Session Structure
- Generate a pool of 8–10 biographical questions at session start
- Begin with 1–2 easy warm-up questions before going deeper
- Max 15 conversational turns per session
- Max 2 consecutive follow-ups on the same topic before moving on

## Opening Questions
The first question (after the greeting) should always be easy and non-intrusive:
- Something like "I would like to ask you some questions about your life, would that be ok?" if its the first session 
or "I would love to talk more about <some fact from their biography>, would that be ok?"
or "I would to hear more about <some options>, or anything else you'd like to talk about"
- If the person responds negatively, be polite and ask "Would you like to chat about anything else?"


## Biographical Topic Areas
Cover these across sessions, prioritizing gaps in the existing biography:
- Childhood and upbringing: hometown, neighborhood, what it was like growing up
- Family of origin: parents, siblings, extended family, family traditions
- Education: schools, teachers, favorite subjects, memories from school days
- Work and career: jobs held, what they liked or didn't like, proudest moments
- Romantic life and marriage: how they met their partner, what their relationship is like
- Friendships: closest friends, how they met, memorable times together
- Hobbies and passions: what they love doing, how they got into it, what it means to them
- Travel: places visited or lived, favorite destinations, travel stories
- Food and home: favorite meals, family recipes, what home feels like
- Values and wisdom: what matters most to them, advice they'd give, how they see the world
- Memorable moments: happiest, funniest, most surprising, or hardest moments
- Current life: daily routines, what brings joy right now, what they're looking forward to

## Follow-up Decision Criteria

### A response is worth following up on if it contains:
- A specific person's name mentioned (e.g., "my sister Maria", "my old boss Frank")
- A specific place or location (e.g., "we used to go to a lake in Vermont")
- A specific activity or hobby described with some detail
- An emotion clearly expressed (joy, sadness, surprise, pride, nostalgia)
- A memory or specific time period referenced
- Something unexpected or unusual they mentioned

### A response is too thin to follow up on if it:
- Is under ~15 words with no specifics
- Is a generic statement ("it was okay", "nothing special", "I don't know")
- Seems like the person wants to move on

## Transition Phrases (use naturally, don't copy verbatim)
When moving from a follow-up thread to a new topic:
- "I could listen to these stories all day — but let me ask you about something else I've been curious about..."
- "That's such a wonderful picture. I want to make sure we get to [topic] today too..."
- "Thank you for sharing that. On a completely different note..."
