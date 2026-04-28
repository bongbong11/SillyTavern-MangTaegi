// 당신의 망태기 v1.0
// SillyTavern Extension - NPC 자동 수집 및 프로필 생성

import { getContext, extension_settings, saveSettingsDebounced, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types, saveChat } from '../../../../script.js';

const EXT_NAME = '당신의망태기';

// 기본 설정
const defaultSettings = {
    apiType: 'express',       // 'express' | 'vertex' | 'full'
    apiKey: '',               // Gemini Express API 키 또는 Full API 키
    vertexProject: '',        // Vertex AI 프로젝트 ID
    vertexLocation: 'us-central1',
    vertexServiceAccount: '', // Vertex 서비스 계정 JSON (문자열)
    displayLanguage: 'ko',    // 'ko' | 'en'
    npcData: {},              // chatId -> NPC 배열
};

// 현재 설정
let settings = {};
let currentFilter = 'all';
let currentTab = 'list';
let activeModal = null;

// ─── 초기화 ────────────────────────────────────────────────
function init() {
    // 설정 로드
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = { ...defaultSettings };
    }
    settings = extension_settings[EXT_NAME];
    if (!settings.npcData) settings.npcData = {};

    // 사이드패널 버튼 추가
    addPanelButton();

    // 패널 HTML 삽입
    injectPanel();

    // 이벤트 연결
    bindEvents();

    console.log('[망태기] 초기화 완료');
}

// ─── 사이드패널 버튼 ────────────────────────────────────────
function addPanelButton() {
    const btn = document.createElement('div');
    btn.id = '망태기-btn';
    btn.classList.add('fa-solid', 'fa-bag-shopping', 'interactable');
    btn.title = '당신의 망태기';
    btn.setAttribute('tabindex', '0');
    btn.style.cssText = 'font-size:18px; cursor:pointer;';

    btn.addEventListener('click', togglePanel);

    // ST 사이드바 아이콘 영역에 추가
    const sidebar = document.getElementById('leftSendForm') || document.querySelector('#send_form');
    if (sidebar) {
        sidebar.prepend(btn);
    } else {
        // fallback: 상단 바
        const topBar = document.getElementById('top-bar');
        if (topBar) topBar.appendChild(btn);
    }
}

