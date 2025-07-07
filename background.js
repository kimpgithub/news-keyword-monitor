let isMonitoring = false;
let lastCheckTime = null;
let checkInterval = 10 * 60 * 1000; // 기본 10분
const maxInterval = 30 * 60 * 1000; // 최대 30분
const minInterval = 3 * 60 * 1000; // 최소 3분

// Offscreen 문서 관리 (수정된 버전)
let offscreenCreating;
let offscreenReady = false;

async function setupOffscreenDocument(path) {
    const offscreenUrl = chrome.runtime.getURL(path);
    
    try {
        // 기존 offscreen 문서 확인
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
            documentUrls: [offscreenUrl]
        });

        if (existingContexts.length > 0) {
            console.log('Offscreen document already exists');
            offscreenReady = true;
            return; // 이미 존재함
        }

        // 중복 생성 방지
        if (offscreenCreating) {
            console.log('Offscreen document creation in progress, waiting...');
            await offscreenCreating;
            return;
        }

        console.log('Creating offscreen document...');
        offscreenCreating = chrome.offscreen.createDocument({
            url: path,
            reasons: ['DOM_PARSER'],
            justification: 'Parse RSS feed content',
        });
        
        await offscreenCreating;
        console.log('Offscreen document created successfully');
        offscreenCreating = null;
        
        // offscreen 준비 상태 설정
        offscreenReady = true;
        
    } catch (error) {
        console.error('Failed to setup offscreen document:', error);
        offscreenCreating = null;
        offscreenReady = false;
        throw error;
    }
}

// Offscreen 메시지 리스너 추가
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'offscreen-ready') {
        console.log('Offscreen document is ready');
        offscreenReady = true;
        return false;
    }
    return false;
});

// 확장프로그램 설치/업데이트 시 초기화
chrome.runtime.onInstalled.addListener(async () => {
    console.log('뉴스 모니터링 시작됨');
    
    // 기본 설정 초기화
    const defaultSettings = {
        keywords: [],
        notificationsEnabled: true,
        soundEnabled: false,
        checkInterval: 10,
        duplicateThreshold: 0.8
    };

    // 기존 설정 확인 후 없는 것만 추가
    const existing = await chrome.storage.sync.get(Object.keys(defaultSettings));
    const toSet = {};
    
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (existing[key] === undefined) {
            toSet[key] = value;
        }
    }
    
    if (Object.keys(toSet).length > 0) {
        await chrome.storage.sync.set(toSet);
    }

    // 모니터링 시작
    startMonitoring();
});

// 확장프로그램 시작 시 모니터링 재개
chrome.runtime.onStartup.addListener(() => {
    console.log('뉴스 모니터링 시작됨' + ' - ' + '모니터링 중');
    startMonitoring();
});

// 알람 설정
async function startMonitoring() {
    if (isMonitoring) return;
    
    isMonitoring = true;
    console.log('뉴스 모니터링 시작됨');
    
    // 즉시 한 번 체크
    await checkNews();
    
    // 기존 알람 제거
    await chrome.alarms.clear('newsCheck');
    
    // 주기적 체크 설정
    const alarmInfo = {
        delayInMinutes: checkInterval / 60000,
        periodInMinutes: checkInterval / 60000 
    };
    
    console.log('알람 설정:', alarmInfo);
    await chrome.alarms.create('newsCheck', alarmInfo);
    
    // 알람이 제대로 설정되었는지 확인
    const alarms = await chrome.alarms.getAll();
    console.log('현재 설정된 알람들:', alarms);
}

// 알람 이벤트 처리
chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log('알람 트리거됨:', alarm);
    if (alarm.name === 'newsCheck') {
        console.log('뉴스 체크 알람 실행');
        await checkNews();
    }
});

// 뉴스 체크 메인 함수
async function checkNews() {
    try {
        console.log('뉴스 확인 시작', new Date().toLocaleTimeString());
        lastCheckTime = Date.now();
        
        // 키워드와 설정 가져오기
        const { keywords, notificationsEnabled } = await chrome.storage.sync.get([
            'keywords', 'notificationsEnabled'
        ]);

        if (!keywords || keywords.length === 0) {
            console.log('등록된 키워드가 없습니다.');
            adjustCheckInterval(false);
            return;
        }

        let foundNewNews = false;

        // 각 키워드별로 뉴스 검색
        for (const keyword of keywords) {
            const newArticles = await fetchNewsForKeyword(keyword);
            
            if (newArticles.length > 0) {
                foundNewNews = true;
                
                // 새 뉴스 저장
                await saveNewArticles(newArticles);
                
                // 알림 발송
                if (notificationsEnabled) {
                    await sendNotifications(newArticles, keyword);
                }
            }
        }

        // 체크 간격 조정
        await adjustCheckInterval(foundNewNews);
        
        // 팝업에 상태 업데이트 알림
        broadcastMessage({ action: 'statusChanged' });
        
        if (foundNewNews) {
            broadcastMessage({ action: 'newsUpdated' });
        }

    } catch (error) {
        console.error('뉴스 확인 실패:', error);
        await adjustCheckInterval(false);
    }
}

