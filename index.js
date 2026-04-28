// 당신의 망태기 v3.0
import { extension_settings, getContext } from '../../../extensions.js';
import { saveSettingsDebounced, eventSource, event_types, setExtensionPrompt, extension_prompt_types } from '../../../../script.js';

const EXT_NAME = 'SillyTavern-MangTaegi';
const PROMPT_KEY = 'mangtaegi_npc';

const defaultSettings = {
    profileName: '',
    outputLanguage: 'ko',
    npcData: {},
};

let settings = {};

// ─── 초기화 ──────────────────────────────────────────────────
async function mangInit() {
    if (!extension_settings[EXT_NAME]) extension_settings[EXT_NAME] = { ...defaultSettings };
    settings = extension_settings[EXT_NAME];
    if (!settings.npcData) settings.npcData = {};

    injectSettingsPanel();
    addToWandMenu();
    addCollectButton();

    const observer = new MutationObserver(() => addCollectButton());
    const chatEl = document.querySelector('#chat');
    if (chatEl) observer.observe(chatEl, { childList: true, subtree: false });

    console.log('[망태기] 로드 완료 ✅');
}

// ─── 확장 탭 설정 패널 ───────────────────────────────────────
function injectSettingsPanel() {
    if ($('#mangtaegi-settings').length) return;

    const profiles = extension_settings.connectionManager?.profiles || [];
    const profileOptions = profiles.map(p =>
        `<option value="${p.name}" ${settings.profileName === p.name ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    const panel = $(`
    <div id="mangtaegi-settings" class="extension_container">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>🎒 당신의 망태기</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down interactable" tabindex="0"></div>
            </div>
            <div class="inline-drawer-content" style="padding:12px; display:flex; flex-direction:column; gap:10px;">
                <div>
                    <label style="font-size:0.8em; color:#aaa; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">연결 프로필</label>
                    <select id="mt-profile-select" class="text_node" style="width:100%; box-sizing:border-box;">
                        <option value="">-- 프로필 선택 --</option>
                        ${profileOptions}
                    </select>
                </div>
                <div>
                    <label style="font-size:0.8em; color:#aaa; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">프로필 표시 언어</label>
                    <select id="mt-lang-select" class="text_node" style="width:100%; box-sizing:border-box;">
                        <option value="ko" ${settings.outputLanguage === 'ko' ? 'selected' : ''}>한국어</option>
                        <option value="en" ${settings.outputLanguage === 'en' ? 'selected' : ''}>English</option>
                    </select>
                </div>
                <button id="mt-settings-save" class="menu_button" style="width:100%;">저장</button>
            </div>
        </div>
    </div>`);

    $('#extensions_settings').append(panel);

    panel.on('click', '#mt-settings-save', () => {
        settings.profileName = $('#mt-profile-select').val();
        settings.outputLanguage = $('#mt-lang-select').val();
        extension_settings[EXT_NAME] = settings;
        saveSettingsDebounced();
        showToast('✅ 저장됨');
    });
}

// ─── 마법봉 메뉴 항목 ────────────────────────────────────────
function addToWandMenu() {
    if ($('#mt-wand-btn').length) return;
    const btn = $(`
        <div id="mt-wand-btn" class="list-group-item flex-container flexGap5 interactable" tabindex="0">
            <span style="font-size:16px;">🎒</span>
            <span>당신의 망태기</span>
        </div>`);
    btn.on('click', () => {
        $('#extensionsMenu').fadeOut(200);
        openMainPanel();
    });
    $('#extensionsMenu').append(btn);
}

// ─── 메인 패널 ───────────────────────────────────────────────
function openMainPanel() {
    if ($('#mt-main-panel').length) {
        $('#mt-main-panel').remove();
        return;
    }

    const panel = $(`
    <div id="mt-main-panel" style="
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        width:360px; max-height:85vh; display:flex; flex-direction:column;
        background:var(--SmartThemeBlurTintColor, #1e1e2e);
        border:1px solid var(--SmartThemeBorderColor, #555);
        border-radius:14px; z-index:10000;
        box-shadow:0 16px 48px rgba(0,0,0,0.6);
        font-family:inherit; overflow:hidden;
    ">
        <!-- 헤더 -->
        <div style="padding:13px 16px; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
            <b style="font-size:1em;">🎒 당신의 망태기</b>
            <button id="mt-close-panel" style="border:none; background:transparent; cursor:pointer; color:#aaa; font-size:16px; padding:0 2px;">✕</button>
        </div>

        <!-- 범례 -->
        <div style="padding:8px 14px; background:rgba(0,0,0,0.2); display:flex; gap:12px; flex-wrap:wrap; flex-shrink:0; border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="display:flex;align-items:center;gap:4px;font-size:0.75em;color:#ccc;">
                <span style="width:10px;height:10px;border-radius:2px;background:#f0c040;display:inline-block;flex-shrink:0;"></span>둘 다 앎
            </span>
            <span style="display:flex;align-items:center;gap:4px;font-size:0.75em;color:#ccc;">
                <span style="width:10px;height:10px;border-radius:2px;background:#2ecc71;display:inline-block;flex-shrink:0;"></span>캐릭터만
            </span>
            <span style="display:flex;align-items:center;gap:4px;font-size:0.75em;color:#ccc;">
                <span style="width:10px;height:10px;border-radius:2px;background:#3498db;display:inline-block;flex-shrink:0;"></span>유저만
            </span>
            <span style="display:flex;align-items:center;gap:4px;font-size:0.75em;color:#ccc;">
                <span style="width:10px;height:10px;border-radius:2px;background:#666;display:inline-block;flex-shrink:0;"></span>관계 없음
            </span>
        </div>

        <!-- 탭 -->
        <div style="display:flex; border-bottom:1px solid rgba(255,255,255,0.08); flex-shrink:0;">
            <button class="mt-tab active" data-tab="list" style="flex:1;padding:9px;border:none;background:transparent;color:var(--SmartThemeBodyColor);cursor:pointer;font-family:inherit;font-size:0.85em;font-weight:600;border-bottom:2px solid #c17f5a;">👥 전체 인물</button>
            <button class="mt-tab" data-tab="active" style="flex:1;padding:9px;border:none;background:transparent;color:#888;cursor:pointer;font-family:inherit;font-size:0.85em;border-bottom:2px solid transparent;">📌 롤플 주입</button>
        </div>

        <!-- 탭 컨텐츠 -->
        <div style="flex:1; overflow-y:auto; padding:10px 12px;" id="mt-tab-content">
        </div>

        <!-- 하단 스캔 버튼 -->
        <div style="padding:10px 12px; border-top:1px solid rgba(255,255,255,0.08); flex-shrink:0;">
            <button id="mt-scan-btn" class="menu_button" style="width:100%; font-size:0.85em;">🔍 전체 채팅 스캔</button>
        </div>
    </div>`);

    $('body').append(panel);
    renderTab('list');

    panel.on('click', '#mt-close-panel', () => panel.remove());
    panel.on('click', '#mt-scan-btn', () => scanAll());

    panel.on('click', '.mt-tab', function() {
        panel.find('.mt-tab').css({'color':'#888','border-bottom-color':'transparent','font-weight':'normal'});
        $(this).css({'color':'var(--SmartThemeBodyColor)','border-bottom-color':'#c17f5a','font-weight':'600'});
        renderTab($(this).data('tab'));
    });

    panel.on('click', '.mt-npc-row', function() {
        const id = $(this).data('id');
        openNPCDetail(id);
    });

    panel.on('click', '.mt-inject-toggle', function(e) {
        e.stopPropagation();
        const id = $(this).data('id');
        toggleInject(id);
    });
}

// ─── 탭 렌더링 ───────────────────────────────────────────────
function renderTab(tab) {
    const ctx = getContext();
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
    const npcs = settings.npcData[chatId] || [];
    const container = $('#mt-tab-content');

    const COLORS = { both:'#f0c040', char:'#2ecc71', user:'#3498db', unknown:'#666' };

    if (tab === 'list') {
        if (npcs.length === 0) {
            container.html('<p style="text-align:center;color:#666;padding:30px 0;font-size:0.85em;">수집된 인물이 없어요<br><br>🎒 버튼으로 수집하거나<br>전체 채팅 스캔을 눌러보세요</p>');
            return;
        }
        container.html(npcs.map(npc => `
            <div class="mt-npc-row" data-id="${npc.id}" style="
                display:flex; align-items:center; gap:10px; padding:9px 10px;
                margin-bottom:5px; border-radius:8px; cursor:pointer;
                background:rgba(255,255,255,0.04);
                transition:background 0.15s;
            " onmouseover="this.style.background='rgba(255,255,255,0.09)'" onmouseout="this.style.background='rgba(255,255,255,0.04)'">
                <span style="width:10px;height:10px;border-radius:50%;background:${COLORS[npc.relation]||'#666'};flex-shrink:0;"></span>
                <span style="flex:1;font-size:0.9em;font-weight:500;">${npc.name}</span>
                <span style="font-size:0.75em;color:#888;">${npc.profile?.occupation||''}</span>
                <button class="mt-inject-toggle" data-id="${npc.id}" style="
                    border:1px solid ${npc.injected?'#c17f5a':'rgba(255,255,255,0.2)'};
                    background:${npc.injected?'rgba(193,127,90,0.25)':'transparent'};
                    color:${npc.injected?'#c17f5a':'#888'};
                    border-radius:6px; padding:2px 7px; font-size:0.72em; cursor:pointer;
                    font-family:inherit; white-space:nowrap;
                ">${npc.injected?'주입 중':'+ 주입'}</button>
            </div>`).join(''));
    } else {
        const injected = npcs.filter(n => n.injected);
        if (injected.length === 0) {
            container.html('<p style="text-align:center;color:#666;padding:30px 0;font-size:0.85em;">주입된 인물이 없어요<br><br>전체 인물 목록에서<br>+ 주입 버튼을 눌러보세요</p>');
            return;
        }
        container.html(`
            <p style="font-size:0.75em;color:#888;margin:0 0 10px;">아래 인물들이 매 턴 시나리오에 주입됩니다</p>
            ${injected.map(npc => `
            <div style="
                display:flex; align-items:center; gap:10px; padding:9px 10px;
                margin-bottom:5px; border-radius:8px;
                background:rgba(193,127,90,0.12); border:1px solid rgba(193,127,90,0.3);
            ">
                <span style="width:8px;height:8px;border-radius:50%;background:${COLORS[npc.relation]||'#666'};flex-shrink:0;"></span>
                <div style="flex:1;">
                    <div style="font-size:0.88em;font-weight:600;">${npc.name}</div>
                    <div style="font-size:0.75em;color:#aaa;">${npc.profile?.occupation||''} ${npc.profile?.age?`· ${npc.profile.age}`:''}</div>
                </div>
                <button class="mt-inject-toggle" data-id="${npc.id}" style="
                    border:1px solid #c17f5a; background:rgba(193,127,90,0.25);
                    color:#c17f5a; border-radius:6px; padding:2px 7px;
                    font-size:0.72em; cursor:pointer; font-family:inherit;
                ">제거</button>
            </div>`).join('')}
        `);
    }
}

// ─── NPC 상세 팝업 ───────────────────────────────────────────
function openNPCDetail(npcId) {
    const ctx = getContext();
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
    const npc = (settings.npcData[chatId] || []).find(n => n.id === npcId);
    if (!npc) return;

    $('#mt-detail-popup').remove();

    const p = npc.profile || {};
    const isKo = settings.outputLanguage === 'ko';
    const COLORS = { both:'#f0c040', char:'#2ecc71', user:'#3498db', unknown:'#666' };
    const LABELS = { both: isKo?'둘 다 앎':'Both know', char: isKo?'캐릭터만 앎':'Char only', user: isKo?'유저만 앎':'User only', unknown: isKo?'관계 없음':'Unknown' };

    function row(label, val) {
        if (!val) return '';
        return `<div style="margin-bottom:10px;">
            <div style="font-size:0.72em;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">${label}</div>
            <div style="font-size:0.85em;line-height:1.5;">${val}</div>
        </div>`;
    }

    const popup = $(`
    <div id="mt-detail-popup" style="
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        width:320px; max-height:75vh; overflow-y:auto;
        background:var(--SmartThemeBlurTintColor, #1e1e2e);
        border:1px solid var(--SmartThemeBorderColor, #555);
        border-radius:12px; z-index:10001; padding:16px;
        box-shadow:0 16px 48px rgba(0,0,0,0.7);
        font-family:inherit;
    ">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <div>
                <div style="font-size:1.1em;font-weight:700;">${npc.name}</div>
                ${p.fullname && p.fullname !== npc.name ? `<div style="font-size:0.78em;color:#aaa;">${p.fullname}</div>` : ''}
            </div>
            <button id="mt-close-detail" style="border:none;background:transparent;cursor:pointer;color:#aaa;font-size:16px;padding:0;">✕</button>
        </div>
        <div style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:12px;background:rgba(255,255,255,0.06);margin-bottom:12px;">
            <span style="width:8px;height:8px;border-radius:50%;background:${COLORS[npc.relation]||'#666'};"></span>
            <span style="font-size:0.75em;color:#ccc;">${LABELS[npc.relation]||npc.relation}</span>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;">
            ${row(isKo?'나이':'Age', p.age)}
            ${row(isKo?'성별':'Gender', p.gender)}
            ${row(isKo?'직업/전공':'Occupation', p.occupation)}
            ${row(isKo?'성격 및 특징':'Personality', p.personality)}
            ${p.special ? row(isKo?'특기/능력':'Special', p.special) : ''}
            ${p.relation_char ? row(isKo?'캐릭터와의 관계':'Relation to char', p.relation_char) : ''}
            ${p.relation_user ? row(isKo?'유저와의 관계':'Relation to user', p.relation_user) : ''}
        </div>
        <button class="mt-inject-toggle menu_button" data-id="${npc.id}" style="
            width:100%;margin-top:10px;
            ${npc.injected?'background:rgba(193,127,90,0.3);border-color:#c17f5a;color:#c17f5a;':''}
        ">${npc.injected?(isKo?'📌 주입 해제':'Remove from RP'):(isKo?'📌 롤플에 주입':'Add to RP')}</button>
    </div>`);

    $('body').append(popup);

    popup.on('click', '#mt-close-detail', () => popup.remove());
    popup.on('click', '.mt-inject-toggle', function() {
        toggleInject($(this).data('id'));
        popup.remove();
    });
}

// ─── 주입 토글 ───────────────────────────────────────────────
function toggleInject(npcId) {
    const ctx = getContext();
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
    const npc = (settings.npcData[chatId] || []).find(n => n.id === npcId);
    if (!npc) return;
    npc.injected = !npc.injected;
    saveNPCData();
    updatePromptInjection(ctx);
    const currentTab = $('#mt-main-panel .mt-tab.active')?.data('tab') || 'list';
    renderTab(currentTab);
    showToast(npc.injected ? `📌 ${npc.name} 주입됨` : `${npc.name} 주입 해제`);
}

// ─── 프롬프트 주입 (챗 히스토리 아래) ──────────────────────
function updatePromptInjection(ctx) {
    const chatId = (ctx || getContext())?.chatId || 'default';
    const injected = (settings.npcData[chatId] || []).filter(n => n.injected);
    const isKo = settings.outputLanguage === 'ko';

    if (injected.length === 0) {
        setExtensionPrompt(PROMPT_KEY, '', extension_prompt_types.AFTER_SCENARIO, 0);
        return;
    }

    const lines = injected.map(n => {
        const p = n.profile || {};
        const parts = [
            `[${n.name}]`,
            p.age ? (isKo ? `${p.age}세` : `Age: ${p.age}`) : '',
            p.gender || '',
            p.occupation || '',
            p.personality ? `— ${p.personality}` : '',
        ].filter(Boolean);
        return parts.join(' ');
    });

    const header = isKo ? '[주변 인물]' : '[Known NPCs]';
    const text = `${header}\n${lines.join('\n')}`;
    setExtensionPrompt(PROMPT_KEY, text, extension_prompt_types.AFTER_SCENARIO, 0);
}

// ─── 채팅창 수집 버튼 ────────────────────────────────────────
function addCollectButton() {
    if ($('#mt-collect-btn').length) return;

    const btn = $(`<button id="mt-collect-btn" title="망태기 - NPC 수집" style="
        background:transparent; border:none; cursor:pointer;
        font-size:20px; padding:0 5px; opacity:0.75; transition:opacity 0.15s;
        display:flex; align-items:center; position:relative;
    ">🎒</button>`);

    btn.on('mouseenter', function() { $(this).css('opacity','1'); });
    btn.on('mouseleave', function() { $(this).css('opacity','0.75'); });
    btn.on('click', () => collectFromLastMessage());

    const sendBtn = $('#send_but');
    if (sendBtn.length) sendBtn.before(btn);
}

// ─── 수집 실행 ───────────────────────────────────────────────
async function collectFromLastMessage() {
    const ctx = getContext();
    if (!ctx?.chat || ctx.chat.length === 0) { showToast('채팅 기록이 없어요'); return; }

    const profile = getSelectedProfile();
    if (!profile) { showToast('⚙️ 확장 설정에서 프로필을 선택해주세요'); return; }

    // 수집 중 애니메이션
    const btn = $('#mt-collect-btn');
    let frame = 0;
    const frames = ['🎒', '✨', '🎒', '💫'];
    const anim = setInterval(() => {
        btn.text(frames[frame % frames.length]);
        frame++;
    }, 300);
    btn.prop('disabled', true);

    try {
        const lastMsg = ctx.chat[ctx.chat.length - 1];
        const charName = ctx.name2 || 'char';
        const userName = ctx.name1 || 'user';
        const text = `${lastMsg.name || charName}: ${lastMsg.mes}`;

        const result = await callWithProfile(profile, buildPrompt(text, charName, userName, settings.outputLanguage));
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
        clearInterval(anim);
        btn.text('🎒').prop('disabled', false);
    }
}

// ─── 전체 스캔 ───────────────────────────────────────────────
async function scanAll() {
    const ctx = getContext();
    const profile = getSelectedProfile();
    if (!profile) { showToast('⚙️ 확장 설정에서 프로필을 선택해주세요'); return; }
    if (!ctx?.chat || ctx.chat.length === 0) { showToast('채팅 기록이 없어요'); return; }

    $('#mt-scan-btn').prop('disabled', true).text('⏳ 스캔 중...');
    try {
        const charName = ctx.name2 || 'char';
        const userName = ctx.name1 || 'user';
        const chatText = ctx.chat.slice(-60).map(m =>
            `${m.name || (m.is_user ? userName : charName)}: ${m.mes}`
        ).join('\n');

        const result = await callWithProfile(profile, buildPrompt(chatText, charName, userName, settings.outputLanguage));
        const match = result.match(/\[[\s\S]*?\]/);
        if (!match) { showToast('NPC를 찾지 못했어요'); return; }

        const extracted = JSON.parse(match[0]);
        mergeNPCs(ctx, extracted);
        showToast(`✨ ${extracted.length}명 수집 완료`);
        renderTab('list');

    } catch (err) {
        showToast(`오류: ${err.message}`);
    } finally {
        $('#mt-scan-btn').prop('disabled', false).text('🔍 전체 채팅 스캔');
    }
}

// ─── 프로필로 API 호출 ───────────────────────────────────────
function getSelectedProfile() {
    const profiles = extension_settings.connectionManager?.profiles || [];
    return profiles.find(p => p.name === settings.profileName) || null;
}

async function callWithProfile(profile, prompt) {
    // ST Connection Manager 프로필에서 API 정보 추출
    const apiUrl = profile.api_url_text || profile.openai_api_url || '';
    const apiKey = profile.api_key_openai || profile.api_key || '';
    const model = profile.openai_model || profile.model || 'gemini-2.0-flash';

    if (!apiUrl && !apiKey) throw new Error('프로필에 API 정보가 없어요');

    // Gemini 직접 호출
    if (apiKey && !apiUrl) {
        const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.5, maxOutputTokens: 2000 }
                })
            }
        );
        if (!resp.ok) throw new Error(`API 오류 ${resp.status}`);
        const data = await resp.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    // OpenAI 호환 API 호출
    const resp = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 2000,
        })
    });
    if (!resp.ok) throw new Error(`API 오류 ${resp.status}`);
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
}

