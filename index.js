import { getContext, extension_settings, saveSettingsDebounced, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types, saveChat } from '../../../../script.js';

// 시스템 내부 식별자 (영문 통일)
const EXT_NAME = 'SillyTavern-MangTaegi';

const defaultSettings = {
    apiType: 'express',
    apiKey: '',
    npcData: {},
};

let settings = {};

async function init() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = { ...defaultSettings };
    }
    settings = extension_settings[EXT_NAME];

    // UI 구성요소 생성
    addPanelButton();
    injectPanel();

    // 실리태번 표준 확장 메뉴 연결
    const container = await renderExtensionTemplateAsync(EXT_NAME, 'mangtaegi', {});
    
    // 이벤트 바인딩
    bindEvents(document.body);
    bindExtensionEvents(container);

    console.log('[MangTaegi] Extension initialized without errors.');
}

function addPanelButton() {
    if (document.getElementById('mt-sidebar-btn')) return;
    const btn = document.createElement('div');
    btn.id = 'mt-sidebar-btn';
    btn.className = 'fa-solid fa-box-archive system_button';
    btn.title = 'MangTaegi (당신의 망태기)';
    
    const sidebar = document.getElementById('external_links_view') || document.querySelector('.side-buttons');
    if (sidebar) sidebar.appendChild(btn);

    btn.addEventListener('click', () => {
        document.getElementById('mt-main-panel')?.classList.toggle('show');
    });
}

function injectPanel() {
    if (document.getElementById('mt-main-panel')) return;
    const panelHtml = `
    <div id="mt-main-panel" class="mt-panel">
        <div class="mt-header">
            <h3 class="mt-title">📦 당신의 망태기</h3>
            <i id="mt-close" class="fa-solid fa-xmark"></i>
        </div>
        <div class="mt-body">
            <div class="mt-tabs">
                <div class="mt-tab active" data-tab="list">NPC 목록</div>
                <div class="mt-tab" data-tab="settings">설정</div>
            </div>
            <div id="mt-content-list" class="mt-tab-content active">
                <div class="mt-empty">데이터 로드 중...</div>
            </div>
            <div id="mt-content-settings" class="mt-tab-content">
                <input type="password" id="mt-api-key" class="mt-input" placeholder="API Key 입력">
                <button id="mt-save-settings" class="mt-btn-primary">설정 저장</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', panelHtml);
}

function bindEvents(parent) {
    parent.querySelector('#mt-close')?.addEventListener('click', () => {
        document.getElementById('mt-main-panel').classList.remove('show');
    });

    parent.querySelectorAll('.mt-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const target = e.target.dataset.tab;
            parent.querySelectorAll('.mt-tab, .mt-tab-content').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            parent.querySelector(\`#mt-content-\${target}\`)?.classList.add('active');
        });
    });

    parent.querySelector('#mt-save-settings')?.addEventListener('click', () => {
        settings.apiKey = parent.querySelector('#mt-api-key').value;
        saveSettingsDebounced();
        alert('설정이 저장되었습니다.');
    });
}

function bindExtensionEvents(container) {
    container.querySelector('#mt-quick-save')?.addEventListener('click', () => {
        const npcName = container.querySelector('#mt-quick-input').value;
        if (npcName) {
            container.querySelector('#mt-quick-log').innerText = npcName + ' 저장 완료!';
        }
    });
}

$(document).ready(() => init().catch(console.error));
