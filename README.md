# ANDSpeak LifeStory

ANDSpeak LifeStory is a multi-user, voice-based interview app designed for longitudinal cognitive-health
research. It collects repeat speech samples through short, friendly conversations, saving recordings,
timestamped transcripts, and session statistics for later analysis of potential speech-based biomarkers. The
app itself does not assess cognition or diagnose users.

To encourage participants to return over time, each conversation contributes to a growing personal biography.
The AI adapts questions to the participant’s existing story, asks relevant follow-ups, respects declined
topics, and reads questions aloud while transcribing responses in real time. After each session, it updates
the biography and generates an evolving illustrated life-story portrait. Users can review their story,
previous sessions, images, and progress through a phone-style web interface.

In short, its purpose is to make repeated clinical speech-data collection feel like a meaningful personal storytelling experience rather than a medical test.


# Implementation 

Key Features

  - Voice-led life-story interviews: AI asks personalized biographical questions using text-to-speech.
  - Adaptive conversation: Follow-up questions respond to new people, pets, events, and meaningful details
    while respecting declined topics.

  - Real-time transcription: Spoken answers appear live using OpenAI Realtime API over WebRTC.
  - Session recording: Saves complete audio as MP3 and timestamped dialogue as CSV for downstream research.
  - Growing biography: Rewrites and expands each participant’s life story after every completed session.
  - Evolving illustrations: Generates a consistent, biography-based portrait scene that becomes richer over
    time.

  - Progress tracking: Shows completed sessions, spoken word count, duration, and biography paragraph count.
  - Content review: Users can read their biography, browse previous sessions, play recordings, and explore
    generated images.

  - Multi-user accounts: Provides login, user creation, password management, and isolated participant data.
  - Personalization: Users can record instructions for the interviewer’s personality and their visual likeness.
  - Recovery and configuration: Supports partial session saves and adjustable transcription/VAD settings.

  Key Implementation Details

  - Backend: Python and Flask, primarily implemented in server.py.
  - Frontend: Framework-free HTML, CSS, and JavaScript with a phone-style single-page interface.
  - AI services: OpenAI models generate session plans, interpret responses, select follow-ups, update
    biographies, transcribe speech, produce TTS audio, and generate images.

  - Conversation control: The LLM makes conversational judgments, while Python enforces limits such as maximum
    turns and follow-up depth.

  - Audio pipeline: Browser MediaRecorder captures sessions; FFmpeg converts recordings to MP3.
  - Transcription pipeline: Browser microphone audio is sent through WebRTC, with the Flask server proxying the
    OpenAI connection so the API key remains server-side.

  - Image consistency: A persistent base portrait anchors later session illustrations, optionally using
    reference photos and user-provided likeness instructions.

  - Storage: Data is filesystem-based under subject_data/<username>/, including biographies, settings,
    statistics, recordings, transcripts, debug logs, and generated images.

  - Editable configuration: Prompts, model choices, conversation limits, personality, and image-generation
    rules live in Markdown configuration files and are reloaded without restarting the app.

  - Security: Passwords are salted and hashed; Flask sessions control access; API credentials are read from
    environment variables.


# Specifics

Flask app for running the ANDSpeak LifeStory interview experience.

## OpenAI API key

The app reads the OpenAI API key from the `OPENAI_API_KEY` environment variable. Do not store the key in a project file or commit it to git.

For a one-terminal local run:

```bash
export OPENAI_API_KEY='sk-your-key-here'
python3 server.py
```

That `export` only applies to the current terminal session. To make it available in new zsh terminals on this Mac, add it to `~/.zshrc`:

```bash
echo "export OPENAI_API_KEY='sk-your-key-here'" >> ~/.zshrc
source ~/.zshrc
```

If you deploy the app, set `OPENAI_API_KEY` in the deployment platform's environment variable or secrets settings. Keep it server-side only; the browser should keep calling this Flask app, and the Flask app should make OpenAI requests.

For deployment, also set a stable Flask session secret:

```bash
export ANDSPEAK_SECRET_KEY='make-this-a-long-random-string'
```

If `ANDSPEAK_SECRET_KEY` is not set, the app generates one at startup, which means users will be logged out whenever the server restarts.

## OpenAI models

All OpenAI model names are configured in `openai_models_used.json`. Edit that file to change
the model used for any role. The app does not contain fallback model names: if this file is
missing, malformed, or incomplete, the affected operation fails with a configuration error.

## Running locally

Prerequisites:

- Python 3
- Python packages: `flask` and `openai`
- FFmpeg installed and available on `PATH`
- `OPENAI_API_KEY` exported in the environment that starts the server

Start the app:

```bash
python3 server.py
```

Open `http://127.0.0.1:5001` in Chrome.

## Users and Passwords

The app has a login screen. User data is stored separately under:

```text
subject_data/<username>/
```

Session recordings and CSV transcripts are stored in `subject_data/<username>/output/`. Generated agent-message audio is cached in `subject_data/<username>/agent_messages_audio/`.

The built-in users are `Aidas`, `Dani`, `Ben`, and `Luca`. Passwords are stored as hashes in `subject_data/users.json`, not as plaintext in the app code.

Logged-in users can change their password from Settings. To create another user, click `Create new user` on the login screen and enter the create-user password, `AidasAllows`, then choose the new username, password, gender, and age. Gender and age seed the new user's `biography.txt`; optional spoken intro and likeness notes are also saved into the biography, and likeness notes are saved to `likeness_instructions.txt`.

For deployment, keep `subject_data/users.json` and each `subject_data/<username>/` folder persistent. If the deployment platform uses ephemeral storage, configure a persistent disk or database-backed replacement before using the app with real sessions.