// ─── 추출 프롬프트 ───────────────────────────────────────────
function buildPrompt(text, charName, userName, lang) {
    const isKo = lang === 'ko';
    return `Analyze this roleplay chat. Extract all named NPCs that are NOT "${charName}" and NOT "${userName}".

Return ONLY a valid JSON array, no markdown, no extra text:
[{
  "name": "exact name as written in chat",
  "relation": "both|char|user|unknown",
  "profile": {
    "fullname": "full name including middle name if known",
    "age": "${isKo?'나이 또는 추정 범위':'age or range'}",
    "gender": "${isKo?'남성/여성/기타':'male/female/other'}",
    "occupation": "${isKo?'직업 또는 전공':'job or major'}",
    "personality": "${isKo?'성격과 특징 2-3문장, TMI스럽고 흥미롭게':'2-3 sentences, interesting TMI style'}",
    "special": "${isKo?'특기나 능력, 없으면 빈 문자열':'skills or abilities, empty string if none'}",
    "relation_char": "${isKo?charName+'과의 관계':'relation to '+charName}",
    "relation_user": "${isKo?userName+'과의 관계':'relation to '+userName}"
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
                injected: false,
            });
        }
    });
    saveNPCData();
}

// ─── 수집 결과 팝업 ──────────────────────────────────────────
function showCollectResult(extracted) {
    $('#mt-collect-result').remove();
    const isKo = settings.outputLanguage === 'ko';

    const popup = $(`
    <div id="mt-collect-result" style="
        position:fixed; bottom:80px; right:16px; width:280px;
        background:var(--SmartThemeBlurTintColor,#1e1e2e);
        border:1px solid #c17f5a; border-radius:12px; padding:13px;
        z-index:10000; box-shadow:0 8px 24px rgba(0,0,0,0.5);
        animation:mt-slidein 0.2s ease; font-family:inherit;
    ">
        <style>@keyframes mt-slidein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}</style>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <b style="color:#c17f5a;font-size:0.9em;">✨ ${extracted.length}${isKo?'명 수집됨':' collected'}</b>
            <button id="mt-close-result" style="border:none;background:transparent;cursor:pointer;color:#aaa;font-size:14px;padding:0;">✕</button>
        </div>
        ${extracted.map(n => `
        <div style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:0.85em;font-weight:600;">${n.name}</div>
            <div style="font-size:0.75em;color:#aaa;margin-top:2px;">${n.profile?.occupation||''} ${n.profile?.age?`· ${n.profile.age}`:''}</div>
        </div>`).join('')}
        <button id="mt-open-panel" class="menu_button" style="width:100%;margin-top:10px;font-size:0.82em;">🎒 망태기 열기</button>
    </div>`);

    $('body').append(popup);
    popup.on('click', '#mt-close-result', () => popup.remove());
    popup.on('click', '#mt-open-panel', () => { popup.remove(); openMainPanel(); });
    setTimeout(() => popup.fadeOut(300, () => popup.remove()), 6000);
}

// ─── 유틸 ────────────────────────────────────────────────────
function saveNPCData() {
    extension_settings[EXT_NAME] = settings;
    saveSettingsDebounced();
}

function showToast(msg) {
    let t = $('#mt-toast');
    if (!t.length) {
        t = $('<div id="mt-toast" style="position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(8px);background:rgba(20,20,20,0.95);color:white;padding:8px 16px;border-radius:20px;font-size:12px;z-index:11000;opacity:0;transition:all 0.2s ease;white-space:nowrap;pointer-events:none;"></div>').appendTo('body');
    }
    t.text(msg).css({opacity:1,transform:'translateX(-50%) translateY(0)'});
    clearTimeout(t.data('timer'));
    t.data('timer', setTimeout(() => t.css({opacity:0,transform:'translateX(-50%) translateY(8px)'}), 2500));
}

export async function init() { await mangInit(); }
setTimeout(mangInit, 500);