// ─── 패널 HTML 삽입 ─────────────────────────────────────────
function injectPanel() {
    const panel = document.createElement('div');
    panel.id = '망태기-panel';
    panel.style.display = 'none';

    panel.innerHTML = `
        <div class="mb-header">
            <div class="mb-title">
                <span class="mb-title-icon">🎒</span>
                당신의 망태기
            </div>
            <div class="mb-subtitle">롤플 속 인물들을 수집합니다</div>
            <div class="mb-tabs">
                <button class="mb-tab active" data-tab="list">인물 목록</button>
                <button class="mb-tab" data-tab="pinned">고정됨</button>
                <button class="mb-tab" data-tab="settings">설정</button>
            </div>
        </div>

        <div id="mb-tab-list">
            <div class="mb-filter-bar">
                <button class="mb-filter-btn active" data-filter="all">전체</button>
                <button class="mb-filter-btn" data-filter="both">
                    <span class="mb-filter-dot both"></span>둘 다
                </button>
                <button class="mb-filter-btn" data-filter="char">
                    <span class="mb-filter-dot char"></span>캐릭터
                </button>
                <button class="mb-filter-btn" data-filter="user">
                    <span class="mb-filter-dot user"></span>유저
                </button>
                <button class="mb-filter-btn" data-filter="unknown">
                    <span class="mb-filter-dot unknown"></span>기타
                </button>
            </div>
            <button class="mb-scan-btn" id="mb-scan-all">
                <span>🔍</span> 전체 채팅 스캔
            </button>
            <div class="mb-list" id="mb-npc-list"></div>
        </div>

        <div id="mb-tab-pinned" style="display:none;">
            <div class="mb-list" id="mb-pinned-list"></div>
        </div>

        <div id="mb-tab-settings" style="display:none;">
            <div class="mb-settings">
                <div class="mb-setting-group">
                    <div class="mb-setting-label">API 연결</div>
                    <div class="mb-setting-row">
                        <div class="mb-setting-name">API 종류</div>
                        <select class="mb-select" id="mb-api-type">
                            <option value="express">Gemini Express (API 키)</option>
                            <option value="full">Gemini Full API</option>
                            <option value="vertex">Vertex AI (서비스 계정)</option>
                        </select>
                    </div>
                    <div class="mb-setting-row" id="mb-row-apikey">
                        <div class="mb-setting-name">API 키</div>
                        <div class="mb-setting-desc">Gemini API 키를 입력하세요</div>
                        <input type="password" class="mb-input" id="mb-api-key" placeholder="AIza...">
                    </div>
                    <div class="mb-setting-row" id="mb-row-vertex" style="display:none;">
                        <div class="mb-setting-name">프로젝트 ID</div>
                        <input type="text" class="mb-input" id="mb-vertex-project" placeholder="my-project-id">
                        <div class="mb-setting-name" style="margin-top:8px;">서비스 계정 JSON</div>
                        <textarea class="mb-input" id="mb-vertex-sa" rows="4" placeholder='{"type":"service_account",...}'></textarea>
                    </div>
                </div>
                <div class="mb-setting-group">
                    <div class="mb-setting-label">표시 설정</div>
                    <div class="mb-setting-row">
                        <div class="mb-setting-name">프로필 표시 언어</div>
                        <div class="mb-setting-desc">목록 이름은 원문 그대로, 프로필 내용만 적용됩니다</div>
                        <select class="mb-select" id="mb-display-lang">
                            <option value="ko">한국어</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                </div>
                <button class="mb-save-btn" id="mb-save-settings">저장</button>
            </div>
        </div>
    `;

    // ST 우측 패널 영역에 삽입
    const rightPanel = document.getElementById('right-nav-panel') || document.querySelector('.right_panel');
    if (rightPanel) {
        rightPanel.appendChild(panel);
    } else {
        document.body.appendChild(panel);
    }
}

// ─── 패널 토글 ──────────────────────────────────────────────
function togglePanel() {
    const panel = document.getElementById('망태기-panel');
    if (!panel) return;

    if (panel.style.display === 'none') {
        panel.style.display = 'flex';
        loadSettings();
        renderNPCList();
    } else {
        panel.style.display = 'none';
    }
}

