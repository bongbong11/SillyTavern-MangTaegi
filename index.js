import { extension_settings, getContext } from '../../../extensions.js';
import { saveSettingsDebounced, eventSource, event_types } from '../../../../script.js';

const EXT_NAME = 'SillyTavern-MangTaegi';

const defaultSettings = {
    apiKey: '',
    outputLanguage: 'ko',
    npcData: {},
};

let settings = {};

export async function init() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = { ...defaultSettings };
    }
    settings = extension_settings[EXT_NAME];
    if (!settings.npcData) settings.npcData = {};

    // Extensions 패널에 UI 직접 주입
    const panelHtml = `
    <div class="mt-panel">
        <div class="mt-header">🎒 당신의 망태기</div>
        <div class="mt-section">
            <label class="mt-label">Gemini API 키</label>
            <input type="password" id="mt-api-key" class="text_node" placeholder="AIza...">
            <label class="mt-label" style="margin-top:8px;">프로필 표시 언어</label>
            <select id="mt-lang" class="text_node">
                <option value="ko">한국어</option>
                <option value="en">English</option>
            </select>
            <button id="mt-save-btn" class="menu_button" style="margin-top:6px;width:100%;">저장</button>
        </div>
        <hr style="border-color:rgba(255,255,255,0.1);margin:10px 0;">
        <button id="mt-scan-btn" class="menu_button mt-btn-scan">🔍 전체 채팅 스캔</button>
        <div id="mt-npc-list" class="mt-npc-list">
            <p style="font-size:0.85em;color:#888;text-align:center;padding:20px 0;">수집된 인물이 없어요</p>
        </div>
    </div>`;

    $('#extensions_settings').append(panelHtml);

    loadSettingsToUI();
    bindUIEvents();
    addCollectButton();

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, addCollectButton);
    eventSource.on(event_types.MESSAGE_RECEIVED, addCollectButton);
    eventSource.on(event_types.CHAT_CHANGED, () => renderNPCList());

    console.log('[망태기] 로드 완료 ✅');
}

function addCollectButton() {
    if ($('#mt-collect-btn').length) return;
    const btn = $('<div id="mt-collect-btn" title="망태기 - NPC 수집" style="display:flex;align-items:center;justify-content:center;width:35px;height:35px;border-radius:6px;cursor:pointer;font-size:18px;margin-right:4px;">🎒</div>');
    btn.on('mouseenter', function() { $(this).css('background','rgba(255,172,51,0.2)'); });
    btn.on('mouseleave', function() { $(this).css('background','transparent'); });
    btn.on('click', () => runCollection());
    const sendBtn = $('#send_but');
    if (sendBtn.length) sendBtn.before(btn);
}

async function runCollection() {
    const ctx = getContext();
    if (!ctx.chat || ctx.chat.length === 0) { showToast('채팅 기록이 없어요'); return; }
    if (!settings.apiKey) { showToast('⚙️ API 키를 먼저 설정해주세요'); return; }

    $('#mt-collect-btn').text('⏳');
    try {
        const charName = ctx.name2 || 'char';
        const userName = ctx.name1 || 'user';
        const chatText = ctx.chat.slice(-20).map(m =>
            `${m.name || (m.is_user ? userName : charName)}: ${m.mes}`
        ).join('\n');

        const result = await callGemini(buildPrompt(chatText, charName, userName, settings.outputLanguage));
        const match = result.match(/\[[\s\S]*?\]/);
        if (!match) { showToast('NPC를 찾지 못했어요'); return; }

        const extracted = JSON.parse(match[0]);
        if (extracted.length === 0) { showToast('새 NPC 없음'); return; }
        mergeNPCs(ctx, extracted);
        showToast(`✨ ${extracted.length}명 수집됨`);
        renderNPCList();
    } catch (err) {
        console.error('[망태기]', err);
        showToast(`오류: ${err.message}`);
    } finally {
        $('#mt-collect-btn').text('🎒');
    }
}

