// offscreen.js
console.log('Offscreen document loaded');

// 메시지 리스너 설정
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') {
        return false; // 다른 대상의 메시지는 무시
    }
    
    if (message.type === 'parse-rss') {
        // 즉시 응답하여 비동기 처리 시작을 알림
        sendResponse({ status: 'processing' });
        
        // 비동기로 RSS 파싱 처리
        setTimeout(() => {
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
                
                // 성공 응답 전송
                chrome.runtime.sendMessage({
                    type: 'rss-parsed',
                    keyword: message.keyword,
                    articles: articles
                }).catch(error => {
                    console.error('Failed to send rss-parsed message:', error);
                });
                
            } catch (error) {
                console.error('RSS parsing error:', error);
                
                // 오류 응답 전송
                chrome.runtime.sendMessage({
                    type: 'rss-parse-error',
                    keyword: message.keyword,
                    error: error.message
                }).catch(error => {
                    console.error('Failed to send rss-parse-error message:', error);
                });
            }
        }, 0);
        
        return true; // 비동기 응답 표시
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