/**
 * CSRF 토큰 가져오기 함수
 * 서버에서 CSRF 토큰을 가져와서 메타 태그와 전역 변수에 설정
 * @async
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
            
            // 메타 태그에 CSRF 토큰 설정
            const metaTag = document.querySelector('meta[name="csrf-token"]');
            if (metaTag) {
                metaTag.setAttribute('content', data.csrfToken);
            }
            
            console.log('CSRF 토큰 로드 완료:', data.csrfToken);
            return data.csrfToken;
        } else {
            console.error('CSRF 토큰 가져오기 실패:', response.status);
            return null;
        }
    } catch (error) {
        console.error('CSRF 토큰 가져오기 오류:', error);
        return null;
    }
}

/**
 * CSRF 토큰 새로고침 함수
 * 토큰이 없거나 만료된 경우 새로 가져오기
 * @async
 */
async function refreshCSRFToken() {
    const currentToken = window.csrfToken || document.querySelector('meta[name="csrf-token"]')?.content;
    
    if (!currentToken) {
        console.log('CSRF 토큰이 없어서 새로 가져옵니다...');
        return await fetchCSRFToken();
    }
    
    return currentToken;
}

/**
 * 페이지 초기화 함수
 * DOM 로드 완료 후 사용자 상태 확인 및 페이지별 초기화 실행
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 기존 모달 관련 localStorage 데이터 정리
        clearSuspensionModalStorage();
        
        // CSRF 토큰 초기화
        await fetchCSRFToken();
        
        // 사용자 상태 업데이트
        await updateUserStatus();
        
        // 현재 페이지 식별 및 초기화
        const path = window.location.pathname;
        const page = path.split('/').pop();
        
        // 페이지별 초기화 실행
        await initializePage(page);
        
    } catch (error) {
        console.error('페이지 초기화 오류:', error);
    }
});

/**
 * 페이지별 초기화 함수
 * @param {string} page - 현재 페이지 이름
 */
async function initializePage(page) {
    const pageHandlers = {
        '': loadHomePage,
        'index.html': loadHomePage,
        'questions.html': initializeQuestionsPage,
        'ask.html': setupAskPage,
        'mypage.html': initializeMyPage,
        'admin.html': initializeAdminPage,
        'ranking.html': loadRankings,
        'score-ranking.html': () => console.log('랭킹 페이지 로드됨:', page),
        'level-ranking.html': () => console.log('랭킹 페이지 로드됨:', page)
    };
    
    const handler = pageHandlers[page];
    if (handler) {
        await handler();
    } else {
        console.warn('알 수 없는 페이지:', page);
    }
}

/**
 * 질문 목록 페이지 초기화
 * 사용자 정보 확인 후 질문 목록 로드
 */
async function initializeQuestionsPage() {
    if (currentUser) {
        loadQuestions();
    } else {
        // 사용자 정보 로드 대기 후 질문 목록 로드
        setTimeout(() => {
            if (currentUser) {
                loadQuestions();
            } else {
                console.error('사용자 정보를 로드할 수 없습니다.');
            }
        }, 1000);
    }
}

/**
 * 마이페이지 초기화
 * 마이페이지 스크립트 존재 여부 확인
 */
function initializeMyPage() {
    if (typeof loadMyPage === 'undefined') {
        console.error('마이페이지 스크립트를 찾을 수 없습니다.');
    }
}

/**
 * 관리자 페이지 초기화
 * 관리자 스크립트 존재 여부 확인
 */
function initializeAdminPage() {
    if (typeof loadAdminDashboard === 'undefined') {
        console.error('관리자 스크립트를 찾을 수 없습니다.');
    }
}

/**
 * 사용자 상태 업데이트 함수
 * 인증 상태를 확인하고 네비게이션 바를 업데이트
 */
async function updateUserStatus() {
    const authContainer = document.getElementById('auth-container');
    const path = window.location.pathname.split('/').pop();
    const fab = document.getElementById('ask-fab');
    
    if (!authContainer) {
        console.error('auth-container 요소를 찾을 수 없습니다.');
        return;
    }
    
    try {
        const response = await fetch('/api/user');
        if (!response.ok) {
            throw new Error('Not authenticated');
        }
        const user = await response.json();
        
        // 인증된 사용자용 네비게이션 렌더링
        renderAuthenticatedNavigation(authContainer, user, path);
        
        // FAB 표시
        if (fab) {
            fab.style.display = 'flex';
        }
        
    } catch (error) {
        // 비인증 사용자용 네비게이션 렌더링
        renderUnauthenticatedNavigation(authContainer, path);
        
        // FAB 숨기기
        if (fab) {
            fab.style.display = 'none';
        }
        
        // 질문 작성 페이지에서 로그인 필요 알림
        if (path === 'ask.html') {
            showToast('질문을 등록하려면 로그인이 필요합니다.', 'error');
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        }
    }
}

