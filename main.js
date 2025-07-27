// 統一的標籤系統
let allTags = ['使用中', 'Gemini 生成']; // 統一的標籤陣列，預設值會從 YAML 和 localStorage 合併

let defaultPrompts = [];
let currentEditingPromptId = null; // 追蹤當前編輯的提示詞 ID
let originalYamlData = null; // 儲存原始 YAML 資料

// 新增功能的全局變量
let customPrompts = {}; // 自訂提示詞
let customVersions = {}; // 自訂版本
let modifiedPrompts = {}; // 修改過的提示詞
let personalTags = []; // 個人標籤陣列

// 從 data.yml 載入提示詞資料
async function loadPromptsFromYaml() {
    try {
        const response = await fetch('data.yml');
        const yamlText = await response.text();
        const yamlData = jsyaml.load(yamlText);

        // 儲存原始 YAML 資料
        originalYamlData = yamlData;

        // 從 YAML 讀取標籤，合併到統一標籤陣列
        if (yamlData.metadata && yamlData.metadata.tagOrder) {
            // 將 YAML 中的標籤加入到 allTags，避免重複
            yamlData.metadata.tagOrder.forEach(tag => {
                if (!allTags.includes(tag)) {
                    allTags.push(tag);
                }
            });
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
    // 首先檢查是否為自訂提示詞
    if (customPrompts[id]) {
        const customPrompt = customPrompts[id];
        const activeVersion = customPrompt.metadata.activeVersion || 'v1';
        const versionData = customPrompt[activeVersion];

        return {
            id: id,
            title: customPrompt.metadata.displayTitle,
            author: customPrompt.metadata.author,
            content: versionData.content,
            tag: customPrompt.metadata.tag,
            draft: customPrompt.metadata.draft || false
        };
    }

    // 檢查原始提示詞
    const defaultData = defaultPrompts.find(p => p.id === id);
    if (!defaultData) {
        return null;
    }

    // 檢查是否有自訂版本
    if (customVersions[id]) {
        const versions = customVersions[id];
        // 這裡可以根據需要選擇特定版本
    }

    // 檢查是否有修改
    if (modifiedPrompts[id]) {
        return { ...defaultData, ...modifiedPrompts[id] };
    }

    // 優先檢查新的統一 localStorage 結構
    try {
        const customData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
        if (customData[id]) {
            const custom = customData[id];
            const activeVersion = custom.metadata?.activeVersion || 'v1';
            const versionData = custom.versions?.[activeVersion];

            if (versionData) {
                // 如果是完全自訂的提示詞（不存在於 defaultPrompts 中）
                if (!defaultData) {
                    return {
                        id: id,
                        title: custom.metadata.displayTitle || versionData.name || id,
                        author: custom.metadata.author || '',
                        content: versionData.content || '',
                        tag: custom.metadata.tag || '',
                        draft: custom.metadata.draft || false
                    };
                }

                // 如果是對現有提示詞的修改
                return {
                    ...defaultData,
                    title: custom.metadata.displayTitle !== undefined ? custom.metadata.displayTitle : defaultData?.title,
                    author: custom.metadata.author !== undefined ? custom.metadata.author : defaultData?.author,
                    content: versionData.content !== undefined ? versionData.content : defaultData?.content,
                    tag: custom.metadata.tag !== undefined ? custom.metadata.tag : defaultData?.tag,
                    draft: custom.metadata.draft !== undefined ? custom.metadata.draft : false
                };
            }
        }
    } catch (e) {
        // 解析失敗時忽略錯誤
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
    console.log('=== loadCards 開始 ===');

    // 如果還沒有載入提示詞資料，先載入
    if (defaultPrompts.length === 0) {
        console.log('🔄 載入預設提示詞資料...');
        await loadPromptsFromYaml();
        console.log('✅ 預設提示詞載入完成，數量:', defaultPrompts.length);
    } else {
        console.log('✅ 預設提示詞已載入，數量:', defaultPrompts.length);
    }

    const container = document.getElementById('promptCardsContainer');
    const loadingIndicator = document.getElementById('loadingIndicator');

    // 隱藏載入指示器
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
        console.log('✅ 隱藏載入指示器');
    }

    container.innerHTML = '';
    console.log('🧹 清空容器內容');

    // 合併所有提示詞（原始 + 自訂）
    const allPrompts = [...defaultPrompts];
    console.log('📋 開始處理預設提示詞，數量:', allPrompts.length);

    // 加入自訂提示詞
    console.log('📋 處理自訂提示詞...');
    console.log('customPrompts 物件鍵值數量:', Object.keys(customPrompts).length);
    Object.keys(customPrompts).forEach(id => {
        const customPrompt = customPrompts[id];
        const activeVersion = customPrompt.metadata.activeVersion || 'v1';
        const versionData = customPrompt[activeVersion];

        console.log(`處理自訂提示詞 ${id}:`, {
            title: customPrompt.metadata.displayTitle,
            tag: customPrompt.metadata.tag,
            draft: customPrompt.metadata.draft,
            activeVersion
        });

        // 檢查是否草稿
        if (customPrompt.metadata.draft) {
            console.log(`⏭️ 跳過草稿: ${id}`);
            return;
        }

        allPrompts.push({
            id: id,
            tag: customPrompt.metadata.tag,
            author: customPrompt.metadata.author,
            title: customPrompt.metadata.displayTitle,
            content: versionData.content,
            draft: false
        });
        console.log(`✅ 新增自訂提示詞: ${id}`);
    });

    // 直接從 customPromptData 加入提示詞（處理可能沒有被轉換的情況）
    try {
        const customPromptData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
        Object.keys(customPromptData).forEach(id => {
            // 檢查是否已經在 customPrompts 或 defaultPrompts 中
            const existsInCustom = customPrompts[id];
            const existsInDefault = defaultPrompts.find(p => p.id === id);

            if (!existsInCustom && !existsInDefault) {
                const data = customPromptData[id];
                if (data.metadata && data.versions) {
                    const activeVersion = data.metadata.activeVersion || 'v1';
                    const versionData = data.versions[activeVersion];

                    if (versionData && !data.metadata.draft) {
                        console.log('直接從 customPromptData 加入提示詞:', id);
                        allPrompts.push({
                            id: id,
                            tag: data.metadata.tag,
                            author: data.metadata.author,
                            title: data.metadata.displayTitle || versionData.name || id,
                            content: versionData.content,
                            draft: false
                        });
                    }
                }
            }
        });
    } catch (e) {
        console.error('處理 customPromptData 時出錯:', e);
    }

    const promptsByTag = allPrompts.reduce((acc, prompt) => {
        // 使用 getPromptData 獲取最新資料，確保標籤變更被正確反映
        const currentData = getPromptData(prompt.id);
        if (currentData) {
            const tag = currentData.tag;
            if (!acc[tag]) {
                acc[tag] = [];
            }
            acc[tag].push(currentData);
        }
        return acc;
    }, {});

    // 使用統一的標籤陣列來顯示
    allTags.forEach(tag => {
        if (promptsByTag[tag]) {
            const tagHeader = document.createElement('h2');
            tagHeader.className = 'mt-2 mb-3 fs-5';
            tagHeader.textContent = tag;
            container.appendChild(tagHeader);

            const groupContainer = document.createElement('div');
            groupContainer.className = 'prompt-grid mb-4';

            promptsByTag[tag].forEach(currentData => {
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

                // 添加標籤顯示
                // const tagText = document.createElement('div');
                // tagText.className = 'card-text';
                // const tagBadge = document.createElement('span');
                // tagBadge.className = 'badge bg-secondary';
                // tagBadge.textContent = currentData.tag;  // 使用實際提示詞的標籤，而不是分組標籤
                // tagText.appendChild(tagBadge);

                link.appendChild(title);
                // link.appendChild(tagText);
                card.appendChild(link);
                groupContainer.appendChild(card);
            });

            container.appendChild(groupContainer);
        }
    });
}

// 開啟新增提示詞對話框
function loadPersonalSettings() {
    try {
        // 載入統一標籤陣列（優先使用，保持順序）
        const storedAllTags = localStorage.getItem('allTags');
        if (storedAllTags) {
            const loadedTags = JSON.parse(storedAllTags);
            console.log('從 localStorage 載入標籤順序:', loadedTags);
            // 直接替換 allTags 以保持順序
            allTags.splice(0, allTags.length, ...loadedTags);
        } else {
            // 如果沒有儲存的統一標籤陣列，則從個人標籤載入（向後相容）
            const storedPersonalTags = localStorage.getItem('personalTags');
            if (storedPersonalTags) {
                const personalTags = JSON.parse(storedPersonalTags);
                console.log('從舊版 personalTags 載入標籤:', personalTags);
                // 將個人標籤合併到 allTags，避免重複
                personalTags.forEach(tag => {
                    if (!allTags.includes(tag)) {
                        allTags.push(tag);
                    }
                });
            }
        }

        // 載入自訂提示詞
        const storedCustomPrompts = localStorage.getItem('customPrompts');
        if (storedCustomPrompts) {
            customPrompts = JSON.parse(storedCustomPrompts);
        }

        // 載入自訂版本
        const storedCustomVersions = localStorage.getItem('customVersions');
        if (storedCustomVersions) {
            customVersions = JSON.parse(storedCustomVersions);
        }

        // 載入修改過的提示詞
        const storedModifiedPrompts = localStorage.getItem('modifiedPrompts');
        if (storedModifiedPrompts) {
            modifiedPrompts = JSON.parse(storedModifiedPrompts);
        }

        // 載入新的統一 customPromptData 結構（優先使用）
        const storedCustomPromptData = localStorage.getItem('customPromptData');
        if (storedCustomPromptData) {
            const customPromptData = JSON.parse(storedCustomPromptData);
            console.log('載入 customPromptData:', Object.keys(customPromptData));

            // 收集所有使用的標籤
            const allUsedTags = new Set();

            // 將 customPromptData 轉換為現有的資料結構格式，以保持相容性
            Object.keys(customPromptData).forEach(promptId => {
                const data = customPromptData[promptId];
                console.log('處理提示詞:', promptId, '，資料結構:', data);

                // 收集標籤
                if (data.metadata && data.metadata.tag) {
                    allUsedTags.add(data.metadata.tag);
                }

                if (data.metadata && data.versions) {
                    // 如果這是一個完整的自訂提示詞，加入到 customPrompts
                    console.log('將', promptId, '加入到 customPrompts');
                    customPrompts[promptId] = {
                        metadata: data.metadata,
                        ...data.versions
                    };
                } else if (data.metadata) {
                    // 如果這是對現有提示詞的修改，加入到 modifiedPrompts
                    console.log('將', promptId, '加入到 modifiedPrompts');
                    modifiedPrompts[promptId] = data;
                } else {
                    console.log('跳過', promptId, '，資料結構不符合預期');
                }
            });

            // 更新個人標籤：加入新發現的標籤（但不是全域標籤）
            allUsedTags.forEach(tag => {
                if (!allTags.includes(tag) && !personalTags.includes(tag)) {
                    console.log('發現新的個人標籤:', tag);
                    personalTags.push(tag);
                }
            });

            // 如果個人標籤有更新，儲存到 localStorage
            if (allUsedTags.size > 0) {
                localStorage.setItem('personalTags', JSON.stringify(personalTags));
                console.log('已更新個人標籤:', personalTags);
            }
        }
    } catch (error) {
        console.error('載入個人化設定時出錯:', error);
    }
}

// 儲存個人化設定
function savePersonalSettings() {
    try {
        // 儲存統一標籤陣列（保持順序）
        localStorage.setItem('allTags', JSON.stringify(allTags));
        console.log('儲存標籤順序到 localStorage:', allTags);

        // 為了向後相容，暫時保留個人標籤的儲存
        // TODO: 未來版本可以移除這行
        localStorage.setItem('personalTags', JSON.stringify([]));

        localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
        localStorage.setItem('customVersions', JSON.stringify(customVersions));
        localStorage.setItem('modifiedPrompts', JSON.stringify(modifiedPrompts));
    } catch (error) {
        console.error('儲存個人化設定時出錯:', error);
    }
}

// 開啟新增提示詞對話框或表單
function openAddPromptModal() {
    // 檢查螢幕寬度，決定使用 modal 還是右側表單
    const isDesktop = window.innerWidth >= 768;

    if (isDesktop) {
        // 桌面模式：使用右側表單
        openAddPromptForm();
    } else {
        // 手機模式：使用 modal
        const modal = new bootstrap.Modal(document.getElementById('addPromptModal'));

        // 重置表單
        document.getElementById('addPromptForm').reset();
        document.getElementById('newPromptDescription').value = '初版';

        // 更新標籤選項
        updateTagOptions();

        // 先清除所有按鈕的 active 狀態，然後設定新增提示詞按鈕為 active 狀態
        clearActiveHeaderButtons();
        setActiveHeaderButton('addPromptHeaderBtn');

        modal.show();
    }
}

// 開啟右側新增提示詞表單
function openAddPromptForm() {
    console.log('📝 [openAddPromptForm] 開始執行');

    // 如果當前有編輯狀態，先保存並退出編輯
    if (currentEditingPromptId) {
        console.log('📝 [openAddPromptForm] 保存當前編輯狀態:', currentEditingPromptId);
        saveDetailPromptToLocalStorage();
        currentEditingPromptId = null;
    }

    // 清除所有卡片的 active 狀態
    console.log('📝 [openAddPromptForm] 清除所有卡片的 active 狀態');
    clearActiveCards();

    // 創建新增表單的 HTML 內容
    const addFormHTML = `
        <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center p-4">
                <h5 class="mb-0"><i class="bi bi-plus"></i> 新增提示詞</h5>
                <button type="button" class="btn-close" onclick="closeAddPromptForm()" aria-label="Close"></button>
            </div>
            <div class="card-body">
                <form id="addPromptFormDetail">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="detailNewPromptId" class="form-label">提示詞 ID：</label>
                                <input type="text" class="form-control" id="detailNewPromptId" placeholder="例：my-custom-prompt" required>
                                <div class="form-text">只能包含小寫英文字母、數字和連字符</div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="detailNewPromptDisplayTitle" class="form-label">顯示標題：</label>
                                <input type="text" class="form-control" id="detailNewPromptDisplayTitle" placeholder="例：我的自訂提示詞" required>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="detailNewPromptAuthor" class="form-label">作者：</label>
                                <input type="text" class="form-control" id="detailNewPromptAuthor" placeholder="例：陳重年" required>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="detailNewPromptTag" class="form-label">標籤：</label>
                                <select class="form-select" id="detailNewPromptTag" required>
                                    <option value="">請選擇標籤</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label for="detailNewPromptDescription" class="form-label">版本說明：</label>
                        <input type="text" class="form-control" id="detailNewPromptDescription" value="初版">
                    </div>
                    <div class="mb-3">
                        <label for="detailNewPromptContent" class="form-label">內容：</label>
                        <textarea class="form-control" id="detailNewPromptContent" rows="8" placeholder="請在這裡輸入您的提示詞內容..." required></textarea>
                    </div>
                </form>
            </div>
            <div class="card-footer d-flex justify-content-between">
                <div>
                    <button type="button" class="btn btn-dark" onclick="closeAddPromptForm()">取消</button>
                </div>
                <div>
                    <button type="button" class="btn btn-dark" id="saveNewPromptDetailBtn"><i class="bi bi-check"></i> 建立提示詞</button>
                </div>
            </div>
        </div>
    `;

    // 切換版面配置
    const cardsContainer = document.getElementById('promptCardsContainer');
    const detailContainer = document.getElementById('promptDetailContainer');

    // 設定表單區域內容
    detailContainer.innerHTML = addFormHTML;

    // 更新版面配置
    cardsContainer.className = 'col-3 border rounded p-3';
    detailContainer.className = 'col-9';

    // 先清除所有按鈕的 active 狀態，然後設定新增提示詞按鈕為 active 狀態
    clearActiveHeaderButtons();
    setActiveHeaderButton('addPromptHeaderBtn');

    // 更新標籤選項
    updateDetailTagOptions();

    // 綁定保存按鈕事件
    document.getElementById('saveNewPromptDetailBtn').addEventListener('click', saveNewPromptFromDetail);

    // 自動調整 textarea 高度
    const textarea = document.getElementById('detailNewPromptContent');
    textarea.addEventListener('input', () => {
        autoResizeTextarea(textarea);
    });
    autoResizeTextarea(textarea);

    // 設定當前狀態為新增模式
    detailContainer.dataset.currentMode = 'add';
    // 清除設定面板的類型標記，確保狀態一致性
    delete detailContainer.dataset.currentType;

    console.log('📝 [openAddPromptForm] 設定完成:');
    console.log('  - currentMode:', detailContainer.dataset.currentMode);
    console.log('  - currentType:', detailContainer.dataset.currentType);
    console.log('  - 面板類別:', detailContainer.className);
    console.log('📝 [openAddPromptForm] 執行完成');
}

// 關閉右側新增表單
function closeAddPromptForm() {
    const cardsContainer = document.getElementById('promptCardsContainer');
    const detailContainer = document.getElementById('promptDetailContainer');

    cardsContainer.className = 'col-12';
    detailContainer.className = 'col-9 d-none';
    detailContainer.innerHTML = '';

    // 清空狀態
    detailContainer.removeAttribute('data-current-mode');
    detailContainer.removeAttribute('data-current-type');
    detailContainer.removeAttribute('data-current-prompt-id');

    // 清除所有卡片的 active 狀態
    clearActiveCards();

    // 設定首頁按鈕為 active 狀態（表示回到首頁）
    setActiveHeaderButton('homeBtn');
}

// ============ 統一的詳細面板管理系統 ============

// 面板內容模板
const detailTemplates = {
    'settings': {
        title: '設定',
        icon: 'bi-gear',
        content: `
            <div class="d-grid gap-3">
                <button type="button" class="btn btn-dark btn-lg" id="manageTagsDetailBtn">
                    <i class="bi bi-tags"></i> 管理標籤
                </button>
                <button type="button" class="btn btn-dark btn-lg" id="dataManagementDetailBtn">
                    <i class="bi bi-trash"></i> 資料管理
                </button>
                <button type="button" class="btn btn-dark btn-lg" id="exportDataDetailBtn">
                    <i class="bi bi-download"></i> 匯出資料
                </button>
                <button type="button" class="btn btn-dark btn-lg" id="importDataDetailBtn">
                    <i class="bi bi-upload"></i> 匯入資料
                </button>
                <button type="button" class="btn btn-dark btn-lg" id="aboutDetailBtn">
                    <i class="bi bi-info-circle"></i> 關於
                </button>
            </div>
        `
    },
    'data-management': {
        title: '資料管理',
        icon: 'bi-trash',
        content: `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i>
                <strong>注意：</strong>以下操作會永久刪除資料，請謹慎操作！
            </div>

            <!-- localStorage 狀態資訊 -->
            <div class="card mb-4">
                <div class="card-header">
                    <h6 class="card-title mb-0"><i class="bi bi-info-circle"></i> 儲存狀態</h6>
                </div>
                <div class="card-body">
                    <div id="storageInfo">
                        <div class="d-flex justify-content-between">
                            <span>自訂提示詞 (customPrompts):</span>
                            <span id="customPromptsCount">-</span>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span>自訂資料 (customPromptData):</span>
                            <span id="customPromptDataCount">-</span>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span>個人標籤:</span>
                            <span id="personalTagsCount">-</span>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span>統一標籤:</span>
                            <span id="allTagsCount">-</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 清除選項 -->
            <div class="card">
                <div class="card-header">
                    <h6 class="card-title mb-0"><i class="bi bi-trash"></i> 清除選項</h6>
                </div>
                <div class="card-body">
                    <div class="d-grid gap-2">
                        <button type="button" class="btn btn-dark" id="clearCustomPromptsBtn">
                            <i class="bi bi-trash"></i> 清除自訂提示詞 (customPrompts)
                        </button>
                        <button type="button" class="btn btn-dark" id="clearCustomPromptDataBtn">
                            <i class="bi bi-trash"></i> 清除自訂資料 (customPromptData)
                        </button>
                        <button type="button" class="btn btn-dark" id="clearPersonalTagsBtn">
                            <i class="bi bi-tag"></i> 清除個人標籤
                        </button>
                        <hr>
                        <button type="button" class="btn btn-dark" id="clearAllDataBtn">
                            <i class="bi bi-exclamation-triangle"></i> 清除所有資料
                        </button>
                    </div>
                </div>
            </div>

            <!-- 資料同步選項 -->
            <div class="card mt-3">
                <div class="card-header">
                    <h6 class="card-title mb-0"><i class="bi bi-arrow-repeat"></i> 資料同步</h6>
                </div>
                <div class="card-body">
                    <div class="d-grid gap-2">
                        <button type="button" class="btn btn-dark" id="syncDataBtn">
                            <i class="bi bi-arrow-repeat"></i> 修復資料一致性
                        </button>
                        <button type="button" class="btn btn-dark" id="verifyDataBtn">
                            <i class="bi bi-check-circle"></i> 驗證資料完整性
                        </button>
                    </div>
                </div>
            </div>

            <!-- 資料結構統一 -->
            <div class="card mt-3">
                <div class="card-header">
                    <h6 class="card-title mb-0"><i class="bi bi-diagram-3"></i> 資料結構優化</h6>
                </div>
                <div class="card-body">
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle"></i>
                        <strong>建議操作：</strong>目前系統使用兩個重複的資料結構，建議統一為單一結構以提升效能和避免不一致問題。
                    </div>
                    <div class="d-grid gap-2">
                        <button type="button" class="btn btn-dark" id="unifyDataStructureBtn">
                            <i class="bi bi-arrow-down-up"></i> 統一為 customPromptData 結構
                        </button>
                        <button type="button" class="btn btn-dark" id="checkDataRedundancyBtn">
                            <i class="bi bi-search"></i> 檢查資料冗餘
                        </button>
                    </div>
                </div>
            </div>
        `
    },
    'tag-management': {
        title: '標籤管理',
        icon: 'bi-tags',
        content: `
            <!-- 新增標籤區域 -->
            <div class="mb-4">
                <h6 class="fw-bold mb-3">新增標籤</h6>
                <div class="input-group">
                    <input type="text" class="form-control" id="newTagDetailInput" placeholder="輸入新標籤名稱">
                    <button class="btn btn-dark" type="button" id="addTagDetailBtn">
                        <i class="bi bi-plus"></i> 新增
                    </button>
                </div>
                <div class="form-text">標籤名稱不可重複，不可為空</div>
            </div>

            <!-- 標籤列表區域 -->
            <div class="mb-3">
                <h6 class="fw-bold mb-3">標籤列表</h6>

                <!-- 所有標籤 -->
                <div class="mb-3">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-tags me-2"></i>
                            <span class="fw-semibold">所有標籤</span>
                        </div>
                        <div>
                            <button class="btn btn-dark" id="cleanUnusedTagsDetailBtn">
                                <i class="bi bi-trash"></i> 清理未使用
                            </button>
                        </div>
                    </div>
                    <div id="allTagsDetailList" class="border rounded p-3">
                        <!-- 所有標籤將在這裡動態載入 -->
                    </div>
                </div>
            </div>
        `,
        footer: `
            <button type="button" class="btn btn-secondary" id="backToSettingsBtn">
                <i class="bi bi-arrow-left"></i> 返回設定
            </button>
        `
    }
};

// 統一開啟詳細面板
function openDetailPanel(type, data = null) {
    console.log(`=== openDetailPanel 開始 (${type}) ===`);

    // 檢查螢幕寬度，決定使用 modal 還是右側面板
    const isDesktop = window.innerWidth >= 768;
    console.log('是否為桌面模式:', isDesktop);

    if (isDesktop) {
        // 桌面模式：使用右側面板
        openDetailPanelDesktop(type, data);
    } else {
        // 手機模式：使用 modal
        openDetailPanelMobile(type, data);
    }

    console.log(`=== openDetailPanel 完成 (${type}) ===`);
}

// 桌面模式：開啟右側面板
function openDetailPanelDesktop(type, data = null) {
    console.log(`🏠 [openDetailPanelDesktop] 開始執行 (${type})`);

    const template = detailTemplates[type];
    if (!template) {
        console.error('❌ [openDetailPanelDesktop] 未找到對應的面板模板:', type);
        return;
    }

    // 切換版面配置
    const cardsContainer = document.getElementById('promptCardsContainer');
    const detailContainer = document.getElementById('promptDetailContainer');

    console.log('🏠 [openDetailPanelDesktop] 切換前狀態:');
    console.log('  - 卡片容器類別:', cardsContainer.className);
    console.log('  - 詳情容器類別:', detailContainer.className);
    console.log('  - currentType:', detailContainer.dataset.currentType);
    console.log('  - currentMode:', detailContainer.dataset.currentMode);

    // 生成面板 HTML
    const panelHTML = `
        <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center p-4">
                <h5 class="card-title mb-0"><i class="${template.icon}"></i> ${template.title}</h5>
                <button type="button" class="btn-close" id="closeDetailPanelBtn" aria-label="關閉"></button>
            </div>
            <div class="card-body">
                ${template.content}
            </div>
            ${template.footer ? `<div class="card-footer">${template.footer}</div>` : ''}
        </div>
    `;

    // 設定面板內容
    detailContainer.innerHTML = panelHTML;

    // 設定資料屬性以追蹤當前面板類型
    detailContainer.dataset.currentType = type;

    // 更新版面配置
    cardsContainer.className = 'col-3 border rounded p-3';
    detailContainer.className = 'col-9';

    // 先清除所有按鈕的 active 狀態，然後根據面板類型設定對應按鈕
    console.log('🏠 [openDetailPanelDesktop] 清除按鈕狀態並設定新狀態');
    clearActiveHeaderButtons();
    if (type === 'settings') {
        setActiveHeaderButton('settingsBtn');
        // 清除新增表單的模式標記，確保狀態一致性
        console.log('🏠 [openDetailPanelDesktop] 清除 currentMode 標記');
        delete detailContainer.dataset.currentMode;
    } else if (type === 'add') {
        setActiveHeaderButton('addPromptHeaderBtn');
        // 設定新增表單的模式標記
        console.log('🏠 [openDetailPanelDesktop] 設定 currentMode = add');
        detailContainer.dataset.currentMode = 'add';
    }

    console.log('🏠 [openDetailPanelDesktop] 狀態設定完成:');
    console.log('  - currentType:', detailContainer.dataset.currentType);
    console.log('  - currentMode:', detailContainer.dataset.currentMode);
    console.log('  - 卡片容器類別:', cardsContainer.className);
    console.log('  - 詳情容器類別:', detailContainer.className);

    // 綁定對應的事件
    bindDetailEvents(type, data);

    console.log(`✅ [openDetailPanelDesktop] ${template.title}面板已開啟`);
    console.log(`🏠 [openDetailPanelDesktop] 執行完成 (${type})`);
}

// 手機模式：開啟 Modal
function openDetailPanelMobile(type, data = null) {
    console.log(`=== openDetailPanelMobile 開始 (${type}) ===`);

    // 根據類型開啟對應的 Modal
    let modalId = '';
    switch (type) {
        case 'settings':
            modalId = 'settingsModal';
            break;
        case 'tag-management':
            modalId = 'tagManagementModal';
            break;
        default:
            console.error('未支援的手機模式面板類型:', type);
            return;
    }

    const modal = new bootstrap.Modal(document.getElementById(modalId));

    // 先清除所有按鈕的 active 狀態，然後根據面板類型設定對應按鈕
    clearActiveHeaderButtons();
    if (type === 'settings') {
        setActiveHeaderButton('settingsBtn');
    }

    modal.show();

    console.log(`=== openDetailPanelMobile 完成 (${type}) ===`);
}

// 統一關閉詳細面板
function closeDetailPanel() {
    console.log('❌ [closeDetailPanel] 開始執行');

    const cardsContainer = document.getElementById('promptCardsContainer');
    const detailContainer = document.getElementById('promptDetailContainer');

    console.log('❌ [closeDetailPanel] 關閉前狀態:');
    console.log('  - currentType:', detailContainer.dataset.currentType);
    console.log('  - currentMode:', detailContainer.dataset.currentMode);
    console.log('  - 詳情容器類別:', detailContainer.className);

    // 還原版面配置
    cardsContainer.className = 'col-12';
    detailContainer.className = 'col-9 d-none';
    detailContainer.innerHTML = '';

    // 清除資料屬性
    detailContainer.removeAttribute('data-current-type');
    detailContainer.removeAttribute('data-current-mode');
    detailContainer.removeAttribute('data-current-prompt-id');

    // 清除所有卡片的 active 狀態
    clearActiveCards();

    // 設定首頁按鈕為 active 狀態（表示回到首頁）
    setActiveHeaderButton('homeBtn');

    console.log('❌ [closeDetailPanel] 清除後狀態:');
    console.log('  - currentType:', detailContainer.dataset.currentType);
    console.log('  - currentMode:', detailContainer.dataset.currentMode);
    console.log('  - 詳情容器類別:', detailContainer.className);
    console.log('❌ [closeDetailPanel] 執行完成');
}

// 綁定對應類型的事件
function bindDetailEvents(type, data = null) {
    console.log(`=== bindDetailEvents 開始 (${type}) ===`);

    // 統一綁定關閉按鈕事件
    const closeBtn = document.getElementById('closeDetailPanelBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeDetailPanel);
        console.log('✅ 綁定關閉按鈕事件');
    }

    // 根據類型綁定特定事件
    switch (type) {
        case 'settings':
            bindSettingsDetailEvents();
            break;
        case 'tag-management':
            bindTagManagementDetailEvents();
            loadTagManagementDetailData();
            break;
        case 'data-management':
            bindDataManagementEvents();
            loadDataManagementInfo();
            break;
    }

    console.log(`=== bindDetailEvents 完成 (${type}) ===`);
}

// 綁定設定面板事件
function bindSettingsDetailEvents() {
    console.log('=== bindSettingsDetailEvents 開始 ===');

    // 管理標籤按鈕
    const manageTagsBtn = document.getElementById('manageTagsDetailBtn');
    if (manageTagsBtn) {
        manageTagsBtn.addEventListener('click', function () {
            console.log('點擊管理標籤按鈕');
            openDetailPanel('tag-management');
        });
        console.log('✅ 綁定管理標籤按鈕事件');
    }

    // 資料管理按鈕
    const dataManagementBtn = document.getElementById('dataManagementDetailBtn');
    if (dataManagementBtn) {
        dataManagementBtn.addEventListener('click', function () {
            console.log('點擊資料管理按鈕');
            openDetailPanel('data-management');
        });
        console.log('✅ 綁定資料管理按鈕事件');
    }

    // 匯出資料按鈕
    const exportBtn = document.getElementById('exportDataDetailBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function () {
            console.log('點擊匯出資料按鈕');
            exportData();
        });
        console.log('✅ 綁定匯出資料按鈕事件');
    }

    // 匯入資料按鈕
    const importBtn = document.getElementById('importDataDetailBtn');
    if (importBtn) {
        importBtn.addEventListener('click', function () {
            console.log('點擊匯入資料按鈕');
            document.getElementById('importFileInput').click();
        });
        console.log('✅ 綁定匯入資料按鈕事件');
    }

    // 關於按鈕
    const aboutBtn = document.getElementById('aboutDetailBtn');
    if (aboutBtn) {
        aboutBtn.addEventListener('click', function () {
            console.log('點擊關於按鈕');
            showAbout();
        });
        console.log('✅ 綁定關於按鈕事件');
    }

    console.log('=== bindSettingsDetailEvents 完成 ===');
}

