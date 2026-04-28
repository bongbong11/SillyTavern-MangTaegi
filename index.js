import { getContext, extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';

const EXT_NAME = 'SillyTavern-MangTaegi';
const EXT_ID = 'mangtaegi';

const defaultSettings = {
    apiType: 'gemini', // 재미나이, 버텍스, 익스프레스 등
    apiKey: '',
    npcData: [], // 수집된 NPC 목록
    outputLanguage: 'ko' // 기본 출력 언어
};

let settings = {};

// 1. 초기화 및 매직봉 메뉴 등록
export async function init() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = { ...defaultSettings };
    }
    settings = extension_settings[EXT_NAME];

    // 매직봉(확장 탭) 메뉴 등록
    const container = await renderExtensionTemplateAsync(EXT_NAME, EXT_ID, {});
    
    // 설정 저장 및 UI 이벤트 바인딩
    bindEvents(container);

    // 채팅창 하단 수집 버튼 생성
    addCollectButton();

    // 메시지 렌더링 시마다 버튼 유지
    eventSource.on(event_types.CHAT_COMPLETED, () => addCollectButton());
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, () => addCollectButton());

    console.log('[당신의 망태기] 로드 완료');
}

// 2. 채팅창 하단 수집 버튼
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

// 3. NPC 수집 및 분석 로직 (기획안 기반)
async function runCollection() {
    const context = getContext();
    const lastMessage = context.chat[context.chat.length - 1].mes;
    
    alert('망태기가 대화 내용을 분석하여 새로운 NPC를 찾고 있습니다...');
    
    // 실제 구현 시 여기서 API를 호출하여 lastMessage에서 NPC 이름/특징 추출
    // 아래는 예시 데이터 삽입 로직
    const newNPC = {
        name: "김개똥", // 롤플레잉 출력 그대로
        fullName: "김개똥 (Gae-Ddong Kim)",
        age: "25",
        gender: "남성",
        relation: "both", // char, user, both, none
        description: "주막 주인. 마법에 재능이 있음.",
        importance: 3
    };

    settings.npcData.push(newNPC);
    context.saveSettings();
    renderNPCList();
}

// 4. UI 이벤트 및 리스트 렌더링
function bindEvents(container) {
    container.querySelector('#mt-save-settings')?.addEventListener('click', () => {
        settings.apiKey = container.querySelector('#mt-api-key').value;
        settings.apiType = container.querySelector('#mt-api-type').value;
        getContext().saveSettings();
        alert('설정이 저장되었습니다.');
    });

    renderNPCList();
}

function renderNPCList() {
    const listContainer = document.getElementById('mt-npc-list');
    if (!listContainer) return;

    listContainer.innerHTML = settings.npcData.map(npc => {
        // 기획안 3번: 관계에 따른 색상 구분
        let color = '#888'; // 회색 (남남)
        if (npc.relation === 'both') color = '#ffdf00'; // 둘 다 알면 노랑/중립
        if (npc.relation === 'char') color = '#2ecc71'; // 캐릭터만 알면 초록
        if (npc.relation === 'user') color = '#3498db'; // 유저만 알면 파란

        return `
            <div class="npc-item" style="border-left: 5px solid ${color}; margin-bottom: 5px; padding: 5px; background: rgba(0,0,0,0.2);">
                <strong>${npc.name}</strong> (${npc.age}세, ${npc.gender})
                <div style="font-size: 0.8em; color: #ccc;">${npc.description}</div>
            </div>
        `;
    }).join('');
}
