// offscreen.js
console.log('Offscreen document loaded');

// 메시지 리스너 설정
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') {
        return false; // 다른 대상의 메시지는 무시
    }
    
    if (message.type === 'parse-rss') {
        // 비동기 응답을 위해 true 반환
        (async () => {
            try {
                // RSS XML 파싱
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(message.xmlText, 'text/xml');
                
                // 파싱 오류 체크
                const parserError = xmlDoc.querySelector('parsererror');
                if (parserError) {
                    throw new Error('XML parsing failed: ' + parserError.textContent);
                }
                
                // RSS 아이템들 추출
                const items = xmlDoc.querySelectorAll('item');
                const articles = [];
                
                items.forEach(item => {
                    const title = item.querySelector('title')?.textContent || '';
                    const link = item.querySelector('link')?.textContent || '';
                    const pubDate = item.querySelector('pubDate')?.textContent || '';
                    const source = item.querySelector('source')?.textContent || 'Google News';
                    
                    if (title && link) {
                        articles.push({
                            title: title.trim(),
                            link: link.trim(),
                            pubDate: pubDate.trim(),
                            source: source.trim()
                        });
                    }
                });
                
                console.log(`Parsed ${articles.length} articles for keyword: ${message.keyword}`);
                
                // sendResponse를 통해 직접 응답
                sendResponse({
                    success: true,
                    articles: articles
                });
                
            } catch (error) {
                console.error('RSS parsing error:', error);
                
                // 오류 응답
                sendResponse({
                    success: false,
                    error: error.message
                });
            }
        })();
        
        return true; // 비동기 응답을 위해 true 반환
    }
    
    return false; // 다른 메시지 타입은 처리하지 않음
});

// 문서 로드 완료 알림
setTimeout(() => {
    chrome.runtime.sendMessage({
        type: 'offscreen-ready'
    }).catch(() => {
        // 백그라운드 스크립트가 준비되지 않았을 수 있음 - 무시
        console.log('Background script not ready yet');
    });
}, 100);