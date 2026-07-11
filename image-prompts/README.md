# Cognitive Assessment Image Generator Guide

This workspace contains custom-generated line drawings designed for clinical picture-description tasks (similar to the Boston Diagnostic Aphasia Examination's "Cookie Theft" task). It also includes the generation prompts and analytical target checklists for clinical scoring.

---

## Workspace Directory Structure

* [cognitive_assessment_scene.png](file:///Users/aidasaglinskas/Desktop/ANDSpeak-prompt-images/cognitive_assessment_scene.png) & [cognitive_assessment_scene.md](file:///Users/aidasaglinskas/Desktop/ANDSpeak-prompt-images/cognitive_assessment_scene.md) — Scene 1: Board game interaction with parallel chaotic events.
* [cognitive_assessment_scene_2.png](file:///Users/aidasaglinskas/Desktop/ANDSpeak-prompt-images/cognitive_assessment_scene_2.png) & [cognitive_assessment_scene_2.md](file:///Users/aidasaglinskas/Desktop/ANDSpeak-prompt-images/cognitive_assessment_scene_2.md) — Scene 2: Kitchen spill with parallel mishaps.
* [cognitive_assessment_scene_3.png](file:///Users/aidasaglinskas/Desktop/ANDSpeak-prompt-images/cognitive_assessment_scene_3.png) & [cognitive_assessment_scene_3.md](file:///Users/aidasaglinskas/Desktop/ANDSpeak-prompt-images/cognitive_assessment_scene_3.md) — Scene 3: Garage workshop with parallel mishaps.
* [cognitive_assessment_scene_4.png](file:///Users/aidasaglinskas/Desktop/ANDSpeak-prompt-images/cognitive_assessment_scene_4.png) & [cognitive_assessment_scene_4.md](file:///Users/aidasaglinskas/Desktop/ANDSpeak-prompt-images/cognitive_assessment_scene_4.md) — Scene 4: Interlinked kitchen splash chain-reaction.
* [cognitive_assessment_scene_5.png](file:///Users/aidasaglinskas/Desktop/ANDSpeak-prompt-images/cognitive_assessment_scene_5.png) & [cognitive_assessment_scene_5.md](file:///Users/aidasaglinskas/Desktop/ANDSpeak-prompt-images/cognitive_assessment_scene_5.md) — Scene 5: Interlinked living room picture frame chain-reaction.

---

## How to Create More Assessment Images

When generating new images using text-to-image AI tools (like Midjourney, DALL-E, or Imagen), follow these design principles to ensure they are suitable for cognitive and speech assessment:

### 1. Visual Style & Aesthetic Guidelines
Clinical assessments require clear, uncluttered images so that subjects are not distracted by lighting, textures, or colors. Use these parameters in your prompt:
* **Color:** Strictly `black and white line drawing` or `clinical outline art style`.
* **Background:** `white background` with `no colors`, `no grayscale shading`, and `no complex fills`.
* **Outlines:** `clean outlines`, `high contrast`, and `simple cartoon outline art`. This ensures that key items (like spilling liquid or falling objects) are immediately distinguishable.

### 2. Narrative Structure & Causal Design
A good clinical scene should not just be a static picture; it must prompt the viewer to tell a story containing verbs, causal links, and inferences.
* **Parallel Mishaps (Easier):** A central character is doing an activity while oblivious to 2 or 3 separate, independent mishaps occurring around them (e.g., Scene 2 where the father rolls dough while a boy climbs books and a girl spills flour).
* **Interlinked Chain-Reactions (Harder):** One person's minor error triggers a sequence of physical reactions that affects everyone in the scene (e.g., Scene 5 where a wagon snags a lamp $\rightarrow$ falls on mother $\rightarrow$ drops teacups $\rightarrow$ one cup hits ladder $\rightarrow$ father drops picture $\rightarrow$ startles dog). This forces the subject to construct complex sentences using conjunctions (e.g., *because*, *so*, *then*).

### 3. Prompt Blueprint Template
Use this template to write prompts for new scenes:

> **[Style Prefix]** A clean black and white line drawing, clinical assessment style (no colors, no grayscale shading, clean outlines, white background).
>
> **[Main Setting & Distraction]** In a [room/setting], a [central character] is busy [action], completely oblivious to their surroundings because [distractor, e.g., wearing headphones, looking out window].
> 
> **[Mishap Chain / Actions]** To their left, [character A] is [action leading to mistake A]. In the center, [spill/falling hazard]. To the right, [character B] is [attempting goal B] using [unstable method B, e.g., climbing a wobbly stool], causing [hazard B].
> 
> **[Style Suffix]** Simple line art, high contrast, clean outlines.

---

## Documenting the Clinical Targets

Once you generate an image, write a accompanying `.md` file tracking the **Clinical Targets**. This is useful for clinicians to score responses. Organize the targets into:
1. **Characters & Interaction:** Who is in the scene and what are they doing?
2. **Causal Loops / Mishaps:** What are the logical chains of events? (e.g., "Why is the book tower falling?")
3. **Background/Clutter Details:** Minor details that test high-level visual scanning (e.g., text labels, clocks, animals, scattered items).