// ─── 이벤트 바인딩 ──────────────────────────────────────────
function bindEvents() {
    document.addEventListener('click', (e) => {
        // 탭 전환
        if (e.target.matches('.mb-tab')) {
            switchTab(e.target.dataset.tab);
        }

        // 필터
        if (e.target.matches('.mb-filter-btn') || e.target.closest('.mb-filter-btn')) {
            const btn = e.target.matches('.mb-filter-btn') ? e.target : e.target.closest('.mb-filter-btn');
            currentFilter = btn.dataset.filter;
            document.querySelectorAll('.mb-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderNPCList();
        }

        // 전체 스캔
        if (e.target.id === 'mb-scan-all') {
            scanAllChat();
        }

        // 설정 저장
        if (e.target.id === 'mb-save-settings') {
            saveSettings();
        }

        // API 타입 변경
        if (e.target.id === 'mb-api-type') {
            toggleAPIFields(e.target.value);
        }

        // 모달 닫기
        if (e.target.matches('.mb-modal-overlay') || e.target.matches('.mb-modal-close')) {
            closeModal();
        }

        // NPC 카드 클릭
        if (e.target.closest('.mb-npc-card') && !e.target.closest('.mb-pin-btn') && !e.target.closest('.mb-star')) {
            const card = e.target.closest('.mb-npc-card');
            const npcId = card.dataset.npcId;
            openNPCModal(npcId);
        }

        // 핀 버튼
        if (e.target.closest('.mb-pin-btn')) {
            const card = e.target.closest('.mb-npc-card');
            if (card) togglePin(card.dataset.npcId);
        }

        // 모달 핀
        if (e.target.id === 'mb-modal-pin') {
            const npcId = e.target.dataset.npcId;
            togglePin(npcId);
            closeModal();
            openNPCModal(npcId);
        }
    });

    // 별점 (이벤트 위임)
    document.addEventListener('click', (e) => {
        if (e.target.matches('.mb-star') || e.target.matches('.mb-modal-star')) {
            const star = e.target;
            const npcId = star.closest('[data-npc-id]')?.dataset.npcId ||
                          star.dataset.npcId;
            const val = parseInt(star.dataset.val);
            if (npcId) setImportance(npcId, val);
        }
    });

    // 새 메시지 이벤트 → 수집 버튼 생성
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
}

// ─── 탭 전환 ────────────────────────────────────────────────
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.mb-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.mb-tab[data-tab="${tab}"]`)?.classList.add('active');

    document.getElementById('mb-tab-list').style.display = tab === 'list' ? 'flex' : 'none';
    document.getElementById('mb-tab-list').style.flexDirection = 'column';
    document.getElementById('mb-tab-pinned').style.display = tab === 'pinned' ? 'flex' : 'none';
    document.getElementById('mb-tab-pinned').style.flexDirection = 'column';
    document.getElementById('mb-tab-settings').style.display = tab === 'settings' ? 'flex' : 'none';
    document.getElementById('mb-tab-settings').style.flexDirection = 'column';

    if (tab === 'pinned') renderPinnedList();
    if (tab === 'list') renderNPCList();
}

// ─── 채팅 ID 가져오기 ───────────────────────────────────────
function getChatId() {
    const ctx = getContext();
    return ctx?.chatId || ctx?.characterId || 'default';
}

function getChatNPCs() {
    const chatId = getChatId();
    if (!settings.npcData[chatId]) settings.npcData[chatId] = [];
    return settings.npcData[chatId];
}

// ─── NPC 목록 렌더링 ────────────────────────────────────────
function renderNPCList() {
    const container = document.getElementById('mb-npc-list');
    if (!container) return;

    let npcs = getChatNPCs();
    if (currentFilter !== 'all') {
        npcs = npcs.filter(n => n.relation === currentFilter);
    }

    if (npcs.length === 0) {
        container.innerHTML = `
            <div class="mb-empty">
                <div class="mb-empty-icon">🎒</div>
                <div class="mb-empty-text">아직 수집된 인물이 없어요.<br>채팅 스캔이나 수집 버튼을 눌러보세요.</div>
            </div>`;
        return;
    }

    container.innerHTML = npcs.map(npc => renderNPCCard(npc)).join('');
}

function renderPinnedList() {
    const container = document.getElementById('mb-pinned-list');
    if (!container) return;

    const pinned = getChatNPCs().filter(n => n.pinned);

    if (pinned.length === 0) {
        container.innerHTML = `
            <div class="mb-empty" style="padding: 20px;">
                <div class="mb-empty-icon">📌</div>
                <div class="mb-empty-text">고정된 인물이 없어요.<br>인물 카드에서 📌를 눌러 고정하면<br>롤플 컨텍스트에 자동 주입됩니다.</div>
            </div>`;
        return;
    }

    container.innerHTML = pinned.map(npc => renderNPCCard(npc)).join('');
}

function renderNPCCard(npc) {
    const stars = [1,2,3].map(i =>
        `<span class="mb-star ${npc.importance >= i ? 'active' : ''}" data-val="${i}" data-npc-id="${npc.id}">★</span>`
    ).join('');

    return `
        <div class="mb-npc-card ${npc.pinned ? 'pinned' : ''}" data-npc-id="${npc.id}">
            <span class="mb-relation-dot ${npc.relation}"></span>
            <div class="mb-npc-main">
                <div class="mb-npc-name">${npc.name}</div>
                <div class="mb-npc-brief">${npc.profile?.occupation || npc.profile?.brief || '프로필 없음'}</div>
            </div>
            <div class="mb-npc-actions">
                <div class="mb-stars">${stars}</div>
                <button class="mb-pin-btn ${npc.pinned ? 'active' : ''}" title="롤플에 고정">📌</button>
            </div>
        </div>`;
}

// ─── 모달 ───────────────────────────────────────────────────
function openNPCModal(npcId) {
    const npc = getChatNPCs().find(n => n.id === npcId);
    if (!npc) return;

    const lang = settings.displayLanguage || 'ko';
    const L = {
        fullname: lang === 'ko' ? '풀네임' : 'Full Name',
        age: lang === 'ko' ? '나이' : 'Age',
        gender: lang === 'ko' ? '성별' : 'Gender',
        occupation: lang === 'ko' ? '직업/전공' : 'Occupation',
        personality: lang === 'ko' ? '성격 및 특징' : 'Personality',
        special: lang === 'ko' ? '특기/능력' : 'Special Ability',
        relation_char: lang === 'ko' ? '캐릭터와의 관계' : 'Relation to Char',
        relation_user: lang === 'ko' ? '유저와의 관계' : 'Relation to User',
        importance: lang === 'ko' ? '등장 중요도' : 'Importance',
        pin: lang === 'ko' ? '📌 롤플에 고정' : '📌 Pin to Roleplay',
        relation_labels: {
            both: lang === 'ko' ? '둘 다 앎' : 'Both Know',
            char: lang === 'ko' ? '캐릭터만 앎' : 'Char Only',
            user: lang === 'ko' ? '유저만 앎' : 'User Only',
            unknown: lang === 'ko' ? '관계 불명' : 'Unknown',
        }
    };

    const p = npc.profile || {};
    const modalStars = [1,2,3].map(i =>
        `<span class="mb-modal-star ${npc.importance >= i ? 'active' : ''}" data-val="${i}" data-npc-id="${npc.id}">★</span>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.className = 'mb-modal-overlay';
    overlay.innerHTML = `
        <div class="mb-modal">
            <div class="mb-modal-header">
                <div class="mb-modal-name">${npc.name}</div>
                <button class="mb-modal-close">✕</button>
            </div>
            <div class="mb-modal-relation">
                <span class="mb-modal-relation-badge ${npc.relation}">${L.relation_labels[npc.relation] || npc.relation}</span>
            </div>
            <div class="mb-modal-body">
                <div class="mb-profile-grid">
                    <div class="mb-profile-item">
                        <div class="mb-profile-key">${L.fullname}</div>
                        <div class="mb-profile-val">${p.fullname || npc.name}</div>
                    </div>
                    <div class="mb-profile-item">
                        <div class="mb-profile-key">${L.age}</div>
                        <div class="mb-profile-val">${p.age || '—'}</div>
                    </div>
                    <div class="mb-profile-item">
                        <div class="mb-profile-key">${L.gender}</div>
                        <div class="mb-profile-val">${p.gender || '—'}</div>
                    </div>
                    <div class="mb-profile-item">
                        <div class="mb-profile-key">${L.occupation}</div>
                        <div class="mb-profile-val">${p.occupation || '—'}</div>
                    </div>
                    <div class="mb-profile-item full">
                        <div class="mb-profile-key">${L.personality}</div>
                        <div class="mb-profile-val">${p.personality || '—'}</div>
                    </div>
                    ${p.special ? `
                    <div class="mb-profile-item full">
                        <div class="mb-profile-key">${L.special}</div>
                        <div class="mb-profile-val">${p.special}</div>
                    </div>` : ''}
                    ${p.relation_char ? `
                    <div class="mb-profile-item full">
                        <div class="mb-profile-key">${L.relation_char}</div>
                        <div class="mb-profile-val">${p.relation_char}</div>
                    </div>` : ''}
                    ${p.relation_user ? `
                    <div class="mb-profile-item full">
                        <div class="mb-profile-key">${L.relation_user}</div>
                        <div class="mb-profile-val">${p.relation_user}</div>
                    </div>` : ''}
                </div>
                <div class="mb-modal-stars">
                    <span class="mb-modal-stars-label">${L.importance}</span>
                    ${modalStars}
                </div>
                <div class="mb-modal-actions">
                    <button class="mb-modal-pin-btn ${npc.pinned ? 'active' : ''}" id="mb-modal-pin" data-npc-id="${npc.id}">
                        ${npc.pinned ? '📌 고정 해제' : L.pin}
                    </button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(overlay);
    activeModal = overlay;
}

function closeModal() {
    if (activeModal) {
        activeModal.remove();
        activeModal = null;
        renderNPCList();
        if (currentTab === 'pinned') renderPinnedList();
    }
}

// ─── 고정 토글 ──────────────────────────────────────────────
function togglePin(npcId) {
    const npcs = getChatNPCs();
    const npc = npcs.find(n => n.id === npcId);
    if (!npc) return;

    npc.pinned = !npc.pinned;
    saveNPCData();
    injectPinnedNPCs();
    renderNPCList();
    if (currentTab === 'pinned') renderPinnedList();
    showToast(npc.pinned ? `📌 ${npc.name} 고정됨` : `${npc.name} 고정 해제`);
}

// ─── 중요도 설정 ─────────────────────────────────────────────
function setImportance(npcId, val) {
    const npcs = getChatNPCs();
    const npc = npcs.find(n => n.id === npcId);
    if (!npc) return;

    npc.importance = npc.importance === val ? 0 : val;
    saveNPCData();
    renderNPCList();
    if (activeModal) {
        const npcIdInModal = activeModal.querySelector('[data-npc-id]')?.dataset.npcId;
        if (npcIdInModal) {
            closeModal();
            openNPCModal(npcIdInModal);
        }
    }
}

// ─── 컨텍스트 주입 ──────────────────────────────────────────
function injectPinnedNPCs() {
    const pinned = getChatNPCs().filter(n => n.pinned);
    if (pinned.length === 0) return;

    const lang = settings.displayLanguage || 'ko';
    const lines = pinned.map(npc => {
        const p = npc.profile || {};
        if (lang === 'ko') {
            return `[${npc.name}] ${p.age ? p.age + '세' : ''} ${p.gender || ''} ${p.occupation || ''} — ${p.personality || ''}`.trim();
        } else {
            return `[${npc.name}] ${p.age ? 'Age ' + p.age : ''} ${p.gender || ''} ${p.occupation || ''} — ${p.personality || ''}`.trim();
        }
    });

    // World Info 또는 프롬프트 주입 (ST API 활용)
    const injectionText = `[Registered NPCs]\n${lines.join('\n')}`;

    // ST의 setExtensionPrompt 함수 사용
    if (typeof window.setExtensionPrompt === 'function') {
        window.setExtensionPrompt(EXT_NAME, injectionText, 0, 4);
    }
}

// ─── API 호출 ────────────────────────────────────────────────
async function callGeminiAPI(prompt) {
    const apiType = settings.apiType || 'express';

    if (apiType === 'vertex') {
        return await callVertexAPI(prompt);
    } else {
        // Express / Full API
        const apiKey = settings.apiKey;
        if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
                })
            }
        );

        if (!response.ok) throw new Error(`API 오류: ${response.status}`);
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
}

async function callVertexAPI(prompt) {
    const project = settings.vertexProject;
    const location = settings.vertexLocation || 'us-central1';
    if (!project) throw new Error('Vertex 프로젝트 ID가 설정되지 않았습니다.');

    // 서비스 계정 JSON으로 액세스 토큰 획득
    // 브라우저 환경에서는 직접 JWT 사인이 필요 — 여기선 ST 백엔드 프록시 경유 시도
    const saJson = settings.vertexServiceAccount;
    if (!saJson) throw new Error('서비스 계정 JSON이 설정되지 않았습니다.');

    // ST 백엔드를 통한 Vertex 호출 (ST가 프록시 지원 시)
    const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/gemini-2.0-flash:generateContent`;

    // 액세스 토큰을 얻기 위해 ST의 Vertex 연결을 재사용
    // 실제 구현에서는 ST의 기존 Vertex 커넥션 활용
    throw new Error('Vertex 직접 호출은 ST 백엔드 연동이 필요합니다. Express API 키를 사용해주세요.');
}