/**
 * 인증된 사용자용 네비게이션 렌더링
 * @param {HTMLElement} container - 네비게이션 컨테이너
 * @param {Object} user - 사용자 정보
 * @param {string} path - 현재 페이지 경로
 */
function renderAuthenticatedNavigation(container, user, path) {
    container.innerHTML = `
        <div class="nav-menu">
            <ul class="nav-links">
                <li><a href="/" class="nav-link ${path === '' || path === 'index.html' ? 'active' : ''}">홈</a></li>
                <li><a href="/questions.html" class="nav-link ${path === 'questions.html' ? 'active' : ''}">질문 목록</a></li>
                <li><a href="/ask.html" class="nav-link ${path === 'ask.html' ? 'active' : ''}">질문하기</a></li>
                <li><a href="/ai-question.html" class="nav-link ${path === 'ai-question.html' ? 'active' : ''}">AI 질문</a></li>
                <li><a href="/score-ranking.html" class="nav-link ${path === 'score-ranking.html' || path === 'level-ranking.html' ? 'active' : ''}">랭킹</a></li>
                <li><a href="/mypage.html" class="nav-link ${path === 'mypage.html' ? 'active' : ''}">마이페이지</a></li>
            </ul>
            <div class="user-info">
                <span>${escapeHtml(user.displayName)}님 (Lv.${user.level || 1}) 포인트: ${user.levelInfo?.points?.current || 0}</span>
                <a href="/auth/logout" class="logout-btn">로그아웃</a>
            </div>
        </div>`;
}

/**
 * 비인증 사용자용 네비게이션 렌더링
 * @param {HTMLElement} container - 네비게이션 컨테이너
 * @param {string} path - 현재 페이지 경로
 */
function renderUnauthenticatedNavigation(container, path) {
    container.innerHTML = `
        <ul class="nav-links">
            <li><a href="/" class="nav-link ${path === '' || path === 'index.html' ? 'active' : ''}">홈</a></li>
            <li><a href="/questions.html" class="nav-link ${path === 'questions.html' ? 'active' : ''}">질문 목록</a></li>
            <li><a href="/score-ranking.html" class="nav-link ${path === 'score-ranking.html' || path === 'level-ranking.html' ? 'active' : ''}">랭킹</a></li>
        </ul>
        <a href="/auth/google" class="login-btn">Google로 로그인</a>`;
}

