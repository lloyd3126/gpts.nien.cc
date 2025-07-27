let tagOrder = ['使用中', 'Gemini 生成']; // 預設值，會從 YAML 覆蓋
let defaultPrompts = [];
let currentEditingPromptId = null; // 追蹤當前編輯的提示詞 ID
let originalYamlData = null; // 儲存原始 YAML 資料

// 從 data.yml 載入提示詞資料
async function loadPromptsFromYaml() {
    try {
        const response = await fetch('data.yml');
        const yamlText = await response.text();
        const yamlData = jsyaml.load(yamlText);

        // 儲存原始 YAML 資料
        originalYamlData = yamlData;

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

    // 優先檢查新的統一 localStorage 結構
    try {
        const customData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
        if (customData[id]) {
            const custom = customData[id];
            const activeVersion = custom.metadata?.activeVersion || 'v1';
            const versionData = custom.versions?.[activeVersion];

            if (versionData) {
                return {
                    ...defaultData,
                    title: custom.metadata.displayTitle || defaultData?.title,
                    author: custom.metadata.author || defaultData?.author,
                    content: versionData.content || defaultData?.content,
                    tag: custom.metadata.tag || defaultData?.tag,
                    draft: custom.metadata.draft || false
                };
            }
        }
    } catch (e) {
        console.error('解析 customPromptData 失敗:', e);
    }

    // 回退到舊的 localStorage 結構
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
} function savePromptToLocalStorage() {
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
            groupContainer.className = 'prompt-grid mb-4';

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
        // 檢查當前是否已經開啟了詳情區域
        const detailContainer = document.getElementById('promptDetailContainer');
        const currentPromptId = detailContainer.dataset.currentPromptId;

        // 如果點擊的是同一個卡片，則切換開關
        if (currentPromptId === promptId && !detailContainer.classList.contains('d-none')) {
            closePromptDetail();
        } else {
            openPromptDetail(promptId);
        }
    } else {
        openPromptModal(promptId);
    }
}

