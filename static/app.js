// ─── State ────────────────────────────────────────────────────────────────────

const state = {
    currentUser: '',
    createUserGatePassword: '',

    // Dynamic conversation
    preparedQuestionsPool: [],   // remaining prepared questions (shrinks as used)
    conversationHistory:   [],   // [{question, response}] sent to /api/next-question
    followupDepth:         0,    // consecutive follow-ups on current topic
    awaitingConsent:       false,// last turn asked "keep talking or move on?" — this response answers it
    declinedTopics:        [],   // broad topics the participant declined this session
    exploredNewDetails:    [],   // person/pet/event signatures already explored this session
    lastQuestion:          '',   // the question just asked (for pairing with response)
    lastQuestionMeta:      {},   // topic/mode/keywords for the question just asked
    turnNumber:            0,    // increments each time the chatbot speaks

    // Partial save (crash recovery)
    sessionId: '',               // timestamp string, used to name partial files

    // User settings (loaded from server, persisted across sessions)
    settings: {
        vad_threshold: 0.65,
        silence_duration_ms: 1000,
        mute_mic_during_tts: true,
        ignore_transcripts_during_tts: true,
        filter_hallucinated_fillers: true,
        debug_realtime_events: false,
    },

    sessionStartTime: null,
    sessionStartPerf: null,
    timerInterval:    null,
    transcripts:      [],
    isFinishing:      false,
    sessionSaved:     false,
    pendingAgentTranscriptFinalizer: null,

    // Word counting
    prevQuestionsWordCount: 0,
    totalWordCount:         0,

    // Live transcript accumulation
    liveTranscriptText: '',  // finalized VAD segments
    pendingDelta:       '',  // in-flight delta
    acceptingPatientSpeech: false,
    realtimeItems: {},
    activeRealtimeItemAccepting: false,
    currentPatientTurnStartSeconds: null,
    currentPatientSpeechStartSeconds: null,
    currentPatientSpeechEndSeconds: null,

    // Image explorer
    portraitGallery: [],
    imagePan: { x: 0, y: 0, dragging: false, lastX: 0, lastY: 0 },

    // Audio
    audioStream:      null,
    sessionRecorder:  null,
    sessionChunks:    [],
    mimeType:         '',

    // Visualizer
    audioContext:     null,
    analyser:         null,
    dataArray:        null,
    sourceNode:       null,
    animationFrameId: null,

    // WebRTC Realtime transcription
    peerConnection: null,
    dataChannel:    null,

    // Personality recording
    personalityRecorder: null,
    personalityChunks:   [],
    personalityMime:     '',
    pendingPersonality:  '',
    likenessRecorder: null,
    likenessChunks:   [],
    likenessMime:     '',
    pendingLikeness:  '',
    onboardingRecorders: {},
    onboardingChunks: {},
    onboardingMime: {},
    onboardingText: {
        about: '',
        likeness: '',
    },
};

// ─── Elements ─────────────────────────────────────────────────────────────────

const el = {
    statusTime:        document.getElementById('status-time'),
    // Auth
    loginForm:         document.getElementById('login-form'),
    loginUsername:     document.getElementById('login-username'),
    loginPassword:     document.getElementById('login-password'),
    loginError:        document.getElementById('login-error'),
    btnShowCreateUser: document.getElementById('btn-show-create-user'),
    btnCreateBack:     document.getElementById('btn-create-back'),
    createGateForm:    document.getElementById('create-gate-form'),
    createUserForm:    document.getElementById('create-user-form'),
    createGatePassword:document.getElementById('create-gate-password'),
    createGateError:   document.getElementById('create-gate-error'),
    createUsername:    document.getElementById('create-username'),
    createPassword:    document.getElementById('create-password'),
    createAge:         document.getElementById('create-age'),
    createAgeValue:    document.getElementById('create-age-value'),
    createUserError:   document.getElementById('create-user-error'),
    createUserSuccess: document.getElementById('create-user-success'),
    createAboutIdle:   document.getElementById('create-about-idle'),
    createAboutRecording: document.getElementById('create-about-recording'),
    createAboutTranscribing: document.getElementById('create-about-transcribing'),
    createAboutPreview: document.getElementById('create-about-preview'),
    createAboutPreviewText: document.getElementById('create-about-preview-text'),
    btnRecordCreateAbout: document.getElementById('btn-record-create-about'),
    btnStopCreateAbout: document.getElementById('btn-stop-create-about'),
    btnClearCreateAbout: document.getElementById('btn-clear-create-about'),
    createAboutStatus: document.getElementById('create-about-status'),
    createLikenessIdle: document.getElementById('create-likeness-idle'),
    createLikenessRecording: document.getElementById('create-likeness-recording'),
    createLikenessTranscribing: document.getElementById('create-likeness-transcribing'),
    createLikenessPreview: document.getElementById('create-likeness-preview'),
    createLikenessPreviewText: document.getElementById('create-likeness-preview-text'),
    btnRecordCreateLikeness: document.getElementById('btn-record-create-likeness'),
    btnStopCreateLikeness: document.getElementById('btn-stop-create-likeness'),
    btnClearCreateLikeness: document.getElementById('btn-clear-create-likeness'),
    createLikenessStatus: document.getElementById('create-likeness-status'),
    currentUserPill:   document.getElementById('current-user-pill'),
    // Home
    homeSessions:      document.getElementById('home-sessions'),
    homeParagraphs:    document.getElementById('home-paragraphs'),
    statCardSessions:  document.getElementById('stat-card-sessions'),
    statCardBiography: document.getElementById('stat-card-biography'),
    btnStart:          document.getElementById('btn-start'),
    btnSettings:       document.getElementById('btn-settings'),
    // Settings
    btnSettingsBack:   document.getElementById('btn-settings-back'),
    btnSettingsDone:   document.getElementById('btn-settings-done'),
    sliderThreshold:   document.getElementById('slider-threshold'),
    sliderSilence:     document.getElementById('slider-silence'),
    valThreshold:      document.getElementById('val-threshold'),
    valSilence:        document.getElementById('val-silence'),
    saveStatus:        document.getElementById('save-status'),
    settingsCurrentUser: document.getElementById('settings-current-user'),
    btnShowChangePassword: document.getElementById('btn-show-change-password'),
    changePasswordPanel: document.getElementById('change-password-panel'),
    changePasswordForm:  document.getElementById('change-password-form'),
    currentPassword:     document.getElementById('current-password'),
    newPassword:         document.getElementById('new-password'),
    changePasswordError: document.getElementById('change-password-error'),
    changePasswordSuccess: document.getElementById('change-password-success'),
    btnLogout:           document.getElementById('btn-logout'),
    // Personality (inside settings)
    personalityAdditionsDisplay: document.getElementById('personality-additions-display'),
    personalityIdle:        document.getElementById('personality-idle'),
    btnRecordPersonality:   document.getElementById('btn-record-personality'),
    btnPersonalityClear:    document.getElementById('btn-personality-clear'),
    personalityRecording:   document.getElementById('personality-recording'),
    btnPersonalityStop:     document.getElementById('btn-personality-stop'),
    personalityPreview:     document.getElementById('personality-preview'),
    personalityPreviewText: document.getElementById('personality-preview-text'),
    btnPersonalityAdd:      document.getElementById('btn-personality-add'),
    btnPersonalityDiscard:  document.getElementById('btn-personality-discard'),
    personalityTranscribing:document.getElementById('personality-transcribing'),
    personalityStatus:      document.getElementById('personality-status'),
    // Image likeness instructions (inside settings)
    likenessInstructionsDisplay: document.getElementById('likeness-instructions-display'),
    likenessIdle:        document.getElementById('likeness-idle'),
    btnRecordLikeness:   document.getElementById('btn-record-likeness'),
    btnLikenessClear:    document.getElementById('btn-likeness-clear'),
    likenessRecording:   document.getElementById('likeness-recording'),
    btnLikenessStop:     document.getElementById('btn-likeness-stop'),
    likenessPreview:     document.getElementById('likeness-preview'),
    likenessPreviewText: document.getElementById('likeness-preview-text'),
    btnLikenessAdd:      document.getElementById('btn-likeness-add'),
    btnLikenessDiscard:  document.getElementById('btn-likeness-discard'),
    likenessTranscribing:document.getElementById('likeness-transcribing'),
    likenessStatus:      document.getElementById('likeness-status'),
    // Chat
    chatMessages:      document.getElementById('chat-messages'),
    sessionTimer:      document.getElementById('session-timer'),
    wordCounter:       document.getElementById('word-counter'),
    visualizerCanvas:  document.getElementById('visualizer-canvas'),
    visualizerStatus:  document.getElementById('visualizer-status'),
    liveTranscript:    document.getElementById('live-transcript'),
    transcriptLoading: document.getElementById('transcript-loading'),
    btnProceed:        document.getElementById('btn-proceed'),
    btnEndSession:        document.getElementById('btn-end-session'),
    // Chat-screen settings drawer
    btnChatSettings:      document.getElementById('btn-chat-settings'),
    sessionDrawer:        document.getElementById('session-drawer'),
    btnDrawerClose:       document.getElementById('btn-drawer-close'),
    drawerSliderThreshold: document.getElementById('drawer-slider-threshold'),
    drawerSliderSilence:   document.getElementById('drawer-slider-silence'),
    drawerValThreshold:    document.getElementById('drawer-val-threshold'),
    drawerValSilence:      document.getElementById('drawer-val-silence'),
    drawerAdvMuteMic:      document.getElementById('drawer-adv-mute-mic'),
    drawerAdvIgnoreTts:    document.getElementById('drawer-adv-ignore-tts'),
    drawerAdvFilterFillers:document.getElementById('drawer-adv-filter-fillers'),
    drawerAdvDebug:        document.getElementById('drawer-adv-debug'),
    drawerStatus:          document.getElementById('drawer-status'),
    advMuteMic:            document.getElementById('adv-mute-mic'),
    advIgnoreTts:          document.getElementById('adv-ignore-tts'),
    advFilterFillers:      document.getElementById('adv-filter-fillers'),
    advDebug:              document.getElementById('adv-debug'),
    ttsAudio:          document.getElementById('tts-audio'),
    // Finish
    statDuration:      document.getElementById('stat-duration'),
    statWords:         document.getElementById('stat-words'),
    statParagraphs:    document.getElementById('stat-paragraphs'),
    btnHome:           document.getElementById('btn-home'),
    // Biography screen
    btnBioBack:        document.getElementById('btn-bio-back'),
    bioContent:        document.getElementById('bio-content'),
    // Sessions screen
    btnSessionsBack:   document.getElementById('btn-sessions-back'),
    sessionsList:      document.getElementById('sessions-list'),
    // Image explorer
    btnImageBack:       document.getElementById('btn-image-back'),
    imageViewer:        document.getElementById('image-viewer'),
    imageViewerImg:     document.getElementById('image-viewer-img'),
    imageGalleryGrid:   document.getElementById('image-gallery-grid'),
};

