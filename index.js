// 당신의 망태기 v2.0
const EXT_NAME = 'SillyTavern-MangTaegi';

const defaultSettings = {
    apiKey: '',
    outputLanguage: 'ko',
    npcData: {},
};

let settings = {};

// ─── 초기화 ──────────────────────────────────────────────────
async function mangInit() {
    const extSettings = window.extension_settings;
    if (!extSettings) {
        setTimeout(mangInit, 1000);
        return;
    }

    if (!extSettings[EXT_NAME]) extSettings[EXT_NAME] = { ...defaultSettings };
    settings = extSettings[EXT_NAME];
    if (!settings.npcData) settings.npcData = {};

    addToWandMenu();
    addCollectButton();

    // 새 메시지마다 수집 버튼 유지
    const observer = new MutationObserver(() => addCollectButton());
    observer.observe(document.querySelector('#chat') || document.body, { childList: true, subtree: true });

    console.log('[망태기] 로드 완료 ✅');
}

// ─── 마법봉 메뉴 항목 추가 ───────────────────────────────────
function addToWandMenu() {
    if ($('#mt-wand-btn').length) return;

    const btn = $(`
        <div id="mt-wand-btn" class="list-group-item flex-container flexGap5 interactable" tabindex="0" title="당신의 망태기">
            <span style="font-size:16px;">🎒</span>
            <span>당신의 망태기</span>
        </div>
    `);

    btn.on('click', () => {
        $('#extensionsMenu').fadeOut(200);
        openMainPanel();
    });

    $('#extensionsMenu').append(btn);
}

// ─── 메인 패널 (마법봉 메뉴 클릭 시) ────────────────────────
function openMainPanel() {
    if ($('#mt-main-panel').length) {
        $('#mt-main-panel').toggle();
        return;
    }

    const ctx = getSTContext();
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
    const npcs = settings.npcData[chatId] || [];

    const panel = $(`
        <div id="mt-main-panel" style="
            position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
            width:380px; max-height:85vh; display:flex; flex-direction:column;
            background:var(--SmartThemeBlurTintColor, #1a1a2e);
            border:1px solid var(--SmartThemeBorderColor, #444);
            border-radius:14px; z-index:10000;
            box-shadow:0 12px 40px rgba(0,0,0,0.5);
            font-family: inherit;
        ">
            <!-- 헤더 -->
            <div style="
                padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.1);
                display:flex; justify-content:space-between; align-items:center;
                flex-shrink:0;
            ">
                <b style="font-size:1.05em;">🎒 당신의 망태기</b>
                <button id="mt-close-panel" class="menu_button" style="padding:2px 10px; font-size:0.85em;">✕</button>
            </div>

            <!-- 탭 -->
            <div style="display:flex; border-bottom:1px solid rgba(255,255,255,0.1); flex-shrink:0;">
                <button class="mt-tab-btn active" data-tab="npc" style="
                    flex:1; padding:9px; border:none; background:transparent;
                    color:var(--SmartThemeBodyColor); cursor:pointer; font-family:inherit;
                    border-bottom:2px solid #c17f5a; font-size:0.88em; font-weight:600;
                ">👥 인물 목록</button>
                <button class="mt-tab-btn" data-tab="settings" style="
                    flex:1; padding:9px; border:none; background:transparent;
                    color:var(--SmartThemeBodyColor); cursor:pointer; font-family:inherit;
                    border-bottom:2px solid transparent; font-size:0.88em;
                ">⚙️ 설정</button>
            </div>

            <!-- NPC 탭 -->
            <div id="mt-tab-npc" style="flex:1; overflow-y:auto; padding:12px;">
                <button id="mt-scan-btn" class="menu_button" style="width:100%; margin-bottom:10px;">🔍 전체 채팅 스캔</button>
                <div id="mt-npc-list"></div>
            </div>

            <!-- 설정 탭 -->
            <div id="mt-tab-settings" style="display:none; flex:1; overflow-y:auto; padding:12px;">
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <label style="font-size:0.8em; color:#aaa; text-transform:uppercase; letter-spacing:0.5px;">Gemini API 키</label>
                    <input type="password" id="mt-api-key" class="text_node" placeholder="AIza..." style="width:100%; box-sizing:border-box;">
                    <label style="font-size:0.8em; color:#aaa; text-transform:uppercase; letter-spacing:0.5px; margin-top:6px;">프로필 표시 언어</label>
                    <select id="mt-lang" class="text_node" style="width:100%; box-sizing:border-box;">
                        <option value="ko">한국어</option>
                        <option value="en">English</option>
                    </select>
                    <button id="mt-save-btn" class="menu_button" style="margin-top:6px; width:100%;">저장</button>
                </div>
            </div>
        </div>
    `);

    $('body').append(panel);
    loadSettingsToUI();
    renderNPCList();

    // 탭 전환
    panel.on('click', '.mt-tab-btn', function() {
        panel.find('.mt-tab-btn').css('border-bottom-color', 'transparent').css('font-weight', 'normal');
        $(this).css('border-bottom-color', '#c17f5a').css('font-weight', '600');
        const tab = $(this).data('tab');
        panel.find('#mt-tab-npc, #mt-tab-settings').hide();
        panel.find(`#mt-tab-${tab}`).show();
    });

    // 닫기
    panel.on('click', '#mt-close-panel', () => panel.remove());

    // 전체 스캔
    panel.on('click', '#mt-scan-btn', () => scanAll());

    // 저장
    panel.on('click', '#mt-save-btn', () => {
        settings.apiKey = $('#mt-api-key').val();
        settings.outputLanguage = $('#mt-lang').val();
        if (window.extension_settings) window.extension_settings[EXT_NAME] = settings;
        if (window.saveSettingsDebounced) window.saveSettingsDebounced();
        showToast('✅ 저장됨');
    });

    // 핀
    panel.on('click', '.mt-pin-btn', function() {
        const id = $(this).data('id');
        const ctx = getSTContext();
        const chatId = ctx?.chatId || ctx?.characterId || 'default';
        const npc = (settings.npcData[chatId] || []).find(n => n.id === id);
        if (!npc) return;
        npc.pinned = !npc.pinned;
        saveNPCData();
        renderNPCList();
        showToast(npc.pinned ? `📌 ${npc.name} 고정됨` : `${npc.name} 고정 해제`);
    });

    // 별점
    panel.on('click', '.mt-star', function() {
        const id = $(this).data('id');
        const val = parseInt($(this).data('val'));
        const ctx = getSTContext();
        const chatId = ctx?.chatId || ctx?.characterId || 'default';
        const npc = (settings.npcData[chatId] || []).find(n => n.id === id);
        if (!npc) return;
        npc.importance = npc.importance === val ? 0 : val;
        saveNPCData();
        renderNPCList();
    });
}

