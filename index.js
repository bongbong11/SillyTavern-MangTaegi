import { getContext, extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types, saveChat } from '../../../../script.js';

const EXT_NAME = 'MangTaegi';

function init() {
    console.log('[MangTaegi] init');

    if (typeof extension_settings !== 'object') {
        console.error('[MangTaegi] extension_settings missing');
        return;
    }

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

    btn.title = 'MangTaegi';

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
            <h3 style="margin:0; color:#c17f5a;">📦 MangTaegi</h3>
            <span id="mb-close" style="cursor:pointer; font-size:28px;">&times;</span>
        </div>
        <hr>
        <div id="mb-content">Loaded successfully.</div>
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

$(document).ready(() => {
    try {
        init();
    } catch (e) {
        console.error('[MangTaegi] init failed:', e);
    }
});
