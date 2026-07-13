import os
import re
import csv
import glob
import json
import base64
import hashlib
import secrets
import shutil
import threading
import subprocess
import tempfile
import urllib.request
import urllib.error
import urllib.parse
from difflib import SequenceMatcher
from string import Template
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, session
from openai import OpenAI

app = Flask(__name__, static_folder='static', static_url_path='')
app.secret_key = os.environ.get("ANDSPEAK_SECRET_KEY") or secrets.token_hex(32)

os.makedirs("static", exist_ok=True)

api_key = os.environ.get("OPENAI_API_KEY", "").strip()
if not api_key:
    raise RuntimeError(
        "OPENAI_API_KEY is not set. Export it before starting the app, "
        "for example: export OPENAI_API_KEY='sk-...'"
    )

client = OpenAI(api_key=api_key)

OPENAI_MODELS_PATH = 'openai_models_used.json'
REQUIRED_OPENAI_MODEL_KEYS = (
    'question_preparation',
    'followup_decision',
    'portrait_brief',
    'portrait_image',
    'realtime',
    'realtime_transcription',
    'audio_transcription',
    'text_to_speech',
)


def _load_openai_models():
    """Load the required model names from the single source-of-truth JSON file."""
    try:
        with open(OPENAI_MODELS_PATH, 'r', encoding='utf-8') as f:
            models = json.load(f)
    except FileNotFoundError as exc:
        raise RuntimeError(
            f"Required OpenAI model configuration is missing: {OPENAI_MODELS_PATH}"
        ) from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Invalid JSON in {OPENAI_MODELS_PATH}: {exc}"
        ) from exc

    if not isinstance(models, dict):
        raise RuntimeError(f"{OPENAI_MODELS_PATH} must contain a JSON object")

    missing = [key for key in REQUIRED_OPENAI_MODEL_KEYS if key not in models]
    invalid = [
        key for key in REQUIRED_OPENAI_MODEL_KEYS
        if key in models and (not isinstance(models[key], str) or not models[key].strip())
    ]
    if missing or invalid:
        problems = []
        if missing:
            problems.append(f"missing keys: {', '.join(missing)}")
        if invalid:
            problems.append(f"empty or non-string values: {', '.join(invalid)}")
        raise RuntimeError(f"Invalid {OPENAI_MODELS_PATH}: {'; '.join(problems)}")

    return {key: models[key].strip() for key in REQUIRED_OPENAI_MODEL_KEYS}


def _openai_model(role):
    return _load_openai_models()[role]


# Fail at startup when the required source file is missing or invalid.
_load_openai_models()

SUBJECT_ROOT = 'subject_data'
USER_STORE_PATH = os.path.join(SUBJECT_ROOT, 'users.json')
CREATE_USER_PASSWORD = 'AidasAllows'
PASSWORD_HASH_ITERATIONS = 260000
SESSION_ID_RE = re.compile(r'\d{8}_\d{6}')
INITIAL_USER_HASHES = {
    'Aidas': 'pbkdf2_sha256$260000$7e0ea770650bf81ddd77d9611fe17787$136e7f745dc271927b89a54e7a3159a3807ea21ae15b32021554d89d455fc2a2',
    'Dani': 'pbkdf2_sha256$260000$1d225be0cd826656b00e029af9532a5f$05921ea1dbae9a7651450856c92fd80a238d4e71064c4e48feb51e856c48bcf6',
    'Ben': 'pbkdf2_sha256$260000$fa270747f6268586fad6ecd1a94ae90b$d1f44e283f2e3e64a541543ef41393946db8d4f6eaefd9571744ebd8013c5dc2',
    'Luca': 'pbkdf2_sha256$260000$9d017ca670e2dd5112f05881c1b213e2$0b5aa2f61fd9b5aa576ab094aa7d02adc11dfcc904baec2b97880d97a5da045d',
}


def _hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        PASSWORD_HASH_ITERATIONS
    ).hex()
    return f'pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}${salt}${digest}'


def _verify_password(password, stored_hash):
    try:
        algorithm, iterations, salt, expected = stored_hash.split('$', 3)
        if algorithm != 'pbkdf2_sha256':
            return False
        digest = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            int(iterations)
        ).hex()
        return secrets.compare_digest(digest, expected)
    except Exception:
        return False


def _valid_username(username):
    return bool(re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]{1,40}', username or ''))


def _ensure_user_folder(username):
    user_dir = os.path.join(SUBJECT_ROOT, username)
    os.makedirs(user_dir, exist_ok=True)
    return user_dir


def _write_user_store(users):
    os.makedirs(SUBJECT_ROOT, exist_ok=True)
    with open(USER_STORE_PATH, 'w', encoding='utf-8') as f:
        json.dump({'users': users}, f, indent=2)


def _load_user_store():
    os.makedirs(SUBJECT_ROOT, exist_ok=True)
    users = {}
    if os.path.exists(USER_STORE_PATH):
        try:
            with open(USER_STORE_PATH, 'r', encoding='utf-8') as f:
                users = json.load(f).get('users', {})
        except Exception:
            users = {}

    changed = False
    for username, password_hash in INITIAL_USER_HASHES.items():
        if username not in users:
            users[username] = {'password_hash': password_hash}
            changed = True
        _ensure_user_folder(username)

    for username in users:
        _ensure_user_folder(username)

    if changed or not os.path.exists(USER_STORE_PATH):
        _write_user_store(users)
    return users


def current_user_id():
    return session.get('user_id')


def current_subject_dir(user_id=None):
    user_id = user_id or current_user_id()
    if not user_id:
        raise RuntimeError('No user is logged in.')
    return os.path.join(SUBJECT_ROOT, user_id)


def current_output_dir(user_id=None):
    output_dir = os.path.join(current_subject_dir(user_id), 'output')
    os.makedirs(output_dir, exist_ok=True)
    return output_dir


def normalize_session_id(session_id):
    session_id = (session_id or '').strip()
    if SESSION_ID_RE.fullmatch(session_id):
        return session_id
    return ''


def current_session_output_dir(user_id=None, session_id=None):
    session_id = normalize_session_id(session_id) or datetime.now().strftime("%Y%m%d_%H%M%S")
    session_dir = os.path.join(current_output_dir(user_id), f'session_{session_id}')
    os.makedirs(session_dir, exist_ok=True)
    for subdir in ['agent_messages_audio', 'user_messages_audio', 'session_log']:
        os.makedirs(os.path.join(session_dir, subdir), exist_ok=True)
    return session_dir


def current_session_log_dir(user_id=None, session_id=None):
    session_id = normalize_session_id(session_id)
    if session_id:
        return os.path.join(current_session_output_dir(user_id, session_id), 'session_log')
    debug_dir = os.path.join(current_subject_dir(user_id), 'session_temp')
    os.makedirs(debug_dir, exist_ok=True)
    return debug_dir


def current_agent_messages_audio_dir(user_id=None):
    audio_dir = os.path.join(current_subject_dir(user_id), 'agent_messages_audio')
    os.makedirs(audio_dir, exist_ok=True)
    return audio_dir


@app.before_request
def require_login_for_api():
    if not request.path.startswith('/api/'):
        return None
    if request.path.startswith('/api/auth/'):
        return None
    users = _load_user_store()
    username = current_user_id()
    if username not in users:
        session.clear()
        return jsonify({'error': 'Login required'}), 401
    return None


_load_user_store()

# ─── Config files ────────────────────────────────────────────────────────────
# Edit agent_personality.md and session_config.md in the repo root, then restart.

def _load_text(path):
    if os.path.exists(path):
        with open(path, 'r') as f:
            return f.read().strip()
    return ''


_BIOGRAPHY_KEYWORD_STOPWORDS = {
    'about', 'after', 'again', 'along', 'also', 'around', 'because', 'before',
    'being', 'could', 'during', 'first', 'their', 'there', 'these', 'thing',
    'things', 'those', 'through', 'would', 'where', 'which', 'while', 'with',
    'without', 'years', 'still', 'became', 'comes', 'early',
    'every', 'feels', 'going', 'house', 'later', 'little', 'often', 'really',
    'remembers', 'something', 'sometimes', 'toward', 'today'
}


def _extract_biography_keywords(text, limit=50):
    """Extract lightweight person-specific keyword hints from stored biography."""
    if not text:
        return []

    candidates = []

    # Proper nouns and multi-word place/person names.
    for match in re.finditer(r'\b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){0,3}\b', text):
        value = match.group(0).strip()
        if value and value.lower() not in {'he', 'she', 'they', 'his', 'her'}:
            candidates.append(value)

    # Quoted names/titles and specific hyphenated phrases.
    candidates.extend(re.findall(r'[“"]([^”"]{3,40})[”"]', text))
    candidates.extend(re.findall(r'\b[a-zA-Z]+(?:-[a-zA-Z]+)+\b', text))

    # Repeated or salient longer common words.
    word_counts = {}
    for word in re.findall(r'\b[a-zA-Z][a-zA-Z]{4,}\b', text.lower()):
        if word not in _BIOGRAPHY_KEYWORD_STOPWORDS:
            word_counts[word] = word_counts.get(word, 0) + 1
    candidates.extend([
        word for word, _ in sorted(word_counts.items(), key=lambda item: (-item[1], item[0]))
        if word_counts[word] > 1
    ])

    seen = set()
    keywords = []
    for candidate in candidates:
        value = re.sub(r'\s+', ' ', str(candidate)).strip(" .,:;!?()[]")
        key = value.lower()
        if len(value) < 3 or key in seen:
            continue
        seen.add(key)
        keywords.append(value)
        if len(keywords) >= limit:
            break
    return keywords


# ─── Editable LLM prompts ────────────────────────────────────────────────────
# Every instruction the app sends to an LLM lives in a plain-text file you can
# edit — the conversation prompts in prompts/*.md, the image prompts in
# portrait_generation.md. Files are re-read on every call, so edits take effect
# on the next turn with NO restart. See prompts/README.md for the full map.
#
# In a prompt file, everything above the "## Prompt" line is human notes and is
# NOT sent to the model. Below it, $variables (e.g. $followup_depth) are filled
# in by the app — the notes section lists which ones are available.

_PROMPT_CACHE = {}  # last-good body per prompt name, so a broken edit can't kill a session


def render_prompt(name, **variables):
    """Load prompts/<name>.md, drop the notes header, fill in $variables."""
    raw  = _load_text(os.path.join('prompts', f'{name}.md'))
    body = raw.split('## Prompt', 1)[-1].strip() if '## Prompt' in raw else raw.strip()
    if body:
        _PROMPT_CACHE[name] = body                 # remember the last version that loaded
    else:
        body = _PROMPT_CACHE.get(name, '')         # fall back to it if the file breaks
        if not body:
            raise FileNotFoundError(f"Prompt '{name}' not found at prompts/{name}.md")
    return Template(body).safe_substitute(**variables)


def _extract_section(text, heading):
    """Return the body under a '## heading' up to the next '## ' (or end of file)."""
    m = re.search(rf'^##\s*{re.escape(heading)}\s*$(.*?)(?=^##\s|\Z)',
                  text, re.MULTILINE | re.DOTALL)
    return m.group(1).strip() if m else ''


def _reload_config():
    personality = _load_text('agent_personality.md')
    config      = _load_text('session_config.md')

    # Parse the tunable knobs from session_config.md (KEY = value lines)
    max_turns    = 15
    max_followup = 2
    for line in config.splitlines():
        m = re.match(r'MAX_TURNS\s*=\s*(\d+)', line)
        if m: max_turns = int(m.group(1))
        m = re.match(r'MAX_FOLLOWUP_DEPTH\s*=\s*(\d+)', line)
        if m: max_followup = int(m.group(1))

    return personality, config, max_turns, max_followup


def read_personality_additions(user_id=None):
    path = os.path.join(current_subject_dir(user_id), 'personality_additions.txt')
    if os.path.exists(path):
        with open(path, 'r') as f:
            return f.read().strip()
    return ''


