// DOM 요소들
const keywordInput = document.getElementById('keywordInput');
const addKeywordBtn = document.getElementById('addKeywordBtn');
const keywordsList = document.getElementById('keywordsList');
const recentNews = document.getElementById('recentNews');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const notificationToggle = document.getElementById('notificationToggle');
const soundToggle = document.getElementById('soundToggle');
const optionsBtn = document.getElementById('optionsBtn');
const refreshBtn = document.getElementById('refreshBtn');

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    // HTML 요소들의 텍스트를 i18n 메시지로 설정
    document.getElementById('extNameTitle').textContent = chrome.i18n.getMessage('appName');
    document.getElementById('popupTitleElement').textContent = chrome.i18n.getMessage('appName');
    document.getElementById('keywordManagementTitle').textContent = chrome.i18n.getMessage('keywordManagement');
    document.getElementById('keywordInput').placeholder = chrome.i18n.getMessage('addKeywordPlaceholder');
    document.getElementById('addBtnText').textContent = chrome.i18n.getMessage('addButton');
    document.getElementById('recentNewsTitle').textContent = chrome.i18n.getMessage('recentNews');
    document.getElementById('noNewsText').textContent = chrome.i18n.getMessage('noNews');
    document.getElementById('quickSettingsTitle').textContent = chrome.i18n.getMessage('quickSettings');
    document.getElementById('enableNotificationsLabel').textContent = chrome.i18n.getMessage('enableNotifications');
    document.getElementById('enableSoundLabel').textContent = chrome.i18n.getMessage('enableSound');
    document.getElementById('optionsBtnText').textContent = chrome.i18n.getMessage('options');
    document.getElementById('refreshBtnText').textContent = chrome.i18n.getMessage('refresh');

    // 다른 초기화 함수 호출
    await loadSettings();
    await loadKeywords();
    await loadRecentNews();
    await updateStatus();
    setupEventListeners();
});

// 이벤트 리스너 설정
function setupEventListeners() {
    // 키워드 추가
    addKeywordBtn.addEventListener('click', addKeyword);
    keywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addKeyword();
        }
    });

    // 설정 토글
    notificationToggle.addEventListener('change', saveSettings);
    soundToggle.addEventListener('change', saveSettings);

    // 버튼들
    optionsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    refreshBtn.addEventListener('click', async () => {
        document.getElementById('refreshBtnText').textContent = chrome.i18n.getMessage('refreshing');
        refreshBtn.disabled = true;
        
        // 백그라운드에 즉시 체크 요청
        chrome.runtime.sendMessage({ action: 'forceCheck' });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        await loadRecentNews();
        
        document.getElementById('refreshBtnText').textContent = chrome.i18n.getMessage('refresh');
        refreshBtn.disabled = false;
    });
}

// 키워드 추가
async function addKeyword() {
    const keyword = keywordInput.value.trim();
    
    if (!keyword) {
        showToast(chrome.i18n.getMessage('enterKeyword'));
        return;
    }

    if (keyword.length > 50) {
        showToast(chrome.i18n.getMessage('keywordTooLong'));
        return;
    }

    try {
        // 기존 키워드 가져오기
        const result = await chrome.storage.sync.get(['keywords']);
        const keywords = result.keywords || [];

        // 중복 체크
        if (keywords.includes(keyword)) {
            showToast(chrome.i18n.getMessage('duplicateKeyword'));
            return;
        }

        // 키워드 추가
        keywords.push(keyword);
        await chrome.storage.sync.set({ keywords });

        // UI 업데이트
        keywordInput.value = '';
        await loadKeywords();
        
        // 백그라운드에 키워드 업데이트 알림
        chrome.runtime.sendMessage({ 
            action: 'keywordsUpdated', 
            keywords 
        });

        showToast(chrome.i18n.getMessage('keywordAdded'));
    } catch (error) {
        console.error('키워드 추가 실패:', error);
        showToast('Failed to add keyword.');
    }
}

// 키워드 삭제
async function removeKeyword(keyword) {
    try {
        const result = await chrome.storage.sync.get(['keywords']);
        const keywords = result.keywords || [];
        
        const updatedKeywords = keywords.filter(k => k !== keyword);
        await chrome.storage.sync.set({ keywords: updatedKeywords });

        await loadKeywords();
        
        // 백그라운드에 키워드 업데이트 알림
        chrome.runtime.sendMessage({ 
            action: 'keywordsUpdated', 
            keywords: updatedKeywords 
        });

        showToast(chrome.i18n.getMessage('keywordRemoved'));
    } catch (error) {
        console.error('키워드 삭제 실패:', error);
        showToast('Failed to remove keyword.');
    }
}