// ─── NPC 추출 프롬프트 ──────────────────────────────────────
function buildExtractionPrompt(text, charName, userName, lang) {
    const langInstr = lang === 'ko'
        ? 'Write all profile fields in Korean, except the name field which should match exactly as it appears in the text.'
        : 'Write all profile fields in English. Name should match exactly as it appears in the text.';

    return `You are analyzing a roleplay chat log. Extract all NPCs (non-player characters) that are NOT the main character "${charName}" and NOT the user "${userName}".

For each NPC found, return a JSON array with this structure:
[
  {
    "name": "exact name as appears in text",
    "relation": "both|char|user|unknown",
    "profile": {
      "fullname": "full name including middle name if known",
      "age": "age or estimated range",
      "gender": "gender",
      "occupation": "job, major, or role",
      "personality": "personality traits and notable characteristics (2-3 sentences, interesting TMI style)",
      "special": "special skills, magic, or abilities if applicable (omit if none)",
      "relation_char": "relationship to ${charName} if known",
      "relation_user": "relationship to ${userName} if known"
    }
  }
]

relation values:
- "both": both ${charName} and ${userName} know this NPC
- "char": only ${charName} knows this NPC
- "user": only ${userName} knows this NPC  
- "unknown": unclear

${langInstr}

If no NPCs found, return empty array [].
Return ONLY valid JSON, no other text.

Chat log:
${text}`;
}