// 특정 키워드로 뉴스 검색 (수정된 버전)
async function fetchNewsForKeyword(keyword) {
    try {
        const { language } = await chrome.storage.sync.get(['language']);
        const langCode = language || chrome.i18n.getUILanguage().split('-')[0];

        let hl = 'en';
        let gl = 'US';

        if (langCode === 'ko') {
            hl = 'ko';
            gl = 'KR';
        } else if (langCode === 'en') {
            hl = 'en';
            gl = 'US';
        }

        const encodedKeyword = encodeURIComponent(keyword);
        const rssUrl = `https://news.google.com/rss/search?q=${encodedKeyword}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`;
        
        console.log(`키워드 검색 시작: ${keyword}`, rssUrl);
        
        const response = await fetch(rssUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        console.log(`RSS 데이터 가져옴 (${xmlText.length} characters)`);
        
        let parsedArticles = [];
        
        // Offscreen 문서로 파싱 요청
        try {
            await setupOffscreenDocument('offscreen.html');
            
            // offscreen 준비 상태 확인 및 대기
            let attempts = 0;
            while (!offscreenReady && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!offscreenReady) {
                throw new Error('Offscreen document not ready');
            }
            
            // 직접 메시지 전송 및 응답 대기
            const response = await chrome.runtime.sendMessage({
                target: 'offscreen',
                type: 'parse-rss',
                xmlText: xmlText,
                keyword: keyword
            });
            
            if (response && response.success) {
                parsedArticles = response.articles;
            } else {
                throw new Error(response?.error || 'RSS parsing failed');
            }
            
        } catch (offscreenError) {
            console.warn('Offscreen 파싱 실패:', offscreenError);
            // 오프스크린 문서가 실패하면 더 이상 직접 파싱 시도하지 않고, 빈 배열 반환
            return [];
        }

        const articles = [];
        const now = Date.now();

        parsedArticles.forEach(item => {
            // 시간 정보가 없거나 잘못된 경우 제외
            if (!item.pubDate) {
                console.log(`시간 정보 없음: ${item.title}`);
                return;
            }
            
            const publishedAt = new Date(item.pubDate).getTime();
            
            // 잘못된 날짜 체크 (미래 시간이거나 너무 과거인 경우)
            if (isNaN(publishedAt) || publishedAt > now || publishedAt < now - (30 * 24 * 60 * 60 * 1000)) {
                console.log(`잘못된 시간 정보: ${item.title}, pubDate: ${item.pubDate}`);
                return;
            }
            
            // 1시간 이내 뉴스만 처리
            const hoursDiff = (now - publishedAt) / (1000 * 60 * 60);
            
            if (hoursDiff <= 1) {
                console.log(`1시간 이내 뉴스 발견: "${item.title}" (${hoursDiff.toFixed(2)}시간 전)`);
                articles.push({
                    title: item.title,
                    link: item.link,
                    source: item.source,
                    publishedAt: publishedAt,
                    keyword: keyword,
                    id: generateArticleId(item.title, item.link),
                    normalizedTitle: normalizeTitle(item.title)
                });
            } else {
                console.log(`1시간 초과 뉴스 제외: "${item.title}" (${hoursDiff.toFixed(2)}시간 전)`);
            }
        });
        
        // 중복 제거
        const newArticles = await filterDuplicates(articles);
        
        console.log(`[${keyword}] 총 ${articles.length}개 기사 중 ${newArticles.length}개 새 기사 발견`);
        
        return newArticles;
        
    } catch (error) {
        console.error(`키워드 뉴스 가져오기 실패 (${keyword}):`, error);
        return [];
    }
}

// 중복 제거 (3단계 필터링)
async function filterDuplicates(articles) {
    try {
        // 기존 뉴스 해시 가져오기
        const { seenArticles = {} } = await chrome.storage.local.get(['seenArticles']);
        const newArticles = [];
        
        for (const article of articles) {
            // 1차: ID 기반 중복 체크
            if (seenArticles[article.id]) {
                continue;
            }
            
            // 2차: URL 도메인 + 시간 기반 체크
            const domainTimeKey = getDomainTimeKey(article);
            if (seenArticles[domainTimeKey]) {
                continue;
            }
            
            // 3차: 제목 유사도 체크
            const { duplicateThreshold } = await chrome.storage.sync.get(['duplicateThreshold']);
            const threshold = duplicateThreshold !== undefined ? duplicateThreshold : 0.8;

            const isDuplicate = await checkTitleSimilarity(article, seenArticles, threshold);
            if (isDuplicate) {
                continue;
            }
            
            // 새로운 뉴스로 판정
            newArticles.push(article);
            
            // 해시 저장
            seenArticles[article.id] = {
                timestamp: article.publishedAt,
                normalizedTitle: article.normalizedTitle,
                domain: extractDomain(article.link)
            };
            seenArticles[getDomainTimeKey(article)] = article.publishedAt; // 도메인+시간 키도 저장
        }
        
        // 1주일 이상 된 데이터 정리
        cleanupOldHashes(seenArticles);
        
        // 저장
        await chrome.storage.local.set({ seenArticles });
        
        return newArticles;
        
    } catch (error) {
        console.error('중복 필터링 실패:', error);
        return articles; // 실패 시 원본 반환
    }
}

// 제목 유사도 체크
async function checkTitleSimilarity(article, seenArticles, threshold) {
    for (const [key, seen] of Object.entries(seenArticles)) {
        // seenArticles의 키가 ID 또는 domainTimeKey일 수 있으므로, 객체 형태인지 확인
        if (typeof seen === 'object' && seen.normalizedTitle && seen.timestamp) {
            // 같은 날짜의 뉴스만 비교
            const daysDiff = Math.abs(article.publishedAt - seen.timestamp) / (1000 * 60 * 60 * 24);
            if (daysDiff <= 1) {
                const similarity = calculateLevenshteinSimilarity(
                    article.normalizedTitle, 
                    seen.normalizedTitle
                );
                
                if (similarity >= threshold) {
                    return true; // 중복 판정
                }
            }
        }
    }
    
    return false;
}

// 새 뉴스 저장
async function saveNewArticles(articles) {
    try {
        const { recentNews = [] } = await chrome.storage.local.get(['recentNews']);
        
        // 새 뉴스를 앞에 추가
        const updatedNews = [...articles, ...recentNews];
        
        // 최대 100개까지만 보관
        const trimmedNews = updatedNews.slice(0, 100);
        
        await chrome.storage.local.set({ recentNews: trimmedNews });
        
    } catch (error) {
        console.error('새 뉴스 저장 실패:', error);
    }
}

// 알림 발송
async function sendNotifications(articles, keyword) {
    try {
        const { soundEnabled } = await chrome.storage.sync.get(['soundEnabled']);
        
        // 키워드별로 하나의 알림으로 그룹화
        const title = `${keyword} 관련 새 뉴스 ${articles.length}개 발견!`;
        const message = articles.length === 1 
            ? `${articles[0].title}`
            : `${articles[0].title} 외 ${articles.length - 1}개`;
        
        await chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon-48.png',
            title,
            message,
            buttons: [
                { title: '확인' },
                { title: '설정' }
            ]
        });
        
        // 소리 알림 (옵션)
        if (soundEnabled) {
            // 시스템 기본 알림음 사용
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon-16.png',
                title: '',
                message: '',
                silent: false
            });
        }
        
    } catch (error) {
        console.error('알림 발송 실패:', error);
    }
}

