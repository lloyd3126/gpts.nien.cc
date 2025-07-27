let tagOrder = ['使用中', 'Gemini 生成']; // 預設值，會從 YAML 覆蓋
let defaultPrompts = [];

// 從 data.yml 載入提示詞資料
async function loadPromptsFromYaml() {
    try {
        const response = await fetch('data.yml');
        const yamlText = await response.text();
        const yamlData = jsyaml.load(yamlText);

        // 從 YAML 讀取標籤順序
        if (yamlData.metadata && yamlData.metadata.tagOrder) {
            tagOrder = yamlData.metadata.tagOrder;
        }

        // 轉換 YAML 資料為應用程式格式
        const prompts = [];

        for (const [promptKey, promptData] of Object.entries(yamlData.prompt)) {
            const metadata = promptData.metadata;
            const activeVersion = metadata.activeVersion || 'v1';
            const versionData = promptData[activeVersion];

            if (!versionData) {
                console.warn(`找不到 ${promptKey} 的版本 ${activeVersion}，跳過此提示詞`);
                continue;
            }

            // 檢查 draft 欄位，如果是草稿則不顯示
            const isDraft = metadata.draft === true;
            if (isDraft) {
                continue; // 跳過草稿狀態的提示詞
            }

            prompts.push({
                id: promptKey,
                tag: metadata.tag,
                author: metadata.author,
                title: metadata.displayTitle || versionData.name,
                content: versionData.content,
                draft: isDraft
            });
        }

        defaultPrompts = prompts;
        return prompts;
    } catch (error) {
        console.error('載入 data.yml 時發生錯誤:', error);
        // 如果載入失敗，使用空陣列
        defaultPrompts = [];
        return [];
    }
}