function openPromptDetail(promptId) {
    const data = getPromptData(promptId);
    if (!data) return;

    // 如果當前有其他提示詞在編輯狀態，先保存並退出編輯
    if (currentEditingPromptId && currentEditingPromptId !== promptId) {
        saveDetailPromptToLocalStorage();
        currentEditingPromptId = null;
    }

    // 設定 active 狀態
    setActiveCard(promptId);

    // 創建詳情區域的 HTML 內容
    const detailHTML = `
        <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center p-4">
                <h5 class="mb-0" id="promptDetailTitle">提示詞詳情</h5>
                <button type="button" class="btn-close" onclick="closePromptDetail()" aria-label="Close"></button>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="detailPromptDisplayTitle" class="form-label">顯示標題：</label>
                            <input type="text" class="form-control" id="detailPromptDisplayTitle" readonly>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="detailPromptAuthor" class="form-label">作者：</label>
                            <input type="text" class="form-control" id="detailPromptAuthor" readonly>
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="detailPromptTag" class="form-label">標籤：</label>
                            <select class="form-select" id="detailPromptTag" disabled>
                                <option value="使用中">使用中</option>
                                <option value="Gemini 生成">Gemini 生成</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="detailPromptDraft" class="form-label">狀態：</label>
                            <div class="form-check form-switch mt-2">
                                <input class="form-check-input" type="checkbox" id="detailPromptDraft" disabled>
                                <label class="form-check-label" for="detailPromptDraft">草稿模式</label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mb-3">
                    <label for="detailPromptVersion" class="form-label">版本：</label>
                    <select class="form-select" id="detailPromptVersion" disabled>
                        <!-- 版本選項會動態生成 -->
                    </select>
                </div>
                <div class="mb-3">
                    <label for="detailPromptVersionName" class="form-label">版本名稱：</label>
                    <input type="text" class="form-control" id="detailPromptVersionName" readonly>
                </div>
                <div class="mb-3">
                    <label for="detailPromptVersionDescription" class="form-label">版本說明：</label>
                    <input type="text" class="form-control" id="detailPromptVersionDescription" readonly>
                </div>
                <div>
                    <label for="detailPromptTextarea" class="form-label">內容：</label>
                    <textarea class="form-control" id="detailPromptTextarea" readonly></textarea>
                </div>
            </div>
            <div class="card-footer d-flex justify-content-between">
                <div>
                    <button type="button" class="btn btn-danger d-none" id="resetDetailPromptBtn">重置</button>
                </div>
                <div>
                    <button type="button" class="btn btn-dark me-2" id="editPromptBtn">編輯</button>
                    <button type="button" class="btn btn-dark me-2" id="copyDetailPromptBtn">複製</button>
                    <button type="button" class="btn btn-dark me-2" id="useGptsFromDetailBtn">在 ChatGPT 使用</button>
                    <button type="button" class="btn btn-dark" id="useChatwiseGptsFromDetailBtn">在 ChatWise 使用</button>
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
    populateDetailForm(promptId, data);

    // 自動調整 textarea 高度
    const textarea = document.getElementById('detailPromptTextarea');
    autoResizeTextarea(textarea);

    // 儲存當前提示詞 ID
    detailContainer.dataset.currentPromptId = promptId;

    // 檢查是否為編輯模式
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const isEditMode = mode === 'edit';

    // 更新UI狀態
    const editBtn = document.getElementById('editPromptBtn');
    const displayTitleInput = document.getElementById('detailPromptDisplayTitle');
    const authorInput = document.getElementById('detailPromptAuthor');
    const tagSelect = document.getElementById('detailPromptTag');
    const draftCheckbox = document.getElementById('detailPromptDraft');
    const versionSelect = document.getElementById('detailPromptVersion');
    const versionNameInput = document.getElementById('detailPromptVersionName');
    const versionDescInput = document.getElementById('detailPromptVersionDescription');
    const textareaInput = document.getElementById('detailPromptTextarea');
    const resetBtn = document.getElementById('resetDetailPromptBtn');

    if (isEditMode || currentEditingPromptId === promptId) {
        // 編輯模式
        editBtn.textContent = '儲存';
        displayTitleInput.readOnly = false;
        authorInput.readOnly = false;
        tagSelect.disabled = false;
        draftCheckbox.disabled = false;
        versionSelect.disabled = false;
        versionNameInput.readOnly = false;
        versionDescInput.readOnly = false;
        textareaInput.readOnly = false;
        resetBtn.classList.remove('d-none');
        currentEditingPromptId = promptId;
    } else {
        // 檢視模式
        editBtn.textContent = '編輯';
        displayTitleInput.readOnly = true;
        authorInput.readOnly = true;
        tagSelect.disabled = true;
        draftCheckbox.disabled = true;
        versionSelect.disabled = true;
        versionNameInput.readOnly = true;
        versionDescInput.readOnly = true;
        textareaInput.readOnly = true;
        resetBtn.classList.add('d-none');
    }

    // 重新綁定事件監聽器
    bindDetailEventListeners();

    // 滾動到選中的卡片位置
    scrollToActiveCard(promptId);
}

function closePromptDetail() {
    // 如果當前有編輯狀態，先保存
    if (currentEditingPromptId) {
        saveDetailPromptToLocalStorage();
        currentEditingPromptId = null;
    }

    const cardsContainer = document.getElementById('promptCardsContainer');
    const detailContainer = document.getElementById('promptDetailContainer');

    cardsContainer.className = 'col-12';
    detailContainer.className = 'col-9 d-none';
    detailContainer.innerHTML = '';

    // 清除所有卡片的 active 狀態
    clearActiveCards();

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

    // 編輯按鈕
    const editBtn = document.getElementById('editPromptBtn');
    if (editBtn) {
        editBtn.addEventListener('click', toggleEditMode);
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

    // 自動調整文本框高度和自動保存
    const textarea = document.getElementById('detailPromptTextarea');
    const displayTitleInput = document.getElementById('detailPromptDisplayTitle');
    const authorInput = document.getElementById('detailPromptAuthor');
    const tagSelect = document.getElementById('detailPromptTag');
    const draftCheckbox = document.getElementById('detailPromptDraft');
    const versionNameInput = document.getElementById('detailPromptVersionName');
    const versionDescInput = document.getElementById('detailPromptVersionDescription');

    if (textarea) {
        textarea.addEventListener('input', () => {
            autoResizeTextarea(textarea);
            if (currentEditingPromptId) {
                debouncedSave();
            }
        });
    }

    // 為所有可編輯欄位添加自動保存
    const editableFields = [
        displayTitleInput, authorInput, tagSelect, draftCheckbox,
        versionNameInput, versionDescInput
    ];

    editableFields.forEach(field => {
        if (field) {
            const eventType = field.type === 'checkbox' ? 'change' : 'input';
            field.addEventListener(eventType, () => {
                if (currentEditingPromptId) {
                    debouncedSave();
                }
            });
        }
    });

    // 防抖保存函數
    const debouncedSave = debounce(() => {
        if (currentEditingPromptId) {
            saveDetailPromptToLocalStorage();
        }
    }, 1000);
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

function resetDetailPrompt() {
    const detailContainer = document.getElementById('promptDetailContainer');
    const currentPromptId = detailContainer.dataset.currentPromptId;
    if (!currentPromptId) return;

    // 重新載入原始資料並填充表單
    const rawData = originalYamlData?.prompt?.[currentPromptId];
    if (rawData) {
        populateDetailForm(currentPromptId, null);

        // 自動調整 textarea 高度
        const textarea = document.getElementById('detailPromptTextarea');
        autoResizeTextarea(textarea);

        // 清除 localStorage 中的自訂資料
        let customData = {};
        try {
            customData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
            delete customData[currentPromptId];
            localStorage.setItem('customPromptData', JSON.stringify(customData));
        } catch (e) {
            console.error('清除 localStorage 資料失敗:', e);
        }

        // 同時清除舊格式的 localStorage
        localStorage.removeItem(`gpts_prompt_${currentPromptId}`);

        // 更新卡片標題
        const defaultData = defaultPrompts.find(p => p.id === currentPromptId);
        if (defaultData) {
            const cardElement = document.querySelector(`.prompt-card[data-prompt-id="${currentPromptId}"]`);
            if (cardElement) {
                cardElement.querySelector('.card-title').textContent = defaultData.title;
            }
        }
    }
}

function updateLink() {
    const textarea = document.getElementById('promptTextarea');
    const link = document.getElementById('chatgptLink');
    const encodedValue = encodeURIComponent(textarea.value + '\n\n請說明如何使用這個提示詞。');
    link.href = `http://chatgpt.com/?q=${encodedValue}`;
}

