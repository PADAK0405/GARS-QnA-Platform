/**
 * CSRF 토큰 관리
 */

// 전역 CSRF 토큰 변수
window.csrfToken = null;

/**
 * CSRF 토큰을 가져오는 함수
 */
async function fetchCSRFToken() {
    try {
        const response = await fetch('/api/csrf-token', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            window.csrfToken = data.csrfToken;
            return window.csrfToken;
        } else {
            console.error('CSRF 토큰을 가져올 수 없습니다.');
            return null;
        }
    } catch (error) {
        console.error('CSRF 토큰 요청 오류:', error);
        return null;
    }
}

/**
 * CSRF 토큰을 포함한 fetch 요청을 보내는 함수
 */
async function secureFetch(url, options = {}) {
    // CSRF 토큰이 없으면 먼저 가져오기
    if (!window.csrfToken) {
        await fetchCSRFToken();
    }
    
    // 기본 옵션 설정
    const defaultOptions = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': window.csrfToken
        }
    };
    
    // POST, PUT, DELETE 요청에 CSRF 토큰 추가
    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method.toUpperCase())) {
        if (options.body && typeof options.body === 'object') {
            options.body = JSON.stringify({
                ...JSON.parse(options.body),
                _csrf: window.csrfToken
            });
        } else if (options.body && typeof options.body === 'string') {
            try {
                const bodyObj = JSON.parse(options.body);
                bodyObj._csrf = window.csrfToken;
                options.body = JSON.stringify(bodyObj);
            } catch (e) {
                // FormData인 경우
                if (options.body instanceof FormData) {
                    options.body.append('_csrf', window.csrfToken);
                }
            }
        }
    }
    
    // 헤더 병합
    options.headers = { ...defaultOptions.headers, ...options.headers };
    
    return fetch(url, { ...defaultOptions, ...options });
}

/**
 * 페이지 로드 시 CSRF 토큰 가져오기
 */
document.addEventListener('DOMContentLoaded', async () => {
    await fetchCSRFToken();
});

// 전역으로 사용할 수 있도록 window 객체에 추가
window.fetchCSRFToken = fetchCSRFToken;
window.secureFetch = secureFetch;
