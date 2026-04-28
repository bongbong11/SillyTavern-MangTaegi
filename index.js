// 당신의 망태기 v1.2 - 최종 호환성 패치
import { getContext, extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types, saveChat } from '../../../../script.js';

// 에러 방지를 위해 내부에서 선언
const EXT_NAME = '당신의망태기';

function init() {
    console.log('[망태기] 확장을 로드하는 중...');
    
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = { apiType: 'express', apiKey: '', npcData: {} };
    }

    addPanelButton();
    injectPanel();
}

function addPanelButton() {
    if (document.getElementById('mangtaegi-p-btn')) return;
    const btn = document.createElement('div');
    btn.id = 'mangtaegi-p-btn';
    btn.className = 'fa-solid fa-box-archive system_button';
    // 버튼이 안 보일 수 없도록 강제 스타일 적용
    btn.style.cssText = "position:fixed; top:15px; left:75px; z-index:99999; cursor:pointer; font-size:24px; color:#c17f5a !important; display:block !important;";
    btn.title = '당신의 망태기';
    document.body.appendChild(btn);
    
    btn.onclick = (e) => {
        e.preventDefault();
        const panel = document.getElementById('mangtaegi-panel');
        if (panel) panel.classList.toggle('show');
    };
}

function injectPanel() {
    if (document.getElementById('mangtaegi-panel')) return;
    const html = `
    <div id="mangtaegi-panel" style="display:none; position:fixed; right:20px; top:60px; width:320px; height:500px; background:#fff; z-index:99998; border:2px solid #c17f5a; border-radius:15px; padding:15px; color:#333; box-shadow:0 4px 15px rgba(0,0,0,0.3);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; color:#c17f5a;">📦 당신의 망태기</h3>
            <span id="mb-close" style="cursor:pointer; font-size:28px; font-weight:bold;">&times;</span>
        </div>
        <hr style="border:0; border-top:1px solid #eee; margin:10px 0;">
        <div id="mb-content">정상적으로 연결되었습니다!</div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    
    const style = document.createElement('style');
    style.innerHTML = "#mangtaegi-panel.show { display: block !important; }";
    document.head.appendChild(style);
    
    document.getElementById('mb-close').onclick = () => {
        document.getElementById('mangtaegi-panel').classList.remove('show');
    };
}

// 실리태번이 완전히 준비된 후 실행
$(document).ready(() => {
    try {
        init();
    } catch (e) {
        console.error('[망태기] 초기화 에러:', e);
    }
});
