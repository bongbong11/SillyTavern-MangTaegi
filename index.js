import { getContext, extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types, saveChat } from '../../../../script.js';

const EXT_NAME = '당신의 망태기'; // ← json과 반드시 동일

function init() {
    console.log('[망태기] 로딩 시도...');

    // extension_settings 자체가 없을 경우 방어
    if (typeof extension_settings !== 'object') {
        console.error('[망태기] extension_settings 없음');
        return;
    }

    // 확장 설정 초기화
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = {
            apiType: 'express',
            apiKey: '',
            npcData: {}
        };
    }

    addPanelButton();
    injectPanel();
}

function addPanelButton() {
    if (document.getElementById('mangtaegi-p-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'mangtaegi-p-btn';
    btn.className = 'fa-solid fa-box-archive system_button';

    btn.style.cssText = `
        position: fixed;
        top: 15px;
        left: 80px;
        z-index: 99999;
        cursor: pointer;
        font-size: 24px;
        color: #c17f5a;
        display: block;
    `;

    btn.title = '당신의 망태기';

    btn.onclick = () => {
        const panel = document.getElementById('mangtaegi-panel');
        if (panel) panel.classList.toggle('show');
    };

    document.body.appendChild(btn);
}

function injectPanel() {
    if (document.getElementById('mangtaegi-panel')) return;

    const html = `
    <div id="mangtaegi-panel" style="
        display:none;
        position:fixed;
        right:20px;
        top:60px;
        width:320px;
        height:500px;
        background:#fff;
        z-index:99998;
        border:2px solid #c17f5a;
        border-radius:15px;
        padding:15px;
        color:#333;
        box-shadow:0 4px 15px rgba(0,0,0,0.3);
    ">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; color:#c17f5a;">📦 당신의 망태기</h3>
            <span id="mb-close" style="cursor:pointer; font-size:28px;">&times;</span>
        </div>
        <hr>
        <div id="mb-content">정상적으로 로드되었습니다!</div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    const style = document.createElement('style');
    style.innerHTML = `
        #mangtaegi-panel.show {
            display: block !important;
        }
    `;
    document.head.appendChild(style);

    const closeBtn = document.getElementById('mb-close');
    if (closeBtn) {
        closeBtn.onclick = () => {
            const panel = document.getElementById('mangtaegi-panel');
            if (panel) panel.classList.remove('show');
        };
    }
}

// DOM 준비 후 실행
$(document).ready(() => {
    try {
        init();
    } catch (e) {
        console.error('[망태기] init 실패:', e);
    }
});
