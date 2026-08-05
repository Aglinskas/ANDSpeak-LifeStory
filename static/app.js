// ─── State ────────────────────────────────────────────────────────────────────

const state = {
    currentUser: '',
    createUserGatePassword: '',

    // Dynamic conversation
    preparedQuestionsOriginal: [], // complete pool created at session start
    preparedQuestionsPool: [],   // remaining prepared questions (shrinks as used)
    conversationHistory:   [],   // [{question, response}] sent to /api/next-question
    followupDepth:         0,    // consecutive follow-ups on current topic
    awaitingConsent:       false,// last turn asked "keep talking or move on?" — this response answers it
    declinedTopics:        [],   // broad topics the participant declined this session
    exploredNewDetails:    [],   // person/pet/event signatures already explored this session
    lastQuestion:          '',   // the question just asked (for pairing with response)
    lastQuestionMeta:      {},   // topic/mode/keywords for the question just asked
    turnNumber:            0,    // increments each time the chatbot speaks
    conversationRevision:  0,    // invalidates stale next-question/TTS work after corrections
    answerRevisionInProgress: false,
    answerEditActive:      false,
    topicChoiceActive:     false,
    topicChoiceLocked:     false,
    topicChoiceSeenIds:    [],
    topicChoiceVisibleIds: [],
    streak: {
        current: 0,
        longest: 0,
        completed_today: false,
        status: 'no_sessions',
        theme_tier: 0,
        next_milestone: 1,
    },
    streakAtSessionStart: null,
    waveColors: [
        'rgba(59,130,246,0.65)',
        'rgba(6,182,212,0.45)',
        'rgba(139,92,246,0.3)',
    ],

    // Partial save (crash recovery)
    sessionId: '',               // timestamp string, used to name partial files

    // User settings (loaded from server, persisted across sessions)
    settings: {
        transcription_delay: 'low',
        transcription_language: '',
        transcription_logprobs: false,
        filter_hallucinated_fillers: true,
        debug_realtime_events: false,
    },
    customDictionary: [],

    sessionStartTime: null,
    sessionStartPerf: null,
    timerInterval:    null,
    transcripts:      [],
    isFinishing:      false,
    sessionSaved:     false,
        targetChoiceShown:     false,
    targetChoiceShown: false,
    pendingAgentTranscriptFinalizer: null,

    // Word counting
    prevQuestionsWordCount: 0,
    totalWordCount:         0,

    // Live transcript accumulation
    liveTranscriptText: '',  // finalized transcription segments
    pendingDelta:       '',  // in-flight delta
    acceptingPatientSpeech: false,
    realtimeItems: {},
    activeRealtimeItemAccepting: false,
    awaitingCommittedTranscript: false,
    pendingTranscriptionCommit: null,
    lastRenderedTranscript: '',
    transcriptEditBaseline: null,
    transcriptEditLatest: null,
    manualTranscriptOverride: null,
    manualTranscriptAutoSnapshot: '',
    manualTranscriptLocked: false,
    transcriptComposing: false,
    transcriptionConfidence: null,
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
    ttsPlaybackPrimed: false,
    pendingTtsRetry:  null,
    lastTtsPlaybackError: null,

    // Visualizer
    audioContext:     null,
    analyser:         null,
    dataArray:        null,
    sourceNode:       null,
    animationFrameId: null,

    // WebRTC Realtime transcription
    peerConnection: null,
    dataChannel:    null,
    realtimeTranscriptionModel: null,

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

    // Beta bug reporting
    bugReportScreenshotBlob: null,
    bugReportContext: null,
    bugReportPreviewUrl: '',
    bugReportRecorder: null,
    bugReportStream: null,
    bugReportChunks: [],
    bugReportMime: '',
    bugReportDiscardRecording: false,
    bugReportWasAcceptingSpeech: false,
    bugReportTtsWasPlaying: false,
};

// ─── Elements ─────────────────────────────────────────────────────────────────

const el = {
    statusTime:        document.getElementById('status-time'),
    betaToolbar:       document.getElementById('beta-toolbar'),
    btnReportBug:      document.getElementById('btn-report-bug'),
    bugReportModal:    document.getElementById('bug-report-modal'),
    btnCloseBugReport: document.getElementById('btn-close-bug-report'),
    btnCancelBugReport:document.getElementById('btn-cancel-bug-report'),
    btnSubmitBugReport:document.getElementById('btn-submit-bug-report'),
    bugDescription:    document.getElementById('bug-description'),
    bugScreenshotPreview: document.getElementById('bug-screenshot-preview'),
    bugScreenshotStatus: document.getElementById('bug-screenshot-status'),
    btnRecordBugDescription: document.getElementById('btn-record-bug-description'),
    btnStopBugDescription: document.getElementById('btn-stop-bug-description'),
    bugVoiceStatus:    document.getElementById('bug-voice-status'),
    bugReportStatus:   document.getElementById('bug-report-status'),
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
    homeStreak:        document.getElementById('home-streak'),
    homeStreakTrail:   document.getElementById('home-streak-trail'),
    homeStreakMessage: document.getElementById('home-streak-message'),
    homeStreakDetail:  document.getElementById('home-streak-detail'),
    btnSettings:       document.getElementById('btn-settings'),
    appVersion:        document.getElementById('app-version'),
    // Settings
    btnSettingsBack:   document.getElementById('btn-settings-back'),
    btnSettingsDone:   document.getElementById('btn-settings-done'),
    transcriptionDelay: document.getElementById('transcription-delay'),
    transcriptionLanguage: document.getElementById('transcription-language'),
    transcriptionLogprobs: document.getElementById('transcription-logprobs'),
    dictionaryForm:    document.getElementById('dictionary-form'),
    dictionaryHeard:   document.getElementById('dictionary-heard'),
    dictionaryPreferred: document.getElementById('dictionary-preferred'),
    dictionaryList:    document.getElementById('dictionary-list'),
    dictionaryStatus:  document.getElementById('dictionary-status'),
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
    transcriptLearningStatus: document.getElementById('transcript-learning-status'),
    transcriptConfidence: document.getElementById('transcript-confidence'),
    transcriptLoading: document.getElementById('transcript-loading'),
    btnProceed:        document.getElementById('btn-proceed'),
    btnEndSession:        document.getElementById('btn-end-session'),
    continuationChoice: document.getElementById('continuation-choice'),
    btnContinueSession: document.getElementById('btn-continue-session'),
    btnChoiceEndSession: document.getElementById('btn-choice-end-session'),
    ttsRetry:             document.getElementById('tts-retry'),
    btnTtsRetry:          document.getElementById('btn-tts-retry'),
    // Chat-screen settings drawer
    btnChatSettings:      document.getElementById('btn-chat-settings'),
    sessionDrawer:        document.getElementById('session-drawer'),
    btnDrawerClose:       document.getElementById('btn-drawer-close'),
    drawerTranscriptionDelay: document.getElementById('drawer-transcription-delay'),
    drawerTranscriptionLanguage: document.getElementById('drawer-transcription-language'),
    drawerTranscriptionLogprobs: document.getElementById('drawer-transcription-logprobs'),
    drawerAdvFilterFillers:document.getElementById('drawer-adv-filter-fillers'),
    drawerAdvDebug:        document.getElementById('drawer-adv-debug'),
    drawerStatus:          document.getElementById('drawer-status'),
    advFilterFillers:      document.getElementById('adv-filter-fillers'),
    advDebug:              document.getElementById('adv-debug'),
    ttsAudio:          document.getElementById('tts-audio'),
    // Finish
    statDuration:      document.getElementById('stat-duration'),
    statWords:         document.getElementById('stat-words'),
    statParagraphs:    document.getElementById('stat-paragraphs'),
    finishTitle:       document.querySelector('#screen-finish .finish-title'),
    finishMessage:     document.querySelector('#screen-finish .finish-message'),
    streakCelebration: document.getElementById('streak-celebration'),
    streakCelebrationNumber: document.getElementById('streak-celebration-number'),
    streakCelebrationTitle: document.getElementById('streak-celebration-title'),
    streakCelebrationMessage: document.getElementById('streak-celebration-message'),
    finishStreakTrail: document.getElementById('finish-streak-trail'),
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

async function loadAppVersion() {
    try {
        const response = await fetch('/api/version', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.version || !data.commit) throw new Error('Version unavailable');
        el.appVersion.textContent = `v${data.version} · ${data.commit}`;
    } catch (error) {
        console.warn('Could not load app version:', error);
        el.appVersion.textContent = 'v0.1.0 · commit unavailable';
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    loadAppVersion();
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

    el.btnReportBug.addEventListener('click', openBugReport);
    el.btnCloseBugReport.addEventListener('click', () => closeBugReport());
    el.btnCancelBugReport.addEventListener('click', () => closeBugReport());
    el.btnSubmitBugReport.addEventListener('click', submitBugReport);
    el.btnRecordBugDescription.addEventListener('click', startBugDescriptionRecording);
    el.btnStopBugDescription.addEventListener('click', stopBugDescriptionRecording);
    el.bugDescription.addEventListener('input', updateBugReportSubmitState);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !el.bugReportModal.classList.contains('hidden')) {
            closeBugReport();
        }
    });

    el.btnStart.addEventListener('click', () => {
        primeTtsPlayback();
        startSession();
    });
    el.btnTtsRetry.addEventListener('click', retryTtsPlayback);
    el.btnProceed.addEventListener('click', handleProceed);
    el.btnEndSession.addEventListener('click', () => wrapUpSession());
    el.btnChoiceEndSession.addEventListener('click', () => wrapUpSession());
    el.btnContinueSession.addEventListener('click', () => {
        el.continuationChoice.classList.add('hidden');
        requestAndAskNextQuestion();
    });
    el.btnHome.addEventListener('click', goHome);
    el.chatMessages.addEventListener('click', handleConversationBubbleAction);

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

    bindTranscriptionSelect(el.transcriptionDelay, el.drawerTranscriptionDelay, 'transcription_delay');
    bindTranscriptionSelect(el.transcriptionLanguage, el.drawerTranscriptionLanguage, 'transcription_language');
    bindAdvancedSetting(el.transcriptionLogprobs, 'transcription_logprobs');
    bindAdvancedSetting(el.drawerTranscriptionLogprobs, 'transcription_logprobs', true);
    bindAdvancedSetting(el.advFilterFillers, 'filter_hallucinated_fillers');
    bindAdvancedSetting(el.advDebug,         'debug_realtime_events');
    bindAdvancedSetting(el.drawerAdvFilterFillers, 'filter_hallucinated_fillers', true);
    bindAdvancedSetting(el.drawerAdvDebug,         'debug_realtime_events', true);
    el.dictionaryForm.addEventListener('submit', handleDictionaryAdd);
    el.dictionaryList.addEventListener('click', handleDictionaryListClick);
    el.liveTranscript.addEventListener('beforeinput', beginTranscriptManualEdit);
    el.liveTranscript.addEventListener('input', handleTranscriptManualInput);
    el.liveTranscript.addEventListener('compositionstart', () => {
        state.transcriptComposing = true;
        beginTranscriptManualEdit();
    });
    el.liveTranscript.addEventListener('compositionend', () => {
        state.transcriptComposing = false;
    });

    // Settings panel
    el.btnSettings.addEventListener('click', () => {
        loadPersonalityAdditions();
        loadLikenessInstructions();
        hideChangePasswordPanel();
        showScreen('screen-settings');
    });
    el.btnSettingsBack.addEventListener('click', () => showScreen('screen-home'));
    el.btnSettingsDone.addEventListener('click', () => showScreen('screen-home'));

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