// ─── 채팅창 수집 버튼 ────────────────────────────────────────
function addCollectButton() {
    if ($('#mt-collect-btn').length) return;

    const btn = $(`<button id="mt-collect-btn" title="망태기 - 현재 메시지 NPC 수집" style="
        background:transparent; border:none; cursor:pointer;
        font-size:20px; padding:0 4px; opacity:0.7; transition:opacity 0.15s;
        display:flex; align-items:center;
    ">🎒</button>`);

    btn.on('mouseenter', function() { $(this).css('opacity', '1'); });
    btn.on('mouseleave', function() { $(this).css('opacity', '0.7'); });
    btn.on('click', () => collectFromLastMessage());

    // 전송 버튼 앞에 삽입
    const sendBtn = $('#send_but');
    if (sendBtn.length) sendBtn.before(btn);
}

// ─── 마지막 메시지에서 수집 ──────────────────────────────────
async function collectFromLastMessage() {
    const ctx = getSTContext();
    if (!ctx?.chat || ctx.chat.length === 0) { showToast('채팅 기록이 없어요'); return; }
    if (!settings.apiKey) { showToast('⚙️ 설정에서 API 키를 입력해주세요'); return; }

    $('#mt-collect-btn').text('⏳').prop('disabled', true);

    try {
        const lastMsg = ctx.chat[ctx.chat.length - 1];
        const charName = ctx.name2 || 'char';
        const userName = ctx.name1 || 'user';
        const text = `${lastMsg.name || charName}: ${lastMsg.mes}`;

        const result = await callGemini(buildPrompt(text, charName, userName, settings.outputLanguage));
        const match = result.match(/\[[\s\S]*?\]/);
        if (!match) { showToast('NPC를 찾지 못했어요'); return; }

        const extracted = JSON.parse(match[0]);
        if (extracted.length === 0) { showToast('새 NPC가 없어요'); return; }

        mergeNPCs(ctx, extracted);
        showCollectResult(extracted);

    } catch (err) {
        console.error('[망태기]', err);
        showToast(`오류: ${err.message}`);
    } finally {
        $('#mt-collect-btn').text('🎒').prop('disabled', false);
    }
}

// ─── 수집 완료 팝업 ──────────────────────────────────────────
function showCollectResult(extracted) {
    $('#mt-collect-result').remove();

    const isKo = settings.outputLanguage === 'ko';
    const items = extracted.map(n => `
        <div style="
            padding:10px 12px; margin-bottom:6px;
            background:rgba(255,255,255,0.05); border-radius:8px;
            border-left:3px solid #c17f5a;
        ">
            <div style="font-weight:600; font-size:0.95em;">${n.name}</div>
            <div style="font-size:0.8em; color:#aaa; margin-top:2px;">
                ${n.profile?.occupation || ''} ${n.profile?.age ? `· ${n.profile.age}` : ''}
            </div>
            <div style="font-size:0.8em; color:#bbb; margin-top:4px; line-height:1.4;">
                ${n.profile?.personality || ''}
            </div>
        </div>
    `).join('');

    const popup = $(`
        <div id="mt-collect-result" style="
            position:fixed; bottom:80px; right:16px;
            width:300px; max-height:400px; overflow-y:auto;
            background:var(--SmartThemeBlurTintColor, #1a1a2e);
            border:1px solid #c17f5a; border-radius:12px;
            padding:14px; z-index:10000;
            box-shadow:0 8px 24px rgba(0,0,0,0.4);
            animation: mt-slide-in 0.2s ease;
        ">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <b style="color:#c17f5a;">✨ ${extracted.length}명 수집됨</b>
                <button id="mt-close-result" style="
                    border:none; background:transparent; cursor:pointer;
                    color:#aaa; font-size:14px; padding:0;
                ">✕</button>
            </div>
            ${items}
            <button id="mt-open-from-result" class="menu_button" style="width:100%; margin-top:8px; font-size:0.85em;">
                🎒 망태기 열기
            </button>
        </div>
        <style>
            @keyframes mt-slide-in {
                from { opacity:0; transform:translateY(10px); }
                to { opacity:1; transform:translateY(0); }
            }
        </style>
    `);

    $('body').append(popup);

    popup.on('click', '#mt-close-result', () => popup.remove());
    popup.on('click', '#mt-open-from-result', () => {
        popup.remove();
        openMainPanel();
    });

    // 5초 후 자동 닫기
    setTimeout(() => popup.fadeOut(300, () => popup.remove()), 5000);
}

