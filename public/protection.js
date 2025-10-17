/**
 * 기본 소스코드 보호
 * 참고: 완벽한 보호는 불가능하며, 고급 사용자는 우회 가능합니다
 */

(function() {
    'use strict';

    // 1. 우클릭 방지
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });

    // 2. 키보드 단축키 방지 (F12, Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+U 등)
    document.addEventListener('keydown', function(e) {
        // F12
        if (e.keyCode === 123) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+I (개발자 도구)
        if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+C (요소 검사)
        if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+J (콘솔)
        if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
            e.preventDefault();
            return false;
        }
        // Ctrl+U (소스 보기)
        if (e.ctrlKey && e.keyCode === 85) {
            e.preventDefault();
            return false;
        }
    });

    // 3. 개발자 도구 열림 감지 (간단한 방법)
    let devtools = { open: false };
    const checkDevTools = setInterval(function() {
        const widthThreshold = window.outerWidth - window.innerWidth > 160;
        const heightThreshold = window.outerHeight - window.innerHeight > 160;
        
        if (widthThreshold || heightThreshold) {
            if (!devtools.open) {
                devtools.open = true;
                // 개발자 도구가 열렸을 때 경고 또는 리다이렉트
                // alert('개발자 도구 사용이 감지되었습니다.');
                // 또는 페이지를 닫거나 리다이렉트
                // window.location.href = 'about:blank';
            }
        } else {
            devtools.open = false;
        }
    }, 500);

    // 4. 텍스트 선택 방지 (선택적으로 사용)
    // document.addEventListener('selectstart', function(e) {
    //     e.preventDefault();
    //     return false;
    // });

    // 5. 복사 방지 (선택적으로 사용)
    // document.addEventListener('copy', function(e) {
    //     e.preventDefault();
    //     return false;
    // });

    // 6. 드래그 방지
    document.addEventListener('dragstart', function(e) {
        e.preventDefault();
        return false;
    });

    // 7. 콘솔 디버깅 방지
    const disableConsole = function() {
        const noop = function() {};
        const methods = ['log', 'debug', 'info', 'warn', 'error', 'dir', 'clear'];
        
        methods.forEach(function(method) {
            console[method] = noop;
        });
    };

    // disableConsole(); // 필요시 주석 해제

})();

