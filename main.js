const tagOrder = ['自己製作', 'Gemini 生成'];
const defaultPrompts = [
    {
        id: 'prompt-chinese-translation-expert',
        tag: '自己製作',
        title: '中文意譯專家',
        content: '你是一個中文意譯專家，你會在盡可能尊重原意的前提下，依照排版要求將使用者提供的內容改寫為繁體中文。在開始協助使用者前，請先跟使用者說明如何跟你互動。\n\n## 中文文案排版指北\n- 中英文之間需要增加空格\n- 中文與數字之間需要增加空格\n- 數字與單位之間需要增加空格\n- 全形標點與其他字符之間不加空格\n- 不重複使用標點符號\n- 使用全形中文標點\n- 數字使用半形字符\n- 遇到完整的英文整句、特殊名詞，其內容使用半形標點。\n- 專有名詞使用正確的大小寫\n- 不要使用不道地的縮寫。'
    },
    {
        id: 'prompt-email-assistant',
        tag: 'Gemini 生成',
        title: '專業郵件助理',
        content: '你是一個專業的郵件助理，專門協助使用者撰寫、潤飾和回覆各類型的商務郵件，確保語氣專業且表達清晰。你會根據使用者提供的關鍵資訊，快速生成符合情境的草稿。接下來請你跟使用者說明如何跟你互動。'
    },
    {
        id: 'prompt-recipe-generator',
        tag: 'Gemini 生成',
        title: '快速食譜生成器',
        content: '你是一個快速食譜生成器，能根據使用者提供的食材、烹飪時間和偏好，快速生成簡單美味的食譜，特別擅長五分鐘內完成的料理。接下來請你跟使用者說明如何跟你互動。'
    },
    {
        id: 'prompt-science-explainer',
        tag: 'Gemini 生成',
        title: '科普知識解說員',
        content: '你是一個科普知識解說員，擅長將複雜的科學概念（如量子物理、宇宙學）用簡單易懂的語言解釋給非專業人士，並樂於回答相關問題。接下來請你跟使用者說明如何跟你互動。'
    },
    {
        id: 'prompt-travel-planner',
        tag: 'Gemini 生成',
        title: '旅行行程規劃師',
        content: '你是一個旅行行程規劃師，能根據使用者的目的地、天數、預算、喜好和交通方式，量身打造詳細且具吸引力的旅行行程。接下來請你跟使用者說明如何跟你互動。'
    },
    {
        id: 'prompt-home-fitness-coach',
        tag: 'Gemini 生成',
        title: '居家健身教練',
        content: '你是一個居家健身教練，專為初學者設計無需器材或僅需簡單器材的居家健身菜單，並提供動作指導和注意事項。接下來請你跟使用者說明如何跟你互動。'
    },
    {
        id: 'prompt-language-tutor',
        tag: 'Gemini 生成',
        title: '語言學習導師',
        content: '你是一個語言學習導師，能為使用者提供從零開始學習新語言的有效策略、資源推薦和實用練習方法。接下來請你跟使用者說明如何跟你互動。'
    },
    {
        id: 'prompt-creative-writer',
        tag: 'Gemini 生成',
        title: '創意寫作夥伴',
        content: '你是一個創意寫作夥伴，能幫助使用者構思、撰寫詩歌、短篇故事或任何創意文本，提供靈感和文字潤飾的建議。接下來請你跟使用者說明如何跟你互動。'
    },
    {
        id: 'prompt-copywriter',
        tag: 'Gemini 生成',
        title: '產品文案撰寫師',
        content: '你是一個產品文案撰寫師，專門為各類產品撰寫吸引人的描述、賣點和行銷文案，幫助使用者突出產品特色。接下來請你跟使用者說明如何跟你互動。'
    },
    {
        id: 'prompt-interview-coach',
        tag: 'Gemini 生成',
        title: '面試準備教練',
        content: '你是一個面試準備教練，能提供常見面試問題的有效應對策略、範例回答和模擬練習，幫助使用者自信應對各種面試情境。接下來請你跟使用者說明如何跟你互動。'
    },
    {
        id: 'prompt-tech-troubleshooter',
        tag: 'Gemini 生成',
        title: '科技故障排除專家',
        content: '你是一個科技故障排除專家，能提供詳細的步驟和建議，幫助使用者解決常見的電子設備或網路連線問題。接下來請你跟使用者說明如何跟你互動。'
    }

];

function getPromptData(id) {
    const defaultData = defaultPrompts.find(p => p.id === id);
    const storedData = localStorage.getItem(`gpts_prompt_${id}`);
    if (storedData) {
        try {
            const parsedData = JSON.parse(storedData);
            if (parsedData && parsedData.id === id) {
                return parsedData;
            }
        } catch (e) {
            console.error("Error parsing localStorage data for", id, e);
            localStorage.removeItem(`gpts_prompt_${id}`);
        }
    }
    return defaultData;
}

