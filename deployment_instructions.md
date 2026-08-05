# Updating the production app

The public app at `https://lifestory.andspeakai.com` runs from:

```text
/opt/ANDSpeak-LifeStory
```

Pushing code from the Mac does not update the running server automatically.
After pushing, pull the new commit on the server and gracefully reload Gunicorn.

## 1. Push the update from the Mac

On the Mac:

```bash
git switch main
git pull --ff-only origin main
git push origin main
```

Develop larger changes on a feature branch and merge the tested branch into
`main` before deploying.

## 2. Pull the update on the server

Connect to the server, then run:

```bash
cd /opt/ANDSpeak-LifeStory
git status
git pull --ff-only origin main
.venv/bin/pip install -r requirements.txt
```

`git status` should be clean before pulling. If it shows unexpected changes,
stop and investigate them instead of overwriting them.

`--ff-only` prevents Git from creating an unexpected merge on the production
server. If it refuses to pull, inspect why the branches have diverged.

## 3. Gracefully reload the app

Changing files on disk does not make the existing Gunicorn workers reload
Python code. Reload them after a successful pull:

```bash
master_pid=$(systemctl show andspeak-lifestory.service --property MainPID --value)
test "$master_pid" -gt 1
kill -HUP "$master_pid"
```

Gunicorn will replace its workers gracefully while continuing to listen on
port 5001.

## 4. Verify the deployment

```bash
systemctl is-active andspeak-lifestory.service
curl -I http://127.0.0.1:5001/
curl -I https://lifestory.andspeakai.com/
git status
```

Both HTTP checks should succeed, the service should report `active`, and the
Git working tree should be clean.

## Important rules

- Commit `requirements.txt` whenever Python dependencies change.
- Never commit `.env`, `.venv/`, `subject_data/`, bug reports, recordings, or
  deployment backups.
- Test substantial changes before deploying them to production.
- Create a production tag or rollback reference before a large deployment.
- Do not use an unconditional `git pull` followed by an immediate restart.

## When systemd configuration changes

Ordinary application updates only require the Gunicorn reload above.

If `/etc/systemd/system/andspeak-lifestory.service` itself is changed, an
administrator must instead run:

```bash
sudo systemctl daemon-reload
sudo systemctl restart andspeak-lifestory.service
```

If the Nginx configuration changes, validate it before reloading Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```