// 키워드 목록 로드
async function loadKeywords() {
    try {
        const result = await chrome.storage.sync.get(['keywords']);
        const keywords = result.keywords || [];

        keywordsList.innerHTML = '';

        if (keywords.length === 0) {
            keywordsList.innerHTML = `<div class="no-keywords">No registered keywords.</div>`;
            return;
        }

        keywords.forEach(keyword => {
            const tag = document.createElement('div');
            tag.className = 'keyword-tag';
            tag.innerHTML = `
                <span>${escapeHtml(keyword)}</span>
                <button class="remove-btn" title="Remove">×</button>
            `;

            tag.querySelector('.remove-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                removeKeyword(keyword);
            });

            keywordsList.appendChild(tag);
        });
    } catch (error) {
        console.error('키워드 로드 실패:', error);
        keywordsList.innerHTML = `<div class="no-keywords">Failed to load keywords.</div>`;
    }
}

// 최근 뉴스 로드
async function loadRecentNews() {
    try {
        const result = await chrome.storage.local.get(['recentNews']);
        const news = result.recentNews || [];

        recentNews.innerHTML = '';

        if (news.length === 0) {
            recentNews.innerHTML = `<div class="no-news">${chrome.i18n.getMessage('noNews')}</div>`;
            return;
        }

        // 최신 5개만 표시
        const recentItems = news.slice(0, 5);

        recentItems.forEach(item => {
            const newsElement = document.createElement('div');
            newsElement.className = 'news-item';
            newsElement.innerHTML = `
                <div class="news-title">${escapeHtml(item.title)}</div>
                <div class="news-source">${escapeHtml(item.source)} • ${formatTime(item.publishedAt)}</div>
            `;

            newsElement.addEventListener('click', () => {
                chrome.tabs.create({ url: item.link });
            });

            recentNews.appendChild(newsElement);
        });
    } catch (error) {
        console.error('최근 뉴스 로드 실패:', error);
        recentNews.innerHTML = `<div class="no-news">Failed to load recent news.</div>`;
    }
}

// 설정 로드
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get([
            'notificationsEnabled',
            'soundEnabled'
        ]);

        notificationToggle.checked = result.notificationsEnabled !== false;
        soundToggle.checked = result.soundEnabled === true;
    } catch (error) {
        console.error('설정 로드 실패:', error);
    }
}

// 설정 저장
async function saveSettings() {
    try {
        await chrome.storage.sync.set({
            notificationsEnabled: notificationToggle.checked,
            soundEnabled: soundToggle.checked
        });

        // 백그라운드에 설정 변경 알림
        chrome.runtime.sendMessage({ 
            action: 'settingsUpdated',
            settings: {
                notificationsEnabled: notificationToggle.checked,
                soundEnabled: soundToggle.checked
            }
        });
    } catch (error) {
        console.error('설정 저장 실패:', error);
        showToast('Failed to save settings.');
    }
}

// 상태 업데이트
async function updateStatus() {
    try {
        // 백그라운드 스크립트에서 상태 정보 요청
        const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
        
        if (response && response.isActive) {
            statusDot.classList.remove('inactive');
            statusText.textContent = chrome.i18n.getMessage('active');
        } else {
            statusDot.classList.add('inactive');
            statusText.textContent = chrome.i18n.getMessage('inactive');
        }

        if (response && response.lastCheck) {
            const lastCheckTime = new Date(response.lastCheck);
            const now = new Date();
            const diffMinutes = Math.floor((now - lastCheckTime) / 60000);
            
            if (diffMinutes < 1) {
                statusText.textContent += ' • ' + chrome.i18n.getMessage('justNow');
            } else if (diffMinutes < 60) {
                statusText.textContent += ' • ' + chrome.i18n.getMessage('minutesAgo', [diffMinutes.toString()]);
            } else if (diffMinutes < 1440) {
                statusText.textContent += ' • ' + chrome.i18n.getMessage('hoursAgo', [Math.floor(diffMinutes / 60).toString()]);
            } else {
                statusText.textContent += ' • ' + chrome.i18n.getMessage('daysAgo', [Math.floor(diffMinutes / 1440).toString()]);
            }
        }
    } catch (error) {
        console.error('상태 업데이트 실패:', error);
        statusDot.classList.add('inactive');
        statusText.textContent = 'Status check failed';
    }
}

// 유틸리티 함수들
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return chrome.i18n.getMessage('justNow');
    if (minutes < 60) return chrome.i18n.getMessage('minutesAgo', [minutes.toString()]);
    if (minutes < 1440) return chrome.i18n.getMessage('hoursAgo', [Math.floor(minutes / 60).toString()]);
    return chrome.i18n.getMessage('daysAgo', [Math.floor(minutes / 1440).toString()]);
}

function showToast(message) {
    // 간단한 토스트 메시지 표시
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #333;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 1000;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}