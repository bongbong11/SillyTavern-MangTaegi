// 당신의 망태기 v6.0
import { extension_settings, getContext } from '../../../extensions.js';
import { saveSettingsDebounced, eventSource, event_types, setExtensionPrompt, extension_prompt_types } from '../../../../script.js';

const EXT_NAME = 'SillyTavern-MangTaegi';
const PROMPT_KEY = 'mangtaegi_npc';
const CATEGORIES = ['조력자', '적대자', '민간인', '공공기관', '동물/영물', '기타'];
const THEMES = ['자동감지', '현대 (한국)', '현대 (해외)', '판타지'];

const defaultSettings = {
    outputLanguage: 'ko',
    theme: '자동감지',
    profileId: '',
    nameBlacklist: ['Miller', 'Smith', 'Johnson', 'Chloe', 'Emma', 'Liam', 'Noah'],
    colors: { both: '#e8a87c', char: '#7cc4a8', user: '#7ca8e8', unknown: '#888888' },
    npcData: {},
};

let settings = {};
let currentSection = 'wild';
let currentCategory = 'all';
let currentView = 'list';
let currentNPCId = null;
let folderState = {}; // 주입 중 폴더 열림/닫힘

// ─── 초기화 ──────────────────────────────────────────────────
async function mangInit() {
    if (!extension_settings[EXT_NAME]) extension_settings[EXT_NAME] = { ...defaultSettings };
    settings = extension_settings[EXT_NAME];
    if (!settings.npcData) settings.npcData = {};
    if (!settings.nameBlacklist) settings.nameBlacklist = [...defaultSettings.nameBlacklist];
    if (!settings.colors) settings.colors = { ...defaultSettings.colors };

    injectSettingsPanel();
    addToWandMenu();
    addCollectButton();

    const observer = new MutationObserver(() => addCollectButton());
    const chatEl = document.querySelector('#chat');
    if (chatEl) observer.observe(chatEl, { childList: true, subtree: false });

    console.log('[망태기] v6.0 로드 완료 ✅');
}