// ─── Beta bug reporting ─────────────────────────────────────────────────────

function cloneForBugReport(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return null;
    }
}

function buildBugReportContext() {
    const activeScreen = document.querySelector('.screen.active')?.id || '';
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const visibleMessages = Array.from(el.chatMessages.querySelectorAll('.message-bubble')).map((node, index) => ({
        index: index + 1,
        speaker: node.classList.contains('patient') ? 'Patient' : 'Chatbot',
        text: node.querySelector('.message-edit-textarea')?.value
            ?? node.querySelector('.message-text')?.textContent
            ?? node.textContent
            ?? ''
    }));

    return {
        captured_at: new Date().toISOString(),
        session_id: state.sessionId,
        active_screen: activeScreen,
        prepared_questions: {
            original: cloneForBugReport(state.preparedQuestionsOriginal) || [],
            remaining: cloneForBugReport(state.preparedQuestionsPool) || [],
        },
        conversation: {
            transcript_entries: cloneForBugReport(state.transcripts) || [],
            conversation_history: cloneForBugReport(state.conversationHistory) || [],
            visible_messages: visibleMessages,
            live_response_draft: el.liveTranscript.value,
            last_question: state.lastQuestion,
            last_question_meta: cloneForBugReport(state.lastQuestionMeta) || {},
        },
        diagnostics: {
            user: state.currentUser,
            page_url: window.location.href,
            page_title: document.title,
            browser: {
                user_agent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                languages: Array.from(navigator.languages || []),
                online: navigator.onLine,
                cookies_enabled: navigator.cookieEnabled,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                    device_pixel_ratio: window.devicePixelRatio,
                },
                screen: {
                    width: window.screen.width,
                    height: window.screen.height,
                    available_width: window.screen.availWidth,
                    available_height: window.screen.availHeight,
                    color_depth: window.screen.colorDepth,
                },
                connection: connection ? {
                    effective_type: connection.effectiveType,
                    downlink: connection.downlink,
                    round_trip_time: connection.rtt,
                    save_data: connection.saveData,
                } : null,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                timezone_offset_minutes: new Date().getTimezoneOffset(),
                visibility_state: document.visibilityState,
            },
            conversation_state: {
                turn_number: state.turnNumber,
                followup_depth: state.followupDepth,
                awaiting_consent: state.awaitingConsent,
                declined_topics: cloneForBugReport(state.declinedTopics) || [],
                explored_new_details: cloneForBugReport(state.exploredNewDetails) || [],
                total_word_count: state.totalWordCount,
                session_started_at: state.sessionStartTime?.toISOString() || null,
                session_elapsed_seconds: sessionSeconds(),
                accepting_patient_speech: state.acceptingPatientSpeech,
                realtime_connection_state: state.peerConnection?.connectionState || null,
                realtime_data_channel_state: state.dataChannel?.readyState || null,
                session_recorder_state: state.sessionRecorder?.state || null,
                pending_transcription_commit: Boolean(state.pendingTranscriptionCommit),
                current_transcription_confidence: state.transcriptionConfidence,
                settings: cloneForBugReport(state.settings) || {},
            },
            audio_playback: {
                paused: el.ttsAudio.paused,
                ended: el.ttsAudio.ended,
                current_time: el.ttsAudio.currentTime,
                duration: Number.isFinite(el.ttsAudio.duration) ? el.ttsAudio.duration : null,
                ready_state: el.ttsAudio.readyState,
                source: el.ttsAudio.currentSrc || '',
                primed: state.ttsPlaybackPrimed,
                last_error: cloneForBugReport(state.lastTtsPlaybackError),
            },
        },
    };
}

function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('The screenshot could not be converted to an image.'));
        }, 'image/png');
    });
}

async function captureBugReportScreenshot() {
    if (typeof window.html2canvas !== 'function') {
        throw new Error('The screenshot tool did not load.');
    }
    const target = document.querySelector('.iphone-frame');
    const canvas = await window.html2canvas(target, {
        backgroundColor: '#0e121e',
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
    });
    return canvasToPngBlob(canvas);
}

function pauseConversationForBugReport() {
    state.bugReportWasAcceptingSpeech = state.acceptingPatientSpeech;
    state.bugReportTtsWasPlaying = !el.ttsAudio.paused && !el.ttsAudio.ended;
    if (state.sessionStartTime) setPatientSpeechActive(false);
    if (state.bugReportTtsWasPlaying) el.ttsAudio.pause();
}

function resumeConversationAfterBugReport() {
    const shouldResumeTts = state.bugReportTtsWasPlaying;
    const shouldResumePatient = state.bugReportWasAcceptingSpeech;
    state.bugReportTtsWasPlaying = false;
    state.bugReportWasAcceptingSpeech = false;

    if (shouldResumeTts && state.sessionStartTime && !state.isFinishing) {
        el.ttsAudio.play().catch(err => console.error('Could not resume interview audio:', err));
    }
    if (shouldResumePatient && state.sessionStartTime && !state.isFinishing) {
        setPatientSpeechActive(true);
    }
}

async function openBugReport() {
    if (!state.currentUser || !el.bugReportModal.classList.contains('hidden')) return;

    el.btnReportBug.disabled = true;
    el.btnReportBug.textContent = 'Capturing…';
    try {
        state.bugReportContext = buildBugReportContext();
        state.bugReportScreenshotBlob = await captureBugReportScreenshot();
        pauseConversationForBugReport();

        if (state.bugReportPreviewUrl) URL.revokeObjectURL(state.bugReportPreviewUrl);
        state.bugReportPreviewUrl = URL.createObjectURL(state.bugReportScreenshotBlob);
        el.bugScreenshotPreview.src = state.bugReportPreviewUrl;
        el.bugScreenshotStatus.textContent = 'Screenshot captured';
        el.bugDescription.value = '';
        el.bugVoiceStatus.textContent = '';
        showBugReportStatus('');
        updateBugReportSubmitState();
        el.bugReportModal.classList.remove('hidden');
        requestAnimationFrame(() => el.bugDescription.focus());
    } catch (err) {
        console.error('Bug report screenshot failed:', err);
        alert(`Could not capture the screen for this report: ${err.message}`);
        state.bugReportScreenshotBlob = null;
        state.bugReportContext = null;
    } finally {
        el.btnReportBug.disabled = false;
        el.btnReportBug.innerHTML = '<span class="report-bug-icon" aria-hidden="true">!</span> Report bug';
    }
}

function closeBugReport({ resumeConversation = true } = {}) {
    if (!el.bugReportModal) return;

    if (state.bugReportRecorder && state.bugReportRecorder.state !== 'inactive') {
        state.bugReportDiscardRecording = true;
        state.bugReportRecorder.stop();
    }
    if (state.bugReportStream) {
        state.bugReportStream.getTracks().forEach(track => track.stop());
        state.bugReportStream = null;
    }

    el.bugReportModal.classList.add('hidden');
    el.btnRecordBugDescription.classList.remove('hidden');
    el.btnStopBugDescription.classList.add('hidden');
    el.bugDescription.value = '';
    showBugReportStatus('');
    if (state.bugReportPreviewUrl) {
        URL.revokeObjectURL(state.bugReportPreviewUrl);
        state.bugReportPreviewUrl = '';
    }
    el.bugScreenshotPreview.removeAttribute('src');
    state.bugReportScreenshotBlob = null;
    state.bugReportContext = null;
    state.bugReportChunks = [];
    state.bugReportRecorder = null;
    state.bugReportDiscardRecording = false;
    el.btnSubmitBugReport.dataset.busy = 'false';
    if (resumeConversation) resumeConversationAfterBugReport();
}

function showBugReportStatus(message, isError = false) {
    el.bugReportStatus.textContent = message;
    el.bugReportStatus.classList.toggle('error', isError);
}

function updateBugReportSubmitState() {
    const recording = state.bugReportRecorder?.state === 'recording';
    const busy = el.btnSubmitBugReport.dataset.busy === 'true';
    el.btnSubmitBugReport.disabled = !el.bugDescription.value.trim() || recording || busy;
}

async function startBugDescriptionRecording() {
    if (state.bugReportRecorder?.state === 'recording') return;
    try {
        state.bugReportDiscardRecording = false;
        state.bugReportStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
        state.bugReportMime = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
        state.bugReportChunks = [];
        const options = state.bugReportMime ? { mimeType: state.bugReportMime } : undefined;
        state.bugReportRecorder = new MediaRecorder(state.bugReportStream, options);
        const activeRecorder = state.bugReportRecorder;
        state.bugReportRecorder.ondataavailable = event => {
            if (event.data && event.data.size > 0) state.bugReportChunks.push(event.data);
        };
        state.bugReportRecorder.onstop = async () => {
            if (state.bugReportStream) {
                state.bugReportStream.getTracks().forEach(track => track.stop());
                state.bugReportStream = null;
            }
            el.btnRecordBugDescription.classList.remove('hidden');
            el.btnStopBugDescription.classList.add('hidden');
            const recorderStillBelongsToThisReport = state.bugReportRecorder === activeRecorder;
            if (
                !recorderStillBelongsToThisReport ||
                state.bugReportDiscardRecording ||
                el.bugReportModal.classList.contains('hidden')
            ) {
                if (!recorderStillBelongsToThisReport) return;
                state.bugReportDiscardRecording = false;
                state.bugReportChunks = [];
                state.bugReportRecorder = null;
                return;
            }
            await transcribeBugDescription();
        };
        state.bugReportRecorder.start();
        el.btnRecordBugDescription.classList.add('hidden');
        el.btnStopBugDescription.classList.remove('hidden');
        el.bugVoiceStatus.textContent = 'Listening… describe what happened.';
        updateBugReportSubmitState();
    } catch (err) {
        console.error('Bug description microphone failed:', err);
        el.bugVoiceStatus.textContent = 'Microphone access was not available. You can type instead.';
    }
}

function stopBugDescriptionRecording() {
    if (state.bugReportRecorder && state.bugReportRecorder.state !== 'inactive') {
        el.bugVoiceStatus.textContent = 'Transcribing…';
        state.bugReportRecorder.stop();
    }
}