// 체크 간격 동적 조정
async function adjustCheckInterval(foundNews) {
    if (foundNews) {
        // 새 뉴스 발견 시 간격 단축
        checkInterval = Math.max(minInterval, checkInterval * 0.5);
    } else {
        // 없으면 간격 점진적 증가
        checkInterval = Math.min(maxInterval, checkInterval * 1.2);
    }
    
    console.log(`체크 간격 조정됨: ${Math.round(checkInterval / 60000)}분`);
    
    // 알람 재설정
    await chrome.alarms.clear('newsCheck');
    const alarmInfo = {
        delayInMinutes: checkInterval / 60000,
        periodInMinutes: checkInterval / 60000 
    };
    
    console.log('알람 재설정:', alarmInfo);
    await chrome.alarms.create('newsCheck', alarmInfo);
    
    // 알람이 제대로 설정되었는지 확인
    const alarms = await chrome.alarms.getAll();
    console.log('재설정된 알람들:', alarms);
}

// 유틸리티 함수들
function generateArticleId(title, link) {
    return btoa(unescape(encodeURIComponent(title + link))).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
}

function normalizeTitle(title) {
    return title
        .replace(/[^\w\s가-힣]/g, ' ') // 특수문자 제거
        .replace(/\b\d{1,2}:\d{2}\b/g, '') // 시간 제거
        .replace(/\b(연합뉴스|뉴스1|뉴시스|YTN|KBS|MBC|SBS)\b/g, '') // 언론사명 제거
        .replace(/\s+/g, ' ') // 공백 정리
        .trim()
        .toLowerCase();
}