// ============ 舊版設定面板函數（保持向後相容） ============

// 開啟設定面板
function openSettingsPanel() {
    console.log('⚙️ [openSettingsPanel] 開始執行');

    // 使用統一的面板管理系統
    openDetailPanel('settings');

    console.log('⚙️ [openSettingsPanel] 執行完成');
}

// 處理匯入點擊
function handleImportClick() {
    console.log('觸發匯入資料');
    document.getElementById('importFileInput').click();
}

// 處理關於點擊
function handleAboutClick() {
    console.log('觸發關於資訊');
    showAbout();
}

// 顯示關於資訊
function showAbout() {
    alert('提示詞管理系統\n版本: 2.0\n作者: 陳重年 Chen Chung Nien');
}

// 更新右側表單的標籤選項
function updateDetailTagOptions() {
    const tagSelect = document.getElementById('detailNewPromptTag');

    // 如果元素不存在，直接返回（表單可能還沒有創建）
    if (!tagSelect) {
        return;
    }

    // 清空現有選項
    tagSelect.innerHTML = '<option value="">請選擇標籤</option>';

    // 使用統一標籤陣列
    allTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagSelect.appendChild(option);
    });
}

// 更新編輯提示詞表單的標籤選項
function updateEditTagOptions() {
    const tagSelect = document.getElementById('detailPromptTag');

    // 如果元素不存在，直接返回（表單可能還沒有創建）
    if (!tagSelect) {
        return;
    }

    // 儲存當前選中的值
    const currentValue = tagSelect.value;

    // 清空現有選項
    tagSelect.innerHTML = '<option value="">請選擇標籤</option>';

    // 使用統一標籤陣列
    allTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagSelect.appendChild(option);
    });

    // 恢復之前選中的值
    if (currentValue) {
        tagSelect.value = currentValue;
    }
}

// 從右側表單儲存新提示詞
async function saveNewPromptFromDetail() {
    const newPrompt = {
        id: document.getElementById('detailNewPromptId').value.trim(),
        displayTitle: document.getElementById('detailNewPromptDisplayTitle').value.trim(),
        author: document.getElementById('detailNewPromptAuthor').value.trim(),
        tag: document.getElementById('detailNewPromptTag').value,
        content: document.getElementById('detailNewPromptContent').value.trim(),
        description: document.getElementById('detailNewPromptDescription').value.trim() || '初版'
    };

    // 嚴格驗證必填欄位 - 防止儲存空白或不完整的提示詞
    if (!newPrompt.id || !newPrompt.displayTitle || !newPrompt.author || !newPrompt.tag || !newPrompt.content) {
        alert('請填寫所有必填欄位');
        return;
    }

    // 額外驗證：確保內容不是只有空白字符
    if (newPrompt.content.length < 5) {
        alert('提示詞內容太短，請至少輸入5個字符');
        return;
    }

    // 驗證提示詞 ID
    const idError = validatePromptId(newPrompt.id);
    if (idError) {
        alert(idError);
        return;
    }

    // 建立新提示詞資料結構
    const promptData = {
        metadata: {
            tag: newPrompt.tag,
            author: newPrompt.author,
            displayTitle: newPrompt.displayTitle,
            activeVersion: 'v1',
            draft: false
        },
        v1: {
            description: newPrompt.description,
            name: newPrompt.displayTitle,
            content: newPrompt.content
        }
    };

    // 儲存到 customPrompts
    customPrompts[newPrompt.id] = promptData;

    // 如果是新標籤，加入到個人標籤
    if (!allTags.includes(newPrompt.tag) && !personalTags.includes(newPrompt.tag)) {
        personalTags.push(newPrompt.tag);
    }

    // 儲存到 localStorage
    savePersonalSettings();

    // 除錯：確認資料已儲存
    console.log('新提示詞已儲存:', newPrompt.id, customPrompts[newPrompt.id]);
    console.log('當前所有自訂提示詞:', Object.keys(customPrompts));

    // 關閉表單
    closeAddPromptForm();

    // 重新載入卡片
    await loadCards();

    // 顯示成功訊息並自動開啟詳情
    alert('提示詞建立成功！');

    // 自動開啟新建立的提示詞詳情
    setTimeout(() => {
        openModal(newPrompt.id);
    }, 100);
}

// 更新標籤選項
function updateTagOptions() {
    const tagSelect = document.getElementById('newPromptTag');

    // 清空現有選項
    tagSelect.innerHTML = '<option value="">請選擇標籤</option>';

    // 使用統一標籤陣列
    allTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagSelect.appendChild(option);
    });
}

