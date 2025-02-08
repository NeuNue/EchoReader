class AudioPlayer {
    constructor() {
        this.createFloatingWindow();
        this.initElements();
        this.initAudio();
        this.initEventListeners();
        this.loadConfig();
    }

    createFloatingWindow() {
        // 创建悬浮窗
        const floatingWindow = document.createElement('div');
        floatingWindow.className = 'floating-audio-player';
        floatingWindow.innerHTML = `
            <div class="audio-player-header">
                <span>白噪音播放器</span>
                <button class="minimize-btn">_</button>
            </div>
            <div class="audio-player-content">
                <select id="audio-select">
                    <option value="">选择白噪音</option>
                </select>
                <div class="audio-controls">
                    <button id="audio-toggle" class="audio-btn" disabled>
                        <span class="play-icon">▶</span>
                    </button>
                    <div class="volume-control">
                        <input type="range" id="volume-slider" min="0" max="100" value="50" disabled>
                        <span id="volume-display">50%</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(floatingWindow);

        // 添加拖拽功能
        this.makeDraggable(floatingWindow);
        
        // 添加最小化功能
        const minimizeBtn = floatingWindow.querySelector('.minimize-btn');
        const content = floatingWindow.querySelector('.audio-player-content');
        minimizeBtn.addEventListener('click', () => {
            content.classList.toggle('minimized');
            minimizeBtn.textContent = content.classList.contains('minimized') ? '+' : '_';
        });
    }

    makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = element.querySelector('.audio-player-header');
        
        header.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    initElements() {
        this.audioSelect = document.getElementById('audio-select');
        this.audioToggle = document.getElementById('audio-toggle');
        this.volumeSlider = document.getElementById('volume-slider');
        this.volumeDisplay = document.getElementById('volume-display');
        this.playIcon = this.audioToggle.querySelector('.play-icon');
    }

    initAudio() {
        this.audio = null;
        this.currentSound = null;
    }

    initEventListeners() {
        this.audioSelect.addEventListener('change', () => this.handleAudioChange());
        this.audioToggle.addEventListener('click', () => this.togglePlay());
        this.volumeSlider.addEventListener('input', () => this.handleVolumeChange());
    }

    togglePlay() {
        if (!this.audio) return;

        if (this.audio.paused) {
            this.audio.play()
                .then(() => {
                    this.playIcon.textContent = '⏸';
                })
                .catch(error => {
                    console.error('播放音频失败:', error);
                    alert('播放音频失败，请重试');
                });
        } else {
            this.audio.pause();
            this.playIcon.textContent = '▶';
        }
    }

    handleVolumeChange() {
        if (!this.audio) return;
        const volume = this.volumeSlider.value;
        this.audio.volume = volume / 100;
        this.volumeDisplay.textContent = `${volume}%`;
    }

    handleAudioChange() {
        const selectedValue = this.audioSelect.value;
        
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
            this.playIcon.textContent = '▶';
        }

        if (selectedValue) {
            console.log('Loading audio:', selectedValue);
            this.audio = new Audio(`/audio/${selectedValue}`);
            this.audio.loop = true;
            this.audio.volume = this.volumeSlider.value / 100;
            
            this.audio.addEventListener('canplaythrough', () => {
                console.log('Audio ready to play');
                this.audioToggle.disabled = false;
                this.volumeSlider.disabled = false;
            });

            this.audio.addEventListener('error', (e) => {
                console.error('Audio loading error:', e);
                alert('加载音频文件失败');
                this.audioToggle.disabled = true;
                this.volumeSlider.disabled = true;
            });
        } else {
            this.audioToggle.disabled = true;
            this.volumeSlider.disabled = true;
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('/audio/config.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const config = await response.json();
            this.updateAudioSelect(config.categories);
        } catch (error) {
            console.error('Error loading audio config:', error);
            this.audioSelect.innerHTML = '<option value="">加载音频配置失败</option>';
        }
    }

    updateAudioSelect(categories) {
        this.audioSelect.innerHTML = '<option value="">选择白噪音</option>';
        
        categories.forEach(category => {
            const groupElement = document.createElement('optgroup');
            groupElement.label = category.name;
            
            category.sounds.forEach(sound => {
                const option = document.createElement('option');
                option.value = sound.file;
                option.textContent = sound.name;
                groupElement.appendChild(option);
            });
            
            this.audioSelect.appendChild(groupElement);
        });
    }
}

// 初始化音频播放器
new AudioPlayer(); 