// ─── 전체 채팅 스캔 ─────────────────────────────────────────
async function scanAllChat() {
    const btn = document.getElementById('mb-scan-all');
    if (!btn) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="mb-spinner"></span> 스캔 중...`;

    try {
        const ctx = getContext();
        const chat = ctx?.chat || [];
        const charName = ctx?.name2 || 'char';
        const userName = ctx?.name1 || 'user';

        if (chat.length === 0) {
            showToast('채팅 기록이 없어요');
            return;
        }

        // 채팅 텍스트 조합 (최근 50턴)
        const recentChat = chat.slice(-50);
        const chatText = recentChat.map(m =>
            `${m.name || (m.is_user ? userName : charName)}: ${m.mes}`
        ).join('\n');

        const lang = settings.displayLanguage || 'ko';
        const prompt = buildExtractionPrompt(chatText, charName, userName, lang);

        const result = await callGeminiAPI(prompt);

        // JSON 파싱
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            showToast('NPC를 찾지 못했어요');
            return;
        }

        const extracted = JSON.parse(jsonMatch[0]);
        mergeNPCs(extracted);

        showToast(`✨ ${extracted.length}명 수집 완료`);
        renderNPCList();

    } catch (err) {
        console.error('[망태기] 스캔 오류:', err);
        showToast(`오류: ${err.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>🔍</span> 전체 채팅 스캔`;
    }
}

// ─── 단일 메시지 수집 ───────────────────────────────────────
async function collectFromMessage(messageEl, messageText) {
    const collectBtn = messageEl.querySelector('.mb-collect-btn');
    if (collectBtn) {
        collectBtn.textContent = '수집 중...';
        collectBtn.disabled = true;
    }

    try {
        const ctx = getContext();
        const charName = ctx?.name2 || 'char';
        const userName = ctx?.name1 || 'user';
        const lang = settings.displayLanguage || 'ko';

        const prompt = buildExtractionPrompt(messageText, charName, userName, lang);
        const result = await callGeminiAPI(prompt);

        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            showToast('이 메시지에서 NPC를 찾지 못했어요');
            return;
        }

        const extracted = JSON.parse(jsonMatch[0]);
        if (extracted.length === 0) {
            showToast('새로운 NPC가 없어요');
            return;
        }

        mergeNPCs(extracted);
        showToast(`✨ ${extracted.length}명 수집`);
        renderNPCList();

    } catch (err) {
        console.error('[망태기] 수집 오류:', err);
        showToast(`오류: ${err.message}`);
    } finally {
        if (collectBtn) {
            collectBtn.textContent = '🎒 수집';
            collectBtn.disabled = false;
        }
    }
}

// ─── NPC 병합 (중복 방지) ───────────────────────────────────
function mergeNPCs(extracted) {
    const existing = getChatNPCs();

    extracted.forEach(newNPC => {
        const dup = existing.find(n =>
            n.name.toLowerCase() === newNPC.name.toLowerCase()
        );

        if (dup) {
            // 기존 항목 업데이트 (프로필 보강)
            dup.profile = { ...dup.profile, ...newNPC.profile };
            if (newNPC.relation !== 'unknown') dup.relation = newNPC.relation;
        } else {
            existing.push({
                id: `npc_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
                name: newNPC.name,
                relation: newNPC.relation || 'unknown',
                profile: newNPC.profile || {},
                importance: 1,
                pinned: false,
                createdAt: Date.now(),
            });
        }
    });

    saveNPCData();
}