def write_personality_additions(text, user_id=None):
    subject_dir = current_subject_dir(user_id)
    os.makedirs(subject_dir, exist_ok=True)
    with open(os.path.join(subject_dir, 'personality_additions.txt'), 'w') as f:
        f.write(text)


def read_likeness_instructions(user_id=None):
    path = os.path.join(current_subject_dir(user_id), 'likeness_instructions.txt')
    if os.path.exists(path):
        with open(path, 'r') as f:
            return f.read().strip()
    return ''


def write_likeness_instructions(text, user_id=None):
    subject_dir = current_subject_dir(user_id)
    os.makedirs(subject_dir, exist_ok=True)
    with open(os.path.join(subject_dir, 'likeness_instructions.txt'), 'w') as f:
        f.write(text)


def invalidate_base_portrait(user_id=None):
    """Force future image generations to rebuild the locked person reference."""
    for path in (_portrait_paths(user_id)['base'], _portrait_paths(user_id)['stream']):
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass


def get_effective_personality(user_id=None):
    additions = read_personality_additions(user_id)
    if additions:
        return (
            AGENT_PERSONALITY
            + "\n\n## User Preferences (added by the user — follow these carefully)\n"
            + additions
        )
    return AGENT_PERSONALITY

(AGENT_PERSONALITY, SESSION_CONFIG,
 MAX_TURNS, MAX_FOLLOWUP_DEPTH) = _reload_config()
print(f"[CONFIG] OpenAI models loaded from {OPENAI_MODELS_PATH}  "
      f"max_turns={MAX_TURNS}  max_followup={MAX_FOLLOWUP_DEPTH}")

# ─── Helpers ────────────────────────────────────────────────────────────────

def _openai_post(endpoint, data=None):
    req = urllib.request.Request(
        f'https://api.openai.com{endpoint}',
        data=json.dumps(data or {}).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def read_biography(user_id=None):
    bio_path = os.path.join(current_subject_dir(user_id), 'biography.txt')
    if os.path.exists(bio_path):
        with open(bio_path, 'r') as f:
            return f.read().strip()
    return ''

def read_stats(user_id=None):
    stats_path = os.path.join(current_subject_dir(user_id), 'stats.json')
    if os.path.exists(stats_path):
        with open(stats_path, 'r') as f:
            return json.load(f)
    return {'session_count': 0}

def write_stats(stats, user_id=None):
    subject_dir = current_subject_dir(user_id)
    os.makedirs(subject_dir, exist_ok=True)
    with open(os.path.join(subject_dir, 'stats.json'), 'w') as f:
        json.dump(stats, f)

def read_settings(user_id=None):
    path = os.path.join(current_subject_dir(user_id), 'settings.json')
    defaults = {
        'vad_threshold': 0.65,
        'silence_duration_ms': 1000,
        'mute_mic_during_tts': True,
        'ignore_transcripts_during_tts': True,
        'filter_hallucinated_fillers': True,
        'debug_realtime_events': False,
    }
    if os.path.exists(path):
        with open(path, 'r') as f:
            return {**defaults, **json.load(f)}
    return defaults

def write_settings_file(settings, user_id=None):
    subject_dir = current_subject_dir(user_id)
    os.makedirs(subject_dir, exist_ok=True)
    with open(os.path.join(subject_dir, 'settings.json'), 'w') as f:
        json.dump(settings, f, indent=2)

def request_session_id(default=''):
    try:
        if request.is_json:
            data = request.get_json(silent=True) or {}
            return normalize_session_id(data.get('session_id')) or default
        return normalize_session_id(request.form.get('session_id')) or default
    except RuntimeError:
        return default


def write_debug(user_id, data, label, session_id=None):
    """Write a debug JSON file to the active session_log/ and print to console."""
    session_id = normalize_session_id(session_id) or request_session_id()
    debug_dir = current_session_log_dir(user_id, session_id)
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    path = os.path.join(debug_dir, f"{ts}_{label}.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\n[DEBUG:{label}]\n{json.dumps(data, indent=2, ensure_ascii=False)}\n")

def clear_session_temp(user_id):
    """Clear only debug files; partial saves from crashed sessions are preserved."""
    debug_dir = os.path.join('subject_data', user_id, 'session_temp')
    os.makedirs(debug_dir, exist_ok=True)
    for fname in os.listdir(debug_dir):
        if not fname.startswith('partial_'):
            try:
                os.remove(os.path.join(debug_dir, fname))
            except Exception:
                pass

def check_for_partial_saves(user_id):
    """Warn at session start if a previous session crashed without saving."""
    debug_dir = os.path.join('subject_data', user_id, 'session_temp')
    if not os.path.exists(debug_dir):
        return
    partials = sorted(f for f in os.listdir(debug_dir) if f.startswith('partial_'))
    if partials:
        print(f'\n[WARNING] Unfinished session data found for {user_id}:')
        for fname in partials:
            size = os.path.getsize(os.path.join(debug_dir, fname))
            print(f'  {fname}  ({size // 1024} KB)')
        print(f'  → Recover from subject_data/{user_id}/session_temp/\n')

# ─── Static files ───────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/style.css')
def style():
    return send_from_directory('static', 'style.css')

@app.route('/app.js')
def app_js():
    return send_from_directory('static', 'app.js')

# ─── Authentication ─────────────────────────────────────────────────────────

@app.route('/api/auth/me', methods=['GET'])
def auth_me():
    users = _load_user_store()
    username = current_user_id()
    if username in users:
        return jsonify({'authenticated': True, 'username': username})
    session.clear()
    return jsonify({'authenticated': False})


@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.json or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    users = _load_user_store()
    user = users.get(username)
    if not user or not _verify_password(password, user.get('password_hash', '')):
        return jsonify({'error': 'Invalid username or password'}), 401
    session['user_id'] = username
    _ensure_user_folder(username)
    return jsonify({'ok': True, 'username': username})


@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    session.clear()
    return jsonify({'ok': True})


@app.route('/api/auth/create-user', methods=['POST'])
def auth_create_user():
    data = request.json or {}
    create_password = data.get('create_password') or ''
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    gender = (data.get('gender') or '').strip().upper()
    age_raw = data.get('age')
    about_text = _clean_detail_text(data.get('about_text'), 1200)
    likeness_text = _clean_detail_text(data.get('likeness_text'), 1200)

    if create_password != CREATE_USER_PASSWORD:
        return jsonify({'error': 'Create-user password is incorrect'}), 403
    if not _valid_username(username):
        return jsonify({
            'error': 'Username must start with a letter and use only letters, numbers, underscores, or hyphens.'
        }), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters.'}), 400
    if gender not in {'M', 'F'}:
        return jsonify({'error': 'Please select gender.'}), 400
    try:
        age = int(age_raw)
    except (TypeError, ValueError):
        return jsonify({'error': 'Please select age.'}), 400
    if age < 1 or age > 120:
        return jsonify({'error': 'Age must be between 1 and 120.'}), 400

    users = _load_user_store()
    if username in users:
        return jsonify({'error': 'That username already exists.'}), 409

    users[username] = {'password_hash': _hash_password(password)}
    _write_user_store(users)
    user_dir = _ensure_user_folder(username)

    gender_word = 'male' if gender == 'M' else 'female'
    reflexive = 'himself' if gender == 'M' else 'herself'
    biography_parts = [f'{username} is a {age} year old {gender_word}.']
    if about_text:
        biography_parts.append(f'{username} shared this about {reflexive} at account creation: {about_text}')
    if likeness_text:
        biography_parts.append(f'Image likeness notes for {username}: {likeness_text}')
        with open(os.path.join(user_dir, 'likeness_instructions.txt'), 'w', encoding='utf-8') as f:
            f.write(likeness_text)
    with open(os.path.join(user_dir, 'biography.txt'), 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(biography_parts))
    write_stats({'session_count': 0}, username)

    return jsonify({'ok': True, 'username': username})


@app.route('/api/auth/check-create-password', methods=['POST'])
def auth_check_create_password():
    data = request.json or {}
    if (data.get('create_password') or '') != CREATE_USER_PASSWORD:
        return jsonify({'error': 'Create-user password is incorrect'}), 403
    return jsonify({'ok': True})


@app.route('/api/auth/transcribe-onboarding', methods=['POST'])
def auth_transcribe_onboarding():
    try:
        if request.form.get('create_password') != CREATE_USER_PASSWORD:
            return jsonify({'error': 'Create-user password is incorrect'}), 403
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio provided'}), 400
        text = _transcribe_audio_upload(request.files['audio'])
        print(f'[TRANSCRIBE] Onboarding note: {text}')
        return jsonify({'text': text})
    except Exception as e:
        print(f'Onboarding transcription error: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/change-password', methods=['POST'])
def auth_change_password():
    username = current_user_id()
    users = _load_user_store()
    if username not in users:
        session.clear()
        return jsonify({'error': 'Login required'}), 401

    data = request.json or {}
    current_password = data.get('current_password') or ''
    new_password = data.get('new_password') or ''
    if not _verify_password(current_password, users[username].get('password_hash', '')):
        return jsonify({'error': 'Current password is incorrect.'}), 403
    if len(new_password) < 4:
        return jsonify({'error': 'New password must be at least 4 characters.'}), 400

    users[username]['password_hash'] = _hash_password(new_password)
    _write_user_store(users)
    return jsonify({'ok': True})

# ─── Settings ───────────────────────────────────────────────────────────────

@app.route('/api/settings', methods=['GET'])
def get_settings():
    return jsonify(read_settings())

@app.route('/api/settings', methods=['POST'])
def save_settings_route():
    try:
        data = request.json or {}
        settings = {
            'vad_threshold':       max(0.30, min(0.90, float(data.get('vad_threshold', 0.65)))),
            'silence_duration_ms': max(400,  min(2000, int(data.get('silence_duration_ms', 1000)))),
            'mute_mic_during_tts': bool(data.get('mute_mic_during_tts', True)),
            'ignore_transcripts_during_tts': bool(data.get('ignore_transcripts_during_tts', True)),
            'filter_hallucinated_fillers': bool(data.get('filter_hallucinated_fillers', True)),
            'debug_realtime_events': bool(data.get('debug_realtime_events', False)),
        }
        user_id = current_user_id()
        write_settings_file(settings, user_id)
        print(f'[SETTINGS] Saved for {user_id}: {settings}')
        return jsonify({'ok': True, 'settings': settings})
    except Exception as e:
        print(f'Settings save error: {e}')
        return jsonify({'error': str(e)}), 500

# ─── Stats ──────────────────────────────────────────────────────────────────

@app.route('/api/stats', methods=['GET'])
def get_stats():
    stats = read_stats()
    bio = read_biography()
    paragraphs = len([p for p in bio.split('\n\n') if p.strip()]) if bio else 0
    return jsonify({
        'session_count': stats.get('session_count', 0),
        'biography_paragraphs': paragraphs
    })

# ─── Session plan (larger model generates greeting + question pool) ──────────

@app.route('/api/session-plan', methods=['POST'])
def session_plan():
    try:
        user_id = current_user_id()
        session_id = request_session_id() or datetime.now().strftime("%Y%m%d_%H%M%S")
        current_session_output_dir(user_id, session_id)
        # Reload config on each session start so edits take effect without restart
        global AGENT_PERSONALITY, SESSION_CONFIG
        global MAX_TURNS, MAX_FOLLOWUP_DEPTH
        (AGENT_PERSONALITY, SESSION_CONFIG,
         MAX_TURNS, MAX_FOLLOWUP_DEPTH) = _reload_config()
        models = _load_openai_models()
        question_model = models['question_preparation']
        print(f"[CONFIG] Reloaded OpenAI models from {OPENAI_MODELS_PATH}")

        check_for_partial_saves(user_id)
        clear_session_temp(user_id)

        biography    = read_biography(user_id)
        biography_keywords = _extract_biography_keywords(biography)
        stats        = read_stats(user_id)
        session_num  = stats.get('session_count', 0) + 1

        system_prompt = "\n\n---\n\n".join(filter(None, [
            get_effective_personality(user_id),
            SESSION_CONFIG,
            render_prompt('session_plan', user_id=user_id, session_num=session_num)
        ]))

        if biography:
            user_content = (
                f"Participant: {user_id}\n"
                f"Session number: {session_num}\n\n"
                f"Current biography:\n{biography}\n\n"
                "Biography-specific keyword hints for question metadata "
                f"(people, places, roles, hobbies, objects): {', '.join(biography_keywords) or '(none)'}\n\n"
                "Generate the personalized greeting and question pool."
            )
        else:
            user_content = (
                f"Participant: {user_id}\n"
                f"Session number: {session_num} (first session — no biography yet).\n\n"
                "Greet them warmly, introduce the conversation, and generate foundational life questions "
                "(childhood, family, early memories)."
            )

        completion = client.chat.completions.create(
            model=question_model,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user',   'content': user_content}
            ],
            response_format={'type': 'json_object'}
        )

        result = json.loads(completion.choices[0].message.content)
        questions = _normalize_question_pool(result.get('questions', []))

        write_debug(user_id, {
            'session_number':    session_num,
            'biography_present': bool(biography),
            'biography_chars':   len(biography),
            'biography_keywords': biography_keywords,
            'model':             question_model,
            'output':            result,
            'normalized_questions': questions
        }, 'session_plan')

        return jsonify({
            'session_id': session_id,
            'realtime_transcription_model': models['realtime_transcription'],
            'greeting':  result.get('greeting',  f'Hello, {user_id}! How has your day been?'),
            'questions': questions
        })

    except Exception as e:
        print(f"Session plan error: {e}")
        return jsonify({'error': str(e)}), 500

