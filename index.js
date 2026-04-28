import { getContext, extension_settings, saveSettingsDebounced, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types, saveChat } from '../../../../script.js';

// 시스템 식별용 이름 (영문 필수)
const EXT_NAME = 'SillyTavern-MangTaegi';

const defaultSettings = {
    apiType: 'express',
    apiKey: '',
    vertexProject: '',
    vertexLocation: 'us-central1',
    vertexServiceAccount: '',
    displayLanguage: 'ko',
    npcData: {},
};

let settings = {};

// ─── INITIALIZATION ────────────────────────────────────────
async function init() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = { ...defaultSettings };
    }
    settings = extension_settings[EXT_NAME];
    if (!settings.npcData) settings.npcData = {};

    // UI 생성
    addPanelButton();
    injectPanel();

    // 실리태번 확장 설정창 연결
    const container = await renderExtensionTemplateAsync(EXT_NAME, 'mangtaegi', {});
    
    bindEvents(document.body);
    bindExtensionEvents(container);

    console.log('[MangTaegi] Extension loaded successfully.');
}

// ─── SIDEBAR BUTTON ────────────────────────────────────────
function addPanelButton() {
    if (document.getElementById('mt-sidebar-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'mt-sidebar-btn';
    btn.className = 'fa-solid fa-box-archive system_button';
    btn.title = '당신의 망태기 (MangTaegi)';
    
    const sidebar = document.getElementById('external_links_view') || document.querySelector('.side-buttons');
    if (sidebar) {
        sidebar.appendChild(btn);
    }

    btn.addEventListener('click', () => {
        const panel = document.getElementById('mt-main-panel');
        if (panel) panel.classList.toggle('show');
    });
}

// ─── POPUP PANEL ───────────────────────────────────────────
function injectPanel() {
    if (document.getElementById('mt-main-panel')) return;

    const panelHtml = `
    <div id="mt-main-panel" class="mt-panel">
        <div class="mt-header">
            <h3 class="mt-title">📦 당신의 망태기</h3>
            <div class="mt-header-btns">
                <i id="mt-refresh" class="fa-solid fa-rotate-right" title="Refresh"></i>
                <i id="mt-close" class="fa-solid fa-xmark"></i>
            </div>
        </div>
        <div class="mt-body">
            <div class="mt-tabs">
                <div class="mt-tab active" data-tab="list">NPC 목록</div>
                <div class="mt-tab" data-tab="settings">설정</div>
            </div>
            <div id="mt-content-list" class="mt-tab-content active">
                <div class="mt-empty">NPC 데이터를 불러오는 중...</div>
            </div>
            <div id="mt-content-settings" class="mt-tab-content">
                <div class="mt-settings-group">
                    <div class="mt-setting-row">
                        <label>API 유형</label>
                        <select id="mt-api-type" class="mt-select">
                            <option value="express">Gemini Express</option>
                            <option value="vertex">Google Vertex AI</option>
                        </select>
                    </div>
                    <div class="mt-setting-row">
                        <label>API Key</label>
                        <input type="password" id="mt-api-key" class="mt-input" placeholder="Enter API Key">
                    </div>
                    <button id="mt-save-settings" class="mt-btn-primary">설정 저장</button>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', panelHtml);
}

// ─── EVENT BINDING ──────────────────────────────────────────
function bindEvents(parent) {
    parent.querySelector('#mt-close')?.addEventListener('click', () => {
        document.getElementById('mt-main-panel').classList.remove('show');
    });

    parent.querySelectorAll('.mt-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const target = e.target.dataset.tab;
            parent.querySelectorAll('.mt-tab, .mt-tab-content').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            parent.querySelector(`#mt-content-${target}`)?.classList.add('active');
        });
    });

    parent.querySelector('#mt-save-settings')?.addEventListener('click', () => {
        settings.apiType = parent.querySelector('#mt-api-type').value;
        settings.apiKey = parent.querySelector('#mt-api-key').value;
        saveSettingsDebounced();
        alert('설정이 저장되었습니다. (Settings Saved)');
    });
}

function bindExtensionEvents(container) {
    container.querySelector('#mt-quick-save')?.addEventListener('click', () => {
        const npcName = container.querySelector('#mt-quick-input').value;
        if (npcName) {
            container.querySelector('#mt-quick-log').innerText = `${npcName} 등록 완료!`;
        }
    });
}

$(document).ready(() => {
    init().catch(console.error);
});