/**
 * HTML 이스케이프 함수
 * XSS 공격을 방지하기 위해 HTML 특수문자를 이스케이프
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadQuestions() {
    const questionsContainer = document.getElementById('questions-container');
    
    if (!questionsContainer) {
        console.error('questions-container 요소를 찾을 수 없습니다.');
        return;
    }
    
    try {
        console.log('질문 목록 로딩 시작...');
        const response = await fetch('/api/questions');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const questions = await response.json();
        console.log('질문 목록 로드 성공:', questions.length, '개');
    
        if (questions.length === 0) {
            questionsContainer.innerHTML = `
                <div class="empty-state">
                    <h3>아직 질문이 없습니다</h3>
                    <p>첫 번째 질문을 남겨보세요!</p>
                </div>`;
            return;
        }
        
        // 네이버 카페 스타일로 질문 표시
        let questionsHtml = '<div class="cafe-style-list">';
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            questionsHtml += `
                <div class="cafe-post" data-question-id="${q.id}">
                    <div class="post-title">
                        <a href="#" class="title-link">${escapeHtml(q.title)}</a>
                        ${q.images && q.images.length > 0 ? `<span class="image-icon">📷</span>` : ''}
                    </div>
                    <div class="post-info">
                        <span class="author">${escapeHtml(q.author ? q.author.name : '알 수 없음')}</span>
                        <span class="separator">|</span>
                        <span class="date">${formatDate(q.created_at)}</span>
                        <span class="separator">|</span>
                        <span class="views">조회 ${Math.floor(Math.random() * 100) + 1}</span>
                        <span class="separator">|</span>
                        <span class="replies">댓글 ${q.answers ? q.answers.length : 0}</span>
                    </div>
                </div>`;
        }
        questionsHtml += '</div>';
        questionsContainer.innerHTML = questionsHtml;
        
        console.log('질문 목록 렌더링 완료');
        
        // 카페 스타일 포스트 클릭 이벤트 추가
        const cafePosts = questionsContainer.querySelectorAll('.cafe-post');
        for (let i = 0; i < cafePosts.length; i++) {
            const post = cafePosts[i];
            post.addEventListener('click', (e) => {
                e.preventDefault();
                const questionId = post.dataset.questionId;
                console.log('질문 클릭됨:', questionId);
                openQuestionDetail(questionId);
            });
        }
        
    } catch (error) {
        console.error('질문 목록 로드 실패:', error);
        questionsContainer.innerHTML = `
            <div class="empty-state">
                <h3>질문을 불러올 수 없습니다</h3>
                <p>오류: ${escapeHtml(error.message)}</p>
            </div>`;
    }
    
    // 새로고침 버튼 이벤트
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadQuestions();
            showToast('질문 목록을 새로고침했습니다.', 'success');
        });
    }
    
    if (!document.getElementById('image-modal')) {
        const modal = document.createElement('div');
        modal.id = 'image-modal';
        modal.className = 'image-modal';
        modal.innerHTML = `
            <span class="close-modal" onclick="closeImageModal()">&times;</span>
            <img id="modal-image" src="" alt="확대 이미지">
        `;
        document.body.appendChild(modal);
    }
}

// escapeHtml 함수는 위에서 이미 정의됨 (중복 제거)

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '오늘';
    if (diffDays === 2) return '어제';
    if (diffDays <= 7) return `${diffDays - 1}일 전`;
    if (diffDays <= 30) return `${Math.ceil(diffDays / 7)}주 전`;
    return date.toLocaleDateString('ko-KR');
}

function isMyQuestion(question) {
    // 현재 사용자 정보를 확인하여 내 질문인지 판단
    if (!question || !question.author || !currentUser) {
        return false;
    }
    return question.author.id === currentUser.id;
}

function getRoleText(role) {
    const roleMap = {
        'user': '일반 사용자',
        'moderator': '모더레이터',
        'admin': '관리자',
        'super_admin': '최고 관리자'
    };
    return roleMap[role] || role;
}

function getStatusText(status) {
    const statusMap = {
        'active': '활성',
        'suspended': '정지',
        'banned': '차단'
    };
    return statusMap[status] || status;
}

function getSuspensionInfo(suspendedUntil, suspendedAt, suspensionReason) {
    let info = '';
    
    // 정지 시작일 표시
    if (suspendedAt) {
        const suspendedStartDate = new Date(suspendedAt);
        info += `📅 정지 시작일: ${suspendedStartDate.toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'long'
        })}<br>`;
    }
    
    if (suspendedUntil) {
        const suspendedDate = new Date(suspendedUntil);
        const now = new Date();
        const diffTime = suspendedDate.getTime() - now.getTime();
        
        if (diffTime > 0) {
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
            
            let timeLeft = '';
            if (diffDays > 0) timeLeft += `${diffDays}일 `;
            if (diffHours > 0) timeLeft += `${diffHours}시간 `;
            if (diffMinutes > 0) timeLeft += `${diffMinutes}분`;
            if (timeLeft === '') timeLeft = '1분 미만';
            
            info += `⏰ 해제까지 남은 시간: ${timeLeft.trim()}<br>`;
            info += `📅 해제 예정일: ${suspendedDate.toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                weekday: 'long'
            })}`;
        } else {
            info += '⏰ 정지 기간이 만료되었습니다. 관리자에게 문의하세요.';
        }
    } else {
        info += '⏰ 정지 기간: 무기한 (관리자에게 문의하세요)';
    }
    
    if (suspensionReason) {
        info += `<br><br>📋 제한 사유:<br>${escapeHtml(suspensionReason)}`;
    }
    
    return info;
}

function showSuspensionModal(status, suspensionInfo) {
    // 이미 모달이 표시되어 있는지 확인
    if (document.getElementById('suspension-modal')) {
        return;
    }
    
    const modal = document.createElement('div');
    modal.id = 'suspension-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: 'Noto Sans KR', sans-serif;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
            position: relative;
        ">
            <button onclick="closeSuspensionModal()" style="
                position: absolute;
                top: 12px;
                right: 12px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s;
            " onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='none'">
                ×
            </button>
            
            <div style="
                display: flex;
                align-items: center;
                margin-bottom: 16px;
                color: #dc2626;
                font-weight: 600;
                font-size: 18px;
            ">
                ${status === 'banned' ? '🚫 계정이 차단되었습니다' : '⚠️ 계정이 정지되었습니다'}
            </div>
            
            <div style="
                font-size: 14px;
                line-height: 1.6;
                color: #374151;
            ">
                ${suspensionInfo}
            </div>
            
            <div style="
                margin-top: 20px;
                padding-top: 16px;
                border-top: 1px solid #e5e7eb;
                text-align: center;
            ">
                <button onclick="closeSuspensionModal()" style="
                    background: #dc2626;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                " onmouseover="this.style.background='#b91c1c'" onmouseout="this.style.background='#dc2626'">
                    확인
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeSuspensionModal();
        }
    });
}

function closeSuspensionModal() {
    const modal = document.getElementById('suspension-modal');
    if (modal) {
        modal.remove();
    }
}

// 기존 localStorage 데이터 정리 (페이지 로드 시)
function clearSuspensionModalStorage() {
    localStorage.removeItem('suspension-modal-shown-date');
    localStorage.removeItem('suspension-modal-shown-user');
}

let currentUser = null;

// 사용자 정보 업데이트 시 currentUser도 업데이트
async function updateUserStatus() {
    const authContainer = document.getElementById('auth-container');
    const path = window.location.pathname.split('/').pop();
    const fab = document.getElementById('ask-fab');
    
    try {
        const response = await fetch('/api/user');
        if (!response.ok) {
            throw new Error('Not authenticated');
        }
        const user = await response.json();
        currentUser = user;
        
        // 디버깅: 정지 정보 확인
        console.log('🔍 전체 사용자 정보:', user);
        if (user.status === 'suspended' || user.status === 'banned') {
            console.log('🔍 정지 사용자 정보:', {
                status: user.status,
                suspendedUntil: user.suspendedUntil,
                suspendedUntilType: typeof user.suspendedUntil,
                suspendedAt: user.suspendedAt,
                suspendedAtType: typeof user.suspendedAt,
                suspensionReason: user.suspensionReason
            });
        }
        
        // 정지 상태 확인
        const isSuspended = user.status === 'suspended' || user.status === 'banned';
        const suspensionInfo = isSuspended ? getSuspensionInfo(user.suspendedUntil, user.suspendedAt, user.suspensionReason) : '';
        
        authContainer.innerHTML = `
            <ul class="nav-links">
                <li><a href="/" class="nav-link ${path === '' || path === 'index.html' ? 'active' : ''}">홈</a></li>
                <li><a href="/questions.html" class="nav-link ${path === 'questions.html' ? 'active' : ''}">질문 목록</a></li>
                ${!isSuspended ? `<li><a href="/ask.html" class="nav-link ${path === 'ask.html' ? 'active' : ''}">질문하기</a></li>` : ''}
                <li><a href="/ai-question.html" class="nav-link ${path === 'ai-question.html' ? 'active' : ''}">AI 질문</a></li>
                <li><a href="/mypage.html" class="nav-link ${path === 'mypage.html' ? 'active' : ''}">마이페이지</a></li>
                <li><a href="/score-ranking.html" class="nav-link ${path === 'score-ranking.html' || path === 'level-ranking.html' ? 'active' : ''}">랭킹</a></li>
                ${user.role && ['moderator', 'admin', 'super_admin'].includes(user.role) ? 
                    `<li><a href="/admin.html" class="nav-link ${path === 'admin.html' ? 'active' : ''}" style="color: #dc2626; font-weight: 600;">관리자</a></li>` : ''
                }
            </ul>
            <div class="user-info">
                <span>${user.displayName}님</span>
                ${user.role && user.role !== 'user' ? `<span class="role-badge ${user.role}" style="margin-left: 8px;">${getRoleText(user.role)}</span>` : ''}
                ${isSuspended ? `<span class="status-badge suspended" style="margin-left: 8px; background: #dc2626; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${getStatusText(user.status)}</span>` : ''}
                <a href="/auth/logout" class="logout-btn">로그아웃</a>
            </div>`;
        
        if (fab) {
            fab.style.display = 'flex';
        }
        
        // 정지된 사용자에게 모달 표시
        if (isSuspended) {
            showSuspensionModal(user.status, suspensionInfo);
        }
    } catch (error) {
        currentUser = null;
        authContainer.innerHTML = `
            <ul class="nav-links">
                <li><a href="/" class="nav-link ${path === '' || path === 'index.html' ? 'active' : ''}">홈</a></li>
                <li><a href="/questions.html" class="nav-link ${path === 'questions.html' ? 'active' : ''}">질문 목록</a></li>
                <li><a href="/score-ranking.html" class="nav-link ${path === 'score-ranking.html' || path === 'level-ranking.html' ? 'active' : ''}">랭킹</a></li>
            </ul>
            <a href="/auth/google" class="login-btn">Google로 로그인</a>`;
        
        if (fab) {
            fab.style.display = 'none';
        }
        
        if (path === 'ask.html') {
            showToast('질문을 등록하려면 로그인이 필요합니다.', 'error');
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        }
    }
}

async function submitAnswer(event) {
    // 정지 상태 확인
    if (currentUser && (currentUser.status === 'suspended' || currentUser.status === 'banned')) {
        showToast('계정이 제한되어 답변을 작성할 수 없습니다.', 'error');
        return;
    }
    
    const button = event.target;
    const questionId = button.dataset.id;
    const answerForm = button.closest('.answer-form');
    const textarea = answerForm.querySelector('.answer-content');
    const content = textarea.value;
    
    if (!content.trim()) {
        showToast('답변을 입력해주세요.', 'error');
        return;
    }
    
    button.classList.add('loading');
    button.disabled = true;
    
    const images = answerImageArrays[questionId] || [];
    
    // CSRF 토큰 새로고침
    const csrfToken = await refreshCSRFToken();
    if (!csrfToken) {
        showToast('CSRF 토큰을 가져올 수 없습니다. 페이지를 새로고침해주세요.', 'error');
        button.classList.remove('loading');
        button.disabled = false;
        return;
    }
    
    const response = await fetch(`/api/questions/${questionId}/answers`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ content, images, _csrf: csrfToken }),
        credentials: 'include'
    });
    
    button.classList.remove('loading');
    button.disabled = false;
    
    if (!response.ok) {
        showToast('답변을 등록하려면 로그인이 필요합니다.', 'error');
        return;
    }
    
    showToast('답변이 성공적으로 등록되었습니다!', 'success');
    textarea.value = '';
    answerImageArrays[questionId] = [];
    loadQuestions();
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 신고 기능
function showReportModal(targetType, targetId, targetTitle = '') {
    const modal = document.createElement('div');
    modal.className = 'report-modal';
    modal.innerHTML = `
        <div class="report-modal-content">
            <div class="report-modal-header">
                <h3 class="report-modal-title">🚨 신고하기</h3>
                <button class="report-close-btn">&times;</button>
            </div>
            
            <div class="report-reasons">
                <div class="report-reason-item" data-reason="spam">
                    <input type="radio" name="reason" value="spam" class="report-reason-radio" id="reason-spam">
                    <label for="reason-spam" class="report-reason-text">스팸 또는 광고</label>
                </div>
                <div class="report-reason-item" data-reason="inappropriate">
                    <input type="radio" name="reason" value="inappropriate" class="report-reason-radio" id="reason-inappropriate">
                    <label for="reason-inappropriate" class="report-reason-text">부적절한 내용</label>
                </div>
                <div class="report-reason-item" data-reason="harassment">
                    <input type="radio" name="reason" value="harassment" class="report-reason-radio" id="reason-harassment">
                    <label for="reason-harassment" class="report-reason-text">괴롭힘 또는 모욕</label>
                </div>
                <div class="report-reason-item" data-reason="violence">
                    <input type="radio" name="reason" value="violence" class="report-reason-radio" id="reason-violence">
                    <label for="reason-violence" class="report-reason-text">폭력적 내용</label>
                </div>
                <div class="report-reason-item" data-reason="copyright">
                    <input type="radio" name="reason" value="copyright" class="report-reason-radio" id="reason-copyright">
                    <label for="reason-copyright" class="report-reason-text">저작권 침해</label>
                </div>
                <div class="report-reason-item" data-reason="other">
                    <input type="radio" name="reason" value="other" class="report-reason-radio" id="reason-other">
                    <label for="reason-other" class="report-reason-text">기타</label>
                </div>
            </div>
            
            <div class="report-description">
                <label for="report-description">추가 설명 (선택사항)</label>
                <textarea id="report-description" placeholder="신고 사유에 대한 자세한 설명을 입력해주세요..."></textarea>
            </div>
            
            <div class="report-modal-footer">
                <button class="secondary-btn">취소</button>
                <button class="report-submit-btn" data-target-type="${targetType}" data-target-id="${targetId}">신고하기</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 닫기 버튼 이벤트
    modal.querySelector('.report-close-btn').addEventListener('click', () => {
        modal.remove();
    });
    
    // 취소 버튼 이벤트
    modal.querySelector('.secondary-btn').addEventListener('click', () => {
        modal.remove();
    });
    
    // 신고하기 버튼 이벤트
    modal.querySelector('.report-submit-btn').addEventListener('click', (e) => {
        submitReport(e.target.dataset.targetType, e.target.dataset.targetId, e.target);
    });
    
    // 라디오 버튼 클릭 시 시각적 피드백
    modal.querySelectorAll('.report-reason-item').forEach(item => {
        item.addEventListener('click', () => {
            // 모든 항목에서 selected 클래스 제거
            modal.querySelectorAll('.report-reason-item').forEach(i => i.classList.remove('selected'));
            // 클릭된 항목에 selected 클래스 추가
            item.classList.add('selected');
            // 라디오 버튼 선택
            const radio = item.querySelector('input[type="radio"]');
            radio.checked = true;
        });
    });
    
    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

async function submitReport(targetType, targetId, button) {
    const modal = button.closest('.report-modal');
    const selectedReason = modal.querySelector('input[name="reason"]:checked');
    const description = modal.querySelector('#report-description').value.trim();
    
    if (!selectedReason) {
        showToast('신고 사유를 선택해주세요.', 'warning');
        return;
    }
    
    // CSRF 토큰이 없으면 가져오기
    if (!window.csrfToken && typeof fetchCSRFToken === 'function') {
        await fetchCSRFToken();
    }
    
    button.disabled = true;
    button.textContent = '신고 중...';
    
    try {
        const response = await fetch('/api/reports', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': window.csrfToken || ''
            },
            body: JSON.stringify({
                targetType: targetType,
                targetId: parseInt(targetId),
                reason: selectedReason.value,
                description: description || null,
                _csrf: window.csrfToken || ''
            }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('신고가 접수되었습니다. 검토 후 조치하겠습니다.', 'success');
            modal.remove();
        } else {
            throw new Error(data.error || '신고 접수에 실패했습니다.');
        }
    } catch (error) {
        console.error('신고 오류:', error);
        showToast(error.message, 'error');
        button.disabled = false;
        button.textContent = '신고하기';
    }
}

function setupAskPage() {
    // 정지 상태 확인
    if (currentUser && (currentUser.status === 'suspended' || currentUser.status === 'banned')) {
        showToast('계정이 제한되어 질문을 작성할 수 없습니다.', 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
        return;
    }
    
    let uploadedImages = [];
    
    document.getElementById('upload-image-btn').addEventListener('click', () => {
        document.getElementById('question-image').click();
    });
    
    document.getElementById('question-image').addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        const previewContainer = document.getElementById('image-preview');
        
        for (const file of files) {
            if (file.size > 5 * 1024 * 1024) {
                showToast('이미지는 5MB 이하만 업로드 가능합니다.', 'error');
                continue;
            }
            
            const formData = new FormData();
            formData.append('image', file);
            
            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    const data = await response.json();
                    uploadedImages.push(data.imageUrl);
                    
                    const previewItem = document.createElement('div');
                    previewItem.className = 'image-preview-item';
                    previewItem.innerHTML = `
                        <img src="${data.imageUrl}" alt="Preview">
                        <button class="remove-image" data-url="${data.imageUrl}">×</button>
                    `;
                    previewContainer.appendChild(previewItem);
                    
                    previewItem.querySelector('.remove-image').addEventListener('click', (e) => {
                        const url = e.target.dataset.url;
                        uploadedImages = uploadedImages.filter(img => img !== url);
                        previewItem.remove();
                    });
                } else {
                    showToast('이미지 업로드에 실패했습니다.', 'error');
                }
            } catch (error) {
                showToast('이미지 업로드 중 오류가 발생했습니다.', 'error');
            }
        }
        
        e.target.value = '';
    });
    
    document.getElementById('submit-question').addEventListener('click', async () => {
        // 정지 상태 확인
        if (currentUser && (currentUser.status === 'suspended' || currentUser.status === 'banned')) {
            showToast('계정이 제한되어 질문을 작성할 수 없습니다.', 'error');
            return;
        }
        
        const titleInput = document.getElementById('question-title');
        const contentInput = document.getElementById('question-content');
        const button = document.getElementById('submit-question');
        
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        
        if (!title || !content) {
            showToast('제목과 내용을 모두 입력해주세요.', 'error');
            return;
        }
        
        button.classList.add('loading');
        button.disabled = true;
        
        // CSRF 토큰 새로고침
        const csrfToken = await refreshCSRFToken();
        if (!csrfToken) {
            showToast('CSRF 토큰을 가져올 수 없습니다. 페이지를 새로고침해주세요.', 'error');
            button.classList.remove('loading');
            button.disabled = false;
            return;
        }
        
        const response = await fetch('/api/questions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ title, content, images: uploadedImages, _csrf: csrfToken }),
            credentials: 'include'
        });
        
        button.classList.remove('loading');
        button.disabled = false;
        
        if (response.ok) {
            showToast('질문이 성공적으로 등록되었습니다!', 'success');
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else {
            showToast('질문 등록에 실패했습니다. 다시 시도해주세요.', 'error');
        }
    });
}

async function loadRankings() {
    const rankingList = document.getElementById('ranking-list');
    const rankings = await (await fetch('/api/rankings')).json();
    
    if (rankings.length === 0) {
        rankingList.innerHTML = `
            <div class="empty-state">
                <h3>아직 랭킹 데이터가 없습니다</h3>
                <p>답변을 작성하고 포인트를 획득해보세요!</p>
            </div>`;
        return;
    }
    
    rankingList.innerHTML = rankings.map((user, i) => {
        return `<li>
            <div>
                <span style="color: var(--text-muted); font-weight: 600;">${i + 1}위</span>
                <strong style="margin-left: 8px;">${escapeHtml(user.name)}</strong>
            </div>
            <span class="rank-badge">${user.score}점</span>
        </li>`;
    }).join('');
}

const answerImageArrays = {};

function setupAnswerImageUploads() {
    document.querySelectorAll('.answer-image-btn').forEach(btn => {
        const questionId = btn.dataset.id;
        answerImageArrays[questionId] = [];
        
        btn.addEventListener('click', () => {
            document.querySelector(`.answer-image-input[data-id="${questionId}"]`).click();
        });
    });
    
    document.querySelectorAll('.answer-image-input').forEach(input => {
        const questionId = input.dataset.id;
        
        input.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            const previewContainer = document.querySelector(`.answer-image-preview[data-id="${questionId}"]`);
            
            for (const file of files) {
                if (file.size > 5 * 1024 * 1024) {
                    showToast('이미지는 5MB 이하만 업로드 가능합니다.', 'error');
                    continue;
                }
                
                const formData = new FormData();
                formData.append('image', file);
                
                try {
                    const response = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        answerImageArrays[questionId].push(data.imageUrl);
                        
                        const previewItem = document.createElement('div');
                        previewItem.className = 'image-preview-item';
                        previewItem.style.display = 'inline-block';
                        previewItem.innerHTML = `
                            <img src="${data.imageUrl}" alt="Preview">
                            <button class="remove-image" data-url="${data.imageUrl}" data-qid="${questionId}">×</button>
                        `;
                        previewContainer.appendChild(previewItem);
                        
                        previewItem.querySelector('.remove-image').addEventListener('click', (e) => {
                            const url = e.target.dataset.url;
                            const qid = e.target.dataset.qid;
                            answerImageArrays[qid] = answerImageArrays[qid].filter(img => img !== url);
                            previewItem.remove();
                        });
                    }
                } catch (error) {
                    showToast('이미지 업로드 중 오류가 발생했습니다.', 'error');
                }
            }
            
            e.target.value = '';
        });
    });
}

function openImageModal(imageUrl) {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    modal.classList.add('active');
    modalImage.src = imageUrl;
}

function closeImageModal() {
    const modal = document.getElementById('image-modal');
    modal.classList.remove('active');
}

// 질문 상세보기 모달
function openQuestionDetail(questionId) {
    console.log('질문 상세보기 열기:', questionId);
    try {
        // 질문 상세보기 모달을 열거나 새 페이지로 이동
        window.location.href = `/question-detail.html?id=${questionId}`;
    } catch (error) {
        console.error('질문 상세보기 열기 실패:', error);
        alert('질문 상세보기를 열 수 없습니다.');
    }
}

// 질문 수정
async function editQuestion(questionId) {
    try {
        const response = await fetch(`/api/questions/${questionId}`);
        if (!response.ok) throw new Error('질문을 불러올 수 없습니다.');
        
        const question = await response.json();
        
        // 수정 모달 또는 페이지로 이동
        showEditModal(question);
    } catch (error) {
        showToast('질문을 불러오는데 실패했습니다.', 'error');
    }
}

// 질문 삭제
async function deleteQuestion(questionId) {
    if (!confirm('정말로 이 질문을 삭제하시겠습니까?')) return;
    
    try {
        const response = await fetch(`/api/questions/${questionId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('질문이 삭제되었습니다.', 'success');
            loadQuestions();
        } else {
            throw new Error('삭제 실패');
        }
    } catch (error) {
        showToast('질문 삭제에 실패했습니다.', 'error');
    }
}

// 수정 모달 표시
function showEditModal(question) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>질문 수정</h3>
                <button class="close-modal" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>제목</label>
                    <input type="text" id="edit-title" value="${escapeHtml(question.title)}">
                </div>
                <div class="form-group">
                    <label>내용</label>
                    <textarea id="edit-content" rows="8">${escapeHtml(question.content)}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="secondary-btn" onclick="this.closest('.modal-overlay').remove()">취소</button>
                <button class="primary-btn" onclick="saveQuestionEdit(${question.id})">저장</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// 질문 수정 저장
async function saveQuestionEdit(questionId) {
    const title = document.getElementById('edit-title').value.trim();
    const content = document.getElementById('edit-content').value.trim();
    
    if (!title || !content) {
        showToast('제목과 내용을 모두 입력해주세요.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/questions/${questionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        
        if (response.ok) {
            showToast('질문이 수정되었습니다.', 'success');
            document.querySelector('.modal-overlay').remove();
            loadQuestions();
        } else {
            throw new Error('수정 실패');
        }
    } catch (error) {
        showToast('질문 수정에 실패했습니다.', 'error');
    }
}

// 관리자 기능
async function hideQuestion(questionId) {
    const reason = prompt('질문을 숨기는 사유를 입력하세요:');
    if (!reason) return;
    
    try {
        const response = await fetch(`/api/admin/questions/${questionId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'hidden', reason })
        });
        
        if (response.ok) {
            showToast('질문이 숨겨졌습니다.', 'success');
            loadQuestions();
        } else {
            throw new Error('질문 숨기기 실패');
        }
    } catch (error) {
        showToast('질문 숨기기에 실패했습니다.', 'error');
    }
}

async function hideAnswer(answerId) {
    const reason = prompt('답변을 숨기는 사유를 입력하세요:');
    if (!reason) return;
    
    try {
        const response = await fetch(`/api/admin/answers/${answerId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'hidden', reason })
        });
        
        if (response.ok) {
            showToast('답변이 숨겨졌습니다.', 'success');
            // 페이지 새로고침 또는 답변 목록 업데이트
            if (window.location.pathname.includes('question-detail')) {
                const questionId = new URLSearchParams(window.location.search).get('id');
                loadQuestionDetail(questionId);
            }
        } else {
            throw new Error('답변 숨기기 실패');
        }
    } catch (error) {
        showToast('답변 숨기기에 실패했습니다.', 'error');
    }
}

async function loadHomePage() {
    try {
        const questions = await (await fetch('/api/questions')).json();
        const rankings = await (await fetch('/api/rankings')).json();
        
        const totalQuestions = questions.length;
        const totalAnswers = questions.reduce((sum, q) => sum + (q.answers?.length || 0), 0);
        const totalUsers = rankings.length;
        
        const totalQuestionsEl = document.getElementById('total-questions');
        const totalAnswersEl = document.getElementById('total-answers');
        const totalUsersEl = document.getElementById('total-users');
        
        if (totalQuestionsEl) totalQuestionsEl.textContent = totalQuestions;
        if (totalAnswersEl) totalAnswersEl.textContent = totalAnswers;
        if (totalUsersEl) totalUsersEl.textContent = totalUsers;
    } catch (error) {
        console.error('통계 로드 실패:', error);
    }
}