// ─── 메시지 수신 시 수집 버튼 추가 ─────────────────────────
function onMessageReceived() {
    setTimeout(() => {
        const messages = document.querySelectorAll('.mes:not(.mb-collect-added)');
        messages.forEach(msgEl => {
            msgEl.classList.add('mb-collect-added');
            const isUser = msgEl.classList.contains('user_mes');
            if (isUser) return; // 유저 메시지엔 추가 안 함

            const actionsEl = msgEl.querySelector('.mes_buttons') || msgEl.querySelector('.mes_block');
            if (!actionsEl) return;

            const btn = document.createElement('button');
            btn.className = 'mb-collect-btn';
            btn.innerHTML = '🎒 수집';
            btn.title = '이 메시지에서 NPC 수집';

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mesText = msgEl.querySelector('.mes_text')?.innerText || '';
                collectFromMessage(msgEl, mesText);
            });

            actionsEl.appendChild(btn);
        });
    }, 500);
}

// ─── 설정 저장/로드 ─────────────────────────────────────────
function saveSettings() {
    settings.apiType = document.getElementById('mb-api-type')?.value || 'express';
    settings.apiKey = document.getElementById('mb-api-key')?.value || '';
    settings.vertexProject = document.getElementById('mb-vertex-project')?.value || '';
    settings.vertexServiceAccount = document.getElementById('mb-vertex-sa')?.value || '';
    settings.displayLanguage = document.getElementById('mb-display-lang')?.value || 'ko';

    extension_settings[EXT_NAME] = settings;
    saveSettingsDebounced();
    showToast('✅ 설정 저장됨');
}