# ─── Next question (fast model decides: follow up or move on) ────────────────

def _normalize_question_for_match(text):
    text = (text or '').lower()
    text = re.sub(r'[^a-z0-9]+', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def _find_prepared_question_index(question, prepared_questions):
    """Return the queued prepared-question index that the model appears to ask."""
    needle = _normalize_question_for_match(_question_text(question))
    if not needle:
        return None

    best_idx = None
    best_score = 0.0
    for idx, prepared in enumerate(prepared_questions):
        candidate = _normalize_question_for_match(_question_text(prepared))
        if not candidate:
            continue
        if needle == candidate:
            return idx
        score = SequenceMatcher(None, needle, candidate).ratio()
        if score > best_score:
            best_idx = idx
            best_score = score

    return best_idx if best_score >= 0.84 else None


def _looks_like_followup_question(question, latest_response='', current_topic=''):
    """Detect model outputs that are semantically follow-ups despite a bad action."""
    question_text = _normalize_question_for_match(question)
    response_text = _normalize_question_for_match(latest_response)
    if not question_text:
        return False

    followup_starters = (
        'what was', 'what did', 'what do', 'what made', 'what about',
        'when you', 'when did', 'when was', 'how did', 'how was',
        'how do', 'why did', 'why was', 'can you tell', 'could you tell',
        'tell me more'
    )
    if question_text.startswith(followup_starters):
        return True

    response_words = {
        word for word in response_text.split()
        if len(word) >= 4 and word not in {
            'that', 'this', 'with', 'what', 'when', 'where', 'would',
            'about', 'there', 'they', 'them', 'very', 'just'
        }
    }
    question_words = set(question_text.split())
    if len(response_words & question_words) >= 2:
        return True

    return bool(current_topic and _infer_topic_from_text(question) == current_topic)


_TOPIC_KEYWORDS = {
    'childhood': [
        'childhood', 'child', 'kid', 'young', 'grew up', 'village',
        'hometown', 'neighborhood', 'neighbourhood', 'schoolyard',
        'early memory'
    ],
    'family': [
        'family', 'father', 'dad', 'mother', 'mom', 'mum', 'parent',
        'parents', 'sibling', 'brother', 'sister', 'grandparent',
        'grandmother', 'grandfather'
    ],
    'education': [
        'school', 'teacher', 'university', 'undergrad', 'master', 'phd',
        'degree', 'study', 'studies', 'student', 'college'
    ],
    'work': [
        'work', 'job', 'career', 'profession', 'business', 'office',
        'colleague', 'retired', 'retirement'
    ],
    'relationships': [
        'partner', 'girlfriend', 'boyfriend', 'wife', 'husband', 'married',
        'marriage', 'children', 'kids', 'son', 'daughter', 'dating'
    ],
    'friends': [
        'friend', 'friends', 'community', 'neighbor', 'neighbour',
        'classmate', 'colleague'
    ],
    'home': [
        'home', 'house', 'apartment', 'flat', 'room', 'place', 'where you live'
    ],
    'hobbies': [
        'hobby', 'hobbies', 'sport', 'sports', 'exercise', 'game', 'games',
        'movie', 'movies', 'food', 'meal', 'cook', 'cooking', 'music',
        'garden', 'reading'
    ],
    'travel': [
        'travel', 'trip', 'journey', 'country', 'countries', 'city',
        'cities', 'moved', 'move', 'abroad'
    ],
    'life_events': [
        'turning point', 'major change', 'death', 'birth', 'wedding',
        'illness', 'moved', 'move', 'left', 'arrived'
    ],
    'values': [
        'values', 'philosophy', 'advice', 'learned', 'meaning', 'matters',
        'goals', 'aspirations', 'regret', 'proud'
    ],
    'current_life': [
        'now', 'current', 'ordinary day', 'evening', 'routine',
        'looking forward'
    ],
}

_TOPIC_ALIASES = {
    'parents': 'family',
    'relationship': 'relationships',
    'romance': 'relationships',
    'career': 'work',
    'job': 'work',
    'school': 'education',
    'home_place': 'home',
    'significant_life_events': 'life_events',
    'life event': 'life_events',
    'life_events': 'life_events',
    'current': 'current_life',
}


def _question_text(entry):
    if isinstance(entry, dict):
        return str(entry.get('text') or entry.get('question') or '').strip()
    return str(entry or '').strip()


def _normalize_topic(topic):
    topic = re.sub(r'[^a-z0-9_]+', '_', str(topic or '').lower()).strip('_')
    return _TOPIC_ALIASES.get(topic, topic)


def _infer_topic_from_text(text):
    text = (text or '').lower()
    if not text:
        return ''

    best_topic = ''
    best_hits = 0
    for topic, keywords in _TOPIC_KEYWORDS.items():
        hits = sum(1 for keyword in keywords if keyword in text)
        if hits > best_hits:
            best_topic = topic
            best_hits = hits
    return best_topic


def _question_topic(entry):
    if isinstance(entry, dict):
        topic = _normalize_topic(entry.get('topic', ''))
        if topic in _TOPIC_KEYWORDS:
            return topic
    return _infer_topic_from_text(_question_text(entry))


def _question_keywords(entry):
    if not isinstance(entry, dict):
        return []
    raw = entry.get('keywords', [])
    if isinstance(raw, str):
        raw = [part.strip() for part in re.split(r'[,;]', raw)]
    if not isinstance(raw, list):
        return []

    keywords = []
    seen = set()
    for item in raw:
        value = re.sub(r'\s+', ' ', str(item)).strip()
        key = value.lower()
        if len(value) < 2 or key in seen:
            continue
        seen.add(key)
        keywords.append(value)
    return keywords[:12]


def _normalize_question_entry(entry):
    text = _question_text(entry)
    if not text:
        return None
    if isinstance(entry, dict):
        normalized = dict(entry)
    else:
        normalized = {'text': text}
    normalized['text'] = text
    normalized['topic'] = _question_topic(normalized) or 'unknown'
    normalized['mode'] = str(normalized.get('mode') or 'unknown').strip() or 'unknown'
    normalized['keywords'] = _question_keywords(normalized)
    return normalized


def _normalize_question_pool(prepared_questions):
    normalized = []
    for entry in prepared_questions or []:
        question = _normalize_question_entry(entry)
        if question:
            normalized.append(question)
    return normalized


def _question_meta(entry):
    question = _normalize_question_entry(entry)
    if not question:
        return {'topic': 'unknown', 'mode': 'unknown', 'keywords': []}
    return {
        'topic': question.get('topic', 'unknown'),
        'mode': question.get('mode', 'unknown'),
        'keywords': question.get('keywords', []),
        'source': question.get('source', ''),
        'fills_gap': question.get('fills_gap', ''),
        'sensitivity': question.get('sensitivity', ''),
    }


def _topic_from_prepared_keywords(text, prepared_questions):
    haystack = _normalize_question_for_match(text)
    if not haystack:
        return ''

    best_topic = ''
    best_hits = 0
    for question in _normalize_question_pool(prepared_questions):
        keywords = question.get('keywords', [])
        hits = 0
        for keyword in keywords:
            key = _normalize_question_for_match(keyword)
            if key and key in haystack:
                hits += 1
        if hits > best_hits:
            best_hits = hits
            best_topic = question.get('topic', '')
    return best_topic


def _keywords_from_text_and_prepared(text, prepared_questions):
    haystack = _normalize_question_for_match(text)
    if not haystack:
        return []

    keywords = []
    seen = set()
    for question in _normalize_question_pool(prepared_questions):
        for keyword in question.get('keywords', []):
            key = _normalize_question_for_match(keyword)
            if key and key in haystack and key not in seen:
                seen.add(key)
                keywords.append(keyword)
    return keywords[:8]


def _followup_question_meta(question, latest_response, current_topic, prepared_questions):
    combined = " ".join([question or '', latest_response or ''])
    topic = (
        _topic_from_prepared_keywords(combined, prepared_questions)
        or _infer_topic_from_text(combined)
        or _normalize_topic(current_topic)
        or 'unknown'
    )
    return {
        'topic': topic,
        'mode': 'followup',
        'keywords': _keywords_from_text_and_prepared(combined, prepared_questions),
    }


def _exchange_question_meta(exchange):
    if not isinstance(exchange, dict):
        return {}
    meta = exchange.get('question_meta') or {}
    return meta if isinstance(meta, dict) else {}


def _topic_from_exchange(exchange):
    meta = _exchange_question_meta(exchange)
    topic = _normalize_topic(meta.get('topic', ''))
    if topic in _TOPIC_KEYWORDS:
        return topic
    question = exchange.get('question', '') if isinstance(exchange, dict) else ''
    return _infer_topic_from_text(question)


def _topics_mentioned(text):
    text = (text or '').lower()
    return {
        topic for topic, keywords in _TOPIC_KEYWORDS.items()
        if any(keyword in text for keyword in keywords)
    }


def _declined_topics_from_response(response, current_question='', current_topic=''):
    """Return broad topic areas the participant appears to be avoiding."""
    text = (response or '').lower()
    if not text:
        return set()

    decline_markers = [
        "don't want", "do not want", "dont want", "rather not", "prefer not",
        "not today", "something else", "anything else", "different topic",
        "another topic", "change topic", "switch topic", "move on"
    ]
    has_decline = any(marker in text for marker in decline_markers)
    if not has_decline:
        return set()

    topics = _topics_mentioned(text)
    if topics:
        return topics

    current_topic = _normalize_topic(current_topic) or _infer_topic_from_text(current_question)
    return {current_topic} if current_topic else set()


def _session_declined_topics(conversation_history):
    declined = set()
    for exchange in conversation_history or []:
        response = exchange.get('response', '') if isinstance(exchange, dict) else ''
        question = exchange.get('question', '') if isinstance(exchange, dict) else ''
        declined.update(_declined_topics_from_response(
            response,
            question,
            _topic_from_exchange(exchange)
        ))
    return declined


def _select_prepared_question(prepared_questions, avoid_topics=None, current_topic=''):
    """Pick the best next prepared question without assuming queue order."""
    questions = _normalize_question_pool(prepared_questions)
    if not questions:
        return None, []

    avoid_topics = set(avoid_topics or [])
    current_topic = _normalize_topic(current_topic)

    best_idx = None
    best_score = None
    for idx, question in enumerate(questions):
        topic = _normalize_topic(question.get('topic', ''))
        if topic in avoid_topics:
            continue

        score = 0
        if topic and current_topic and topic != current_topic:
            score += 4
        if question.get('mode') == 'new_direction':
            score += 2
        if question.get('sensitivity') == 'high':
            score -= 1
        score -= idx * 0.05

        if best_score is None or score > best_score:
            best_idx = idx
            best_score = score

    if best_idx is None and avoid_topics:
        return None, questions

    if best_idx is None:
        best_idx = 0

    selected = questions[best_idx]
    remaining = questions[:best_idx] + questions[best_idx + 1:]
    return selected, remaining


def _wants_different_topic(text):
    """Detect explicit requests to leave the current topic open-endedly."""
    text = (text or '').lower().strip()
    if not text:
        return False

    patterns = [
        r'\b(rather|prefer|would like|want)\b.*\b(talk|chat|speak|discuss)\b.*\b(something else|anything else|another topic|different topic)\b',
        r'\b(something else|anything else|another topic|different topic)\b.*\b(rather|prefer|instead)\b',
        r'\b(can|could)\s+we\b.*\b(change|switch)\b.*\b(topic|topics|subject)\b',
        r'\b(let\'?s|we can)\b.*\b(talk|chat|speak|discuss)\b.*\b(something else|anything else|another topic|different topic)\b',
        r'\b(let\'?s|we can)\b.*\b(change|switch|move on)\b.*\b(topic|topics|subject)?\b',
        r'\b(that\'?s|that is|this is)\b.*\b(something else|anything else|another topic|different topic)\b',
        r'\b(i do not|i don\'?t|not)\b.*\b(want|wanna)\b.*\b(talk|chat|speak|discuss|go there)\b',
    ]
    return any(re.search(pattern, text) for pattern in patterns)


def _refers_to_current_topic(text):
    text = (text or '').lower()
    return bool(re.search(r'\b(that|this|it|there)\b', text))


def _looks_like_biography_question(text):
    """Detect user questions about what the agent knows/remembers about them."""
    text = (text or '').lower().strip()
    if not text:
        return False

    patterns = [
        r'\b(tell|remind|show)\s+me\b.*\b(know|remember|talked|said|biography|life story|about me|my)\b',
        r'\b(what|who|where|when|why|how)\b.*\b(you\s+(know|remember)|we\s+(talked|discussed)|my\s+(biography|life|story|time)|about\s+me)\b',
        r'\bdo\s+you\s+(know|remember)\b',
        r'\bhave\s+we\s+(talked|spoken|discussed)\b',
    ]
    return any(re.search(pattern, text) for pattern in patterns)


def _answer_biography_question(user_question, biography, prior_text):
    """Answer a direct user question from the stored biography."""
    if not biography:
        return {
            'answer': "I do not have earlier biographical notes for you yet.",
            'question': "Would you like to tell me a little about that now?",
            'reasoning': 'No biography is stored.'
        }

    system_prompt = render_prompt('biography_answer')
    user_content = (
        f"Stored biography:\n{biography}\n\n"
        f"Recent conversation context:\n{prior_text}\n\n"
        f"Participant question:\n{user_question}\n\n"
        "Answer the participant."
    )

    completion = client.chat.completions.create(
        model=_openai_model('followup_decision'),
        messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user',   'content': user_content}
        ],
        response_format={'type': 'json_object'}
    )
    return json.loads(completion.choices[0].message.content)


