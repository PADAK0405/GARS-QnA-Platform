/**
 * 네비게이션 바 모듈
 * 모든 페이지에서 공통으로 사용되는 네비게이션 바를 관리합니다.
 */

class Navbar {
    constructor() {
        this.currentUser = null;
        this.currentPath = window.location.pathname.split('/').pop();
    }

    /**
     * 네비게이션 바 초기화
     * 기본 구조를 먼저 렌더링하고, 사용자 정보는 비동기로 로드
     */
    async init() {
        const navbarContainer = document.getElementById('navbar-container');
        
        if (!navbarContainer) {
            console.error('navbar-container 요소를 찾을 수 없습니다.');
            return;
        }

        // 1단계: 기본 네비게이션 바 구조 즉시 렌더링 (로딩 상태)
        this.renderLoadingNavbar(navbarContainer);

        // 2단계: 사용자 정보 비동기 로드
        try {
            await this.loadUserInfo();
            this.renderFullNavbar(navbarContainer);
        } catch (error) {
            // 사용자 정보 로드 실패 (비인증 또는 네트워크 오류)
            console.warn('Navbar: 사용자 정보를 불러오지 못했습니다. 비로그인 상태로 표시합니다.', error.message);
            this.renderGuestNavbar(navbarContainer);
        }
    }

    /**
     * 로딩 중 네비게이션 바 렌더링
     */
    renderLoadingNavbar(container) {
        container.innerHTML = `
            <nav class="navbar">
                <a href="/" class="navbar-brand">Gaon QandA</a>
                <button class="mobile-menu-toggle" onclick="window.navbar.toggleMobileMenu()">☰</button>
                <div id="auth-container">
                    <div class="nav-loading">로딩 중...</div>
                </div>
            </nav>
        `;
    }

    /**
     * 사용자 정보 로드
     */
    async loadUserInfo() {
        const response = await fetch('/api/user', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Not authenticated');
        }
        
        this.currentUser = await response.json();
        return this.currentUser;
    }

    /**
     * 인증된 사용자용 네비게이션 바 렌더링
     */
    renderFullNavbar(container) {
        const user = this.currentUser;
        const isSuspended = user.status === 'suspended' || user.status === 'banned';
        
        container.innerHTML = `
            <nav class="navbar">
                <a href="/" class="navbar-brand">Gaon QandA</a>
                <button class="mobile-menu-toggle" onclick="window.navbar.toggleMobileMenu()">☰</button>
                <div id="auth-container">
                    <div class="nav-menu">
                        <ul class="nav-links">
                            <li><a href="/" class="nav-link ${this.isActive('', 'index.html')}">홈</a></li>
                            <li><a href="/questions.html" class="nav-link ${this.isActive('questions.html')}">질문 목록</a></li>
                            ${!isSuspended ? `<li><a href="/ask.html" class="nav-link ${this.isActive('ask.html')}">질문하기</a></li>` : ''}
                            <li><a href="/ai-question.html" class="nav-link ${this.isActive('ai-question.html')}">AI 질문</a></li>
                            <li><a href="/score-ranking.html" class="nav-link ${this.isActive('score-ranking.html', 'level-ranking.html')}">랭킹</a></li>
                            <li><a href="/mypage.html" class="nav-link ${this.isActive('mypage.html')}">마이페이지</a></li>
                            ${this.isAdmin(user.role) ? `<li><a href="/admin.html" class="nav-link ${this.isActive('admin.html')}" style="color: #dc2626; font-weight: 600;">관리자</a></li>` : ''}
                        </ul>
                        <div class="user-info">
                            <span>${this.escapeHtml(user.displayName)}님 (Lv.${user.level || 1})</span>
                            ${user.role && user.role !== 'user' ? `<span class="role-badge ${user.role}">${this.getRoleText(user.role)}</span>` : ''}
                            ${isSuspended ? `<span class="status-badge suspended">${this.getStatusText(user.status)}</span>` : ''}
                            <a href="/auth/logout" class="logout-btn">로그아웃</a>
                        </div>
                    </div>
                </div>
            </nav>
        `;

        // FAB 버튼 표시
        const fab = document.getElementById('ask-fab');
        if (fab) {
            fab.style.display = 'flex';
        }

        // 정지된 사용자에게 모달 표시
        if (isSuspended && typeof showSuspensionModal === 'function') {
            const suspensionInfo = this.getSuspensionInfo(user.suspendedUntil, user.suspendedAt, user.suspensionReason);
            showSuspensionModal(user.status, suspensionInfo);
        }
    }

    /**
     * 비인증 사용자용 네비게이션 바 렌더링
     */
    renderGuestNavbar(container) {
        container.innerHTML = `
            <nav class="navbar">
                <a href="/" class="navbar-brand">Gaon QandA</a>
                <button class="mobile-menu-toggle" onclick="window.navbar.toggleMobileMenu()">☰</button>
                <div id="auth-container">
                    <ul class="nav-links">
                        <li><a href="/" class="nav-link ${this.isActive('', 'index.html')}">홈</a></li>
                        <li><a href="/questions.html" class="nav-link ${this.isActive('questions.html')}">질문 목록</a></li>
                        <li><a href="/score-ranking.html" class="nav-link ${this.isActive('score-ranking.html', 'level-ranking.html')}">랭킹</a></li>
                    </ul>
                    <a href="/auth/google" class="login-btn">Google로 로그인</a>
                </div>
            </nav>
        `;

        // FAB 버튼 숨기기
        const fab = document.getElementById('ask-fab');
        if (fab) {
            fab.style.display = 'none';
        }
    }

    /**
     * 현재 페이지 활성화 확인
     */
    isActive(...pages) {
        return pages.includes(this.currentPath) ? 'active' : '';
    }

    /**
     * 관리자 권한 확인
     */
    isAdmin(role) {
        return role && ['moderator', 'admin', 'super_admin'].includes(role);
    }

    /**
     * HTML 이스케이프
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 역할 텍스트 반환
     */
    getRoleText(role) {
        const roleMap = {
            'user': '일반 사용자',
            'moderator': '모더레이터',
            'admin': '관리자',
            'super_admin': '최고 관리자'
        };
        return roleMap[role] || role;
    }

    /**
     * 상태 텍스트 반환
     */
    getStatusText(status) {
        const statusMap = {
            'active': '활성',
            'suspended': '정지',
            'banned': '차단'
        };
        return statusMap[status] || status;
    }

    /**
     * 정지 정보 반환
     */
    getSuspensionInfo(suspendedUntil, suspendedAt, suspensionReason) {
        let info = '';
        
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
            info += `<br><br>📋 제한 사유:<br>${this.escapeHtml(suspensionReason)}`;
        }
        
        return info;
    }

    /**
     * 모바일 메뉴 토글
     */
    toggleMobileMenu() {
        const navMenu = document.querySelector('.nav-menu');
        const authContainer = document.getElementById('auth-container');
        
        if (navMenu) {
            navMenu.classList.toggle('active');
        } else if (authContainer) {
            authContainer.classList.toggle('active');
        }
    }

    /**
     * 현재 사용자 정보 반환
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * 네비게이션 바 새로고침
     */
    async refresh() {
        await this.init();
    }
}

// 전역 navbar 인스턴스 생성
window.navbar = new Navbar();

// DOM 로드 완료 후 네비게이션 바 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.navbar.init();
    });
} else {
    // 이미 로드된 경우 즉시 초기화
    window.navbar.init();
}