function loadSettings() {
    const apiTypeEl = document.getElementById('mb-api-type');
    const apiKeyEl = document.getElementById('mb-api-key');
    const vertexProjectEl = document.getElementById('mb-vertex-project');
    const vertexSaEl = document.getElementById('mb-vertex-sa');
    const displayLangEl = document.getElementById('mb-display-lang');

    if (apiTypeEl) apiTypeEl.value = settings.apiType || 'express';
    if (apiKeyEl) apiKeyEl.value = settings.apiKey || '';
    if (vertexProjectEl) vertexProjectEl.value = settings.vertexProject || '';
    if (vertexSaEl) vertexSaEl.value = settings.vertexServiceAccount || '';
    if (displayLangEl) displayLangEl.value = settings.displayLanguage || 'ko';

    toggleAPIFields(settings.apiType || 'express');
}

function toggleAPIFields(apiType) {
    const rowKey = document.getElementById('mb-row-apikey');
    const rowVertex = document.getElementById('mb-row-vertex');
    if (!rowKey || !rowVertex) return;

    if (apiType === 'vertex') {
        rowKey.style.display = 'none';
        rowVertex.style.display = 'flex';
        rowVertex.style.flexDirection = 'column';
        rowVertex.style.gap = '6px';
    } else {
        rowKey.style.display = 'flex';
        rowKey.style.flexDirection = 'column';
        rowKey.style.gap = '6px';
        rowVertex.style.display = 'none';
    }
}

function saveNPCData() {
    extension_settings[EXT_NAME] = settings;
    saveSettingsDebounced();
    injectPinnedNPCs();
}

// ─── 토스트 ─────────────────────────────────────────────────
function showToast(msg) {
    let toast = document.querySelector('.mb-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'mb-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
}

// ─── 시작 ───────────────────────────────────────────────────
jQuery(async () => {
    init();
});