// 設定指定卡片為 active 狀態
function setActiveCard(promptId) {
    // 先清除所有 active 狀態
    clearActiveCards();

    // 為指定卡片添加 active 狀態
    const cardElement = document.querySelector(`.prompt-card[data-prompt-id="${promptId}"]`);
    if (cardElement) {
        cardElement.classList.add('active');
    }
}

// 清除所有卡片的 active 狀態
function clearActiveCards() {
    const activeCards = document.querySelectorAll('.prompt-card.active');
    activeCards.forEach(card => {
        card.classList.remove('active');
    });
}

// 防抖函數
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 填充詳情表單
function populateDetailForm(promptId, displayData) {
    // 獲取原始 YAML 資料
    const rawData = originalYamlData?.prompt?.[promptId];
    if (!rawData) {
        console.error('找不到原始資料:', promptId);
        return;
    }

    // 檢查是否有自訂資料
    let customData = null;
    try {
        const allCustomData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
        customData = allCustomData[promptId];
    } catch (e) {
        console.error('解析 localStorage 資料失敗:', e);
    }

    // 使用自訂資料或原始資料
    const metadata = customData?.metadata || rawData.metadata;
    const activeVersion = metadata.activeVersion || 'v1';

    // 版本資料優先使用自訂資料，如果沒有則使用原始資料
    let versionData;
    if (customData?.versions?.[activeVersion]) {
        versionData = customData.versions[activeVersion];
    } else {
        versionData = rawData[activeVersion];
    }

    // 填充基本資訊
    document.getElementById('detailPromptDisplayTitle').value = metadata.displayTitle || '';
    document.getElementById('detailPromptAuthor').value = metadata.author || '';
    document.getElementById('detailPromptTag').value = metadata.tag || '';
    document.getElementById('detailPromptDraft').checked = metadata.draft === true;

    // 填充版本選擇器
    const versionSelect = document.getElementById('detailPromptVersion');
    versionSelect.innerHTML = '';

    // 獲取所有版本（包含原始版本和自訂版本）
    const originalVersions = Object.keys(rawData).filter(key => key.startsWith('v'));
    const customVersions = customData?.versions ? Object.keys(customData.versions) : [];
    const allVersions = [...new Set([...originalVersions, ...customVersions])]; // 去重
    allVersions.sort(); // 排序版本

    allVersions.forEach(version => {
        const option = document.createElement('option');
        option.value = version;
        option.textContent = version;
        if (version === activeVersion) {
            option.selected = true;
        }
        versionSelect.appendChild(option);
    });

    // 填充當前版本的詳細資訊
    if (versionData) {
        document.getElementById('detailPromptVersionName').value = versionData.name || '';
        document.getElementById('detailPromptVersionDescription').value = versionData.description || '';
        document.getElementById('detailPromptTextarea').value = versionData.content || '';
    }

    // 綁定版本切換事件
    versionSelect.onchange = function () {
        const selectedVersion = this.value;

        // 優先使用自訂版本資料
        let selectedVersionData;
        if (customData?.versions?.[selectedVersion]) {
            selectedVersionData = customData.versions[selectedVersion];
        } else {
            selectedVersionData = rawData[selectedVersion];
        }

        if (selectedVersionData) {
            document.getElementById('detailPromptVersionName').value = selectedVersionData.name || '';
            document.getElementById('detailPromptVersionDescription').value = selectedVersionData.description || '';
            document.getElementById('detailPromptTextarea').value = selectedVersionData.content || '';

            // 重新調整 textarea 高度
            const textarea = document.getElementById('detailPromptTextarea');
            autoResizeTextarea(textarea);
        }
    };
}