// 驗證提示詞 ID
function validatePromptId(id) {
    // 檢查格式：只能包含小寫字母、數字和連字符
    const idPattern = /^[a-z0-9-]+$/;
    if (!idPattern.test(id)) {
        return '提示詞 ID 只能包含小寫英文字母、數字和連字符';
    }

    // 檢查是否已存在
    if (defaultPrompts.some(p => p.id === id) || customPrompts[id]) {
        return '此提示詞 ID 已存在，請使用不同的 ID';
    }

    return null; // 驗證通過
}

// 儲存新提示詞
function saveNewPrompt() {
    const form = document.getElementById('addPromptForm');
    const formData = new FormData(form);

    const newPrompt = {
        id: document.getElementById('newPromptId').value.trim(),
        displayTitle: document.getElementById('newPromptDisplayTitle').value.trim(),
        author: document.getElementById('newPromptAuthor').value.trim(),
        tag: document.getElementById('newPromptTag').value,
        content: document.getElementById('newPromptContent').value.trim(),
        description: document.getElementById('newPromptDescription').value.trim() || '初版'
    };

    // 嚴格驗證必填欄位 - 防止儲存空白或不完整的提示詞
    if (!newPrompt.id || !newPrompt.displayTitle || !newPrompt.author || !newPrompt.tag || !newPrompt.content) {
        alert('請填寫所有必填欄位');
        return;
    }

    // 額外驗證：確保內容不是只有空白字符
    if (newPrompt.content.length < 5) {
        alert('提示詞內容太短，請至少輸入5個字符');
        return;
    }

    // 驗證提示詞 ID
    const idError = validatePromptId(newPrompt.id);
    if (idError) {
        alert(idError);
        return;
    }

    // 建立新提示詞資料結構
    const promptData = {
        metadata: {
            tag: newPrompt.tag,
            author: newPrompt.author,
            displayTitle: newPrompt.displayTitle,
            activeVersion: 'v1',
            draft: false
        },
        v1: {
            description: newPrompt.description,
            name: newPrompt.displayTitle,
            content: newPrompt.content
        }
    };

    // 儲存到 customPrompts
    customPrompts[newPrompt.id] = promptData;

    // 如果是新標籤，加入到個人標籤
    if (!allTags.includes(newPrompt.tag) && !personalTags.includes(newPrompt.tag)) {
        personalTags.push(newPrompt.tag);
    }

    // 儲存到 localStorage
    savePersonalSettings();

    // 關閉對話框
    const modal = bootstrap.Modal.getInstance(document.getElementById('addPromptModal'));
    modal.hide();

    // 重新載入卡片
    loadCards();

    // 顯示成功訊息
    alert('提示詞建立成功！');
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
                    <div class="input-group">
                        <select class="form-select" id="detailPromptVersion" disabled>
                            <!-- 版本選項會動態生成 -->
                        </select>
                        <button type="button" class="btn btn-outline-dark" id="addVersionBtn" title="新增版本">
                            新增
                        </button>
                        <button type="button" class="btn btn-outline-dark" id="deleteVersionBtn" title="刪除版本" style="display: none;">
                            刪除
                        </button>
                        <button type="button" class="btn btn-outline-dark" id="setActiveVersionBtn" title="設為預設版本" style="display: none;">
                            預設
                        </button>
                    </div>
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
                    <button type="button" class="btn btn-dark d-none" id="resetDetailPromptBtn">重置</button>
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
    cardsContainer.className = 'col-3 border rounded p-3';
    detailContainer.className = 'col-9';

    // 清除所有頂部按鈕的 active 狀態（提示詞詳情時，兩個按鈕都不應該是 active）
    clearActiveHeaderButtons();

    // 更新詳情區域的內容，並標記提示詞類型
    const isCustomPrompt = customPrompts[promptId] !== undefined;
    populateDetailForm(promptId, data, isCustomPrompt);

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
    const addVersionBtn = document.getElementById('addVersionBtn');
    const deleteVersionBtn = document.getElementById('deleteVersionBtn');
    const setActiveVersionBtn = document.getElementById('setActiveVersionBtn');

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
        if (addVersionBtn) addVersionBtn.disabled = true; // 編輯模式下禁用新增版本按鈕
        if (deleteVersionBtn) deleteVersionBtn.disabled = true; // 編輯模式下禁用刪除版本按鈕
        if (setActiveVersionBtn) setActiveVersionBtn.disabled = true; // 編輯模式下禁用設為預設版本按鈕
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
        if (addVersionBtn) addVersionBtn.disabled = false; // 檢視模式下啟用新增版本按鈕
        if (deleteVersionBtn) deleteVersionBtn.disabled = false; // 檢視模式下啟用刪除版本按鈕
        if (setActiveVersionBtn) setActiveVersionBtn.disabled = false; // 檢視模式下啟用設為預設版本按鈕
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

    // 設定首頁按鈕為 active 狀態（表示回到首頁）
    setActiveHeaderButton('homeBtn');

    // 清空當前提示詞 ID
    detailContainer.removeAttribute('data-current-prompt-id');
}