async function transcribeBugDescription() {
    el.btnRecordBugDescription.disabled = true;
    try {
        const blob = new Blob(state.bugReportChunks, {
            type: state.bugReportMime || 'audio/webm'
        });
        const form = new FormData();
        form.append('audio', blob, 'bug-description.webm');
        const res = await fetch('/api/transcribe-bug-description', {
            method: 'POST',
            body: form
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Transcription failed.');
        const spokenText = (data.text || '').trim();
        if (!spokenText) throw new Error('No speech was detected.');
        const existingText = el.bugDescription.value.trim();
        el.bugDescription.value = [existingText, spokenText].filter(Boolean).join(' ');
        el.bugVoiceStatus.textContent = 'Description added. You can edit it before submitting.';
    } catch (err) {
        console.error('Bug description transcription failed:', err);
        el.bugVoiceStatus.textContent = 'Could not transcribe that recording. Please try again or type.';
    } finally {
        state.bugReportChunks = [];
        state.bugReportRecorder = null;
        el.btnRecordBugDescription.disabled = false;
        updateBugReportSubmitState();
    }
}

async function submitBugReport() {
    const description = el.bugDescription.value.trim();
    if (!description || !state.bugReportContext) return;

    el.btnSubmitBugReport.dataset.busy = 'true';
    el.btnSubmitBugReport.textContent = 'Submitting…';
    updateBugReportSubmitState();
    showBugReportStatus('Saving screenshot and conversation details…');

    try {
        const context = cloneForBugReport(state.bugReportContext) || {};
        context.client_submitted_at = new Date().toISOString();
        const form = new FormData();
        form.append('description', description);
        form.append('report_context', JSON.stringify(context));
        if (state.bugReportScreenshotBlob) {
            form.append('screenshot', state.bugReportScreenshotBlob, 'screenshot.png');
        }
        const res = await fetch('/api/bug-reports', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'The report could not be saved.');

        showBugReportStatus(`Saved. Thank you — report ${data.report_id} is ready for review.`);
        setTimeout(() => closeBugReport(), 900);
    } catch (err) {
        console.error('Bug report submission failed:', err);
        showBugReportStatus(`Could not save the report: ${err.message}`, true);
        el.btnSubmitBugReport.dataset.busy = 'false';
        updateBugReportSubmitState();
    } finally {
        el.btnSubmitBugReport.textContent = 'Submit bug report';
    }
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
    el.betaToolbar.classList.remove('hidden');
    if (el.currentUserPill) el.currentUserPill.textContent = username;
    if (el.settingsCurrentUser) el.settingsCurrentUser.textContent = username;
    showScreen('screen-home');
    fetchSettings();
    fetchTranscriptionDictionary();
    fetchStats();
    loadPortrait();
}

function showLoggedOut() {
    closeBugReport({ resumeConversation: false });
    teardown();
    resetState();
    state.currentUser = '';
    state.streak = defaultStreak();
    state.streakAtSessionStart = null;
    applyStreakTheme(state.streak);
    el.betaToolbar.classList.add('hidden');
    state.customDictionary = [];
    renderTranscriptionDictionary();
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

function defaultStreak() {
    return {
        current: 0,
        longest: 0,
        completed_today: false,
        last_completed_date: null,
        status: 'no_sessions',
        theme_tier: 0,
        next_milestone: 1,
    };
}

function normalizeStreak(raw) {
    const fallback = defaultStreak();
    if (!raw || typeof raw !== 'object') return fallback;
    return {
        current: Math.max(0, Number(raw.current) || 0),
        longest: Math.max(0, Number(raw.longest) || 0),
        completed_today: Boolean(raw.completed_today),
        last_completed_date: raw.last_completed_date || null,
        status: String(raw.status || fallback.status),
        theme_tier: Math.min(5, Math.max(0, Number(raw.theme_tier) || 0)),
        next_milestone: raw.next_milestone == null ? null : Math.max(1, Number(raw.next_milestone) || 1),
        timezone: String(raw.timezone || ''),
    };
}

function applyStreakTheme(streak) {
    const tier = Math.min(5, Math.max(0, Number(streak?.theme_tier) || 0));
    document.documentElement.dataset.streakTier = String(tier);
    const styles = getComputedStyle(document.documentElement);
    state.waveColors = [
        styles.getPropertyValue('--wave-primary').trim() || 'rgba(59,130,246,0.65)',
        styles.getPropertyValue('--wave-secondary').trim() || 'rgba(6,182,212,0.45)',
        styles.getPropertyValue('--wave-tertiary').trim() || 'rgba(139,92,246,0.3)',
    ];
}

function renderStreakTrail(container, current, { animateDay = 0 } = {}) {
    if (!container) return;
    const filled = Math.min(7, Math.max(0, Number(current) || 0));
    Array.from(container.children).forEach((dot, index) => {
        const day = index + 1;
        dot.classList.toggle('filled', day <= filled);
        dot.classList.toggle('newly-filled', day === animateDay && day <= filled);
    });
}

function streakDayLabel(days) {
    return `${days}-day story streak`;
}

function renderHomeStreak(streak) {
    if (!el.homeStreak) return;
    const current = streak.current || 0;
    renderStreakTrail(el.homeStreakTrail, current);
    el.homeStreak.classList.toggle('is-complete', streak.completed_today);

    let message = 'Start your story streak';
    let detail = 'Share a little of your story today';
    if (streak.status === 'active_today') {
        message = current === 1 ? 'Your story streak has started' : streakDayLabel(current);
        detail = current >= 7 ? 'Today is complete — your story keeps growing' : 'Today is complete';
    } else if (streak.status === 'continue_today') {
        message = `Continue your ${streakDayLabel(current)} today`;
        detail = current < 7
            ? `${7 - current} ${7 - current === 1 ? 'day' : 'days'} until your first full week`
            : 'Share a little today to keep it going';
    } else if (streak.status === 'restart') {
        message = 'Start a new story streak';
        detail = streak.longest > 0
            ? `Your best is ${streak.longest} ${streak.longest === 1 ? 'day' : 'days'}`
            : 'Share a little of your story today';
    }

    el.homeStreakMessage.textContent = message;
    el.homeStreakDetail.textContent = detail;
    el.homeStreak.setAttribute(
        'aria-label',
        current > 0
            ? `${message}. ${Math.min(current, 7)} of 7 introductory streak days completed. ${detail}.`
            : `${message}. ${detail}.`
    );
}

function localTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
        return '';
    }
}

async function fetchStats() {
    try {
        const query = new URLSearchParams();
        const timezone = localTimezone();
        if (timezone) query.set('timezone', timezone);
        const queryString = query.toString();
        const res = await fetch(`/api/stats${queryString ? `?${queryString}` : ''}`);
        if (res.status === 401) {
            showLoggedOut();
            return null;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load statistics.');
        el.homeSessions.textContent   = data.session_count;
        el.homeParagraphs.textContent = data.biography_paragraphs;
        state.streak = normalizeStreak(data.streak);
        applyStreakTheme(state.streak);
        renderHomeStreak(state.streak);
        return data;
    } catch {
        el.homeSessions.textContent   = '0';
        el.homeParagraphs.textContent = '0';
        return null;
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
    el.transcriptionDelay.value = state.settings.transcription_delay;
    el.drawerTranscriptionDelay.value = state.settings.transcription_delay;
    el.transcriptionLanguage.value = state.settings.transcription_language;
    el.drawerTranscriptionLanguage.value = state.settings.transcription_language;
    syncAdvancedToggles();
}

function bindTranscriptionSelect(primary, mirror, key) {
    [primary, mirror].forEach(input => {
        if (!input) return;
        input.addEventListener('change', () => {
            state.settings[key] = input.value;
            primary.value = input.value;
            mirror.value = input.value;
            scheduleSettingsSave();
            pushLiveTranscriptionUpdate();
            if (input === mirror) showDrawerApplied();
        });
    });
}

function bindAdvancedSetting(input, key, showDrawerStatus = false) {
    if (!input) return;
    input.addEventListener('change', () => {
        state.settings[key] = input.checked;
        syncAdvancedToggles();
        scheduleSettingsSave();
        if (key === 'transcription_logprobs') {
            state.transcriptionConfidence = null;
            updateTranscriptionConfidenceUI();
            pushLiveTranscriptionUpdate();
        }
        if (showDrawerStatus) showDrawerApplied();
    });
}

function syncAdvancedToggles() {
    [
        [el.transcriptionLogprobs, 'transcription_logprobs'],
        [el.drawerTranscriptionLogprobs, 'transcription_logprobs'],
        [el.advFilterFillers, 'filter_hallucinated_fillers'],
        [el.advDebug,         'debug_realtime_events'],
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
            const res = await fetch('/api/settings', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(state.settings)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not save settings.');
            if (data.settings) state.settings = { ...state.settings, ...data.settings };
            el.saveStatus.textContent = '✓  Saved';
            el.saveStatus.classList.add('visible');
            setTimeout(() => el.saveStatus.classList.remove('visible'), 2000);
        } catch {
            el.saveStatus.textContent = 'Could not save';
            el.saveStatus.classList.add('visible');
        }
    }, 600);
}

async function fetchTranscriptionDictionary() {
    try {
        const res = await fetch('/api/transcription-dictionary');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load dictionary.');
        state.customDictionary = Array.isArray(data.entries) ? data.entries : [];
    } catch (err) {
        console.error('Dictionary load failed:', err);
        state.customDictionary = [];
    }
    renderTranscriptionDictionary();
}

let _dictionarySaveQueue = Promise.resolve();
function saveTranscriptionDictionary(statusMessage = 'Dictionary saved.') {
    const entries = state.customDictionary.map(entry => ({ ...entry }));
    const save = async () => {
        try {
            const res = await fetch('/api/transcription-dictionary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not save dictionary.');
            renderTranscriptionDictionary();
            showDictionaryStatus(statusMessage, false);
            return true;
        } catch (err) {
            console.error('Dictionary save failed:', err);
            showDictionaryStatus('Could not save the dictionary. Please try again.', true);
            return false;
        }
    };
    _dictionarySaveQueue = _dictionarySaveQueue.then(save, save);
    return _dictionarySaveQueue;
}

function normalizeDictionaryPhrase(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().replace(/^[.,!?;:]+|[.,!?;:]+$/g, '');
}

function upsertDictionaryEntry(heard, preferred) {
    heard = normalizeDictionaryPhrase(heard);
    preferred = normalizeDictionaryPhrase(preferred);
    if (!heard || !preferred || heard === preferred || heard.length > 100 || preferred.length > 100) return false;

    const existing = state.customDictionary.findIndex(entry => entry.heard.toLocaleLowerCase() === heard.toLocaleLowerCase());
    const next = { heard, preferred };
    if (existing >= 0) state.customDictionary.splice(existing, 1, next);
    else {
        if (state.customDictionary.length >= 200) return false;
        state.customDictionary.push(next);
    }
    renderTranscriptionDictionary();
    return true;
}

async function handleDictionaryAdd(event) {
    event.preventDefault();
    const heard = el.dictionaryHeard.value;
    const preferred = el.dictionaryPreferred.value;
    if (!upsertDictionaryEntry(heard, preferred)) {
        showDictionaryStatus('Enter two different words or short phrases.', true);
        return;
    }
    el.dictionaryForm.reset();
    await saveTranscriptionDictionary('Correction added.');
}

async function handleDictionaryListClick(event) {
    const button = event.target.closest('[data-dictionary-remove]');
    if (!button) return;
    const index = Number(button.dataset.dictionaryRemove);
    if (!Number.isInteger(index) || index < 0 || index >= state.customDictionary.length) return;
    state.customDictionary.splice(index, 1);
    renderTranscriptionDictionary();
    await saveTranscriptionDictionary('Correction removed.');
}

function renderTranscriptionDictionary() {
    if (!el.dictionaryList) return;
    if (!state.customDictionary.length) {
        el.dictionaryList.innerHTML = '<div class="dictionary-empty">No corrections yet. Add one here or correct a word during a conversation.</div>';
        return;
    }
    el.dictionaryList.innerHTML = state.customDictionary.map((entry, index) => `
        <div class="dictionary-entry">
            <span><strong>${escapeHtml(entry.heard)}</strong><span aria-hidden="true"> → </span>${escapeHtml(entry.preferred)}</span>
            <button type="button" data-dictionary-remove="${index}" aria-label="Remove ${escapeHtml(entry.heard)} correction">Remove</button>
        </div>
    `).join('');
}

function showDictionaryStatus(message, isError = false) {
    if (!el.dictionaryStatus) return;
    el.dictionaryStatus.textContent = message;
    el.dictionaryStatus.classList.toggle('error', isError);
}

function openSessionDrawer() {
    applySettingsToUI();
    syncAdvancedToggles();
    el.drawerStatus.classList.remove('visible');
    el.sessionDrawer.classList.add('open');
}

function closeSessionDrawer() {
    el.sessionDrawer.classList.remove('open');
}

function pushLiveTranscriptionUpdate() {
    if (!state.dataChannel || state.dataChannel.readyState !== 'open' || !state.realtimeTranscriptionModel) return;
    sendRealtimeEvent({ type: 'session.update', session: buildTranscriptionSessionConfig() });
}

function showDrawerApplied() {
    el.drawerStatus.textContent = '✓  Applied';
    el.drawerStatus.classList.add('visible');
    setTimeout(() => el.drawerStatus.classList.remove('visible'), 1800);
}

// ─── Session start ────────────────────────────────────────────────────────────

// iOS Safari only authorizes audible media when play() is initiated directly
// by a user gesture. Prime the same element used for TTS before startSession's
// first await so later question playback remains authorized.
const SILENT_WAV_DATA_URL = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA';

function rememberTtsPlaybackError(error) {
    state.lastTtsPlaybackError = {
        name: error?.name || 'Error',
        message: error?.message || String(error),
        captured_at: new Date().toISOString(),
        ready_state: el.ttsAudio.readyState,
        source: el.ttsAudio.currentSrc || el.ttsAudio.src || '',
    };
}

function primeTtsPlayback() {
    if (state.ttsPlaybackPrimed) return;
    try {
        el.ttsAudio.src = SILENT_WAV_DATA_URL;
        el.ttsAudio.load();
        const playPromise = el.ttsAudio.play();
        if (!playPromise) {
            state.ttsPlaybackPrimed = true;
            return;
        }
        playPromise.then(() => {
            state.ttsPlaybackPrimed = true;
            state.lastTtsPlaybackError = null;
        }).catch(error => {
            rememberTtsPlaybackError(error);
            console.warn('Could not prime interview audio:', error);
        });
    } catch (error) {
        rememberTtsPlaybackError(error);
        console.warn('Could not prime interview audio:', error);
    }
}

function hideTtsRetry() {
    state.pendingTtsRetry = null;
    el.ttsRetry.classList.add('hidden');
    el.btnTtsRetry.disabled = false;
}

function showTtsRetry(conversationRevision, onFailure) {
    state.pendingTtsRetry = { conversationRevision, onFailure };
    el.ttsRetry.classList.remove('hidden');
    el.btnTtsRetry.disabled = false;
    el.visualizerStatus.textContent = 'Tap below to hear the question';
}

async function retryTtsPlayback() {
    const pending = state.pendingTtsRetry;
    if (!pending || pending.conversationRevision !== state.conversationRevision) {
        hideTtsRetry();
        return;
    }
    el.btnTtsRetry.disabled = true;
    try {
        await el.ttsAudio.play();
        state.ttsPlaybackPrimed = true;
        state.lastTtsPlaybackError = null;
        hideTtsRetry();
        el.visualizerStatus.textContent = 'Chatbot speaking…';
    } catch (error) {
        rememberTtsPlaybackError(error);
        console.error('TTS playback retry failed:', error);
        el.btnTtsRetry.disabled = false;
        if (error?.name !== 'NotAllowedError') {
            hideTtsRetry();
            pending.onFailure();
        }
    }
}

async function startSession() {
    setStartButtonLoading(true);
    state.streakAtSessionStart = JSON.parse(JSON.stringify(state.streak || defaultStreak()));

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
        if (!planData.realtime_transcription_model) {
            throw new Error('The realtime transcription model is not configured.');
        }
        state.realtimeTranscriptionModel = planData.realtime_transcription_model;

        const plannedQuestions = Array.isArray(planData.questions) ? planData.questions : [];
        const openingQuestion = plannedQuestions[0] || null;
        state.preparedQuestionsOriginal = JSON.parse(JSON.stringify(plannedQuestions));
        state.preparedQuestionsPool = openingQuestion ? plannedQuestions.slice(1) : [];
        state.topicChoiceActive = false;
        state.topicChoiceLocked = false;
        state.topicChoiceSeenIds = [];
        state.topicChoiceVisibleIds = [];
        const greeting = planData.greeting || 'Hello! How are you doing today?';

        console.log('[SESSION] Greeting:', greeting);
        console.log('[SESSION] Question pool:', state.preparedQuestionsPool);

        // 2. Microphone access
        state.audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        // Keep the outgoing Realtime audio track silent until the participant's
        // turn begins. The same track stays attached so WebRTC can start once.
        setPatientSpeechActive(false);

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

        if (openingQuestion) {
            askDynamicQuestion({
                acknowledgment: greeting,
                question: openingQuestion.text,
                action: 'next_prepared',
                question_meta: preparedQuestionMeta(openingQuestion),
                allowTopicChoice: state.preparedQuestionsPool.length > 0,
            });
        } else {
            askDynamicQuestion({ acknowledgment: '', question: greeting, action: 'greeting' });
        }

    } catch (err) {
        console.error('Session start failed:', err);
        alert(`Could not start session: ${err.message}`);
        setStartButtonLoading(false);
    }
}

function preparedQuestionId(question) {
    return String(question?.id || question?.text || '').trim();
}

function preparedQuestionMeta(question) {
    return {
        id: preparedQuestionId(question),
        brief_description: String(question?.brief_description || '').trim(),
        topic: String(question?.topic || 'unknown'),
        mode: String(question?.mode || 'unknown'),
        keywords: Array.isArray(question?.keywords) ? question.keywords : [],
        source: String(question?.source || ''),
        fills_gap: String(question?.fills_gap || ''),
        sensitivity: String(question?.sensitivity || ''),
    };
}

function recordSessionEvent(event, detail = {}) {
    if (!state.sessionId) return;
    fetch('/api/session-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            session_id: state.sessionId,
            event,
            detail,
            client_time: new Date().toISOString(),
        }),
    }).catch(error => console.warn(`Could not record ${event}:`, error));
}

