document.addEventListener('DOMContentLoaded', () => {
    const checkInterval = document.getElementById('checkInterval');
    const duplicateThreshold = document.getElementById('duplicateThreshold');
    const thresholdValue = document.getElementById('thresholdValue');
    const clearDataBtn = document.getElementById('clearDataBtn');
    const saveBtn = document.getElementById('saveBtn');
    const statusMessage = document.getElementById('statusMessage');
    const importBtn = document.getElementById('importBtn');
    const exportBtn = document.getElementById('exportBtn');
    

    // 설정 불러오기
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['checkInterval', 'duplicateThreshold', 'language']);
            checkInterval.value = result.checkInterval || 10;
            duplicateThreshold.value = result.duplicateThreshold || 0.8;
            thresholdValue.textContent = duplicateThreshold.value;
            
        } catch (error) {
            console.error('설정 로드 실패:', error);
            showStatus('설정 로드 실패', 'error');
        }
    }

    // 설정 저장하기
    async function saveSettings() {
        try {
            const interval = parseInt(checkInterval.value, 10);
            const threshold = parseFloat(duplicateThreshold.value);
            

            if (interval < 3 || interval > 60) {
                showStatus('확인 주기는 3분에서 60분 사이여야 합니다.', 'error');
                return;
            }

            await chrome.storage.sync.set({
                checkInterval: interval,
                duplicateThreshold: threshold,

            });
            
            // 백그라운드에 설정 변경 알림
            chrome.runtime.sendMessage({ 
                action: 'settingsUpdated',
                settings: { 
                    checkInterval: interval,
                    duplicateThreshold: threshold,
    
                }
            });

            showStatus('설정이 저장되었습니다.', 'success');
        } catch (error) {
            console.error('설정 저장 실패:', error);
            showStatus('설정 저장 실패', 'error');
        }
    }

    // 데이터 삭제
    async function clearData() {
        if (!confirm('모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            return;
        }

        try {
            await chrome.storage.local.clear();
            showStatus('데이터가 성공적으로 삭제되었습니다.', 'success');
        } catch (error) {
            console.error('데이터 삭제 실패:', error);
            showStatus('데이터 삭제 실패', 'error');
        }
    }

    // 키워드 내보내기
    async function exportKeywords() {
        try {
            const { keywords } = await chrome.storage.sync.get(['keywords']);
            if (!keywords || keywords.length === 0) {
                showStatus('내보낼 키워드가 없습니다.', 'error');
                return;
            }

            const content = JSON.stringify({ keywords }, null, 2);
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `news-keywords-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showStatus('키워드 내보내기 성공!', 'success');
        } catch (error) {
            console.error('키워드 내보내기 실패:', error);
            showStatus('키워드 내보내기 실패', 'error');
        }
    }

    // 키워드 가져오기
    function importKeywords() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';

        input.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data.keywords || !Array.isArray(data.keywords)) {
                        throw new Error('잘못된 파일 형식입니다.');
                    }

                    const importedKeywords = data.keywords.filter(k => typeof k === 'string' && k.trim().length > 0);
                    
                    const { keywords: existingKeywords = [] } = await chrome.storage.sync.get(['keywords']);
                    
                    // 중복을 제거하고 합치기
                    const merged = [...new Set([...existingKeywords, ...importedKeywords])];

                    await chrome.storage.sync.set({ keywords: merged });

                    // 백그라운드에 키워드 업데이트 알림
                    chrome.runtime.sendMessage({ 
                        action: 'keywordsUpdated', 
                        keywords: merged 
                    });

                    showStatus(`키워드 ${importedKeywords.length}개 가져오기 성공. 총 ${merged.length}개 키워드.`, 'success');

                } catch (error) {
                    console.error('키워드 가져오기 실패:', error);
                    showStatus(`키워드 가져오기 실패: ${error.message}`, 'error');
                }
            };
            reader.readAsText(file);
        });

        input.click();
    }

    // 상태 메시지 표시
    function showStatus(message, type = 'info') {
        statusMessage.textContent = message;
        statusMessage.style.color = type === 'error' ? '#dc3545' : '#28a745';
        setTimeout(() => {
            statusMessage.textContent = '';
        }, 3000);
    }

    // 이벤트 리스너
    duplicateThreshold.addEventListener('input', () => {
        thresholdValue.textContent = duplicateThreshold.value;
    });

    saveBtn.addEventListener('click', saveSettings);
    clearDataBtn.addEventListener('click', clearData);
    importBtn.addEventListener('click', importKeywords);
    exportBtn.addEventListener('click', exportKeywords);
    

    // 초기 설정 로드
    loadSettings();
});