def _normalize_topic_set(topics):
    normalized = set()
    for topic in topics or []:
        topic = _normalize_topic(topic)
        if topic in _TOPIC_KEYWORDS:
            normalized.add(topic)
    return normalized


def _clean_detail_text(value, max_len=80):
    value = re.sub(r'\s+', ' ', str(value or '')).strip()
    return value[:max_len].strip()


def _normalize_new_detail_item(item, kind):
    if isinstance(item, str):
        item = {'name': item}
    if not isinstance(item, dict):
        return None

    name = _clean_detail_text(
        item.get('name') or item.get('label') or item.get('description') or item.get('event')
    )
    if not name:
        return None

    detail = {
        'kind': kind,
        'name': name,
        'relationship': _clean_detail_text(item.get('relationship'), 60),
        'species': _clean_detail_text(item.get('species') or item.get('animal_type'), 40),
        'event_type': _clean_detail_text(item.get('event_type') or item.get('type'), 40),
        'visual_detail_needed': bool(item.get('visual_detail_needed', False)),
        'reason': _clean_detail_text(item.get('reason'), 120),
    }
    detail['signature'] = _new_detail_signature(detail)
    return detail


def _new_detail_signature(detail):
    kind = detail.get('kind', 'detail')
    base = detail.get('name') or detail.get('event_type') or ''
    base = re.sub(r'[^a-z0-9]+', '-', base.lower()).strip('-')
    if not base:
        base = 'unknown'
    return f'{kind}:{base[:60]}'


def _normalize_new_details(raw):
    if not isinstance(raw, dict):
        raw = {}
    specs = [
        ('person', raw.get('new_people', [])),
        ('pet_or_animal', raw.get('new_pets_or_animals', [])),
        ('event', raw.get('new_events', [])),
    ]
    details = []
    seen = set()
    for kind, items in specs:
        if not isinstance(items, list):
            items = []
        for item in items:
            detail = _normalize_new_detail_item(item, kind)
            if not detail or detail['signature'] in seen:
                continue
            seen.add(detail['signature'])
            details.append(detail)
    return details


def _detail_sort_key(detail):
    priority = {'pet_or_animal': 0, 'person': 1, 'event': 2}
    visual_bonus = -1 if detail.get('visual_detail_needed') else 0
    return (priority.get(detail.get('kind'), 9), visual_bonus, detail.get('name', '').lower())


def _unexplored_new_details(turn_interpretation, explored_signatures):
    explored = {str(item) for item in explored_signatures or []}
    details = turn_interpretation.get('new_details') or []
    return sorted(
        [detail for detail in details if detail.get('signature') not in explored],
        key=_detail_sort_key
    )


def _format_new_detail_context(details):
    if not details:
        return "No newly introduced people, pets/animals, or significant events need exploration right now."
    lines = []
    for detail in details[:5]:
        pieces = [detail['kind'], detail['name']]
        if detail.get('relationship'):
            pieces.append(f"relationship={detail['relationship']}")
        if detail.get('species'):
            pieces.append(f"species={detail['species']}")
        if detail.get('event_type'):
            pieces.append(f"event_type={detail['event_type']}")
        if detail.get('visual_detail_needed'):
            pieces.append("visual_detail_needed=true")
        lines.append("- " + " | ".join(pieces))
    return "\n".join(lines)


def _fallback_detail_followup(detail):
    name = detail.get('name', '').strip()
    kind = detail.get('kind')
    if kind == 'pet_or_animal':
        return f"What was {name} like?"
    if kind == 'person':
        if name.lower() in {'him', 'her', 'them', 'someone'}:
            return "Tell me a bit more about them."
        return f"Tell me a bit more about {name}."
    if kind == 'event':
        return f"What do you remember most about {name}?"
    return "Tell me a bit more about that."


def _interpret_turn(latest_exchange, biography, prepared_questions):
    """Classify the participant's latest reply before routing."""
    if not latest_exchange:
        return {
            'response_kind': 'unclear',
            'declined_topics': [],
            'requested_topic': '',
            'is_answering_current_question': False,
            'new_details': [],
            'reasoning': 'No latest exchange.'
        }

    question = latest_exchange.get('question', '')
    response = latest_exchange.get('response', '')
    question_meta = _exchange_question_meta(latest_exchange)
    current_topic = _topic_from_exchange(latest_exchange)
    prepared_summary = "\n".join([
        f"- {q.get('topic', 'unknown')}: {q.get('text', '')}"
        for q in _normalize_question_pool(prepared_questions)
    ]) or "(none)"

    user_content = (
        f"Current question topic: {current_topic or 'unknown'}\n"
        f"Current question metadata: {json.dumps(question_meta, ensure_ascii=False)}\n\n"
        f"Interviewer question:\n{question}\n\n"
        f"Participant reply:\n{response}\n\n"
        f"Prepared topics/questions still available:\n{prepared_summary}\n\n"
        "Biography context, for recognizing biography questions only:\n"
        f"{biography or '(empty)'}\n\n"
        "Also identify any newly introduced people, pets/animals, or significant events "
        "that are not already clearly present in the biography context. Classify the participant reply."
    )

    try:
        completion = client.chat.completions.create(
            model=_openai_model('followup_decision'),
            messages=[
                {'role': 'system', 'content': render_prompt('turn_interpretation')},
                {'role': 'user',   'content': user_content}
            ],
            response_format={'type': 'json_object'}
        )
        raw = json.loads(completion.choices[0].message.content)
    except Exception as e:
        print(f"Turn interpretation error: {e}")
        return {
            'response_kind': 'unclear',
            'declined_topics': [],
            'requested_topic': '',
            'is_answering_current_question': False,
            'new_details': [],
            'reasoning': f'Classifier failed; defaulting to normal follow-up decision. {e}'
        }

    allowed = {
        'substantive_answer',
        'explicit_topic_decline',
        'generic_topic_change',
        'biography_question',
        'unclear'
    }
    kind = raw.get('response_kind', 'unclear')
    if kind not in allowed:
        kind = 'unclear'

    declined = sorted(_normalize_topic_set(raw.get('declined_topics', [])))
    if kind == 'explicit_topic_decline' and not declined and current_topic in _TOPIC_KEYWORDS:
        declined = [current_topic]

    return {
        'response_kind': kind,
        'declined_topics': declined,
        'requested_topic': str(raw.get('requested_topic', '') or ''),
        'is_answering_current_question': bool(raw.get('is_answering_current_question', False)),
        'new_details': _normalize_new_details(raw),
        'reasoning': str(raw.get('reasoning', '') or '')
    }


def _interpret_consent(conversation_history):
    """Focused yes/no classifier for a checkpoint answer.

    The general decision prompt is unreliable here — a bare 'yes' has no new
    detail to follow up on, so the multi-rule model defaults to moving on even
    when the participant clearly wants to continue. A single-purpose call is far
    more robust."""
    lines = []
    for ex in conversation_history[-4:]:
        lines.append(f"Interviewer: {ex['question']}")
        lines.append(f"Participant: {ex['response']}")
    ctx = "\n".join(lines)
    system = render_prompt('consent_interpretation')
    completion = client.chat.completions.create(
        model=_openai_model('followup_decision'),
        messages=[
            {'role': 'system', 'content': system},
            {'role': 'user',   'content': ctx + "\n\nDoes the participant want to keep talking about that topic?"},
        ],
        response_format={'type': 'json_object'}
    )
    return json.loads(completion.choices[0].message.content)