const START_BUTTON_HTML = 'Start Today\'s Session <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="icon-arrow"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
const START_BUTTON_LOADING_HTML = '<span class="session-loading-label">Preparing your story</span><span class="session-loading-dots" aria-hidden="true"><span></span><span></span><span></span></span>';

function setStartButtonLoading(loading) {
    el.btnStart.disabled = loading;
    el.btnStart.classList.toggle('is-session-loading', loading);
    el.btnStart.classList.toggle('pulse-effect', !loading);
    el.btnStart.innerHTML = loading ? START_BUTTON_LOADING_HTML : START_BUTTON_HTML;
}

const canvasCtx = el.visualizerCanvas.getContext('2d');

// ─── Screen navigation ────────────────────────────────────────────────────────

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.toggle('active', screen.id === id);
    });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    el.loginForm.addEventListener('submit', handleLogin);
    el.btnShowCreateUser.addEventListener('click', openCreateUserScreen);
    el.btnCreateBack.addEventListener('click', () => showScreen('screen-login'));
    el.createGateForm.addEventListener('submit', handleCreateGate);
    el.createUserForm.addEventListener('submit', handleCreateUser);
    el.createAge.addEventListener('input', () => {
        el.createAgeValue.textContent = el.createAge.value;
    });
    el.btnRecordCreateAbout.addEventListener('click', () => startOnboardingRecording('about'));
    el.btnStopCreateAbout.addEventListener('click', () => stopOnboardingRecording('about'));
    el.btnClearCreateAbout.addEventListener('click', () => clearOnboardingText('about'));
    el.btnRecordCreateLikeness.addEventListener('click', () => startOnboardingRecording('likeness'));
    el.btnStopCreateLikeness.addEventListener('click', () => stopOnboardingRecording('likeness'));
    el.btnClearCreateLikeness.addEventListener('click', () => clearOnboardingText('likeness'));
    el.btnShowChangePassword.addEventListener('click', showChangePasswordPanel);
    el.changePasswordForm.addEventListener('submit', handleChangePassword);
    el.btnLogout.addEventListener('click', handleLogout);

    el.btnStart.addEventListener('click', startSession);
    el.btnProceed.addEventListener('click', handleProceed);
    el.btnEndSession.addEventListener('click', finishSession);
    el.btnHome.addEventListener('click', goHome);

    // Tappable stat cards
    el.statCardSessions.addEventListener('click', showSessions);
    el.statCardBiography.addEventListener('click', showBiography);

    // Biography back
    el.btnBioBack.addEventListener('click', () => showScreen('screen-home'));

    // Sessions back
    el.btnSessionsBack.addEventListener('click', () => showScreen('screen-home'));

    // Image explorer
    document.getElementById('home-portrait-frame').addEventListener('click', openImageExplorer);
    el.btnImageBack.addEventListener('click', () => showScreen('screen-home'));
    setupImagePanHandlers();

    // Chat-screen settings drawer
    el.btnChatSettings.addEventListener('click', openSessionDrawer);
    el.btnDrawerClose.addEventListener('click', closeSessionDrawer);

    el.drawerSliderThreshold.addEventListener('input', () => {
        const val = parseInt(el.drawerSliderThreshold.value) / 100;
        state.settings.vad_threshold        = val;
        el.drawerValThreshold.textContent   = val.toFixed(2);
        el.valThreshold.textContent         = val.toFixed(2);
        el.sliderThreshold.value            = el.drawerSliderThreshold.value;
        pushLiveVadUpdate();
        scheduleSettingsSave();
    });

    el.drawerSliderSilence.addEventListener('input', () => {
        const val = parseInt(el.drawerSliderSilence.value);
        state.settings.silence_duration_ms  = val;
        el.drawerValSilence.textContent     = (val / 1000).toFixed(1) + ' sec';
        el.valSilence.textContent           = (val / 1000).toFixed(1) + ' sec';
        el.sliderSilence.value              = val;
        pushLiveVadUpdate();
        scheduleSettingsSave();
    });

    bindAdvancedSetting(el.advMuteMic,       'mute_mic_during_tts');
    bindAdvancedSetting(el.advIgnoreTts,     'ignore_transcripts_during_tts');
    bindAdvancedSetting(el.advFilterFillers, 'filter_hallucinated_fillers');
    bindAdvancedSetting(el.advDebug,         'debug_realtime_events');
    bindAdvancedSetting(el.drawerAdvMuteMic,       'mute_mic_during_tts', true);
    bindAdvancedSetting(el.drawerAdvIgnoreTts,     'ignore_transcripts_during_tts', true);
    bindAdvancedSetting(el.drawerAdvFilterFillers, 'filter_hallucinated_fillers', true);
    bindAdvancedSetting(el.drawerAdvDebug,         'debug_realtime_events', true);

    // Settings panel
    el.btnSettings.addEventListener('click', () => {
        loadPersonalityAdditions();
        loadLikenessInstructions();
        hideChangePasswordPanel();
        showScreen('screen-settings');
    });
    el.btnSettingsBack.addEventListener('click', () => showScreen('screen-home'));
    el.btnSettingsDone.addEventListener('click', () => showScreen('screen-home'));

    el.sliderThreshold.addEventListener('input', () => {
        const val = parseInt(el.sliderThreshold.value) / 100;
        state.settings.vad_threshold = val;
        el.valThreshold.textContent = val.toFixed(2);
        scheduleSettingsSave();
    });

    el.sliderSilence.addEventListener('input', () => {
        const val = parseInt(el.sliderSilence.value);
        state.settings.silence_duration_ms = val;
        el.valSilence.textContent = (val / 1000).toFixed(1) + ' sec';
        scheduleSettingsSave();
    });

    // Personality
    el.btnRecordPersonality.addEventListener('click', startPersonalityRecording);
    el.btnPersonalityStop.addEventListener('click', stopPersonalityRecording);
    el.btnPersonalityAdd.addEventListener('click', addPersonalityInstruction);
    el.btnPersonalityDiscard.addEventListener('click', discardPersonalityInstruction);
    el.btnPersonalityClear.addEventListener('click', clearPersonalityInstructions);

    // Image likeness instructions
    el.btnRecordLikeness.addEventListener('click', startLikenessRecording);
    el.btnLikenessStop.addEventListener('click', stopLikenessRecording);
    el.btnLikenessAdd.addEventListener('click', addLikenessInstruction);
    el.btnLikenessDiscard.addEventListener('click', discardLikenessInstruction);
    el.btnLikenessClear.addEventListener('click', clearLikenessInstructions);

    // Best-effort save when the page is hidden (tab close, navigation, crash)
    window.addEventListener('pagehide', () => {
        if (!state.sessionStartTime || !state.sessionId) return;
        flushPartial({ includeAudio: true, useBeacon: true });
    });

    initAuth();
});

