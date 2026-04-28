// 당신의 망태기 v1.1 - 경로 및 함수 에러 수정본
import { getContext, extension_settings, saveSettings, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types, saveChat } from '../../../../script.js';

const EXT_NAME = '당신의망태기';

function init() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = { apiType: 'express', apiKey: '', npcData: {} };
    }
    addPanelButton();
    injectPanel();
    console.log('[망태기] 구동 시작!');
}

function addPanelButton() {
    if (document.getElementById('mangtaegi-p-btn')) return;
    const btn = document.createElement('div');
    btn.id = 'mangtaegi-p-btn';
    btn.className = 'fa-solid fa-box-archive system_button';
    btn.style.cssText = "position:fixed; top:15px; left:70px; z-index:10001; cursor:pointer; font-size:22px; color:#c17f5a;";
    btn.title = '당신의 망태기';
    document.body.appendChild(btn);
    btn.onclick = () => document.getElementById('mangtaegi-panel').classList.toggle('show');
}

function injectPanel() {
    if (document.getElementById('mangtaegi-panel')) return;
    const html = `
    <div id="mangtaegi-panel" class="mb-panel" style="display:none; position:fixed; right:20px; top:60px; width:320px; height:500px; background:#fff; z-index:10000; border:2px solid #c17f5a; border-radius:15px; padding:15px; color:#333; box-shadow:0 4px 15px rgba(0,0,0,0.2);">
        <div style="display:flex; justify-content:space-between;">
            <h3 style="margin:0;">📦 당신의 망태기</h3>
            <span id="mb-close" style="cursor:pointer; font-size:24px;">&times;</span>
        </div>
        <hr>
        <div id="mb-content">정상적으로 로드되었습니다!</div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const style = document.createElement('style');
    style.innerHTML = "#mangtaegi-panel.show { display: block !important; }";
    document.head.appendChild(style);
    document.getElementById('mb-close').onclick = () => document.getElementById('mangtaegi-panel').classList.remove('show');
}

$(document).ready(() => init());
