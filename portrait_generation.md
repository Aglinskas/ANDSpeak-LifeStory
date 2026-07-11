# Portrait Generation

Controls the biography-portrait that is generated at the end of every session and shown
on the home screen. Edit this file and it takes effect on the next generation — no restart
needed. The `KEY = value` lines below are parsed as settings; everything under
"## Instructions" is sent to the models as guidance.

## Settings

IMAGE_MODEL = gpt-image-1.5
# Options (switch by changing the line above):
#   gpt-image-2      — latest, highest quality (needs account access)
#   gpt-image-1.5    — high quality
#   gpt-image-1      — widely available default
#   gpt-image-1-mini — cheapest / fastest, lower fidelity
IMAGE_SIZE = 1024x1024
# Options: 1024x1024 (square), 1024x1536 (portrait), 1536x1024 (landscape), auto
IMAGE_QUALITY = high
# Options: low (fast drafts), medium, high, auto
PARTIAL_IMAGES = 0
# How many progressive frames to stream while the image renders (0-3). Each partial
# costs a little extra. 2 gives a nice reveal without much added cost.
INPUT_FIDELITY = high
# high = stay faithful to the reference photos / base portrait. low = looser.
BRIEF_MODEL = gpt-5.5-2026-04-23
# The text model that turns the biography into a scene brief.

## Instructions

Create a warm, hand-painted **Studio Ghibli–style** illustration.

**The person is always the centre of the image.** Depict them accurately and respectfully
using the details known about them (age, gender, and any described appearance). If reference
photos are provided, match the person's likeness to those photos. Keep the person's face and
overall look **consistent from session to session** — this is the same person's portrait
growing over time, not a new character each time.

**Populate the scene from their biography, and only from their biography.** If they mention
family, depict those family members near them. If they mention a fond memory of a trip to
Paris, place something evocative of it (e.g. the Eiffel Tower) softly in the background. If
they mention a pet, a hobby, a hometown, or an object that matters to them, include it.

**Do not invent or hallucinate details that are not in the biography.** Do not add people,
places, or objects that were never mentioned. When in doubt, leave the background simple and
uncluttered rather than filling it with imagined detail.

**Let the richness grow with the biography.** The number of surrounding elements should be
roughly proportional to how much the person has shared — a short biography yields a simple
scene with the person and only a few meaningful things; a longer biography yields a fuller,
richer world around them. Evolve the image **slowly and gently** between sessions: keep the
established composition and mood, and add or refine detail rather than redrawing everything.

**Mood:** gentle, nostalgic, soft natural light, painterly. A single cohesive scene, not a
collage.

## Scene Brief Rules

You convert a person's biography into a concise VISUAL SCENE BRIEF for a single illustration. Strict rules:
- The person is the centre of the scene. Describe their appearance only from stated age, gender and any described traits.
- Only depict things explicitly mentioned in the biography. Never invent people, places or objects.
- This biography has $paragraphs paragraph(s); include roughly $elements distinct surrounding element(s) (people, places, objects they mentioned). Fewer is fine; do not pad.
- Keep it a single cohesive scene. Output 4-8 sentences of plain description.

## Base Portrait

A single centred character portrait of the person described below, plain soft background, no other people or scene elements. This is a reference portrait to keep the person's look consistent in future images.

$brief

## Scene

SCENE BRIEF:
$brief

Keep the central person's face and appearance consistent with the reference portrait provided. Build the surrounding scene from the brief only.
