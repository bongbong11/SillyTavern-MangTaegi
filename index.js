import { getContext, extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types, saveChat } from '../../../../script.js';

const EXT_NAME = 'MangTaegi';

async function init() {
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

    // ✅ Extensions 패널에 UI 등록
    const container = await renderExtensionTemplateAsync(
        EXT_NAME,
        'mangtaegi',
        {}
    );

    setupUI(container);
}

function setupUI(container) {
    if (!container) {
        console.error('[MangTaegi] UI container 없음');
        return;
    }

    const input = container.querySelector('#mb-input');
    const saveBtn = container.querySelector('#mb-save');
    const log = container.querySelector('#mb-log');

    if (!saveBtn) {
        console.warn('[MangTaegi] 버튼 없음');
        return;
    }

    saveBtn.onclick = () => {
        const val = input.value?.trim();
        if (!val) return;

        extension_settings[EXT_NAME].npcData[val] = true;

        if (log) {
            log.innerText = `저장됨: ${val}`;
        }
    };
}

// 실행
$(document).ready(() => {
    init().catch(e => console.error('[MangTaegi] init failed:', e));
});
