// 당신의 망태기 v1.0
// SillyTavern Extension - NPC 자동 수집 및 프로필 생성

// 실리태번 시스템 파일 로드 (경로 수정 완료)
import { getContext, extension_settings, saveSettingsDebounced, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types, saveChat } from '../../../../script.js';

const EXT_NAME = '당신의망태기';
const EXT_PATH = '/extensions/MangTaegi/'; // 저장소 이름과 일치시킴

// 기본 설정
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
let currentFilter = 'all';
let currentTab = 'list';
let activeModal = null;

// ─── 초기화 ────────────────────────────────────────────────
function init() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = { ...defaultSettings };
    }
    settings = extension_settings[EXT_NAME];
    if (!settings.npcData) settings.npcData = {};

    addPanelButton();
    injectPanel();
    bindEvents();

    console.log('[망태기] 확장이 성공적으로 로드되었습니다.');
}

// ─── UI 생성 및 삽입 ────────────────────────────────────────
function addPanelButton() {
    if (document.getElementById('mangtaegi-p-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'mangtaegi-p-btn';
    btn.className = 'fa-solid fa-box-archive system_button';
    btn.title = '당신의 망태기';
    
    // 실리태번 사이드바 하단 버튼들 옆에 붙이기
    const sidebar = document.getElementById('external_links_view') || document.querySelector('.side-buttons');
    if (sidebar) {
        sidebar.appendChild(btn);
    } else {
        // 사이드바를 못 찾을 경우 화면 왼쪽 상단에 강제 고정
        btn.style.position = 'fixed';
        btn.style.top = '10px';
        btn.style.left = '60px';
        btn.style.zIndex = '9999';
        document.body.appendChild(btn);
    }

    btn.addEventListener('click', () => {
        const panel = document.getElementById('mangtaegi-panel');
        if (panel) panel.classList.toggle('show');
    });
}

function injectPanel() {
    if (document.getElementById('mangtaegi-panel')) return;

    const panelHtml = `
    <div id="mangtaegi-panel" class="mb-panel">
        <div class="mb-header">
            <h3>📦 당신의 망태기</h3>
            <div class="mb-header-btns">
                <i id="mb-refresh" class="fa-solid fa-rotate-right" title="새로고침"></i>
                <i id="mb-close" class="fa-solid fa-xmark"></i>
            </div>
        </div>
        <div class="mb-body">
            <div class="mb-tabs">
                <div class="mb-tab active" data-tab="list">NPC 목록</div>
                <div class="mb-tab" data-tab="settings">설정</div>
            </div>
            <div id="mb-content-list" class="mb-tab-content active">
                <div class="mb-empty">로드 중...</div>
            </div>
            <div id="mb-content-settings" class="mb-tab-content">
                <div class="mb-setting-item">
                    <label>API 유형</label>
                    <select id="mb-api-type">
                        <option value="express">Gemini Express</option>
                        <option value="vertex">Google Vertex AI</option>
                    </select>
                </div>
                <div id="mb-row-apikey" class="mb-setting-item">
                    <label>API Key</label>
                    <input type="password" id="mb-api-key" placeholder="키를 입력하세요">
                </div>
                <button id="mb-save-settings" class="menu_button">설정 저장</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', panelHtml);
}

function bindEvents() {
    document.getElementById('mb-close')?.addEventListener('click', () => {
        document.getElementById('mangtaegi-panel').classList.remove('show');
    });

    document.querySelectorAll('.mb-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const target = e.target.dataset.tab;
            document.querySelectorAll('.mb-tab, .mb-tab-content').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(`mb-content-${target}`).classList.add('active');
        });
    });
}

// 실리태번 로드 시 실행
$(document).ready(() => {
    init();
});