function getPromptData(id) {
    const defaultData = defaultPrompts.find(p => p.id === id);
    const storedData = localStorage.getItem(`gpts_prompt_${id}`);
    if (storedData) {
        try {
            const parsedData = JSON.parse(storedData);
            if (parsedData && parsedData.id === id) {
                return { ...defaultData, ...parsedData };
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
    const authorInput = document.getElementById('modalPromptAuthor');
    const textarea = document.getElementById('modalPromptTextarea');

    const updatedData = {
        id: currentPromptId,
        title: titleInput.value,
        author: authorInput.value,
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
        document.getElementById('modalPromptAuthor').value = defaultData.author;
        document.getElementById('modalPromptTextarea').value = defaultData.content;
        localStorage.removeItem(`gpts_prompt_${currentPromptId}`);

        const cardElement = document.querySelector(`.prompt-card[data-prompt-id="${currentPromptId}"]`);
        if (cardElement) {
            cardElement.querySelector('.card-title').textContent = defaultData.title;
        }
    }
}

async function loadCards() {
    // 如果還沒有載入提示詞資料，先載入
    if (defaultPrompts.length === 0) {
        await loadPromptsFromYaml();
    }

    const container = document.getElementById('promptCardsContainer');
    const loadingIndicator = document.getElementById('loadingIndicator');

    // 隱藏載入指示器
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }

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
            tagHeader.className = 'mt-2 mb-3 fs-4';
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
    // 檢查螢幕寬度，決定使用 modal 還是 3:9 版面
    const isDesktop = window.innerWidth >= 768;

    if (isDesktop) {
        openPromptDetail(promptId);
    } else {
        openPromptModal(promptId);
    }
}

function openPromptDetail(promptId) {
    const data = getPromptData(promptId);
    if (!data) return;

    // 創建詳情區域的 HTML 內容
    const detailHTML = `
        <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0" id="promptDetailTitle">提示詞詳情</h5>
                <button type="button" class="btn-close" onclick="closePromptDetail()" aria-label="Close"></button>
            </div>
            <div class="card-body">
                <div class="mb-3">
                    <label for="detailPromptTitle" class="form-label">標題：</label>
                    <input type="text" class="form-control" id="detailPromptTitle" readonly>
                </div>
                <div class="mb-3">
                    <label for="detailPromptAuthor" class="form-label">作者：</label>
                    <input type="text" class="form-control" id="detailPromptAuthor" readonly>
                </div>
                <div class="mb-3">
                    <label for="detailPromptTextarea" class="form-label">內容：</label>
                    <textarea class="form-control" id="detailPromptTextarea" rows="15" readonly></textarea>
                </div>
            </div>
            <div class="card-footer d-flex justify-content-between">
                <div>
                    <button type="button" class="btn btn-danger d-none" id="resetDetailPromptBtn">重置</button>
                </div>
                <div>
                    <button type="button" class="btn btn-secondary me-2" id="copyDetailPromptBtn">複製</button>
                    <button type="button" class="btn btn-secondary me-2" id="useGptsFromDetailBtn">在 ChatGPT 使用</button>
                    <button type="button" class="btn btn-secondary" id="useChatwiseGptsFromDetailBtn">在 ChatWise 使用</button>
                </div>
            </div>
        </div>
    `;

    // 切換版面配置
    const cardsContainer = document.getElementById('promptCardsContainer');
    const detailContainer = document.getElementById('promptDetailContainer');

    // 設定詳情區域內容
    detailContainer.innerHTML = detailHTML;

    // 更新版面配置
    cardsContainer.className = 'col-3';
    detailContainer.className = 'col-9';

    // 更新詳情區域的內容
    document.getElementById('detailPromptTitle').value = data.title;
    document.getElementById('detailPromptAuthor').value = data.author;
    document.getElementById('detailPromptTextarea').value = data.content;

    // 儲存當前提示詞 ID
    detailContainer.dataset.currentPromptId = promptId;

    // 檢查是否為編輯模式
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const isEditMode = mode === 'edit';

    document.getElementById('detailPromptTitle').readOnly = !isEditMode;
    document.getElementById('detailPromptAuthor').readOnly = !isEditMode;
    document.getElementById('detailPromptTextarea').readOnly = !isEditMode;

    if (isEditMode) {
        document.getElementById('resetDetailPromptBtn').classList.remove('d-none');
    }

    // 重新綁定事件監聽器
    bindDetailEventListeners();
}

function closePromptDetail() {
    const cardsContainer = document.getElementById('promptCardsContainer');
    const detailContainer = document.getElementById('promptDetailContainer');

    cardsContainer.className = 'col-12';
    detailContainer.className = 'col-9 d-none';
    detailContainer.innerHTML = '';

    // 清空當前提示詞 ID
    detailContainer.removeAttribute('data-current-prompt-id');
}

function bindDetailEventListeners() {
    // 重置按鈕
    const resetBtn = document.getElementById('resetDetailPromptBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetDetailPrompt);
    }

    // ChatGPT 按鈕
    const chatgptBtn = document.getElementById('useGptsFromDetailBtn');
    if (chatgptBtn) {
        chatgptBtn.addEventListener('click', openChatGptWithDetailContent);
    }

    // 複製按鈕
    const copyBtn = document.getElementById('copyDetailPromptBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', function () {
            const textarea = document.getElementById('detailPromptTextarea');
            if (textarea) {
                navigator.clipboard.writeText(textarea.value)
                    .then(() => {
                        const btn = document.getElementById('copyDetailPromptBtn');
                        btn.textContent = '已複製';
                        setTimeout(() => { btn.textContent = '複製'; }, 1200);
                    });
            }
        });
    }

    // ChatWise 按鈕
    const chatwiseBtn = document.getElementById('useChatwiseGptsFromDetailBtn');
    if (chatwiseBtn) {
        chatwiseBtn.addEventListener('click', function () {
            const textarea = document.getElementById('detailPromptTextarea');
            if (textarea) {
                const encodedValue = encodeURIComponent(textarea.value);
                const url = `chatwise://chat?instruction=${encodedValue}&input=請說明如何使用這個提示詞。`;
                window.open(url, '_blank');
            }
        });
    }
}

function openPromptModal(promptId) {
    const data = getPromptData(promptId);
    if (!data) return;

    const modal = document.getElementById('promptModal');
    const modalTitleInput = document.getElementById('modalPromptTitle');
    const modalAuthorInput = document.getElementById('modalPromptAuthor');
    const modalTextarea = document.getElementById('modalPromptTextarea');

    modalTitleInput.value = data.title;
    modalAuthorInput.value = data.author;
    modalTextarea.value = data.content;
    modal.dataset.currentPromptId = promptId;

    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const isEditMode = mode === 'edit';

    modalTitleInput.readOnly = !isEditMode;
    modalAuthorInput.readOnly = !isEditMode;
    modalTextarea.readOnly = !isEditMode;

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

function openChatGptWithModalContent() {
    const textarea = document.getElementById('modalPromptTextarea');
    const encodedValue = encodeURIComponent(textarea.value + '\n\n請說明如何使用這個提示詞。');
    const url = `http://chatgpt.com/?q=${encodedValue}`;
    window.open(url, '_blank');
}

function openChatGptWithDetailContent() {
    const textarea = document.getElementById('detailPromptTextarea');
    const encodedValue = encodeURIComponent(textarea.value + '\n\n請說明如何使用這個提示詞。');
    const url = `http://chatgpt.com/?q=${encodedValue}`;
    window.open(url, '_blank');
}

function saveDetailPromptToLocalStorage() {
    const detailContainer = document.getElementById('promptDetailContainer');
    const currentPromptId = detailContainer.dataset.currentPromptId;
    if (!currentPromptId) return;

    const titleInput = document.getElementById('detailPromptTitle');
    const authorInput = document.getElementById('detailPromptAuthor');
    const textarea = document.getElementById('detailPromptTextarea');

    const updatedData = {
        id: currentPromptId,
        title: titleInput.value,
        author: authorInput.value,
        content: textarea.value
    };
    localStorage.setItem(`gpts_prompt_${currentPromptId}`, JSON.stringify(updatedData));

    const cardElement = document.querySelector(`.prompt-card[data-prompt-id="${currentPromptId}"]`);
    if (cardElement) {
        cardElement.querySelector('.card-title').textContent = titleInput.value;
    }
}

function resetDetailPrompt() {
    const detailContainer = document.getElementById('promptDetailContainer');
    const currentPromptId = detailContainer.dataset.currentPromptId;
    if (!currentPromptId) return;

    const defaultData = defaultPrompts.find(p => p.id === currentPromptId);
    if (defaultData) {
        document.getElementById('detailPromptTitle').value = defaultData.title;
        document.getElementById('detailPromptAuthor').value = defaultData.author;
        document.getElementById('detailPromptTextarea').value = defaultData.content;
        localStorage.removeItem(`gpts_prompt_${currentPromptId}`);

        const cardElement = document.querySelector(`.prompt-card[data-prompt-id="${currentPromptId}"]`);
        if (cardElement) {
            cardElement.querySelector('.card-title').textContent = defaultData.title;
        }
    }
}

function updateLink() {
    const textarea = document.getElementById('promptTextarea');
    const link = document.getElementById('chatgptLink');
    const encodedValue = encodeURIComponent(textarea.value + '\n\n請說明如何使用這個提示詞。');
    link.href = `http://chatgpt.com/?q=${encodedValue}`;
}

// 全域函數，供 HTML 調用
window.closePromptDetail = closePromptDetail;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const resetBtn = document.getElementById('resetPromptBtn');

    // 只在非編輯模式下隱藏 modal 中的重置按鈕
    if (mode !== 'edit') {
        resetBtn.parentElement.style.display = 'none';
        // 註解掉這兩行，讓輸入框和按鈕始終顯示
        // document.getElementById('promptTextarea').parentElement.style.display = 'none';
        // document.getElementById('chatgptLink').style.display = 'none';
    }

    await loadCards();
    // updateLink(); // 移除，因為主頁面不再有輸入框

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
            const url = `chatwise://chat?instruction=${encodedValue}&input=請說明如何使用這個提示詞。`;
            window.open(url, '_blank');
        }
    });

    // 監聽視窗大小變化，自動切換顯示方式
    window.addEventListener('resize', function () {
        const detailContainer = document.getElementById('promptDetailContainer');
        const currentPromptId = detailContainer.dataset.currentPromptId;

        if (currentPromptId) {
            const isDesktop = window.innerWidth >= 768;

            if (!isDesktop && !detailContainer.classList.contains('d-none')) {
                // 從桌面版切換到手機版，關閉詳情區域並開啟 modal
                closePromptDetail();
                openPromptModal(currentPromptId);
            }
        }
    });
});
