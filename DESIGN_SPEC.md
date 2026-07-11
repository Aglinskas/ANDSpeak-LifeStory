# ANDSpeak PatientApp V2 — Design & Implementation Spec

## 1. Purpose and Research Context

ANDSpeak is a clinical research tool for collecting longitudinal speech samples from individuals at risk of dementia or cognitive decline. The core scientific premise is that speech patterns change measurably as cognition declines — changes in prosody, fluency, lexical diversity, and response latency can serve as early biomarkers.

The app's job is **data collection**, not analysis. It records audio, transcribes speech with timestamps, and stores everything in a structured format for downstream acoustic analysis by separate research pipelines. The app itself does not compute biomarkers.

The defining challenge is **participant retention**. Biomarker research requires repeated sessions over months. Most clinical collection tools are sterile and transactional — patients stop using them. ANDSpeak's strategy is to make sessions genuinely rewarding by building something patients care about: their personal biography.

---

## 2. Core Design Philosophy

### 2.1 Engagement over clinical aesthetic

The target user is 50+ years old, non-technical, and has no intrinsic motivation to help a research study. The app must feel like something they want to open every day. Every design decision — visual polish, conversational warmth, the biography feature — exists to answer the question: *why would someone do this tomorrow?*

This means:
- The UI looks like a high-quality iPhone consumer app, not a medical interface
- Language is warm and personal, never clinical
- Progress is visible and tangible (biography grows, session count climbs)
- Sessions feel like pleasant conversations, not tests

### 2.2 The biography as the product

The "Story of My Life" feature is the central retention mechanism. After each session, an LLM reads the patient's biography file and the day's transcript, then updates the biography to incorporate new details shared. Over time, participants accumulate a rich, readable life story — something they can print, share with family, or simply enjoy reading.

This creates a positive feedback loop: the more sessions completed, the better the biography. Participants have a concrete, personal reason to return.

### 2.3 Minimum viable friction

Sessions should take approximately 5 minutes and require the patient to speak at least 500 words. The 500-word threshold (not a fixed time limit) ensures consistent speech volume across speakers regardless of pace. The app measures time and words live so patients can see their progress.

No tasks should be hard. The microphone starts automatically. Questions are conversational. The only action required is clicking "Proceed" when done answering.

### 2.4 iPhone form factor in a browser

The app runs in a web browser (served from a local Flask server) but visually mimics an iPhone app — rendered inside an iPhone 14 Pro frame mockup at 390×844px. This is intentional: it creates a focused, phone-like experience even on a desktop, and is consistent with how participants may eventually use it (on an actual iPad or mounted tablet). All UI is designed for touch-friendly tap targets and large readable text.

---

## 3. Screen Flow

```
App loads
    ↓
[ HOME SCREEN ]
  - Session count
  - Biography paragraph count
  - "Start Today's Session" button
    ↓
[ CHAT SCREEN ]
  - Chatbot asks questions via TTS
  - Patient speaks; transcript appears in real-time
  - Audio waveform animates while speaking
  - Timer + word counter in header
  - "Proceed" → next question
  - "Finish Session" appears on last question OR when 500 words reached
    ↓
[ FINISH SCREEN ]
  - "Thank you for sharing your story today"
  - Summary: duration, words spoken, biography paragraphs
  - "Back to Home" → returns to home and refreshes stats
```

There is currently no authentication screen. The app is hardcoded to a single user (`Aidas`). Auth is a planned future feature.

---

## 4. Features: Current MVP

### 4.1 Homepage

Displays two live statistics fetched from the server:
- **Sessions completed** — running count of finished sessions
- **Biography paragraphs** — number of paragraphs currently in the biography file

These are the primary engagement metrics. A patient who sees "12 sessions / 8 biography paragraphs" has a clear sense of progress and something to protect.

### 4.2 Biographical question generation (GPT-5-nano)

At session start, the server reads the patient's `biography.txt` file and passes it to GPT-5-nano with a system prompt asking for 5–7 conversational biographical questions. The model is instructed to:
- Fill gaps in the existing biography
- Deepen areas already mentioned
- Vary topics across childhood, family, relationships, work, hobbies, values, memories

If the biography is empty (first session), the model is told to start with foundational questions about upbringing and family.

The first question is always hardcoded: *"Hello! How are you feeling today?"* — this provides a warm, consistent opener and a brief mood-check that is itself useful biomarker data.

Generated questions are returned as a JSON array and stored in the frontend as `state.questions`.

### 4.3 Text-to-speech (TTS)

Each chatbot question is spoken aloud using OpenAI's TTS API (`tts-1`, voice: `alloy`). The audio is cached server-side by MD5 hash of the text so repeated questions don't re-call the API.

