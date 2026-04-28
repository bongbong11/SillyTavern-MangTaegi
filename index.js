// 경로를 ../../ 로 수정했습니다.
import { getContext, extension_settings, renderExtensionTemplateAsync } from '../../extensions.js';
import { eventSource, event_types } from '../../script.js';

const EXT_NAME = 'SillyTavern-MangTaegi';
const EXT_ID = 'mangtaegi';

const defaultSettings = {
    apiType: 'gemini',
    apiKey: '',
    npcData: [],
    outputLanguage: 'ko'
};

let settings = {};

// CSS를 동적으로 로드하는 함수 추가
function loadCss() {
    if (document.getElementById('mt-style')) return;
    const link = document.createElement('link');
    link.id = 'mt-style';
    link.rel = 'stylesheet';
    link.href = `/extensions/${EXT_NAME}/style.css`;
    document.head.appendChild(link);
}

export async function init() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = { ...defaultSettings };
    }
    settings = extension_settings[EXT_NAME];

    loadCss(); // 초기화 시 CSS 로드

    const container = await renderExtensionTemplateAsync(EXT_NAME, EXT_ID, {});
    bindEvents(container);
    addCollectButton();

    eventSource.on(event_types.CHAT_COMPLETED, () => addCollectButton());
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, () => addCollectButton());

    console.log('[당신의 망태기] 로드 완료');
}

function addCollectButton() {
    if (document.getElementById('mt-collect-btn')) return;
    const sendButton = document.querySelector('#send_mess');
    if (!sendButton) return;

    const collectBtn = document.createElement('div');
    collectBtn.id = 'mt-collect-btn';
    collectBtn.className = 'fa-solid fa-box-archive system_button';
    collectBtn.title = '망태기에 담기 (NPC 수집)';
    collectBtn.style.marginRight = '5px';
    collectBtn.style.color = '#ffac33';
    
    sendButton.parentNode.insertBefore(collectBtn, sendButton);
    collectBtn.addEventListener('click', () => runCollection());
}

async function runCollection() {
    const context = getContext();
    if (!context.chat || context.chat.length === 0) return;
    
    const lastMessage = context.chat[context.chat.length - 1].mes;
    alert('망태기가 대화 내용을 분석하여 새로운 NPC를 찾고 있습니다...');
    
    const newNPC = {
        name: "김개똥",
        fullName: "김개똥 (Gae-Ddong Kim)",
        age: "25",
        gender: "남성",
        relation: "both",
        description: "주막 주인. 마법에 재능이 있음.",
        importance: 3
    };

    settings.npcData.push(newNPC);
    saveSettings(); // 설정 저장 함수 호출
    renderNPCList();
}

function saveSettings() {
    getContext().saveSettings();
}

function bindEvents(container) {
    container.querySelector('#mt-save-settings')?.addEventListener('click', () => {
        settings.apiKey = document.getElementById('mt-api-key').value;
        settings.apiType = document.getElementById('mt-api-type').value;
        saveSettings();
        alert('설정이 저장되었습니다.');
    });
    renderNPCList();
}

function renderNPCList() {
    const listContainer = document.getElementById('mt-npc-list');
    if (!listContainer) return;

    if (settings.npcData.length === 0) {
        listContainer.innerHTML = `<p style="font-size: 0.9em; color: #888;">수집된 데이터가 없습니다.</p>`;
        return;
    }

    listContainer.innerHTML = settings.npcData.map(npc => {
        let relClass = 'npc-rel-none';
        if (npc.relation === 'both') relClass = 'npc-rel-both';
        else if (npc.relation === 'char') relClass = 'npc-rel-char';
        else if (npc.relation === 'user') relClass = 'npc-rel-user';

        return `
            <div class="npc-item ${relClass}">
                <div class="npc-info-header">
                    <strong class="npc-name">${npc.name}</strong>
                    <span>(${npc.age}세, ${npc.gender})</span>
                </div>
                <div class="npc-tmi">${npc.description}</div>
            </div>
        `;
    }).join('');
}
// <-- 맨 밑에 있던 불필요한 } 제거 완료
