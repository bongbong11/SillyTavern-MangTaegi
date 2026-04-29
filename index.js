// 당신의 망태기 v5.0
import { extension_settings, getContext } from '../../../extensions.js';
import { saveSettingsDebounced, eventSource, event_types, setExtensionPrompt, extension_prompt_types } from '../../../../script.js';

const EXT_NAME = 'SillyTavern-MangTaegi';
const PROMPT_KEY = 'mangtaegi_npc';
const CATEGORIES = ['조력자', '적대자', '민간인', '공공기관', '동물/영물', '기타'];
const THEMES = ['자동감지', '현대 (한국)', '현대 (해외)', '판타지'];
const RELATION_COLORS = { both: '#e8a87c', char: '#7cc4a8', user: '#7ca8e8', unknown: '#888' };
const RELATION_LABELS = { both: '둘 다 앎', char: '캐릭터만', user: '유저만', unknown: '관계 없음' };

const defaultSettings = {
    outputLanguage: 'ko',
    theme: '자동감지',
    nameBlacklist: ['Miller', 'Smith', 'Johnson', 'Chloe', 'Emma', 'Liam', 'Noah'],
    npcData: {},
};

let settings = {};
let currentSection = 'wild';
let currentCategory = 'all';
let currentView = 'list'; // list | detail | create
let currentNPCId = null;

