# ANDSpeak LifeStory

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