// ─── 확장 탭 설정 패널 ───────────────────────────────────────
function injectSettingsPanel() {
    if ($('#mangtaegi-settings').length) return;

    const panel = $(`
    <div id="mangtaegi-settings" class="extension_container">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>🎒 당신의 망태기</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down interactable" tabindex="0"></div>
            </div>
            <div class="inline-drawer-content" style="padding:12px;display:flex;flex-direction:column;gap:10px;">
                <div>
                    <label style="font-size:0.8em;color:#aaa;display:block;margin-bottom:5px;">연결 프로필</label>
                    <select id="mt-profile-select" class="text_node" style="width:100%;box-sizing:border-box;">
                        <option value="">-- 프로필 선택 --</option>
                        ${(extension_settings.connectionManager?.profiles||[]).map(p=>
                            `<option value="${p.id}" ${settings.profileId===p.id?'selected':''}>${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:0.8em;color:#aaa;display:block;margin-bottom:5px;">세계관 테마</label>
                    <select id="mt-theme-select" class="text_node" style="width:100%;box-sizing:border-box;">
                        ${THEMES.map(t=>`<option value="${t}" ${settings.theme===t?'selected':''}>${t}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:0.8em;color:#aaa;display:block;margin-bottom:5px;">프로필 표시 언어</label>
                    <select id="mt-lang-select" class="text_node" style="width:100%;box-sizing:border-box;">
                        <option value="ko" ${settings.outputLanguage==='ko'?'selected':''}>한국어</option>
                        <option value="en" ${settings.outputLanguage==='en'?'selected':''}>English</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:0.8em;color:#aaa;display:block;margin-bottom:5px;">관계 색상</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <input type="color" id="mt-color-both" value="${settings.colors.both}" style="width:28px;height:28px;border:none;background:none;cursor:pointer;padding:0;">
                            <span style="font-size:0.8em;color:#aaa;">둘 다 앎</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <input type="color" id="mt-color-char" value="${settings.colors.char}" style="width:28px;height:28px;border:none;background:none;cursor:pointer;padding:0;">
                            <span style="font-size:0.8em;color:#aaa;">캐릭터만</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <input type="color" id="mt-color-user" value="${settings.colors.user}" style="width:28px;height:28px;border:none;background:none;cursor:pointer;padding:0;">
                            <span style="font-size:0.8em;color:#aaa;">유저만</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <input type="color" id="mt-color-unknown" value="${settings.colors.unknown}" style="width:28px;height:28px;border:none;background:none;cursor:pointer;padding:0;">
                            <span style="font-size:0.8em;color:#aaa;">관계 없음</span>
                        </div>
                    </div>
                </div>
                <div>
                    <label style="font-size:0.8em;color:#aaa;display:block;margin-bottom:5px;">이름 블랙리스트 (쉼표 구분)</label>
                    <textarea id="mt-blacklist" class="text_node" rows="2" style="width:100%;box-sizing:border-box;resize:vertical;font-size:0.85em;">${(settings.nameBlacklist||[]).join(', ')}</textarea>
                </div>
                <div style="display:flex;gap:7px;">
                    <button id="mt-settings-save" class="menu_button" style="flex:1;">저장</button>
                    <button id="mt-export-btn" class="menu_button" style="flex:1;">📤 내보내기</button>
                    <button id="mt-import-btn" class="menu_button" style="flex:1;">📥 불러오기</button>
                </div>
                <input type="file" id="mt-import-file" accept=".json" style="display:none;">
            </div>
        </div>
    </div>`);

    $('#extensions_settings').append(panel);

    panel.on('click', '#mt-settings-save', () => {
        settings.profileId = $('#mt-profile-select').val();
        settings.outputLanguage = $('#mt-lang-select').val();
        settings.theme = $('#mt-theme-select').val();
        settings.nameBlacklist = $('#mt-blacklist').val().split(',').map(s=>s.trim()).filter(Boolean);
        settings.colors = {
            both: $('#mt-color-both').val(),
            char: $('#mt-color-char').val(),
            user: $('#mt-color-user').val(),
            unknown: $('#mt-color-unknown').val(),
        };
        extension_settings[EXT_NAME] = settings;
        saveSettingsDebounced();
        showToast('✅ 저장됨');
        // 범례 업데이트
        updateLegend();
    });
    panel.on('click', '#mt-export-btn', exportData);
    panel.on('click', '#mt-import-btn', () => $('#mt-import-file').click());
    panel.on('change', '#mt-import-file', importData);
}

// ─── 마법봉 메뉴 ─────────────────────────────────────────────
function addToWandMenu() {
    if ($('#mt-wand-btn').length) return;
    const btn = $(`<div id="mt-wand-btn" class="list-group-item flex-container flexGap5 interactable" tabindex="0">
        <span style="font-size:16px;">🎒</span><span>당신의 망태기</span>
    </div>`);
    $(document).on('click', '#mt-wand-btn', () => {
        $('#extensionsMenu').fadeOut(200);
        openMainPanel();
    });
    $('#extensionsMenu').append(btn);
}

// ─── 채팅창 수집 버튼 ────────────────────────────────────────
function addCollectButton() {
    if ($('#mt-collect-btn').length) return;
    const btn = $(`<button id="mt-collect-btn" title="망태기 - NPC 수집" style="background:transparent;border:none;cursor:pointer;font-size:20px;padding:0 5px;opacity:0.75;transition:opacity 0.15s;display:flex;align-items:center;">🎒</button>`);
    btn.on('mouseenter', function() { $(this).css('opacity','1'); });
    btn.on('mouseleave', function() { $(this).css('opacity','0.75'); });
    btn.on('click', (e) => showCollectMenu(e));
    const sendBtn = $('#send_but');
    if (sendBtn.length) sendBtn.before(btn);
}

// ─── 수집 서브메뉴 ───────────────────────────────────────────
function showCollectMenu(e) {
    $('#mt-collect-menu').remove();
    const btn = $('#mt-collect-btn');
    const rect = btn[0].getBoundingClientRect();

    const menu = $(`
    <div id="mt-collect-menu" style="bottom:${window.innerHeight - rect.top + 6}px;left:${rect.left}px;">
        <button class="mt-collect-menu-item" id="mt-collect-recent">
            <span>💬</span><span>최근 대화 수집 (Wild)</span>
        </button>
        <button class="mt-collect-menu-item" id="mt-collect-main">
            <span>📋</span><span>시트/로어북 수집 (Main)</span>
        </button>
    </div>`);

    $('body').append(menu);

    menu.on('click', '#mt-collect-recent', () => { menu.remove(); collectFromRecent(); });
    menu.on('click', '#mt-collect-main', () => { menu.remove(); collectFromSheets(); });

    // 외부 클릭 닫기
    setTimeout(() => {
        $(document).one('click', () => $('#mt-collect-menu').remove());
    }, 10);
}

// ─── 최근 대화 수집 (Wild) ───────────────────────────────────
async function collectFromRecent() {
    const ctx = getContext();
    if (!ctx?.chat || ctx.chat.length === 0) { showToast('채팅 기록이 없어요'); return; }

    animateCollectBtn();
    try {
        const recent = ctx.chat.slice(-3);
        const charName = ctx.name2 || 'char';
        const userName = ctx.name1 || 'user';
        const text = recent.map(m => `${m.name||(m.is_user?userName:charName)}: ${m.mes}`).join('\n');

        const result = await callWithProfile(buildPrompt(text, charName, userName, settings.outputLanguage, settings.theme));
        const match = result.match(/\[[\s\S]*?\]/);
        if (!match) { showToast('NPC를 찾지 못했어요'); return; }

        const extracted = JSON.parse(match[0]);
        if (extracted.length === 0) { showToast('새 NPC가 없어요'); return; }

        mergeNPCs(ctx, extracted, 'wild');
        showCollectResult(extracted);
        refreshPanelIfOpen();

    } catch (err) {
        console.error('[망태기]', err);
        showToast(`오류: ${err.message}`);
    } finally {
        stopCollectAnim();
    }
}

// ─── 시트/로어북 수집 (Main) ─────────────────────────────────
async function collectFromSheets() {
    const ctx = getContext();
    animateCollectBtn();

    try {
        const sources = [];
        const charName = ctx.name2 || 'char';
        const userName = ctx.name1 || 'user';

        // 캐릭터 시트
        const char = ctx.characters?.[ctx.characterId];
        if (char) {
            if (char.description) sources.push(`[Character Sheet - ${charName}]\n${char.description}`);
            if (char.personality) sources.push(`[Personality]\n${char.personality}`);
            if (char.scenario) sources.push(`[Scenario]\n${char.scenario}`);
            if (char.mes_example) sources.push(`[Example Messages]\n${char.mes_example}`);
        }

        // 페르소나
        const persona = ctx.personas?.[ctx.persona];
        if (persona?.description) sources.push(`[Persona - ${userName}]\n${persona.description}`);

        // 로어북
        const worldInfo = ctx.worldInfo;
        if (worldInfo) {
            const entries = Object.values(worldInfo).flat?.() || [];
            entries.forEach(entry => {
                if (entry?.content) sources.push(`[Lorebook: ${entry.comment||entry.key||'entry'}]\n${entry.content}`);
            });
        }

        if (sources.length === 0) { showToast('읽을 수 있는 시트/로어북이 없어요'); return; }

        const combinedText = sources.join('\n\n');
        const prompt = buildPrompt(combinedText, charName, userName, settings.outputLanguage, settings.theme, true);
        const result = await callWithProfile(prompt);
        const match = result.match(/\[[\s\S]*?\]/);
        if (!match) { showToast('NPC를 찾지 못했어요'); return; }

        const extracted = JSON.parse(match[0]);
        if (extracted.length === 0) { showToast('새 NPC가 없어요'); return; }

        mergeNPCs(ctx, extracted, 'main');
        showCollectResult(extracted, 'main');
        refreshPanelIfOpen();

    } catch (err) {
        console.error('[망태기]', err);
        showToast(`오류: ${err.message}`);
    } finally {
        stopCollectAnim();
    }
}

let collectAnim = null;
function animateCollectBtn() {
    const btn = $('#mt-collect-btn');
    btn.prop('disabled', true);
    let f = 0;
    const frames = ['🎒','✨','🎒','💫'];
    collectAnim = setInterval(() => btn.text(frames[f++%frames.length]), 280);
}
function stopCollectAnim() {
    clearInterval(collectAnim);
    $('#mt-collect-btn').text('🎒').prop('disabled', false);
}

function refreshPanelIfOpen() {
    if ($('#mt-main-panel').length) {
        renderSidebar();
        renderNPCList();
    }
}

// ─── 메인 패널 ───────────────────────────────────────────────
function openMainPanel() {
    if ($('#mt-main-panel').length) { $('#mt-main-panel').remove(); return; }

    const panel = $(`
    <div id="mt-main-panel">
        <div class="mt-header">
            <div class="mt-header-title">🎒 당신의 망태기</div>
            <button class="mt-close-btn" id="mt-close-panel">✕</button>
        </div>
        <div class="mt-legend" id="mt-legend">
            <div class="mt-legend-item" data-rel="both"><span class="mt-legend-dot" style="background:${settings.colors.both};"></span>둘 다 앎</div>
            <div class="mt-legend-item" data-rel="char"><span class="mt-legend-dot" style="background:${settings.colors.char};"></span>캐릭터만</div>
            <div class="mt-legend-item" data-rel="user"><span class="mt-legend-dot" style="background:${settings.colors.user};"></span>유저만</div>
            <div class="mt-legend-item" data-rel="unknown"><span class="mt-legend-dot" style="background:${settings.colors.unknown};"></span>관계 없음</div>
        </div>
        <div class="mt-body">
            <div class="mt-sidebar" id="mt-sidebar"></div>
            <div class="mt-content">

                <!-- 뷰1: 목록 -->
                <div class="mt-view visible" id="mt-view-list">
                    <div class="mt-content-header">
                        <span class="mt-content-title" id="mt-content-title">전체</span>
                        <button class="mt-scan-btn" id="mt-scan-btn">🔍 전체 스캔</button>
                    </div>
                    <div class="mt-npc-list" id="mt-npc-list"></div>
                    <div class="mt-footer">
                        <button class="mt-add-btn" id="mt-add-btn">+ 인물 직접 추가</button>
                    </div>
                </div>

                <!-- 뷰2: 상세 -->
                <div class="mt-view hidden-right" id="mt-view-detail">
                    <div class="mt-content-header">
                        <button class="mt-back-btn" id="mt-back-from-detail">← 목록</button>
                        <div style="display:flex;gap:5px;align-items:center;">
                            <select id="mt-cat-select" style="font-size:0.72em;background:#1e1510;border:1px solid #3d2b1a;color:#c8a878;border-radius:6px;padding:2px 5px;font-family:inherit;cursor:pointer;"></select>
                            <button id="mt-move-section" style="font-size:0.7em;padding:3px 6px;border-radius:5px;border:1px solid #3d2b1a;background:transparent;color:#7a6a5a;cursor:pointer;font-family:inherit;white-space:nowrap;"></button>
                        </div>
                    </div>
                    <div class="mt-detail-scroll" id="mt-detail-body"></div>
                    <div class="mt-detail-actions">
                        <button class="mt-detail-inject" id="mt-detail-inject">📌 롤플에 주입</button>
                        <button class="mt-detail-delete" id="mt-detail-delete">🗑</button>
                    </div>
                </div>

                <!-- 뷰3: 생성 -->
                <div class="mt-view hidden-right" id="mt-view-create">
                    <div class="mt-content-header">
                        <button class="mt-back-btn" id="mt-back-from-create">← 목록</button>
                        <span style="font-size:0.8em;color:#c8a878;">✨ 인물 추가</span>
                    </div>
                    <div class="mt-create-body">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            <div>
                                <label class="mt-field-label">섹션</label>
                                <select id="mt-create-section" class="text_node" style="width:100%;box-sizing:border-box;">
                                    <option value="wild">🎒 Wild</option>
                                    <option value="main">📋 Main</option>
                                </select>
                            </div>
                            <div>
                                <label class="mt-field-label">카테고리</label>
                                <select id="mt-create-cat" class="text_node" style="width:100%;box-sizing:border-box;">
                                    ${CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="mt-field-label">이름 (비우면 자동 생성)</label>
                            <input type="text" id="mt-create-name" class="text_node" placeholder="홍길동" style="width:100%;box-sizing:border-box;">
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            <div>
                                <label class="mt-field-label">나이</label>
                                <input type="text" id="mt-create-age" class="text_node" placeholder="28" style="width:100%;box-sizing:border-box;">
                            </div>
                            <div>
                                <label class="mt-field-label">성별</label>
                                <select id="mt-create-gender" class="text_node" style="width:100%;box-sizing:border-box;">
                                    <option value="">자동</option>
                                    <option value="남성">남성</option>
                                    <option value="여성">여성</option>
                                    <option value="기타">기타</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="mt-field-label">직업/종류</label>
                            <input type="text" id="mt-create-occ" class="text_node" placeholder="형사, 마법사, 길냥이..." style="width:100%;box-sizing:border-box;">
                        </div>
                        <div>
                            <label class="mt-field-label">메모 (선택)</label>
                            <input type="text" id="mt-create-memo" class="text_node" placeholder="주인공의 오랜 친구..." style="width:100%;box-sizing:border-box;">
                        </div>
                    </div>
                    <div class="mt-create-footer">
                        <button class="mt-create-submit" id="mt-create-confirm">✨ 생성하기</button>
                        <button class="mt-create-random" id="mt-create-random">🎲 랜덤</button>
                    </div>
                </div>

            </div>
        </div>
    </div>`);

    $('body').append(panel);
    renderSidebar();
    renderNPCList();

    panel.on('click', '#mt-close-panel', () => panel.remove());
    panel.on('click', '#mt-scan-btn', () => scanAll());
    panel.on('click', '#mt-add-btn', () => showView('create'));
    panel.on('click', '#mt-back-from-detail', () => showView('list'));
    panel.on('click', '#mt-back-from-create', () => showView('list'));

    panel.on('click', '.mt-tab', function() {
        const sec = $(this).data('section');
        const cat = $(this).data('category');
        if (sec !== undefined) currentSection = String(sec);
        if (cat !== undefined) currentCategory = String(cat);
        renderSidebar();
        renderNPCList();
        showView('list');
    });

    panel.on('click', '.mt-npc-row', function(e) {
        if ($(e.target).hasClass('mt-inject-btn') || $(e.target).closest('.mt-inject-btn').length) return;
        openDetail($(this).data('id'));
    });

    panel.on('click', '.mt-inject-btn', function(e) {
        e.stopPropagation();
        toggleInject($(this).data('id'));
    });

    panel.on('click', '#mt-detail-inject', () => {
        if (currentNPCId) { toggleInject(currentNPCId); refreshDetail(currentNPCId); }
    });

    panel.on('click', '#mt-detail-delete', () => {
        if (currentNPCId) { deleteNPC(currentNPCId); showView('list'); }
    });

    panel.on('change', '#mt-cat-select', function() {
        const npc = getCurrentNPC();
        if (npc) { npc.category = $(this).val(); saveNPCData(); renderSidebar(); }
    });

    panel.on('click', '#mt-move-section', () => {
        const npc = getCurrentNPC();
        if (npc) {
            npc.section = npc.section === 'main' ? 'wild' : 'main';
            saveNPCData();
            refreshDetail(currentNPCId);
            renderSidebar();
            showToast(`${npc.name} → ${npc.section==='main'?'Main':'Wild'}으로 이동`);
        }
    });

    panel.on('click', '#mt-create-confirm', () => createNPC(false));
    panel.on('click', '#mt-create-random', () => createNPC(true));

    // 폴더 토글
    panel.on('click', '.mt-folder-header', function() {
        const cat = $(this).data('cat');
        folderState[cat] = !folderState[cat];
        const arrow = $(this).find('.mt-folder-arrow');
        const content = $(this).next('.mt-folder-content');
        arrow.toggleClass('open', folderState[cat]);
        content.toggleClass('open', folderState[cat]);
    });
}

// ─── 뷰 전환 ─────────────────────────────────────────────────
function showView(view) {
    const prev = currentView;
    currentView = view;
    const views = { list: '#mt-view-list', detail: '#mt-view-detail', create: '#mt-view-create' };
    if (prev !== view) {
        const goingForward = view !== 'list';
        $(views[prev]).removeClass('visible').addClass(goingForward ? 'hidden-left' : 'hidden-right');
        setTimeout(() => $(views[prev]).addClass('hidden-right').removeClass('hidden-left'), 260);
    }
    $(views[view]).removeClass('hidden-right hidden-left').addClass('visible');
}

// ─── 상세 뷰 ─────────────────────────────────────────────────
function openDetail(npcId) {
    currentNPCId = npcId;
    refreshDetail(npcId);
    showView('detail');
}

function refreshDetail(npcId) {
    const npc = getCurrentNPCById(npcId);
    if (!npc) return;
    const p = npc.profile || {};
    const isKo = settings.outputLanguage === 'ko';

    function row(label, val) {
        if (!val) return '';
        return `<div class="mt-detail-row"><div class="mt-detail-label">${label}</div><div class="mt-detail-val">${val}</div></div>`;
    }

    $('#mt-detail-body').html(`
        <div style="margin-bottom:12px;">
            <div style="font-size:1.05em;font-weight:700;color:#e8c99a;margin-bottom:2px;">${npc.name}</div>
            ${p.fullname&&p.fullname!==npc.name?`<div style="font-size:0.74em;color:#7a6a5a;">${p.fullname}</div>`:''}
            <div style="margin-top:6px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,0.06);font-size:0.71em;color:#c8a878;">
                    <span style="width:6px;height:6px;border-radius:50%;background:${settings.colors[npc.relation]||'#888'};"></span>
                    ${{both:'둘 다 앎',char:'캐릭터만',user:'유저만',unknown:'관계 없음'}[npc.relation]||npc.relation}
                </span>
                <span style="font-size:0.71em;color:#7a6a5a;padding:2px 6px;border-radius:10px;background:rgba(255,255,255,0.04);">${npc.section==='main'?'📋 Main':'🎒 Wild'}</span>
            </div>
        </div>
        <div style="border-top:1px solid #3d2b1a;padding-top:12px;">
            ${row(isKo?'나이':'Age', p.age)}
            ${row(isKo?'성별':'Gender', p.gender)}
            ${row(isKo?'직업/전공':'Occupation', p.occupation)}
            ${row(isKo?'성격 및 특징':'Personality', p.personality)}
            ${p.special?row(isKo?'특기/능력':'Special', p.special):''}
            ${p.relation_char?row(isKo?'캐릭터와의 관계':'Relation to char', p.relation_char):''}
            ${p.relation_user?row(isKo?'유저와의 관계':'Relation to user', p.relation_user):''}
        </div>
    `);

    $('#mt-cat-select').html(CATEGORIES.map(c=>`<option value="${c}" ${npc.category===c?'selected':''}>${c}</option>`).join(''));
    $('#mt-move-section').text(npc.section==='main'?'→ Wild':'→ Main');
    $('#mt-detail-inject').text(npc.injected?'📌 주입 해제':'📌 롤플에 주입').toggleClass('active', !!npc.injected);
}

// ─── 사이드바 렌더링 ─────────────────────────────────────────
function renderSidebar() {
    const ctx = getContext();
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
    const npcs = settings.npcData[chatId] || [];

    const mainNpcs = npcs.filter(n => n.section === 'main');
    const wildNpcs = npcs.filter(n => n.section !== 'main');
    const injected = npcs.filter(n => n.injected);

    const catCounts = {};
    CATEGORIES.forEach(c => { catCounts[c] = wildNpcs.filter(n => n.category === c).length; });

    // 주입 중 폴더 HTML
    const injectedFolders = CATEGORIES.map(cat => {
        const items = injected.filter(n => n.category === cat);
        if (items.length === 0) return '';
        const isOpen = folderState[cat];
        return `
        <div class="mt-folder">
            <button class="mt-folder-header" data-cat="${cat}">
                <span class="mt-folder-arrow ${isOpen?'open':''}">▶</span>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;">${cat}</span>
                <span class="mt-tab-count">${items.length}</span>
            </button>
            <div class="mt-folder-content ${isOpen?'open':''}">
                ${items.map(n=>`<button class="mt-folder-item" data-id="${n.id}">${n.name}</button>`).join('')}
            </div>
        </div>`;
    }).join('');

    $('#mt-sidebar').html(`
        <div class="mt-sidebar-label">섹션</div>
        <button class="mt-tab ${currentSection==='all'&&currentCategory==='all'?'active':''}" data-section="all" data-category="all">전체 <span class="mt-tab-count">${npcs.length}</span></button>
        <button class="mt-tab ${currentSection==='main'&&currentCategory==='all'?'active':''}" data-section="main" data-category="all">📋 Main <span class="mt-tab-count">${mainNpcs.length}</span></button>
        <button class="mt-tab ${currentSection==='wild'&&currentCategory==='all'?'active':''}" data-section="wild" data-category="all">🎒 Wild <span class="mt-tab-count">${wildNpcs.length}</span></button>
        ${CATEGORIES.map(c=>`
        <button class="mt-tab mt-tab-sub ${currentSection==='wild'&&currentCategory===c?'active':''}" data-section="wild" data-category="${c}">∟ ${c} <span class="mt-tab-count">${catCounts[c]||0}</span></button>`).join('')}
        <div class="mt-sidebar-label" style="margin-top:4px;">주입 중</div>
        <button class="mt-tab ${currentSection==='injected'&&currentCategory==='all'?'active':''}" data-section="injected" data-category="all">📌 전체 <span class="mt-tab-count">${injected.length}</span></button>
        ${injectedFolders}
    `);

    // 폴더 아이템 클릭
    $('#mt-sidebar').on('click', '.mt-folder-item', function() {
        openDetail($(this).data('id'));
    });
}

// ─── NPC 목록 렌더링 ─────────────────────────────────────────
function renderNPCList() {
    const ctx = getContext();
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
    let npcs = settings.npcData[chatId] || [];

    if (currentSection === 'main') npcs = npcs.filter(n => n.section === 'main');
    else if (currentSection === 'wild') npcs = npcs.filter(n => n.section !== 'main');
    else if (currentSection === 'injected') npcs = npcs.filter(n => n.injected);

    if (currentCategory !== 'all') npcs = npcs.filter(n => n.category === currentCategory);

    const titleMap = { all:'전체 인물', main:'📋 Main', wild:'🎒 Wild', injected:'📌 주입 중' };
    $('#mt-content-title').text(currentCategory!=='all' ? `🎒 Wild › ${currentCategory}` : (titleMap[currentSection]||'전체'));

    const container = $('#mt-npc-list');
    if (!container.length) return;

    if (npcs.length === 0) {
        container.html(`<div class="mt-empty">${
            currentSection==='main'?'📋 시트 기반 인물이 없어요<br>🎒 버튼 › 시트/로어북 수집을 눌러보세요' :
            currentSection==='injected'?'📌 주입된 인물이 없어요<br>인물 상세에서 주입 버튼을 눌러보세요' :
            '🎒 수집된 인물이 없어요<br>🎒 버튼이나 전체 스캔을 눌러보세요'
        }</div>`);
        return;
    }

    container.html(npcs.map(npc => `
        <div class="mt-npc-row" data-id="${npc.id}">
            <span class="mt-npc-dot" style="background:${settings.colors[npc.relation]||'#888'};"></span>
            <span class="mt-npc-name">${npc.name}</span>
            <span class="mt-npc-sub">${npc.profile?.occupation||npc.category||''}</span>
            <button class="mt-inject-btn ${npc.injected?'active':''}" data-id="${npc.id}">${npc.injected?'주입 중':'+ 주입'}</button>
        </div>`).join(''));
}

// ─── NPC 생성 ────────────────────────────────────────────────
async function createNPC(isRandom) {
    const section = $('#mt-create-section').val() || 'wild';
    const cat = $('#mt-create-cat').val();
    const name = isRandom ? '' : $('#mt-create-name').val().trim();
    const age = isRandom ? '' : $('#mt-create-age').val().trim();
    const gender = isRandom ? '' : $('#mt-create-gender').val();
    const occ = isRandom ? '' : $('#mt-create-occ').val().trim();
    const memo = isRandom ? '' : $('#mt-create-memo').val().trim();

    const btn = isRandom ? $('#mt-create-random') : $('#mt-create-confirm');
    btn.prop('disabled', true).text(isRandom ? '🎲...' : '생성 중...');

    try {
        const ctx = getContext();
        const prompt = buildCreatePrompt(name, age, gender, occ, memo, cat, settings.outputLanguage, settings.theme, isRandom);
        const result = await callWithProfile(prompt);
        const match = result.match(/\{[\s\S]*?\}/);
        if (!match) throw new Error('생성 실패');

        const profile = JSON.parse(match[0]);
        const finalName = profile.name || name || generateName(settings.theme, cat);

        const ctx2 = getContext();
        const chatId = ctx2?.chatId || ctx2?.characterId || 'default';
        if (!settings.npcData[chatId]) settings.npcData[chatId] = [];
        settings.npcData[chatId].push({
            id: `npc_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
            name: finalName,
            section,
            category: cat,
            relation: 'unknown',
            profile,
            injected: false,
        });

        saveNPCData();
        renderSidebar();
        renderNPCList();
        showView('list');
        showToast(`✨ ${finalName} 추가됨`);
        if (!isRandom) $('#mt-create-name, #mt-create-age, #mt-create-occ, #mt-create-memo').val('');

    } catch (err) {
        showToast(`오류: ${err.message}`);
    } finally {
        btn.prop('disabled', false).text(isRandom ? '🎲 랜덤' : '✨ 생성하기');
    }
}

// ─── 전체 스캔 ───────────────────────────────────────────────
async function scanAll() {
    const ctx = getContext();
    if (!ctx?.chat || ctx.chat.length === 0) { showToast('채팅 기록이 없어요'); return; }

    $('#mt-scan-btn').prop('disabled', true).text('⏳ 스캔 중...');
    try {
        const charName = ctx.name2 || 'char';
        const userName = ctx.name1 || 'user';
        const chatText = ctx.chat.slice(-60).map(m => `${m.name||(m.is_user?userName:charName)}: ${m.mes}`).join('\n');

        const result = await callWithProfile(buildPrompt(chatText, charName, userName, settings.outputLanguage, settings.theme));
        const match = result.match(/\[[\s\S]*?\]/);
        if (!match) { showToast('NPC를 찾지 못했어요'); return; }

        const extracted = JSON.parse(match[0]);
        mergeNPCs(ctx, extracted, 'wild');
        showToast(`✨ ${extracted.length}명 수집 완료`);
        renderSidebar();
        renderNPCList();

    } catch (err) {
        showToast(`오류: ${err.message}`);
    } finally {
        $('#mt-scan-btn').prop('disabled', false).text('🔍 전체 스캔');
    }
}

// ─── 주입 토글 ───────────────────────────────────────────────
function toggleInject(npcId) {
    const npc = getCurrentNPCById(npcId);
    if (!npc) return;
    npc.injected = !npc.injected;
    saveNPCData();
    updatePromptInjection();
    renderSidebar();
    renderNPCList();
    showToast(npc.injected ? `📌 ${npc.name} 주입됨` : `${npc.name} 주입 해제`);
}

// ─── NPC 삭제 ────────────────────────────────────────────────
function deleteNPC(npcId) {
    const ctx = getContext();
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
    const arr = settings.npcData[chatId] || [];
    const idx = arr.findIndex(n => n.id === npcId);
    if (idx !== -1) {
        const name = arr[idx].name;
        arr.splice(idx, 1);
        saveNPCData();
        updatePromptInjection();
        renderSidebar();
        renderNPCList();
        showToast(`${name} 삭제됨`);
    }
}

// ─── 프롬프트 주입 ───────────────────────────────────────────
function updatePromptInjection() {
    const ctx = getContext();
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
    const injected = (settings.npcData[chatId]||[]).filter(n => n.injected);
    const isKo = settings.outputLanguage === 'ko';

    if (injected.length === 0) {
        setExtensionPrompt(PROMPT_KEY, '', extension_prompt_types.AFTER_SCENARIO, 0);
        return;
    }

    const header = isKo ? '[주변 인물]' : '[Known NPCs]';
    const lines = injected.map(n => {
        const p = n.profile || {};
        return `• ${n.name}${p.age?` (${p.age})`:''}${p.gender?` ${p.gender}`:''}${p.occupation?` / ${p.occupation}`:''} — ${p.personality||''}`.trim();
    });
    setExtensionPrompt(PROMPT_KEY, `${header}\n${lines.join('\n')}`, extension_prompt_types.AFTER_SCENARIO, 0);
}

// ─── 수집 결과 팝업 ──────────────────────────────────────────
function showCollectResult(extracted, section='wild') {
    $('#mt-collect-result').remove();
    const isKo = settings.outputLanguage === 'ko';
    const sectionLabel = section === 'main' ? '📋 Main' : '🎒 Wild';

    const popup = $(`
    <div id="mt-collect-result">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <b style="color:#c8884a;font-size:0.88em;">✨ ${extracted.length}${isKo?'명 수집됨':' collected'} → ${sectionLabel}</b>
            <button id="mt-close-result" style="border:none;background:transparent;cursor:pointer;color:#7a6a5a;font-size:14px;padding:0;">✕</button>
        </div>
        ${extracted.map(n=>`
        <div style="padding:5px 0;border-bottom:1px solid #3d2b1a;">
            <div style="font-size:0.83em;font-weight:600;color:#e0d0bc;">${n.name}</div>
            <div style="font-size:0.72em;color:#7a6a5a;">${n.profile?.occupation||''} ${n.category?`· ${n.category}`:''}</div>
        </div>`).join('')}
        <button id="mt-open-panel" class="menu_button" style="width:100%;margin-top:8px;font-size:0.8em;">🎒 망태기 열기</button>
    </div>`);

    $('body').append(popup);
    popup.on('click', '#mt-close-result', () => popup.remove());
    popup.on('click', '#mt-open-panel', () => { popup.remove(); openMainPanel(); });
    setTimeout(() => popup.fadeOut(300, () => popup.remove()), 6000);
}

// ─── 범례 업데이트 ───────────────────────────────────────────
function updateLegend() {
    Object.entries(settings.colors).forEach(([rel, color]) => {
        $(`#mt-legend .mt-legend-item[data-rel="${rel}"] .mt-legend-dot`).css('background', color);
    });
}

// ─── 프로필로 API 호출 ───────────────────────────────────────
async function callWithProfile(prompt) {
    const ctx = getContext();
    const profileId = settings.profileId;

    if (profileId && ctx.ConnectionManagerRequestService) {
        const response = await const profiles = extension_settings.connectionManager?.profiles || [];
const profile = profiles.find(p => p.id === profileId);
const profileName = profile?.name || profileId;
ctx.ConnectionManagerRequestService.sendRequest(
    profileName,
            [{ role: 'user', content: prompt }],
            2000
        );
        return typeof response === 'string' ? response : (response?.content || response?.choices?.[0]?.message?.content || '');
    }

    // fallback: 현재 연결 모델로 호출
    const result = await ctx.generateRaw(prompt, '', true, true);
    return result || '';
}

// ─── 프롬프트 빌더 ───────────────────────────────────────────
function buildPrompt(text, charName, userName, lang, theme, isSheet=false) {
    const isKo = lang === 'ko';
    const themeNote = theme && theme !== '자동감지' ? `World theme: ${theme}. Match names and culture accordingly.` : '';
    const blacklist = (settings.nameBlacklist||[]).join(', ');
    const sourceNote = isSheet ? 'This is from character sheets and lore books, not chat.' : '';

    return `Analyze this roleplay content. Extract all named NPCs that are NOT "${charName}" and NOT "${userName}".
${themeNote}
${sourceNote}
${blacklist?`Avoid these names: ${blacklist}`:''}
Auto-classify each NPC: 조력자|적대자|민간인|공공기관|동물/영물|기타

Return ONLY valid JSON array:
[{"name":"exact name","relation":"both|char|user|unknown","category":"category","profile":{"fullname":"full name","age":"${isKo?'나이':'age'}","gender":"${isKo?'남성/여성/기타':'gender'}","occupation":"${isKo?'직업':'occupation'}","personality":"${isKo?'성격 2-3문장 TMI':'2-3 sentence TMI'}","special":"${isKo?'특기/능력':'abilities'}","relation_char":"${isKo?charName+'과 관계':'rel to '+charName}","relation_user":"${isKo?userName+'과 관계':'rel to '+userName}"}}]

If no NPCs found, return [].
Content:
${text}`;
}

function buildCreatePrompt(name, age, gender, occ, memo, cat, lang, theme, isRandom) {
    const isKo = lang === 'ko';
    const themeNote = theme && theme !== '자동감지' ? `World theme: ${theme}.` : '';
    const blacklist = (settings.nameBlacklist||[]).join(', ');
    const randomNote = isRandom ? 'Create a completely random interesting character.' : '';

    return `Create a detailed NPC profile for a roleplay character. ${themeNote} ${randomNote}
${name?`Name: ${name}`:`Generate an interesting unique name.${blacklist?` Avoid: ${blacklist}`:''}`}
${age?`Age: ${age}`:''}
${gender?`Gender: ${gender}`:''}
${occ?`Role/occupation: ${occ}`:''}
${memo?`Notes: ${memo}`:''}
Category: ${cat}

Return ONLY a JSON object:
{"name":"name","fullname":"full name with middle if western","age":"${isKo?'나이':'age'}","gender":"${isKo?'남성/여성/기타':'gender'}","occupation":"${isKo?'직업':'occupation'}","personality":"${isKo?'성격 2-3문장 TMI스럽게':'2-3 sentence interesting TMI'}","special":"${isKo?'특기/능력, 없으면 빈 문자열':'skills, empty if none'}"}`;
}

// ─── 이름 생성 fallback ──────────────────────────────────────
function generateName(theme, category) {
    if (category === '동물/영물') return ['루나','초코','구름','별이','달이'][Math.floor(Math.random()*5)];
    if (theme?.includes('한국')) return ['이수연','박지훈','김민서','정하은','최우진'][Math.floor(Math.random()*5)];
    if (theme?.includes('판타지')) return ['아르웬','카엘','제이린','소렐','미르'][Math.floor(Math.random()*5)];
    return ['Elara','Caspian','Isolde','Darian','Vesper'][Math.floor(Math.random()*5)];
}

// ─── NPC 병합 ────────────────────────────────────────────────
function mergeNPCs(ctx, extracted, section='wild') {
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
    if (!settings.npcData[chatId]) settings.npcData[chatId] = [];
    const existing = settings.npcData[chatId];

    extracted.forEach(n => {
        const dup = existing.find(e => e.name.toLowerCase() === n.name.toLowerCase());
        if (dup) {
            dup.profile = Object.assign({}, dup.profile, n.profile);
            if (n.relation !== 'unknown') dup.relation = n.relation;
            if (n.category) dup.category = n.category;
        } else {
            existing.push({
                id: `npc_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
                name: n.name,
                section,
                category: n.category || '기타',
                relation: n.relation || 'unknown',
                profile: n.profile || {},
                injected: false,
            });
        }
    });
    saveNPCData();
}

// ─── 데이터 관리 ─────────────────────────────────────────────
function exportData() {
    const blob = new Blob([JSON.stringify(settings.npcData, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mangtaegi_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📤 내보내기 완료');
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            settings.npcData = JSON.parse(ev.target.result);
            saveNPCData();
            renderSidebar?.();
            renderNPCList?.();
            showToast('📥 불러오기 완료');
        } catch { showToast('파일 형식 오류'); }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// ─── 유틸 ────────────────────────────────────────────────────
function getCurrentNPC() { return getCurrentNPCById(currentNPCId); }
function getCurrentNPCById(id) {
    const ctx = getContext();
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
    return (settings.npcData[chatId]||[]).find(n => n.id === id);
}

function saveNPCData() {
    extension_settings[EXT_NAME] = settings;
    saveSettingsDebounced();
}

function showToast(msg) {
    let t = $('#mt-toast');
    if (!t.length) t = $('<div id="mt-toast"></div>').appendTo('body');
    t.text(msg).css({opacity:1, transform:'translateX(-50%) translateY(0)'});
    clearTimeout(t.data('timer'));
    t.data('timer', setTimeout(() => t.css({opacity:0, transform:'translateX(-50%) translateY(8px)'}), 2500));
}

export async function init() { await mangInit(); }
setTimeout(mangInit, 500);