function savePromptToLocalStorage() {
    const modal = document.getElementById('promptModal');
    const currentPromptId = modal.dataset.currentPromptId;
    if (!currentPromptId) return;

    const titleInput = document.getElementById('modalPromptTitle');
    const textarea = document.getElementById('modalPromptTextarea');

    const updatedData = {
        id: currentPromptId,
        title: titleInput.value,
        content: textarea.value
    };
    localStorage.setItem(`gpts_prompt_${currentPromptId}`, JSON.stringify(updatedData));

    const cardElement = document.querySelector(`.prompt-card[data-prompt-id="${currentPromptId}"]`);
    if (cardElement) {
        cardElement.querySelector('.card-title').textContent = titleInput.value;
    }
}

function resetPrompt() {
    const modal = document.getElementById('promptModal');
    const currentPromptId = modal.dataset.currentPromptId;
    if (!currentPromptId) return;

    const defaultData = defaultPrompts.find(p => p.id === currentPromptId);
    if (defaultData) {
        document.getElementById('modalPromptTitle').value = defaultData.title;
        document.getElementById('modalPromptTextarea').value = defaultData.content;
        localStorage.removeItem(`gpts_prompt_${currentPromptId}`);

        const cardElement = document.querySelector(`.prompt-card[data-prompt-id="${currentPromptId}"]`);
        if (cardElement) {
            cardElement.querySelector('.card-title').textContent = defaultData.title;
        }
    }
}

function loadCards() {
    const container = document.getElementById('promptCardsContainer');
    container.innerHTML = '';

    const promptsByTag = defaultPrompts.reduce((acc, prompt) => {
        const tag = prompt.tag;
        if (!acc[tag]) {
            acc[tag] = [];
        }
        acc[tag].push(prompt);
        return acc;
    }, {});

    tagOrder.forEach(tag => {
        if (promptsByTag[tag]) {
            const tagHeader = document.createElement('h2');
            tagHeader.className = 'mt-5 mb-4 fs-3';
            tagHeader.textContent = tag;
            container.appendChild(tagHeader);

            const groupContainer = document.createElement('div');
            groupContainer.className = 'd-flex flex-wrap gap-3 mb-4';

            promptsByTag[tag].forEach(defaultPrompt => {
                const currentData = getPromptData(defaultPrompt.id);

                const card = document.createElement('div');
                card.className = 'prompt-card';
                card.dataset.promptId = currentData.id;

                const link = document.createElement('a');
                link.href = '#';
                link.className = 'card-body';
                link.onclick = (e) => {
                    e.preventDefault();
                    openModal(currentData.id);
                };

                const title = document.createElement('p');
                title.className = 'card-title';
                title.textContent = currentData.title;

                link.appendChild(title);
                card.appendChild(link);
                groupContainer.appendChild(card);
            });

            container.appendChild(groupContainer);
        }
    });
}

function openModal(promptId) {
    const data = getPromptData(promptId);
    if (!data) return;

    const modal = document.getElementById('promptModal');
    const modalTitleInput = document.getElementById('modalPromptTitle');
    const modalTextarea = document.getElementById('modalPromptTextarea');

    modalTitleInput.value = data.title;
    modalTextarea.value = data.content;
    modal.dataset.currentPromptId = promptId;

    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const isEditMode = mode === 'edit';

    modalTitleInput.readOnly = !isEditMode;
    modalTextarea.readOnly = !isEditMode;

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

function openChatGptWithModalContent() {
    const textarea = document.getElementById('modalPromptTextarea');
    const encodedValue = encodeURIComponent(textarea.value);
    const url = `http://chatgpt.com/?q=${encodedValue}`;
    window.open(url, '_blank');
}

function updateLink() {
    const textarea = document.getElementById('promptTextarea');
    const link = document.getElementById('chatgptLink');
    const encodedValue = encodeURIComponent(textarea.value);
    link.href = `http://chatgpt.com/?q=${encodedValue}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const resetBtn = document.getElementById('resetPromptBtn');
    if (mode !== 'edit') {
        resetBtn.parentElement.style.display = 'none';
        document.getElementById('promptTextarea').parentElement.style.display = 'none';
        document.getElementById('chatgptLink').style.display = 'none';
    }

    loadCards();
    updateLink();

    resetBtn.addEventListener('click', resetPrompt);
    document.getElementById('useGptsFromModalBtn').addEventListener('click', openChatGptWithModalContent);
    document.getElementById('copyPromptBtn').addEventListener('click', function () {
        const textarea = document.getElementById('modalPromptTextarea');
        if (textarea) {
            navigator.clipboard.writeText(textarea.value)
                .then(() => {
                    // 可選：顯示提示訊息
                    const btn = document.getElementById('copyPromptBtn');
                    btn.textContent = '已複製';
                    setTimeout(() => { btn.textContent = '複製'; }, 1200);
                });
        }
    });
    document.getElementById('useChatwiseGptsFromModalBtn').addEventListener('click', function () {
        const textarea = document.getElementById('modalPromptTextarea');
        if (textarea) {
            const encodedValue = encodeURIComponent(textarea.value);
            const url = `chatwise://chat?instruction=${encodedValue}`;
            window.open(url, '_blank');
        }
    });
});