async function scanAll() {
    const ctx = getContext();
    if (!settings.apiKey) { showToast('API 키를 먼저 설정해주세요'); return; }
    if (!ctx.chat || ctx.chat.length === 0) { showToast('채팅 기록이 없어요'); return; }

    $('#mt-scan-btn').prop('disabled', true).text('⏳ 스캔 중...');
    try {
        const charName = ctx.name2 || 'char';
        const userName = ctx.name1 || 'user';
        const chatText = ctx.chat.slice(-60).map(m =>
            `${m.name || (m.is_user ? userName : charName)}: ${m.mes}`
        ).join('\n');

        const result = await callGemini(buildPrompt(chatText, charName, userName, settings.outputLanguage));
        const match = result.match(/\[[\s\S]*?\]/);
        if (!match) { showToast('NPC를 찾지 못했어요'); return; }

        const extracted = JSON.parse(match[0]);
        mergeNPCs(ctx, extracted);
        showToast(`✨ ${extracted.length}명 수집 완료`);
        renderNPCList();
    } catch (err) {
        showToast(`오류: ${err.message}`);
    } finally {
        $('#mt-scan-btn').prop('disabled', false).text('🔍 전체 채팅 스캔');
    }
}

async function callGemini(prompt) {
    const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.5, maxOutputTokens: 2000 }
            })
        }
    );
    if (!resp.ok) throw new Error(`Gemini API 오류 ${resp.status}`);
    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function buildPrompt(text, charName, userName, lang) {
    const isKo = lang === 'ko';
    return `Analyze this roleplay chat. Extract all named NPCs that are NOT "${charName}" and NOT "${userName}".

Return ONLY a valid JSON array, no markdown, no extra text:
[{
  "name": "exact name as written in chat",
  "relation": "both|char|user|unknown",
  "profile": {
    "fullname": "full name including middle name if known",
    "age": "${isKo ? '나이 또는 추정 범위' : 'age or range'}",
    "gender": "${isKo ? '남성/여성/기타' : 'male/female/other'}",
    "occupation": "${isKo ? '직업 또는 전공' : 'job or major'}",
    "personality": "${isKo ? '성격과 특징 2-3문장, TMI스럽고 흥미롭게' : '2-3 sentences, interesting TMI style'}",
    "special": "${isKo ? '특기나 능력, 없으면 빈 문자열' : 'skills or abilities, empty string if none'}",
    "relation_char": "${isKo ? charName + '과의 관계' : 'relation to ' + charName}",
    "relation_user": "${isKo ? userName + '과의 관계' : 'relation to ' + userName}"
  }
}]

If no NPCs found, return [].

Chat log:
${text}`;
}