function shuffled(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
}

function topicChoiceCandidates() {
    const seen = new Set();
    const questions = [];
    for (const question of state.preparedQuestionsPool) {
        const id = preparedQuestionId(question);
        if (!id || !question?.text || seen.has(id)) continue;
        seen.add(id);
        questions.push(question);
    }

    // Prefer gentler choices. High-sensitivity questions only fill a short menu
    // when the plan does not contain three safer alternatives.
    const safer = questions.filter(question => question.sensitivity !== 'high');
    const sensitive = questions.filter(question => question.sensitivity === 'high');
    return safer.length >= Math.min(3, questions.length) ? safer : [...safer, ...sensitive];
}

function sampleTopicChoices(count = 3) {
    const candidates = topicChoiceCandidates();
    const currentIds = new Set(state.topicChoiceVisibleIds);
    const seenIds = new Set(state.topicChoiceSeenIds);
    const selected = [];
    const selectedIds = new Set();
    const selectedTopics = new Set();

    const available = shuffled(candidates.filter(question => !currentIds.has(preparedQuestionId(question))));
    const fallback = shuffled(candidates.filter(question => currentIds.has(preparedQuestionId(question))));

    const take = (items, predicate) => {
        for (const question of items) {
            if (selected.length >= count) break;
            const id = preparedQuestionId(question);
            if (selectedIds.has(id) || !predicate(question, id)) continue;
            selected.push(question);
            selectedIds.add(id);
            selectedTopics.add(question.topic || 'unknown');
        }
    };

    take(available, (question, id) => !seenIds.has(id) && !selectedTopics.has(question.topic || 'unknown'));
    take(available, (_question, id) => !seenIds.has(id));
    take(available, question => !selectedTopics.has(question.topic || 'unknown'));
    take(available, () => true);
    take(fallback, () => true);

    state.topicChoiceVisibleIds = selected.map(preparedQuestionId);
    state.topicChoiceSeenIds = Array.from(new Set([
        ...state.topicChoiceSeenIds,
        ...state.topicChoiceVisibleIds,
    ]));
    return selected;
}

function attachTopicChoiceLauncher(questionBubble) {
    dismissTopicChoice({ reason: '', record: false });
    state.topicChoiceActive = true;
    state.topicChoiceLocked = false;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'topic-choice-launcher hidden';
    button.dataset.topicAction = 'open';
    button.disabled = true;
    button.textContent = 'Choose topic';
    questionBubble.appendChild(button);
}

function enableTopicChoiceLauncher() {
    if (!state.topicChoiceActive || state.topicChoiceLocked) return;
    const button = el.chatMessages.querySelector('.topic-choice-launcher');
    if (!button) return;
    button.disabled = false;
    button.classList.remove('hidden');
    el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

function renderTopicChooser({ refreshed = false } = {}) {
    const launcher = el.chatMessages.querySelector('.topic-choice-launcher');
    const questionBubble = launcher?.closest('.message-bubble.chatbot');
    if (!questionBubble) return;

    el.chatMessages.querySelector('.topic-chooser')?.remove();
    const choices = sampleTopicChoices();

    const panel = document.createElement('section');
    panel.className = 'topic-chooser';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'Choose a conversation topic');
    panel.setAttribute('aria-live', 'polite');

    const header = document.createElement('div');
    header.className = 'topic-chooser-header';

    const title = document.createElement('div');
    title.className = 'topic-chooser-title';
    title.textContent = 'What would you like to talk about?';

    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'topic-refresh-btn';
    refresh.dataset.topicAction = 'refresh';
    refresh.setAttribute('aria-label', 'Show different topics');
    refresh.title = 'Show different topics';
    refresh.innerHTML = '<span aria-hidden="true">↻</span><span>Different topics</span>';
    refresh.disabled = topicChoiceCandidates().length <= choices.length;
    header.append(title, refresh);

    const options = document.createElement('div');
    options.className = 'topic-options';

    const labelCounts = new Map();
    for (const question of choices) {
        const label = String(question.brief_description || question.topic || 'Life story').trim();
        const key = label.toLocaleLowerCase();
        labelCounts.set(key, (labelCounts.get(key) || 0) + 1);
    }

    for (const question of choices) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'topic-option-btn';
        button.dataset.topicAction = 'select';
        button.dataset.questionId = preparedQuestionId(question);

        const label = String(question.brief_description || question.topic || 'Life story').trim();
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        button.appendChild(labelSpan);
        if ((labelCounts.get(label.toLocaleLowerCase()) || 0) > 1) {
            const detail = document.createElement('small');
            detail.textContent = String(question.topic || 'Life story').replace(/_/g, ' ');
            button.appendChild(detail);
        }
        options.appendChild(button);
    }

    const ownTopic = document.createElement('button');
    ownTopic.type = 'button';
    ownTopic.className = 'topic-option-btn topic-option-own';
    ownTopic.dataset.topicAction = 'suggest-own';
    ownTopic.textContent = 'Suggest my own';
    options.appendChild(ownTopic);

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'topic-choice-back';
    back.dataset.topicAction = 'close';
    back.textContent = 'Back to the question';

    panel.append(header, options, back);
    questionBubble.insertAdjacentElement('afterend', panel);
    launcher.classList.add('hidden');
    el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
    const focusTarget = refreshed ? refresh : options.querySelector('.topic-option-btn');
    if (focusTarget) requestAnimationFrame(() => focusTarget.focus());

    recordSessionEvent(refreshed ? 'topic_chooser.refreshed' : 'topic_chooser.opened', {
        question_ids: state.topicChoiceVisibleIds,
    });
}