function bindDetailEventListeners() {
    console.log('=== bindDetailEventListeners 開始 ===');

    // 重置按鈕
    const resetBtn = document.getElementById('resetDetailPromptBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetDetailPrompt);
        console.log('✅ 綁定重置按鈕事件');
    }

    // ChatGPT 按鈕
    const chatgptBtn = document.getElementById('useGptsFromDetailBtn');
    if (chatgptBtn) {
        chatgptBtn.addEventListener('click', openChatGptWithDetailContent);
        console.log('✅ 綁定 ChatGPT 按鈕事件');
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
        console.log('✅ 綁定複製按鈕事件');
    }

    // 編輯按鈕
    const editBtn = document.getElementById('editPromptBtn');
    if (editBtn) {
        editBtn.addEventListener('click', toggleEditMode);
        console.log('✅ 綁定編輯按鈕事件');
    }

    // 新增版本按鈕
    const addVersionBtn = document.getElementById('addVersionBtn');
    if (addVersionBtn) {
        addVersionBtn.addEventListener('click', openAddVersionModal);
        console.log('✅ 綁定新增版本按鈕事件');
    }

    // 刪除版本按鈕
    const deleteVersionBtn = document.getElementById('deleteVersionBtn');
    if (deleteVersionBtn) {
        deleteVersionBtn.addEventListener('click', confirmDeleteVersion);
        console.log('✅ 綁定刪除版本按鈕事件');
    }

    // 設為預設版本按鈕
    const setActiveVersionBtn = document.getElementById('setActiveVersionBtn');
    if (setActiveVersionBtn) {
        setActiveVersionBtn.addEventListener('click', setAsActiveVersion);
        console.log('✅ 綁定設為預設版本按鈕事件');
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
        console.log('✅ 綁定 ChatWise 按鈕事件');
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
        console.log('✅ 綁定 textarea 自動調整事件');
    }

    // 為所有可編輯欄位添加自動保存
    const editableFields = [
        displayTitleInput, authorInput, draftCheckbox,
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
    console.log('✅ 綁定可編輯欄位自動保存事件，欄位數量:', editableFields.filter(f => f).length);

    // 標籤選擇器需要立即保存，不使用防抖
    if (tagSelect) {
        tagSelect.addEventListener('change', () => {
            if (currentEditingPromptId) {
                console.log('🏷️ 標籤變更事件觸發，新標籤值:', tagSelect.value);
                console.log('當前編輯中的提示詞 ID:', currentEditingPromptId);

                // 如果是新的個人標籤，確保它在 personalTags 中
                const newTag = tagSelect.value;
                if (!allTags.includes(newTag) && !personalTags.includes(newTag)) {
                    console.log('📌 添加新的個人標籤:', newTag);
                    personalTags.push(newTag);
                    // 儲存個人標籤
                    localStorage.setItem('personalTags', JSON.stringify(personalTags));
                    console.log('✅ 個人標籤已儲存到 localStorage');
                }

                console.log('💾 開始保存標籤變更...');
                saveDetailPromptToLocalStorage();

                console.log('🔄 開始更新左側卡片標籤顯示...');
                // 立即更新左側卡片顯示
                updatePromptCardTag(currentEditingPromptId, newTag);
                console.log('✅ 標籤變更處理完成');
            }
        });
        console.log('✅ 綁定標籤選擇器立即保存事件');
    }

    // 防抖保存函數
    const debouncedSave = debounce(() => {
        if (currentEditingPromptId) {
            console.log('⏰ 防抖保存觸發');
            saveDetailPromptToLocalStorage();
        }
    }, 1000);

    console.log('=== bindDetailEventListeners 完成 ===');
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

// 設定指定頂部按鈕為 active 狀態
function setActiveHeaderButton(buttonId) {
    console.log(`🎯 [setActiveHeaderButton] 設定按鈕為 active:`, buttonId);

    // 先清除所有頂部按鈕的 active 狀態
    clearActiveHeaderButtons();

    // 為指定按鈕添加 active 狀態
    const buttonElement = document.getElementById(buttonId);
    if (buttonElement) {
        console.log(`🎯 [setActiveHeaderButton] 按鈕 ${buttonId} 設定為 active`);
        buttonElement.classList.add('active');
        // 將 btn-outline-dark 改為 btn-dark 以顯示 active 效果
        buttonElement.classList.remove('btn-outline-dark');
        buttonElement.classList.add('btn-dark');
    } else {
        console.error(`🎯 [setActiveHeaderButton] 找不到按鈕:`, buttonId);
    }
}

// 清除所有頂部按鈕的 active 狀態
function clearActiveHeaderButtons() {
    console.log('🧹 [clearActiveHeaderButtons] 清除所有按鈕的 active 狀態');
    const headerButtons = ['homeBtn', 'addPromptHeaderBtn', 'settingsBtn'];
    headerButtons.forEach(buttonId => {
        const buttonElement = document.getElementById(buttonId);
        if (buttonElement) {
            const wasActive = buttonElement.classList.contains('active');
            // 無條件移除 active 類別和深色樣式
            buttonElement.classList.remove('active');
            buttonElement.classList.remove('btn-dark');
            buttonElement.classList.add('btn-outline-dark');
            if (wasActive) {
                console.log(`🧹 [clearActiveHeaderButtons] 按鈕 ${buttonId} active 狀態已清除`);
            }
        }
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
function populateDetailForm(promptId, displayData, isCustomPrompt = false) {
    // 確保標籤選項是最新的 - 更新編輯表單的標籤選項
    updateEditTagOptions();

    let rawData = null;
    let customData = null;

    if (isCustomPrompt) {
        // 對於自訂提示詞，直接從 customPrompts 獲取資料
        rawData = customPrompts[promptId];
        if (!rawData) {
            console.error('找不到自訂提示詞資料:', promptId);
            return;
        }
    } else {
        // 對於原始提示詞，從 originalYamlData 獲取資料
        rawData = originalYamlData?.prompt?.[promptId];
        if (!rawData) {
            console.error('找不到原始資料:', promptId);
            return;
        }

        // 檢查是否有自訂資料
        try {
            const allCustomData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
            customData = allCustomData[promptId];
        } catch (e) {
            console.error('解析 localStorage 資料失敗:', e);
        }
    }

    // 使用自訂資料或原始資料
    const metadata = customData?.metadata || rawData.metadata;
    const activeVersion = metadata.activeVersion || 'v1';
    console.log(`[VERSION] 載入版本詳情: ${promptId}, 啟用版本: ${activeVersion}`);

    // 版本資料優先使用自訂資料，如果沒有則使用原始資料
    let versionData;
    if (customData?.versions?.[activeVersion]) {
        versionData = customData.versions[activeVersion];
        console.log(`[VERSION] 使用自訂版本資料: ${activeVersion}`);
    } else if (isCustomPrompt) {
        // 對於自訂提示詞，直接使用版本資料
        versionData = rawData[activeVersion];
        console.log(`[VERSION] 使用自訂提示詞版本資料: ${activeVersion}`);
    } else {
        versionData = rawData[activeVersion];
        console.log(`[VERSION] 使用原始版本資料: ${activeVersion}`);
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
    let allVersions = [];
    if (isCustomPrompt) {
        // 對於自訂提示詞，只從自訂資料中獲取版本
        allVersions = Object.keys(rawData).filter(key => key.startsWith('v'));
        console.log(`[VERSION] 自訂提示詞所有版本: ${allVersions.join(', ')}`);
    } else {
        // 對於原始提示詞，合併原始版本和自訂版本
        const originalVersions = Object.keys(rawData).filter(key => key.startsWith('v'));
        const customVersionsList = customData?.versions ? Object.keys(customData.versions) : [];
        allVersions = [...new Set([...originalVersions, ...customVersionsList])]; // 去重
        console.log(`[VERSION] 原始版本: ${originalVersions.join(', ')}, 自訂版本: ${customVersionsList.join(', ')}, 合併版本: ${allVersions.join(', ')}`);
    }
    allVersions.sort(); // 排序版本

    allVersions.forEach(version => {
        const option = document.createElement('option');
        option.value = version;

        // 如果是啟用版本，新增星星標記
        if (version === activeVersion) {
            option.textContent = `${version} - 預設版本`;
            option.selected = true;
        } else {
            option.textContent = version;
        }

        versionSelect.appendChild(option);
    });

    // 更新刪除版本按鈕的顯示狀態
    updateDeleteVersionButtonVisibility(allVersions, activeVersion);

    // 填充當前版本的詳細資訊
    if (versionData) {
        document.getElementById('detailPromptVersionName').value = versionData.name || '';
        document.getElementById('detailPromptVersionDescription').value = versionData.description || '';
        document.getElementById('detailPromptTextarea').value = versionData.content || '';
    }

    // 綁定版本切換事件
    versionSelect.onchange = function () {
        const selectedVersion = this.value;
        console.log(`[VERSION] 切換到版本: ${selectedVersion}`);

        // 更新刪除版本按鈕的顯示狀態
        updateDeleteVersionButtonVisibility(allVersions, selectedVersion);

        // 優先使用自訂版本資料
        let selectedVersionData;
        if (customData?.versions?.[selectedVersion]) {
            selectedVersionData = customData.versions[selectedVersion];
            console.log(`[VERSION] 載入自訂版本資料: ${selectedVersion}`);
        } else if (isCustomPrompt) {
            selectedVersionData = rawData[selectedVersion];
            console.log(`[VERSION] 載入自訂提示詞版本資料: ${selectedVersion}`);
        } else {
            selectedVersionData = rawData[selectedVersion];
            console.log(`[VERSION] 載入原始版本資料: ${selectedVersion}`);
        }

        if (selectedVersionData) {
            document.getElementById('detailPromptVersionName').value = selectedVersionData.name || '';
            document.getElementById('detailPromptVersionDescription').value = selectedVersionData.description || '';
            document.getElementById('detailPromptTextarea').value = selectedVersionData.content || '';

            // 重新調整 textarea 高度
            const textarea = document.getElementById('detailPromptTextarea');
            autoResizeTextarea(textarea);
            console.log(`[VERSION] 版本資料載入完成: ${selectedVersion}`);
        } else {
            console.warn(`[VERSION] 警告: 找不到版本資料 ${selectedVersion}`);
        }
    };
}

// 更新刪除版本按鈕的顯示狀態
function updateDeleteVersionButtonVisibility(allVersions, currentVersion) {
    const deleteVersionBtn = document.getElementById('deleteVersionBtn');
    const setActiveVersionBtn = document.getElementById('setActiveVersionBtn');

    // 獲取當前提示詞的啟用版本
    const detailContainer = document.getElementById('promptDetailContainer');
    const currentPromptId = detailContainer.dataset.currentPromptId;
    const isCustomPrompt = customPrompts[currentPromptId] !== undefined;

    let activeVersion = 'v1';
    if (isCustomPrompt) {
        activeVersion = customPrompts[currentPromptId]?.metadata?.activeVersion || 'v1';
    } else {
        try {
            const allCustomData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
            const customData = allCustomData[currentPromptId];
            activeVersion = customData?.metadata?.activeVersion || originalYamlData?.prompt?.[currentPromptId]?.metadata?.activeVersion || 'v1';
        } catch (e) {
            activeVersion = originalYamlData?.prompt?.[currentPromptId]?.metadata?.activeVersion || 'v1';
        }
    }

    // 刪除按鈕邏輯：版本數量 > 1 且當前版本不是 v1
    const shouldShowDelete = allVersions.length > 1 && currentVersion !== 'v1';
    const shouldShowSetActive = currentVersion !== activeVersion;

    if (deleteVersionBtn) {
        deleteVersionBtn.style.display = shouldShowDelete ? 'block' : 'none';
    }

    // 設為預設版本按鈕邏輯：當前版本不是已啟用的版本
    if (setActiveVersionBtn) {
        setActiveVersionBtn.style.display = shouldShowSetActive ? 'block' : 'none';
    }

    // 動態調整最右邊按鈕的圓角樣式
    updateVersionButtonStyles(shouldShowDelete, shouldShowSetActive);
}

// 新增函數：更新版本按鈕的樣式
function updateVersionButtonStyles(showDelete, showSetActive) {
    const addVersionBtn = document.getElementById('addVersionBtn');
    const deleteVersionBtn = document.getElementById('deleteVersionBtn');
    const setActiveVersionBtn = document.getElementById('setActiveVersionBtn');

    // 移除所有自訂圓角類別
    if (addVersionBtn) {
        addVersionBtn.classList.remove('last-btn-radius');
    }
    if (deleteVersionBtn) {
        deleteVersionBtn.classList.remove('last-btn-radius');
    }
    if (setActiveVersionBtn) {
        setActiveVersionBtn.classList.remove('last-btn-radius');
    }

    // 簡化邏輯：找到最後一個顯示的按鈕並添加圓角
    if (showSetActive) {
        // 如果設為預設版本按鈕顯示，它總是最後一個
        if (setActiveVersionBtn) {
            setActiveVersionBtn.classList.add('last-btn-radius');
        }
    } else if (showDelete) {
        // 如果只有刪除按鈕顯示，它就是最後一個
        if (deleteVersionBtn) {
            deleteVersionBtn.classList.add('last-btn-radius');
        }
    } else {
        // 如果兩個按鈕都不顯示，新增版本按鈕是最後一個
        if (addVersionBtn) {
            addVersionBtn.classList.add('last-btn-radius');
        }
    }
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
    console.log('=== toggleEditMode 開始 ===');
    const detailContainer = document.getElementById('promptDetailContainer');
    const promptId = detailContainer.dataset.currentPromptId;
    console.log('當前提示詞 ID:', promptId);
    console.log('當前編輯中的提示詞 ID:', currentEditingPromptId);

    if (!promptId) {
        console.log('❌ 沒有提示詞 ID，返回');
        return;
    }

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
        console.log('📝 當前是編輯模式，切換到檢視模式');
        console.log('準備保存的標籤值:', tagSelect?.value);

        // 當前是編輯模式，切換到檢視模式並保存
        // 保存所有變更（包括非標籤的變更）
        saveDetailPromptToLocalStorage();
        currentEditingPromptId = null;
        console.log('已清除編輯狀態，currentEditingPromptId 設為 null');

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
        console.log('UI 已設為唯讀模式');

        // 顯示保存成功提示，但不重新載入卡片以避免覆蓋即時更新
        editBtn.textContent = '已儲存';
        setTimeout(() => { editBtn.textContent = '編輯'; }, 1200);
        console.log('顯示保存成功提示');

        console.log('=== toggleEditMode 完成 (保存模式) ===');
        return; // 提早返回，避免執行下面的編輯模式邏輯
    } else {
        console.log('👀 當前是檢視模式，切換到編輯模式');

        // 當前是檢視模式，切換到編輯模式
        currentEditingPromptId = promptId;
        console.log('設置編輯狀態，currentEditingPromptId 設為:', currentEditingPromptId);

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
        console.log('UI 已設為編輯模式');

        // 重新調整 textarea 高度（編輯時可能會改變內容）
        autoResizeTextarea(textarea);
        console.log('=== toggleEditMode 完成 (編輯模式) ===');
    }
}// 保存詳細視圖的內容到 localStorage
function saveDetailPromptToLocalStorage() {
    console.log('=== saveDetailPromptToLocalStorage 開始 ===');
    const detailContainer = document.getElementById('promptDetailContainer');
    const promptId = detailContainer.dataset.currentPromptId;
    const currentMode = detailContainer.dataset.currentMode;
    console.log('保存提示詞 ID:', promptId);
    console.log('當前模式:', currentMode);

    // 如果是新增模式，不執行自動儲存
    if (currentMode === 'add') {
        console.log('❌ 新增模式中，跳過自動儲存');
        return;
    }

    if (!promptId) {
        console.log('❌ 沒有提示詞 ID，返回');
        return;
    }

    const displayTitleInput = document.getElementById('detailPromptDisplayTitle');
    const authorInput = document.getElementById('detailPromptAuthor');
    const tagSelect = document.getElementById('detailPromptTag');
    const draftCheckbox = document.getElementById('detailPromptDraft');
    const versionSelect = document.getElementById('detailPromptVersion');
    const versionNameInput = document.getElementById('detailPromptVersionName');
    const versionDescInput = document.getElementById('detailPromptVersionDescription');
    const textarea = document.getElementById('detailPromptTextarea');

    if (!displayTitleInput || !authorInput || !textarea) {
        console.log('❌ 缺少必要的輸入元素，返回');
        return;
    }

    // 收集當前表單數據
    const formData = {
        displayTitle: displayTitleInput.value,
        author: authorInput.value,
        tag: tagSelect.value,
        draft: draftCheckbox.checked,
        version: versionSelect.value,
        versionName: versionNameInput.value,
        versionDesc: versionDescInput.value,
        content: textarea.value
    };
    console.log('收集的表單數據:', formData);

    // 獲取當前的 localStorage 資料
    let customData = {};
    try {
        customData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
        console.log('當前 localStorage 中的資料:', Object.keys(customData));
    } catch (e) {
        console.error('❌ 解析 localStorage 資料失敗:', e);
        customData = {};
    }

    const selectedVersion = versionSelect.value;
    console.log('選中的版本:', selectedVersion);

    // 更新資料 - 保存完整的提示詞結構
    const newData = {
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
        console.log('保留現有版本資料:', Object.keys(existingData.versions));
        // 合併版本資料，保留其他版本
        newData.versions = {
            ...existingData.versions,
            [selectedVersion]: {
                name: versionNameInput.value,
                description: versionDescInput.value,
                content: textarea.value
            }
        };
    }

    customData[promptId] = newData;
    console.log('準備保存的最終資料結構:', newData);

    // 保存到 localStorage
    try {
        localStorage.setItem('customPromptData', JSON.stringify(customData));
        console.log('✅ 提示詞已保存到 localStorage:', promptId);
        console.log('✅ 保存的標籤:', customData[promptId].metadata.tag);
        console.log('✅ 保存時間:', customData[promptId].updatedAt);
    } catch (e) {
        console.error('❌ 保存到 localStorage 失敗:', e);
    }

    console.log('=== saveDetailPromptToLocalStorage 完成 ===');
}

// 更新特定提示詞卡片的標籤顯示
function updatePromptCardTag(promptId, newTag) {
    console.log('=== updatePromptCardTag 開始 ===');
    console.log('更新卡片標籤 - 提示詞 ID:', promptId, '，新標籤:', newTag);

    // 找到對應的卡片元素
    const cardElement = document.querySelector(`.prompt-card[data-prompt-id="${promptId}"]`);
    if (!cardElement) {
        console.log('❌ 找不到卡片元素:', promptId);
        return;
    }

    console.log('✅ 找到卡片元素:', cardElement);

    // 更新卡片上的標籤顯示
    const tagElement = cardElement.querySelector('.card-text .badge');
    console.log('標籤元素查詢結果:', tagElement);

    if (tagElement) {
        const originalText = tagElement.textContent;
        console.log('原標籤文字:', originalText);
        tagElement.textContent = newTag;
        console.log('✅ 已更新標籤文字為:', tagElement.textContent);

        // 確認更新成功
        if (tagElement.textContent === newTag) {
            console.log('✅ 標籤文字更新成功確認');
        } else {
            console.log('❌ 標籤文字更新失敗，實際值:', tagElement.textContent);
        }

        // 添加視覺效果來突出顯示更新
        tagElement.style.backgroundColor = '#28a745';
        tagElement.style.color = 'white';
        console.log('✅ 添加視覺高亮效果');
        setTimeout(() => {
            tagElement.style.backgroundColor = '';
            tagElement.style.color = '';
            console.log('移除視覺高亮效果');
        }, 1000);
    } else {
        console.log('❌ 找不到標籤元素，嘗試其他選取器');
        // 嘗試其他可能的選取器
        const altTagElement = cardElement.querySelector('.badge');
        console.log('替代標籤元素:', altTagElement);
        if (altTagElement) {
            const originalText = altTagElement.textContent;
            console.log('使用替代選取器，原標籤文字:', originalText);
            altTagElement.textContent = newTag;
            console.log('✅ 已更新標籤文字為:', altTagElement.textContent);
        } else {
            console.log('❌ 所有選取器都找不到標籤元素');
        }
    }

    // 檢查卡片是否需要移動到不同的標籤組
    const currentSection = cardElement.closest('.mb-4');
    const currentSectionHeader = currentSection?.previousElementSibling;
    const currentSectionTag = currentSectionHeader?.textContent;

    console.log('當前區域標籤:', currentSectionTag);
    console.log('目標標籤:', newTag);

    if (currentSectionTag !== newTag) {
        console.log('🔄 需要移動卡片從', currentSectionTag, '到', newTag);

        // 找到目標標籤區域
        let targetSection = null;
        const allHeaders = document.querySelectorAll('#promptCardsContainer h2');
        console.log('搜索目標區域，共找到', allHeaders.length, '個標題');

        for (let header of allHeaders) {
            console.log('檢查標題:', header.textContent);
            if (header.textContent === newTag) {
                targetSection = header.nextElementSibling;
                console.log('✅ 找到目標區域:', targetSection);
                break;
            }
        }

        if (targetSection) {
            console.log('✅ 開始移動卡片到現有區域');
            // 添加移動動畫效果
            cardElement.style.transition = 'all 0.3s ease';
            cardElement.style.transform = 'scale(0.95)';
            cardElement.style.opacity = '0.7';

            setTimeout(() => {
                // 移動卡片到目標區域
                cardElement.remove();
                targetSection.appendChild(cardElement);
                console.log('✅ 卡片已移動到目標區域');

                // 恢復動畫效果
                cardElement.style.transform = 'scale(1)';
                cardElement.style.opacity = '1';

                // 滾動到移動後的卡片位置
                setTimeout(() => {
                    cardElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                    console.log('✅ 滾動到卡片位置');
                }, 100);

            }, 300);

            // 檢查原區域是否還有卡片，如果沒有則隱藏整個區域
            setTimeout(() => {
                if (currentSection) {
                    const remainingCards = currentSection.querySelectorAll('.prompt-card');
                    console.log('原區域剩餘卡片數量:', remainingCards.length);
                    if (remainingCards.length === 0) {
                        console.log('🗑️ 隱藏空的標籤區域:', currentSectionTag);
                        currentSection.style.display = 'none';
                        if (currentSectionHeader) {
                            currentSectionHeader.style.display = 'none';
                        }
                    }
                }
            }, 400);

            // 確保目標區域是可見的
            targetSection.style.display = '';
            const targetHeader = targetSection.previousElementSibling;
            if (targetHeader) {
                targetHeader.style.display = '';
                console.log('✅ 確保目標區域可見');
            }
        } else {
            console.log('❌ 找不到目標區域，需要創建新區域');
            // 如果目標標籤區域不存在，創建新的標籤區域
            console.log('🆕 創建新的標籤區域:', newTag);

            const container = document.getElementById('promptCardsContainer');

            // 創建新的標籤標題
            const tagHeader = document.createElement('h2');
            tagHeader.className = 'mt-2 mb-3 fs-5';
            tagHeader.textContent = newTag;

            // 創建新的組容器
            const groupContainer = document.createElement('div');
            groupContainer.className = 'prompt-grid mb-4';

            // 將新區域添加到容器末尾
            container.appendChild(tagHeader);
            container.appendChild(groupContainer);

            // 添加移動動畫效果
            cardElement.style.transition = 'all 0.3s ease';
            cardElement.style.transform = 'scale(0.95)';
            cardElement.style.opacity = '0.7';

            setTimeout(() => {
                // 移動卡片到新創建的區域
                cardElement.remove();
                groupContainer.appendChild(cardElement);
                console.log('✅ 卡片已移動到新創建的區域');

                // 恢復動畫效果
                cardElement.style.transform = 'scale(1)';
                cardElement.style.opacity = '1';

                // 滾動到移動後的卡片位置
                setTimeout(() => {
                    cardElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                    console.log('✅ 滾動到卡片位置');
                }, 100);

            }, 300);

            // 檢查原區域是否還有卡片，如果沒有則隱藏整個區域
            setTimeout(() => {
                if (currentSection) {
                    const remainingCards = currentSection.querySelectorAll('.prompt-card');
                    console.log('原區域剩餘卡片數量:', remainingCards.length);
                    if (remainingCards.length === 0) {
                        console.log('🗑️ 隱藏空的標籤區域:', currentSectionTag);
                        currentSection.style.display = 'none';
                        if (currentSectionHeader) {
                            currentSectionHeader.style.display = 'none';
                        }
                    }
                }
            }, 400);
        }
    } else {
        console.log('✅ 卡片無需移動，標籤相同');
    }

    console.log('=== updatePromptCardTag 完成 ===');
}

// 全域函數，供 HTML 調用
window.closePromptDetail = closePromptDetail;
window.closeAddPromptForm = closeAddPromptForm;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 =================== 頁面載入開始 ===================');

    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const resetBtn = document.getElementById('resetPromptBtn');

    // 載入個人化設定
    loadPersonalSettings();

    // 在載入個人設定後更新標籤選項
    updateTagOptions();

    // 只在非編輯模式下隱藏 modal 中的重置按鈕
    if (mode !== 'edit') {
        resetBtn.parentElement.style.display = 'none';
        // 註解掉這兩行，讓輸入框和按鈕始終顯示
        // document.getElementById('promptTextarea').parentElement.style.display = 'none';
        // document.getElementById('chatgptLink').style.display = 'none';
    }

    await loadCards();
    // updateLink(); // 移除，因為主頁面不再有輸入框

    // 初始化首頁按鈕為 active 狀態
    setActiveHeaderButton('homeBtn');

    // 修復資料一致性
    syncDataConsistency();

    // 綁定標籤編輯相關事件（需要在 DOM 載入後立即綁定）
    bindTagEditEvents();

    // 驗證 localStorage 版本資料
    verifyLocalStorageVersions();

    // 原有的事件監聽器
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

    // 新增功能的事件監聽器

    // 首頁按鈕 - 回到首頁狀態
    document.getElementById('homeBtn').addEventListener('click', function () {
        console.log('🏠 [首頁按鈕] 被點擊');

        // 檢查是否已經是首頁狀態
        const detailContainer = document.getElementById('promptDetailContainer');
        const cardsContainer = document.getElementById('promptCardsContainer');
        const isHomePage = detailContainer.classList.contains('d-none') &&
            cardsContainer.classList.contains('col-12');

        console.log('🏠 [首頁按鈕] 當前狀態檢查:');
        console.log('  - 詳情容器是否隱藏:', detailContainer.classList.contains('d-none'));
        console.log('  - 卡片容器是否全寬:', cardsContainer.classList.contains('col-12'));
        console.log('  - 是否已在首頁:', isHomePage);

        if (!isHomePage) {
            // 不在首頁狀態，切換到首頁
            console.log('🏠 [首頁按鈕] 切換到首頁狀態');
            closeDetailPanel();
            // 設定首頁按鈕為 active 狀態
            setActiveHeaderButton('homeBtn');
        } else {
            console.log('🏠 [首頁按鈕] 已經在首頁狀態');
        }
    });

    // 設定按鈕 - 支援切換功能（點一次開啟，再點一次關閉）
    document.getElementById('settingsBtn').addEventListener('click', function () {
        console.log('🔧 [設定按鈕] 被點擊');
        const detailContainer = document.getElementById('promptDetailContainer');
        const isSettingsPanelOpen = !detailContainer.classList.contains('d-none') &&
            detailContainer.dataset.currentType === 'settings';

        console.log('🔧 [設定按鈕] 面板狀態檢查:');
        console.log('  - d-none 類別:', detailContainer.classList.contains('d-none'));
        console.log('  - currentType:', detailContainer.dataset.currentType);
        console.log('  - currentMode:', detailContainer.dataset.currentMode);
        console.log('  - isSettingsPanelOpen:', isSettingsPanelOpen);

        if (isSettingsPanelOpen) {
            // 如果設定面板已開啟，則關閉
            console.log('🔧 [設定按鈕] 關閉設定面板');
            closeDetailPanel();
        } else {
            // 如果設定面板未開啟，則開啟
            console.log('🔧 [設定按鈕] 開啟設定面板');
            openSettingsPanel();
        }
    });

    // 標題新增按鈕 - 支援切換功能（點一次開啟，再點一次關閉）
    document.getElementById('addPromptHeaderBtn').addEventListener('click', function () {
        console.log('➕ [新增按鈕] 被點擊');
        const isDesktop = window.innerWidth >= 768;
        console.log('➕ [新增按鈕] 裝置模式:', isDesktop ? '桌面' : '手機');

        if (isDesktop) {
            // 桌面模式：檢查右側面板是否已開啟新增表單
            const detailContainer = document.getElementById('promptDetailContainer');
            const isAddFormOpen = !detailContainer.classList.contains('d-none') &&
                detailContainer.dataset.currentMode === 'add';

            console.log('➕ [新增按鈕] 面板狀態檢查:');
            console.log('  - d-none 類別:', detailContainer.classList.contains('d-none'));
            console.log('  - currentType:', detailContainer.dataset.currentType);
            console.log('  - currentMode:', detailContainer.dataset.currentMode);
            console.log('  - isAddFormOpen:', isAddFormOpen);

            if (isAddFormOpen) {
                // 如果新增表單已開啟，則關閉
                console.log('➕ [新增按鈕] 關閉新增表單');
                closeAddPromptForm();
            } else {
                // 如果新增表單未開啟，則開啟
                console.log('➕ [新增按鈕] 開啟新增表單');
                openAddPromptForm();
            }
        } else {
            // 手機模式：直接開啟 modal
            console.log('➕ [新增按鈕] 開啟手機版 modal');
            openAddPromptModal();
        }
    });

    // 新增提示詞表單提交
    document.getElementById('saveNewPromptBtn').addEventListener('click', saveNewPrompt);

    // 設定選單項目
    document.getElementById('manageTagsBtn').addEventListener('click', function () {
        openTagManagementModal();
    });

    document.getElementById('exportDataBtn').addEventListener('click', exportData);

    document.getElementById('importDataBtn').addEventListener('click', function () {
        document.getElementById('importFileInput').click();
    });

    document.getElementById('aboutBtn').addEventListener('click', function () {
        alert('提示詞管理系統 v1.0\n\n由陳重年開發\n支援新增、編輯、版本管理等功能');
    });

    // 匯入檔案處理
    document.getElementById('importFileInput').addEventListener('change', handleImportFile);

    // 版本管理事件監聽器
    document.getElementById('saveNewVersionBtn').addEventListener('click', saveNewVersion);

    // 監聽視窗大小變化，自動切換顯示方式
    window.addEventListener('resize', function () {
        const detailContainer = document.getElementById('promptDetailContainer');
        const settingsContainer = document.getElementById('settingsDetailContainer');
        const currentPromptId = detailContainer.dataset.currentPromptId;
        const currentMode = detailContainer.dataset.currentMode;

        if (currentPromptId) {
            const isDesktop = window.innerWidth >= 768;

            if (!isDesktop && !detailContainer.classList.contains('d-none')) {
                // 從桌面版切換到手機版，關閉詳情區域並開啟 modal
                closePromptDetail();
                openPromptModal(currentPromptId);
            }
        } else if (currentMode === 'add') {
            const isDesktop = window.innerWidth >= 768;

            if (!isDesktop && !detailContainer.classList.contains('d-none')) {
                // 從桌面版切換到手機版，關閉新增表單並開啟 modal
                closeAddPromptForm();
                openAddPromptModal();
            }
        }

        // 處理設定面板的響應式切換
        if (settingsContainer && !settingsContainer.classList.contains('d-none')) {
            const isDesktop = window.innerWidth >= 768;

            if (!isDesktop) {
                // 從桌面版切換到手機版，關閉設定面板並開啟 modal
                console.log('視窗縮小，關閉設定面板並開啟 modal');
                if (typeof closeSettingsDetailPanel === 'function') {
                    closeSettingsDetailPanel();
                }
                const settingsModal = document.getElementById('settingsModal');
                if (settingsModal) {
                    const modal = new bootstrap.Modal(settingsModal);
                    modal.show();
                }
            }
        }
    });

    // 添加 Modal 關閉事件監聽器，清除頂部按鈕的 active 狀態
    const modalsToWatch = [
        'addPromptModal',
        'settingsModal',
        'tagManagementModal'
    ];

    modalsToWatch.forEach(modalId => {
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
            modalElement.addEventListener('hidden.bs.modal', function () {
                clearActiveHeaderButtons();
            });
        }
    });
});

// =============== 資料管理功能 ===============

// 綁定資料管理面板事件
function bindDataManagementEvents() {
    console.log('=== bindDataManagementEvents 開始 ===');

    // 清除 customPrompts 按鈕
    const clearCustomPromptsBtn = document.getElementById('clearCustomPromptsBtn');
    if (clearCustomPromptsBtn) {
        clearCustomPromptsBtn.addEventListener('click', function () {
            if (confirm('確定要清除所有自訂提示詞 (customPrompts) 嗎？\n\n此操作將永久刪除所有自訂提示詞資料，無法復原！')) {
                clearCustomPrompts();
            }
        });
    }

    // 清除 customPromptData 按鈕
    const clearCustomPromptDataBtn = document.getElementById('clearCustomPromptDataBtn');
    if (clearCustomPromptDataBtn) {
        clearCustomPromptDataBtn.addEventListener('click', function () {
            if (confirm('確定要清除所有自訂資料 (customPromptData) 嗎？\n\n此操作將永久刪除所有自訂版本和修改，無法復原！')) {
                clearCustomPromptData();
            }
        });
    }

    // 清除個人標籤按鈕
    const clearPersonalTagsBtn = document.getElementById('clearPersonalTagsBtn');
    if (clearPersonalTagsBtn) {
        clearPersonalTagsBtn.addEventListener('click', function () {
            if (confirm('確定要清除所有個人標籤嗎？\n\n此操作將永久刪除所有個人標籤，無法復原！')) {
                clearPersonalTags();
            }
        });
    }

    // 清除所有資料按鈕
    const clearAllDataBtn = document.getElementById('clearAllDataBtn');
    if (clearAllDataBtn) {
        clearAllDataBtn.addEventListener('click', function () {
            if (confirm('⚠️ 警告：確定要清除所有資料嗎？\n\n此操作將永久刪除：\n• 所有自訂提示詞\n• 所有自訂版本\n• 所有個人標籤\n• 所有個人設定\n\n此操作無法復原！')) {
                if (confirm('最後確認：您真的要清除所有資料嗎？\n\n請再次確認您了解此操作的後果！')) {
                    clearAllData();
                }
            }
        });
    }

    // 同步資料按鈕
    const syncDataBtn = document.getElementById('syncDataBtn');
    if (syncDataBtn) {
        syncDataBtn.addEventListener('click', function () {
            syncDataConsistency();
            loadDataManagementInfo(); // 重新載入資訊
            alert('資料同步完成！');
        });
    }

    // 驗證資料按鈕
    const verifyDataBtn = document.getElementById('verifyDataBtn');
    if (verifyDataBtn) {
        verifyDataBtn.addEventListener('click', function () {
            verifyLocalStorageVersions();
            alert('資料驗證完成，請查看開發者工具 Console！');
        });
    }

    // 統一資料結構按鈕
    const unifyDataStructureBtn = document.getElementById('unifyDataStructureBtn');
    if (unifyDataStructureBtn) {
        unifyDataStructureBtn.addEventListener('click', function () {
            if (confirm('確定要統一資料結構嗎？\n\n此操作將：\n• 將 customPrompts 的資料遷移到 customPromptData\n• 刪除 customPrompts 的冗餘資料\n• 統一使用 customPromptData 結構\n\n建議在操作前先備份資料！')) {
                unifyDataStructure();
            }
        });
    }

    // 檢查資料冗餘按鈕
    const checkDataRedundancyBtn = document.getElementById('checkDataRedundancyBtn');
    if (checkDataRedundancyBtn) {
        checkDataRedundancyBtn.addEventListener('click', function () {
            checkDataRedundancy();
        });
    }

    console.log('=== bindDataManagementEvents 完成 ===');
}

// 載入資料管理資訊
function loadDataManagementInfo() {
    console.log('=== loadDataManagementInfo 開始 ===');

    try {
        // 獲取各種資料的數量
        const customPrompts = JSON.parse(localStorage.getItem('customPrompts') || '{}');
        const customPromptData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
        const personalTags = JSON.parse(localStorage.getItem('personalTags') || '[]');
        const allTags = JSON.parse(localStorage.getItem('allTags') || '[]');

        // 更新顯示
        const customPromptsCount = document.getElementById('customPromptsCount');
        const customPromptDataCount = document.getElementById('customPromptDataCount');
        const personalTagsCount = document.getElementById('personalTagsCount');
        const allTagsCount = document.getElementById('allTagsCount');

        if (customPromptsCount) {
            customPromptsCount.textContent = `${Object.keys(customPrompts).length} 個項目`;
        }

        if (customPromptDataCount) {
            customPromptDataCount.textContent = `${Object.keys(customPromptData).length} 個項目`;
        }

        if (personalTagsCount) {
            personalTagsCount.textContent = `${personalTags.length} 個標籤`;
        }

        if (allTagsCount) {
            allTagsCount.textContent = `${allTags.length} 個標籤`;
        }

    } catch (e) {
        console.error('載入資料管理資訊失敗:', e);
    }

    console.log('=== loadDataManagementInfo 完成 ===');
}

// 清除函數
function clearCustomPrompts() {
    localStorage.removeItem('customPrompts');
    customPrompts = {};
    console.log('✅ customPrompts 已清除');
    loadDataManagementInfo();
    loadCards(); // 重新載入卡片
    alert('自訂提示詞已清除！');
}

function clearCustomPromptData() {
    localStorage.removeItem('customPromptData');
    console.log('✅ customPromptData 已清除');
    loadDataManagementInfo();
    loadCards(); // 重新載入卡片
    alert('自訂資料已清除！');
}

function clearPersonalTags() {
    localStorage.removeItem('personalTags');
    personalTags = [];
    console.log('✅ personalTags 已清除');
    loadDataManagementInfo();
    alert('個人標籤已清除！');
}

function clearAllData() {
    // 清除所有 localStorage 項目
    const keysToRemove = [
        'customPrompts',
        'customPromptData',
        'personalTags',
        'allTags',
        'customVersions',
        'modifiedPrompts'
    ];

    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
    });

    // 重置全域變數
    customPrompts = {};
    personalTags = [];
    allTags = ['使用中', 'Gemini 生成']; // 恢復預設標籤

    console.log('✅ 所有資料已清除');
    loadDataManagementInfo();
    loadCards(); // 重新載入卡片
    alert('所有資料已清除！頁面將重新載入。');

    // 重新載入頁面以確保狀態完全重置
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

// =============== 標籤管理功能 ===============

// 開啟標籤管理 Modal
// 開啟標籤管理 - 響應式顯示
function openTagManagementModal() {
    console.log('=== openTagManagementModal 開始 ===');

    // 使用統一的面板管理系統
    openDetailPanel('tag-management');

    console.log('=== openTagManagementModal 完成 ===');
}

// 開啟標籤管理 Modal (手機版)
function openTagManagementModalView() {
    // 載入標籤資料
    loadTagManagementData();

    // 顯示 Modal
    const modal = new bootstrap.Modal(document.getElementById('tagManagementModal'));
    modal.show();

    // 在 Modal 關閉時更新所有標籤選擇器
    const modalElement = document.getElementById('tagManagementModal');
    modalElement.addEventListener('hidden.bs.modal', function () {
        updateAllTagSelectors();
    }, { once: true }); // 只執行一次
}

// 開啟標籤管理右側面板 (桌面版)
function openTagManagementDetailPanel() {
    console.log('=== openTagManagementDetailPanel 開始 ===');

    // 在設定面板中顯示標籤管理內容
    const settingsContainer = document.getElementById('settingsDetailContainer');

    if (!settingsContainer) {
        console.warn('settingsDetailContainer 元素不存在，無法顯示標籤管理面板');
        return;
    }

    // 創建標籤管理的 HTML 內容
    const tagManagementHTML = `
        <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center p-4">
                <h5 class="card-title mb-0"><i class="bi bi-tags"></i> 標籤管理</h5>
                <button type="button" class="btn-close" id="closeTagManagementDetailBtn" aria-label="關閉"></button>
            </div>
            <div class="card-body">
                <!-- 新增標籤區域 -->
                <div class="mb-4">
                    <h6 class="fw-bold mb-3">新增標籤</h6>
                    <div class="input-group">
                        <input type="text" class="form-control" id="newTagDetailInput" placeholder="輸入新標籤名稱">
                        <button class="btn btn-dark" type="button" id="addTagDetailBtn">
                            <i class="bi bi-plus"></i> 新增
                        </button>
                    </div>
                    <div class="form-text">標籤名稱不可重複，不可為空</div>
                </div>

                <!-- 標籤列表區域 -->
                <div class="mb-3">
                    <h6 class="fw-bold mb-3">標籤列表</h6>

                    <!-- 全域標籤 -->
                    <div class="mb-3">
                        <div class="d-flex align-items-center mb-2">
                            <i class="bi bi-globe me-2"></i>
                            <span class="fw-semibold">全域標籤（唯讀）</span>
                        </div>
                        <div id="globalTagsDetailList" class="border rounded p-3 bg-dark">
                            <!-- 全域標籤將在這裡動態載入 -->
                        </div>
                    </div>

                    <!-- 個人標籤 -->
                    <div class="mb-3">
                        <div class="d-flex align-items-center justify-content-between mb-2">
                            <div class="d-flex align-items-center">
                                <i class="bi bi-person me-2"></i>
                                <span class="fw-semibold">個人標籤</span>
                            </div>
                            <div>
                                <button class="btn btn-dark" id="cleanUnusedTagsDetailBtn">
                                    <i class="bi bi-trash"></i> 清理未使用
                                </button>
                            </div>
                        </div>
                        <div id="personalTagsDetailList" class="border rounded p-3">
                            <!-- 個人標籤將在這裡動態載入 -->
                        </div>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <button type="button" class="btn btn-secondary" id="backToSettingsBtn">
                    <i class="bi bi-arrow-left"></i> 返回設定
                </button>
            </div>
        </div>
    `;

    // 設定標籤管理面板內容
    settingsContainer.innerHTML = tagManagementHTML;

    // 載入標籤資料到右側面板
    loadTagManagementDetailData();

    // 綁定右側面板的事件
    bindTagManagementDetailEvents();

    console.log('✅ 標籤管理面板已開啟');
    console.log('=== openTagManagementDetailPanel 完成 ===');
}

// 載入標籤管理右側面板資料
function loadTagManagementDetailData() {
    console.log('=== loadTagManagementDetailData 開始 ===');
    loadAllTagsDetail();
    console.log('=== loadTagManagementDetailData 完成 ===');
}

// 載入所有標籤到右側面板
function loadAllTagsDetail() {
    const container = document.getElementById('allTagsDetailList');
    if (!container) return;

    container.innerHTML = '';

    if (allTags.length === 0) {
        container.innerHTML = '<div class="text-muted">沒有標籤</div>';
        return;
    }

    allTags.forEach((tag, index) => {
        const usageCount = getTagUsageCount(tag);
        const tagElement = document.createElement('div');
        tagElement.className = 'd-flex justify-content-between align-items-center mb-2 p-2 bg-white rounded border';

        const isUnused = usageCount === 0;
        const badgeClass = isUnused ? 'bg-dark text-light' : 'bg-dark';

        const canMoveUp = index > 0;
        const canMoveDown = index < allTags.length - 1;

        tagElement.innerHTML = `
            <div>
                <span class="badge ${badgeClass} me-2">${tag}</span>
                <small class="text-muted">${usageCount} 個提示詞${isUnused ? ' (未使用)' : ''}</small>
            </div>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-dark btn-sm ${!canMoveUp ? 'disabled' : ''}" 
                        onclick="moveTagUp('${tag}')" 
                        ${!canMoveUp ? 'disabled' : ''} 
                        title="上移">
                    <i class="bi bi-arrow-up"></i>
                </button>
                <button class="btn btn-outline-dark btn-sm ${!canMoveDown ? 'disabled' : ''}" 
                        onclick="moveTagDown('${tag}')" 
                        ${!canMoveDown ? 'disabled' : ''} 
                        title="下移">
                    <i class="bi bi-arrow-down"></i>
                </button>
                <button class="btn btn-outline-dark btn-sm" onclick="editTagDetail('${tag}')">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-outline-dark btn-sm" onclick="deleteTagDetail('${tag}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(tagElement);
    });
}// 綁定標籤管理右側面板事件
function bindTagManagementDetailEvents() {
    console.log('=== bindTagManagementDetailEvents 開始 ===');

    // 新增標籤按鈕
    const addTagBtn = document.getElementById('addTagDetailBtn');
    const newTagInput = document.getElementById('newTagDetailInput');

    if (addTagBtn) {
        addTagBtn.addEventListener('click', addNewTagFromDetail);
        console.log('✅ 綁定新增標籤按鈕事件');
    }

    if (newTagInput) {
        newTagInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                addNewTagFromDetail();
            }
        });
        console.log('✅ 綁定新增標籤輸入框事件');
    }

    // 清理未使用標籤按鈕
    const cleanBtn = document.getElementById('cleanUnusedTagsDetailBtn');
    if (cleanBtn) {
        cleanBtn.addEventListener('click', cleanUnusedTags);
        console.log('✅ 綁定清理未使用標籤按鈕事件');
    }

    // 返回設定按鈕
    const backBtn = document.getElementById('backToSettingsBtn');
    if (backBtn) {
        backBtn.addEventListener('click', function () {
            console.log('返回設定面板');
            openDetailPanel('settings');
            updateAllTagSelectors(); // 更新標籤選擇器
        });
        console.log('✅ 綁定返回設定按鈕事件');
    }

    // 關閉標籤管理面板按鈕
    const closeBtn = document.getElementById('closeTagManagementDetailBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            console.log('關閉標籤管理面板');
            closeDetailPanel();
            updateAllTagSelectors(); // 更新標籤選擇器
        });
        console.log('✅ 綁定關閉標籤管理按鈕事件');
    }

    console.log('=== bindTagManagementDetailEvents 完成 ===');
}

// 從右側面板新增標籤
function addNewTagFromDetail() {
    const input = document.getElementById('newTagDetailInput');
    const tagName = input.value.trim();

    if (!tagName) {
        alert('請輸入標籤名稱');
        return;
    }

    // 檢查是否重複
    if (allTags.includes(tagName)) {
        alert('標籤名稱已存在');
        return;
    }

    // 新增到統一標籤陣列
    allTags.push(tagName);
    console.log('新增標籤:', tagName);

    // 儲存設定變更
    savePersonalSettings();

    // 重新載入標籤列表
    loadAllTagsDetail();

    // 更新所有標籤選擇器
    updateAllTagSelectors();

    // 清空輸入框
    input.value = '';

    console.log('標籤新增完成:', tagName);
}// 右側面板編輯標籤
function editTagDetail(tagName) {
    console.log('編輯標籤:', tagName);
    // 使用原有的編輯標籤 modal，因為這是一個簡單的輸入對話框
    editTag(tagName);
}

// 右側面板刪除標籤
function deleteTagDetail(tagName) {
    console.log('刪除標籤:', tagName);
    // 使用原有的刪除標籤邏輯
    deleteTag(tagName);
}

// 上移標籤
function moveTagUp(tagName) {
    console.log('=== moveTagUp 開始 ===');
    console.log('上移標籤:', tagName);

    const currentIndex = allTags.indexOf(tagName);
    if (currentIndex <= 0) {
        console.log('標籤已在最上方，無法上移');
        return;
    }

    // 交換位置
    [allTags[currentIndex - 1], allTags[currentIndex]] = [allTags[currentIndex], allTags[currentIndex - 1]];

    console.log('標籤移動後的順序:', allTags);

    // 儲存設定變更
    savePersonalSettings();

    // 重新載入標籤列表
    loadAllTagsDetail();

    // 更新所有標籤選擇器
    updateAllTagSelectors();

    // 重新載入卡片以反映新的標籤順序
    loadCards();

    console.log('=== moveTagUp 完成 ===');
}

// 下移標籤
function moveTagDown(tagName) {
    console.log('=== moveTagDown 開始 ===');
    console.log('下移標籤:', tagName);

    const currentIndex = allTags.indexOf(tagName);
    if (currentIndex < 0 || currentIndex >= allTags.length - 1) {
        console.log('標籤已在最下方，無法下移');
        return;
    }

    // 交換位置
    [allTags[currentIndex], allTags[currentIndex + 1]] = [allTags[currentIndex + 1], allTags[currentIndex]];

    console.log('標籤移動後的順序:', allTags);

    // 儲存設定變更
    savePersonalSettings();

    // 重新載入標籤列表
    loadAllTagsDetail();

    // 更新所有標籤選擇器
    updateAllTagSelectors();

    // 重新載入卡片以反映新的標籤順序
    loadCards();

    console.log('=== moveTagDown 完成 ===');
}

// 載入標籤管理資料
function loadTagManagementData() {
    loadGlobalTags();
    loadPersonalTags();
    bindTagManagementEvents();
}

// 載入全域標籤
function loadGlobalTags() {
    const container = document.getElementById('globalTagsList');
    container.innerHTML = '';

    if (allTags.length === 0) {
        container.innerHTML = '<div class="text-muted">沒有全域標籤</div>';
        return;
    }

    allTags.forEach(tag => {
        const tagElement = createGlobalTagElement(tag);
        container.appendChild(tagElement);
    });
}

// 載入個人標籤
function loadPersonalTags() {
    const container = document.getElementById('personalTagsList');
    container.innerHTML = '';

    if (personalTags.length === 0) {
        container.innerHTML = '<div class="text-muted">沒有個人標籤</div>';
        return;
    }

    personalTags.forEach(tag => {
        const tagElement = createPersonalTagElement(tag);
        container.appendChild(tagElement);
    });
}

// 建立全域標籤元素
function createGlobalTagElement(tagName) {
    const tagDiv = document.createElement('div');
    tagDiv.className = 'badge bg-secondary me-2 mb-2 p-2 d-inline-flex align-items-center';

    const usageCount = getTagUsageCount(tagName);

    tagDiv.innerHTML = `
        <i class="bi bi-tag me-1"></i>
        <span>${tagName}</span>
        <span class="badge bg-dark text-dark ms-2">${usageCount}</span>
    `;

    return tagDiv;
}

// 建立個人標籤元素
function createPersonalTagElement(tagName) {
    const tagDiv = document.createElement('div');
    tagDiv.className = 'badge bg-dark me-2 mb-2 p-2 d-inline-flex align-items-center';

    const usageCount = getTagUsageCount(tagName);
    const isUnused = usageCount === 0;

    if (isUnused) {
        tagDiv.classList.add('bg-dark');
        tagDiv.classList.remove('bg-dark');
    }

    tagDiv.innerHTML = `
        <i class="bi bi-tag me-1"></i>
        <span>${tagName}</span>
        <span class="badge bg-dark text-dark ms-2">${usageCount}</span>
        <button class="btn btn-sm btn-link text-white p-0 ms-2" onclick="editTag('${tagName}')" title="編輯">
            <i class="bi bi-pencil-square"></i>
        </button>
        <button class="btn btn-sm btn-link text-white p-0 ms-1" onclick="deleteTag('${tagName}')" title="刪除">
            <i class="bi bi-trash"></i>
        </button>
    `;

    return tagDiv;
}

// 計算標籤使用次數
function getTagUsageCount(tagName) {
    console.log('=== getTagUsageCount 開始 ===');
    console.log('查詢標籤使用次數:', tagName);
    let count = 0;

    // 統計默認提示詞中的使用次數
    console.log('🔍 檢查預設提示詞...');
    defaultPrompts.forEach(prompt => {
        const promptData = getPromptData(prompt.id);
        if (promptData && promptData.tag === tagName) {
            count++;
            console.log(`  ✅ 預設提示詞「${promptData.title}」使用此標籤`);
        }
    });
    console.log(`預設提示詞中使用次數: ${count}`);

    // 統計自訂提示詞中的使用次數
    console.log('🔍 檢查自訂提示詞...');
    const customCount = count;
    Object.values(customPrompts).forEach(prompt => {
        if (prompt.metadata && prompt.metadata.tag === tagName) {
            count++;
            console.log(`  ✅ 自訂提示詞「${prompt.metadata.displayTitle}」使用此標籤`);
        }
    });
    console.log(`自訂提示詞中使用次數: ${count - customCount}`);

    // 檢查 localStorage 中的其他資料
    console.log('🔍 檢查 localStorage 中的資料...');
    try {
        const customPromptData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
        const localStorageCount = count;
        Object.values(customPromptData).forEach(prompt => {
            if (prompt.metadata && prompt.metadata.tag === tagName && !prompt.metadata.draft) {
                // 檢查是否已經在 customPrompts 中計算過
                const promptId = Object.keys(customPromptData).find(id => customPromptData[id] === prompt);
                if (!customPrompts[promptId]) {
                    count++;
                    console.log(`  ✅ localStorage 提示詞「${prompt.metadata.displayTitle}」使用此標籤`);
                }
            }
        });
        console.log(`localStorage 中額外使用次數: ${count - localStorageCount}`);
    } catch (e) {
        console.log('❌ 檢查 localStorage 時發生錯誤:', e);
    }

    console.log(`📊 標籤「${tagName}」總使用次數: ${count}`);
    console.log('=== getTagUsageCount 完成 ===');
    return count;
}

// 綁定標籤編輯相關事件（頁面載入時立即綁定）
function bindTagEditEvents() {
    // 編輯標籤 Modal 事件
    const saveEditTagBtn = document.getElementById('saveEditTagBtn');
    const confirmDeleteTagBtn = document.getElementById('confirmDeleteTagBtn');

    if (saveEditTagBtn) {
        saveEditTagBtn.onclick = saveEditTag;
    }

    if (confirmDeleteTagBtn) {
        confirmDeleteTagBtn.onclick = confirmDeleteTag;
    }
}

// 綁定標籤管理事件
function bindTagManagementEvents() {
    // 新增標籤按鈕
    const addTagBtn = document.getElementById('addTagBtn');
    const newTagInput = document.getElementById('newTagInput');

    if (addTagBtn) {
        addTagBtn.onclick = addNewTag;
    }

    if (newTagInput) {
        newTagInput.onkeypress = function (e) {
            if (e.key === 'Enter') {
                addNewTag();
            }
        };
    }

    // 清理未使用標籤按鈕
    const cleanUnusedTagsBtn = document.getElementById('cleanUnusedTagsBtn');
    if (cleanUnusedTagsBtn) {
        cleanUnusedTagsBtn.onclick = cleanUnusedTags;
    }

    // 標籤編輯事件已經在 bindTagEditEvents() 中綁定
}

// 新增標籤
function addNewTag() {
    const input = document.getElementById('newTagInput');
    const tagName = input.value.trim();

    if (!tagName) {
        alert('標籤名稱不可為空');
        return;
    }

    // 檢查是否重複
    if (allTags.includes(tagName) || personalTags.includes(tagName)) {
        alert('標籤名稱已存在');
        return;
    }

    // 新增到個人標籤
    personalTags.push(tagName);

    // 儲存到 localStorage
    savePersonalSettings();

    // 重新載入標籤列表
    loadPersonalTags();

    // 更新所有標籤選擇器
    updateAllTagSelectors();

    // 清空輸入框
    input.value = '';

    console.log('新增標籤:', tagName);
}

// 編輯標籤
function editTag(oldTagName) {
    const modal = new bootstrap.Modal(document.getElementById('editTagModal'));
    const input = document.getElementById('editTagInput');

    input.value = oldTagName;
    modal.show();

    // 儲存當前編輯的標籤名稱
    document.getElementById('editTagModal').dataset.currentTag = oldTagName;
}

// 儲存編輯的標籤
function saveEditTag() {
    console.log('=== saveEditTag 開始 ===');

    try {
        const modal = document.getElementById('editTagModal');
        const oldTagName = modal.dataset.currentTag;
        const newTagName = document.getElementById('editTagInput').value.trim();

        console.log('舊標籤名稱:', oldTagName);
        console.log('新標籤名稱:', newTagName);
        console.log('當前 allTags:', allTags);

        if (!newTagName) {
            alert('標籤名稱不可為空');
            return;
        }

        if (newTagName === oldTagName) {
            // 沒有變更，直接關閉
            console.log('標籤名稱沒有變更，關閉 Modal');
            bootstrap.Modal.getInstance(modal).hide();
            return;
        }

        // 檢查新名稱是否重複
        if (allTags.includes(newTagName)) {
            alert('標籤名稱已存在');
            console.log('❌ 標籤名稱重複');
            return;
        }

        // 更新統一標籤陣列
        const tagIndex = allTags.indexOf(oldTagName);
        console.log('舊標籤在陣列中的索引:', tagIndex);

        if (tagIndex !== -1) {
            allTags[tagIndex] = newTagName;
            console.log('✅ 已更新統一標籤陣列:', allTags);
        } else {
            console.log('⚠️ 在 allTags 中找不到舊標籤，直接新增新標籤');
            allTags.push(newTagName);
        }

        // 更新使用此標籤的提示詞
        console.log('開始更新使用此標籤的提示詞...');
        updatePromptsWithTag(oldTagName, newTagName);

        // 儲存變更
        console.log('儲存變更到 localStorage...');
        savePersonalSettings();

        // 重新載入標籤列表和卡片
        console.log('重新載入標籤列表和卡片...');
        updateAllTagSelectors();
        loadCards();

        // 如果標籤管理右側面板處於活動狀態，也要重新載入面板資料
        if (window.innerWidth >= 768 &&
            document.getElementById('promptDetailContainer').style.display !== 'none' &&
            document.getElementById('promptDetailContainer').querySelector('h5')?.textContent.includes('標籤管理')) {
            console.log('✅ 重新載入標籤管理右側面板資料');
            loadTagManagementDetailData();
        }

        // 關閉 Modal
        bootstrap.Modal.getInstance(modal).hide();

        console.log('✅ 標籤重新命名成功:', oldTagName, '->', newTagName);
        alert('標籤已成功更新！');

    } catch (error) {
        console.error('❌ saveEditTag 發生錯誤:', error);
        alert('儲存標籤時發生錯誤: ' + error.message);
    }

    console.log('=== saveEditTag 完成 ===');
}

// 更新使用指定標籤的提示詞
function updatePromptsWithTag(oldTag, newTag) {
    // 更新自訂提示詞
    Object.keys(customPrompts).forEach(promptId => {
        if (customPrompts[promptId].metadata.tag === oldTag) {
            customPrompts[promptId].metadata.tag = newTag;
        }
    });

    // 更新修改過的提示詞
    Object.keys(modifiedPrompts).forEach(promptId => {
        if (modifiedPrompts[promptId].tag === oldTag) {
            modifiedPrompts[promptId].tag = newTag;
        }
    });
}

// 刪除標籤
function deleteTag(tagName) {
    console.log('=== deleteTag 開始 ===');
    console.log('嘗試刪除標籤:', tagName);

    const usageCount = getTagUsageCount(tagName);
    console.log('標籤使用次數:', usageCount);

    // 如果標籤還在使用中，直接阻止並顯示訊息
    if (usageCount > 0) {
        console.log('❌ 標籤仍在使用中，阻止刪除');
        alert(`無法刪除標籤「${tagName}」\n\n此標籤仍被 ${usageCount} 個提示詞使用。\n請先將這些提示詞改為其他標籤，或刪除這些提示詞後再嘗試刪除此標籤。`);
        console.log('=== deleteTag 完成 (刪除被阻止) ===');
        return;
    }

    console.log('✅ 標籤未被使用，可以安全刪除，顯示確認對話框');

    const modal = new bootstrap.Modal(document.getElementById('deleteTagModal'));

    // 設定標籤名稱
    document.getElementById('deleteTagName').textContent = tagName;

    // 隱藏使用情況警告（因為已經確認未使用）
    document.getElementById('tagUsageInfo').classList.add('d-none');

    // 隱藏警告文字
    const warningText = document.getElementById('deleteWarningText');
    if (warningText) {
        warningText.classList.add('d-none');
    }

    // 確認按鈕為正常刪除狀態
    const confirmBtn = document.getElementById('confirmDeleteTagBtn');
    confirmBtn.className = 'btn btn-dark';
    confirmBtn.innerHTML = '<i class="bi bi-trash"></i> 確認刪除';

    console.log('✅ 刪除確認對話框已設定');

    // 儲存要刪除的標籤名稱
    document.getElementById('deleteTagModal').dataset.tagToDelete = tagName;

    modal.show();
    console.log('=== deleteTag 完成 ===');
}

// 確認刪除標籤
function confirmDeleteTag() {
    console.log('=== confirmDeleteTag 開始 ===');
    const modal = document.getElementById('deleteTagModal');
    const tagName = modal.dataset.tagToDelete;
    console.log('確認刪除標籤:', tagName);

    // 由於在 deleteTag 函數中已經檢查過使用次數，這裡可以直接刪除
    // 但為了安全起見，還是再檢查一次
    const usageCount = getTagUsageCount(tagName);
    console.log('最終檢查標籤使用次數:', usageCount);

    if (usageCount > 0) {
        // 這種情況不應該發生，但為了安全起見還是要檢查
        console.log('❌ 意外發現標籤仍在使用中，取消刪除');

        // 關閉確認彈窗
        bootstrap.Modal.getInstance(modal).hide();

        // 顯示錯誤訊息
        setTimeout(() => {
            alert(`刪除失敗：標籤「${tagName}」仍被 ${usageCount} 個提示詞使用。`);
        }, 300);

        console.log('=== confirmDeleteTag 完成 (意外阻止) ===');
        return;
    }

    console.log('✅ 確認標籤未被使用，執行刪除');

    // 從統一標籤陣列中移除
    const tagIndex = allTags.indexOf(tagName);
    if (tagIndex !== -1) {
        allTags.splice(tagIndex, 1);
        console.log('✅ 已從 allTags 陣列移除標籤');
        // 儲存設定變更
        savePersonalSettings();
        console.log('✅ 設定已儲存');
    } else {
        console.log('⚠️ 標籤不在 allTags 陣列中');
    }

    // 重新載入標籤列表
    updateAllTagSelectors();
    loadCards();

    // 如果標籤管理右側面板處於活動狀態，也要重新載入面板資料
    if (window.innerWidth >= 768 &&
        document.getElementById('promptDetailContainer').style.display !== 'none' &&
        document.getElementById('promptDetailContainer').querySelector('h5')?.textContent.includes('標籤管理')) {
        console.log('✅ 重新載入標籤管理右側面板資料');
        loadTagManagementDetailData();
    }

    console.log('✅ 相關界面已更新');

    // 關閉 Modal
    bootstrap.Modal.getInstance(modal).hide();

    console.log('✅ 標籤刪除成功:', tagName);
    console.log('=== confirmDeleteTag 完成 ===');
}

// 清理未使用的標籤
function cleanUnusedTags() {
    console.log('=== cleanUnusedTags 開始 ===');
    console.log('檢查標籤數量:', allTags.length);
    console.log('標籤列表:', allTags);

    const unusedTags = allTags.filter(tag => {
        const usageCount = getTagUsageCount(tag);
        console.log(`標籤「${tag}」使用次數:`, usageCount);
        return usageCount === 0;
    });

    console.log('未使用的標籤:', unusedTags);

    if (unusedTags.length === 0) {
        console.log('✅ 沒有未使用的標籤');
        alert('沒有未使用的標籤');
        return;
    }

    console.log(`⚠️ 發現 ${unusedTags.length} 個未使用的標籤`);
    const confirmed = confirm(`確定要刪除 ${unusedTags.length} 個未使用的標籤嗎？\n\n標籤：${unusedTags.join(', ')}`);

    if (confirmed) {
        console.log('✅ 用戶確認刪除，開始批量刪除');
        // 移除未使用的標籤
        unusedTags.forEach(tag => {
            const index = allTags.indexOf(tag);
            if (index !== -1) {
                allTags.splice(index, 1);
                console.log(`✅ 已刪除標籤: ${tag}`);
            }
        });

        // 儲存變更
        savePersonalSettings();
        console.log('✅ 設定已儲存');

        // 重新載入標籤列表
        updateAllTagSelectors();
        loadCards();
        console.log('✅ 界面已更新');

        alert(`已刪除 ${unusedTags.length} 個未使用的標籤`);
        console.log('✅ 批量刪除完成');
    } else {
        console.log('❌ 用戶取消刪除操作');
    }

    console.log('=== cleanUnusedTags 完成 ===');
}

// 更新所有標籤選擇器
function updateAllTagSelectors() {
    // 更新新增提示詞 Modal 的標籤選項
    updateTagOptions();

    // 更新右側新增表單的標籤選項（如果存在）
    if (document.getElementById('detailNewPromptTag')) {
        updateDetailTagOptions();
    }

    // 更新右側編輯表單的標籤選項（如果存在）
    if (document.getElementById('detailPromptTag')) {
        updateEditTagOptions();
    }
}

// 全域函數供 HTML 調用
window.editTag = editTag;
window.deleteTag = deleteTag;
window.moveTagUp = moveTagUp;
window.moveTagDown = moveTagDown;

// =============== 版本管理功能 ===============

// 開啟新增版本 Modal
function openAddVersionModal() {
    console.log('[VERSION] 開啟新增版本 Modal');

    const detailContainer = document.getElementById('promptDetailContainer');
    const currentPromptId = detailContainer.dataset.currentPromptId;

    if (!currentPromptId) {
        console.error('[VERSION] 錯誤: 無法找到當前提示詞 ID');
        return;
    }

    console.log(`[VERSION] 當前提示詞 ID: ${currentPromptId}`);

    // 獲取當前提示詞資料
    const promptData = getPromptData(currentPromptId);
    if (!promptData) {
        console.error('[VERSION] 錯誤: 無法找到提示詞資料');
        return;
    }

    // 檢查是否為自訂提示詞
    const isCustomPrompt = customPrompts[currentPromptId] !== undefined;
    console.log(`[VERSION] 提示詞類型: ${isCustomPrompt ? '自訂提示詞' : '原始提示詞'}`);

    // 獲取所有版本資訊
    const allVersions = getAllVersionsForPrompt(currentPromptId, isCustomPrompt);
    console.log(`[VERSION] 現有版本: ${allVersions.join(', ')}`);

    // 生成新版本號
    const newVersionNumber = generateNextVersionNumber(allVersions);
    console.log(`[VERSION] 新版本號: ${newVersionNumber}`);

    // 填充 Modal
    document.getElementById('newVersionNumber').value = newVersionNumber;
    document.getElementById('newVersionName').value = '';
    document.getElementById('newVersionDescription').value = '';
    document.getElementById('newVersionContent').value = '';
    document.getElementById('setAsActiveVersion').checked = true;

    // 填充基於版本選擇器
    const baseVersionSelect = document.getElementById('baseVersionSelect');
    baseVersionSelect.innerHTML = '';

    allVersions.forEach(version => {
        const option = document.createElement('option');
        option.value = version;
        option.textContent = version;
        baseVersionSelect.appendChild(option);
    });

    // 預設選擇當前版本
    const currentVersion = document.getElementById('detailPromptVersion').value;
    if (currentVersion) {
        baseVersionSelect.value = currentVersion;
        console.log(`[VERSION] 預設基於版本: ${currentVersion}`);
    }

    // 載入基於版本的內容
    loadBaseVersionContent(currentPromptId, baseVersionSelect.value, isCustomPrompt);

    // 綁定基於版本選擇器的變更事件
    baseVersionSelect.onchange = function () {
        console.log(`[VERSION] 切換基於版本: ${this.value}`);
        loadBaseVersionContent(currentPromptId, this.value, isCustomPrompt);
    };

    // 儲存當前提示詞 ID 到 Modal
    document.getElementById('addVersionModal').dataset.promptId = currentPromptId;
    document.getElementById('addVersionModal').dataset.isCustomPrompt = isCustomPrompt;

    // 顯示 Modal
    const modal = new bootstrap.Modal(document.getElementById('addVersionModal'));
    modal.show();
}

// 獲取提示詞的所有版本
function getAllVersionsForPrompt(promptId, isCustomPrompt) {
    console.log(`[VERSION] 獲取提示詞版本列表: ${promptId} (${isCustomPrompt ? '自訂' : '原始'})`);

    let allVersions = [];

    if (isCustomPrompt) {
        // 對於自訂提示詞，只從自訂資料中獲取版本
        const customPrompt = customPrompts[promptId];
        if (customPrompt) {
            allVersions = Object.keys(customPrompt).filter(key => key.startsWith('v'));
            console.log(`[VERSION] 自訂提示詞版本: ${allVersions.join(', ')}`);
        } else {
            console.warn(`[VERSION] 警告: 找不到自訂提示詞 ${promptId}`);
        }
    } else {
        // 對於原始提示詞，合併原始版本和自訂版本
        const originalData = originalYamlData?.prompt?.[promptId];
        if (originalData) {
            const originalVersions = Object.keys(originalData).filter(key => key.startsWith('v'));
            allVersions = [...originalVersions];
            console.log(`[VERSION] 原始版本: ${originalVersions.join(', ')}`);
        }

        // 檢查是否有自訂版本
        try {
            const allCustomData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
            const customData = allCustomData[promptId];
            if (customData?.versions) {
                const customVersionsList = Object.keys(customData.versions);
                allVersions = [...new Set([...allVersions, ...customVersionsList])]; // 去重
                console.log(`[VERSION] 包含自訂版本: ${customVersionsList.join(', ')}`);
            }
        } catch (e) {
            console.error('[VERSION] 錯誤: 解析 localStorage 資料失敗:', e);
        }
    }

    const sortedVersions = allVersions.sort();
    console.log(`[VERSION] 最終版本列表: ${sortedVersions.join(', ')}`);
    return sortedVersions;
}// 生成下一個版本號
function generateNextVersionNumber(existingVersions) {
    console.log(`[VERSION] 生成下一個版本號`);
    console.log(`[VERSION] 現有版本: ${existingVersions.join(', ')}`);

    // 從現有版本中找出最大的數字
    let maxVersionNumber = 0;

    existingVersions.forEach(version => {
        const match = version.match(/^v(\d+)$/);
        if (match) {
            const versionNumber = parseInt(match[1]);
            console.log(`[VERSION] 解析版本 ${version} -> ${versionNumber}`);
            if (versionNumber > maxVersionNumber) {
                maxVersionNumber = versionNumber;
            }
        }
    });

    const nextVersion = `v${maxVersionNumber + 1}`;
    console.log(`[VERSION] 生成新版本號: ${nextVersion}`);
    return nextVersion;
}

// 載入基於版本的內容
function loadBaseVersionContent(promptId, baseVersion, isCustomPrompt) {
    console.log(`[VERSION] 載入基礎版本內容: ${promptId} - ${baseVersion} (${isCustomPrompt ? '自訂' : '原始'})`);

    let versionData = null;

    if (isCustomPrompt) {
        // 對於自訂提示詞
        const customPrompt = customPrompts[promptId];
        if (customPrompt && customPrompt[baseVersion]) {
            versionData = customPrompt[baseVersion];
            console.log(`[VERSION] 找到自訂提示詞版本資料: ${baseVersion}`);
        } else {
            console.warn(`[VERSION] 警告: 找不到自訂提示詞版本 ${baseVersion}`);
        }
    } else {
        // 對於原始提示詞，先檢查自訂版本，再檢查原始版本
        try {
            const allCustomData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
            const customData = allCustomData[promptId];
            if (customData?.versions?.[baseVersion]) {
                versionData = customData.versions[baseVersion];
                console.log(`[VERSION] 找到自訂版本資料: ${baseVersion}`);
            }
        } catch (e) {
            console.error('[VERSION] 錯誤: 解析 localStorage 資料失敗:', e);
        }

        // 如果沒有自訂版本，使用原始版本
        if (!versionData) {
            const originalData = originalYamlData?.prompt?.[promptId];
            if (originalData && originalData[baseVersion]) {
                versionData = originalData[baseVersion];
                console.log(`[VERSION] 找到原始版本資料: ${baseVersion}`);
            } else {
                console.warn(`[VERSION] 警告: 找不到原始版本 ${baseVersion}`);
            }
        }
    }

    // 填充內容
    if (versionData) {
        document.getElementById('newVersionContent').value = versionData.content || '';
        console.log(`[VERSION] 基礎版本內容已載入: ${versionData.content ? '有內容' : '空內容'}`);
    } else {
        document.getElementById('newVersionContent').value = '';
        console.log(`[VERSION] 沒有找到版本資料，已清空內容`);
    }
}

// 儲存新版本
function saveNewVersion() {
    console.log('[VERSION] 開始儲存新版本');

    const modal = document.getElementById('addVersionModal');
    const promptId = modal.dataset.promptId;
    const isCustomPrompt = modal.dataset.isCustomPrompt === 'true';

    if (!promptId) {
        console.error('[VERSION] 錯誤: 無法找到提示詞 ID');
        return;
    }

    console.log(`[VERSION] 目標提示詞: ${promptId} (${isCustomPrompt ? '自訂' : '原始'})`);

    // 獲取表單資料
    const versionNumber = document.getElementById('newVersionNumber').value;
    const versionName = document.getElementById('newVersionName').value.trim();
    const versionDescription = document.getElementById('newVersionDescription').value.trim();
    const versionContent = document.getElementById('newVersionContent').value;
    const setAsActive = document.getElementById('setAsActiveVersion').checked;

    console.log(`[VERSION] 版本資料: ${versionNumber}, 名稱: "${versionName}", 設為預設: ${setAsActive}`);

    // 驗證必填欄位
    if (!versionName) {
        console.error('[VERSION] 錯誤: 版本名稱為空');
        alert('請輸入版本名稱');
        return;
    }

    if (!versionDescription) {
        console.error('[VERSION] 錯誤: 版本說明為空');
        alert('請輸入版本說明');
        return;
    }

    // 建立新版本資料
    const newVersionData = {
        name: versionName,
        description: versionDescription,
        content: versionContent
    };

    console.log(`[VERSION] 新版本資料準備完成`);

    try {
        if (isCustomPrompt) {
            console.log('[VERSION] 處理自訂提示詞版本儲存');
            // 對於自訂提示詞，直接在 customPrompts 中新增版本
            if (customPrompts[promptId]) {
                customPrompts[promptId][versionNumber] = newVersionData;
                console.log(`[VERSION] 自訂提示詞版本已新增: ${versionNumber}`);

                // 如果設為預設版本，更新 metadata
                if (setAsActive) {
                    customPrompts[promptId].metadata.activeVersion = versionNumber;
                    console.log(`[VERSION] 自訂提示詞預設版本已更新: ${versionNumber}`);
                }

                // 儲存到 localStorage
                localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
                console.log('[VERSION] 自訂提示詞已儲存到 localStorage');

                // 同時更新 customPromptData 以保持一致性
                console.log('[VERSION] 同步更新 customPromptData');
                const allCustomData = JSON.parse(localStorage.getItem('customPromptData') || '{}');

                if (!allCustomData[promptId]) {
                    allCustomData[promptId] = {
                        metadata: {},
                        versions: {}
                    };
                }

                // 同步版本資料
                allCustomData[promptId].versions[versionNumber] = newVersionData;

                // 同步 metadata
                if (setAsActive) {
                    allCustomData[promptId].metadata.activeVersion = versionNumber;
                }

                // 儲存同步後的 customPromptData
                localStorage.setItem('customPromptData', JSON.stringify(allCustomData));
                console.log('[VERSION] customPromptData 同步完成');
            } else {
                console.error('[VERSION] 錯誤: 找不到自訂提示詞資料');
                throw new Error('找不到自訂提示詞資料');
            }
        } else {
            console.log('[VERSION] 處理原始提示詞版本儲存');
            // 對於原始提示詞，儲存到 customPromptData
            const allCustomData = JSON.parse(localStorage.getItem('customPromptData') || '{}');

            if (!allCustomData[promptId]) {
                allCustomData[promptId] = {
                    metadata: {},
                    versions: {}
                };
                console.log('[VERSION] 建立新的 customPromptData 結構');
            }

            // 新增版本
            allCustomData[promptId].versions[versionNumber] = newVersionData;
            console.log(`[VERSION] 原始提示詞版本已新增: ${versionNumber}`);

            // 如果設為預設版本，更新 metadata
            if (setAsActive) {
                allCustomData[promptId].metadata.activeVersion = versionNumber;
                console.log(`[VERSION] 原始提示詞預設版本已更新: ${versionNumber}`);
            }

            // 儲存到 localStorage
            localStorage.setItem('customPromptData', JSON.stringify(allCustomData));
            console.log('[VERSION] 原始提示詞已儲存到 localStorage');
        }

        console.log('[VERSION] 版本儲存成功，開始更新 UI');

        // 重新載入當前提示詞的詳情
        populateDetailForm(promptId, null, isCustomPrompt);

        // 如果設為預設版本，更新版本選擇器並重新載入卡片
        if (setAsActive) {
            document.getElementById('detailPromptVersion').value = versionNumber;
            // 重新載入卡片以反映新的預設版本
            loadCards();
            console.log('[VERSION] 卡片已重新載入以反映新預設版本');
        }

        // 關閉 Modal
        const modalInstance = bootstrap.Modal.getInstance(modal);
        modalInstance.hide();

        console.log(`[VERSION] 版本 ${versionNumber} 建立完成`);

        // 驗證儲存結果
        console.log('[VERSION] === 儲存驗證開始 ===');
        if (isCustomPrompt) {
            const savedCustomPrompts = JSON.parse(localStorage.getItem('customPrompts') || '{}');
            console.log('[VERSION] localStorage中的customPrompts:', savedCustomPrompts);
            if (savedCustomPrompts[promptId] && savedCustomPrompts[promptId][versionNumber]) {
                console.log(`[VERSION] ✅ 版本 ${versionNumber} 已成功儲存到 customPrompts`);
                console.log(`[VERSION] 儲存的版本資料:`, savedCustomPrompts[promptId][versionNumber]);
            } else {
                console.error(`[VERSION] ❌ 版本 ${versionNumber} 未正確儲存到 customPrompts`);
            }
        } else {
            const savedCustomData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
            console.log('[VERSION] localStorage中的customPromptData:', savedCustomData);
            if (savedCustomData[promptId] && savedCustomData[promptId].versions && savedCustomData[promptId].versions[versionNumber]) {
                console.log(`[VERSION] ✅ 版本 ${versionNumber} 已成功儲存到 customPromptData`);
                console.log(`[VERSION] 儲存的版本資料:`, savedCustomData[promptId].versions[versionNumber]);
            } else {
                console.error(`[VERSION] ❌ 版本 ${versionNumber} 未正確儲存到 customPromptData`);
            }
        }
        console.log('[VERSION] === 儲存驗證結束 ===');

        // 完整驗證 localStorage 內容
        verifyLocalStorageVersions();
        alert(`版本 ${versionNumber} 建立成功！`);

    } catch (error) {
        console.error('[VERSION] 儲存版本時發生錯誤:', error);
        alert('儲存版本時發生錯誤：' + error.message);
    }
}

// 確認刪除版本
function confirmDeleteVersion() {
    const detailContainer = document.getElementById('promptDetailContainer');
    const currentPromptId = detailContainer.dataset.currentPromptId;
    const currentVersion = document.getElementById('detailPromptVersion').value;

    console.log(`[VERSION] 確認刪除版本: ${currentPromptId} - ${currentVersion}`);

    if (!currentPromptId || !currentVersion) {
        console.error('[VERSION] 錯誤: 無法找到當前提示詞 ID 或版本');
        return;
    }

    // 檢查是否為 v1 版本
    if (currentVersion === 'v1') {
        console.warn(`[VERSION] 警告: 嘗試刪除 v1 版本 - 已阻止`);
        alert('無法刪除 v1 版本');
        return;
    }

    // 檢查是否為自訂提示詞
    const isCustomPrompt = customPrompts[currentPromptId] !== undefined;

    // 獲取所有版本
    const allVersions = getAllVersionsForPrompt(currentPromptId, isCustomPrompt);

    // 檢查是否只剩一個版本
    if (allVersions.length <= 1) {
        alert('無法刪除最後一個版本');
        return;
    }

    // 檢查是否為當前啟用版本
    let metadata;
    if (isCustomPrompt) {
        metadata = customPrompts[currentPromptId].metadata;
    } else {
        try {
            const allCustomData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
            const customData = allCustomData[currentPromptId];
            metadata = customData?.metadata || originalYamlData?.prompt?.[currentPromptId]?.metadata;
        } catch (e) {
            metadata = originalYamlData?.prompt?.[currentPromptId]?.metadata;
        }
    }

    const activeVersion = metadata?.activeVersion || 'v1';
    const isActiveVersion = currentVersion === activeVersion;
    console.log(`[VERSION] 版本狀態檢查: 啟用版本=${activeVersion}, 要刪除版本=${currentVersion}, 是否啟用版本=${isActiveVersion}`);

    // 確認對話框
    let confirmMessage = `確定要刪除版本「${currentVersion}」嗎？\n\n此操作無法復原。`;
    if (isActiveVersion) {
        confirmMessage += '\n\n【警告】此版本目前是預設版本，刪除後將自動切換到 v1 版本。';
    }

    if (!confirm(confirmMessage)) {
        console.log(`[VERSION] 用戶取消刪除版本 ${currentVersion}`);
        return;
    }

    console.log(`[VERSION] 用戶確認刪除版本 ${currentVersion}`);
    deleteVersion(currentPromptId, currentVersion, isCustomPrompt, isActiveVersion);
}

// 刪除版本
function deleteVersion(promptId, versionToDelete, isCustomPrompt, isActiveVersion) {
    console.log(`[VERSION] 開始刪除版本: ${promptId} - ${versionToDelete} (${isCustomPrompt ? '自訂' : '原始'}, 啟用版本: ${isActiveVersion})`);

    try {
        if (isCustomPrompt) {
            // 對於自訂提示詞
            if (customPrompts[promptId] && customPrompts[promptId][versionToDelete]) {
                delete customPrompts[promptId][versionToDelete];
                console.log(`[VERSION] 已從自訂提示詞刪除版本 ${versionToDelete}`);

                // 如果刪除的是啟用版本，切換到 v1
                if (isActiveVersion) {
                    customPrompts[promptId].metadata.activeVersion = 'v1';
                    console.log(`[VERSION] 啟用版本已切換到 v1`);
                }

                // 儲存到 localStorage
                localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
                console.log(`[VERSION] 自訂提示詞資料已儲存到 localStorage`);
            }
        } else {
            // 對於原始提示詞
            const allCustomData = JSON.parse(localStorage.getItem('customPromptData') || '{}');

            if (allCustomData[promptId]?.versions?.[versionToDelete]) {
                delete allCustomData[promptId].versions[versionToDelete];
                console.log(`[VERSION] 已從自訂版本資料刪除版本 ${versionToDelete}`);

                // 如果版本物件為空，刪除整個版本物件
                if (Object.keys(allCustomData[promptId].versions).length === 0) {
                    delete allCustomData[promptId].versions;
                    console.log(`[VERSION] 版本物件已清空，已刪除整個 versions 物件`);
                }

                // 如果刪除的是啟用版本，切換到 v1
                if (isActiveVersion) {
                    if (!allCustomData[promptId].metadata) {
                        allCustomData[promptId].metadata = {};
                    }
                    allCustomData[promptId].metadata.activeVersion = 'v1';
                    console.log(`[VERSION] 啟用版本已切換到 v1`);
                }

                // 如果物件完全為空，刪除整個提示詞資料
                if (!allCustomData[promptId].metadata || Object.keys(allCustomData[promptId].metadata).length === 0) {
                    if (!allCustomData[promptId].versions || Object.keys(allCustomData[promptId].versions).length === 0) {
                        delete allCustomData[promptId];
                        console.log(`[VERSION] 提示詞資料已完全清空，已刪除整個提示詞條目`);
                    }
                }

                // 儲存到 localStorage
                localStorage.setItem('customPromptData', JSON.stringify(allCustomData));
                console.log(`[VERSION] 自訂提示詞資料已儲存到 localStorage`);
            }
        }

        // 重新載入當前提示詞的詳情
        populateDetailForm(promptId, null, isCustomPrompt);
        console.log(`[VERSION] 提示詞詳情已重新載入`);

        // 如果刪除的是當前選擇的版本，切換到 v1
        const versionSelect = document.getElementById('detailPromptVersion');
        if (versionSelect.value === versionToDelete) {
            versionSelect.value = 'v1';
            // 觸發版本切換事件
            versionSelect.dispatchEvent(new Event('change'));
            console.log(`[VERSION] 已切換到 v1 版本`);
        }

        console.log(`[VERSION] 版本刪除完成: ${versionToDelete}`);
        alert(`版本 ${versionToDelete} 已刪除`);

    } catch (error) {
        console.error('[VERSION] 錯誤: 刪除版本時發生錯誤:', error);
        alert('刪除版本時發生錯誤：' + error.message);
    }
}

// 設為預設版本
function setAsActiveVersion() {
    const detailContainer = document.getElementById('promptDetailContainer');
    const currentPromptId = detailContainer.dataset.currentPromptId;
    const selectedVersion = document.getElementById('detailPromptVersion').value;

    console.log(`[VERSION] 設定預設版本: ${currentPromptId} - ${selectedVersion}`);

    if (!currentPromptId || !selectedVersion) {
        console.error('[VERSION] 錯誤: 無法找到當前提示詞 ID 或版本');
        return;
    }

    // 檢查是否為自訂提示詞
    const isCustomPrompt = customPrompts[currentPromptId] !== undefined;
    console.log(`[VERSION] 提示詞類型: ${isCustomPrompt ? '自訂' : '原始'}`);

    try {
        if (isCustomPrompt) {
            // 對於自訂提示詞
            if (customPrompts[currentPromptId]) {
                customPrompts[currentPromptId].metadata.activeVersion = selectedVersion;
                console.log(`[VERSION] 自訂提示詞預設版本已更新為: ${selectedVersion}`);

                // 儲存到 localStorage
                localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
                console.log(`[VERSION] 自訂提示詞資料已儲存到 localStorage`);

                // 同時更新 customPromptData 以保持一致性
                console.log('[VERSION] 同步更新 customPromptData 的啟用版本');
                const allCustomData = JSON.parse(localStorage.getItem('customPromptData') || '{}');

                if (!allCustomData[currentPromptId]) {
                    allCustomData[currentPromptId] = { metadata: {}, versions: {} };
                }

                if (!allCustomData[currentPromptId].metadata) {
                    allCustomData[currentPromptId].metadata = {};
                }

                allCustomData[currentPromptId].metadata.activeVersion = selectedVersion;
                localStorage.setItem('customPromptData', JSON.stringify(allCustomData));
                console.log(`[VERSION] customPromptData 啟用版本同步完成`);
            }
        } else {
            // 對於原始提示詞
            const allCustomData = JSON.parse(localStorage.getItem('customPromptData') || '{}');

            if (!allCustomData[currentPromptId]) {
                allCustomData[currentPromptId] = { metadata: {}, versions: {} };
                console.log(`[VERSION] 建立新的自訂資料結構`);
            }

            if (!allCustomData[currentPromptId].metadata) {
                allCustomData[currentPromptId].metadata = {};
            }

            allCustomData[currentPromptId].metadata.activeVersion = selectedVersion;
            console.log(`[VERSION] 原始提示詞預設版本已更新為: ${selectedVersion}`);

            // 儲存到 localStorage
            localStorage.setItem('customPromptData', JSON.stringify(allCustomData));
            console.log(`[VERSION] 自訂提示詞資料已儲存到 localStorage`);
        }

        // 重新載入卡片以反映變更
        loadCards();
        console.log(`[VERSION] 卡片已重新載入以反映版本變更`);

        console.log(`[VERSION] 設定預設版本完成: ${selectedVersion}`);
        alert(`版本 ${selectedVersion} 已設為預設版本`);

    } catch (error) {
        console.error('[VERSION] 錯誤: 設定預設版本時發生錯誤:', error);
        alert('設定預設版本時發生錯誤：' + error.message);
    }
}

// =============== 除錯和驗證功能 ===============

// 修復資料一致性問題
function syncDataConsistency() {
    console.log('[VERSION] === 開始修復資料一致性 ===');

    try {
        const customPromptsData = JSON.parse(localStorage.getItem('customPrompts') || '{}');
        const customPromptData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
        let hasChanges = false;

        // 以 customPrompts 為準，同步到 customPromptData
        Object.keys(customPromptsData).forEach(promptId => {
            const customPromptsItem = customPromptsData[promptId];
            const customPromptsActiveVersion = customPromptsItem.metadata?.activeVersion || 'v1';

            // 確保 customPromptData 中有對應的條目
            if (!customPromptData[promptId]) {
                customPromptData[promptId] = {
                    metadata: {},
                    versions: {}
                };
            }

            if (!customPromptData[promptId].metadata) {
                customPromptData[promptId].metadata = {};
            }

            const customPromptDataActiveVersion = customPromptData[promptId].metadata.activeVersion || 'v1';

            // 如果啟用版本不一致，以 customPrompts 為準
            if (customPromptsActiveVersion !== customPromptDataActiveVersion) {
                console.log(`[VERSION] 🔧 修復 ${promptId} 的啟用版本: ${customPromptDataActiveVersion} -> ${customPromptsActiveVersion}`);
                customPromptData[promptId].metadata.activeVersion = customPromptsActiveVersion;
                hasChanges = true;
            }

            // 同步版本資料
            const customPromptsVersions = Object.keys(customPromptsItem).filter(key => key.startsWith('v'));
            customPromptsVersions.forEach(version => {
                if (!customPromptData[promptId].versions[version]) {
                    console.log(`[VERSION] 🔧 同步版本 ${promptId}:${version} 到 customPromptData`);
                    customPromptData[promptId].versions[version] = customPromptsItem[version];
                    hasChanges = true;
                }
            });
        });

        // 如果有變更，儲存 customPromptData
        if (hasChanges) {
            localStorage.setItem('customPromptData', JSON.stringify(customPromptData));
            console.log('[VERSION] ✅ 資料一致性修復完成，已儲存');
        } else {
            console.log('[VERSION] ✅ 資料已一致，無需修復');
        }

    } catch (e) {
        console.error('[VERSION] 資料一致性修復失敗:', e);
    }

    console.log('[VERSION] === 資料一致性修復結束 ===');
}

// 驗證 localStorage 版本資料
function verifyLocalStorageVersions() {
    console.log('[VERSION] === localStorage 版本資料驗證 ===');

    // 檢查 customPrompts
    try {
        const customPromptsData = JSON.parse(localStorage.getItem('customPrompts') || '{}');
        console.log('[VERSION] customPrompts 資料:', customPromptsData);

        Object.keys(customPromptsData).forEach(promptId => {
            const promptData = customPromptsData[promptId];
            const versions = Object.keys(promptData).filter(key => key.startsWith('v'));
            if (versions.length > 0) {
                console.log(`[VERSION] ${promptId} 的版本: ${versions.join(', ')}`);
                console.log(`[VERSION] ${promptId} 的啟用版本: ${promptData.metadata?.activeVersion || 'v1'}`);
            }
        });
    } catch (e) {
        console.error('[VERSION] customPrompts 解析錯誤:', e);
    }

    // 檢查 customPromptData
    try {
        const customPromptData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
        console.log('[VERSION] customPromptData 資料:', customPromptData);

        Object.keys(customPromptData).forEach(promptId => {
            const promptData = customPromptData[promptId];
            if (promptData.versions) {
                const versions = Object.keys(promptData.versions);
                console.log(`[VERSION] ${promptId} 的自訂版本: ${versions.join(', ')}`);
                console.log(`[VERSION] ${promptId} 的啟用版本: ${promptData.metadata?.activeVersion || 'v1'}`);
            }
        });
    } catch (e) {
        console.error('[VERSION] customPromptData 解析錯誤:', e);
    }

    // 檢查資料一致性
    console.log('[VERSION] === 資料一致性檢查 ===');
    try {
        const customPromptsData = JSON.parse(localStorage.getItem('customPrompts') || '{}');
        const customPromptData = JSON.parse(localStorage.getItem('customPromptData') || '{}');

        Object.keys(customPromptsData).forEach(promptId => {
            if (customPromptData[promptId]) {
                const customPromptsActiveVersion = customPromptsData[promptId].metadata?.activeVersion || 'v1';
                const customPromptDataActiveVersion = customPromptData[promptId].metadata?.activeVersion || 'v1';

                if (customPromptsActiveVersion !== customPromptDataActiveVersion) {
                    console.warn(`[VERSION] ⚠️ ${promptId} 的啟用版本不一致: customPrompts=${customPromptsActiveVersion}, customPromptData=${customPromptDataActiveVersion}`);
                }
            }
        });
    } catch (e) {
        console.error('[VERSION] 一致性檢查錯誤:', e);
    }

    console.log('[VERSION] === 驗證結束 ===');
}

// =============== 匯出資料功能 ===============
function exportData() {
    try {
        // 合併原始資料和自訂資料
        const exportData = JSON.parse(JSON.stringify(originalYamlData)); // 深拷貝原始資料

        // 加入個人標籤到 tagOrder
        if (personalTags.length > 0) {
            exportData.metadata.tagOrder = [...allTags, ...personalTags];
        }

        // 加入自訂提示詞
        Object.keys(customPrompts).forEach(promptId => {
            exportData.prompt[promptId] = customPrompts[promptId];
        });

        // 加入自訂版本
        Object.keys(customVersions).forEach(promptId => {
            if (exportData.prompt[promptId]) {
                Object.keys(customVersions[promptId]).forEach(version => {
                    exportData.prompt[promptId][version] = customVersions[promptId][version];
                });
            }
        });

        // 套用修改
        Object.keys(modifiedPrompts).forEach(promptId => {
            if (exportData.prompt[promptId]) {
                // 合併修改的內容
                Object.assign(exportData.prompt[promptId], modifiedPrompts[promptId]);
            }
        });

        // 轉換為 YAML 格式
        const yamlContent = jsyaml.dump(exportData, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            quotingType: '"',
            forceQuotes: false
        });

        // 建立下載連結
        const blob = new Blob([yamlContent], { type: 'text/yaml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'data.yml';
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);

        alert('資料匯出成功！請將下載的 data.yml 檔案替換原本的檔案。');

    } catch (error) {
        console.error('匯出資料時出錯:', error);
        alert('匯出資料時發生錯誤，請稍後再試。');
    }
}

// 處理匯入檔案
function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.yml') && !file.name.endsWith('.yaml')) {
        alert('請選擇有效的 YAML 檔案（.yml 或 .yaml）');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const yamlContent = e.target.result;
            const importedData = jsyaml.load(yamlContent);

            // 驗證資料格式
            if (!importedData.metadata || !importedData.prompt) {
                throw new Error('檔案格式不正確');
            }

            // 確認是否要覆蓋現有資料
            const confirmMessage = '匯入將會覆蓋所有本地修改，是否繼續？\n\n建議先匯出目前的資料作為備份。';
            if (!confirm(confirmMessage)) {
                return;
            }

            // 清空所有本地資料
            personalTags = [];
            customPrompts = {};
            customVersions = {};
            modifiedPrompts = {};

            // 如果匯入資料包含標籤資訊，提取個人標籤
            if (importedData.metadata && importedData.metadata.tagOrder) {
                const importedTagOrder = importedData.metadata.tagOrder;
                // 從匯入的標籤順序中提取不在原始全域標籤中的標籤作為個人標籤
                personalTags = importedTagOrder.filter(tag => !allTags.includes(tag));
            }

            // 儲存個人化設定
            savePersonalSettings();

            alert('資料匯入成功！\n\n請手動將匯入的檔案重新命名為 data.yml 並替換原本的檔案，然後重新整理頁面以查看變更。');

        } catch (error) {
            console.error('匯入資料時出錯:', error);
            alert('匯入檔案時發生錯誤：\n' + error.message);
        }
    };

    reader.readAsText(file);

    // 清空檔案輸入，允許重複選擇同一檔案
    event.target.value = '';
}

// =============== 資料結構統一功能 ===============

// 統一資料結構為 customPromptData
function unifyDataStructure() {
    console.log('=== 開始統一資料結構 ===');

    try {
        const customPrompts = JSON.parse(localStorage.getItem('customPrompts') || '{}');
        const customPromptData = JSON.parse(localStorage.getItem('customPromptData') || '{}');

        let migratedCount = 0;
        let duplicateCount = 0;

        // 遷移 customPrompts 到 customPromptData
        Object.keys(customPrompts).forEach(promptId => {
            const promptData = customPrompts[promptId];

            if (customPromptData[promptId]) {
                duplicateCount++;
                console.log(`⚠️ ${promptId} 已存在於 customPromptData 中，跳過遷移`);
                return;
            }

            // 轉換扁平結構到巢狀結構
            const newPromptData = {
                metadata: promptData.metadata || {},
                versions: {}
            };

            // 將版本資料提取到 versions 物件中
            Object.keys(promptData).forEach(key => {
                if (key !== 'metadata' && key.startsWith('v')) {
                    newPromptData.versions[key] = promptData[key];
                }
            });

            customPromptData[promptId] = newPromptData;
            migratedCount++;
            console.log(`✅ 已遷移 ${promptId}`);
        });

        // 儲存更新後的 customPromptData
        localStorage.setItem('customPromptData', JSON.stringify(customPromptData));

        // 清除 customPrompts（可選）
        if (migratedCount > 0) {
            const clearOldData = confirm(
                `資料遷移完成！\n\n` +
                `成功遷移：${migratedCount} 個提示詞\n` +
                `跳過重複：${duplicateCount} 個提示詞\n\n` +
                `是否要清除舊的 customPrompts 資料？\n` +
                `（建議清除以避免資料冗餘）`
            );

            if (clearOldData) {
                localStorage.removeItem('customPrompts');
                // 更新全域變數
                customPrompts = {};
                console.log('✅ 已清除舊的 customPrompts 資料');
            }
        }

        // 重新載入頁面以使用新的資料結構
        loadDataManagementInfo();
        loadCards();

        alert(`資料結構統一完成！\n\n遷移：${migratedCount} 個提示詞\n重複：${duplicateCount} 個提示詞`);

    } catch (error) {
        console.error('統一資料結構時發生錯誤:', error);
        alert('統一資料結構時發生錯誤: ' + error.message);
    }

    console.log('=== 統一資料結構完成 ===');
}

// 檢查資料冗餘
function checkDataRedundancy() {
    console.log('=== 開始檢查資料冗餘 ===');

    try {
        const customPrompts = JSON.parse(localStorage.getItem('customPrompts') || '{}');
        const customPromptData = JSON.parse(localStorage.getItem('customPromptData') || '{}');

        const customPromptsIds = Object.keys(customPrompts);
        const customPromptDataIds = Object.keys(customPromptData);

        // 計算重複的 ID
        const duplicateIds = customPromptsIds.filter(id => customPromptDataIds.includes(id));
        const onlyInCustomPrompts = customPromptsIds.filter(id => !customPromptDataIds.includes(id));
        const onlyInCustomPromptData = customPromptDataIds.filter(id => !customPromptsIds.includes(id));

        // 計算儲存空間使用
        const customPromptsSize = JSON.stringify(customPrompts).length;
        const customPromptDataSize = JSON.stringify(customPromptData).length;
        const totalSize = customPromptsSize + customPromptDataSize;

        // 計算詳細的資料差異
        let inconsistencyCount = 0;
        duplicateIds.forEach(id => {
            const prompt1 = customPrompts[id];
            const prompt2 = customPromptData[id];

            // 檢查 metadata 是否一致
            if (JSON.stringify(prompt1.metadata) !== JSON.stringify(prompt2.metadata)) {
                inconsistencyCount++;
                console.log(`❌ ${id} 的 metadata 不一致`);
            }

            // 檢查版本資料是否一致
            const versions1 = {};
            Object.keys(prompt1).forEach(key => {
                if (key !== 'metadata' && key.startsWith('v')) {
                    versions1[key] = prompt1[key];
                }
            });

            const versions2 = prompt2.versions || {};

            if (JSON.stringify(versions1) !== JSON.stringify(versions2)) {
                inconsistencyCount++;
                console.log(`❌ ${id} 的版本資料不一致`);
            }
        });

        // 顯示檢查結果
        const report = `
資料冗餘檢查報告
================

📊 基本統計：
• customPrompts 項目數：${customPromptsIds.length}
• customPromptData 項目數：${customPromptDataIds.length}
• 重複項目數：${duplicateIds.length}

📂 資料分布：
• 僅在 customPrompts：${onlyInCustomPrompts.length} 個
• 僅在 customPromptData：${onlyInCustomPromptData.length} 個
• 兩邊都有：${duplicateIds.length} 個

⚠️ 不一致問題：
• 資料不一致的項目：${inconsistencyCount} 個

💾 儲存空間：
• customPrompts 大小：${(customPromptsSize / 1024).toFixed(2)} KB
• customPromptData 大小：${(customPromptDataSize / 1024).toFixed(2)} KB
• 總計大小：${(totalSize / 1024).toFixed(2)} KB
• 預估可節省：${(customPromptsSize / 1024).toFixed(2)} KB（${((customPromptsSize / totalSize) * 100).toFixed(1)}%）

🔧 建議：
${duplicateIds.length > 0 ? '• 建議統一資料結構以消除冗餘' : '• 目前沒有資料冗餘'}
${inconsistencyCount > 0 ? '• 建議先修復資料一致性' : '• 資料一致性良好'}
        `;

        console.log(report);
        alert('資料冗餘檢查完成！\n\n詳細報告請查看開發者工具 Console。\n\n' +
            `重複項目：${duplicateIds.length} 個\n` +
            `不一致問題：${inconsistencyCount} 個\n` +
            `可節省空間：${(customPromptsSize / 1024).toFixed(2)} KB`);

    } catch (error) {
        console.error('檢查資料冗餘時發生錯誤:', error);
        alert('檢查資料冗餘時發生錯誤: ' + error.message);
    }

    console.log('=== 資料冗餘檢查完成 ===');
}
