class ExcerptManager {
    constructor(reader) {
        this.reader = reader;
        this.excerpts = JSON.parse(localStorage.getItem('excerpts')) || {};
        this.currentExcerpt = null;
        this.createExcerptPanel();
        this.createSelectionPopup();
        this.initEventListeners();
    }

    createExcerptPanel() {
        // 创建摘录面板
        const panel = document.createElement('div');
        panel.className = 'excerpts-panel hidden';
        panel.innerHTML = `
            <div class="excerpts-header">
                <h3>摘录列表</h3>
            </div>
            <div id="excerpt-list"></div>
        `;
        document.querySelector('.reader-wrapper').appendChild(panel);

        this.panel = panel;
        this.excerptList = panel.querySelector('#excerpt-list');
    }

    createSelectionPopup() {
        // 创建选择文本后的弹出按钮
        const popup = document.createElement('div');
        popup.className = 'selection-popup hidden';
        popup.innerHTML = `
            <button class="add-excerpt-btn">
                <span class="excerpt-icon">✏️</span>
                添加摘录
            </button>
        `;
        document.body.appendChild(popup);
        this.selectionPopup = popup;

        // 创建摘录对话框
        const dialog = document.createElement('div');
        dialog.className = 'excerpt-dialog hidden';
        dialog.innerHTML = `
            <div class="excerpt-dialog-content">
                <div class="dialog-header">
                    <h4>添加摘录</h4>
                    <button class="close-dialog">×</button>
                </div>
                <div class="excerpt-text"></div>
                <textarea class="excerpt-comment" placeholder="添加笔记..."></textarea>
                <div class="excerpt-dialog-buttons">
                    <button class="save-excerpt">添加摘录</button>
                    <button class="cancel-excerpt">取消</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
        this.dialog = dialog;
    }

    initEventListeners() {
        // 使用 epub.js 的 selected 事件
        this.reader.rendition.on('selected', (cfiRange, contents) => {
            const selection = contents.window.getSelection();
            const text = selection.toString().trim();
            
            if (text) {
                // 获取 iframe 的位置信息
                const iframe = document.querySelector('#reader-container iframe');
                const iframeRect = iframe.getBoundingClientRect();
                
                // 获取选中文本的位置
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                
                // 计算实际位置（需要加上 iframe 的偏移）
                const top = iframeRect.top + rect.top + window.scrollY;
                const left = iframeRect.left + rect.left;
                
                this.showSelectionPopup(top, left, rect.width, cfiRange, text);
            } else {
                this.hideSelectionPopup();
            }
        });

        // 使用 epub.js 的 unselected 事件
        this.reader.rendition.on('unselected', () => {
            this.hideSelectionPopup();
        });

        // 监听 iframe 内部的点击事件
        this.reader.rendition.on('click', () => {
            const selection = window.getSelection();
            if (!selection || selection.toString().trim() === '') {
                this.hideSelectionPopup();
            }
        });

        // 点击事件处理
        document.addEventListener('mousedown', (e) => {
            // 如果点击不在弹出按钮和对话框内，则隐藏弹出按钮
            if (!this.selectionPopup.contains(e.target) && 
                !this.dialog.contains(e.target)) {
                this.hideSelectionPopup();
            }
        });

        // 添加摘录按钮点击事件
        this.selectionPopup.querySelector('.add-excerpt-btn').addEventListener('click', () => {
            this.showExcerptDialog();
        });

        // 对话框按钮事件
        this.dialog.querySelector('.save-excerpt').addEventListener('click', () => this.saveExcerpt());
        this.dialog.querySelector('.cancel-excerpt').addEventListener('click', () => this.cancelExcerpt());
        this.dialog.querySelector('.close-dialog').addEventListener('click', () => this.cancelExcerpt());
    }

    async showSelectionPopup(top, left, width, cfiRange, text) {
        // 保存当前选择的信息
        this.currentExcerpt = {
            cfiRange,
            text,
            progress: 0, // 先设置为 0，后面异步获取
            timestamp: new Date().toLocaleString('zh-CN')
        };

        // 定位弹出按钮
        const popup = this.selectionPopup;
        popup.style.top = `${Math.max(10, top - 40)}px`; // 确保不会超出顶部
        popup.style.left = `${Math.max(10, left + (width / 2) - (popup.offsetWidth / 2))}px`;
        
        // 重置样式后显示
        popup.style.opacity = '0';
        popup.style.transform = 'translateY(10px)';
        popup.classList.remove('hidden');
        
        // 触发重排后应用动画
        requestAnimationFrame(() => {
            popup.style.opacity = '1';
            popup.style.transform = 'translateY(0)';
        });

        // 异步获取进度
        this.getProgress(cfiRange).then(progress => {
            this.currentExcerpt.progress = progress;
        });
    }

    hideSelectionPopup() {
        this.selectionPopup.classList.add('hidden');
        this.selectionPopup.style.opacity = '0';
        this.selectionPopup.style.transform = 'translateY(10px)';
    }

    showExcerptDialog() {
        if (!this.currentExcerpt) return;

        const textDiv = this.dialog.querySelector('.excerpt-text');
        textDiv.textContent = this.currentExcerpt.text;
        
        this.hideSelectionPopup();
        this.dialog.classList.remove('hidden');
    }

    async saveExcerpt() {
        if (!this.currentExcerpt) return;

        const comment = this.dialog.querySelector('.excerpt-comment').value;
        const bookKey = this.reader.currentFile.name;
        
        if (!this.excerpts[bookKey]) {
            this.excerpts[bookKey] = [];
        }

        const excerpt = {
            ...this.currentExcerpt,
            comment,
            id: Date.now()
        };

        this.excerpts[bookKey].push(excerpt);
        this.saveToStorage();
        this.addExcerptToList(excerpt, bookKey);
        this.highlightExcerpt(excerpt);
        
        this.dialog.classList.add('hidden');
        this.dialog.querySelector('.excerpt-comment').value = '';
        this.currentExcerpt = null;
    }

    cancelExcerpt() {
        this.dialog.classList.add('hidden');
        this.dialog.querySelector('.excerpt-comment').value = '';
        this.currentExcerpt = null;
    }

    async getProgress(cfiRange) {
        const location = await this.reader.book.getRange(cfiRange);
        const progress = this.reader.book.locations.percentageFromCfi(location.start.cfi);
        return Math.round(progress * 100);
    }

    addExcerptToList(excerpt, bookKey) {
        const div = document.createElement('div');
        div.className = 'excerpt-item';
        div.innerHTML = `
            <div class="excerpt-header">
                <div class="excerpt-progress-info">
                    <span>${excerpt.progress}%</span>
                    <span>|</span>
                    <span>${excerpt.timestamp}</span>
                </div>
                <button class="excerpt-delete" data-id="${excerpt.id}">×</button>
            </div>
            <div class="excerpt-content">${excerpt.text}</div>
            ${excerpt.comment ? `<div class="excerpt-comment-display">${excerpt.comment}</div>` : ''}
        `;

        // 点击跳转
        div.addEventListener('click', () => {
            this.reader.rendition.display(excerpt.cfiRange);
        });

        // 删除按钮
        div.querySelector('.excerpt-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteExcerpt(excerpt.id, bookKey);
        });

        this.excerptList.appendChild(div);
    }

    highlightExcerpt(excerpt) {
        this.reader.rendition.annotations.add(
            'highlight',
            excerpt.cfiRange,
            {},
            null,
            'hl',
            { fill: 'yellow', opacity: 0.3 }
        );
    }

    deleteExcerpt(id, bookKey) {
        const index = this.excerpts[bookKey].findIndex(e => e.id === id);
        if (index >= 0) {
            const excerpt = this.excerpts[bookKey][index];
            this.reader.rendition.annotations.remove(excerpt.cfiRange, 'highlight');
            this.excerpts[bookKey].splice(index, 1);
            this.saveToStorage();
            this.loadExcerpts(bookKey);
        }
    }

    saveToStorage() {
        localStorage.setItem('excerpts', JSON.stringify(this.excerpts));
    }

    loadExcerpts(bookKey) {
        this.excerptList.innerHTML = '';
        const excerpts = this.excerpts[bookKey] || [];
        excerpts.forEach(excerpt => {
            this.addExcerptToList(excerpt, bookKey);
            this.highlightExcerpt(excerpt);
        });
    }

    togglePanel() {
        this.panel.classList.toggle('hidden');
        if (!this.panel.classList.contains('hidden')) {
            document.querySelector('.toc').classList.add('hidden');
            document.querySelector('.bookmarks').classList.add('hidden');
        }
    }
} 