During TTS playback, the transcript textarea is disabled and the waveform dims — the patient cannot proceed until the question has been read.

### 4.4 Real-time transcription (OpenAI Realtime API)

**Target implementation:** OpenAI Realtime API via WebRTC.

The browser creates an `RTCPeerConnection`, adds the microphone audio track, and creates an `oai-events` data channel. The SDP offer is sent to our Flask server's `/api/realtime-sdp` endpoint, which proxies it to OpenAI's `/v1/realtime/calls?model=gpt-realtime-2` endpoint using the server-side API key. The SDP answer is returned to the browser to complete the WebRTC handshake.

After connection, we send a `session.update` event configuring:
- `type: "realtime"` (required field)
- `input_audio_transcription: { model: "whisper-1" }` — enables transcription of user audio
- `turn_detection: { type: "server_vad" }` — OpenAI detects speech automatically

Expected transcription events:
- `conversation.item.input_audio_transcription.delta` — streams partial transcription during speech
- `conversation.item.input_audio_transcription.completed` — final transcript when the patient pauses

**Current status:** The WebRTC connection succeeds and audio flows. The `session.update` was initially rejected due to a missing `type` field (now fixed). Transcription deltas are not yet appearing — this is the active debugging issue.

**Fallback note:** If the Realtime API transcription proves unreliable, the codebase is structured to make it easy to switch the transcription approach. The `handleRealtimeEvent()` function in `app.js` is the single integration point — swapping it for a different transcription source (e.g. Web Speech API, or the older VAD+Whisper batch approach that was working) requires only changes to that function and `setupRealtimeTranscription()`.

### 4.5 Audio waveform visualizer

A canvas-based animated sine-wave visualizer runs throughout the session. Three overlapping waves (blue, cyan, purple) animate via `requestAnimationFrame`. Wave amplitude is driven by the microphone RMS volume level measured via `AudioContext` + `AnalyserNode`. When the chatbot is speaking (textarea disabled), waves are muted to low amplitude. When the patient speaks, waves respond to voice volume.

This gives patients a visual confirmation that they are being heard — important for trust and usability.

### 4.6 Session timer and word counter

The chat header shows:
- **Timer** (`MM:SS`) — elapsed time since session started
- **Word counter** — total words spoken by the patient so far this session

Both update in real-time. The word counter drives the session-end logic: when the patient reaches 500 words, the "Proceed" button changes to "Finish Session" regardless of how many questions remain.

### 4.7 Session recording

The full session audio is captured via `MediaRecorder` in the browser. Chunks are accumulated in `state.sessionChunks`. At session end:
1. Chunks are assembled into a single `Blob`
2. Sent to `/api/save_session` as multipart form data
3. Server saves as raw `.webm`, then converts to `.mp3` via FFmpeg
4. Timestamped transcript is saved as `.csv` with columns: Question Number, Timestamp, Speaker, Text

Both files are saved to the logged-in user's `subject_data/<username>/output/` directory with a timestamp filename (e.g. `session_20260702_143022.mp3`).

The CSV captures chatbot questions and patient responses with session-relative timestamps (HH:MM:SS from session start). This is the primary data format for downstream biomarker analysis.

### 4.8 Biography update (GPT-5-nano)

After the session is saved, the full transcript is sent to `/api/update-biography`. GPT-5-nano is given:
- The current `biography.txt` content
- The full Q&A transcript from today's session

It is instructed to return an updated biography in warm third-person prose, integrating new information naturally. The file is overwritten with the result.

The session counter in `stats.json` is also incremented here.

---

## 5. Technical Architecture

### 5.1 Stack overview

| Layer | Technology |
|---|---|
| Backend | Python 3, Flask |
| Frontend | Vanilla HTML/CSS/JavaScript (no framework) |
| Audio recording | Web MediaRecorder API |
| Audio visualization | Web Audio API (AnalyserNode + Canvas) |
| Transcription | OpenAI Realtime API (WebRTC) |
| TTS | OpenAI TTS API (`tts-1`) |
| LLM (questions + bio) | OpenAI GPT-5-nano |
| Audio conversion | FFmpeg (server-side) |
| Data storage | Local filesystem |

### 5.2 File structure

```
ANDSpeak-PatientApp-V2/
├── server.py                  # Flask backend — all API routes
├── static/
│   ├── index.html             # Single-page app shell, all 3 screens
│   ├── style.css              # All styles (iPhone frame, screens, components)
│   └── app.js                 # All frontend logic
├── subject_data/
│   └── <username>/
│       ├── biography.txt      # Living biography file, updated each session
│       ├── stats.json         # { "session_count": N }
│       ├── agent_messages_audio/ # Cached TTS MP3 files
│       └── output/            # Saved session MP3/CSV files
└── DESIGN_SPEC.md             # This document
```