function clearTopicChoiceInput() {
    setPatientSpeechActive(false);
    state.activeRealtimeItemAccepting = false;
    clearRealtimeInputBuffer();
    state.liveTranscriptText = '';
    state.pendingDelta = '';
    state.lastRenderedTranscript = '';
    state.manualTranscriptOverride = null;
    state.manualTranscriptAutoSnapshot = '';
    state.manualTranscriptLocked = false;
    state.transcriptionConfidence = null;
    el.liveTranscript.value = '';
    el.liveTranscript.disabled = true;
    el.btnProceed.disabled = true;
    updateTranscriptionConfidenceUI();
}

function openTopicChooser() {
    if (!state.topicChoiceActive || state.topicChoiceLocked) return;
    clearTopicChoiceInput();
    el.visualizerStatus.textContent = 'Choose a topic below';
    renderTopicChooser();
}

function closeTopicChooser() {
    if (!state.topicChoiceActive || state.topicChoiceLocked) return;
    el.chatMessages.querySelector('.topic-chooser')?.remove();
    state.topicChoiceVisibleIds = [];
    enableTopicChoiceLauncher();
    enablePatientTurn();
    el.chatMessages.querySelector('.topic-choice-launcher')?.focus();
}

function dismissTopicChoice({ reason = '', record = true } = {}) {
    const hadChoice = state.topicChoiceActive;
    el.chatMessages.querySelector('.topic-chooser')?.remove();
    el.chatMessages.querySelector('.topic-choice-launcher')?.remove();
    state.topicChoiceActive = false;
    state.topicChoiceLocked = false;
    state.topicChoiceVisibleIds = [];
    if (record && hadChoice && reason) recordSessionEvent('topic_chooser.dismissed', { reason });
}

async function selectPreparedTopic(questionId) {
    if (!state.topicChoiceActive || state.topicChoiceLocked) return;
    const question = state.preparedQuestionsPool.find(item => preparedQuestionId(item) === questionId);
    if (!question) return;

    state.topicChoiceLocked = true;
    clearTopicChoiceInput();
    state.preparedQuestionsPool = state.preparedQuestionsPool.filter(
        item => preparedQuestionId(item) !== questionId
    );
    state.followupDepth = 0;
    state.awaitingConsent = false;
    recordSessionEvent('topic_chooser.selected', {
        question_id: questionId,
        topic: question.topic || 'unknown',
        mode: question.mode || 'unknown',
    });
    dismissTopicChoice({ record: false });
    await askDynamicQuestion({
        acknowledgment: '',
        question: question.text,
        action: 'next_prepared',
        question_meta: preparedQuestionMeta(question),
    });
}

async function selectOwnTopic() {
    if (!state.topicChoiceActive || state.topicChoiceLocked) return;
    state.topicChoiceLocked = true;
    clearTopicChoiceInput();
    state.followupDepth = 0;
    state.awaitingConsent = false;
    recordSessionEvent('topic_chooser.selected', { selection: 'suggest_own' });
    dismissTopicChoice({ record: false });
    await askDynamicQuestion({
        acknowledgment: '',
        question: 'What would you like to talk about?',
        action: 'user_topic_prompt',
        question_meta: { topic: 'open_choice', mode: 'user_choice', keywords: [] },
    });
}

function handleTopicChoiceAction(button) {
    const action = button.dataset.topicAction;
    if (action === 'open') openTopicChooser();
    if (action === 'refresh') renderTopicChooser({ refreshed: true });
    if (action === 'close') closeTopicChooser();
    if (action === 'select') selectPreparedTopic(button.dataset.questionId).catch(console.error);
    if (action === 'suggest-own') selectOwnTopic().catch(console.error);
}

// ─── Dynamic question flow ────────────────────────────────────────────────────

async function askDynamicQuestion({ acknowledgment, question, action, question_meta, questionMeta, allowTopicChoice = false }) {
    const conversationRevision = state.conversationRevision;
    state.turnNumber++;
    state.lastQuestion = question;
    state.lastQuestionMeta = question_meta || questionMeta || {};
    setPatientSpeechActive(false);
    hideTtsRetry();

    const isWrapUp = action === 'wrap_up';
    const isContinuationChoice = action === 'continuation_choice';
    const wrapUpFallback = 'Thank you so much for sharing your story today!';
    const visibleAcknowledgment = acknowledgment || (isWrapUp && !question ? wrapUpFallback : '');
    const spokenText = [visibleAcknowledgment, question].filter(Boolean).join(' ');
    if (!spokenText) {
        throw new Error(`Agent turn contained no text for action: ${action || 'missing'}`);
    }
    const turnNumber = state.turnNumber;

    // Show in chat: acknowledgment and question as separate bubbles when both present
    if (visibleAcknowledgment) appendMessage(visibleAcknowledgment, 'chatbot');
    const questionBubble = question ? appendMessage(question, 'chatbot') : null;
    if (allowTopicChoice && questionBubble) attachTopicChoiceLauncher(questionBubble);

    let agentStartSeconds = null;
    let agentTranscriptSaved = false;
    let agentAudioFilePath = '';
    const finalizeAgentTranscript = () => {
        if (agentTranscriptSaved || conversationRevision !== state.conversationRevision) return;
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
        if (agentContinuationStarted || conversationRevision !== state.conversationRevision) return;
        agentContinuationStarted = true;
        const next = () => {
            if (conversationRevision !== state.conversationRevision) return;
            if (isWrapUp) finishSession();
            else if (isContinuationChoice) { el.continuationChoice.classList.remove('hidden'); el.visualizerStatus.textContent = 'Choose how you would like to continue.'; }
            else {
                if (allowTopicChoice) enableTopicChoiceLauncher();
                enablePatientTurn();
            }
        };
        if (delayMs > 0) setTimeout(next, delayMs);
        else next();
    };

    // Reset patient input
    state.liveTranscriptText  = '';
    state.pendingDelta        = '';
    state.lastRenderedTranscript = '';
    state.transcriptEditBaseline = null;
    state.transcriptEditLatest = null;
    state.manualTranscriptOverride = null;
    state.manualTranscriptAutoSnapshot = '';
    state.manualTranscriptLocked = false;
    state.transcriptComposing = false;
    state.transcriptionConfidence = null;
    el.liveTranscript.value   = '';
    el.liveTranscript.scrollTop = 0;
    el.transcriptLearningStatus.textContent = '';
    updateTranscriptionConfidenceUI();
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
        if (conversationRevision !== state.conversationRevision) return;
        if (!res.ok || data.error) throw new Error(data.error || 'TTS failed');
        agentAudioFilePath = data.audio_file_path || '';
        el.ttsAudio.onplay = () => {
            if (conversationRevision !== state.conversationRevision) return;
            if (agentStartSeconds === null) agentStartSeconds = sessionSeconds();
        };
        el.ttsAudio.onended = () => {
            if (conversationRevision !== state.conversationRevision) return;
            finalizeAgentTranscript();
            continueAfterAgent();
        };
        el.ttsAudio.onerror = () => {
            if (conversationRevision !== state.conversationRevision) return;
            hideTtsRetry();
            finalizeAgentTranscript();
            continueAfterAgent(800);
        };
        el.ttsAudio.src = data.audio_url;
        el.ttsAudio.load();
        try {
            await el.ttsAudio.play();
            state.ttsPlaybackPrimed = true;
            state.lastTtsPlaybackError = null;
        } catch (playbackError) {
            rememberTtsPlaybackError(playbackError);
            if (playbackError?.name === 'NotAllowedError') {
                showTtsRetry(conversationRevision, () => {
                    finalizeAgentTranscript();
                    continueAfterAgent(800);
                });
                return;
            }
            throw playbackError;
        }
    } catch (err) {
        if (conversationRevision !== state.conversationRevision) return;
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
    if (!state.acceptingPatientSpeech || state.pendingTranscriptionCommit) return;

    dismissTopicChoice({ reason: 'answer_submitted' });

    finalizePendingTranscriptEdit();

    state.currentPatientSpeechEndSeconds = sessionSeconds();
    el.liveTranscript.disabled      = true;
    el.btnProceed.disabled          = true;
    el.visualizerStatus.textContent = 'Finalizing transcription…';
    setPatientSpeechActive(false);

    try {
        await commitRealtimeTranscription();
    } catch (err) {
        // Preserve any deltas already received so a transient finalization error
        // does not discard the participant's visible transcript.
        console.error('Realtime transcription finalization failed:', err);
    }

    const response = el.liveTranscript.value.trim();
    const patientEndSeconds = response
        ? (state.currentPatientSpeechEndSeconds ?? sessionSeconds())
        : sessionSeconds();
    const patientStartSeconds = response
        ? (state.currentPatientSpeechStartSeconds ?? state.currentPatientTurnStartSeconds ?? patientEndSeconds)
        : (state.currentPatientTurnStartSeconds ?? patientEndSeconds);
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
        question_meta: cloneForBugReport(state.lastQuestionMeta) || {},
        response,
        answer_snapshot: {
            prepared_questions: cloneForBugReport(state.preparedQuestionsPool) || [],
            declined_topics: cloneForBugReport(state.declinedTopics) || [],
            explored_new_details: cloneForBugReport(state.exploredNewDetails) || [],
            followup_depth: state.followupDepth,
            awaiting_consent: state.awaitingConsent,
            question: state.lastQuestion,
            question_meta: cloneForBugReport(state.lastQuestionMeta) || {},
            turn_number: state.turnNumber,
        }
    });

    // Partial save: transcript every turn, audio every 3 turns
    flushPartial();
    if (state.conversationHistory.length % 3 === 0) {
        flushPartial({ includeAudio: true });
    }

    // Ask once at the soft target; a participant may continue indefinitely.
    if (!state.targetChoiceShown && (state.totalWordCount >= 500 || sessionSeconds() >= 300)) {
        state.targetChoiceShown = true;
        await askDynamicQuestion({ acknowledgment: "Thank you for sharing all that, would you like to stop here for today or continue?", question: "", action: "continuation_choice", question_meta: { topic: "session_close", mode: "choice", keywords: [] } });
        return;
    }

    await requestAndAskNextQuestion();
}

async function requestAndAskNextQuestion() {
    const conversationRevision = state.conversationRevision;
    el.liveTranscript.disabled      = true;
    el.btnProceed.disabled          = true;
    el.visualizerStatus.textContent = 'Thinking…';

    try {
        const res = await fetch('/api/next-question', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                conversation_history: state.conversationHistory.map(exchange => ({
                    question: exchange.question,
                    question_meta: exchange.question_meta,
                    response: exchange.response,
                })),
                prepared_questions:   state.preparedQuestionsPool,
                declined_topics:      state.declinedTopics,
                explored_new_details: state.exploredNewDetails,
                followup_depth:       state.followupDepth,
                awaiting_consent:     state.awaitingConsent,
                session_id:           state.sessionId
            })
        });
        const next = await res.json();
        if (conversationRevision !== state.conversationRevision) return;

        if (!res.ok || next.error) {
            const requestSuffix = next.request_id ? ` (request ${next.request_id})` : '';
            throw new Error(`${next.error || 'Next-question request failed'}${requestSuffix}`);
        }

        const validActions = new Set(['followup', 'checkpoint', 'next_prepared', 'answer', 'wrap_up']);
        if (!validActions.has(next.action)) {
            throw new Error(`Next-question response had an invalid action: ${next.action || 'missing'}`);
        }
        if (
            next.action !== 'wrap_up' &&
            ![next.acknowledgment, next.question].some(value => typeof value === 'string' && value.trim())
        ) {
            throw new Error('Next-question response contained no text.');
        }

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
        if (conversationRevision !== state.conversationRevision) return;
        console.error('Next question error:', err);
        await wrapUpSession({
            closingText: "Thank you for sharing all of that with me. I look forward to chatting more next time."
        });
    }
}

