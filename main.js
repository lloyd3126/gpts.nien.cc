let tagOrder = ['使用中', 'Gemini 生成']; // 預設值，會從 YAML 覆蓋
let defaultPrompts = [];
let currentEditingPromptId = null; // 追蹤當前編輯的提示詞 ID
let originalYamlData = null; // 儲存原始 YAML 資料

// 新增功能的全局變量
let personalTags = []; // 個人標籤
let customPrompts = {}; // 自訂提示詞
let customVersions = {}; // 自訂版本
let modifiedPrompts = {}; // 修改過的提示詞

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
    console.log('=== getPromptData 開始 ===');
    console.log('查詢提示詞 ID:', id);

    // 首先檢查是否為自訂提示詞
    if (customPrompts[id]) {
        console.log('✅ 在 customPrompts 中找到');
        const customPrompt = customPrompts[id];
        const activeVersion = customPrompt.metadata.activeVersion || 'v1';
        const versionData = customPrompt[activeVersion];

        const result = {
            id: id,
            title: customPrompt.metadata.displayTitle,
            author: customPrompt.metadata.author,
            content: versionData.content,
            tag: customPrompt.metadata.tag,
            draft: customPrompt.metadata.draft || false
        };
        console.log('customPrompts 查詢結果:', result);
        console.log('=== getPromptData 完成 (customPrompts) ===');
        return result;
    }

    // 檢查原始提示詞
    const defaultData = defaultPrompts.find(p => p.id === id);
    console.log('defaultPrompts 查詢結果:', defaultData ? '找到' : '未找到');
    if (!defaultData) {
        console.log('❌ 在 defaultPrompts 中未找到');
        console.log('=== getPromptData 完成 (null) ===');
        return null;
    }

    // 檢查是否有自訂版本
    if (customVersions[id]) {
        console.log('📝 發現 customVersions');
        const versions = customVersions[id];
        // 這裡可以根據需要選擇特定版本
    }

    // 檢查是否有修改
    if (modifiedPrompts[id]) {
        console.log('✏️ 發現 modifiedPrompts');
        const result = { ...defaultData, ...modifiedPrompts[id] };
        console.log('modifiedPrompts 合併結果:', result);
        console.log('=== getPromptData 完成 (modifiedPrompts) ===');
        return result;
    }

    // 優先檢查新的統一 localStorage 結構
    try {
        console.log('🔍 檢查 localStorage customPromptData...');
        const customData = JSON.parse(localStorage.getItem('customPromptData') || '{}');
        if (customData[id]) {
            console.log('✅ 在 localStorage customPromptData 中找到');
            const custom = customData[id];
            const activeVersion = custom.metadata?.activeVersion || 'v1';
            const versionData = custom.versions?.[activeVersion];

            console.log('localStorage 中的資料:', {
                metadata: custom.metadata,
                activeVersion,
                versionData: versionData ? '有資料' : '無資料'
            });

            if (versionData) {
                console.log('從 localStorage 讀取的標籤:', custom.metadata.tag, '，提示詞ID:', id);

                // 如果是完全自訂的提示詞（不存在於 defaultPrompts 中）
                if (!defaultData) {
                    console.log('🆕 完全自訂的提示詞');
                    const result = {
                        id: id,
                        title: custom.metadata.displayTitle || versionData.name || id,
                        author: custom.metadata.author || '',
                        content: versionData.content || '',
                        tag: custom.metadata.tag || '',
                        draft: custom.metadata.draft || false
                    };
                    console.log('完全自訂提示詞結果:', result);
                    console.log('=== getPromptData 完成 (localStorage 完全自訂) ===');
                    return result;
                }

                // 如果是對現有提示詞的修改
                console.log('✏️ 對現有提示詞的修改');
                const result = {
                    ...defaultData,
                    title: custom.metadata.displayTitle !== undefined ? custom.metadata.displayTitle : defaultData?.title,
                    author: custom.metadata.author !== undefined ? custom.metadata.author : defaultData?.author,
                    content: versionData.content !== undefined ? versionData.content : defaultData?.content,
                    tag: custom.metadata.tag !== undefined ? custom.metadata.tag : defaultData?.tag,
                    draft: custom.metadata.draft !== undefined ? custom.metadata.draft : false
                };
                console.log('修改現有提示詞結果:', result);
                console.log('=== getPromptData 完成 (localStorage 修改) ===');
                return result;
            }
        } else {
            console.log('❌ 在 localStorage customPromptData 中未找到');
        }
    } catch (e) {
        console.error('❌ 解析 customPromptData 失敗:', e);
    }

    // 回退到舊的 localStorage 結構
    console.log('🔍 檢查舊的 localStorage 結構...');
    const storedData = localStorage.getItem(`gpts_prompt_${id}`);
    if (storedData) {
        console.log('✅ 在舊 localStorage 結構中找到');
        try {
            const parsedData = JSON.parse(storedData);
            if (parsedData && parsedData.id === id) {
                const result = { ...defaultData, ...parsedData };
                console.log('舊 localStorage 結構結果:', result);
                console.log('=== getPromptData 完成 (舊 localStorage) ===');
                return result;
            }
        } catch (e) {
            console.error("❌ Error parsing localStorage data for", id, e);
            localStorage.removeItem(`gpts_prompt_${id}`);
        }
    } else {
        console.log('❌ 在舊 localStorage 結構中未找到');
    }

    console.log('🔄 返回 defaultData');
    console.log('=== getPromptData 完成 (defaultData) ===');
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

    // 合併個人標籤到顯示順序
    const allTags = [...tagOrder, ...personalTags.filter(tag => !tagOrder.includes(tag))];

    allTags.forEach(tag => {
        if (promptsByTag[tag]) {
            const tagHeader = document.createElement('h2');
            tagHeader.className = 'mt-2 mb-3 fs-4';
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
        // 載入個人標籤
        const storedPersonalTags = localStorage.getItem('personalTags');
        if (storedPersonalTags) {
            personalTags = JSON.parse(storedPersonalTags);
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
                if (!tagOrder.includes(tag) && !personalTags.includes(tag)) {
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
        localStorage.setItem('personalTags', JSON.stringify(personalTags));
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

        modal.show();
    }
}

// 開啟右側新增提示詞表單
function openAddPromptForm() {
    // 如果當前有編輯狀態，先保存並退出編輯
    if (currentEditingPromptId) {
        saveDetailPromptToLocalStorage();
        currentEditingPromptId = null;
    }

    // 清除所有卡片的 active 狀態
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
                                <label for="detailNewPromptId" class="form-label">提示詞 ID <span class="text-danger">*</span>：</label>
                                <input type="text" class="form-control" id="detailNewPromptId" placeholder="例：my-custom-prompt" required>
                                <div class="form-text">只能包含小寫英文字母、數字和連字符</div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="detailNewPromptDisplayTitle" class="form-label">顯示標題 <span class="text-danger">*</span>：</label>
                                <input type="text" class="form-control" id="detailNewPromptDisplayTitle" placeholder="例：我的自訂提示詞" required>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="detailNewPromptAuthor" class="form-label">作者 <span class="text-danger">*</span>：</label>
                                <input type="text" class="form-control" id="detailNewPromptAuthor" placeholder="例：陳重年" required>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="detailNewPromptTag" class="form-label">標籤 <span class="text-danger">*</span>：</label>
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
                        <label for="detailNewPromptContent" class="form-label">內容 <span class="text-danger">*</span>：</label>
                        <textarea class="form-control" id="detailNewPromptContent" rows="8" placeholder="請在這裡輸入您的提示詞內容..." required></textarea>
                    </div>
                </form>
            </div>
            <div class="card-footer d-flex justify-content-between">
                <div>
                    <button type="button" class="btn btn-outline-secondary" onclick="closeAddPromptForm()">取消</button>
                </div>
                <div>
                    <button type="button" class="btn btn-success" id="saveNewPromptDetailBtn"><i class="bi bi-check"></i> 建立提示詞</button>
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
    cardsContainer.className = 'col-3';
    detailContainer.className = 'col-9';

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

    // 加入全域標籤
    tagOrder.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagSelect.appendChild(option);
    });

    // 加入個人標籤
    personalTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = `${tag} (個人)`;
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

    // 加入全域標籤
    tagOrder.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagSelect.appendChild(option);
    });

    // 加入個人標籤
    personalTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = `${tag} (個人)`;
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

    // 驗證必填欄位
    if (!newPrompt.id || !newPrompt.displayTitle || !newPrompt.author || !newPrompt.tag || !newPrompt.content) {
        alert('請填寫所有必填欄位');
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
    if (!tagOrder.includes(newPrompt.tag) && !personalTags.includes(newPrompt.tag)) {
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

    // 加入全域標籤
    tagOrder.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagSelect.appendChild(option);
    });

    // 加入個人標籤
    personalTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = `${tag} (個人)`;
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

    // 驗證必填欄位
    if (!newPrompt.id || !newPrompt.displayTitle || !newPrompt.author || !newPrompt.tag || !newPrompt.content) {
        alert('請填寫所有必填欄位');
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
    if (!tagOrder.includes(newPrompt.tag) && !personalTags.includes(newPrompt.tag)) {
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
                if (!tagOrder.includes(newTag) && !personalTags.includes(newTag)) {
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

    // 版本資料優先使用自訂資料，如果沒有則使用原始資料
    let versionData;
    if (customData?.versions?.[activeVersion]) {
        versionData = customData.versions[activeVersion];
    } else if (isCustomPrompt) {
        // 對於自訂提示詞，直接使用版本資料
        versionData = rawData[activeVersion];
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
    let allVersions = [];
    if (isCustomPrompt) {
        // 對於自訂提示詞，只從自訂資料中獲取版本
        allVersions = Object.keys(rawData).filter(key => key.startsWith('v'));
    } else {
        // 對於原始提示詞，合併原始版本和自訂版本
        const originalVersions = Object.keys(rawData).filter(key => key.startsWith('v'));
        const customVersionsList = customData?.versions ? Object.keys(customData.versions) : [];
        allVersions = [...new Set([...originalVersions, ...customVersionsList])]; // 去重
    }
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
        } else if (isCustomPrompt) {
            selectedVersionData = rawData[selectedVersion];
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
    console.log('保存提示詞 ID:', promptId);

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
            tagHeader.className = 'mt-2 mb-3 fs-4';
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

    // 設定按鈕
    document.getElementById('settingsBtn').addEventListener('click', function () {
        const modal = new bootstrap.Modal(document.getElementById('settingsModal'));
        modal.show();
    });

    // 標題新增按鈕
    document.getElementById('addPromptHeaderBtn').addEventListener('click', openAddPromptModal);

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

    // 監聽視窗大小變化，自動切換顯示方式
    window.addEventListener('resize', function () {
        const detailContainer = document.getElementById('promptDetailContainer');
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
    });
});

// =============== 標籤管理功能 ===============

// 開啟標籤管理 Modal
function openTagManagementModal() {
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

    if (tagOrder.length === 0) {
        container.innerHTML = '<div class="text-muted">沒有全域標籤</div>';
        return;
    }

    tagOrder.forEach(tag => {
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
        <span class="badge bg-light text-dark ms-2">${usageCount}</span>
    `;

    return tagDiv;
}

// 建立個人標籤元素
function createPersonalTagElement(tagName) {
    const tagDiv = document.createElement('div');
    tagDiv.className = 'badge bg-primary me-2 mb-2 p-2 d-inline-flex align-items-center';

    const usageCount = getTagUsageCount(tagName);
    const isUnused = usageCount === 0;

    if (isUnused) {
        tagDiv.classList.add('bg-warning');
        tagDiv.classList.remove('bg-primary');
    }

    tagDiv.innerHTML = `
        <i class="bi bi-tag me-1"></i>
        <span>${tagName}</span>
        <span class="badge bg-light text-dark ms-2">${usageCount}</span>
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

// 綁定標籤管理事件
function bindTagManagementEvents() {
    // 新增標籤按鈕
    const addTagBtn = document.getElementById('addTagBtn');
    const newTagInput = document.getElementById('newTagInput');

    addTagBtn.onclick = addNewTag;
    newTagInput.onkeypress = function (e) {
        if (e.key === 'Enter') {
            addNewTag();
        }
    };

    // 清理未使用標籤按鈕
    document.getElementById('cleanUnusedTagsBtn').onclick = cleanUnusedTags;

    // 編輯標籤 Modal 事件
    document.getElementById('saveEditTagBtn').onclick = saveEditTag;

    // 刪除標籤 Modal 事件
    document.getElementById('confirmDeleteTagBtn').onclick = confirmDeleteTag;
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
    if (tagOrder.includes(tagName) || personalTags.includes(tagName)) {
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
    const modal = document.getElementById('editTagModal');
    const oldTagName = modal.dataset.currentTag;
    const newTagName = document.getElementById('editTagInput').value.trim();

    if (!newTagName) {
        alert('標籤名稱不可為空');
        return;
    }

    if (newTagName === oldTagName) {
        // 沒有變更，直接關閉
        bootstrap.Modal.getInstance(modal).hide();
        return;
    }

    // 檢查新名稱是否重複
    if (tagOrder.includes(newTagName) || personalTags.includes(newTagName)) {
        alert('標籤名稱已存在');
        return;
    }

    // 更新個人標籤
    const index = personalTags.indexOf(oldTagName);
    if (index !== -1) {
        personalTags[index] = newTagName;
    }

    // 更新使用此標籤的提示詞
    updatePromptsWithTag(oldTagName, newTagName);

    // 儲存變更
    savePersonalSettings();

    // 重新載入標籤列表和卡片
    loadPersonalTags();
    updateAllTagSelectors();
    loadCards();

    // 關閉 Modal
    bootstrap.Modal.getInstance(modal).hide();

    console.log('標籤重新命名:', oldTagName, '->', newTagName);
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
    confirmBtn.className = 'btn btn-danger';
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

    // 從個人標籤中移除
    const index = personalTags.indexOf(tagName);
    if (index !== -1) {
        personalTags.splice(index, 1);
        console.log('✅ 已從 personalTags 陣列移除標籤');
    } else {
        console.log('⚠️ 標籤不在 personalTags 陣列中');
    }

    // 儲存變更
    savePersonalSettings();
    console.log('✅ 個人設定已儲存');

    // 重新載入標籤列表
    loadPersonalTags();
    updateAllTagSelectors();
    loadCards();
    console.log('✅ 相關界面已更新');

    // 關閉 Modal
    bootstrap.Modal.getInstance(modal).hide();

    console.log('✅ 標籤刪除成功:', tagName);
    console.log('=== confirmDeleteTag 完成 ===');
}

// 清理未使用的標籤
function cleanUnusedTags() {
    console.log('=== cleanUnusedTags 開始 ===');
    console.log('檢查個人標籤數量:', personalTags.length);
    console.log('個人標籤列表:', personalTags);
    
    const unusedTags = personalTags.filter(tag => {
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
            const index = personalTags.indexOf(tag);
            if (index !== -1) {
                personalTags.splice(index, 1);
                console.log(`✅ 已刪除標籤: ${tag}`);
            }
        });

        // 儲存變更
        savePersonalSettings();
        console.log('✅ 個人設定已儲存');

        // 重新載入標籤列表
        loadPersonalTags();
        updateAllTagSelectors();
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

// =============== 匯出資料功能 ===============
function exportData() {
    try {
        // 合併原始資料和自訂資料
        const exportData = JSON.parse(JSON.stringify(originalYamlData)); // 深拷貝原始資料

        // 加入個人標籤到 tagOrder
        if (personalTags.length > 0) {
            exportData.metadata.tagOrder = [...tagOrder, ...personalTags];
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
                personalTags = importedTagOrder.filter(tag => !tagOrder.includes(tag));
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