@app.route('/api/next-question', methods=['POST'])
def next_question():
    try:
        user_id = current_user_id()
        data                 = request.json or {}
        conversation_history = data.get('conversation_history', [])  # [{question, response}]
        prepared_questions   = _normalize_question_pool(data.get('prepared_questions', []))
        declined_topics_in   = _normalize_topic_set(data.get('declined_topics', []))
        explored_new_details = [str(item) for item in data.get('explored_new_details', []) if str(item).strip()]
        followup_depth       = data.get('followup_depth', 0)
        awaiting_consent     = bool(data.get('awaiting_consent', False))
        turn_number          = len(conversation_history) + 1

        # ── Checkpoint answer: interpret consent with a dedicated classifier ──────
        if awaiting_consent and conversation_history:
            ci    = _interpret_consent(conversation_history)
            wants = bool(ci.get('continue', False))
            if wants:
                question  = ci.get('question') or "Please, tell me more about it."
                topic = _topic_from_exchange(conversation_history[-1]) if conversation_history else ''
                result = {
                    'action':             'followup',
                    'acknowledgment':     ci.get('acknowledgment', ''),
                    'question':           question,
                    'question_meta':      {'topic': topic or 'unknown', 'mode': 'followup', 'keywords': []},
                    'remaining_prepared': list(prepared_questions),
                    'declined_topics':    sorted(declined_topics_in),
                    'explored_new_details': explored_new_details,
                    'followup_depth':     1,        # fresh window after consent
                    'awaiting_consent':   False,
                    'significant':        True,
                    'reasoning':          '[consent] continue=true'
                }
            else:
                selected, remaining = _select_prepared_question(prepared_questions)
                if selected:
                    action, question = 'next_prepared', selected['text']
                    question_meta = _question_meta(selected)
                else:
                    action, question, remaining = 'wrap_up', '', []
                    question_meta = {'topic': 'unknown', 'mode': 'wrap_up', 'keywords': []}
                result = {
                    'action':             action,
                    'acknowledgment':     ci.get('acknowledgment', ''),
                    'question':           question,
                    'question_meta':      question_meta,
                    'remaining_prepared': remaining,
                    'declined_topics':    sorted(declined_topics_in),
                    'explored_new_details': explored_new_details,
                    'followup_depth':     0,
                    'awaiting_consent':   False,
                    'significant':        False,
                    'reasoning':          '[consent] continue=false'
                }
            write_debug(user_id, {
                'turn': turn_number, 'awaiting_consent_in': True,
                'consent_output': ci, 'result': result
            }, f'next_question_turn{turn_number:02d}')
            print(f"[NEXT-Q turn {turn_number}] consent → {result['action']}")
            return jsonify(result)

        # Hard limit — safety net
        if turn_number > MAX_TURNS:
            wrap = {
                'action':             'wrap_up',
                'acknowledgment':     "You've been so generous with your stories today — thank you.",
                'question':           '',
                'question_meta':      {'topic': 'unknown', 'mode': 'wrap_up', 'keywords': []},
                'remaining_prepared': [],
                'declined_topics':    sorted(declined_topics_in),
                'explored_new_details': explored_new_details,
                'followup_depth':     0,
                'reasoning':          f'Reached MAX_TURNS ({MAX_TURNS})'
            }
            write_debug(user_id, {'trigger': 'max_turns', 'turn': turn_number, 'result': wrap},
                        f'next_question_turn{turn_number:02d}')
            return jsonify(wrap)

        # Build readable history. The latest exchange is separated from older
        # context so the model cannot accidentally follow up on a stale topic.
        latest_exchange = conversation_history[-1] if conversation_history else None
        prior_exchanges = conversation_history[:-1] if conversation_history else []

        prior_lines = []
        for ex in prior_exchanges:
            prior_lines.append(f"Interviewer: {ex['question']}")
            prior_lines.append(f"Participant: {ex['response']}")
        prior_text = "\n".join(prior_lines) if prior_lines else "(none)"

        if latest_exchange:
            latest_text = (
                f"Interviewer: {latest_exchange['question']}\n"
                f"Participant: {latest_exchange['response']}"
            )
        else:
            latest_text = "(no prior exchanges)"

        prepared_list = (
            "\n".join([
                f"{i+1}. [{q.get('topic', 'unknown')} | {q.get('mode', 'unknown')}] {q['text']}"
                for i, q in enumerate(prepared_questions)
            ])
            if prepared_questions else "(none remaining)"
        )

        biography = read_biography(user_id)
        memory_context = (
            "What you already know about this person (their biography from earlier "
            "sessions, written about them in the third person):\n" + biography
        ) if biography else ""

        last_response_text = latest_exchange.get('response', '') if latest_exchange else ''
        last_question_text = latest_exchange.get('question', '') if latest_exchange else ''
        current_topic = _topic_from_exchange(latest_exchange) if latest_exchange else ''
        declined_topics = set(declined_topics_in)
        turn_interpretation = _interpret_turn(
            latest_exchange,
            biography,
            prepared_questions
        ) if latest_exchange else {
            'response_kind': 'unclear',
            'declined_topics': [],
            'requested_topic': '',
            'is_answering_current_question': False,
            'new_details': [],
            'reasoning': 'No latest exchange.'
        }
        unexplored_details = _unexplored_new_details(turn_interpretation, explored_new_details)
        latest_declined_topics = set(turn_interpretation.get('declined_topics', []))

        if latest_exchange and turn_interpretation.get('response_kind') == 'explicit_topic_decline':
            declined_topics.update(latest_declined_topics)
            selected, remaining = _select_prepared_question(
                prepared_questions,
                avoid_topics=declined_topics,
                current_topic=current_topic
            )
            if selected:
                result = {
                    'action':             'next_prepared',
                    'acknowledgment':     "Of course, we can leave that topic for today.",
                    'question':           selected['text'],
                    'question_meta':      _question_meta(selected),
                    'remaining_prepared': remaining,
                    'declined_topics':    sorted(declined_topics),
                    'explored_new_details': explored_new_details,
                    'followup_depth':     0,
                    'awaiting_consent':   False,
                    'significant':        False,
                    'reasoning':          (
                        f"[declined-topic] avoided={sorted(declined_topics)} "
                        f"current_topic={current_topic or 'unknown'} "
                        f"selected_topic={selected.get('topic', 'unknown')} "
                        f"mode={selected.get('mode', 'unknown')}"
                    )
                }
            else:
                result = {
                    'action':             'next_prepared',
                    'acknowledgment':     "Of course, we can leave that topic for today.",
                    'question':           "What else would you like to talk about?",
                    'question_meta':      {'topic': 'open_choice', 'mode': 'user_choice', 'keywords': []},
                    'remaining_prepared': list(prepared_questions),
                    'declined_topics':    sorted(declined_topics),
                    'explored_new_details': explored_new_details,
                    'followup_depth':     0,
                    'awaiting_consent':   False,
                    'significant':        False,
                    'reasoning':          f"[declined-topic] avoided={sorted(declined_topics)} no eligible prepared questions; asking participant to choose."
                }
            write_debug(user_id, {
                'turn':                   turn_number,
                'last_response':          last_response_text,
                'followup_depth_in':      followup_depth,
                'prepared_remaining_in':  len(prepared_questions),
                'declined_topics':        sorted(declined_topics),
                'latest_declined_topics': sorted(latest_declined_topics),
                'turn_interpretation':    turn_interpretation,
                'result':                 result
            }, f'next_question_turn{turn_number:02d}')
            print(f"[NEXT-Q turn {turn_number}] action={result['action']} | {result['reasoning']}")
            return jsonify(result)

        if latest_exchange and turn_interpretation.get('response_kind') == 'generic_topic_change':
            result = {
                'action':             'next_prepared',
                'acknowledgment':     "Of course, we can talk about something else.",
                'question':           "What else would you like to talk about?",
                'question_meta':      {'topic': 'open_choice', 'mode': 'user_choice', 'keywords': []},
                'remaining_prepared': list(prepared_questions),
                'declined_topics':    sorted(declined_topics),
                'explored_new_details': explored_new_details,
                'followup_depth':     0,
                'awaiting_consent':   False,
                'significant':        False,
                'reasoning':          f"[topic-change-request] {turn_interpretation.get('reasoning', '')}"
            }
            write_debug(user_id, {
                'turn':                   turn_number,
                'last_response':          last_response_text,
                'followup_depth_in':      followup_depth,
                'prepared_remaining_in':  len(prepared_questions),
                'topic_change_request':   True,
                'turn_interpretation':    turn_interpretation,
                'result':                 result
            }, f'next_question_turn{turn_number:02d}')
            print(f"[NEXT-Q turn {turn_number}] action=next_prepared | {result['reasoning']}")
            return jsonify(result)

        if latest_exchange and turn_interpretation.get('response_kind') == 'biography_question':
            bio_answer = _answer_biography_question(
                latest_exchange.get('response', ''),
                biography,
                prior_text
            )
            result = {
                'action':             'answer',
                'acknowledgment':     bio_answer.get('answer', ''),
                'question':           bio_answer.get('question', ''),
                'question_meta':      {'topic': 'biography', 'mode': 'answer', 'keywords': []},
                'remaining_prepared': list(prepared_questions),
                'declined_topics':    sorted(declined_topics),
                'explored_new_details': explored_new_details,
                'followup_depth':     0,
                'awaiting_consent':   False,
                'significant':        False,
                'reasoning':          bio_answer.get('reasoning', '[biography-answer]')
            }
            write_debug(user_id, {
                'turn':                   turn_number,
                'last_response':          latest_exchange.get('response', ''),
                'followup_depth_in':      followup_depth,
                'prepared_remaining_in':  len(prepared_questions),
                'model':                  _openai_model('followup_decision'),
                'biography_question':     True,
                'biography_chars':        len(biography),
                'turn_interpretation':    turn_interpretation,
                'llm_output':             bio_answer,
                'result':                 result
            }, f'next_question_turn{turn_number:02d}')
            print(f"[NEXT-Q turn {turn_number}] action=answer | {result['reasoning']}")
            return jsonify(result)

        system_prompt = "\n\n---\n\n".join(filter(None, [
            get_effective_personality(user_id),
            memory_context,
            render_prompt('followup_decision',
                          turn_number=turn_number,
                          followup_depth=followup_depth,
                          max_followup_depth=MAX_FOLLOWUP_DEPTH,
                          prepared_count=len(prepared_questions))
        ]))

        user_content = (
            "Latest exchange - base your decision ONLY on this participant response:\n"
            f"{latest_text}\n\n"
            "Newly introduced details from the latest response that are not yet explored this session:\n"
            f"{_format_new_detail_context(unexplored_details)}\n\n"
            "Earlier conversation for context only. Do NOT choose a follow-up topic from here "
            "unless the latest participant response explicitly brings it back up:\n"
            f"{prior_text}\n\n"
            f"Prepared questions still available:\n{prepared_list}\n\n"
            "What should the interviewer say next?"
        )

        completion = client.chat.completions.create(
            model=_openai_model('followup_decision'),
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user',   'content': user_content}
            ],
            response_format={'type': 'json_object'}
        )

        llm_out     = json.loads(completion.choices[0].message.content)
        action      = llm_out.get('action', 'next_prepared')
        significant = bool(llm_out.get('significant', False))
        acknowledgment = llm_out.get('acknowledgment', '')
        question    = llm_out.get('question', '')
        reasoning   = llm_out.get('reasoning', '')
        priority_detail = unexplored_details[0] if unexplored_details else None
        question_meta = {
            'topic': current_topic or 'unknown',
            'mode': action,
            'keywords': []
        }

        FALLBACK_CHECKPOINT = ("Would you like to tell me a little more about that, "
                               "or would you rather move on to something else?")

        # Deterministic state machine. The model supplies the wording and the soft
        # "significant?" judgment; code decides WHEN follow-ups may continue so the
        # cap never depends on the model, which may miscount follow-up depth.
        awaiting_out = False

        def _move_on():
            """Force a transition off the current topic."""
            selected, _ = _select_prepared_question(
                prepared_questions,
                avoid_topics=declined_topics,
                current_topic=current_topic
            )
            if selected:
                return 'next_prepared', selected['text']
            return 'wrap_up', ''

        if (
            action == 'next_prepared'
            and followup_depth < MAX_FOLLOWUP_DEPTH
            and _find_prepared_question_index(question, prepared_questions) is None
            and _looks_like_followup_question(question, last_response_text, current_topic)
        ):
            action = 'followup'
            question_meta = _followup_question_meta(
                question,
                last_response_text,
                current_topic,
                prepared_questions
            )
            reasoning = f"[action-question-mismatch-corrected] {reasoning}"

        if (
            priority_detail
            and action == 'next_prepared'
            and followup_depth < MAX_FOLLOWUP_DEPTH
            and turn_interpretation.get('response_kind') == 'substantive_answer'
        ):
            action = 'followup'
            question = _fallback_detail_followup(priority_detail)
            question_meta = {
                'topic': current_topic or 'unknown',
                'mode': 'followup',
                'keywords': [priority_detail.get('name', '')],
                'new_detail_signature': priority_detail.get('signature'),
                'new_detail_kind': priority_detail.get('kind'),
            }
            reasoning = (
                f"[new-detail-fallback {priority_detail.get('signature')}] "
                f"Latest response introduced a new person/pet/event that needed one open exploration. {reasoning}"
            )

        if action == 'followup':
            question_meta = _followup_question_meta(
                question,
                last_response_text,
                current_topic,
                prepared_questions
            )
            if priority_detail and priority_detail.get('name'):
                keywords = list(question_meta.get('keywords', []))
                if priority_detail['name'] not in keywords:
                    keywords.append(priority_detail['name'])
                question_meta['keywords'] = keywords[:12]
                question_meta['new_detail_signature'] = priority_detail.get('signature')
                question_meta['new_detail_kind'] = priority_detail.get('kind')

        # (awaiting_consent is fully handled earlier by the dedicated classifier.)
        if action == 'checkpoint':
            awaiting_out = True               # model chose to check in
            if not question.strip():
                question = FALLBACK_CHECKPOINT
        elif action == 'followup' and followup_depth >= MAX_FOLLOWUP_DEPTH:
            if significant:
                # Rare/meaningful topic at the cap → ask permission instead of assuming.
                action, awaiting_out = 'checkpoint', True
                question = FALLBACK_CHECKPOINT
                reasoning = (f"[cap+significant] depth {followup_depth} reached max; "
                             f"offering to continue. {reasoning}")
            else:
                action, question = _move_on()
                acknowledgment = "Thank you for sharing that."
                reasoning = (f"[capped] depth {followup_depth} reached max "
                             f"{MAX_FOLLOWUP_DEPTH}; forced {action}. {reasoning}")

        # Update the prepared pool. The model may rephrase or occasionally skip
        # ahead, so reconcile its spoken question with the queued prepared items
        # instead of blindly popping index 0 and letting state drift.
        remaining = list(prepared_questions)
        if action == 'next_prepared' and remaining:
            prepared_idx = _find_prepared_question_index(question, remaining)
            if prepared_idx is None:
                selected, remaining = _select_prepared_question(
                    remaining,
                    avoid_topics=declined_topics,
                    current_topic=current_topic
                )
                if selected:
                    question = selected['text']
                    question_meta = _question_meta(selected)
                    reasoning = (
                        f"[selected-prepared topic={selected.get('topic', 'unknown')} "
                        f"mode={selected.get('mode', 'unknown')}] {reasoning}"
                    )
                else:
                    action = 'wrap_up'
                    question = ''
                    question_meta = {'topic': 'unknown', 'mode': 'wrap_up', 'keywords': []}
                    remaining = []
                    reasoning = f"[no-prepared-available] {reasoning}"
            else:
                selected = remaining[prepared_idx]
                question = selected['text']
                question_meta = _question_meta(selected)
                remaining = remaining[:prepared_idx] + remaining[prepared_idx + 1:]
                if prepared_idx > 0:
                    reasoning = (
                        f"[matched-prepared-index={prepared_idx} "
                        f"topic={selected.get('topic', 'unknown')} "
                        f"mode={selected.get('mode', 'unknown')}] {reasoning}"
                    )

        if action == 'followup':
            new_depth = followup_depth + 1
        elif action == 'checkpoint':
            new_depth = followup_depth        # checkpoint isn't a content follow-up
        else:
            new_depth = 0

        updated_explored_new_details = list(explored_new_details)
        if action == 'followup' and priority_detail and priority_detail.get('signature'):
            signature = priority_detail['signature']
            if signature not in updated_explored_new_details:
                updated_explored_new_details.append(signature)

        result = {
            'action':             action,
            'acknowledgment':     acknowledgment,
            'question':           question,
            'question_meta':      question_meta,
            'remaining_prepared': remaining,
            'declined_topics':    sorted(declined_topics),
            'explored_new_details': updated_explored_new_details,
            'followup_depth':     new_depth,
            'awaiting_consent':   awaiting_out,
            'significant':        significant,
            'reasoning':          reasoning
        }

        last_response = conversation_history[-1]['response'] if conversation_history else ''

        write_debug(user_id, {
            'turn':                   turn_number,
            'last_response':          last_response,
            'followup_depth_in':      followup_depth,
            'prepared_remaining_in':  len(prepared_questions),
            'model':                  _openai_model('followup_decision'),
            'turn_interpretation':     turn_interpretation,
            'unexplored_new_details':  unexplored_details,
            'llm_output':             llm_out,
            'result':                 result
        }, f'next_question_turn{turn_number:02d}')

        print(f"[NEXT-Q turn {turn_number}] action={action} | {llm_out.get('reasoning', '')}")

        return jsonify(result)

    except Exception as e:
        print(f"Next question error: {e}")
        return jsonify({'error': str(e)}), 500