function enablePatientTurn() {
    state.currentPatientTurnStartSeconds = sessionSeconds();
    state.currentPatientSpeechStartSeconds = state.currentPatientTurnStartSeconds;
    state.currentPatientSpeechEndSeconds = null;
    state.activeRealtimeItemAccepting = true;
    state.realtimeItems = {};
    clearRealtimeInputBuffer();
    setPatientSpeechActive(true);
    el.liveTranscript.disabled      = false;
    el.btnProceed.disabled          = false;
    el.visualizerStatus.textContent = 'Listening… speak now';
    setButtonLabel('proceed');
}

function setPatientSpeechActive(active) {
    state.acceptingPatientSpeech = Boolean(active);
    applyMicMuteForCurrentTurn();
}

function applyMicMuteForCurrentTurn() {
    if (!state.audioStream) return;
    // Manual transcription turns require a clean boundary. Audio is sent only
    // while the participant turn is active and is committed on Proceed.
    const shouldMute = !state.acceptingPatientSpeech;
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

function buildTranscriptionSessionConfig() {
    const transcription = {
        model: state.realtimeTranscriptionModel,
        delay: state.settings.transcription_delay || 'low'
    };
    if (state.settings.transcription_language) {
        transcription.language = state.settings.transcription_language;
    }
    return {
        type: 'transcription',
        audio: {
            input: {
                transcription,
                turn_detection: null
            }
        },
        include: state.settings.transcription_logprobs
            ? ['item.input_audio_transcription.logprobs']
            : []
    };
}

async function setupRealtimeTranscription() {
    const pc = new RTCPeerConnection();
    state.peerConnection = pc;

    state.audioStream.getTracks().forEach(track => pc.addTrack(track, state.audioStream));

    const dc = pc.createDataChannel("oai-events");
    state.dataChannel = dc;

    let sessionReadySettled = false;
    let resolveSessionReady;
    let rejectSessionReady;
    const sessionReady = new Promise((resolve, reject) => {
        resolveSessionReady = resolve;
        rejectSessionReady = reject;
    });
    const readyTimeout = setTimeout(() => {
        if (sessionReadySettled) return;
        sessionReadySettled = true;
        rejectSessionReady(new Error('Realtime transcription session timed out.'));
    }, 10000);

    pc.ontrack = e => console.log('[RT] incoming track:', e.track.kind);

    dc.addEventListener("open", () => {
        console.log('[RT] data channel open');
        dc.send(JSON.stringify({
            type: "session.update",
            session: buildTranscriptionSessionConfig()
        }));
    });

    dc.addEventListener("error", e => {
        console.error('[RT] data channel error:', e);
        settlePendingTranscription(new Error('Realtime data channel error.'));
        if (!sessionReadySettled) {
            sessionReadySettled = true;
            clearTimeout(readyTimeout);
            rejectSessionReady(new Error('Realtime data channel error.'));
        }
    });
    dc.addEventListener("close",  () => console.log('[RT] data channel closed'));

    dc.addEventListener("message", e => {
        if (state.settings.debug_realtime_events) {
            console.log('[RT] raw:', e.data.substring(0, 300));
        }
        try {
            const event = JSON.parse(e.data);
            if (event.type === 'session.updated' && !sessionReadySettled) {
                sessionReadySettled = true;
                clearTimeout(readyTimeout);
                resolveSessionReady();
            }
            handleRealtimeEvent(event);
        }
        catch (err) { console.error("Realtime parse error:", err); }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const tokenRes = await fetch('/api/realtime-token', { method: 'POST' });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.value) {
        throw new Error(tokenData.error || 'Could not create realtime transcription token.');
    }

    const sdpRes = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: {
            'Authorization': `Bearer ${tokenData.value}`,
            'Content-Type': 'application/sdp'
        }
    });

    if (!sdpRes.ok) {
        throw new Error(`Realtime SDP failed: ${await sdpRes.text()}`);
    }

    await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
    await sessionReady;
}

function sendRealtimeEvent(event) {
    if (!state.dataChannel || state.dataChannel.readyState !== 'open') {
        throw new Error('Realtime transcription connection is not ready.');
    }
    state.dataChannel.send(JSON.stringify(event));
}

function clearRealtimeInputBuffer() {
    if (!state.dataChannel || state.dataChannel.readyState !== 'open') return;
    sendRealtimeEvent({ type: 'input_audio_buffer.clear' });
}

function settlePendingTranscription(error = null, event = null) {
    const pending = state.pendingTranscriptionCommit;
    if (!pending) return;
    state.pendingTranscriptionCommit = null;
    state.awaitingCommittedTranscript = false;
    clearTimeout(pending.timeoutId);
    if (error) pending.reject(error);
    else pending.resolve(event);
}

function commitRealtimeTranscription() {
    state.awaitingCommittedTranscript = true;
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            settlePendingTranscription(new Error('Timed out waiting for the final transcript.'));
        }, 20000);
        state.pendingTranscriptionCommit = { resolve, reject, timeoutId };
        try {
            sendRealtimeEvent({ type: 'input_audio_buffer.commit' });
        } catch (err) {
            settlePendingTranscription(err);
        }
    });
}

function handleRealtimeEvent(event) {
    switch (event.type) {
        case "conversation.item.input_audio_transcription.delta":
            if (!shouldAcceptRealtimeTranscript(event)) break;
            if (state.topicChoiceActive && String(event.delta || '').trim()) {
                dismissTopicChoice({ reason: 'participant_started_speaking' });
            }
            // Delta boundaries are arbitrary and may carry meaningful leading
            // whitespace, so normalize only after the completed event arrives.
            state.pendingDelta += event.delta || "";
            updateTranscriptionConfidence(event);
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
                if (cleaned) {
                    if (state.topicChoiceActive) {
                        dismissTopicChoice({ reason: 'participant_started_speaking' });
                    }
                    state.liveTranscriptText += cleaned + " ";
                }
            }
            state.pendingDelta        = "";
            updateTranscriptionConfidence(event);
            refreshTranscriptUI();
            settlePendingTranscription(null, event);
            break;

        case "input_audio_buffer.speech_started":
            state.activeRealtimeItemAccepting = state.acceptingPatientSpeech;
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
            settlePendingTranscription(new Error(event.error?.message || 'Realtime API error.'));
            break;

        default:
            break;
    }
}