### 5.3 Backend (server.py)

Flask server running on `http://127.0.0.1:5001`. All routes:

| Route | Method | Purpose |
|---|---|---|
| `/` | GET | Serves `index.html` |
| `/api/stats` | GET | Returns `{ session_count, biography_paragraphs }` |
| `/api/session-plan` | POST | Reads biography → GPT-5-nano → returns question list |
| `/api/realtime-sdp` | POST | Proxies WebRTC SDP offer to OpenAI with API key; returns SDP answer |
| `/api/tts` | POST | Generates/returns cached TTS audio URL |
| `/api/update-biography` | POST | GPT-5-nano updates biography; increments session count |
| `/api/save_session` | POST | Receives audio blob + transcript JSON; saves MP3 + CSV |
| `/api/agent-messages-audio/<filename>` | GET | Serves cached TTS files for the logged-in user |

The API key is loaded from the `OPENAI_API_KEY` environment variable at startup. All OpenAI calls use this key server-side — it is never exposed to the browser. The `/api/realtime-sdp` proxy route exists specifically to keep the key server-side for the WebRTC handshake.

Helper functions `read_biography()`, `read_stats()`, `write_stats()` centralize file I/O for the subject data folder. `USER_ID` and `SUBJECT_DIR` are constants at the top of the file — easy to change when multi-user support is added.

### 5.4 Frontend (app.js)

Single `state` object holds all session state. UI element references are pre-collected into a single `el` object at load time. No framework, no build step — plain JavaScript running directly in the browser.

Key functions and their responsibilities:

**Session lifecycle:**
- `fetchStats()` — called on home screen load; populates session count and paragraph count
- `startSession()` — orchestrates session startup: fetches questions, requests mic, starts MediaRecorder, sets up visualizer, establishes WebRTC, starts timer, asks first question
- `finishSession()` — stops recording, closes WebRTC, saves files, updates biography, shows finish screen
- `goHome()` — tears down audio state, resets all state, returns to home screen

**Chatbot dialogue:**
- `askCurrentQuestion()` — adds chatbot message to chat, plays TTS, disables input during playback
- `enablePatientTurn()` — re-enables textarea and button after TTS ends
- `handleProceed()` — saves patient response, increments word count, advances to next question or calls `finishSession()`

**Transcription:**
- `setupRealtimeTranscription()` — creates RTCPeerConnection, data channel, proxies SDP
- `handleRealtimeEvent(event)` — routes incoming Realtime API events; delta events append to `state.pendingDelta`, completed events finalize a VAD segment into `state.liveTranscriptText`
- `refreshTranscriptUI()` — updates textarea with `liveTranscriptText + pendingDelta`; updates word counter; checks 500-word threshold

**Transcript accumulation design:**
The transcript for the current question accumulates across multiple VAD silence-detected segments. `state.liveTranscriptText` holds finalized segments; `state.pendingDelta` holds the in-flight streaming delta. Both are cleared when the patient clicks Proceed. This means a patient can pause mid-answer (triggering a VAD completion) and keep speaking — all text accumulates naturally in the textarea.

**Audio:**
- `setupVisualizer()` — connects mic stream to AnalyserNode; starts `drawVisualizer()` loop
- `drawVisualizer()` — RAF loop; computes RMS volume; draws 3 animated sine waves
- `teardown()` — stops all audio (MediaRecorder, WebRTC, AudioContext, mic stream); cancels timers

**State reset:**
`resetState()` does a full reset of `state` back to initial values and clears the UI. Called from `goHome()`. Ensures sessions don't bleed into each other.

### 5.5 Frontend (index.html + style.css)

`index.html` is a single page with three screens (`.screen` divs) inside the iPhone frame. Only one screen has the `active` class at a time — CSS transitions handle the crossfade. `showScreen(id)` in `app.js` toggles the `active` class.

CSS custom properties (`--primary`, `--bg-card`, etc.) define the visual theme. The dark blue-purple palette was chosen to feel modern and calm — appropriate for an older audience without being sterile.

The iPhone frame is a pure CSS mockup (`.iphone-frame`, `.iphone-notch`, `.iphone-status-bar`, `.iphone-home-indicator`). No images or assets are needed — the entire frame is HTML and CSS.

---

## 6. Data Design

### biography.txt