# ─── Biography update (GPT-5-nano rewrites biography after session) ──────────

@app.route('/api/update-biography', methods=['POST'])
def update_biography():
    try:
        user_id = current_user_id()
        data = request.json or {}
        transcript_entries = data.get('transcript', [])

        biography = read_biography(user_id)

        session_lines = []
        for entry in transcript_entries:
            prefix = "Q" if entry.get('speaker') == 'Chatbot' else "A"
            session_lines.append(f"{prefix}: {entry.get('text', '')}")
        session_text = '\n'.join(session_lines)

        system_prompt = render_prompt('biography_update')

        user_content = (
            f"Current biography:\n{biography or '(empty)'}\n\n"
            f"Today's session:\n{session_text}\n\n"
            "Return the updated biography."
        )

        completion = client.chat.completions.create(
            model=_openai_model('followup_decision'),
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user',   'content': user_content}
            ]
        )

        updated_bio = completion.choices[0].message.content.strip()
        subject_dir = current_subject_dir(user_id)
        os.makedirs(subject_dir, exist_ok=True)
        with open(os.path.join(subject_dir, 'biography.txt'), 'w') as f:
            f.write(updated_bio)

        stats = read_stats(user_id)
        stats['session_count'] = stats.get('session_count', 0) + 1
        write_stats(stats, user_id)

        paragraphs = len([p for p in updated_bio.split('\n\n') if p.strip()])
        return jsonify({'success': True, 'biography_paragraphs': paragraphs})
    except Exception as e:
        print(f"Biography update error: {e}")
        return jsonify({'error': str(e)}), 500

# ─── Biography portrait (the Images API streams a Ghibli-style scene) ────────
# Config + style instructions live in portrait_generation.md at the repo root.
# Strategy: a locked base.png keeps the person consistent; each session only the
# surrounding scene is regenerated, anchored to base.png + any reference photos.

# In-memory job state so the frontend can poll render progress.
PORTRAIT_JOBS = {}
PORTRAIT_LOCK = threading.Lock()

_PORTRAIT_DEFAULTS = {
    'IMAGE_SIZE':     '1024x1024',
    'IMAGE_QUALITY':  'medium',
    'PARTIAL_IMAGES': 2,
    'INPUT_FIDELITY': 'high',
}


def _load_portrait_config():
    """Return (instruction_text, settings_dict) from portrait_generation.md.

    Settings are parsed from `KEY = value` lines anywhere in the file; the style
    guidance is taken from the "## Instructions" section only (so config prose
    never leaks into the image prompt)."""
    text = _load_text('portrait_generation.md')
    settings = dict(_PORTRAIT_DEFAULTS)
    for line in text.splitlines():
        m = re.match(r'\s*([A-Z_]+)\s*=\s*(\S+)', line)
        if m and m.group(1) in settings:
            key, val = m.group(1), m.group(2)
            settings[key] = int(val) if key == 'PARTIAL_IMAGES' else val

    instructions = _extract_section(text, 'Instructions') or text.strip()
    return instructions, settings


# Compact fallbacks so a missing/renamed section in portrait_generation.md
# degrades gracefully instead of sending an empty prompt.
_PORTRAIT_PROMPT_DEFAULTS = {
    'Scene Brief Rules': (
        "You convert a person's biography into a concise VISUAL SCENE BRIEF for a single "
        "illustration. Strict rules:\n"
        "- The person is the centre of the scene. Describe their appearance only from stated "
        "age, gender and any described traits.\n"
        "- Only depict things explicitly mentioned in the biography. Never invent people, "
        "places or objects.\n"
        "- This biography has $paragraphs paragraph(s); include roughly $elements distinct "
        "surrounding element(s) (people, places, objects they mentioned). Fewer is fine; do "
        "not pad.\n"
        "- Keep it a single cohesive scene. Output 4-8 sentences of plain description."
    ),
    'Base Portrait': (
        "A single centred character portrait of the person described below, plain soft "
        "background, no other people or scene elements. This is a reference portrait to keep "
        "the person's look consistent in future images.\n\n$brief"
    ),
    'Scene': (
        "SCENE BRIEF:\n$brief\n\nKeep the central person's face and appearance consistent with "
        "the reference portrait provided. Build the surrounding scene from the brief only."
    ),
}


def portrait_prompt(section, **variables):
    """Render a named '## section' from portrait_generation.md, filling $variables."""
    body = _extract_section(_load_text('portrait_generation.md'), section)
    if not body:
        body = _PORTRAIT_PROMPT_DEFAULTS.get(section, '')
    return Template(body).safe_substitute(**variables)


def _images_dir(user_id=None):
    return os.path.join(current_subject_dir(user_id), 'images')


def _photos_dir(user_id=None):
    return os.path.join(current_subject_dir(user_id), 'photos')


def _portrait_paths(user_id=None):
    images_dir = _images_dir(user_id)
    return {
        'base':    os.path.join(images_dir, 'base.png'),
        'current': os.path.join(images_dir, 'current.png'),
        'stream':  os.path.join(images_dir, '_stream.png'),
    }


def _photo_files(user_id=None):
    photos_dir = _photos_dir(user_id)
    if not os.path.isdir(photos_dir):
        return []
    files = []
    for ext in ('*.png', '*.jpg', '*.jpeg', '*.webp', '*.PNG', '*.JPG', '*.JPEG'):
        files += glob.glob(os.path.join(photos_dir, ext))
    return sorted(set(files))


def _next_session_number(user_id=None):
    images_dir = _images_dir(user_id)
    os.makedirs(images_dir, exist_ok=True)
    nums = [int(m.group(1)) for f in glob.glob(os.path.join(images_dir, 'session_*.png'))
            if (m := re.search(r'session_(\d+)\.png$', f))]
    return max(nums, default=0) + 1


def _set_job(user_id, **kw):
    with PORTRAIT_LOCK:
        job = PORTRAIT_JOBS.setdefault(user_id, {})
        job.update(kw)
        job['rev'] = datetime.now().timestamp()


def _get_job(user_id):
    with PORTRAIT_LOCK:
        return dict(PORTRAIT_JOBS.get(user_id, {}))


def _likeness_prompt_block(likeness):
    if not likeness:
        return ''
    return (
        "User-provided likeness instructions for the central person. Treat these as "
        "authoritative visual facts and apply them only to the central person:\n"
        f"{likeness}"
    )


def _build_image_brief(biography, instructions, model, likeness=''):
    """Turn the biography into a concise visual scene brief (no hallucinations)."""
    paragraphs = len([p for p in biography.split('\n\n') if p.strip()])
    elements = min(max(paragraphs, 1), 8)
    likeness_block = _likeness_prompt_block(likeness)
    system = "\n\n".join(filter(None, [
        instructions,
        likeness_block,
        portrait_prompt('Scene Brief Rules', paragraphs=paragraphs, elements=elements),
        (
            "If likeness instructions are present, include their stable visual traits in the "
            "brief for the central person even if those traits are not in the biography."
        ) if likeness_block else ''
    ]))
    completion = client.chat.completions.create(
        model=model,
        messages=[
            {'role': 'system', 'content': system},
            {'role': 'user',   'content': f"Biography:\n{biography}\n\nWrite the scene brief."},
        ],
    )
    return completion.choices[0].message.content.strip(), paragraphs