function mergeNPCs(ctx, extracted) {
    const chatId = ctx.chatId || ctx.characterId || 'default';
    if (!settings.npcData[chatId]) settings.npcData[chatId] = [];
    const existing = settings.npcData[chatId];

    extracted.forEach(n => {
        const dup = existing.find(e => e.name.toLowerCase() === n.name.toLowerCase());
        if (dup) {
            dup.profile = Object.assign({}, dup.profile, n.profile);
            if (n.relation !== 'unknown') dup.relation = n.relation;
        } else {
            existing.push({
                id: `npc_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
                name: n.name,
                relation: n.relation || 'unknown',
                profile: n.profile || {},
                importance: 1,
                pinned: false,
            });
        }
    });

    extension_settings[EXT_NAME] = settings;
    saveSettingsDebounced();
    injectPinned(ctx);
}

function injectPinned(ctx) {
    const chatId = (ctx || getContext()).chatId || 'default';
    const pinned = (settings.npcData[chatId] || []).filter(n => n.pinned);
    const isKo = settings.outputLanguage === 'ko';

    const text = pinned.length === 0 ? '' :
        `[${isKo ? '등록 인물' : 'Registered NPCs'}]\n` +
        pinned.map(n => {
            const p = n.profile || {};
            return `• ${n.name}${p.age ? ` (${p.age})` : ''} ${p.gender || ''} ${p.occupation || ''} — ${p.personality || ''}`.trim();
        }).join('\n');

    if (typeof window.setExtensionPrompt === 'function') {
        window.setExtensionPrompt(EXT_NAME, text, 0, 4);
    }
}

function renderNPCList() {
    const ctx = getContext();
    const chatId = ctx.chatId || ctx.characterId || 'default';
    const npcs = settings.npcData[chatId] || [];
    const container = $('#mt-npc-list');
    if (!container.length) return;

    if (npcs.length === 0) {
        container.html('<p style="font-size:0.85em;color:#888;text-align:center;padding:20px 0;">수집된 인물이 없어요</p>');
        return;
    }

    const BORDER = { both: '#f0c040', char: '#2ecc71', user: '#3498db', unknown: '#888' };
    container.html(npcs.map(npc => `
        <div class="mt-npc-card" style="border-left:4px solid ${BORDER[npc.relation] || '#888'};">
            <div class="mt-npc-header">
                <span class="mt-npc-name">${npc.name}</span>
                <span class="mt-npc-meta">${npc.profile?.age || ''} ${npc.profile?.gender || ''}</span>
            </div>
            <div class="mt-npc-occ">${npc.profile?.occupation || ''}</div>
            <div class="mt-npc-desc">${npc.profile?.personality || '프로필 미생성'}</div>
            <div class="mt-npc-actions">
                <span class="mt-stars">${[1,2,3].map(i =>
                    `<span class="mt-star ${npc.importance >= i ? 'active' : ''}" data-id="${npc.id}" data-val="${i}">★</span>`
                ).join('')}</span>
                <button class="mt-pin-btn ${npc.pinned ? 'pinned' : ''}" data-id="${npc.id}">
                    ${npc.pinned ? '📌 고정됨' : '📌 고정'}
                </button>
            </div>
        </div>
    `).join(''));
}

function bindUIEvents() {
    $(document).on('click', '#mt-save-btn', () => {
        settings.apiKey = $('#mt-api-key').val();
        settings.outputLanguage = $('#mt-lang').val();
        extension_settings[EXT_NAME] = settings;
        saveSettingsDebounced();
        showToast('✅ 저장됨');
    });

    $(document).on('click', '#mt-scan-btn', () => scanAll());

    $(document).on('click', '.mt-pin-btn', function () {
        const id = $(this).data('id');
        const ctx = getContext();
        const chatId = ctx.chatId || ctx.characterId || 'default';
        const npc = (settings.npcData[chatId] || []).find(n => n.id === id);
        if (!npc) return;
        npc.pinned = !npc.pinned;
        extension_settings[EXT_NAME] = settings;
        saveSettingsDebounced();
        injectPinned(ctx);
        renderNPCList();
        showToast(npc.pinned ? `📌 ${npc.name} 고정됨` : `${npc.name} 고정 해제`);
    });

    $(document).on('click', '.mt-star', function () {
        const id = $(this).data('id');
        const val = parseInt($(this).data('val'));
        const ctx = getContext();
        const chatId = ctx.chatId || ctx.characterId || 'default';
        const npc = (settings.npcData[chatId] || []).find(n => n.id === id);
        if (!npc) return;
        npc.importance = npc.importance === val ? 0 : val;
        extension_settings[EXT_NAME] = settings;
        saveSettingsDebounced();
        renderNPCList();
    });
}

function loadSettingsToUI() {
    $('#mt-api-key').val(settings.apiKey || '');
    $('#mt-lang').val(settings.outputLanguage || 'ko');
}

function showToast(msg) {
    let t = $('#mt-toast');
    if (!t.length) t = $('<div id="mt-toast"></div>').appendTo('body');
    t.text(msg).addClass('show');
    clearTimeout(t.data('timer'));
    t.data('timer', setTimeout(() => t.removeClass('show'), 2200));
}
