# 뉴스 키워드 모니터 (News Keyword Monitor)

## 소개 (Introduction)

**뉴스 키워드 모니터**는 사용자가 설정한 키워드에 대한 뉴스를 실시간으로 모니터링하고, 새로운 뉴스가 감지되면 알림을 제공하는 크롬 확장 프로그램입니다.

**News Keyword Monitor** is a Chrome extension that real-time monitors news for keywords set by the user and provides notifications when new news is detected.

## 주요 기능 (Key Features)

*   **키워드 기반 뉴스 모니터링 (Keyword-based News Monitoring):** 사용자가 설정한 키워드를 기반으로 구글 뉴스 및 관련 웹사이트에서 뉴스를 모니터링합니다.
    *   Monitors news from Google News and related websites based on user-defined keywords.
*   **실시간 알림 (Real-time Notifications):** 새로운 뉴스가 감지되면 즉시 알림을 통해 사용자에게 알려줍니다.
    *   Instantly notifies users when new news is detected.
*   **설정 페이지 (Options Page):** 키워드 추가/삭제, 알림 설정 등 다양한 옵션을 사용자 정의할 수 있습니다.
    *   Allows users to customize various options such as adding/deleting keywords and notification settings.
*   **백그라운드 실행 (Background Operation):** 브라우저가 실행 중인 동안 백그라운드에서 지속적으로 작동하여 중요한 뉴스를 놓치지 않도록 합니다.
    *   Continuously operates in the background while the browser is running, ensuring no important news is missed.

## 설치 방법 (Installation)

1.  이 저장소를 클론하거나 ZIP 파일로 다운로드합니다.
    *   Clone this repository or download it as a ZIP file.
2.  크롬 브라우저를 엽니다.
    *   Open your Chrome browser.
3.  주소창에 `chrome://extensions`를 입력하고 엔터를 누릅니다.
    *   Type `chrome://extensions` in the address bar and press Enter.
4.  우측 상단의 "개발자 모드"를 활성화합니다.
    *   Enable "Developer mode" in the top right corner.
5.  "압축 해제된 확장 프로그램을 로드" 버튼을 클릭하고, 다운로드한 폴더를 선택합니다.
    *   Click the "Load unpacked" button and select the downloaded folder.
6.  확장 프로그램이 설치되고 크롬 툴바에 아이콘이 나타납니다.
    *   The extension will be installed, and an icon will appear in your Chrome toolbar.

## 사용 방법 (Usage)

1.  크롬 툴바의 **뉴스 키워드 모니터** 아이콘을 클릭하여 팝업을 엽니다.
    *   Click the **News Keyword Monitor** icon in the Chrome toolbar to open the popup.
2.  팝업에서 "옵션" 버튼을 클릭하여 설정 페이지로 이동합니다.
    *   Click the "Options" button in the popup to go to the settings page.
3.  설정 페이지에서 모니터링할 키워드를 추가하고 알림 설정을 조정합니다.
    *   On the settings page, add keywords to monitor and adjust notification settings.
4.  설정이 완료되면 확장 프로그램이 백그라운드에서 자동으로 뉴스를 모니터링하기 시작합니다.
    *   Once configured, the extension will automatically start monitoring news in the background.

## 기술 스택 (Tech Stack)

*   HTML, CSS, JavaScript
*   Chrome Extension APIs (Storage, Notifications, Alarms, Offscreen)

## 기여 (Contributing)

버그 보고, 기능 제안 등 모든 기여를 환영합니다. 이슈를 생성하거나 풀 리퀘스트를 제출해주세요.

All contributions, such as bug reports and feature suggestions, are welcome. Please create an issue or submit a pull request.

## 라이선스 (License)

이 프로젝트는 MIT 라이선스에 따라 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하십시오.

This project is distributed under the MIT License. See the `LICENSE` file for more details.