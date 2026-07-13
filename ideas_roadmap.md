# ANDSpeak LifeStory Ideas Roadmap

Potential additions and longer-term directions based on the app's purpose as an engaging longitudinal speech-data collection and life-story platform.

## Participant Experience

1. **Session themes and participant choice**  
   Before each interview, offer several broad topics such as childhood, work, family, travel, traditions, or everyday life. Choice increases agency and reduces repetitive or unwanted questions.

2. **Pause, resume, and skip-question controls**  
   Let participants pause recording, resume later, or skip a question without explaining why. Persist the full conversation state so interrupted sessions remain recoverable.

3. **Editable transcript review**  
   After a response, allow the participant to correct names, places, and transcription mistakes. Store both the original research transcript and the corrected reading version.

4. **Explicit memory correction flow**  
   Add a simple "That's not right" action when the interviewer recalls an incorrect biographical fact. Corrections should update the biography and prevent the incorrect fact from reappearing.

5. **Accessibility modes**  
   Provide larger type, stronger contrast, reduced motion, slower speech, adjustable TTS volume, keyboard navigation, and simplified controls. Save these preferences per user.

6. **Multilingual interviews**  
   Support speaking, transcription, and biographies in the participant's preferred language. Preserve the original transcript while optionally creating a translated researcher copy.

7. **Trusted family contribution**  
   Allow invited relatives to add photos, names, dates, and story prompts with the participant's approval. Clearly distinguish participant-provided facts from family-contributed context.

## Story and Retention

8. **Biography chapters and timeline**  
   Convert the biography into structured chapters such as childhood, education, work, relationships, places, and later life. Also provide a navigable life timeline rather than only a prose document.

9. **Participant-controlled biography editor**  
   Let users edit, hide, reorder, or remove biography passages. AI-generated content should remain an editable draft, not an authoritative record.

10. **Memory map**  
    Plot meaningful places on an interactive map and connect them to stories, people, images, and sessions. Selecting a place could suggest future interview topics.

11. **People and relationships view**  
    Build a private directory of people and pets mentioned in interviews, including relationships and associated memories. This would also improve question generation and portrait accuracy.

12. **Photo-guided reminiscence sessions**  
    Let participants upload or photograph an object, person, or location. The interviewer can use it as a grounded conversation prompt while recording the resulting story.

13. **Life-story book generation**  
    Turn the biography, timeline, selected quotes, and generated images into an editable print-ready book or PDF. Include participant approval before anything is exported or shared.

14. **Audio memoir mode**  
    Produce a browsable collection of short audio stories, preserving the participant's own voice alongside the written biography. Family members could hear individual memories rather than only read summaries.

15. **Milestones and gentle rituals**  
    Mark meaningful progress such as ten sessions, completion of a chapter, or the first story about a major life period. Avoid competitive streaks that could pressure vulnerable participants.

## Conversation Quality

16. **Structured biography memory instead of prose-only memory**  
    Maintain a factual store alongside `biography.txt`, containing people, places, dates, relationships, confidence, source session, and correction history. Generate prose from this structured record to reduce contradictions and lost facts.

17. **Question coverage planner**  
    Track which life periods and topics are well covered, lightly covered, declined, or untouched. Use this coverage map to create balanced sessions without repeatedly asking similar questions.

18. **Uncertainty-aware interviewer**  
    Require the agent to phrase uncertain recollections carefully, such as "I may be remembering this incorrectly." Facts should carry confidence and provenance rather than being treated as equally reliable.

19. **Emotional-safety layer**  
    Detect possible distress, confusion, bereavement, or fatigue and respond conservatively: acknowledge, offer to change topics, pause, or end. Avoid diagnosis and provide researcher-defined escalation instructions where appropriate.

20. **Personal interviewer styles**  
    Offer restrained modes such as warm companion, concise interviewer, reflective listener, or low-stimulation mode. Personalization should affect delivery while research-critical session rules remain fixed.

## Research and Data Quality

21. **Pre-session hardware and environment check**  
    Test microphone level, clipping, background noise, echo, and connection quality before recording. Prompt the participant to move closer or choose a quieter location when necessary.

22. **Passive recording-quality metadata**  
    Save non-diagnostic measures such as signal-to-noise ratio, packet loss, clipping, silence duration, browser version, microphone identity, and interruptions. These help researchers distinguish cognitive signals from technical artifacts.

23. **Research protocol versioning**  
    Store the exact prompt versions, models, settings, application revision, and consent version used for every session. This is essential when AI behavior changes during a longitudinal study.

24. **Researcher dashboard and export pipeline**  
    Provide cohort-level session completion, missing-data alerts, recording-quality flags, and standardized exports. Keep the participant-facing experience separate from research administration.

25. **Consent and data-control center**  
    Show what is recorded, why it is collected, how long it is retained, and who can access it. Support granular withdrawal, deletion, export, and separate consent for research, family sharing, and image generation.

26. **Encrypted and immutable raw data**  
    Encrypt sensitive files at rest, maintain audit logs, and preserve untouched source audio and transcripts separately from corrected or processed versions. The current local filesystem approach will become difficult to govern at scale.

## Longer-Horizon Directions

27. **Adaptive longitudinal protocol**  
    Coordinate sessions across months so the app intentionally revisits some comparable prompts while also exploring new material. This could improve scientific consistency without making conversations feel repetitive.

28. **Participant-specific voice interviewer**  
    Develop a stable interviewer voice and conversational manner that remains consistent across years. Consistency may improve trust and reduce unwanted variation in the research protocol.

29. **Multimodal story archive**  
    Combine speech, photographs, scanned letters, home videos, maps, music, and generated illustrations into a private interactive life archive grounded entirely in participant-approved material.

30. **Conversational digital legacy**  
    With explicit, separate consent, create an interactive archive through which family members can ask questions and receive answers grounded in approved biography passages and original audio clips. It should cite the source memories and refuse to invent answers.

## Recommended Near-Term Priorities

The strongest near-term investments are:

- Structured biographical memory
- Transcript and factual correction
- Accessibility improvements
- Pre-session recording-quality checks
- Research protocol versioning
- Stronger consent and data controls

These improve participant trust and research validity before the product expands into more ambitious storytelling features.