def _run_stream(stream, on_frame, stream_path, final_path):
    """Consume a streamed image response, writing partial frames + the final image."""
    latest = None
    for event in stream:
        etype = getattr(event, 'type', '') or ''
        b64 = getattr(event, 'b64_json', None)
        if not b64:
            continue
        latest = b64
        if 'partial' in etype:
            with open(stream_path, 'wb') as f:
                f.write(base64.b64decode(b64))
            on_frame()
    if latest is None:
        raise RuntimeError('Image stream returned no data')
    with open(final_path, 'wb') as f:
        f.write(base64.b64decode(latest))
    shutil.copyfile(final_path, stream_path)
    on_frame()


def _image_generate(prompt, cfg, on_frame, stream_path, final_path):
    stream = client.images.generate(
        model=cfg['IMAGE_MODEL'], prompt=prompt, size=cfg['IMAGE_SIZE'],
        quality=cfg['IMAGE_QUALITY'], stream=True, partial_images=cfg['PARTIAL_IMAGES'],
    )
    _run_stream(stream, on_frame, stream_path, final_path)


def _image_edit(image_paths, prompt, cfg, on_frame, stream_path, final_path):
    handles = [open(p, 'rb') for p in image_paths]
    kwargs = dict(
        model=cfg['IMAGE_MODEL'], image=handles, prompt=prompt, size=cfg['IMAGE_SIZE'],
        quality=cfg['IMAGE_QUALITY'], stream=True, partial_images=cfg['PARTIAL_IMAGES'],
    )
    try:
        try:
            stream = client.images.edit(input_fidelity=cfg['INPUT_FIDELITY'], **kwargs)
        except TypeError:
            stream = client.images.edit(**kwargs)  # older SDK w/o input_fidelity
        _run_stream(stream, on_frame, stream_path, final_path)
    finally:
        for h in handles:
            try:
                h.close()
            except Exception:
                pass


def _generate_portrait_job(user_id):
    try:
        biography = read_biography(user_id)
        if not biography:
            _set_job(user_id, status='skipped')
            return

        instructions, cfg = _load_portrait_config()
        models = _load_openai_models()
        cfg['IMAGE_MODEL'] = models['portrait_image']
        cfg['BRIEF_MODEL'] = models['portrait_brief']
        images_dir = _images_dir(user_id)
        p = _portrait_paths(user_id)
        os.makedirs(images_dir, exist_ok=True)
        if os.path.exists(p['stream']):
            os.remove(p['stream'])  # clear last render so old frames don't flash

        def on_frame():
            _set_job(user_id, status='rendering')

        likeness = read_likeness_instructions(user_id)
        likeness_block = _likeness_prompt_block(likeness)
        brief, paragraphs = _build_image_brief(biography, instructions, cfg['BRIEF_MODEL'], likeness)
        photos = _photo_files(user_id)

        # 1. Locked base portrait — establishes the person once, reused every session.
        if not os.path.exists(p['base']):
            base_prompt = "\n\n".join(filter(None, [
                instructions,
                likeness_block,
                portrait_prompt('Base Portrait', brief=brief)
            ]))
            if photos:
                _image_edit(photos, base_prompt, cfg, on_frame, p['stream'], p['base'])
            else:
                _image_generate(base_prompt, cfg, on_frame, p['stream'], p['base'])

        # 2. Session scene — regenerated each time, anchored to the base + photos.
        scene_prompt = "\n\n".join(filter(None, [
            instructions,
            likeness_block,
            portrait_prompt('Scene', brief=brief)
        ]))
        refs = [p['base']] + photos
        session_num = _next_session_number(user_id)
        final_path = os.path.join(images_dir, f'session_{session_num:03d}.png')
        _image_edit(refs, scene_prompt, cfg, on_frame, p['stream'], final_path)

        shutil.copyfile(final_path, p['current'])
        with open(os.path.join(images_dir, f'session_{session_num:03d}.json'), 'w') as f:
            json.dump({
                'session':     session_num,
                'model':       cfg['IMAGE_MODEL'],
                'paragraphs':  paragraphs,
                'photos_used': [os.path.basename(x) for x in photos],
                'brief':       brief,
                'created':     datetime.now().isoformat(),
            }, f, indent=2)

        _set_job(user_id, status='ready', session=session_num)
        print(f"[PORTRAIT] session {session_num} ready for {user_id}")
    except Exception as e:
        print(f"[PORTRAIT] generation error: {e}")
        _set_job(user_id, status='error', error=str(e))


@app.route('/api/portrait/generate', methods=['POST'])
def portrait_generate():
    user_id = current_user_id()
    job = _get_job(user_id)
    if job.get('status') in ('starting', 'rendering'):
        return jsonify({'status': job['status']})  # already running
    _set_job(user_id, status='starting', session=None, error=None)
    threading.Thread(target=_generate_portrait_job, args=(user_id,), daemon=True).start()
    return jsonify({'status': 'starting'})


@app.route('/api/portrait/status')
def portrait_status():
    user_id = current_user_id()
    job = _get_job(user_id)
    status = job.get('status', 'idle')
    rev = job.get('rev', 0)
    resp = {'status': status, 'rev': rev, 'error': job.get('error')}
    if status in ('rendering', 'ready') and os.path.exists(_portrait_paths(user_id)['stream']):
        resp['frame_url'] = f'/api/portrait/frame?rev={rev}'
    return jsonify(resp)


@app.route('/api/portrait/frame')
def portrait_frame():
    user_id = current_user_id()
    images_dir = _images_dir(user_id)
    if os.path.exists(_portrait_paths(user_id)['stream']):
        return send_from_directory(images_dir, '_stream.png', max_age=0)
    return '', 404


@app.route('/api/portrait')
def portrait_current():
    user_id = current_user_id()
    p = _portrait_paths(user_id)
    if os.path.exists(p['current']):
        v = int(os.path.getmtime(p['current']))
        return jsonify({'exists': True, 'url': f'/api/portrait/current?v={v}'})
    return jsonify({'exists': False})


@app.route('/api/portrait/current')
def portrait_current_img():
    user_id = current_user_id()
    images_dir = _images_dir(user_id)
    if os.path.exists(_portrait_paths(user_id)['current']):
        return send_from_directory(images_dir, 'current.png', max_age=0)
    return '', 404


@app.route('/api/portrait/gallery')
def portrait_gallery():
    user_id = current_user_id()
    images_dir = _images_dir(user_id)
    os.makedirs(images_dir, exist_ok=True)
    items = []
    for path in sorted(glob.glob(os.path.join(images_dir, 'session_*.png')), reverse=True):
        m = re.search(r'session_(\d+)\.png$', path)
        if not m:
            continue
        session = int(m.group(1))
        meta = {}
        meta_path = os.path.join(images_dir, f'session_{session:03d}.json')
        if os.path.exists(meta_path):
            try:
                with open(meta_path, 'r') as f:
                    meta = json.load(f)
            except Exception:
                meta = {}
        v = int(os.path.getmtime(path))
        items.append({
            'session': session,
            'label': f'Session {session}',
            'url': f'/api/portrait/session/{session}?v={v}',
            'created': meta.get('created', ''),
            'paragraphs': meta.get('paragraphs'),
        })
    return jsonify({'images': items})


@app.route('/api/portrait/session/<int:session_num>')
def portrait_session_img(session_num):
    user_id = current_user_id()
    images_dir = _images_dir(user_id)
    filename = f'session_{session_num:03d}.png'
    path = os.path.join(images_dir, filename)
    if os.path.exists(path):
        return send_from_directory(images_dir, filename, max_age=0)
    return '', 404

# ─── Realtime API SDP proxy ──────────────────────────────────────────────────

@app.route('/api/realtime-sdp', methods=['POST'])
def realtime_sdp():
    try:
        sdp_offer = request.data.decode('utf-8')
        if not sdp_offer:
            return jsonify({'error': 'No SDP offer provided'}), 400

        realtime_model = urllib.parse.quote(_openai_model('realtime'), safe='')
        req = urllib.request.Request(
            f'https://api.openai.com/v1/realtime/calls?model={realtime_model}',
            data=sdp_offer.encode('utf-8'),
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/sdp'
            }
        )
        with urllib.request.urlopen(req) as resp:
            sdp_answer = resp.read().decode('utf-8')

        return sdp_answer, 200, {'Content-Type': 'application/sdp'}
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        print(f"Realtime SDP error: {body}")
        return body, e.code, {'Content-Type': 'application/json'}
    except Exception as e:
        print(f"Realtime SDP error: {e}")
        return jsonify({'error': str(e)}), 500

# ─── TTS ────────────────────────────────────────────────────────────────────