// ─── 전체 스캔 ───────────────────────────────────────────────
async function scanAll() {
    const ctx = getSTContext();
    if (!settings.apiKey) { showToast('API 키를 먼저 설정해주세요'); return; }
    if (!ctx?.chat || ctx.chat.length === 0) { showToast('채팅 기록이 없어요'); return; }

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

// ─── Gemini API ──────────────────────────────────────────────
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

// ─── 프롬프트 ────────────────────────────────────────────────
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

// ─── NPC 병합 ────────────────────────────────────────────────
function mergeNPCs(ctx, extracted) {
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
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

    saveNPCData();
}

// ─── NPC 목록 렌더링 ─────────────────────────────────────────
function renderNPCList() {
    const ctx = getSTContext();
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
    const npcs = settings.npcData[chatId] || [];
    const container = $('#mt-npc-list');
    if (!container.length) return;

    if (npcs.length === 0) {
        container.html('<p style="font-size:0.85em;color:#888;text-align:center;padding:20px 0;">수집된 인물이 없어요</p>');
        return;
    }

    const BORDER = { both: '#f0c040', char: '#2ecc71', user: '#3498db', unknown: '#666' };

    container.html(npcs.map(npc => `
        <div class="mt-npc-card" style="
            background:rgba(255,255,255,0.04); border-radius:8px; padding:10px 12px;
            margin-bottom:7px; border-left:3px solid ${BORDER[npc.relation] || '#666'};
        ">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                <span style="font-weight:600; font-size:0.95em;">${npc.name}</span>
                <span style="font-size:0.75em; color:#999;">${npc.profile?.age || ''} ${npc.profile?.gender || ''}</span>
            </div>
            <div style="font-size:0.78em; color:#aaa; margin-bottom:4px;">${npc.profile?.occupation || ''}</div>
            <div style="font-size:0.8em; color:#bbb; line-height:1.4; margin-bottom:8px;">${npc.profile?.personality || '프로필 미생성'}</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="mt-stars">${[1,2,3].map(i =>
                    `<span class="mt-star" data-id="${npc.id}" data-val="${i}" style="
                        font-size:14px; cursor:pointer; user-select:none;
                        color:${npc.importance >= i ? '#c17f5a' : 'rgba(255,255,255,0.2)'};
                    ">★</span>`
                ).join('')}</span>
                <button class="mt-pin-btn menu_button" data-id="${npc.id}" style="
                    font-size:0.75em; padding:3px 8px;
                    ${npc.pinned ? 'background:rgba(193,127,90,0.3); border-color:#c17f5a; color:#c17f5a;' : ''}
                ">${npc.pinned ? '📌 고정됨' : '📌 고정'}</button>
            </div>
        </div>
    `).join(''));
}

// ─── 유틸 ────────────────────────────────────────────────────
function getSTContext() {
    try {
        return window.SillyTavern?.getContext?.() || null;
    } catch { return null; }
}

function saveNPCData() {
    if (window.extension_settings) window.extension_settings[EXT_NAME] = settings;
    if (window.saveSettingsDebounced) window.saveSettingsDebounced();
}

function loadSettingsToUI() {
    $('#mt-api-key').val(settings.apiKey || '');
    $('#mt-lang').val(settings.outputLanguage || 'ko');
}

function showToast(msg) {
    let t = $('#mt-toast');
    if (!t.length) t = $('<div id="mt-toast" style="position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(8px);background:rgba(30,30,30,0.95);color:white;padding:8px 16px;border-radius:20px;font-size:12px;z-index:99999;opacity:0;transition:all 0.2s ease;white-space:nowrap;pointer-events:none;"></div>').appendTo('body');
    t.text(msg).css({opacity:1, transform:'translateX(-50%) translateY(0)'});
    clearTimeout(t.data('timer'));
    t.data('timer', setTimeout(() => t.css({opacity:0, transform:'translateX(-50%) translateY(8px)'}), 2200));
}

export async function init() { await mangInit(); }

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mangInit);
} else {
    setTimeout(mangInit, 500);
}