// 自動調整文本區域高度
function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight - 20) + 'px';
}

// 滾動到選中的卡片位置
function scrollToActiveCard(promptId) {
    // 使用 setTimeout 確保 DOM 已經更新完成
    setTimeout(() => {
        const cardElement = document.querySelector(`.prompt-card[data-prompt-id="${promptId}"]`);
        const cardsContainer = document.getElementById('promptCardsContainer');

        if (cardElement && cardsContainer) {
            // 計算卡片相對於容器的位置
            const cardRect = cardElement.getBoundingClientRect();
            const containerRect = cardsContainer.getBoundingClientRect();

            // 計算需要滾動的距離
            const scrollTop = cardsContainer.scrollTop;
            const cardOffsetTop = cardRect.top - containerRect.top + scrollTop;

            // 滾動到卡片位置（稍微往上一點以獲得更好的視覺效果）
            cardsContainer.scrollTo({
                top: Math.max(0, cardOffsetTop - 20),
                behavior: 'smooth'
            });
        }
    }, 100);
}

// 切換編輯模式
function toggleEditMode() {
    const detailContainer = document.getElementById('promptDetailContainer');
    const promptId = detailContainer.dataset.currentPromptId;
    if (!promptId) return;

    const editBtn = document.getElementById('editPromptBtn');
    const displayTitleInput = document.getElementById('detailPromptDisplayTitle');
    const authorInput = document.getElementById('detailPromptAuthor');
    const tagSelect = document.getElementById('detailPromptTag');
    const draftCheckbox = document.getElementById('detailPromptDraft');
    const versionSelect = document.getElementById('detailPromptVersion');
    const versionNameInput = document.getElementById('detailPromptVersionName');
    const versionDescInput = document.getElementById('detailPromptVersionDescription');
    const textarea = document.getElementById('detailPromptTextarea');
    const resetBtn = document.getElementById('resetDetailPromptBtn');

    if (currentEditingPromptId === promptId) {
        // 當前是編輯模式，切換到檢視模式並保存
        saveDetailPromptToLocalStorage();
        currentEditingPromptId = null;

        // 更新 UI - 設為唯讀
        editBtn.textContent = '編輯';
        displayTitleInput.readOnly = true;
        authorInput.readOnly = true;
        tagSelect.disabled = true;
        draftCheckbox.disabled = true;
        versionSelect.disabled = true;
        versionNameInput.readOnly = true;
        versionDescInput.readOnly = true;
        textarea.readOnly = true;
        resetBtn.classList.add('d-none');

        // 顯示保存成功提示
        editBtn.textContent = '已儲存';
        setTimeout(() => { editBtn.textContent = '編輯'; }, 1200);
    } else {
        // 當前是檢視模式，切換到編輯模式
        currentEditingPromptId = promptId;

        // 更新 UI - 設為可編輯
        editBtn.textContent = '儲存';
        displayTitleInput.readOnly = false;
        authorInput.readOnly = false;
        tagSelect.disabled = false;
        draftCheckbox.disabled = false;
        versionSelect.disabled = false;
        versionNameInput.readOnly = false;
        versionDescInput.readOnly = false;
        textarea.readOnly = false;
        resetBtn.classList.remove('d-none');

        // 重新調整 textarea 高度（編輯時可能會改變內容）
        autoResizeTextarea(textarea);
    }
}// 保存詳細視圖的內容到 localStorage
function saveDetailPromptToLocalStorage() {
    const detailContainer = document.getElementById('promptDetailContainer');
    const promptId = detailContainer.dataset.currentPromptId;
    if (!promptId) return;

    const displayTitleInput = document.getElementById('detailPromptDisplayTitle');
    const authorInput = document.getElementById('detailPromptAuthor');
    const tagSelect = document.getElementById('detailPromptTag');
    const draftCheckbox = document.getElementById('detailPromptDraft');
    const versionSelect = document.getElementById('detailPromptVersion');
    const versionNameInput = document.getElementById('detailPromptVersionName');
    const versionDescInput = document.getElementById('detailPromptVersionDescription');
    const textarea = document.getElementById('detailPromptTextarea');

    if (!displayTitleInput || !authorInput || !textarea) return;

    // 獲取當前的 localStorage 資料
    let customData = {};
    try {
        customData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
    } catch (e) {
        console.error('解析 localStorage 資料失敗:', e);
        customData = {};
    }

    const selectedVersion = versionSelect.value;

    // 更新資料 - 保存完整的提示詞結構
    customData[promptId] = {
        metadata: {
            tag: tagSelect.value,
            author: authorInput.value,
            displayTitle: displayTitleInput.value,
            activeVersion: selectedVersion,
            draft: draftCheckbox.checked
        },
        versions: {
            [selectedVersion]: {
                name: versionNameInput.value,
                description: versionDescInput.value,
                content: textarea.value
            }
        },
        updatedAt: new Date().toISOString()
    };

    // 如果有其他版本的自訂資料，也要保留
    const existingData = customData[promptId];
    if (existingData && existingData.versions) {
        // 合併版本資料，保留其他版本
        customData[promptId].versions = {
            ...existingData.versions,
            [selectedVersion]: {
                name: versionNameInput.value,
                description: versionDescInput.value,
                content: textarea.value
            }
        };
    }

    // 保存到 localStorage
    try {
        localStorage.setItem('customPromptData', JSON.stringify(customData));
        console.log('提示詞已保存到 localStorage:', promptId);
    } catch (e) {
        console.error('保存到 localStorage 失敗:', e);
    }
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
