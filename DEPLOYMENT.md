# Production deployment

The public LifeStory app runs at `https://lifestory.andspeakai.com`.

## Request path

1. Nginx terminates HTTPS for `lifestory.andspeakai.com`.
2. Nginx proxies requests to `127.0.0.1:5001`.
3. The `andspeak-lifestory.service` systemd unit keeps Gunicorn running.
4. Gunicorn imports the Flask application as `server:app`.

The checked-in files under `deploy/` are reproducible templates. The installed
files are machine configuration:

- `/etc/nginx/sites-available/lifestory`
- `/etc/systemd/system/andspeak-lifestory.service`

Certbot manages the certificate directives in the installed Nginx file.

## Machine-local state

These paths must never be committed:

- `.env` — secrets used by systemd
- `.venv/` — the server's Python environment
- `subject_data/` — private user and session data
- `bug reports/` — user-generated reports
- `.deploy-backups/` — pre-deployment backups

## Initial setup

From `/opt/ANDSpeak-LifeStory`:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Create `.env` with the required `OPENAI_API_KEY` and
`ANDSPEAK_SECRET_KEY`. Install the templates under `deploy/`, then validate
Nginx and enable the service.

## Routine release

Do not use an unconditional `git pull` followed by an immediate restart.

1. Confirm `git status` is clean.
2. Fetch and inspect the incoming commits.
3. Create a rollback tag and back up `.env`, `subject_data/`, and installed
   service/proxy configuration.
4. Test the candidate revision on a different local port.
5. Update dependencies with `.venv/bin/pip install -r requirements.txt`.
6. Restart `andspeak-lifestory.service`.
7. Verify the systemd status, local port, logs, and public HTTPS URL.

Feature development should happen on branches on the development computer.
Merge tested work into `main`; deploy a specific tested `main` commit here.