Free-form prose, updated by GPT-5-nano after each session. Grows from a few sentences to multiple paragraphs over time. Written in warm third-person biographical style. This file is both the input (informs question generation) and the output (the artifact patients keep) of the system.

Example progression:
- Session 1: "Aidas is a 34-year-old male who likes running and works as a postdoc in neuroscience."
- Session 5: Three paragraphs covering childhood in Lithuania, move to the US for graduate school, close relationship with his sister, and a passion for trail running that started in 2019.

### stats.json

Simple JSON: `{ "session_count": N }`. Incremented by `/api/update-biography` at the end of each session (not by `/api/save_session`) so the count only goes up on fully completed sessions.

### Session CSV format

```
Question Number, Timestamp, Speaker, Text
1, 00:00:05, Chatbot, Hello! How are you feeling today?
1, 00:00:22, Patient, I'm feeling pretty good actually, a bit tired but...
2, 00:01:45, Chatbot, Tell me about where you grew up.
2, 00:02:03, Patient, I grew up in a small city in Lithuania called Kaunas...
```

Timestamps are relative to session start (HH:MM:SS). Both chatbot and patient turns are captured so the downstream analysis pipeline has full context for each response.

---

## 7. Planned Future Features

### 7.1 Authentication

Each user will have their own login. The `USER_ID` constant in `server.py` and the `subject_data/` folder structure already anticipate multi-user support — adding auth is a matter of adding a login screen and making `USER_ID` dynamic based on the session.

Simple local auth (username + PIN) is sufficient for the research context. No OAuth/third-party required initially.

### 7.2 Clinical questionnaires

Validated dementia screening instruments (e.g. MoCA verbal items, GDS-15 for mood) will be added as a question category alongside biographical questions. The session plan endpoint will be updated to mix question types with a defined ratio per session (e.g. 2 clinical, 4 biographical).

### 7.3 Picture description tasks

A category of questions presents the patient with an image and asks them to describe it. The Cookie Theft picture from the Boston Diagnostic Aphasia Examination is a clinically standard choice. Implementation requires adding an image display area to the chat screen and an image management system on the server.

### 7.4 Streaks and badges

A streak counter (consecutive days with a completed session) and milestone badges (e.g. "10 sessions", "first biography paragraph") will be added to the homepage. These are the standard engagement mechanics that work for 50+ audiences and are already visible in apps like Duolingo or Headspace.

### 7.5 Biography export

Patients will be able to view their full biography in a readable format and export it as a PDF to print or email to family. This is the primary "gift" the app offers participants and a strong motivator for daily use.

### 7.6 Privacy and data handling

When deployed in a clinical research context, audio files and transcripts are PHI under HIPAA. Future versions will need:
- Encrypted storage of audio and transcript files
- Secure transmission (HTTPS)
- Consent screen at first launch
- Data retention policies

For the current local prototype used with a single research participant, these are not yet implemented.

### 7.7 Partial session recovery

If the browser crashes or the page is closed mid-session, the current implementation loses the session. A future version will periodically flush audio chunks and transcript data to the server so sessions can be partially recovered.

### 7.8 Admin dashboard

A separate web interface (or simple file browser) for researchers to:
- View all completed sessions
- Download audio/CSV files
- Read biographies
- Track retention metrics across participants

---

## 8. Running the App

### Prerequisites
- Python 3 with `flask` and `openai` packages installed
- FFmpeg installed and on PATH (for MP3 conversion)
- `OPENAI_API_KEY` environment variable set to a valid OpenAI API key

### Start
```bash
export OPENAI_API_KEY='sk-your-key-here'
python3 server.py
```

Open `http://127.0.0.1:5001` in Chrome (Chrome is required for WebRTC and MediaRecorder support).

### Subject data
The app currently uses a hardcoded user `Aidas`. Subject data lives in `subject_data/Aidas/`. To reset a user's biography, delete or clear `biography.txt`. To reset session count, delete or edit `stats.json`.

---

## 9. Active Issues / Known Limitations

| Issue | Status | Notes |
|---|---|---|
| Realtime API transcription not producing transcript deltas | In progress | WebRTC connection and audio flow work; `session.update` accepted; `input_audio_transcription.delta` events not firing. May need to use transcription session type or switch approaches. |
| Multiple users | Implemented | User folders live under `subject_data/<username>/` |
| Authentication | Implemented | First screen is the login screen |
| No partial save | By design (MVP) | Session lost if browser closes |
| FFmpeg required | Known dependency | MP3 conversion will fail without it; could be made optional |
| TTS cache grows unbounded | Known | `subject_data/<username>/agent_messages_audio/` accumulates user-specific TTS MP3s; no eviction |