@app.route('/api/tts', methods=['POST'])
def text_to_speech():
    try:
        user_id = current_user_id()
        data = request.json or {}
        text = data.get('text', '').strip()
        session_id = normalize_session_id(data.get('session_id'))
        turn_number = data.get('turn_number')
        if not text:
            return jsonify({'error': 'No text provided'}), 400

        if session_id:
            session_dir = current_session_output_dir(user_id, session_id)
            audio_dir = os.path.join(session_dir, 'agent_messages_audio')
        else:
            audio_dir = current_agent_messages_audio_dir(user_id)

        try:
            turn_label = f"turn_{int(turn_number):03d}_agent"
        except (TypeError, ValueError):
            turn_label = "turn_unknown_agent"
        tts_model      = _openai_model('text_to_speech')
        cache_identity = f'{tts_model}\0alloy\0{text}'
        text_hash      = hashlib.md5(cache_identity.encode('utf-8')).hexdigest()
        cache_filename = f"{turn_label}_tts_{text_hash}.mp3"
        cache_path     = os.path.join(audio_dir, cache_filename)

        if not os.path.exists(cache_path):
            response = client.audio.speech.create(
                model=tts_model, voice="alloy", input=text
            )
            with open(cache_path, "wb") as f:
                f.write(response.content)

        if session_id:
            rel_path = f'agent_messages_audio/{cache_filename}'
            return jsonify({
                'audio_url': f'/api/session-output/{session_id}/{rel_path}',
                'audio_file_path': rel_path
            })

        return jsonify({
            'audio_url': f'/api/agent-messages-audio/{cache_filename}',
            'audio_file_path': f'agent_messages_audio/{cache_filename}'
        })
    except Exception as e:
        print(f"TTS error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/session-output/<session_id>/<path:filename>')
def serve_session_output_file(session_id, filename):
    session_id = normalize_session_id(session_id)
    if not session_id or '..' in filename.split('/'):
        return '', 404
    session_dir = current_session_output_dir(current_user_id(), session_id)
    return send_from_directory(session_dir, filename)

@app.route('/api/agent-messages-audio/<path:filename>')
def serve_audio(filename):
    if not re.fullmatch(r'(?:turn_(?:\d{3}|unknown)_agent_)?tts_[a-f0-9]{32}\.mp3', filename):
        return '', 404
    return send_from_directory(current_agent_messages_audio_dir(), filename)

# ─── Partial save (crash recovery) ──────────────────────────────────────────

@app.route('/api/partial-save', methods=['POST'])
def partial_save():
    """Receives periodic transcript + audio checkpoints from the browser.
    Called fire-and-forget from the frontend — every turn for transcript,
    every 3 turns for audio, and on pagehide for both.
    Partial files are kept until /api/cleanup-partial is called on clean finish."""
    try:
        user_id = current_user_id()
        session_id      = normalize_session_id(request.form.get('session_id')) or 'unknown'
        transcript_json = request.form.get('transcript')
        audio_file      = request.files.get('audio')

        debug_dir = current_session_log_dir(user_id, session_id)

        if transcript_json:
            path = os.path.join(debug_dir, f'partial_{session_id}_transcript.json')
            with open(path, 'w', encoding='utf-8') as f:
                f.write(transcript_json)
            print(f'[PARTIAL] transcript saved ({len(transcript_json)} bytes)')

        if audio_file:
            path = os.path.join(debug_dir, f'partial_{session_id}_audio.webm')
            audio_file.save(path)
            size = os.path.getsize(path)
            print(f'[PARTIAL] audio checkpoint saved ({size // 1024} KB)')

        return jsonify({'ok': True})
    except Exception as e:
        print(f'Partial save error: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/cleanup-partial', methods=['POST'])
def cleanup_partial():
    """Called after a successful finishSession to remove the partial files
    for that session. If this is never called, the files remain as a recovery artifact."""
    try:
        user_id = current_user_id()
        data       = request.json or {}
        session_id = normalize_session_id(data.get('session_id'))
        if not session_id:
            return jsonify({'ok': True})

        debug_dir = current_session_log_dir(user_id, session_id)
        cleaned   = []
        for suffix in ['transcript.json', 'audio.webm']:
            path = os.path.join(debug_dir, f'partial_{session_id}_{suffix}')
            if os.path.exists(path):
                os.remove(path)
                cleaned.append(os.path.basename(path))

        if cleaned:
            print(f'[PARTIAL] Cleaned up after successful session: {cleaned}')

        return jsonify({'ok': True, 'cleaned': cleaned})
    except Exception as e:
        print(f'Cleanup partial error: {e}')
        return jsonify({'error': str(e)}), 500

# ─── Save session ────────────────────────────────────────────────────────────

def _safe_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_relative_audio_path(path):
    path = (path or '').strip()
    if not path:
        return ''
    path = path.split('?', 1)[0]
    marker = '/agent_messages_audio/'
    if marker in path:
        return 'agent_messages_audio/' + path.rsplit(marker, 1)[1]
    marker = '/user_messages_audio/'
    if marker in path:
        return 'user_messages_audio/' + path.rsplit(marker, 1)[1]
    path = path.lstrip('/')
    if path.startswith(('agent_messages_audio/', 'user_messages_audio/')):
        return path
    return ''


def add_patient_segment_audio(transcript_data, mp3_path, session_dir):
    user_audio_dir = os.path.join(session_dir, 'user_messages_audio')
    os.makedirs(user_audio_dir, exist_ok=True)

    for index, entry in enumerate(transcript_data, start=1):
        existing_path = _normalize_relative_audio_path(entry.get('audio_file_path'))
        if existing_path:
            entry['audio_file_path'] = existing_path

        speaker = (entry.get('speaker') or '').lower()
        if speaker not in {'patient', 'person', 'user'}:
            continue
        if not (entry.get('text') or '').strip():
            continue

        start = _safe_float(entry.get('start_seconds'))
        end = _safe_float(entry.get('end_seconds'))
        if start is None or end is None or end <= start:
            continue

        try:
            turn = int(entry.get('question_number') or index)
        except (TypeError, ValueError):
            turn = index
        filename = f"turn_{turn:03d}_patient.mp3"
        rel_path = f"user_messages_audio/{filename}"
        clip_path = os.path.join(session_dir, rel_path)
        duration = max(0.05, end - start)
        result = subprocess.run(
            [
                'ffmpeg', '-y',
                '-i', mp3_path,
                '-ss', f'{start:.3f}',
                '-t', f'{duration:.3f}',
                '-vn',
                '-acodec', 'libmp3lame',
                '-ab', '192k',
                clip_path
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        if result.returncode == 0 and os.path.exists(clip_path):
            entry['audio_file_path'] = rel_path
        else:
            print(f"[SESSION AUDIO] Could not cut patient segment {filename}: {result.stderr.decode()}")


def write_session_csv(csv_path, transcript_data):
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Turn Number', 'Start', 'End', 'Start Seconds', 'End Seconds', 'Speaker', 'Audio File', 'Text'])
        for entry in transcript_data:
            start = entry.get('start_time') or entry.get('timestamp', '')
            end = entry.get('end_time') or entry.get('timestamp', '')
            writer.writerow([
                entry.get('question_number', ''),
                start,
                end,
                entry.get('start_seconds', ''),
                entry.get('end_seconds', ''),
                entry.get('speaker', ''),
                _normalize_relative_audio_path(entry.get('audio_file_path')),
                entry.get('text', '')
            ])

@app.route('/api/save_session', methods=['POST'])
def save_session():
    try:
        user_id = current_user_id()
        if 'audio' not in request.files:
            return jsonify({'error': 'No session audio provided'}), 400
        transcript_json = request.form.get('transcript')
        if not transcript_json:
            return jsonify({'error': 'No transcript data provided'}), 400

        transcript_data = json.loads(transcript_json)
        audio_file      = request.files['audio']
        session_id      = normalize_session_id(request.form.get('session_id')) or datetime.now().strftime("%Y%m%d_%H%M%S")

        ext = ".webm"
        if audio_file.filename and '.' in audio_file.filename:
            ext = os.path.splitext(audio_file.filename)[1]

        session_dir = current_session_output_dir(user_id, session_id)
        raw_path  = os.path.join(session_dir, f"session_raw_{session_id}{ext}")
        mp3_path  = os.path.join(session_dir, f"session_{session_id}.mp3")
        csv_path  = os.path.join(session_dir, f"session_{session_id}.csv")

        audio_file.save(raw_path)

        result = subprocess.run(
            ['ffmpeg', '-y', '-i', raw_path, '-acodec', 'libmp3lame', '-ab', '192k', mp3_path],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg failed: {result.stderr.decode()}")
        os.remove(raw_path)

        add_patient_segment_audio(transcript_data, mp3_path, session_dir)
        write_session_csv(csv_path, transcript_data)

        return jsonify({
            'success':    True,
            'session_id':  session_id,
            'session_dir': os.path.relpath(session_dir, current_subject_dir(user_id)),
            'audio_file': os.path.basename(mp3_path),
            'csv_file':   os.path.basename(csv_path)
        })
    except Exception as e:
        print(f"Save session error: {e}")
        return jsonify({'error': str(e)}), 500

# ─── Biography read ─────────────────────────────────────────────────────────

@app.route('/api/biography', methods=['GET'])
def get_biography_text():
    bio = read_biography()
    return jsonify({'biography': bio})

# ─── Sessions list ───────────────────────────────────────────────────────────

@app.route('/api/sessions', methods=['GET'])
def get_sessions_list():
    sessions = []
    user_id = current_user_id()
    output_dir = current_output_dir(user_id)
    csv_paths = []
    seen = set()
    if os.path.exists(output_dir):
        for dirname in sorted(os.listdir(output_dir), reverse=True):
            session_dir = os.path.join(output_dir, dirname)
            if not os.path.isdir(session_dir) or not dirname.startswith('session_'):
                continue
            ts_str = dirname.replace('session_', '', 1)
            csv_path = os.path.join(session_dir, f'session_{ts_str}.csv')
            if os.path.exists(csv_path):
                csv_paths.append((ts_str, session_dir, csv_path))

        for fname in sorted(os.listdir(output_dir), reverse=True):
            if not (fname.endswith('.csv') and fname.startswith('session_') and not fname.startswith('session_raw_')):
                continue
            ts_str = fname.replace('session_', '').replace('.csv', '')
            csv_paths.append((ts_str, output_dir, os.path.join(output_dir, fname)))

    for ts_str, session_dir, csv_path in csv_paths:
        if csv_path in seen:
            continue
        seen.add(csv_path)
        try:
            dt = datetime.strptime(ts_str, '%Y%m%d_%H%M%S')
            date_str = dt.strftime('%B %d, %Y')
            time_str = dt.strftime('%I:%M %p').lstrip('0')
        except Exception:
            date_str = ts_str
            time_str = ''

        duration = '—'
        words = 0
        turns = 0
        try:
            with open(csv_path, 'r', encoding='utf-8') as f:
                rows = list(csv.DictReader(f))
            if rows:
                last_ts = next(
                    (r.get('End') or r.get('Timestamp') for r in reversed(rows) if (r.get('End') or r.get('Timestamp'))),
                    None
                )
                if last_ts:
                    base_ts = last_ts.split('.', 1)[0]
                    parts = base_ts.split(':')
                    if len(parts) == 3:
                        total_s = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                        duration = f"{total_s // 60}m {total_s % 60}s"
            for row in rows:
                if row.get('Speaker') == 'Patient':
                    words += len((row.get('Text') or '').split())
            turn_nums = set(row.get('Turn Number') for row in rows if (row.get('Turn Number') or '').isdigit())
            turns = len(turn_nums)
        except Exception:
            pass

        has_audio = os.path.exists(os.path.join(session_dir, f'session_{ts_str}.mp3'))
        if not has_audio:
            has_audio = os.path.exists(csv_path.replace('.csv', '.mp3'))
        sessions.append({
            'id':        ts_str,
            'date':      date_str,
            'time':      time_str,
            'duration':  duration,
            'words':     words,
            'turns':     turns,
            'has_audio': has_audio,
        })

    sessions.sort(key=lambda item: item['id'], reverse=True)
    return jsonify({'sessions': sessions})

# ─── Personality additions ───────────────────────────────────────────────────

@app.route('/api/personality-additions', methods=['GET'])
def get_personality_additions():
    return jsonify({'additions': read_personality_additions()})

@app.route('/api/personality-additions', methods=['POST'])
def save_personality_additions():
    try:
        user_id = current_user_id()
        data   = request.json or {}
        action = data.get('action', 'append')

        if action == 'clear':
            write_personality_additions('', user_id)
            print(f'[PERSONALITY] Cleared for {user_id}')
            return jsonify({'ok': True, 'additions': ''})

        new_text = data.get('text', '').strip()
        if not new_text:
            return jsonify({'error': 'No text provided'}), 400

        existing = read_personality_additions(user_id)
        updated  = (existing + '\n' + new_text).strip() if existing else new_text
        write_personality_additions(updated, user_id)
        print(f'[PERSONALITY] Appended for {user_id}: {new_text}')
        return jsonify({'ok': True, 'additions': updated})

    except Exception as e:
        print(f'Personality additions error: {e}')
        return jsonify({'error': str(e)}), 500


# ─── Likeness instructions for image generation ──────────────────────────────

@app.route('/api/likeness-instructions', methods=['GET'])
def get_likeness_instructions():
    return jsonify({'instructions': read_likeness_instructions()})


@app.route('/api/likeness-instructions', methods=['POST'])
def save_likeness_instructions():
    try:
        user_id = current_user_id()
        data = request.json or {}
        action = data.get('action', 'append')

        if action == 'clear':
            write_likeness_instructions('', user_id)
            invalidate_base_portrait(user_id)
            print(f'[LIKENESS] Cleared for {user_id}; base portrait invalidated')
            return jsonify({'ok': True, 'instructions': ''})

        new_text = data.get('text', '').strip()
        if not new_text:
            return jsonify({'error': 'No text provided'}), 400

        existing = read_likeness_instructions(user_id)
        updated = (existing + '\n' + new_text).strip() if existing else new_text
        write_likeness_instructions(updated, user_id)
        invalidate_base_portrait(user_id)
        print(f'[LIKENESS] Appended for {user_id}; base portrait invalidated: {new_text}')
        return jsonify({'ok': True, 'instructions': updated})

    except Exception as e:
        print(f'Likeness instructions error: {e}')
        return jsonify({'error': str(e)}), 500

# ─── Transcribe voice instruction (for personality additions) ────────────────

def _transcribe_audio_upload(audio_file):
    suffix = '.webm'
    if audio_file.filename and '.' in audio_file.filename:
        suffix = os.path.splitext(audio_file.filename)[1]

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        with open(tmp_path, 'rb') as f:
            result = client.audio.transcriptions.create(
                model=_openai_model('audio_transcription'), file=f
            )
        return result.text.strip()
    finally:
        os.remove(tmp_path)


@app.route('/api/transcribe-instruction', methods=['POST'])
def transcribe_instruction():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio provided'}), 400

        text = _transcribe_audio_upload(request.files['audio'])

        print(f'[TRANSCRIBE] Personality instruction: {text}')
        return jsonify({'text': text})

    except Exception as e:
        print(f'Transcribe instruction error: {e}')
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, debug=True)
