// 지식창고 (Knowledge Vault) v1.0
// getContext 안전 처리 버전

(function() {
    'use strict';
    
    const MODULE_NAME = 'knowledge-vault';
    let settings = {
        profileName: '',
        enableTranslation: true,
        tokenLimit: 2000
    };
    let knowledgeData = {
        world: [],
        persona: []
    };
    
    // ===== 안전한 getContext =====
    function safeGetContext() {
        if (typeof getContext === 'function') {
            return getContext();
        }
        return null;
    }
    
    // ===== 저장소 관리 (채팅방별) =====
    const Storage = {
        getChatId() {
            const context = safeGetContext();
            return context?.chatId || context?.characterId || 'default';
        },
        
        init() {
            const chatId = this.getChatId();
            const key = MODULE_NAME + '_knowledge_' + chatId;
            const saved = localStorage.getItem(key);
            
            if (saved) {
                try {
                    knowledgeData = JSON.parse(saved);
                } catch (e) {
                    console.error('[지식창고] 데이터 로드 실패:', e);
                    knowledgeData = { world: [], persona: [] };
                }
            } else {
                knowledgeData = { world: [], persona: [] };
            }
            
            const savedSettings = localStorage.getItem(MODULE_NAME + '_settings');
            if (savedSettings) {
                try {
                    settings = JSON.parse(savedSettings);
                } catch (e) {
                    console.error('[지식창고] 설정 로드 실패:', e);
                }
            }
            
            console.log(`[지식창고] 채팅방 "${chatId}" 데이터 로드 완료`);
        },
        
        save() {
            const chatId = this.getChatId();
            const key = MODULE_NAME + '_knowledge_' + chatId;
            localStorage.setItem(key, JSON.stringify(knowledgeData));
            localStorage.setItem(MODULE_NAME + '_settings', JSON.stringify(settings));
        }
    };
    
    // ===== 레벨 처리 =====
    const Levels = {
        names: ['봉인', '이름', '소문', '핵심', '진실'],
        descriptions: {
            0: '봉인 - 개념 자체를 모름',
            1: '이름 - 명칭만 들어본 수준',
            2: '소문 - 대중적 정의, 얕은 지식',
            3: '핵심 - 작동 원리와 주요 특징',
            4: '진실 - 모든 세부사항과 비밀'
        }
    };
    
    // ===== API 호출 =====
    async function generateLevels(fullContent) {
        const prompt = `You are a knowledge compression system. Given the full detailed information below, create 4 progressively simpler versions:

Full Detail (Lv.4 - Expert):
${fullContent}

Generate these levels in English:
- Lv.0: (Empty - sealed knowledge)
- Lv.1: Only the name/term (2-5 words)
- Lv.2: Brief public definition (1 sentence, ~15 words)
- Lv.3: Core mechanism and key features (2-3 sentences, ~40 words)
- Lv.4: (Use the full content above)

Format as JSON:
{
  "lv0": "",
  "lv1": "...",
  "lv2": "...",
  "lv3": "...",
  "lv4": "..."
}`;

        try {
            const context = safeGetContext();
            if (!context || typeof context.generateRaw !== 'function') {
                throw new Error('generateRaw 함수 없음');
            }
            
            const result = await context.generateRaw(prompt, '', false, false);
            const match = result.match(/\{[\s\S]*?\}/);
            if (!match) throw new Error('JSON 응답 없음');
            
            const levels = JSON.parse(match[0]);
            levels.lv4 = fullContent;
            return levels;
            
        } catch (error) {
            console.error('[지식창고] 단계 생성 실패:', error);
            
            const sentences = fullContent.split(/[.!?]+/).filter(s => s.trim());
            const words = fullContent.split(' ').filter(w => w.trim());
            
            return {
                lv0: "",
                lv1: words.slice(0, 3).join(' '),
                lv2: sentences[0] || words.slice(0, 15).join(' '),
                lv3: sentences.slice(0, 2).join('. ') || words.slice(0, 40).join(' '),
                lv4: fullContent
            };
        }
    }
    
    // ===== UI: 설정 탭 =====
    function renderSettingsTab() {
        if ($('#kv-settings').length) return;
        
        const profiles = (typeof extension_settings !== 'undefined' && extension_settings?.connectionManager?.profiles) || [];
        const profileOptions = profiles.map(p => 
            `<option value="${p.name}" ${settings.profileName === p.name ? 'selected' : ''}>${p.name}</option>`
        ).join('');
        
        const html = `
        <div id="kv-settings" style="margin:20px 0;">
            <h3 style="margin:0 0 16px 0;">📚 지식창고 API 설정</h3>
            
            <div style="margin-bottom:20px;">
                <label style="display:block;margin-bottom:8px;font-size:14px;font-weight:600;">연결 프로필</label>
                <select id="kv-profile-select" class="text_pole" style="width:100%;">
                    <option value="">-- 프로필 선택 --</option>
                    ${profileOptions}
                </select>
                <p style="margin-top:8px;font-size:12px;color:#888;">
                    💡 Connection Manager에서 먼저 프로필을 생성하세요
                </p>
            </div>
            
            <div style="margin-bottom:20px;">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                    <input type="checkbox" id="kv-enable-translation" ${settings.enableTranslation ? 'checked' : ''}>
                    <span style="font-size:14px;font-weight:600;">한글 번역 활성화</span>
                </label>
                <p style="margin-top:4px;font-size:12px;color:#888;">
                    영어 원문을 한글로 실시간 번역 (한글 출력 유저만)
                </p>
            </div>
            
            <button id="kv-save-settings" class="menu_button" style="width:100%;">💾 설정 저장</button>
        </div>`;
        
        const container = $('#extensions_settings');
        if (container.length) {
            container.append(html);
            
            $('#kv-save-settings').on('click', () => {
                settings.profileName = $('#kv-profile-select').val();
                settings.enableTranslation = $('#kv-enable-translation').prop('checked');
                Storage.save();
                toastr.success('설정 저장됨', '지식창고');
            });
            
            console.log('[지식창고] 설정 탭 렌더링 완료');
        }
    }
    
    // ===== UI: 플로팅 모니터 =====
    function renderFloatingMonitor() {
        if ($('#kv-floating').length) return;
        
        const monitor = $(`
        <div id="kv-floating" style="
            position:fixed; bottom:80px; right:16px; z-index:9999;
            width:50px; height:50px; border-radius:50%;
            background:var(--SmartThemeBlurTintColor, rgba(99,102,241,0.9));
            border:2px solid rgba(99,102,241,0.5);
            box-shadow:0 4px 12px rgba(0,0,0,0.3);
            display:flex; align-items:center; justify-content:center;
            cursor:pointer; font-size:24px; transition:all 0.2s;
        ">
            📚
        </div>
        `);
        
        monitor.on('mouseenter', function() {
            $(this).css('transform', 'scale(1.1)');
        });
        
        monitor.on('mouseleave', function() {
            $(this).css('transform', 'scale(1)');
        });
        
        monitor.on('click', () => {
            openMainPanel();
        });
        
        $('body').append(monitor);
        console.log('[지식창고] 플로팅 모니터 렌더링 완료');
    }
    
    // ===== UI: 메인 패널 =====
    function openMainPanel() {
        if ($('#kv-main-panel').length) {
            $('#kv-main-panel').fadeIn(200);
            return;
        }
        
        const panel = $(`
        <div id="kv-main-panel" style="
            position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
            width:min(680px, 90vw); max-height:85vh; display:flex; flex-direction:column;
            background:var(--SmartThemeBlurTintColor, #1e1e2e);
            border:1px solid var(--SmartThemeBorderColor, #555);
            border-radius:14px; z-index:10000;
            box-shadow:0 16px 48px rgba(0,0,0,0.6);
            font-family:inherit; overflow:hidden;
        ">
            <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
                <h2 style="margin:0;font-size:18px;">📚 지식창고</h2>
                <button class="kv-close" style="border:none;background:transparent;cursor:pointer;color:#aaa;font-size:20px;padding:0;">✕</button>
            </div>
            
            <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">
                <button class="kv-tab active" data-tab="world" style="flex:1;padding:10px;border:none;background:white;color:#c17f5a;cursor:pointer;font-weight:600;border-bottom:2px solid #c17f5a;font-size:14px;">🌍 세계관</button>
                <button class="kv-tab" data-tab="persona" style="flex:1;padding:10px;border:none;background:transparent;color:#888;cursor:pointer;border-bottom:2px solid transparent;font-size:14px;">👤 페르소나</button>
            </div>
            
            <div class="kv-content" style="flex:1;overflow-y:auto;padding:20px;">
                <!-- 탭 내용 -->
            </div>
        </div>
        `);
        
        $('body').append(panel);
        
        panel.find('.kv-close').on('click', () => panel.fadeOut(200));
        
        panel.find('.kv-tab').on('click', function() {
            const tab = $(this).data('tab');
            panel.find('.kv-tab').css({
                'background': 'transparent',
                'color': '#888',
                'border-bottom-color': 'transparent',
                'font-weight': 'normal'
            });
            $(this).css({
                'background': 'white',
                'color': '#c17f5a',
                'border-bottom-color': '#c17f5a',
                'font-weight': '600'
            });
            renderTab(tab, panel);
        });
        
        renderTab('world', panel);
    }
    
    // ===== 탭 렌더링 =====
    function renderTab(tab, panel) {
        const content = panel.find('.kv-content');
        
        if (tab === 'world') {
            content.html(`
                <div style="margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.04);border-radius:10px;">
                    <h3 style="margin:0 0 12px 0;font-size:15px;">세계관 지식 추가</h3>
                    <input type="text" id="kv-world-title" placeholder="제목 (예: Nano Medicine)" class="text_pole" style="width:100%;margin-bottom:10px;box-sizing:border-box;">
                    <input type="text" id="kv-world-keywords" placeholder="키워드 (쉼표로 구분)" class="text_pole" style="width:100%;margin-bottom:10px;box-sizing:border-box;">
                    <textarea id="kv-world-content" placeholder="전체 내용 (영어로 작성)" class="textarea_compact" rows="5" style="width:100%;margin-bottom:10px;font-family:monospace;box-sizing:border-box;"></textarea>
                    <button id="kv-generate" class="menu_button" style="width:100%;">✨ 5단계 자동 생성</button>
                    
                    <div id="kv-preview" style="display:none;margin-top:16px;padding:12px;background:rgba(0,0,0,0.2);border-radius:8px;">
                        <h4 style="margin:0 0 10px 0;font-size:13px;">생성된 단계</h4>
                        ${[0,1,2,3,4].map(lv => `
                            <div style="margin-bottom:10px;">
                                <label style="display:block;margin-bottom:4px;font-size:12px;">
                                    <strong>Lv.${lv} ${Levels.names[lv]}</strong>
                                    <span style="margin-left:6px;color:#888;font-size:11px;">${Levels.descriptions[lv]}</span>
                                </label>
                                <textarea id="kv-lv${lv}" class="textarea_compact" rows="2" ${lv===0?'disabled':''} style="width:100%;font-size:12px;box-sizing:border-box;"></textarea>
                            </div>
                        `).join('')}
                        <div style="display:flex;gap:8px;">
                            <button id="kv-save" class="menu_button" style="flex:1;background:#10b981;">💾 저장</button>
                            <button id="kv-cancel" class="menu_button menu_button_icon" style="flex:1;">취소</button>
                        </div>
                    </div>
                </div>
                
                <div>
                    <h3 style="margin:0 0 12px 0;font-size:15px;">저장된 세계관 지식</h3>
                    <div id="kv-world-list"></div>
                </div>
            `);
            
            renderWorldList();
            
            $('#kv-generate').on('click', async () => {
                const title = $('#kv-world-title').val().trim();
                const content = $('#kv-world-content').val().trim();
                
                if (!title || !content) {
                    toastr.warning('제목과 내용을 입력하세요');
                    return;
                }
                
                const btn = $('#kv-generate');
                btn.prop('disabled', true).text('⏳ 생성 중...');
                
                try {
                    const levels = await generateLevels(content);
                    
                    $('#kv-preview').show();
                    $('#kv-lv0').val(levels.lv0);
                    $('#kv-lv1').val(levels.lv1);
                    $('#kv-lv2').val(levels.lv2);
                    $('#kv-lv3').val(levels.lv3);
                    $('#kv-lv4').val(levels.lv4);
                    
                    btn.text('✅ 생성 완료');
                    setTimeout(() => btn.prop('disabled', false).text('✨ 5단계 자동 생성'), 2000);
                    
                } catch (error) {
                    toastr.error('생성 실패: ' + error.message);
                    btn.prop('disabled', false).text('✨ 5단계 자동 생성');
                }
            });
            
            $(document).on('click', '#kv-save', () => {
                const knowledge = {
                    id: 'kv_' + Date.now(),
                    title: $('#kv-world-title').val().trim(),
                    keywords: $('#kv-world-keywords').val().split(',').map(k => k.trim()).filter(k => k),
                    levels: {
                        lv0: $('#kv-lv0').val(),
                        lv1: $('#kv-lv1').val(),
                        lv2: $('#kv-lv2').val(),
                        lv3: $('#kv-lv3').val(),
                        lv4: $('#kv-lv4').val()
                    },
                    createdAt: Date.now()
                };
                
                knowledgeData.world.push(knowledge);
                Storage.save();
                
                $('#kv-world-title').val('');
                $('#kv-world-keywords').val('');
                $('#kv-world-content').val('');
                $('#kv-preview').hide();
                
                renderWorldList();
                toastr.success('저장되었습니다');
            });
            
            $(document).on('click', '#kv-cancel', () => {
                $('#kv-preview').hide();
            });
            
        } else {
            // 페르소나 탭
            content.html(`
                <div style="margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.04);border-radius:10px;">
                    <h3 style="margin:0 0 12px 0;font-size:15px;">페르소나 지식 추가</h3>
                    <input type="text" id="kv-persona-title" placeholder="제목" class="text_pole" style="width:100%;margin-bottom:10px;box-sizing:border-box;">
                    <textarea id="kv-persona-content" placeholder="내용 (영어로 작성)" class="textarea_compact" rows="7" style="width:100%;margin-bottom:10px;font-family:monospace;box-sizing:border-box;"></textarea>
                    <button id="kv-persona-save" class="menu_button" style="width:100%;">💾 저장</button>
                </div>
                
                <div>
                    <h3 style="margin:0 0 12px 0;font-size:15px;">저장된 페르소나 지식</h3>
                    <div id="kv-persona-list"></div>
                </div>
            `);
            
            renderPersonaList();
            
            $('#kv-persona-save').on('click', () => {
                const title = $('#kv-persona-title').val().trim();
                const content = $('#kv-persona-content').val().trim();
                
                if (!title || !content) {
                    toastr.warning('제목과 내용을 입력하세요');
                    return;
                }
                
                knowledgeData.persona.push({
                    id: 'kv_' + Date.now(),
                    title,
                    content,
                    createdAt: Date.now()
                });
                
                Storage.save();
                
                $('#kv-persona-title').val('');
                $('#kv-persona-content').val('');
                
                renderPersonaList();
                toastr.success('저장되었습니다');
            });
        }
    }
    
    function renderWorldList() {
        const list = $('#kv-world-list');
        
        if (knowledgeData.world.length === 0) {
            list.html('<p style="text-align:center;color:#666;padding:24px 0;font-size:13px;">저장된 지식이 없습니다</p>');
            return;
        }
        
        list.html(knowledgeData.world.map(k => `
            <div style="padding:10px;margin-bottom:8px;background:rgba(255,255,255,0.04);border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
                <div style="flex:1;min-width:0;">
                    <strong style="font-size:14px;">${k.title}</strong>
                    <div style="font-size:11px;color:#888;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">키워드: ${k.keywords.join(', ')}</div>
                </div>
                <button class="kv-delete" data-id="${k.id}" style="padding:4px 10px;border:1px solid #555;background:transparent;color:#aaa;border-radius:6px;cursor:pointer;font-size:11px;margin-left:8px;flex-shrink:0;">🗑️</button>
            </div>
        `).join(''));
        
        list.find('.kv-delete').on('click', function() {
            const id = $(this).data('id');
            if (confirm('삭제하시겠습니까?')) {
                knowledgeData.world = knowledgeData.world.filter(k => k.id !== id);
                Storage.save();
                renderWorldList();
                toastr.success('삭제되었습니다');
            }
        });
    }
    
    function renderPersonaList() {
        const list = $('#kv-persona-list');
        
        if (knowledgeData.persona.length === 0) {
            list.html('<p style="text-align:center;color:#666;padding:24px 0;font-size:13px;">저장된 지식이 없습니다</p>');
            return;
        }
        
        list.html(knowledgeData.persona.map(k => `
            <div style="padding:10px;margin-bottom:8px;background:rgba(255,255,255,0.04);border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
                <div style="flex:1;min-width:0;">
                    <strong style="font-size:14px;">${k.title}</strong>
                    <div style="font-size:11px;color:#aaa;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${k.content.substring(0, 50)}...</div>
                </div>
                <button class="kv-delete-persona" data-id="${k.id}" style="padding:4px 10px;border:1px solid #555;background:transparent;color:#aaa;border-radius:6px;cursor:pointer;font-size:11px;margin-left:8px;flex-shrink:0;">🗑️</button>
            </div>
        `).join(''));
        
        list.find('.kv-delete-persona').on('click', function() {
            const id = $(this).data('id');
            if (confirm('삭제하시겠습니까?')) {
                knowledgeData.persona = knowledgeData.persona.filter(k => k.id !== id);
                Storage.save();
                renderPersonaList();
                toastr.success('삭제되었습니다');
            }
        });
    }
    
    // ===== 초기화 =====
    jQuery(() => {
        console.log('[지식창고] 로드 시작...');
        
        Storage.init();
        
        // 설정 탭
        setTimeout(() => {
            renderSettingsTab();
        }, 2000);
        
        // 플로팅 모니터
        setTimeout(() => {
            renderFloatingMonitor();
        }, 2500);
        
        // 마법봉 메뉴
        setTimeout(() => {
            if ($('#kv-wand-btn').length) return;
            
            const btn = $(`
                <div id="kv-wand-btn" class="list-group-item flex-container flexGap5 interactable" tabindex="0">
                    <span style="font-size:16px;">📚</span>
                    <span>지식창고</span>
                </div>
            `);
            
            btn.on('click', () => {
                $('#extensionsMenu').fadeOut(200);
                openMainPanel();
            });
            
            $('#extensionsMenu').append(btn);
            console.log('[지식창고] 마법봉 메뉴 추가 완료');
        }, 3000);
        
        console.log('[지식창고] 로드 완료 ✅');
    });
    
})();