function shouldAcceptRealtimeTranscript(event) {
    if (state.awaitingCommittedTranscript) return true;
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

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyCustomDictionary(text) {
    let corrected = String(text || '');
    const entries = [...state.customDictionary].sort((a, b) => b.heard.length - a.heard.length);
    entries.forEach(entry => {
        const heard = normalizeDictionaryPhrase(entry.heard);
        const preferred = normalizeDictionaryPhrase(entry.preferred);
        if (!heard || !preferred) return;
        const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(heard)})(?=$|[^\\p{L}\\p{N}])`, 'giu');
        corrected = corrected.replace(pattern, (match, prefix) => `${prefix}${preferred}`);
    });
    return corrected;
}

function currentAutomaticTranscript() {
    return applyCustomDictionary((state.liveTranscriptText + state.pendingDelta).trim());
}

let _transcriptEditTimer = null;
function beginTranscriptManualEdit() {
    if (state.manualTranscriptLocked || el.liveTranscript.disabled) return;
    state.manualTranscriptLocked = true;
    state.transcriptEditBaseline = state.lastRenderedTranscript;
    state.manualTranscriptOverride = el.liveTranscript.value;
    state.manualTranscriptAutoSnapshot = currentAutomaticTranscript();
}

function handleTranscriptManualInput() {
    beginTranscriptManualEdit();
    if (state.topicChoiceActive && el.liveTranscript.value.trim()) {
        dismissTopicChoice({ reason: 'participant_started_typing' });
    }
    if (state.transcriptEditBaseline === null) {
        state.transcriptEditBaseline = state.lastRenderedTranscript;
    }
    state.transcriptEditLatest = el.liveTranscript.value;
    // Start the live manual overlay immediately. Incoming transcription deltas
    // can then be appended while the correction-learning timer is still active.
    state.manualTranscriptOverride = el.liveTranscript.value;
    state.manualTranscriptAutoSnapshot = currentAutomaticTranscript();
    el.transcriptLearningStatus.textContent = 'Checking your correction…';
    clearTimeout(_transcriptEditTimer);
    _transcriptEditTimer = setTimeout(finalizePendingTranscriptEdit, 900);
    updateTranscriptWordCount(el.liveTranscript.value);
}

function inferDictionaryCorrection(before, after) {
    const beforeTokens = String(before || '').trim().split(/\s+/).filter(Boolean);
    const afterTokens = String(after || '').trim().split(/\s+/).filter(Boolean);
    let prefix = 0;
    while (prefix < beforeTokens.length && prefix < afterTokens.length && beforeTokens[prefix] === afterTokens[prefix]) {
        prefix++;
    }
    let suffix = 0;
    while (
        suffix < beforeTokens.length - prefix &&
        suffix < afterTokens.length - prefix &&
        beforeTokens[beforeTokens.length - 1 - suffix] === afterTokens[afterTokens.length - 1 - suffix]
    ) {
        suffix++;
    }

    const heardTokens = beforeTokens.slice(prefix, beforeTokens.length - suffix);
    const preferredTokens = afterTokens.slice(prefix, afterTokens.length - suffix);
    if (!heardTokens.length || !preferredTokens.length || heardTokens.length > 4 || preferredTokens.length > 4) return null;

    const heard = normalizeDictionaryPhrase(heardTokens.join(' '));
    const preferred = normalizeDictionaryPhrase(preferredTokens.join(' '));
    if (!heard || !preferred || heard === preferred) return null;
    return { heard, preferred };
}

function finalizePendingTranscriptEdit() {
    clearTimeout(_transcriptEditTimer);
    _transcriptEditTimer = null;
    if (state.transcriptEditBaseline === null) return;

    const before = state.transcriptEditBaseline;
    const after = state.transcriptEditLatest ?? el.liveTranscript.value;
    const correction = inferDictionaryCorrection(before, after);
    state.transcriptEditBaseline = null;
    state.transcriptEditLatest = null;

    if (correction && upsertDictionaryEntry(correction.heard, correction.preferred)) {
        state.manualTranscriptOverride = null;
        state.manualTranscriptAutoSnapshot = '';
        el.transcriptLearningStatus.textContent = `Learned: ${correction.heard} → ${correction.preferred}`;
        saveTranscriptionDictionary(`Learned ${correction.heard} → ${correction.preferred}`).then(saved => {
            if (!saved) el.transcriptLearningStatus.textContent = 'Correction applied, but it could not be saved.';
        });
    } else {
        // Keep broader edits in this response, but do not turn additions or
        // deletions into a global replacement rule. The live override may also
        // contain transcript deltas received after the last keystroke, so do
        // not replace it with the older `after` snapshot here.
        state.manualTranscriptOverride = state.manualTranscriptOverride ?? after;
        state.manualTranscriptAutoSnapshot = currentAutomaticTranscript();
        el.transcriptLearningStatus.textContent = 'Edit kept for this response.';
    }
    // The edit is now stable. Keep the edited text as the manual base, then
    // allow subsequent realtime speech to append after it. Leaving this lock
    // enabled for the whole answer would hide every later spoken sentence.
    state.manualTranscriptLocked = false;
    state.transcriptComposing = false;
    refreshTranscriptUI();
}

function updateTranscriptionConfidence(event) {
    if (!state.settings.transcription_logprobs) return;
    const logprobs = Array.isArray(event?.logprobs) ? event.logprobs : [];
    const values = logprobs
        .map(item => typeof item === 'number' ? item : item?.logprob)
        .filter(value => Number.isFinite(value));
    if (!values.length) return;
    const probabilities = values.map(value => Math.exp(value));
    state.transcriptionConfidence = probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length;
    updateTranscriptionConfidenceUI();
}

function updateTranscriptionConfidenceUI() {
    if (!el.transcriptConfidence) return;
    if (!state.settings.transcription_logprobs || state.transcriptionConfidence === null) {
        el.transcriptConfidence.textContent = '';
        el.transcriptConfidence.removeAttribute('title');
        return;
    }
    const value = state.transcriptionConfidence;
    el.transcriptConfidence.textContent = value >= 0.85
        ? 'Confidence: high'
        : value >= 0.65 ? 'Confidence: moderate' : 'Please review uncertain wording';
    el.transcriptConfidence.title = `Estimated confidence: ${Math.round(value * 100)}%`;
}

function updateTranscriptWordCount(text) {
    const currentWords = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
    const totalWords = state.prevQuestionsWordCount + currentWords;
    state.totalWordCount = totalWords;
    el.wordCounter.textContent = `${totalWords} words`;
    if (!el.liveTranscript.disabled) setButtonLabel('proceed');
}

function scrollTranscriptToLatest(expectedText) {
    el.liveTranscript.scrollTop = el.liveTranscript.scrollHeight;
    requestAnimationFrame(() => {
        if (!state.manualTranscriptLocked && el.liveTranscript.value === expectedText) {
            el.liveTranscript.scrollTop = el.liveTranscript.scrollHeight;
        }
    });
}

function refreshTranscriptUI() {
    const automaticText = currentAutomaticTranscript();
    if (state.manualTranscriptLocked) {
        // While an iPhone keyboard edit is still settling, the visible text is
        // authoritative. Realtime events continue internally, but cannot replace
        // the textarea or move the keyboard cursor until the edit is finalized.
        const manualText = el.liveTranscript.value;
        state.manualTranscriptOverride = manualText;
        state.lastRenderedTranscript = manualText;
        updateTranscriptWordCount(manualText);
        return;
    }
    let fullText = automaticText;
    const preserveSelection = document.activeElement === el.liveTranscript;
    const selectionStart = preserveSelection ? el.liveTranscript.selectionStart : null;
    const selectionEnd = preserveSelection ? el.liveTranscript.selectionEnd : null;

    if (state.manualTranscriptOverride !== null) {
        const suffix = automaticText.startsWith(state.manualTranscriptAutoSnapshot)
            ? automaticText.slice(state.manualTranscriptAutoSnapshot.length)
            : '';
        fullText = `${state.manualTranscriptOverride}${suffix}`.trim();
        state.manualTranscriptOverride = fullText;
        state.manualTranscriptAutoSnapshot = automaticText;
    }

    el.liveTranscript.value = fullText;
    if (preserveSelection && selectionStart !== null && selectionEnd !== null) {
        const maxPosition = fullText.length;
        el.liveTranscript.setSelectionRange(
            Math.min(selectionStart, maxPosition),
            Math.min(selectionEnd, maxPosition)
        );
    }
    state.lastRenderedTranscript = fullText;
    scrollTranscriptToLatest(fullText);

    if (fullText && state.acceptingPatientSpeech && state.currentPatientSpeechStartSeconds === null) {
        state.currentPatientSpeechStartSeconds = state.currentPatientTurnStartSeconds ?? sessionSeconds();
    }
    updateTranscriptWordCount(fullText);
}

// ─── Finish session ───────────────────────────────────────────────────────────

function streakThemeTierForCurrent(current) {
    if (current >= 30) return 5;
    if (current >= 14) return 4;
    if (current >= 7) return 3;
    if (current >= 3) return 2;
    if (current >= 1) return 1;
    return 0;
}

function estimatedStreakAfterCompletion(before) {
    const prior = normalizeStreak(before);
    let current = 1;
    if (prior.completed_today) current = prior.current || 1;
    else if (prior.status === 'continue_today') current = (prior.current || 0) + 1;
    const milestones = [1, 3, 7, 14, 30, 60, 100];
    return {
        ...prior,
        current,
        longest: Math.max(prior.longest || 0, current),
        completed_today: true,
        status: 'active_today',
        theme_tier: streakThemeTierForCurrent(current),
        next_milestone: milestones.find(milestone => milestone > current) ?? null,
    };
}

function renderStreakCelebration(beforeValue, afterValue) {
    const before = normalizeStreak(beforeValue);
    const after = normalizeStreak(afterValue);
    const current = after.current;
    if (!el.streakCelebration || current < 1 || !after.completed_today) {
        el.streakCelebration?.classList.add('hidden');
        return;
    }

    const sameDay = before.completed_today;
    const advanced = !sameDay && (
        before.status === 'continue_today'
            ? current === before.current + 1
            : current === 1
    );
    const milestone = advanced && [7, 14, 30, 60, 100].includes(current);

    let title;
    let message;
    if (sameDay) {
        title = 'Another chapter added today';
        message = `Your ${streakDayLabel(current)} is already complete for today.`;
    } else if (current === 1) {
        title = 'Your story streak starts today';
        message = 'Come back tomorrow to keep it growing.';
    } else if (current === 7) {
        title = 'A full week of stories';
        message = 'Seven days of showing up and sharing your life.';
    } else if (current === 14) {
        title = 'Two weeks of stories';
        message = 'Your life story is becoming richer every day.';
    } else if (current === 30) {
        title = 'Thirty days of stories';
        message = 'A remarkable month of memories and reflection.';
    } else if (milestone) {
        title = `${current} days of stories`;
        message = 'A wonderful milestone in the story you are building.';
    } else {
        title = `${current} days of stories`;
        message = 'You kept your story going today.';
    }

    el.streakCelebrationNumber.textContent = String(current);
    el.streakCelebrationTitle.textContent = title;
    el.streakCelebrationMessage.textContent = message;
    el.streakCelebration.classList.toggle('is-milestone', milestone);
    el.streakCelebration.classList.toggle('is-same-day', sameDay);
    el.streakCelebration.setAttribute('aria-label', `${title}. ${message}`);
    renderStreakTrail(el.finishStreakTrail, current, {
        animateDay: advanced && current <= 7 ? current : 0,
    });

    // Reinsert the hidden state for one frame so repeat sessions can replay the
    // entrance without keeping a distracting loop running.
    el.streakCelebration.classList.add('hidden');
    requestAnimationFrame(() => el.streakCelebration.classList.remove('hidden'));
}

async function wrapUpSession({ closingText = "Thank you for sharing all of that with me. I look forward to chatting more next time." } = {}) {
    if (state.isFinishing || state.sessionSaved) return;
    dismissTopicChoice({ reason: 'session_ending' });
    el.liveTranscript.disabled      = true;
    el.btnProceed.disabled          = true;
    el.btnEndSession.disabled       = true;
    el.visualizerStatus.textContent = 'Wrapping up…';
    setPatientSpeechActive(false);

    await askDynamicQuestion({
        acknowledgment: closingText,
        question: '',
        action: 'wrap_up',
        question_meta: { topic: 'session_close', mode: 'wrap_up', keywords: [] }
    });
}

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
    hideTtsRetry();

    setPatientSpeechActive(false);
    el.liveTranscript.disabled      = true;
    el.btnProceed.disabled          = true;
    el.btnEndSession.disabled       = true;
    el.visualizerStatus.textContent = 'Saving session…';
    el.streakCelebration.classList.add('hidden');

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

    const streakBefore = normalizeStreak(state.streakAtSessionStart || state.streak);

    // Save audio + transcript CSV
    const blob = new Blob(state.sessionChunks, { type: state.mimeType });
    const form = new FormData();
    form.append('session_id', state.sessionId);
    form.append('audio',      blob, 'session.webm');
    form.append('transcript', JSON.stringify(state.transcripts));
    let saveSucceeded = false;
    try {
        const saveRes = await fetch('/api/save_session', { method: 'POST', body: form });
        const saveData = await saveRes.json().catch(() => ({}));
        if (!saveRes.ok || saveData.error) {
            throw new Error(saveData.error || 'The session could not be saved.');
        }
        state.sessionSaved = true;
        saveSucceeded = true;
        // Remove partial-save files now that the full session is saved
        fetch('/api/cleanup-partial', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ session_id: state.sessionId })
        }).catch(() => {});
    } catch (e) {
        console.error('Save session failed:', e);
    }

    let streakAfter = null;
    if (saveSucceeded) {
        const updatedStats = await fetchStats();
        streakAfter = updatedStats?.streak
            ? normalizeStreak(updatedStats.streak)
            : estimatedStreakAfterCompletion(streakBefore);
        state.streak = streakAfter;
        applyStreakTheme(streakAfter);
        renderHomeStreak(streakAfter);
    }

    el.statDuration.textContent   = formatDuration(durationSecs);
    el.statWords.textContent      = state.totalWordCount;
    el.statParagraphs.textContent = saveSucceeded ? 'Updating…' : '–';
    el.finishTitle.textContent = saveSucceeded ? 'Session Complete' : 'Session Finished';
    el.finishMessage.textContent = saveSucceeded
        ? 'Thank you for sharing your story today.'
        : 'We could not safely save this session. Please try again later.';
    if (saveSucceeded) renderStreakCelebration(streakBefore, streakAfter);
    else el.streakCelebration.classList.add('hidden');
    const finishScreen = document.getElementById('screen-finish');
    finishScreen.classList.toggle('save-failed', !saveSucceeded);
    finishScreen.scrollTop = 0;
    el.btnHome.disabled = saveSucceeded;
    el.btnHome.textContent = saveSucceeded ? 'Updating your story…' : 'Back to Home';
    showScreen('screen-finish');

    if (!saveSucceeded) {
        el.btnHome.disabled = false;
        return;
    }

    // The reward is visible immediately. Biography work continues while the
    // participant reads it, then the refreshed portrait begins painting.
    loadPortrait();
    let bioParagraphs = '–';
    try {
        const bioRes  = await fetch('/api/update-biography', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ session_id: state.sessionId, transcript: state.transcripts })
        });
        const bioData = await bioRes.json().catch(() => ({}));
        if (!bioRes.ok || bioData.error) throw new Error(bioData.error || 'Biography update failed.');
        bioParagraphs = bioData.biography_paragraphs ?? '–';
    } catch (e) {
        console.error('Biography update failed:', e);
    }
    el.statParagraphs.textContent = bioParagraphs;
    await fetchStats();
    startPortraitGeneration();
    el.btnHome.textContent = 'Back to Home';
    el.btnHome.disabled = false;
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
        { color: state.waveColors[0], freq: 0.015, a: 22 },
        { color: state.waveColors[1], freq: 0.025, a: 14 },
        { color: state.waveColors[2], freq: 0.008, a: 30 },
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
    div.className = `message-bubble ${speaker}`;

    const messageText = document.createElement('span');
    messageText.className = 'message-text';
    messageText.textContent = text;
    div.appendChild(messageText);

    if (speaker === 'patient') {
        el.chatMessages.querySelectorAll('.message-bubble.patient .message-actions').forEach(actions => {
            actions.classList.add('hidden');
        });

        const actions = document.createElement('span');
        actions.className = 'message-actions';

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'message-action-btn';
        editButton.dataset.messageAction = 'edit';
        editButton.setAttribute('aria-label', 'Edit this answer');
        editButton.title = 'Edit answer';
        editButton.textContent = '✎';

        const retakeButton = document.createElement('button');
        retakeButton.type = 'button';
        retakeButton.className = 'message-action-btn';
        retakeButton.dataset.messageAction = 'retake';
        retakeButton.setAttribute('aria-label', 'Retake this answer');
        retakeButton.title = 'Retake answer';
        retakeButton.textContent = '↻';

        actions.append(editButton, retakeButton);
        div.appendChild(actions);
    }

    el.chatMessages.appendChild(div);
    el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
    return div;
}

function latestPatientBubble() {
    const bubbles = el.chatMessages.querySelectorAll('.message-bubble.patient');
    return bubbles.length ? bubbles[bubbles.length - 1] : null;
}

function handleConversationBubbleAction(event) {
    const topicButton = event.target.closest('[data-topic-action]');
    if (topicButton) {
        handleTopicChoiceAction(topicButton);
        return;
    }

    const button = event.target.closest('[data-message-action]');
    if (!button) return;
    const bubble = button.closest('.message-bubble.patient');
    if (!bubble || bubble !== latestPatientBubble()) return;

    const action = button.dataset.messageAction;
    if (action === 'edit') beginLatestAnswerEdit(bubble);
    if (action === 'retake') retakeLatestAnswer(bubble);
    if (action === 'edit-save') saveLatestAnswerEdit(bubble);
    if (action === 'edit-cancel') cancelLatestAnswerEdit(bubble);
}

function latestPatientTranscriptIndex() {
    for (let index = state.transcripts.length - 1; index >= 0; index--) {
        if (state.transcripts[index]?.speaker === 'Patient') return index;
    }
    return -1;
}

function restoreAnswerSnapshot(exchange) {
    const snapshot = exchange?.answer_snapshot;
    if (!snapshot) throw new Error('This answer cannot be revised because its conversation snapshot is missing.');
    state.preparedQuestionsPool = cloneForBugReport(snapshot.prepared_questions) || [];
    state.declinedTopics = cloneForBugReport(snapshot.declined_topics) || [];
    state.exploredNewDetails = cloneForBugReport(snapshot.explored_new_details) || [];
    state.followupDepth = snapshot.followup_depth || 0;
    state.awaitingConsent = Boolean(snapshot.awaiting_consent);
    state.lastQuestion = snapshot.question || exchange.question || '';
    state.lastQuestionMeta = cloneForBugReport(snapshot.question_meta) || {};
    state.turnNumber = Number(snapshot.turn_number) || state.turnNumber;
}

function prepareLatestAnswerRevision(bubble) {
    if (
        state.answerRevisionInProgress ||
        state.pendingTranscriptionCommit ||
        state.isFinishing ||
        state.sessionSaved ||
        bubble !== latestPatientBubble()
    ) {
        return null;
    }

    const exchange = state.conversationHistory[state.conversationHistory.length - 1];
    if (!exchange) return null;

    try {
        restoreAnswerSnapshot(exchange);
    } catch (err) {
        console.error('Answer revision snapshot error:', err);
        alert(err.message);
        return null;
    }

    state.conversationRevision++;
    setPatientSpeechActive(false);

    el.ttsAudio.onplay = null;
    el.ttsAudio.onended = null;
    el.ttsAudio.onerror = null;
    el.ttsAudio.pause();
    el.ttsAudio.removeAttribute('src');
    el.ttsAudio.load();
    state.pendingAgentTranscriptFinalizer = null;

    while (bubble.nextSibling) bubble.nextSibling.remove();

    const patientTranscriptIndex = latestPatientTranscriptIndex();
    if (patientTranscriptIndex >= 0) {
        state.transcripts = state.transcripts.slice(0, patientTranscriptIndex + 1);
    }

    clearTimeout(_transcriptEditTimer);
    _transcriptEditTimer = null;
    state.liveTranscriptText = '';
    state.pendingDelta = '';
    state.lastRenderedTranscript = '';
    state.transcriptEditBaseline = null;
    state.transcriptEditLatest = null;
    state.manualTranscriptOverride = null;
    state.manualTranscriptAutoSnapshot = '';
    state.manualTranscriptLocked = false;
    state.transcriptComposing = false;
    state.transcriptionConfidence = null;
    state.realtimeItems = {};
    state.activeRealtimeItemAccepting = false;
    state.awaitingCommittedTranscript = false;
    clearRealtimeInputBuffer();

    el.liveTranscript.value = '';
    el.liveTranscript.scrollTop = 0;
    el.liveTranscript.disabled = true;
    el.btnProceed.disabled = true;
    el.transcriptLearningStatus.textContent = '';
    updateTranscriptionConfidenceUI();
    el.btnEndSession.disabled = false;
    state.isFinishing = false;
    return exchange;
}

function recalculateConversationWordCount() {
    const total = state.conversationHistory.reduce((sum, exchange) => {
        const words = String(exchange.response || '').trim().split(/\s+/).filter(Boolean).length;
        return sum + words;
    }, 0);
    state.prevQuestionsWordCount = total;
    state.totalWordCount = total;
    el.wordCounter.textContent = `${total} words`;
}

function setPatientBubbleEditing(bubble, editing) {
    bubble.classList.toggle('editing', editing);
    bubble.querySelector('.message-text')?.classList.toggle('hidden', editing);
    bubble.querySelector('.message-actions')?.classList.toggle('hidden', editing);
    if (!editing) bubble.querySelector('.message-editor')?.remove();
}

function beginLatestAnswerEdit(bubble) {
    if (state.answerEditActive) return;
    const exchange = prepareLatestAnswerRevision(bubble);
    if (!exchange) return;

    state.answerEditActive = true;
    el.btnEndSession.disabled = true;
    setPatientBubbleEditing(bubble, true);

    const editor = document.createElement('span');
    editor.className = 'message-editor';
    const textarea = document.createElement('textarea');
    textarea.className = 'message-edit-textarea';
    textarea.value = exchange.response || '';
    textarea.setAttribute('aria-label', 'Edit answer text');

    const editorActions = document.createElement('span');
    editorActions.className = 'message-editor-actions';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.dataset.messageAction = 'edit-cancel';
    cancelButton.textContent = 'Cancel';
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.dataset.messageAction = 'edit-save';
    saveButton.textContent = 'OK';
    editorActions.append(cancelButton, saveButton);
    editor.append(textarea, editorActions);
    bubble.appendChild(editor);
    requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
}

async function continueAfterAnswerRevision() {
    state.answerRevisionInProgress = true;
    const actionButtons = latestPatientBubble()?.querySelectorAll('.message-action-btn') || [];
    actionButtons.forEach(button => { button.disabled = true; });
    try {
        if (state.totalWordCount >= 500) {
            await wrapUpSession();
        } else {
            await requestAndAskNextQuestion();
        }
    } finally {
        actionButtons.forEach(button => { button.disabled = false; });
        state.answerRevisionInProgress = false;
    }
}

async function saveLatestAnswerEdit(bubble) {
    if (!state.answerEditActive || state.answerRevisionInProgress) return;
    const textarea = bubble.querySelector('.message-edit-textarea');
    if (!textarea) return;

    const correctedText = textarea.value.trim();
    const exchange = state.conversationHistory[state.conversationHistory.length - 1];
    if (!exchange) return;

    exchange.response = correctedText;
    const patientTranscriptIndex = latestPatientTranscriptIndex();
    if (patientTranscriptIndex >= 0) {
        state.transcripts[patientTranscriptIndex].text = correctedText;
    }
    bubble.querySelector('.message-text').textContent = correctedText || '(no response)';
    state.answerEditActive = false;
    el.btnEndSession.disabled = false;
    setPatientBubbleEditing(bubble, false);
    recalculateConversationWordCount();
    flushPartial();
    el.visualizerStatus.textContent = 'Recalculating response…';
    await continueAfterAnswerRevision();
}

async function cancelLatestAnswerEdit(bubble) {
    if (!state.answerEditActive || state.answerRevisionInProgress) return;
    state.answerEditActive = false;
    el.btnEndSession.disabled = false;
    setPatientBubbleEditing(bubble, false);
    el.visualizerStatus.textContent = 'Restoring response…';
    await continueAfterAnswerRevision();
}

function retakeLatestAnswer(bubble) {
    if (state.answerEditActive) return;
    const exchange = prepareLatestAnswerRevision(bubble);
    if (!exchange) return;

    state.conversationHistory.pop();
    const patientTranscriptIndex = latestPatientTranscriptIndex();
    if (patientTranscriptIndex >= 0) {
        state.transcripts = state.transcripts.slice(0, patientTranscriptIndex);
    }
    bubble.remove();
    recalculateConversationWordCount();
    flushPartial();
    enablePatientTurn();
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
    hideTtsRetry();
}

function resetState() {
    Object.assign(state, {
        preparedQuestionsOriginal: [],
        preparedQuestionsPool:  [],
        conversationHistory:    [],
        followupDepth:          0,
        awaitingConsent:        false,
        declinedTopics:         [],
        exploredNewDetails:     [],
        lastQuestion:           '',
        lastQuestionMeta:       {},
        turnNumber:             0,
        conversationRevision:   0,
        answerRevisionInProgress: false,
        answerEditActive:       false,
        topicChoiceActive:      false,
        topicChoiceLocked:      false,
        topicChoiceSeenIds:     [],
        topicChoiceVisibleIds:  [],
        streakAtSessionStart:   null,
        sessionId:              '',
        realtimeTranscriptionModel: null,
        // settings intentionally not reset — they persist across sessions
        sessionStartTime:       null,
        sessionStartPerf:       null,
        timerInterval:          null,
        transcripts:            [],
        isFinishing:            false,
        sessionSaved:           false,
        targetChoiceShown:     false,
        pendingAgentTranscriptFinalizer: null,
        prevQuestionsWordCount: 0,
        totalWordCount:         0,
        liveTranscriptText:     '',
        pendingDelta:           '',
        acceptingPatientSpeech: false,
        realtimeItems:          {},
        activeRealtimeItemAccepting: false,
        awaitingCommittedTranscript: false,
        pendingTranscriptionCommit: null,
        lastRenderedTranscript: '',
        transcriptEditBaseline: null,
        transcriptEditLatest: null,
        manualTranscriptOverride: null,
        manualTranscriptAutoSnapshot: '',
        manualTranscriptLocked: false,
        transcriptComposing: false,
        transcriptionConfidence: null,
        currentPatientTurnStartSeconds: null,
        currentPatientSpeechStartSeconds: null,
        currentPatientSpeechEndSeconds: null,
        audioStream:            null,
        sessionRecorder:        null,
        sessionChunks:          [],
        mimeType:               '',
        ttsPlaybackPrimed:      false,
        pendingTtsRetry:        null,
        lastTtsPlaybackError:   null,
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
        bugReportScreenshotBlob: null,
        bugReportContext:        null,
        bugReportPreviewUrl:     '',
        bugReportRecorder:       null,
        bugReportStream:         null,
        bugReportChunks:         [],
        bugReportMime:           '',
        bugReportDiscardRecording: false,
        bugReportWasAcceptingSpeech: false,
        bugReportTtsWasPlaying:  false,
    });
    el.chatMessages.innerHTML   = '';
    el.liveTranscript.value     = '';
    el.transcriptLearningStatus.textContent = '';
    updateTranscriptionConfidenceUI();
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