function extractDomain(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return 'unknown';
    }
}

function getDomainTimeKey(article) {
    const domain = extractDomain(article.link);
    const hourKey = Math.floor(article.publishedAt / (1000 * 60 * 60)); // 시간별 키
    return `${domain}_${hourKey}`;
}

function calculateLevenshteinSimilarity(str1, str2) {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;
    
    const distance = levenshteinDistance(str1, str2);
    return 1 - (distance / maxLength);
}

function levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j - 1][i] + 1,     // deletion
                matrix[j][i - 1] + 1,     // insertion
                matrix[j - 1][i - 1] + cost // substitution
            );
        }
    }
    
    return matrix[str2.length][str1.length];
}

function cleanupOldHashes(seenArticles) {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const [key, value] of Object.entries(seenArticles)) {
        const timestamp = typeof value === 'object' ? value.timestamp : value;
        if (timestamp && timestamp < oneWeekAgo) {
            delete seenArticles[key];
        }
    }
}

function broadcastMessage(message) {
    // 팝업이 열려있으면 메시지 전송
    chrome.runtime.sendMessage(message).catch(() => {
        // 팝업이 닫혀있으면 무시
    });
}

// 팝업에서 오는 메시지 처리 (수정된 버전)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // offscreen 문서에서 오는 메시지 처리
    if (message.type === 'rss-parsed' || message.type === 'rss-parse-error') {
        // offscreen에서 온 메시지는 별도 처리하지 않고 무시
        return false;
    }
    
    (async () => {
        try {
            switch (message.action) {
                case 'getStatus':
                    sendResponse({
                        isActive: isMonitoring,
                        lastCheck: lastCheckTime,
                        checkInterval: Math.round(checkInterval / 60000)
                    });
                    break;
                    
                case 'forceCheck':
                    console.log('Force check requested');
                    await checkNews();
                    sendResponse({ success: true });
                    break;
                    
                case 'keywordsUpdated':
                    console.log('키워드 업데이트됨:', message.keywords);
                    // 키워드 변경 시 즉시 체크
                    setTimeout(() => checkNews(), 1000);
                    sendResponse({ success: true });
                    break;
                    
                case 'settingsUpdated':
                    console.log('설정 업데이트됨:', message.settings);
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('메시지 처리 실패:', error);
            sendResponse({ error: error.message });
        }
    })();
    
    return true; // 비동기 응답을 위해 true 반환
});

// 알림 클릭 처리 (수정됨)
chrome.notifications.onClicked.addListener(async () => {
    try {
        // 먼저 활성 창이 있는지 확인
        const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
        
        if (windows.length === 0) {
            // 활성 창이 없으면 새 창을 생성
            await chrome.windows.create({
                url: 'chrome://newtab/',
                focused: true
            });
        } else {
            // 기존 창을 포커스
            const activeWindow = windows.find(w => w.focused) || windows[0];
            await chrome.windows.update(activeWindow.id, { focused: true });
        }
        
        // 팝업 열기 시도
        try {
            await chrome.action.openPopup();
        } catch (error) {
            console.log('팝업 열기 실패, 대신 확장프로그램 페이지로 이동');
            // 팝업 열기 실패 시 확장프로그램 관리 페이지로 이동
            await chrome.tabs.create({
                url: 'chrome://extensions/?id=' + chrome.runtime.id
            });
        }
    } catch (error) {
        console.error('알림 클릭 처리 실패:', error);
    }
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    try {
        if (buttonIndex === 1) { // 설정 버튼
            await chrome.runtime.openOptionsPage();
        }
        await chrome.notifications.clear(notificationId);
    } catch (error) {
        console.error('알림 버튼 클릭 처리 실패:', error);
    }
});

// broadcastMessage 함수도 안전하게 수정
function broadcastMessage(message) {
    // 팝업이 열려있으면 메시지 전송
    chrome.runtime.sendMessage(message).catch((error) => {
        // 팝업이 닫혀있거나 오류 발생 시 무시
        console.log('브로드캐스트 메시지 실패 (정상):', error.message);
    });
}