// ─── 초기화 ──────────────────────────────────────────────────
async function mangInit() {
    if (!extension_settings[EXT_NAME]) extension_settings[EXT_NAME] = { ...defaultSettings };
    settings = extension_settings[EXT_NAME];
    if (!settings.npcData) settings.npcData = {};
    if (!settings.nameBlacklist) settings.nameBlacklist = [...defaultSettings.nameBlacklist];

    injectSettingsPanel();
    addToWandMenu();
    addCollectButton();

    const observer = new MutationObserver(() => addCollectButton());
    const chatEl = document.querySelector('#chat');
    if (chatEl) observer.observe(chatEl, { childList: true, subtree: false });

    console.log('[망태기] v5.0 로드 완료 ✅');
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
                    <label style="font-size:0.8em;color:#aaa;display:block;margin-bottom:5px;">기본 언어</label>
                    <select id="mt-lang-select" class="text_node" style="width:100%;box-sizing:border-box;">
                        <option value="ko" ${settings.outputLanguage==='ko'?'selected':''}>한국어</option>
                        <option value="en" ${settings.outputLanguage==='en'?'selected':''}>English</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:0.8em;color:#aaa;display:block;margin-bottom:5px;">세계관 테마</label>
                    <select id="mt-theme-select" class="text_node" style="width:100%;box-sizing:border-box;">
                        ${THEMES.map(t=>`<option value="${t}" ${settings.theme===t?'selected':''}>${t}</option>`).join('')}
                    </select>
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
        settings.outputLanguage = $('#mt-lang-select').val();
        settings.theme = $('#mt-theme-select').val();
        settings.nameBlacklist = $('#mt-blacklist').val().split(',').map(s=>s.trim()).filter(Boolean);
        extension_settings[EXT_NAME] = settings;
        saveSettingsDebounced();
        showToast('✅ 저장됨');
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

// ─── 메인 패널 ───────────────────────────────────────────────
function openMainPanel() {
    if ($('#mt-main-panel').length) { $('#mt-main-panel').remove(); return; }

    const panel = $(`
    <div id="mt-main-panel">
        <div class="mt-header">
            <div class="mt-header-title">🎒 당신의 망태기</div>
            <button class="mt-close-btn" id="mt-close-panel">✕</button>
        </div>
        <div class="mt-legend">
            <div class="mt-legend-item"><span class="mt-legend-dot" style="background:#e8a87c;"></span>둘 다 앎</div>
            <div class="mt-legend-item"><span class="mt-legend-dot" style="background:#7cc4a8;"></span>캐릭터만</div>
            <div class="mt-legend-item"><span class="mt-legend-dot" style="background:#7ca8e8;"></span>유저만</div>
            <div class="mt-legend-item"><span class="mt-legend-dot" style="background:#888;"></span>관계 없음</div>
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
                        <span class="mt-content-title">
                            <button class="mt-back-btn" id="mt-back-from-detail">← 목록</button>
                        </span>
                        <div style="display:flex;gap:6px;align-items:center;">
                            <select id="mt-cat-select" style="font-size:0.73em;background:#1e1510;border:1px solid #3d2b1a;color:#c8a878;border-radius:6px;padding:2px 6px;font-family:inherit;cursor:pointer;"></select>
                            <button id="mt-move-section" style="font-size:0.72em;padding:3px 7px;border-radius:6px;border:1px solid #3d2b1a;background:transparent;color:#7a6a5a;cursor:pointer;font-family:inherit;white-space:nowrap;"></button>
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
                        <span class="mt-content-title">
                            <button class="mt-back-btn" id="mt-back-from-create">← 목록</button>
                        </span>
                        <span style="font-size:0.8em;color:#c8a878;">✨ 인물 추가</span>
                    </div>
                    <div class="mt-create-body">
                        <div>
                            <label class="mt-field-label">이름 (비우면 자동 생성)</label>
                            <input type="text" id="mt-create-name" class="text_node" placeholder="홍길동" style="width:100%;box-sizing:border-box;">
                        </div>
                        <div>
                            <label class="mt-field-label">나이</label>
                            <input type="text" id="mt-create-age" class="text_node" placeholder="28" style="width:100%;box-sizing:border-box;">
                        </div>
                        <div>
                            <label class="mt-field-label">직업/종류</label>
                            <input type="text" id="mt-create-occ" class="text_node" placeholder="형사, 마법사, 길냥이..." style="width:100%;box-sizing:border-box;">
                        </div>
                        <div>
                            <label class="mt-field-label">카테고리</label>
                            <select id="mt-create-cat" class="text_node" style="width:100%;box-sizing:border-box;">
                                ${CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('')}
                            </select>
                        </div>
                        <button class="mt-create-submit" id="mt-create-confirm">✨ 생성하기</button>
                    </div>
                </div>

            </div>
        </div>
    </div>`);

    $('body').append(panel);
    renderSidebar();
    renderNPCList();

    // 이벤트
    panel.on('click', '#mt-close-panel', () => panel.remove());
    panel.on('click', '#mt-scan-btn', () => scanAll());
    panel.on('click', '#mt-add-btn', () => showView('create'));
    panel.on('click', '#mt-back-from-detail', () => showView('list'));
    panel.on('click', '#mt-back-from-create', () => showView('list'));

    panel.on('click', '.mt-tab', function() {
        const sec = $(this).data('section');
        const cat = $(this).data('category');
        if (sec !== undefined) currentSection = sec;
        if (cat !== undefined) currentCategory = cat;
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
        const ctx = getContext();
        const chatId = ctx?.chatId || ctx?.characterId || 'default';
        const npc = (settings.npcData[chatId]||[]).find(n => n.id === currentNPCId);
        if (npc) { npc.category = $(this).val(); saveNPCData(); renderSidebar(); }
    });

    panel.on('click', '#mt-move-section', () => {
        const ctx = getContext();
        const chatId = ctx?.chatId || ctx?.characterId || 'default';
        const npc = (settings.npcData[chatId]||[]).find(n => n.id === currentNPCId);
        if (npc) {
            npc.section = npc.section === 'main' ? 'wild' : 'main';
            saveNPCData();
            refreshDetail(currentNPCId);
            renderSidebar();
            showToast(`${npc.name} → ${npc.section==='main'?'Main':'Wild'}으로 이동`);
        }
    });

    panel.on('click', '#mt-create-confirm', () => createNPC());
}

// ─── 뷰 전환 ─────────────────────────────────────────────────
function showView(view) {
    const prev = currentView;
    currentView = view;

    const views = { list: '#mt-view-list', detail: '#mt-view-detail', create: '#mt-view-create' };

    // 이전 뷰 숨기기
    if (prev !== view) {
        const goingForward = view !== 'list';
        $(views[prev]).removeClass('visible').addClass(goingForward ? 'hidden-left' : 'hidden-right');
        setTimeout(() => {
            $(views[prev]).addClass('hidden-right').removeClass('hidden-left');
        }, 260);
    }

    // 새 뷰 보이기
    $(views[view]).removeClass('hidden-right hidden-left').addClass('visible');
}

// ─── 상세 뷰 열기 ────────────────────────────────────────────
function openDetail(npcId) {
    currentNPCId = npcId;
    refreshDetail(npcId);
    showView('detail');
}

function refreshDetail(npcId) {
    const ctx = getContext();
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
    const npc = (settings.npcData[chatId]||[]).find(n => n.id === npcId);
    if (!npc) return;

    const p = npc.profile || {};
    const isKo = settings.outputLanguage === 'ko';

    function row(label, val) {
        if (!val) return '';
        return `<div class="mt-detail-row">
            <div class="mt-detail-label">${label}</div>
            <div class="mt-detail-val">${val}</div>
        </div>`;
    }

    $('#mt-detail-body').html(`
        <div style="margin-bottom:12px;">
            <div style="font-size:1.05em;font-weight:700;color:#e8c99a;margin-bottom:3px;">${npc.name}</div>
            ${p.fullname&&p.fullname!==npc.name?`<div style="font-size:0.75em;color:#7a6a5a;">${p.fullname}</div>`:''}
            <div style="margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,0.06);font-size:0.72em;color:#c8a878;">
                    <span style="width:6px;height:6px;border-radius:50%;background:${RELATION_COLORS[npc.relation]||'#888'};"></span>
                    ${RELATION_LABELS[npc.relation]||npc.relation}
                </span>
                <span style="font-size:0.72em;color:#7a6a5a;">${npc.section==='main'?'📋 Main':'🎒 Wild'}</span>
                <span style="font-size:0.72em;color:#7a6a5a;">${npc.category||''}</span>
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

    // 카테고리 셀렉트
    $('#mt-cat-select').html(CATEGORIES.map(c=>`<option value="${c}" ${npc.category===c?'selected':''}>${c}</option>`).join(''));

    // 섹션 이동 버튼
    $('#mt-move-section').text(npc.section==='main'?'→ Wild':'→ Main');

    // 주입 버튼
    const injectBtn = $('#mt-detail-inject');
    injectBtn.text(npc.injected?'📌 주입 해제':'📌 롤플에 주입');
    injectBtn.toggleClass('active', !!npc.injected);
}

// ─── 사이드바 렌더링 ─────────────────────────────────────────
function renderSidebar() {
    const ctx = getContext();
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
    const npcs = settings.npcData[chatId] || [];

    const mainCount = npcs.filter(n => n.section === 'main').length;
    const wildCount = npcs.filter(n => n.section !== 'main').length;
    const injectedCount = npcs.filter(n => n.injected).length;

    const catCounts = {};
    CATEGORIES.forEach(c => { catCounts[c] = npcs.filter(n => n.category === c).length; });

    $('#mt-sidebar').html(`
        <div class="mt-sidebar-label">섹션</div>
        <button class="mt-tab ${currentSection==='all'&&currentCategory==='all'?'active':''}" data-section="all" data-category="all">전체 <span class="mt-tab-count">${npcs.length}</span></button>
        <button class="mt-tab ${currentSection==='main'?'active':''}" data-section="main" data-category="all">📋 Main <span class="mt-tab-count">${mainCount}</span></button>
        <button class="mt-tab ${currentSection==='wild'&&currentCategory==='all'?'active':''}" data-section="wild" data-category="all">🎒 Wild <span class="mt-tab-count">${wildCount}</span></button>
        <div class="mt-sidebar-label" style="margin-top:4px;">카테고리</div>
        ${CATEGORIES.map(c=>`<button class="mt-tab ${currentCategory===c?'active':''}" data-section="${currentSection}" data-category="${c}">${c} <span class="mt-tab-count">${catCounts[c]||0}</span></button>`).join('')}
        <div class="mt-sidebar-label" style="margin-top:4px;">주입</div>
        <button class="mt-tab ${currentSection==='injected'?'active':''}" data-section="injected" data-category="all">📌 주입 중 <span class="mt-tab-count">${injectedCount}</span></button>
    `);
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

    const titleMap = { all: '전체 인물', main: '📋 Main', wild: '🎒 Wild', injected: '📌 주입 중' };
    $('#mt-content-title').text(currentCategory !== 'all' ? currentCategory : (titleMap[currentSection]||'전체'));

    const container = $('#mt-npc-list');
    if (!container.length) return;

    if (npcs.length === 0) {
        container.html(`<div class="mt-empty">${
            currentSection==='main'?'📋 시트 기반 인물이 없어요' :
            currentSection==='injected'?'📌 주입된 인물이 없어요<br>인물 상세에서 주입 버튼을 눌러보세요' :
            '🎒 수집된 인물이 없어요<br>🎒 버튼이나 전체 스캔을 눌러보세요'
        }</div>`);
        return;
    }

    container.html(npcs.map(npc => `
        <div class="mt-npc-row" data-id="${npc.id}">
            <span class="mt-npc-dot" style="background:${RELATION_COLORS[npc.relation]||'#888'};"></span>
            <span class="mt-npc-name">${npc.name}</span>
            <span class="mt-npc-sub">${npc.profile?.occupation||npc.category||''}</span>
            <button class="mt-inject-btn ${npc.injected?'active':''}" data-id="${npc.id}">${npc.injected?'주입 중':'+ 주입'}</button>
        </div>`).join(''));
}

// ─── NPC 생성 ────────────────────────────────────────────────
async function createNPC() {
    const name = $('#mt-create-name').val().trim();
    const age = $('#mt-create-age').val().trim();
    const occ = $('#mt-create-occ').val().trim();
    const cat = $('#mt-create-cat').val();

    const btn = $('#mt-create-confirm');
    btn.prop('disabled', true).text('생성 중...');

    try {
        const ctx = getContext();
        const prompt = buildCreatePrompt(name, age, occ, cat, settings.outputLanguage, settings.theme);
        const result = await ctx.generateRaw(prompt, '', true, true);
        const match = result.match(/\{[\s\S]*?\}/);
        if (!match) throw new Error('생성 실패');

        const profile = JSON.parse(match[0]);
        const finalName = profile.name || name || generateName(settings.theme, cat);

        const chatId = ctx?.chatId || ctx?.characterId || 'default';
        if (!settings.npcData[chatId]) settings.npcData[chatId] = [];
        settings.npcData[chatId].push({
            id: `npc_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
            name: finalName,
            section: 'wild',
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
        // 입력 초기화
        $('#mt-create-name, #mt-create-age, #mt-create-occ').val('');

    } catch (err) {
        showToast(`오류: ${err.message}`);
    } finally {
        btn.prop('disabled', false).text('✨ 생성하기');
    }
}

// ─── 채팅창 수집 버튼 ────────────────────────────────────────
function addCollectButton() {
    if ($('#mt-collect-btn').length) return;
    const btn = $(`<button id="mt-collect-btn" title="망태기 - NPC 수집" style="background:transparent;border:none;cursor:pointer;font-size:20px;padding:0 5px;opacity:0.75;transition:opacity 0.15s;display:flex;align-items:center;">🎒</button>`);
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

    const btn = $('#mt-collect-btn');
    let frame = 0;
    const frames = ['🎒','✨','🎒','💫'];
    const anim = setInterval(() => { btn.text(frames[frame++%frames.length]); }, 280);
    btn.prop('disabled', true);

    try {
        const recent = ctx.chat.slice(-3);
        const charName = ctx.name2 || 'char';
        const userName = ctx.name1 || 'user';
        const text = recent.map(m => `${m.name||(m.is_user?userName:charName)}: ${m.mes}`).join('\n');

        const result = await ctx.generateRaw(buildPrompt(text, charName, userName, settings.outputLanguage, settings.theme), '', true, true);
        const match = result.match(/\[[\s\S]*?\]/);
        if (!match) { showToast('NPC를 찾지 못했어요'); return; }

        const extracted = JSON.parse(match[0]);
        if (extracted.length === 0) { showToast('새 NPC가 없어요'); return; }

        mergeNPCs(ctx, extracted, 'wild');
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
    if (!ctx?.chat || ctx.chat.length === 0) { showToast('채팅 기록이 없어요'); return; }

    $('#mt-scan-btn').prop('disabled', true).text('⏳ 스캔 중...');
    try {
        const charName = ctx.name2 || 'char';
        const userName = ctx.name1 || 'user';
        const chatText = ctx.chat.slice(-60).map(m => `${m.name||(m.is_user?userName:charName)}: ${m.mes}`).join('\n');

        const result = await ctx.generateRaw(buildPrompt(chatText, charName, userName, settings.outputLanguage, settings.theme), '', true, true);
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
    const ctx = getContext();
    const chatId = ctx?.chatId || ctx?.characterId || 'default';
    const npc = (settings.npcData[chatId]||[]).find(n => n.id === npcId);
    if (!npc) return;
    npc.injected = !npc.injected;
    saveNPCData();
    updatePromptInjection(ctx);
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
        updatePromptInjection(ctx);
        renderSidebar();
        renderNPCList();
        showToast(`${name} 삭제됨`);
    }
}

// ─── 프롬프트 주입 ───────────────────────────────────────────
function updatePromptInjection(ctx) {
    const chatId = (ctx||getContext())?.chatId || 'default';
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
function showCollectResult(extracted) {
    $('#mt-collect-result').remove();
    const isKo = settings.outputLanguage === 'ko';

    const popup = $(`
    <div id="mt-collect-result">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <b style="color:#c8884a;font-size:0.88em;">✨ ${extracted.length}${isKo?'명 수집됨':' collected'}</b>
            <button id="mt-close-result" style="border:none;background:transparent;cursor:pointer;color:#7a6a5a;font-size:14px;padding:0;">✕</button>
        </div>
        ${extracted.map(n=>`
        <div style="padding:5px 0;border-bottom:1px solid #3d2b1a;">
            <div style="font-size:0.83em;font-weight:600;color:#e0d0bc;">${n.name}</div>
            <div style="font-size:0.72em;color:#7a6a5a;">${n.profile?.occupation||''}</div>
        </div>`).join('')}
        <button id="mt-open-panel" class="menu_button" style="width:100%;margin-top:8px;font-size:0.8em;">🎒 망태기 열기</button>
    </div>`);

    $('body').append(popup);
    popup.on('click', '#mt-close-result', () => popup.remove());
    popup.on('click', '#mt-open-panel', () => { popup.remove(); openMainPanel(); });
    setTimeout(() => popup.fadeOut(300, () => popup.remove()), 6000);
}

// ─── 프롬프트 빌더 ───────────────────────────────────────────
function buildPrompt(text, charName, userName, lang, theme) {
    const isKo = lang === 'ko';
    const themeNote = theme && theme !== '자동감지' ? `World theme: ${theme}. Match names and culture accordingly.` : '';
    const blacklist = (settings.nameBlacklist||[]).join(', ');

    return `Analyze this roleplay chat. Extract all named NPCs that are NOT "${charName}" and NOT "${userName}".
${themeNote}
${blacklist?`Avoid these names: ${blacklist}`:''}
Auto-classify each NPC into one: 조력자|적대자|민간인|공공기관|동물/영물|기타

Return ONLY a valid JSON array:
[{"name":"exact name","relation":"both|char|user|unknown","category":"카테고리","profile":{"fullname":"full name","age":"${isKo?'나이':'age'}","gender":"${isKo?'남성/여성/기타':'gender'}","occupation":"${isKo?'직업':'occupation'}","personality":"${isKo?'성격 2-3문장 TMI스럽게':'2-3 sentence TMI'}","special":"${isKo?'특기/능력':'abilities'}","relation_char":"${isKo?charName+'과 관계':'relation to '+charName}","relation_user":"${isKo?userName+'과 관계':'relation to '+userName}"}}]

If no NPCs found, return [].
Chat:
${text}`;
}

function buildCreatePrompt(name, age, occ, cat, lang, theme) {
    const isKo = lang === 'ko';
    const themeNote = theme && theme !== '자동감지' ? `World theme: ${theme}.` : '';
    const blacklist = (settings.nameBlacklist||[]).join(', ');
    return `Create a detailed NPC profile. ${themeNote}
${name?`Name: ${name}`:`Generate an interesting name.${blacklist?` Avoid: ${blacklist}`:''}`}
${age?`Age: ${age}`:''}${occ?`\nRole: ${occ}`:''}
Category: ${cat}
Return ONLY a JSON object:
{"name":"name","fullname":"full name","age":"${isKo?'나이':'age'}","gender":"${isKo?'남성/여성/기타':'gender'}","occupation":"${isKo?'직업':'occupation'}","personality":"${isKo?'성격 2-3문장 TMI':'2-3 sentence TMI'}","special":"${isKo?'특기':'skills'}"}`;
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
            renderSidebar();
            renderNPCList();
            showToast('📥 불러오기 완료');
        } catch { showToast('파일 형식 오류'); }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// ─── 유틸 ────────────────────────────────────────────────────
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