function updateClock() {
    const now = new Date();
    el.statusTime.textContent =
        `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

function resizeCanvas() {
    const rect = el.visualizerCanvas.getBoundingClientRect();
    el.visualizerCanvas.width  = rect.width  * window.devicePixelRatio;
    el.visualizerCanvas.height = rect.height * window.devicePixelRatio;
    canvasCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

// ─── Authentication ──────────────────────────────────────────────────────────

async function initAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated) {
            enterAuthenticatedApp(data.username);
            return;
        }
    } catch {
        // Fall through to login.
    }
    showLoggedOut();
}

function enterAuthenticatedApp(username) {
    state.currentUser = username;
    if (el.currentUserPill) el.currentUserPill.textContent = username;
    if (el.settingsCurrentUser) el.settingsCurrentUser.textContent = username;
    showScreen('screen-home');
    fetchSettings();
    fetchStats();
    loadPortrait();
}

function showLoggedOut() {
    teardown();
    resetState();
    state.currentUser = '';
    if (el.currentUserPill) el.currentUserPill.textContent = '';
    if (el.settingsCurrentUser) el.settingsCurrentUser.textContent = '-';
    if (el.loginPassword) el.loginPassword.value = '';
    if (el.loginError) el.loginError.textContent = '';
    clearPortraitImages();
    showScreen('screen-login');
}

function openCreateUserScreen() {
    state.createUserGatePassword = '';
    state.onboardingText.about = '';
    state.onboardingText.likeness = '';
    el.createGateForm.reset();
    el.createUserForm.reset();
    el.createAge.value = '34';
    el.createAgeValue.textContent = '34';
    el.createGateError.textContent = '';
    el.createUserError.textContent = '';
    el.createUserSuccess.textContent = '';
    clearOnboardingText('about', false);
    clearOnboardingText('likeness', false);
    el.createGateForm.classList.remove('hidden');
    el.createUserForm.classList.add('hidden');
    showScreen('screen-create-user');
}

function clearPortraitImages() {
    ['home-portrait', 'finish-portrait', 'image-viewer-img'].forEach(id => {
        const img = document.getElementById(id);
        if (img) img.removeAttribute('src');
    });
    ['home-portrait-frame', 'finish-portrait-frame'].forEach(id => {
        const f = document.getElementById(id);
        if (f) f.classList.remove('has-image', 'rendering');
    });
}

async function handleLogin(event) {
    event.preventDefault();
    el.loginError.textContent = '';
    const username = el.loginUsername.value.trim();
    const password = el.loginPassword.value;
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        el.loginPassword.value = '';
        enterAuthenticatedApp(data.username);
    } catch (err) {
        el.loginError.textContent = err.message;
    }
}

async function handleCreateUser(event) {
    event.preventDefault();
    el.createUserError.textContent = '';
    el.createUserSuccess.textContent = '';
    const create_password = state.createUserGatePassword;
    const username = el.createUsername.value.trim();
    const password = el.createPassword.value;
    const gender = document.querySelector('input[name="create-gender"]:checked')?.value || '';
    const age = parseInt(el.createAge.value, 10);
    try {
        const res = await fetch('/api/auth/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                create_password,
                username,
                password,
                gender,
                age,
                about_text: state.onboardingText.about,
                likeness_text: state.onboardingText.likeness
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not create user');
        el.createUserSuccess.textContent = 'User created. Logging in...';
        el.loginUsername.value = username;
        el.loginPassword.value = password;
        el.createUserForm.reset();
        state.onboardingText.about = '';
        state.onboardingText.likeness = '';
        await handleLogin(new Event('submit'));
    } catch (err) {
        el.createUserError.textContent = err.message;
    }
}

function onboardingEls(kind) {
    if (kind === 'about') {
        return {
            idle: el.createAboutIdle,
            recording: el.createAboutRecording,
            transcribing: el.createAboutTranscribing,
            preview: el.createAboutPreview,
            previewText: el.createAboutPreviewText,
            clearButton: el.btnClearCreateAbout,
            status: el.createAboutStatus,
        };
    }
    return {
        idle: el.createLikenessIdle,
        recording: el.createLikenessRecording,
        transcribing: el.createLikenessTranscribing,
        preview: el.createLikenessPreview,
        previewText: el.createLikenessPreviewText,
        clearButton: el.btnClearCreateLikeness,
        status: el.createLikenessStatus,
    };
}

function showOnboardingRecordState(kind, nextState) {
    const parts = onboardingEls(kind);
    parts.idle.classList.toggle('hidden', nextState !== 'idle');
    parts.recording.classList.toggle('hidden', nextState !== 'recording');
    parts.transcribing.classList.toggle('hidden', nextState !== 'transcribing');
    parts.preview.classList.toggle('hidden', nextState !== 'preview');
}

async function startOnboardingRecording(kind) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
        state.onboardingMime[kind] = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
        state.onboardingChunks[kind] = [];
        state.onboardingRecorders[kind] = new MediaRecorder(stream, { mimeType: state.onboardingMime[kind] });
        state.onboardingRecorders[kind].ondataavailable = e => {
            if (e.data && e.data.size > 0) state.onboardingChunks[kind].push(e.data);
        };
        state.onboardingRecorders[kind].onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            showOnboardingRecordState(kind, 'transcribing');
            await transcribeOnboardingAudio(kind);
        };
        state.onboardingRecorders[kind].start();
        showOnboardingRecordState(kind, 'recording');
    } catch {
        showOnboardingStatus(kind, 'Microphone access denied.', true);
    }
}

function stopOnboardingRecording(kind) {
    const recorder = state.onboardingRecorders[kind];
    if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
    }
}

async function transcribeOnboardingAudio(kind) {
    try {
        const blob = new Blob(state.onboardingChunks[kind] || [], { type: state.onboardingMime[kind] || 'audio/webm' });
        const form = new FormData();
        form.append('create_password', state.createUserGatePassword);
        form.append('audio', blob, `${kind}.webm`);
        const res = await fetch('/api/auth/transcribe-onboarding', { method: 'POST', body: form });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (!data.text.trim()) throw new Error('No speech detected');
        state.onboardingText[kind] = data.text.trim();
        const parts = onboardingEls(kind);
        parts.previewText.textContent = state.onboardingText[kind];
        parts.clearButton.classList.remove('hidden');
        showOnboardingRecordState(kind, 'preview');
    } catch {
        showOnboardingRecordState(kind, 'idle');
        showOnboardingStatus(kind, 'Could not transcribe — please try again.', true);
    }
}

function clearOnboardingText(kind, showStatus = true) {
    state.onboardingText[kind] = '';
    const parts = onboardingEls(kind);
    parts.previewText.textContent = '';
    parts.clearButton.classList.add('hidden');
    showOnboardingRecordState(kind, 'idle');
    if (showStatus) showOnboardingStatus(kind, 'Cleared.');
}

function showOnboardingStatus(kind, msg, isError = false) {
    const status = onboardingEls(kind).status;
    status.textContent = msg;
    status.style.color = isError ? 'var(--accent-red)' : 'var(--accent-green)';
    status.classList.add('visible');
    setTimeout(() => status.classList.remove('visible'), 2500);
}

async function handleCreateGate(event) {
    event.preventDefault();
    el.createGateError.textContent = '';
    const create_password = el.createGatePassword.value;
    try {
        const res = await fetch('/api/auth/check-create-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ create_password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not unlock create-user form');
        state.createUserGatePassword = create_password;
        el.createGateForm.classList.add('hidden');
        el.createUserForm.classList.remove('hidden');
        el.createUsername.focus();
    } catch (err) {
        el.createGateError.textContent = err.message;
    }
}

async function handleChangePassword(event) {
    event.preventDefault();
    el.changePasswordError.textContent = '';
    el.changePasswordSuccess.textContent = '';
    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_password: el.currentPassword.value,
                new_password: el.newPassword.value
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not change password');
        el.changePasswordForm.reset();
        el.changePasswordSuccess.textContent = 'Password changed.';
    } catch (err) {
        el.changePasswordError.textContent = err.message;
    }
}

function showChangePasswordPanel() {
    el.changePasswordError.textContent = '';
    el.changePasswordSuccess.textContent = '';
    el.changePasswordPanel.classList.remove('hidden');
    el.currentPassword.focus();
}

function hideChangePasswordPanel() {
    el.changePasswordForm.reset();
    el.changePasswordError.textContent = '';
    el.changePasswordSuccess.textContent = '';
    el.changePasswordPanel.classList.add('hidden');
}

async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    showLoggedOut();
}

// ─── Homepage ─────────────────────────────────────────────────────────────────

async function fetchStats() {
    try {
        const res  = await fetch('/api/stats');
        if (res.status === 401) {
            showLoggedOut();
            return;
        }
        const data = await res.json();
        el.homeSessions.textContent   = data.session_count;
        el.homeParagraphs.textContent = data.biography_paragraphs;
    } catch {
        el.homeSessions.textContent   = '0';
        el.homeParagraphs.textContent = '0';
    }
}

function goHome() {
    teardown();
    resetState();
    showScreen('screen-home');
    fetchStats();
    // If a render is still in flight, let polling keep updating; otherwise load the saved one.
    if (!portraitPollTimer) loadPortrait();
}

// ─── Biography portrait ───────────────────────────────────────────────────────

let portraitPollTimer = null;
let lastPortraitRev    = null;

function setPortraitSrc(url) {
    ['home-portrait', 'finish-portrait'].forEach(id => {
        const img = document.getElementById(id);
        if (img) img.src = url;
    });
    ['home-portrait-frame', 'finish-portrait-frame'].forEach(id => {
        const f = document.getElementById(id);
        if (f) f.classList.add('has-image');
    });
}

async function openImageExplorer() {
    const homeImg = document.getElementById('home-portrait');
    if (!homeImg || !homeImg.src) return;

    showScreen('screen-image-explorer');
    selectExplorerImage(homeImg.src);
    await loadPortraitGallery();
}

async function loadPortraitGallery() {
    try {
        const res = await fetch('/api/portrait/gallery');
        const data = await res.json();
        state.portraitGallery = data.images || [];
        renderPortraitGallery();
    } catch {
        el.imageGalleryGrid.innerHTML = '<p class="gallery-empty">Could not load images.</p>';
    }
}

function renderPortraitGallery() {
    if (!state.portraitGallery.length) {
        el.imageGalleryGrid.innerHTML = '<p class="gallery-empty">No previous images yet.</p>';
        return;
    }

    el.imageGalleryGrid.innerHTML = '';
    state.portraitGallery.forEach(item => {
        const button = document.createElement('button');
        button.className = 'gallery-thumb';
        button.type = 'button';
        button.innerHTML = `
            <img src="${item.url}" alt="${item.label}">
            <span>${item.label}</span>
        `;
        button.addEventListener('click', () => selectExplorerImage(item.url));
        el.imageGalleryGrid.appendChild(button);
    });
}

function selectExplorerImage(url) {
    el.imageViewerImg.src = url;
    resetImagePan();
}

function setupImagePanHandlers() {
    el.imageViewer.addEventListener('pointerdown', e => {
        if (!el.imageViewerImg.src) return;
        state.imagePan.dragging = true;
        state.imagePan.lastX = e.clientX;
        state.imagePan.lastY = e.clientY;
        el.imageViewer.setPointerCapture(e.pointerId);
        el.imageViewer.classList.add('dragging');
    });

    el.imageViewer.addEventListener('pointermove', e => {
        if (!state.imagePan.dragging) return;
        const dx = e.clientX - state.imagePan.lastX;
        const dy = e.clientY - state.imagePan.lastY;
        state.imagePan.lastX = e.clientX;
        state.imagePan.lastY = e.clientY;
        state.imagePan.x += dx;
        state.imagePan.y += dy;
        applyImagePan();
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
        el.imageViewer.addEventListener(type, e => {
            state.imagePan.dragging = false;
            el.imageViewer.classList.remove('dragging');
            if (el.imageViewer.hasPointerCapture?.(e.pointerId)) {
                el.imageViewer.releasePointerCapture(e.pointerId);
            }
        });
    });

    el.imageViewer.addEventListener('dblclick', resetImagePan);
}

function applyImagePan() {
    el.imageViewerImg.style.transform =
        `translate(-50%, -50%) translate(${state.imagePan.x}px, ${state.imagePan.y}px) scale(1.65)`;
}

function resetImagePan() {
    state.imagePan = { x: 0, y: 0, dragging: false, lastX: 0, lastY: 0 };
    if (el.imageViewerImg) {
        el.imageViewerImg.style.transform = 'translate(-50%, -50%) translate(0px, 0px) scale(1.65)';
    }
}

function setPortraitRendering(on) {
    ['home-portrait-frame', 'finish-portrait-frame'].forEach(id => {
        const f = document.getElementById(id);
        if (f) f.classList.toggle('rendering', on);
    });
    const cap = document.getElementById('finish-portrait-caption');
    if (cap) cap.textContent = on ? 'Painting your story…' : 'Your story so far';
}

// Load the last saved portrait (used on app open / returning home).
async function loadPortrait() {
    try {
        const res  = await fetch('/api/portrait');
        const data = await res.json();
        if (data.exists) setPortraitSrc(data.url);
    } catch { /* no portrait yet — show nothing */ }
}

function stopPortraitPolling() {
    if (portraitPollTimer) { clearInterval(portraitPollTimer); portraitPollTimer = null; }
}

// Kick off generation and stream the progressive frames into the portrait frames.
async function startPortraitGeneration() {
    lastPortraitRev = null;
    try { await fetch('/api/portrait/generate', { method: 'POST' }); }
    catch (e) { console.error('Portrait generation failed to start:', e); return; }

    setPortraitRendering(true);
    stopPortraitPolling();

    const poll = async () => {
        try {
            const res  = await fetch('/api/portrait/status');
            const data = await res.json();

            if (data.frame_url && data.rev !== lastPortraitRev) {
                lastPortraitRev = data.rev;
                setPortraitSrc(data.frame_url);   // frame_url already carries a rev cache-buster
            }
            if (data.status === 'ready') {
                setPortraitRendering(false);
                stopPortraitPolling();
                loadPortrait();                   // swap to the persisted current.png
            } else if (data.status === 'error' || data.status === 'skipped') {
                setPortraitRendering(false);
                stopPortraitPolling();
            }
        } catch { /* transient — keep polling */ }
    };
    poll();
    portraitPollTimer = setInterval(poll, 1500);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

async function fetchSettings() {
    try {
        const res  = await fetch('/api/settings');
        const data = await res.json();
        state.settings = { ...state.settings, ...data };
    } catch {
        // keep defaults already in state
    }
    applySettingsToUI();
}

function applySettingsToUI() {
    el.sliderThreshold.value  = Math.round(state.settings.vad_threshold * 100);
    el.valThreshold.textContent = state.settings.vad_threshold.toFixed(2);

    el.sliderSilence.value    = state.settings.silence_duration_ms;
    el.valSilence.textContent = (state.settings.silence_duration_ms / 1000).toFixed(1) + ' sec';

    syncAdvancedToggles();
}

function bindAdvancedSetting(input, key, showDrawerStatus = false) {
    if (!input) return;
    input.addEventListener('change', () => {
        state.settings[key] = input.checked;
        syncAdvancedToggles();
        applyMicMuteForCurrentTurn();
        scheduleSettingsSave();
        if (showDrawerStatus) showDrawerApplied();
    });
}

function syncAdvancedToggles() {
    [
        [el.advMuteMic,       'mute_mic_during_tts'],
        [el.advIgnoreTts,     'ignore_transcripts_during_tts'],
        [el.advFilterFillers, 'filter_hallucinated_fillers'],
        [el.advDebug,         'debug_realtime_events'],
        [el.drawerAdvMuteMic,       'mute_mic_during_tts'],
        [el.drawerAdvIgnoreTts,     'ignore_transcripts_during_tts'],
        [el.drawerAdvFilterFillers, 'filter_hallucinated_fillers'],
        [el.drawerAdvDebug,         'debug_realtime_events'],
    ].forEach(([input, key]) => {
        if (input) input.checked = Boolean(state.settings[key]);
    });
}

let _saveTimer = null;
function scheduleSettingsSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
        try {
            await fetch('/api/settings', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(state.settings)
            });
            el.saveStatus.textContent = '✓  Saved';
            el.saveStatus.classList.add('visible');
            setTimeout(() => el.saveStatus.classList.remove('visible'), 2000);
        } catch {
            el.saveStatus.textContent = 'Could not save';
            el.saveStatus.classList.add('visible');
        }
    }, 600);
}

function openSessionDrawer() {
    // Sync sliders to current settings before showing
    el.drawerSliderThreshold.value  = Math.round(state.settings.vad_threshold * 100);
    el.drawerValThreshold.textContent = state.settings.vad_threshold.toFixed(2);
    el.drawerSliderSilence.value    = state.settings.silence_duration_ms;
    el.drawerValSilence.textContent = (state.settings.silence_duration_ms / 1000).toFixed(1) + ' sec';
    syncAdvancedToggles();
    el.drawerStatus.classList.remove('visible');
    el.sessionDrawer.classList.add('open');
}

function closeSessionDrawer() {
    el.sessionDrawer.classList.remove('open');
}

function pushLiveVadUpdate() {
    if (!state.dataChannel || state.dataChannel.readyState !== 'open') return;
    state.dataChannel.send(JSON.stringify({
        type: "session.update",
        session: {
            audio: {
                input: {
                    turn_detection: {
                        type:                "server_vad",
                        threshold:           state.settings.vad_threshold,
                        silence_duration_ms: state.settings.silence_duration_ms,
                        prefix_padding_ms:   300,
                        create_response:     false
                    }
                }
            }
        }
    }));
    console.log(`[VAD] Live update → threshold=${state.settings.vad_threshold} silence=${state.settings.silence_duration_ms}ms`);
    showDrawerApplied();
}

function showDrawerApplied() {
    el.drawerStatus.textContent = '✓  Applied';
    el.drawerStatus.classList.add('visible');
    setTimeout(() => el.drawerStatus.classList.remove('visible'), 1800);
}

// ─── Session start ────────────────────────────────────────────────────────────

async function startSession() {
    setStartButtonLoading(true);

    try {
        // Session ID used to group all output files for this session.
        const now = new Date();
        state.sessionId = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0'),
            '_',
            String(now.getHours()).padStart(2, '0'),
            String(now.getMinutes()).padStart(2, '0'),
            String(now.getSeconds()).padStart(2, '0')
        ].join('');

        // 1. Fetch personalized greeting + question pool (larger model)
        const planRes  = await fetch('/api/session-plan', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ session_id: state.sessionId })
        });
        const planData = await planRes.json();
        if (planData.error) throw new Error(planData.error);
        if (planData.session_id) state.sessionId = planData.session_id;

        state.preparedQuestionsPool = planData.questions || [];
        const greeting = planData.greeting || 'Hello! How are you doing today?';

        console.log('[SESSION] Greeting:', greeting);
        console.log('[SESSION] Question pool:', state.preparedQuestionsPool);

        // 2. Microphone access
        state.audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });

        // 3. MediaRecorder for full-session audio
        const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
        state.mimeType        = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
        state.sessionChunks   = [];
        state.sessionRecorder = new MediaRecorder(state.audioStream, { mimeType: state.mimeType });
        state.sessionRecorder.ondataavailable = e => {
            if (e.data && e.data.size > 0) state.sessionChunks.push(e.data);
        };
        state.sessionStartTime = new Date();
        state.sessionStartPerf = performance.now();
        state.sessionRecorder.start();

        // 4. Waveform visualizer
        setupVisualizer();

        // 5. OpenAI Realtime API (WebRTC) for live transcription
        await setupRealtimeTranscription();

        // 6. Session timer
        let elapsed = 0;
        state.timerInterval = setInterval(() => {
            elapsed = Math.floor(sessionSeconds());
            el.sessionTimer.textContent = formatTime(elapsed);
        }, 1000);

        // 7. Show chat screen and speak the greeting
        el.chatMessages.innerHTML    = '';
        el.wordCounter.textContent   = '0 words';
        el.btnEndSession.disabled    = false;
        showScreen('screen-chat');

        askDynamicQuestion({ acknowledgment: '', question: greeting, action: 'greeting' });

    } catch (err) {
        console.error('Session start failed:', err);
        alert(`Could not start session: ${err.message}`);
        setStartButtonLoading(false);
    }
}

// ─── Dynamic question flow ────────────────────────────────────────────────────

async function askDynamicQuestion({ acknowledgment, question, action, question_meta, questionMeta }) {
    state.turnNumber++;
    state.lastQuestion = question;
    state.lastQuestionMeta = question_meta || questionMeta || {};
    setPatientSpeechActive(false);

    const isWrapUp   = action === 'wrap_up';
    const spokenText = [acknowledgment, question].filter(Boolean).join(' ')
                       || 'Thank you so much for sharing your story today!';
    const turnNumber = state.turnNumber;

    // Show in chat: acknowledgment and question as separate bubbles when both present
    if (acknowledgment) appendMessage(acknowledgment, 'chatbot');
    if (question)       appendMessage(question, 'chatbot');

    let agentStartSeconds = null;
    let agentTranscriptSaved = false;
    let agentAudioFilePath = '';
    const finalizeAgentTranscript = () => {
        if (agentTranscriptSaved) return;
        const endSeconds = sessionSeconds();
        state.transcripts.push(createTranscriptEntry({
            questionNumber: turnNumber,
            speaker: 'Chatbot',
            text: spokenText,
            startSeconds: agentStartSeconds ?? endSeconds,
            endSeconds,
            audioFilePath: agentAudioFilePath
        }));
        agentTranscriptSaved = true;
        state.pendingAgentTranscriptFinalizer = null;
    };
    state.pendingAgentTranscriptFinalizer = finalizeAgentTranscript;
    let agentContinuationStarted = false;
    const continueAfterAgent = (delayMs = 0) => {
        if (agentContinuationStarted) return;
        agentContinuationStarted = true;
        const next = () => {
            if (isWrapUp) finishSession();
            else enablePatientTurn();
        };
        if (delayMs > 0) setTimeout(next, delayMs);
        else next();
    };

    // Reset patient input
    state.liveTranscriptText  = '';
    state.pendingDelta        = '';
    el.liveTranscript.value   = '';
    el.liveTranscript.disabled = true;
    el.btnProceed.disabled     = true;
    el.visualizerStatus.textContent = 'Chatbot speaking…';

    try {
        const res  = await fetch('/api/tts', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                text: spokenText,
                session_id: state.sessionId,
                turn_number: turnNumber
            })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'TTS failed');
        agentAudioFilePath = data.audio_file_path || '';
        el.ttsAudio.onplay = () => {
            if (agentStartSeconds === null) agentStartSeconds = sessionSeconds();
        };
        el.ttsAudio.onended = () => {
            finalizeAgentTranscript();
            continueAfterAgent();
        };
        el.ttsAudio.onerror = () => {
            finalizeAgentTranscript();
            continueAfterAgent(800);
        };
        el.ttsAudio.src = data.audio_url;
        await el.ttsAudio.play();
    } catch (err) {
        console.error('TTS playback failed:', err);
        finalizeAgentTranscript();
        continueAfterAgent(800);
    }
}

// ─── Partial save (crash recovery) ───────────────────────────────────────────

function flushPartial({ includeAudio = false, useBeacon = false } = {}) {
    if (!state.sessionId || !state.sessionStartTime) return;

    const form = new FormData();
    form.append('session_id', state.sessionId);
    form.append('transcript',  JSON.stringify(state.transcripts));

    if (includeAudio && state.sessionChunks.length > 0) {
        const blob = new Blob(state.sessionChunks, { type: state.mimeType || 'audio/webm' });
        form.append('audio', blob, 'partial.webm');
    }

    if (useBeacon) {
        // sendBeacon is guaranteed to fire even as the page unloads
        navigator.sendBeacon('/api/partial-save', form);
    } else {
        // Fire-and-forget — don't block the UI
        fetch('/api/partial-save', { method: 'POST', body: form }).catch(() => {});
    }
}

// ─── Proceed / next question ──────────────────────────────────────────────────

async function handleProceed() {
    const response = el.liveTranscript.value.trim();
    const patientEndSeconds = response
        ? (state.currentPatientSpeechEndSeconds ?? sessionSeconds())
        : sessionSeconds();
    const patientStartSeconds = response
        ? (state.currentPatientSpeechStartSeconds ?? state.currentPatientTurnStartSeconds ?? patientEndSeconds)
        : (state.currentPatientTurnStartSeconds ?? patientEndSeconds);
    setPatientSpeechActive(false);

    appendMessage(response || '(no response)', 'patient');
    state.transcripts.push(createTranscriptEntry({
        questionNumber: state.turnNumber,
        speaker: 'Patient',
        text: response,
        startSeconds: patientStartSeconds,
        endSeconds: patientEndSeconds
    }));

    const words = response ? response.split(/\s+/).filter(Boolean).length : 0;
    state.prevQuestionsWordCount += words;
    state.totalWordCount          = state.prevQuestionsWordCount;
    el.wordCounter.textContent    = `${state.totalWordCount} words`;

    // Record exchange for follow-up context
    state.conversationHistory.push({
        question: state.lastQuestion,
        question_meta: state.lastQuestionMeta,
        response
    });

    // Partial save: transcript every turn, audio every 3 turns
    flushPartial();
    if (state.conversationHistory.length % 3 === 0) {
        flushPartial({ includeAudio: true });
    }

    // Hit 500-word minimum — end immediately
    if (state.totalWordCount >= 500) {
        await finishSession();
        return;
    }

    // Fetch next question from server
    el.liveTranscript.disabled      = true;
    el.btnProceed.disabled          = true;
    el.visualizerStatus.textContent = 'Thinking…';

    try {
        const res = await fetch('/api/next-question', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                conversation_history: state.conversationHistory,
                prepared_questions:   state.preparedQuestionsPool,
                declined_topics:      state.declinedTopics,
                explored_new_details: state.exploredNewDetails,
                followup_depth:       state.followupDepth,
                awaiting_consent:     state.awaitingConsent,
                session_id:           state.sessionId
            })
        });
        const next = await res.json();

        console.log(`[NEXT-Q] action=${next.action} | ${next.reasoning}`);

        if (next.action !== 'wrap_up') {
            state.preparedQuestionsPool = next.remaining_prepared ?? state.preparedQuestionsPool;
            state.declinedTopics         = next.declined_topics    ?? state.declinedTopics;
            state.exploredNewDetails    = next.explored_new_details ?? state.exploredNewDetails;
            state.followupDepth         = next.followup_depth     ?? 0;
            state.awaitingConsent       = next.awaiting_consent   ?? false;
        }

        await askDynamicQuestion(next);

    } catch (err) {
        console.error('Next question error:', err);
        await finishSession();
    }
}

function enablePatientTurn() {
    state.currentPatientTurnStartSeconds = sessionSeconds();
    state.currentPatientSpeechStartSeconds = null;
    state.currentPatientSpeechEndSeconds = null;
    setPatientSpeechActive(true);
    el.liveTranscript.disabled      = false;
    el.btnProceed.disabled          = false;
    el.visualizerStatus.textContent = 'Listening… speak now';
    setButtonLabel(state.totalWordCount >= 500 ? 'finish' : 'proceed');
}

function setPatientSpeechActive(active) {
    state.acceptingPatientSpeech = Boolean(active);
    applyMicMuteForCurrentTurn();
}

function applyMicMuteForCurrentTurn() {
    if (!state.audioStream) return;
    const shouldMute = state.settings.mute_mic_during_tts && !state.acceptingPatientSpeech;
    state.audioStream.getAudioTracks().forEach(track => {
        track.enabled = !shouldMute;
    });
    if (state.settings.debug_realtime_events) {
        console.log(`[AUDIO] mic ${shouldMute ? 'muted' : 'enabled'} | acceptingPatientSpeech=${state.acceptingPatientSpeech}`);
    }
}

function setButtonLabel(mode) {
    if (mode === 'finish') {
        el.btnProceed.innerHTML = `Finish Session <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="icon-arrow"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else {
        el.btnProceed.innerHTML = `Proceed <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="icon-arrow"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
    }
}

// ─── WebRTC Realtime transcription ────────────────────────────────────────────

async function setupRealtimeTranscription() {
    const pc = new RTCPeerConnection();
    state.peerConnection = pc;

    state.audioStream.getTracks().forEach(track => pc.addTrack(track, state.audioStream));

    const dc = pc.createDataChannel("oai-events");
    state.dataChannel = dc;

    pc.ontrack = e => console.log('[RT] incoming track:', e.track.kind);

    dc.addEventListener("open", () => {
        console.log('[RT] data channel open');
        dc.send(JSON.stringify({
            type: "session.update",
            session: {
                type: "realtime",
                audio: {
                    input: {
                        transcription: {
                            model: "whisper-1"
                        },
                        turn_detection: {
                            type:                "server_vad",
                            threshold:           state.settings.vad_threshold,
                            silence_duration_ms: state.settings.silence_duration_ms,
                            prefix_padding_ms:   300,
                            create_response:     false
                        }
                    }
                },
                instructions: "You are a transcription assistant. Do not respond to the user."
            }
        }));
    });

    dc.addEventListener("error", e => console.error('[RT] data channel error:', e));
    dc.addEventListener("close",  () => console.log('[RT] data channel closed'));

    dc.addEventListener("message", e => {
        if (state.settings.debug_realtime_events) {
            console.log('[RT] raw:', e.data.substring(0, 300));
        }
        try { handleRealtimeEvent(JSON.parse(e.data)); }
        catch (err) { console.error("Realtime parse error:", err); }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpRes = await fetch("/api/realtime-sdp", {
        method:  "POST",
        body:    offer.sdp,
        headers: { "Content-Type": "application/sdp" }
    });

    if (!sdpRes.ok) {
        throw new Error(`Realtime SDP failed: ${await sdpRes.text()}`);
    }

    await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
}

function handleRealtimeEvent(event) {
    switch (event.type) {
        case "conversation.item.input_audio_transcription.delta":
            if (!shouldAcceptRealtimeTranscript(event)) break;
            state.pendingDelta += cleanTranscriptFragment(event.delta || "", { partial: true });
            refreshTranscriptUI();
            break;

        case "conversation.item.input_audio_transcription.completed":
            if (!shouldAcceptRealtimeTranscript(event)) {
                if (state.settings.debug_realtime_events) {
                    console.log('[RT] ignored transcript outside patient turn:', event.transcript || '');
                }
                state.pendingDelta = "";
                break;
            }
            {
                const cleaned = cleanTranscriptFragment(event.transcript || "");
                if (cleaned) state.liveTranscriptText += cleaned + " ";
            }
            state.pendingDelta        = "";
            refreshTranscriptUI();
            break;

        case "input_audio_buffer.speech_started":
            state.activeRealtimeItemAccepting =
                state.acceptingPatientSpeech || !state.settings.ignore_transcripts_during_tts;
            if (event.item_id) {
                state.realtimeItems[event.item_id] = state.activeRealtimeItemAccepting;
            }
            if (state.activeRealtimeItemAccepting && state.currentPatientSpeechStartSeconds === null) {
                state.currentPatientSpeechStartSeconds = sessionSeconds();
            }
            if (state.settings.debug_realtime_events) {
                console.log(`[RT] speech_started accepting=${state.activeRealtimeItemAccepting}`, event);
            }
            if (!el.liveTranscript.disabled) el.visualizerStatus.textContent = "Listening…";
            break;

        case "input_audio_buffer.speech_stopped":
            if (state.activeRealtimeItemAccepting) {
                state.currentPatientSpeechEndSeconds = sessionSeconds();
            }
            if (state.settings.debug_realtime_events) {
                console.log('[RT] speech_stopped', event);
            }
            if (!el.liveTranscript.disabled) el.visualizerStatus.textContent = "Processing…";
            break;

        case "error":
            console.error('[RT] API error:', event.error);
            break;

        default:
            break;
    }
}

function shouldAcceptRealtimeTranscript(event) {
    if (!state.settings.ignore_transcripts_during_tts) return true;
    if (event.item_id && Object.prototype.hasOwnProperty.call(state.realtimeItems, event.item_id)) {
        return Boolean(state.realtimeItems[event.item_id]);
    }
    return Boolean(state.activeRealtimeItemAccepting || state.acceptingPatientSpeech);
}

function cleanTranscriptFragment(text, { partial = false } = {}) {
    const original = (text || '').replace(/\s+/g, ' ').trim();
    if (!original || partial || !state.settings.filter_hallucinated_fillers) return original;

    const fillerOnly = /^(?:bye|bye bye|thanks|thank you|thank you very much)[.!?,\s]*$/i;
    if (fillerOnly.test(original)) {
        if (state.settings.debug_realtime_events) console.log('[RT] dropped filler transcript:', original);
        return '';
    }

    const cleaned = original.replace(/^(?:(?:bye|thanks|thank you(?: very much)?)[.!?,]*\s+)+(?=\S)/i, '').trim();
    if (state.settings.debug_realtime_events && cleaned !== original) {
        console.log('[RT] cleaned filler prefix:', { original, cleaned });
    }
    return cleaned;
}

function refreshTranscriptUI() {
    const fullText = (state.liveTranscriptText + state.pendingDelta).trim();
    el.liveTranscript.value = fullText;

    if (fullText && state.acceptingPatientSpeech && state.currentPatientSpeechStartSeconds === null) {
        state.currentPatientSpeechStartSeconds = state.currentPatientTurnStartSeconds ?? sessionSeconds();
    }

    const currentWords  = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
    const totalWords    = state.prevQuestionsWordCount + currentWords;
    state.totalWordCount = totalWords;
    el.wordCounter.textContent = `${totalWords} words`;

    if (totalWords >= 500 && !el.liveTranscript.disabled) {
        setButtonLabel('finish');
    }
}

// ─── Finish session ───────────────────────────────────────────────────────────

async function finishSession() {
    if (state.isFinishing || state.sessionSaved) return;
    state.isFinishing = true;
    if (typeof state.pendingAgentTranscriptFinalizer === 'function') {
        state.pendingAgentTranscriptFinalizer();
    }
    el.ttsAudio.onplay = null;
    el.ttsAudio.onended = null;
    el.ttsAudio.onerror = null;
    el.ttsAudio.pause();

    setPatientSpeechActive(false);
    el.liveTranscript.disabled      = true;
    el.btnProceed.disabled          = true;
    el.btnEndSession.disabled       = true;
    el.visualizerStatus.textContent = 'Saving session…';

    if (state.sessionRecorder && state.sessionRecorder.state !== 'inactive') {
        state.sessionRecorder.stop();
    }
    cancelAnimationFrame(state.animationFrameId);
    clearInterval(state.timerInterval);

    if (state.dataChannel)    state.dataChannel.close();
    if (state.peerConnection) state.peerConnection.close();
    if (state.audioStream)    state.audioStream.getTracks().forEach(t => t.stop());

    const durationSecs = Math.floor(sessionSeconds());

    await new Promise(r => setTimeout(r, 600));

    // Save audio + transcript CSV
    const blob = new Blob(state.sessionChunks, { type: state.mimeType });
    const form = new FormData();
    form.append('session_id', state.sessionId);
    form.append('audio',      blob, 'session.webm');
    form.append('transcript', JSON.stringify(state.transcripts));
    try {
        await fetch('/api/save_session', { method: 'POST', body: form });
        state.sessionSaved = true;
        // Remove partial-save files now that the full session is saved
        fetch('/api/cleanup-partial', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ session_id: state.sessionId })
        }).catch(() => {});
    } catch (e) {
        console.error('Save session failed:', e);
    }

    // Update biography
    let bioParagraphs = '–';
    try {
        const bioRes  = await fetch('/api/update-biography', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ transcript: state.transcripts })
        });
        const bioData = await bioRes.json();
        bioParagraphs = bioData.biography_paragraphs ?? '–';
    } catch (e) {
        console.error('Biography update failed:', e);
    }

    el.statDuration.textContent   = formatDuration(durationSecs);
    el.statWords.textContent      = state.totalWordCount;
    el.statParagraphs.textContent = bioParagraphs;
    showScreen('screen-finish');

    // Show the previous portrait immediately, then stream the new one over it.
    loadPortrait();
    startPortraitGeneration();
}

// ─── Waveform visualizer ──────────────────────────────────────────────────────

function setupVisualizer() {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    state.analyser     = state.audioContext.createAnalyser();
    state.analyser.fftSize = 256;
    state.dataArray    = new Uint8Array(state.analyser.frequencyBinCount);
    state.sourceNode   = state.audioContext.createMediaStreamSource(state.audioStream);
    state.sourceNode.connect(state.analyser);
    drawVisualizer();
}

function drawVisualizer() {
    if (!state.analyser) return;
    state.animationFrameId = requestAnimationFrame(drawVisualizer);
    state.analyser.getByteFrequencyData(state.dataArray);

    let sum = 0;
    for (let i = 0; i < state.dataArray.length; i++) sum += state.dataArray[i] ** 2;
    const rms = Math.sqrt(sum / state.dataArray.length) / 255;

    const w = el.visualizerCanvas.width;
    const h = el.visualizerCanvas.height;
    canvasCtx.clearRect(0, 0, w, h);

    const amp   = el.liveTranscript.disabled ? 0.05 : (rms * 3 + 0.08);
    const waves = [
        { color: 'rgba(59,130,246,0.65)', freq: 0.015, a: 22 },
        { color: 'rgba(6,182,212,0.45)',  freq: 0.025, a: 14 },
        { color: 'rgba(139,92,246,0.3)',  freq: 0.008, a: 30 },
    ];
    const t = Date.now() * 0.003;

    waves.forEach((wave, i) => {
        canvasCtx.beginPath();
        canvasCtx.strokeStyle = wave.color;
        canvasCtx.lineWidth   = i === 0 ? 2.5 : 1.5;
        for (let x = 0; x < w; x++) {
            const env = Math.sin((x / w) * Math.PI);
            const y   = h / 2 + Math.sin(x * wave.freq + t * (i + 1)) * wave.a * amp * env;
            x === 0 ? canvasCtx.moveTo(x, y) : canvasCtx.lineTo(x, y);
        }
        canvasCtx.stroke();
    });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function appendMessage(text, speaker) {
    const div = document.createElement('div');
    div.className   = `message-bubble ${speaker}`;
    div.textContent = text;
    el.chatMessages.appendChild(div);
    el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

function getTimestamp() {
    return formatSessionTimestamp(sessionSeconds(), { includeMillis: false });
}

function sessionSeconds() {
    if (state.sessionStartPerf !== null) {
        return Math.max(0, (performance.now() - state.sessionStartPerf) / 1000);
    }
    if (!state.sessionStartTime) return 0;
    return Math.max(0, (Date.now() - state.sessionStartTime.getTime()) / 1000);
}

function roundSeconds(seconds) {
    return Math.round(Math.max(0, Number(seconds) || 0) * 1000) / 1000;
}

function formatSessionTimestamp(seconds, { includeMillis = true } = {}) {
    const totalMillis = Math.round(Math.max(0, Number(seconds) || 0) * 1000);
    const wholeSeconds = Math.floor(totalMillis / 1000);
    const millis = totalMillis % 1000;
    const base = [
        Math.floor(wholeSeconds / 3600),
        Math.floor((wholeSeconds % 3600) / 60),
        wholeSeconds % 60
    ].map(n => String(n).padStart(2, '0')).join(':');
    return includeMillis ? `${base}.${String(millis).padStart(3, '0')}` : base;
}

function createTranscriptEntry({ questionNumber, speaker, text, startSeconds, endSeconds, audioFilePath = '' }) {
    const start = roundSeconds(startSeconds);
    const end = Math.max(start, roundSeconds(endSeconds));
    return {
        question_number: questionNumber,
        timestamp: formatSessionTimestamp(start, { includeMillis: false }),
        start_time: formatSessionTimestamp(start),
        end_time: formatSessionTimestamp(end),
        start_seconds: start,
        end_seconds: end,
        speaker,
        audio_file_path: audioFilePath,
        text
    };
}

function formatTime(s) {
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

function formatDuration(s) {
    return `${Math.floor(s/60)}m ${s%60}s`;
}

function teardown() {
    cancelAnimationFrame(state.animationFrameId);
    clearInterval(state.timerInterval);
    if (state.sessionRecorder && state.sessionRecorder.state !== 'inactive') state.sessionRecorder.stop();
    if (state.dataChannel)    state.dataChannel.close();
    if (state.peerConnection) state.peerConnection.close();
    if (state.audioContext)   state.audioContext.close();
    if (state.audioStream)    state.audioStream.getTracks().forEach(t => t.stop());
}

function resetState() {
    Object.assign(state, {
        preparedQuestionsPool:  [],
        conversationHistory:    [],
        followupDepth:          0,
        declinedTopics:         [],
        exploredNewDetails:     [],
        lastQuestion:           '',
        lastQuestionMeta:       {},
        turnNumber:             0,
        sessionId:              '',
        // settings intentionally not reset — they persist across sessions
        sessionStartTime:       null,
        sessionStartPerf:       null,
        timerInterval:          null,
        transcripts:            [],
        isFinishing:            false,
        sessionSaved:           false,
        pendingAgentTranscriptFinalizer: null,
        prevQuestionsWordCount: 0,
        totalWordCount:         0,
        liveTranscriptText:     '',
        pendingDelta:           '',
        acceptingPatientSpeech: false,
        realtimeItems:          {},
        activeRealtimeItemAccepting: false,
        currentPatientTurnStartSeconds: null,
        currentPatientSpeechStartSeconds: null,
        currentPatientSpeechEndSeconds: null,
        audioStream:            null,
        sessionRecorder:        null,
        sessionChunks:          [],
        mimeType:               '',
        audioContext:           null,
        analyser:               null,
        dataArray:              null,
        sourceNode:             null,
        animationFrameId:       null,
        peerConnection:         null,
        dataChannel:            null,
        personalityRecorder:    null,
        personalityChunks:      [],
        personalityMime:        '',
        pendingPersonality:     '',
        likenessRecorder:       null,
        likenessChunks:         [],
        likenessMime:           '',
        pendingLikeness:        '',
        onboardingRecorders:    {},
        onboardingChunks:       {},
        onboardingMime:         {},
        onboardingText:         { about: '', likeness: '' },
    });
    el.chatMessages.innerHTML   = '';
    el.liveTranscript.value     = '';
    el.sessionTimer.textContent = '00:00';
    el.wordCounter.textContent  = '0 words';
    setStartButtonLoading(false);
}

// ─── Biography screen ─────────────────────────────────────────────────────────

async function showBiography() {
    showScreen('screen-biography');
    el.bioContent.innerHTML = '<p class="bio-loading">Loading your story…</p>';
    try {
        const res  = await fetch('/api/biography');
        const data = await res.json();
        renderBiography(data.biography || '');
    } catch {
        el.bioContent.innerHTML = '<p class="bio-empty">Could not load biography.</p>';
    }
}

function renderBiography(text) {
    if (!text.trim()) {
        el.bioContent.innerHTML = '<p class="bio-empty">Your story is still being written — complete a session to begin.</p>';
        return;
    }
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    el.bioContent.innerHTML = paragraphs
        .map(p => `<p class="bio-paragraph">${escapeHtml(p.trim())}</p>`)
        .join('');
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── Sessions screen ──────────────────────────────────────────────────────────

async function showSessions() {
    showScreen('screen-sessions');
    el.sessionsList.innerHTML = '<p class="sessions-loading">Loading sessions…</p>';
    try {
        const res  = await fetch('/api/sessions');
        const data = await res.json();
        renderSessions(data.sessions || []);
    } catch {
        el.sessionsList.innerHTML = '<p class="sessions-empty">Could not load sessions.</p>';
    }
}

function renderSessions(sessions) {
    if (!sessions.length) {
        el.sessionsList.innerHTML = '<p class="sessions-empty">No sessions yet — start your first one!</p>';
        return;
    }
    el.sessionsList.innerHTML = sessions.map(s => `
        <div class="session-item">
            <div class="session-item-header">
                <div>
                    <div class="session-item-date">${s.date}</div>
                    <div class="session-item-time">${s.time}</div>
                </div>
                ${s.has_audio ? `
                <div class="session-audio-badge">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a1 1 0 0 0-1 1v16a1 1 0 0 0 2 0V4a1 1 0 0 0-1-1zM6 8a1 1 0 0 0-1 1v6a1 1 0 0 0 2 0V9a1 1 0 0 0-1-1zM18 8a1 1 0 0 0-1 1v6a1 1 0 0 0 2 0V9a1 1 0 0 0-1-1z"/></svg>
                    Audio
                </div>` : ''}
            </div>
            <div class="session-item-stats">
                <div class="session-stat">
                    <div class="session-stat-label">Duration</div>
                    <div class="session-stat-value">${s.duration}</div>
                </div>
                <div class="session-stat">
                    <div class="session-stat-label">Words</div>
                    <div class="session-stat-value">${s.words}</div>
                </div>
                <div class="session-stat">
                    <div class="session-stat-label">Turns</div>
                    <div class="session-stat-value">${s.turns}</div>
                </div>
            </div>
        </div>
    `).join('');
}

// ─── Personality additions ────────────────────────────────────────────────────

async function loadPersonalityAdditions() {
    try {
        const res  = await fetch('/api/personality-additions');
        const data = await res.json();
        renderPersonalityAdditions(data.additions || '');
    } catch {
        // leave as-is
    }
}

function renderPersonalityAdditions(text) {
    if (!text.trim()) {
        el.personalityAdditionsDisplay.innerHTML = '<span class="personality-empty">No custom instructions yet.</span>';
        el.btnPersonalityClear.classList.add('hidden');
        return;
    }
    const lines = text.split('\n').filter(l => l.trim());
    el.personalityAdditionsDisplay.innerHTML = lines.map(line =>
        `<div class="personality-addition-line">
            <span class="personality-addition-bullet">•</span>
            <span>${escapeHtml(line.trim())}</span>
        </div>`
    ).join('');
    el.btnPersonalityClear.classList.remove('hidden');
}

function showPersonalityState(state) {
    // state: 'idle' | 'recording' | 'transcribing' | 'preview'
    el.personalityIdle.classList.toggle('hidden',        state !== 'idle');
    el.personalityRecording.classList.toggle('hidden',   state !== 'recording');
    el.personalityTranscribing.classList.toggle('hidden',state !== 'transcribing');
    el.personalityPreview.classList.toggle('hidden',     state !== 'preview');
}

async function startPersonalityRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
        state.personalityMime = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
        state.personalityChunks = [];
        state.personalityRecorder = new MediaRecorder(stream, { mimeType: state.personalityMime });
        state.personalityRecorder.ondataavailable = e => {
            if (e.data && e.data.size > 0) state.personalityChunks.push(e.data);
        };
        state.personalityRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            showPersonalityState('transcribing');
            await transcribePersonalityAudio();
        };
        state.personalityRecorder.start();
        showPersonalityState('recording');
    } catch (err) {
        showPersonalityStatus('Microphone access denied.', true);
    }
}

function stopPersonalityRecording() {
    if (state.personalityRecorder && state.personalityRecorder.state !== 'inactive') {
        state.personalityRecorder.stop();
    }
}

async function transcribePersonalityAudio() {
    try {
        const blob = new Blob(state.personalityChunks, { type: state.personalityMime || 'audio/webm' });
        const form = new FormData();
        form.append('audio', blob, 'instruction.webm');
        const res  = await fetch('/api/transcribe-instruction', { method: 'POST', body: form });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (!data.text.trim()) throw new Error('No speech detected');
        state.pendingPersonality = data.text.trim();
        el.personalityPreviewText.textContent = state.pendingPersonality;
        showPersonalityState('preview');
    } catch (err) {
        showPersonalityState('idle');
        showPersonalityStatus('Could not transcribe — please try again.', true);
    }
}

async function addPersonalityInstruction() {
    const text = state.pendingPersonality;
    if (!text) return;
    try {
        const res  = await fetch('/api/personality-additions', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ action: 'append', text })
        });
        const data = await res.json();
        renderPersonalityAdditions(data.additions || '');
        state.pendingPersonality = '';
        showPersonalityState('idle');
        showPersonalityStatus('Instruction saved.');
    } catch {
        showPersonalityStatus('Could not save — please try again.', true);
    }
}

function discardPersonalityInstruction() {
    state.pendingPersonality = '';
    showPersonalityState('idle');
}

async function clearPersonalityInstructions() {
    try {
        const res  = await fetch('/api/personality-additions', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ action: 'clear' })
        });
        const data = await res.json();
        renderPersonalityAdditions('');
        showPersonalityStatus('All instructions cleared.');
    } catch {
        showPersonalityStatus('Could not clear — please try again.', true);
    }
}

function showPersonalityStatus(msg, isError = false) {
    el.personalityStatus.textContent = msg;
    el.personalityStatus.style.color = isError ? 'var(--accent-red)' : 'var(--accent-green)';
    el.personalityStatus.classList.add('visible');
    setTimeout(() => el.personalityStatus.classList.remove('visible'), 2500);
}

// ─── Image likeness instructions ─────────────────────────────────────────────

async function loadLikenessInstructions() {
    try {
        const res  = await fetch('/api/likeness-instructions');
        const data = await res.json();
        renderLikenessInstructions(data.instructions || '');
    } catch {
        // leave as-is
    }
}

function renderLikenessInstructions(text) {
    if (!text.trim()) {
        el.likenessInstructionsDisplay.innerHTML = '<span class="personality-empty">No likeness instructions yet.</span>';
        el.btnLikenessClear.classList.add('hidden');
        return;
    }
    const lines = text.split('\n').filter(l => l.trim());
    el.likenessInstructionsDisplay.innerHTML = lines.map(line =>
        `<div class="personality-addition-line">
            <span class="personality-addition-bullet">•</span>
            <span>${escapeHtml(line.trim())}</span>
        </div>`
    ).join('');
    el.btnLikenessClear.classList.remove('hidden');
}

function showLikenessState(nextState) {
    el.likenessIdle.classList.toggle('hidden',        nextState !== 'idle');
    el.likenessRecording.classList.toggle('hidden',   nextState !== 'recording');
    el.likenessTranscribing.classList.toggle('hidden',nextState !== 'transcribing');
    el.likenessPreview.classList.toggle('hidden',     nextState !== 'preview');
}

async function startLikenessRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
        state.likenessMime = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
        state.likenessChunks = [];
        state.likenessRecorder = new MediaRecorder(stream, { mimeType: state.likenessMime });
        state.likenessRecorder.ondataavailable = e => {
            if (e.data && e.data.size > 0) state.likenessChunks.push(e.data);
        };
        state.likenessRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            showLikenessState('transcribing');
            await transcribeLikenessAudio();
        };
        state.likenessRecorder.start();
        showLikenessState('recording');
    } catch {
        showLikenessStatus('Microphone access denied.', true);
    }
}

function stopLikenessRecording() {
    if (state.likenessRecorder && state.likenessRecorder.state !== 'inactive') {
        state.likenessRecorder.stop();
    }
}

async function transcribeLikenessAudio() {
    try {
        const blob = new Blob(state.likenessChunks, { type: state.likenessMime || 'audio/webm' });
        const form = new FormData();
        form.append('audio', blob, 'likeness-instruction.webm');
        const res  = await fetch('/api/transcribe-instruction', { method: 'POST', body: form });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (!data.text.trim()) throw new Error('No speech detected');
        state.pendingLikeness = data.text.trim();
        el.likenessPreviewText.textContent = state.pendingLikeness;
        showLikenessState('preview');
    } catch {
        showLikenessState('idle');
        showLikenessStatus('Could not transcribe — please try again.', true);
    }
}

async function addLikenessInstruction() {
    const text = state.pendingLikeness;
    if (!text) return;
    try {
        const res  = await fetch('/api/likeness-instructions', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ action: 'append', text })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        renderLikenessInstructions(data.instructions || '');
        state.pendingLikeness = '';
        showLikenessState('idle');
        showLikenessStatus('Likeness instruction saved. Future images will use it.');
    } catch {
        showLikenessStatus('Could not save — please try again.', true);
    }
}

function discardLikenessInstruction() {
    state.pendingLikeness = '';
    showLikenessState('idle');
}

async function clearLikenessInstructions() {
    try {
        const res  = await fetch('/api/likeness-instructions', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ action: 'clear' })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        renderLikenessInstructions('');
        showLikenessStatus('Likeness instructions cleared.');
    } catch {
        showLikenessStatus('Could not clear — please try again.', true);
    }
}

function showLikenessStatus(msg, isError = false) {
    el.likenessStatus.textContent = msg;
    el.likenessStatus.style.color = isError ? 'var(--accent-red)' : 'var(--accent-green)';
    el.likenessStatus.classList.add('visible');
    setTimeout(() => el.likenessStatus.classList.remove('visible'), 3000);
}
