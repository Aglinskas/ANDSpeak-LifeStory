# Bugs and Improvements to Investigate

Code audit focused on session reliability, OpenAI API integration, research-data integrity, and deployment safety. No implementation changes are included here.

## Findings

### 1. Critical: Failed recording uploads are treated as successful saves

`finishSession()` never checks the HTTP status returned by `/api/save_session`. It sets `sessionSaved = true` for any resolved response and then deletes the partial recovery files. A server-side FFmpeg failure or HTTP 500 can therefore cause data loss while the UI reports success.

References: `static/app.js:1503`

### 2. High: Biography updates and session counting are not transactional or idempotent

The biography update runs even if recording storage fails. The endpoint receives no `session_id`, overwrites the biography, and increments the session count every time it is called. A retry or duplicate request can count one session multiple times.

References: `static/app.js:1516`, `server.py:1827`

### 3. High: Audio finalization relies on a fixed 600 ms delay

The code stops `MediaRecorder`, sleeps for 600 ms, and then builds the blob. It should wait for the recorder's `stop` event and final `dataavailable` event. Slow browsers can otherwise produce incomplete or empty recordings.

References: `static/app.js:1483`

### 4. High: Partial audio recovery probably does not work during a session

`MediaRecorder.start()` is called without a timeslice, so browsers generally do not emit chunks until recording stops. The "audio every three turns" checkpoint often has no chunks to upload.

References: `static/app.js:1014`, `static/app.js:1140`

### 5. High: Realtime transcript events are not buffered by `item_id`

All deltas share one `pendingDelta`, and any completion clears it. OpenAI states that completion events from different speech turns are not guaranteed to arrive in order and recommends matching them by `item_id`. Overlapping or reordered events could corrupt the research transcript.

References: `static/app.js:1347`, [OpenAI Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription)

### 6. High: Session startup leaks microphone and recorder resources after partial failure

If microphone access and recording succeed but Realtime setup fails, the catch block only displays an alert. It does not stop the recorder, microphone tracks, audio context, or peer connection.

References: `static/app.js:1005`, `static/app.js:1043`

### 7. High: `/api/next-question` failures are not detected correctly

The frontend parses the response but never checks `res.ok` or `next.error`. A JSON-formatted HTTP 500 can be passed into `askDynamicQuestion()`, producing a generic thank-you message followed by another unanswered participant turn rather than ending cleanly.

References: `static/app.js:1211`

### 8. Medium: OpenAI calls can block user requests for a long time

The client uses SDK defaults, which in the installed SDK include a 600-second read timeout and automatic retries. The raw `urllib` Realtime request has no explicit timeout. Interactive interview turns need short, endpoint-specific deadlines and defined fallback behavior.

References: `server.py:33`, `server.py:2247`

### 9. Medium: JSON mode is used where strict schemas are needed

Five calls request `json_object`, then assume particular keys and types. JSON mode guarantees valid JSON, not the required structure. Strict Structured Outputs would enforce allowed actions, required fields, arrays, and value types. The code should also handle refusals and truncated responses explicitly.

References: `server.py:675`, `server.py:1630`, [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

### 10. Medium: Realtime is configured as a general assistant instead of transcription-only

The app opens the model selected by `realtime` in `openai_models_used.json`, sets `type: "realtime"`, and adds the model selected by `realtime_transcription`. A transcription-specific Realtime session should be evaluated for latency, cost, and simpler behavior.

References: `server.py:2240`, `static/app.js:1298`, [OpenAI Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription)

### 11. Medium: The Realtime handshake uses a less explicit configuration pattern

Current unified-interface guidance sends SDP and session configuration together as multipart data. The app sends raw SDP with a model query parameter and configures the session afterward over the data channel. Supplying configuration during initialization reduces setup races and lets the backend add a privacy-preserving safety identifier.

References: `server.py:2232`, [OpenAI WebRTC guide](https://developers.openai.com/api/docs/guides/realtime-webrtc)

### 12. Medium: Sensitive participant data is duplicated into debug files and console output

Full biographies, responses, model decisions, newly introduced people, and reasoning are written as plaintext and printed. For cognitive-health research, debug logging needs opt-in levels, redaction, retention limits, and restricted access.

References: `server.py:416`

### 13. Medium: The configured image model is deprecated

The `portrait_image` selection in `openai_models_used.json` should be checked against the current model catalog before deployment. Any migration should be tested for reference-image fidelity and cost.

References: `portrait_generation.md:9`, [OpenAI model catalog](https://developers.openai.com/api/docs/models/all)

### 14. Medium: OpenAI SDK behavior is not reproducible

There is no dependency manifest or pinned `openai` version. The local environment currently has `openai 2.16.0`, while the code contains a `TypeError` fallback for older image APIs. A deployment can silently receive different request behavior.

### 15. Deployment security blockers exist outside the OpenAI integration

The create-user password is hardcoded, account passwords may be four characters, there is no login rate limiting or CSRF protection, and Flask starts with debug mode enabled. These are unacceptable if the app is exposed beyond a controlled local research machine.

References: `server.py:37`, `server.py:513`, `server.py:2707`

## Recommended Order

1. Fix recording finalization, HTTP status handling, and transactional session completion.
2. Make finalization idempotent using `session_id` and a persisted completion state.
3. Buffer Realtime transcripts per `item_id` and add connection failure and recovery behavior.
4. Introduce strict schemas, response validation, timeouts, and centralized OpenAI error handling.
5. Evaluate transcription-only Realtime sessions and current transcription models using representative participant audio.
6. Pin dependencies and add mocked API and state-machine tests before changing models.
7. Address sensitive logging, deployment authentication, and data-governance controls.

## Architectural Note

The deterministic conversation state machine is a good design choice: the model proposes wording and classifications while Python enforces follow-up limits. Preserve that architecture and make its API boundaries stricter rather than replacing it with a more autonomous agent.

## Verification Performed

- `server.py` passes Python compilation.
- JavaScript syntax checking could not run because Node.js is unavailable in the current environment.
- No files were edited as part of the audit itself.
