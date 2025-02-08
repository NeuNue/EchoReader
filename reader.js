class Reader {
    constructor() {
        this.initElements();
        this.initVariables();
        this.initEventListeners();
        this.bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || {};
        this.excerptManager = null;
    }
    
    initElements() {
        this.fileInput = document.getElementById('file-input');
        this.readerContainer = document.getElementById('reader-container');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.tocToggle = document.getElementById('toc-toggle');
        this.toc = document.getElementById('toc');
        this.themeSelect = document.getElementById('theme-select');
        this.fontSizeDisplay = document.getElementById('font-size-display');
        this.progressBar = document.getElementById('progress-bar');
        this.progressText = document.getElementById('progress-text');
        this.bookmarkToggle = document.getElementById('bookmark-toggle');
        this.addBookmarkBtn = document.getElementById('add-bookmark-btn');
        this.bookmarkList = document.getElementById('bookmark-list');
        this.bookmarksPanel = document.getElementById('bookmarks');
        this.fontDecrease = document.getElementById('font-decrease');
        this.fontIncrease = document.getElementById('font-increase');
        this.excerptToggle = document.getElementById('excerpt-toggle');
        this.fileName = document.getElementById('file-name');
    }
    
    initVariables() {
        this.book = null;
        this.rendition = null;
        this.fontSize = 100;
        this.currentTheme = 'light';
        this.currentFile = null;
    }
    
    initEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.prevBtn.addEventListener('click', () => this.prevPage());
        this.nextBtn.addEventListener('click', () => this.nextPage());
        this.tocToggle.addEventListener('click', () => this.toggleToc());
        this.themeSelect.addEventListener('change', (e) => this.changeTheme(e.target.value));
        this.progressBar.addEventListener('change', (e) => this.handleProgressChange(e));
        this.bookmarkToggle.addEventListener('click', () => this.togglePanel('bookmarks'));
        this.addBookmarkBtn.addEventListener('click', () => this.toggleBookmark());
        this.fontDecrease.addEventListener('click', () => this.changeFontSize(-10));
        this.fontIncrease.addEventListener('click', () => this.changeFontSize(10));
        this.excerptToggle.addEventListener('click', () => this.toggleExcerpts());
    }
    
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.currentFile = file;
        
        // 显示文件名
        this.fileName.textContent = file.name;
        
        const extension = file.name.split('.').pop().toLowerCase();
        
        if (extension === 'epub') {
            await this.handleEpub(file);
        } else if (extension === 'txt') {
            await this.handleTxt(file);
        }
    }
    
    async handleEpub(file) {
        try {
            console.log('Loading epub file:', file.name);
            this.readerContainer.innerHTML = '';
            
            if (typeof ePub === 'undefined') {
                throw new Error('ePub library is not loaded properly');
            }
            
            const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
            
            this.book = ePub(arrayBuffer);
            console.log('Book instance created');
            
            await this.book.ready;
            console.log('Book ready');
            
            await this.renderToc();
            
            this.rendition = this.book.renderTo("reader-container", {
                width: "100%",
                height: "calc(95vh - 180px)",
                spread: "none",
                flow: "scrolled-doc",
                manager: "continuous",
                selectable: true,
                allowScriptedContent: true,
                allowPopups: true
            });
            
            const baseTheme = {
                body: {
                    "font-size": `${this.fontSize}%`,
                    "line-height": "1.5",
                    "padding": "0 20px",
                    "max-width": "100%",
                    "box-sizing": "border-box",
                    "min-height": "calc(95vh - 180px)"
                }
            };
            
            this.rendition.themes.register('base-theme', baseTheme);
            this.rendition.themes.select('base-theme');
            
            this.applyTheme(this.currentTheme);
            
            await this.rendition.display();
            console.log('Content displayed');
            
            this.addKeyboardListener();
            
            await this.loadBookmarks(file.name);
            
            this.book.locations.generate().then(() => {
                this.rendition.on('relocated', (location) => {
                    this.updateProgress(location);
                });
            });
            
            // 初始化摘录管理器
            this.excerptManager = new ExcerptManager(this);
            await this.excerptManager.loadExcerpts(file.name);
            
        } catch (error) {
            console.error('Detailed error:', error);
            console.error('Error stack:', error.stack);
            this.readerContainer.innerHTML = `<div class="error">加载电子书时出错: ${error.message}</div>`;
        }
    }
    
    async renderToc() {
        const navigation = await this.book.navigation;
        const toc = navigation.toc;
        
        const createTocItem = (item) => {
            const li = document.createElement('li');
            li.textContent = item.label;
            li.className = 'toc-item';
            
            // 添加点击事件
            li.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                try {
                    if (this.rendition) {
                        // 获取目标位置
                        const href = item.href;
                        
                        // 解析章节和锚点
                        const url = new URL(href, 'https://example.com');
                        const path = url.pathname;
                        const hash = url.hash;
                        
                        // 先定位到章节开始
                        await this.rendition.display(href);
                        
                        // 等待内容加载完成
                        await new Promise(resolve => setTimeout(resolve, 150));
                        
                        // 获取当前内容
                        const contents = this.rendition.getContents()[0];
                        if (contents) {
                            // 确保滚动容器准备就绪
                            const scrollElement = contents.document.documentElement;
                            
                            // 重置滚动位置
                            scrollElement.scrollTop = 0;
                            
                            if (hash) {
                                // 如果有锚点，精确定位到锚点位置
                                const targetElement = contents.document.getElementById(hash.substring(1));
                                if (targetElement) {
                                    // 计算目标元素的精确位置
                                    const elementRect = targetElement.getBoundingClientRect();
                                    const containerRect = scrollElement.getBoundingClientRect();
                                    const offset = elementRect.top - containerRect.top;
                                    
                                    // 使用精确的滚动位置
                                    scrollElement.scrollTo({
                                        top: offset - 50, // 预留一些顶部空间
                                        behavior: 'auto'
                                    });
                                }
                            } else {
                                // 如果没有锚点，确保滚动到章节开始
                                const firstElement = contents.document.querySelector('body > *');
                                if (firstElement) {
                                    firstElement.scrollIntoView();
                                    scrollElement.scrollTo({
                                        top: 0,
                                        behavior: 'auto'
                                    });
                                }
                            }
                            
                            // 更新进度条
                            const currentLocation = this.rendition.currentLocation();
                            if (currentLocation) {
                                this.updateProgress(currentLocation);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Navigation error:', error);
                }
            });
            
            // 处理子目录
            if (item.subitems && item.subitems.length > 0) {
                const ul = document.createElement('ul');
                item.subitems.forEach(subitem => {
                    ul.appendChild(createTocItem(subitem));
                });
                li.appendChild(ul);
            }
            
            return li;
        };
        
        const ul = document.createElement('ul');
        toc.forEach(item => {
            ul.appendChild(createTocItem(item));
        });
        
        this.toc.innerHTML = '';
        this.toc.appendChild(ul);
    }
    
    toggleToc() {
        this.togglePanel('toc');
    }
    
    async changeTheme(theme) {
        this.currentTheme = theme;
        this.applyTheme(theme);

        // 如果有正在显示的电子书，重新加载当前页面
        if (this.rendition) {
            const currentLocation = this.rendition.currentLocation();
            
            // 重新渲染阅读器
            this.readerContainer.innerHTML = '';
            this.rendition = this.book.renderTo("reader-container", {
                width: "100%",
                height: "calc(95vh - 180px)",
                spread: "none",
                flow: "scrolled-doc",
                manager: "continuous",
                selectable: true
            });

            // 重新应用主题
            const themes = {
                light: {
                    body: { 
                        background: '#ffffff',
                        color: '#333333',
                        "font-size": `${this.fontSize}%`,
                        "min-height": "calc(95vh - 180px)"
                    }
                },
                dark: {
                    body: {
                        background: '#1a1a1a',
                        color: '#ffffff',
                        "font-size": `${this.fontSize}%`,
                        "min-height": "calc(95vh - 180px)"
                    }
                },
                sepia: {
                    body: {
                        background: '#f4ecd8',
                        color: '#5b4636',
                        "font-size": `${this.fontSize}%`,
                        "min-height": "calc(95vh - 180px)"
                    }
                }
            };
            
            this.rendition.themes.register(theme, themes[theme]);
            this.rendition.themes.select(theme);

            // 恢复到之前的位置
            if (currentLocation) {
                await this.rendition.display(currentLocation.start.cfi);
            }

            // 重新绑定事件监听
            if (this.excerptManager) {
                this.excerptManager.initEventListeners();
                
                // 重新应用所有摘录的高亮
                if (this.currentFile) {
                    const bookKey = this.currentFile.name;
                    const excerpts = this.excerptManager.excerpts[bookKey] || [];
                    excerpts.forEach(excerpt => {
                        this.rendition.annotations.add(
                            'highlight',
                            excerpt.cfiRange,
                            {},
                            null,
                            'hl',
                            { fill: 'yellow', opacity: 0.3 }
                        );
                    });
                }
            }
        }
    }
    
    applyTheme(theme) {
        document.body.className = `theme-${theme}`;
        
        if (this.rendition) {
            const themes = {
                light: {
                    body: { 
                        background: '#ffffff',
                        color: '#333333',
                        "font-size": `${this.fontSize}%`,
                        "min-height": "calc(95vh - 180px)"
                    }
                },
                dark: {
                    body: {
                        background: '#1a1a1a',
                        color: '#ffffff',
                        "font-size": `${this.fontSize}%`,
                        "min-height": "calc(95vh - 180px)"
                    }
                },
                sepia: {
                    body: {
                        background: '#f4ecd8',
                        color: '#5b4636',
                        "font-size": `${this.fontSize}%`,
                        "min-height": "calc(95vh - 180px)"
                    }
                }
            };
            
            this.rendition.themes.register(theme, themes[theme]);
            this.rendition.themes.select(theme);
        }
    }
    
    changeFontSize(delta) {
        this.fontSize = Math.max(50, Math.min(200, this.fontSize + delta));
        this.fontSizeDisplay.textContent = `${this.fontSize}%`;
        
        if (this.rendition) {
            const theme = {
                body: {
                    "font-size": `${this.fontSize}%`,
                    "line-height": "1.5",
                    "min-height": "calc(95vh - 180px)"
                }
            };
            
            this.rendition.themes.register('custom-theme', theme);
            this.rendition.themes.select('custom-theme');
        }
    }
    
    async handleTxt(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            this.readerContainer.innerHTML = `<pre>${content}</pre>`;
        };
        reader.readAsText(file);
    }
    
    prevPage() {
        if (this.rendition) {
            this.rendition.prev();
        }
    }
    
    nextPage() {
        if (this.rendition) {
            this.rendition.next();
        }
    }

    addKeyboardListener() {
        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft') {
                this.prevPage();
            }
            if (e.key === 'ArrowRight') {
                this.nextPage();
            }
        });
    }
    
    updateProgress(location) {
        if (!this.book.locations.length()) return;
        
        const progress = this.book.locations.percentageFromCfi(location.start.cfi);
        const percentage = Math.round(progress * 100);
        
        this.progressBar.value = percentage;
        this.progressText.textContent = `${percentage}%`;
    }
    
    async handleProgressChange(event) {
        const percentage = event.target.value / 100;
        const location = this.book.locations.cfiFromPercentage(percentage);
        await this.rendition.display(location);
    }
    
    async loadBookmarks(bookKey) {
        console.log('加载书签:', bookKey);
        const bookmarks = this.bookmarks[bookKey] || [];
        this.bookmarkList.innerHTML = ''; // 清空现有书签
        
        bookmarks.forEach(bookmark => {
            this.addBookmarkToList(bookmark, bookKey);
        });
        
        // 如果有书签，显示书签面板
        if (bookmarks.length > 0) {
            console.log(`加载了 ${bookmarks.length} 个书签`);
        }
    }
    
    addBookmarkToList(bookmark, bookKey) {
        if (!this.bookmarkList) {
            console.error('书签列表元素不存在');
            return;
        }
        
        const div = document.createElement('div');
        div.className = 'bookmark-item';
        
        // 创建书签头部（进度和删除按钮）
        const header = document.createElement('div');
        header.className = 'bookmark-header';
        
        // 创建进度信息
        const progressInfo = document.createElement('div');
        progressInfo.className = 'bookmark-progress-info';
        progressInfo.innerHTML = `
            <span>${bookmark.text.progress}%</span>
            <span>|</span>
            <span>${bookmark.text.timestamp}</span>
        `;
        header.appendChild(progressInfo);
        
        // 创建删除按钮
        const deleteBtn = document.createElement('span');
        deleteBtn.textContent = '×';
        deleteBtn.className = 'bookmark-delete';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.deleteBookmark(bookmark, bookKey);
        };
        header.appendChild(deleteBtn);
        
        div.appendChild(header);
        
        // 创建进度条
        const progressBar = document.createElement('div');
        progressBar.className = 'bookmark-progress-bar';
        const progressBarFill = document.createElement('div');
        progressBarFill.className = 'bookmark-progress-bar-fill';
        progressBarFill.style.width = `${bookmark.text.progress}%`;
        progressBar.appendChild(progressBarFill);
        div.appendChild(progressBar);
        
        // 创建内容预览
        if (bookmark.text.content) {
            const content = document.createElement('div');
            content.className = 'bookmark-content';
            content.textContent = bookmark.text.content;
            div.appendChild(content);
        }
        
        // 添加点击事件来跳转
        div.onclick = () => {
            if (this.rendition) {
                this.rendition.display(bookmark.cfi);
                console.log('跳转到书签位置:', bookmark.text.content);
            }
        };
        
        this.bookmarkList.appendChild(div);
    }
    
    async toggleBookmark() {
        if (!this.book || !this.rendition || !this.currentFile) {
            alert('请先加载电子书');
            return;
        }
        
        const bookKey = this.currentFile.name;
        const location = this.rendition.currentLocation();
        
        if (!location || !location.start) {
            console.log('无法添加书签：无法获取当前位置');
            return;
        }
        
        const cfi = location.start.cfi;
        const bookmarkData = await this.getBookmarkText(cfi);
        
        if (!this.bookmarks[bookKey]) {
            this.bookmarks[bookKey] = [];
        }
        
        const existingIndex = this.bookmarks[bookKey].findIndex(b => b.cfi === cfi);
        
        if (existingIndex >= 0) {
            this.deleteBookmark(this.bookmarks[bookKey][existingIndex], bookKey);
            alert('书签已删除');
        } else {
            const bookmark = { cfi, text: bookmarkData };
            this.bookmarks[bookKey].push(bookmark);
            this.addBookmarkToList(bookmark, bookKey);
            this.saveBookmarks();
            alert('书签已添加');
        }
    }
    
    async getBookmarkText(cfi) {
        try {
            // 获取当前时间
            const now = new Date();
            const dateStr = now.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            // 获取进度百分比
            const progress = this.book.locations.percentageFromCfi(cfi);
            const percentage = Math.round(progress * 100);

            // 获取内容文本
            const item = await this.book.getRange(cfi);
            let contentText = item.toString().trim();
            contentText = contentText.substring(0, 50) + (contentText.length > 50 ? '...' : '');
            
            // 返回包含进度信息的对象
            return {
                timestamp: dateStr,
                progress: percentage,
                content: contentText
            };
        } catch (error) {
            return {
                timestamp: new Date().toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }),
                progress: 0,
                content: '无法获取内容'
            };
        }
    }
    
    deleteBookmark(bookmark, bookKey) {
        const index = this.bookmarks[bookKey].findIndex(b => b.cfi === bookmark.cfi);
        if (index >= 0) {
            this.bookmarks[bookKey].splice(index, 1);
            this.saveBookmarks();
            this.loadBookmarks(bookKey);
        }
    }
    
    saveBookmarks() {
        localStorage.setItem('bookmarks', JSON.stringify(this.bookmarks));
    }
    
    togglePanel(panelName) {
        const panels = {
            'toc': this.toc,
            'bookmarks': this.bookmarksPanel,
            'excerpts': this.excerptManager?.panel
        };
        
        const wrapper = document.querySelector('.reader-wrapper');
        const targetPanel = panels[panelName];
        
        if (!targetPanel) return;

        const isTargetVisible = !targetPanel.classList.contains('hidden');
        
        // 如果目标面板已经可见，则隐藏它
        if (isTargetVisible) {
            this.hideAllPanels();
            return;
        }

        // 否则，隐藏其他面板，显示目标面板
        Object.values(panels).forEach(panel => {
            if (panel) {
                panel.classList.add('hidden');
                panel.classList.remove('visible');
            }
        });
        
        targetPanel.classList.remove('hidden');
        setTimeout(() => targetPanel.classList.add('visible'), 0);
        
        // 添加左侧padding
        wrapper.classList.add('has-panel');

        // 如果是书签面板，检查是否需要加载书签
        if (panelName === 'bookmarks' && this.currentFile && this.bookmarkList.children.length === 0) {
            this.loadBookmarks(this.currentFile.name);
        }
    }

    hideAllPanels() {
        const wrapper = document.querySelector('.reader-wrapper');
        const panels = [this.toc, this.bookmarksPanel, this.excerptManager?.panel];
        
        panels.forEach(panel => {
            if (panel) {
                panel.classList.remove('visible');
                panel.classList.add('hidden');
            }
        });
        
        wrapper.classList.remove('has-panel');
    }

    toggleExcerpts() {
        this.togglePanel('excerpts');
    }
}

// 初始化阅读器
new Reader(); 