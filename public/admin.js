document.addEventListener('DOMContentLoaded', async () => {
    // CSRF 토큰 초기화
    if (typeof fetchCSRFToken === 'function') {
        await fetchCSRFToken();
    }
    
    // 관리자 권한 확인
    try {
        const response = await fetch('/api/admin/check');
        if (!response.ok) {
            throw new Error('관리자 권한이 없습니다.');
        }
    } catch (error) {
        showToast('관리자 권한이 필요합니다.', 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
        return;
    }
    
    await loadAdminDashboard();
    setupTabs();
    setupEventListeners();
});

async function loadAdminDashboard() {
    await Promise.all([
        loadStats(),
        loadUsers(),
        loadReports(),
        loadLogs()
    ]);
}

async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const stats = await response.json();
        
        const container = document.getElementById('stats-container');
        container.innerHTML = `
            <div class="stat-card">
                <span class="stat-number">${stats.active_users || 0}</span>
                <span class="stat-label">활성 사용자</span>
            </div>
            <div class="stat-card warning">
                <span class="stat-number">${stats.suspended_users || 0}</span>
                <span class="stat-label">정지된 사용자</span>
            </div>
            <div class="stat-card danger">
                <span class="stat-number">${stats.banned_users || 0}</span>
                <span class="stat-label">차단된 사용자</span>
            </div>
            <div class="stat-card success">
                <span class="stat-number">${stats.active_questions || 0}</span>
                <span class="stat-label">활성 질문</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.active_answers || 0}</span>
                <span class="stat-label">활성 답변</span>
            </div>
            <div class="stat-card warning">
                <span class="stat-number">${stats.hidden_questions || 0}</span>
                <span class="stat-label">숨겨진 질문</span>
            </div>
            <div class="stat-card warning">
                <span class="stat-number">${stats.hidden_answers || 0}</span>
                <span class="stat-label">숨겨진 답변</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.today_actions || 0}</span>
                <span class="stat-label">오늘 관리 작업</span>
            </div>
        `;
    } catch (error) {
        console.error('통계 로드 실패:', error);
        document.getElementById('stats-container').innerHTML = `
            <div class="empty-state">
                <h3>통계를 불러올 수 없습니다</h3>
                <p>잠시 후 다시 시도해주세요.</p>
            </div>`;
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        
        const container = document.getElementById('users-container');
        
        if (users.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>사용자가 없습니다</h3>
                </div>`;
            return;
        }
        
        container.innerHTML = `
            <div class="admin-table">
                <table>
                    <thead>
                        <tr>
                            <th>닉네임</th>
                            <th>이메일</th>
                            <th>점수</th>
                            <th>역할</th>
                            <th>상태</th>
                            <th>가입일</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr>
                                <td>${escapeHtml(user.display_name)}</td>
                                <td>${escapeHtml(user.email || '-')}</td>
                                <td>${user.score}</td>
                                <td><span class="role-badge ${user.role}">${getRoleText(user.role)}</span></td>
                                <td><span class="status-badge ${user.status}">${getStatusText(user.status)}</span></td>
                                <td>${formatDate(user.created_at)}</td>
                                <td>
                                    <div class="admin-actions">
                                        <button class="admin-btn" onclick="editUserRole('${user.id}', '${user.role}')">역할 변경</button>
                                        ${user.status === 'active' ? 
                                            `<button class="admin-btn danger" onclick="suspendUser('${user.id}')">정지</button>` :
                                            `<button class="admin-btn success" onclick="restoreUser('${user.id}')">복원</button>`
                                        }
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (error) {
        console.error('사용자 목록 로드 실패:', error);
        document.getElementById('users-container').innerHTML = `
            <div class="empty-state">
                <h3>사용자 목록을 불러올 수 없습니다</h3>
                <p>잠시 후 다시 시도해주세요.</p>
            </div>`;
    }
}

async function loadLogs() {
    try {
        const response = await fetch('/api/admin/logs');
        const logs = await response.json();
        
        const container = document.getElementById('logs-container');
        
        if (logs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>관리 로그가 없습니다</h3>
                </div>`;
            return;
        }
        
        container.innerHTML = logs.map(log => `
            <div class="log-entry">
                <div class="log-header">
                    <span class="log-action">${getActionText(log.action_type)}</span>
                    <span class="log-time">${formatDate(log.created_at)}</span>
                </div>
                <div class="log-details">
                    관리자: <span class="log-admin">${escapeHtml(log.admin_name)}</span>
                    ${log.reason ? `<br>사유: ${escapeHtml(log.reason)}` : ''}
                    ${log.details ? `<br>상세: ${JSON.stringify(log.details)}` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('로그 로드 실패:', error);
        document.getElementById('logs-container').innerHTML = `
            <div class="empty-state">
                <h3>관리 로그를 불러올 수 없습니다</h3>
                <p>잠시 후 다시 시도해주세요.</p>
            </div>`;
    }
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            // 모든 탭 버튼과 패널에서 active 클래스 제거
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            
            // 클릭된 탭 버튼과 해당 패널에 active 클래스 추가
            button.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            
            // 해당 탭의 데이터 로드
            if (targetTab === 'questions') {
                loadQuestions();
                setupQuestionsFilters();
            } else if (targetTab === 'answers') {
                loadAnswers();
                setupAnswersFilters();
            } else if (targetTab === 'reports') {
                loadReports();
            }
        });
    });
    
    // 신고 필터 버튼 이벤트
    document.querySelectorAll('#reports-tab .filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            // 모든 필터 버튼에서 active 클래스 제거
            document.querySelectorAll('#reports-tab .filter-btn').forEach(btn => btn.classList.remove('active'));
            // 클릭된 버튼에 active 클래스 추가
            button.classList.add('active');
            // 해당 상태로 신고 목록 로드
            loadReports(button.dataset.status);
        });
    });
}

function setupEventListeners() {
    // 새로고침 버튼
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadAdminDashboard();
            showToast('관리자 대시보드를 새로고침했습니다.', 'success');
        });
    }
    
    // 로그 새로고침 버튼
    const refreshLogsBtn = document.getElementById('refresh-logs-btn');
    if (refreshLogsBtn) {
        refreshLogsBtn.addEventListener('click', () => {
            loadLogs();
            showToast('관리 로그를 새로고침했습니다.', 'success');
        });
    }
    
    // 사용자 검색
    const userSearch = document.getElementById('user-search');
    if (userSearch) {
        userSearch.addEventListener('input', (e) => {
            // 검색 기능 구현 (필요시)
            console.log('사용자 검색:', e.target.value);
        });
    }
}

// 사용자 관리 함수들
function editUserRole(userId, currentRole) {
    const modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.innerHTML = `
        <div class="admin-modal-content">
            <div class="admin-modal-header">
                <h3>사용자 역할 변경</h3>
                <button class="close-modal" onclick="this.closest('.admin-modal').remove()">&times;</button>
            </div>
            <div class="admin-modal-body">
                <div class="form-group">
                    <label>새 역할</label>
                    <select id="new-role">
                        <option value="user" ${currentRole === 'user' ? 'selected' : ''}>일반 사용자</option>
                        <option value="moderator" ${currentRole === 'moderator' ? 'selected' : ''}>모더레이터</option>
                        <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>관리자</option>
                        <option value="super_admin" ${currentRole === 'super_admin' ? 'selected' : ''}>최고 관리자</option>
                    </select>
                </div>
            </div>
            <div class="admin-modal-footer">
                <button class="secondary-btn" onclick="this.closest('.admin-modal').remove()">취소</button>
                <button class="primary-btn" onclick="saveUserRole('${userId}')">저장</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function saveUserRole(userId) {
    const newRole = document.getElementById('new-role').value;
    
    try {
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole })
        });
        
        if (response.ok) {
            showToast('사용자 역할이 변경되었습니다.', 'success');
            document.querySelector('.admin-modal').remove();
            loadUsers();
        } else {
            throw new Error('역할 변경 실패');
        }
    } catch (error) {
        showToast('사용자 역할 변경에 실패했습니다.', 'error');
    }
}

function suspendUser(userId) {
    const modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.innerHTML = `
        <div class="admin-modal-content">
            <div class="admin-modal-header">
                <h3>사용자 정지</h3>
                <button class="close-modal" onclick="this.closest('.admin-modal').remove()">&times;</button>
            </div>
            <div class="admin-modal-body">
                <div class="form-group">
                    <label>정지 기간</label>
                    <select id="suspension-period">
                        <option value="1">1일</option>
                        <option value="7">7일</option>
                        <option value="30">30일</option>
                        <option value="permanent">영구 정지</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>정지 사유</label>
                    <textarea id="suspension-reason" rows="4" placeholder="정지 사유를 입력하세요..."></textarea>
                </div>
            </div>
            <div class="admin-modal-footer">
                <button class="secondary-btn" onclick="this.closest('.admin-modal').remove()">취소</button>
                <button class="primary-btn danger" onclick="saveUserSuspension('${userId}')">정지</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function saveUserSuspension(userId) {
    const period = document.getElementById('suspension-period').value;
    const reason = document.getElementById('suspension-reason').value.trim();
    
    if (!reason) {
        showToast('정지 사유를 입력해주세요.', 'error');
        return;
    }
    
    let suspendedUntil = null;
    if (period !== 'permanent') {
        const days = parseInt(period);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);
        suspendedUntil = endDate.toISOString(); // ISO 문자열로 변환
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: period === 'permanent' ? 'banned' : 'suspended',
                reason: reason,
                suspendedUntil: suspendedUntil
            })
        });
        
        if (response.ok) {
            showToast('사용자가 정지되었습니다.', 'success');
            document.querySelector('.admin-modal').remove();
            loadUsers();
        } else {
            throw new Error('사용자 정지 실패');
        }
    } catch (error) {
        showToast('사용자 정지에 실패했습니다.', 'error');
    }
}

async function restoreUser(userId) {
    if (!confirm('이 사용자를 복원하시겠습니까?')) return;
    
    try {
        const response = await fetch(`/api/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active' })
        });
        
        if (response.ok) {
            showToast('사용자가 복원되었습니다.', 'success');
            loadUsers();
        } else {
            throw new Error('사용자 복원 실패');
        }
    } catch (error) {
        showToast('사용자 복원에 실패했습니다.', 'error');
    }
}

// 질문/답변 관리 함수들
async function loadQuestions(status = 'all') {
    try {
        const response = await fetch('/api/admin/questions');
        const questions = await response.json();
        
        // 상태별 필터링
        let filteredQuestions = questions;
        if (status === 'active') {
            filteredQuestions = questions.filter(q => q.status === 'active' || !q.status);
        } else if (status === 'hidden') {
            filteredQuestions = questions.filter(q => q.status === 'hidden');
        }
        
        const container = document.getElementById('questions-container');
        
        if (filteredQuestions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>질문이 없습니다</h3>
                    <p>선택한 상태의 질문이 없습니다.</p>
                </div>`;
            return;
        }
        
        container.innerHTML = `
            <div class="questions-list">
                ${filteredQuestions.map(question => `
                    <div class="question-item">
                        <div class="question-header">
                            <h4>${escapeHtml(question.title)}</h4>
                            <span class="question-status ${question.status || 'active'}">${question.status || 'active'}</span>
                        </div>
                        <div class="question-content">
                            <p>${escapeHtml(question.content.substring(0, 100))}${question.content.length > 100 ? '...' : ''}</p>
                        </div>
                        <div class="question-meta">
                            <span>작성자: ${escapeHtml(question.author?.name || 'Unknown')}</span>
                            <span>작성일: ${formatDate(question.created_at)}</span>
                        </div>
                        <div class="question-actions">
                            ${question.status === 'hidden' ? 
                                `<button class="action-btn success" onclick="toggleQuestionStatus(${question.id}, 'active')">복원</button>` :
                                `<button class="action-btn warning" onclick="toggleQuestionStatus(${question.id}, 'hidden')">숨기기</button>`
                            }
                            <button class="action-btn danger" onclick="deleteQuestion(${question.id})">삭제</button>
                        </div>
                    </div>
                `).join('')}
            </div>`;
    } catch (error) {
        console.error('질문 로드 실패:', error);
        showToast('질문을 불러오는데 실패했습니다.', 'error');
    }
}

async function loadAnswers(status = 'all') {
    try {
        // 모든 질문의 답변을 가져오기
        const questionsResponse = await fetch('/api/questions');
        const questions = await questionsResponse.json();
        
        let allAnswers = [];
        for (const question of questions) {
            try {
                const answersResponse = await fetch(`/api/questions/${question.id}/answers`);
                const answers = await answersResponse.json();
                allAnswers = allAnswers.concat(answers.map(answer => ({
                    ...answer,
                    questionTitle: question.title,
                    questionId: question.id
                })));
            } catch (error) {
                console.error(`질문 ${question.id}의 답변 로드 실패:`, error);
            }
        }
        
        // 상태별 필터링
        let filteredAnswers = allAnswers;
        if (status === 'active') {
            filteredAnswers = allAnswers.filter(a => a.status === 'active' || !a.status);
        } else if (status === 'hidden') {
            filteredAnswers = allAnswers.filter(a => a.status === 'hidden');
        }
        
        const container = document.getElementById('answers-container');
        
        if (filteredAnswers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>답변이 없습니다</h3>
                    <p>선택한 상태의 답변이 없습니다.</p>
                </div>`;
            return;
        }
        
        container.innerHTML = `
            <div class="answers-list">
                ${filteredAnswers.map(answer => `
                    <div class="answer-item">
                        <div class="answer-header">
                            <h4>질문: ${escapeHtml(answer.questionTitle)}</h4>
                            <span class="answer-status ${answer.status || 'active'}">${answer.status || 'active'}</span>
                        </div>
                        <div class="answer-content">
                            <p>${escapeHtml(answer.content.substring(0, 100))}${answer.content.length > 100 ? '...' : ''}</p>
                        </div>
                        <div class="answer-meta">
                            <span>작성자: ${escapeHtml(answer.author?.name || 'Unknown')}</span>
                            <span>작성일: ${formatDate(answer.created_at)}</span>
                        </div>
                        <div class="answer-actions">
                            ${answer.status === 'hidden' ? 
                                `<button class="action-btn success" onclick="toggleAnswerStatus(${answer.id}, 'active')">복원</button>` :
                                `<button class="action-btn warning" onclick="toggleAnswerStatus(${answer.id}, 'hidden')">숨기기</button>`
                            }
                            <button class="action-btn danger" onclick="deleteAnswer(${answer.id})">삭제</button>
                        </div>
                    </div>
                `).join('')}
            </div>`;
    } catch (error) {
        console.error('답변 로드 실패:', error);
        showToast('답변을 불러오는데 실패했습니다.', 'error');
    }
}

// 필터 설정 함수들
function setupQuestionsFilters() {
    document.querySelectorAll('#questions-tab .filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            // 모든 필터 버튼에서 active 클래스 제거
            document.querySelectorAll('#questions-tab .filter-btn').forEach(btn => btn.classList.remove('active'));
            // 클릭된 버튼에 active 클래스 추가
            button.classList.add('active');
            // 해당 상태로 질문 목록 로드
            const status = button.dataset.status;
            loadQuestions(status);
        });
    });
}

function setupAnswersFilters() {
    document.querySelectorAll('#answers-tab .filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            // 모든 필터 버튼에서 active 클래스 제거
            document.querySelectorAll('#answers-tab .filter-btn').forEach(btn => btn.classList.remove('active'));
            // 클릭된 버튼에 active 클래스 추가
            button.classList.add('active');
            // 해당 상태로 답변 목록 로드
            const status = button.dataset.status;
            loadAnswers(status);
        });
    });
}

// 질문/답변 상태 변경 함수들
async function toggleQuestionStatus(questionId, status) {
    try {
        const response = await fetch(`/api/admin/questions/${questionId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showToast(`질문이 ${status === 'hidden' ? '숨겨졌습니다' : '복원되었습니다'}.`, 'success');
            // 현재 필터 상태로 다시 로드
            const activeFilter = document.querySelector('#questions-tab .filter-btn.active');
            const currentStatus = activeFilter ? activeFilter.dataset.status : 'all';
            loadQuestions(currentStatus);
        } else {
            showToast('질문 상태 변경에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('질문 상태 변경 오류:', error);
        showToast('질문 상태 변경 중 오류가 발생했습니다.', 'error');
    }
}

async function toggleAnswerStatus(answerId, status) {
    try {
        const response = await fetch(`/api/admin/answers/${answerId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showToast(`답변이 ${status === 'hidden' ? '숨겨졌습니다' : '복원되었습니다'}.`, 'success');
            // 현재 필터 상태로 다시 로드
            const activeFilter = document.querySelector('#answers-tab .filter-btn.active');
            const currentStatus = activeFilter ? activeFilter.dataset.status : 'all';
            loadAnswers(currentStatus);
        } else {
            showToast('답변 상태 변경에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('답변 상태 변경 오류:', error);
        showToast('답변 상태 변경 중 오류가 발생했습니다.', 'error');
    }
}

async function deleteQuestion(questionId) {
    if (!confirm('정말로 이 질문을 삭제하시겠습니까?')) return;
    
    try {
        const response = await fetch(`/api/questions/${questionId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('질문이 삭제되었습니다.', 'success');
            // 현재 필터 상태로 다시 로드
            const activeFilter = document.querySelector('#questions-tab .filter-btn.active');
            const currentStatus = activeFilter ? activeFilter.dataset.status : 'all';
            loadQuestions(currentStatus);
        } else {
            showToast('질문 삭제에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('질문 삭제 오류:', error);
        showToast('질문 삭제 중 오류가 발생했습니다.', 'error');
    }
}

async function deleteAnswer(answerId) {
    if (!confirm('정말로 이 답변을 삭제하시겠습니까?')) return;
    
    try {
        const response = await fetch(`/api/answers/${answerId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('답변이 삭제되었습니다.', 'success');
            // 현재 필터 상태로 다시 로드
            const activeFilter = document.querySelector('#answers-tab .filter-btn.active');
            const currentStatus = activeFilter ? activeFilter.dataset.status : 'all';
            loadAnswers(currentStatus);
        } else {
            showToast('답변 삭제에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('답변 삭제 오류:', error);
        showToast('답변 삭제 중 오류가 발생했습니다.', 'error');
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
    return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
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

function getActionText(actionType) {
    const actionMap = {
        'user_suspend': '사용자 정지',
        'user_ban': '사용자 차단',
        'user_unban': '사용자 복원',
        'question_hide': '질문 숨김',
        'question_restore': '질문 복원',
        'answer_hide': '답변 숨김',
        'answer_restore': '답변 복원',
        'role_change': '역할 변경',
        'content_delete': '콘텐츠 삭제'
    };
    return actionMap[actionType] || actionType;
}

// 신고 관리 함수들
async function loadReports(status = 'pending') {
    try {
        console.log('신고 목록 로드 시작, 상태:', status);
        const response = await fetch(`/api/reports?status=${status}&limit=50`);
        
        console.log('신고 API 응답 상태:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('신고 API 에러 응답:', errorText);
            throw new Error(`신고 목록을 불러올 수 없습니다. (${response.status})`);
        }
        
        const data = await response.json();
        console.log('신고 데이터:', data);
        
        if (data.reports) {
            displayReports(data.reports);
        } else {
            console.error('신고 데이터 구조 오류:', data);
            displayReports([]);
        }
    } catch (error) {
        console.error('신고 목록 로드 실패:', error);
        document.getElementById('reports-container').innerHTML = `
            <div class="empty-state">
                <h3>신고 목록을 불러올 수 없습니다</h3>
                <p>${error.message}</p>
                <p>잠시 후 다시 시도해주세요.</p>
            </div>`;
    }
}

function displayReports(reports) {
    const container = document.getElementById('reports-container');
    
    if (reports.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>신고가 없습니다</h3>
                <p>새로운 신고가 없습니다.</p>
            </div>`;
        return;
    }
    
    container.innerHTML = reports.map(report => `
        <div class="report-item">
            <div class="report-header">
                <div class="report-info">
                    <span class="report-type">${getReportTypeText(report.target_type)}</span>
                    <span class="report-reason">${getReportReasonText(report.reason)}</span>
                    <span class="report-date">${formatDate(report.created_at)}</span>
                </div>
                <div class="report-status">
                    <span class="status-badge ${report.status}">${getReportStatusText(report.status)}</span>
                </div>
            </div>
            
            <div class="report-details">
                <div class="report-reporter">
                    <strong>신고자:</strong> ${report.reporter_name || '알 수 없음'}
                </div>
                ${report.description ? `
                    <div class="report-description">
                        <strong>신고 내용:</strong>
                        <p>${escapeHtml(report.description)}</p>
                    </div>
                ` : ''}
                
                <!-- 신고된 콘텐츠 미리보기 -->
                <div class="reported-content-preview">
                    <strong>신고된 콘텐츠:</strong>
                    <div class="content-preview" id="content-preview-${report.id}">
                        <div class="loading-spinner"></div>
                        <p>콘텐츠를 불러오는 중...</p>
                    </div>
                </div>
                
                ${report.admin_notes ? `
                    <div class="admin-notes">
                        <strong>관리자 메모:</strong>
                        <p>${escapeHtml(report.admin_notes)}</p>
                    </div>
                ` : ''}
            </div>
            
            <div class="report-actions">
                ${report.status === 'pending' ? `
                    <button class="action-btn danger" onclick="punishUser(${report.id}, ${report.target_id}, '${report.target_type}')">사용자 처벌</button>
                    <button class="action-btn secondary" onclick="reviewReport(${report.id}, 'dismissed')">기각</button>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    // 각 신고에 대해 콘텐츠 미리보기 로드
    reports.forEach(report => {
        loadReportedContent(report);
    });
}

function getReportTypeText(type) {
    const types = {
        'question': '질문',
        'answer': '답변',
        'user': '사용자'
    };
    return types[type] || type;
}

function getReportReasonText(reason) {
    const reasons = {
        'spam': '스팸/광고',
        'inappropriate': '부적절한 내용',
        'harassment': '괴롭힘/모욕',
        'violence': '폭력적 내용',
        'copyright': '저작권 침해',
        'other': '기타'
    };
    return reasons[reason] || reason;
}

function getReportStatusText(status) {
    const statuses = {
        'pending': '대기중',
        'reviewed': '검토완료',
        'resolved': '해결됨',
        'dismissed': '기각됨'
    };
    return statuses[status] || status;
}

async function reviewReport(reportId, status) {
    try {
        const response = await fetch(`/api/reports/${reportId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showToast('신고 상태가 업데이트되었습니다.', 'success');
            // 현재 필터 상태로 다시 로드
            const activeFilter = document.querySelector('.filter-btn.active');
            const currentStatus = activeFilter ? activeFilter.dataset.status : 'pending';
            await loadReports(currentStatus);
        } else {
            throw new Error('신고 상태 업데이트에 실패했습니다.');
        }
    } catch (error) {
        console.error('신고 상태 업데이트 실패:', error);
        showToast(error.message, 'error');
    }
}

function refreshReports() {
    const activeFilter = document.querySelector('.filter-btn.active');
    const currentStatus = activeFilter ? activeFilter.dataset.status : 'pending';
    loadReports(currentStatus);
}

// 신고된 콘텐츠 미리보기 로드
async function loadReportedContent(report) {
    const previewContainer = document.getElementById(`content-preview-${report.id}`);
    if (!previewContainer) return;

    try {
        let content = '';
        
        if (report.target_type === 'question') {
            const response = await fetch(`/api/questions/${report.target_id}`);
            if (response.ok) {
                const question = await response.json();
                content = `
                    <div class="question-preview">
                        <h4>${escapeHtml(question.title)}</h4>
                        <p>${escapeHtml(question.content).substring(0, 200)}${question.content.length > 200 ? '...' : ''}</p>
                        <small>작성자: ${escapeHtml(question.author.name)} | ${formatDate(question.created_at)}</small>
                    </div>
                `;
            }
        } else if (report.target_type === 'answer') {
            const response = await fetch(`/api/answers/${report.target_id}`);
            if (response.ok) {
                const answer = await response.json();
                content = `
                    <div class="answer-preview">
                        <p>${escapeHtml(answer.content).substring(0, 200)}${answer.content.length > 200 ? '...' : ''}</p>
                        <small>작성자: ${escapeHtml(answer.author.name)} | ${formatDate(answer.created_at)}</small>
                    </div>
                `;
            }
        }
        
        if (content) {
            previewContainer.innerHTML = content;
        } else {
            previewContainer.innerHTML = '<p class="error">콘텐츠를 불러올 수 없습니다.</p>';
        }
    } catch (error) {
        console.error('콘텐츠 미리보기 로드 실패:', error);
        previewContainer.innerHTML = '<p class="error">콘텐츠를 불러올 수 없습니다.</p>';
    }
}

// 사용자 처벌 함수
async function punishUser(reportId, targetId, targetType) {
    if (!confirm('이 사용자를 정지시키겠습니까?')) {
        return;
    }

    try {
        // 먼저 신고 상태를 해결됨으로 변경
        await reviewReport(reportId, 'resolved');
        
        // 사용자 ID 찾기
        let userId = null;
        if (targetType === 'question') {
            const response = await fetch(`/api/questions/${targetId}`);
            if (response.ok) {
                const question = await response.json();
                console.log('질문 데이터:', question);
                // author 객체가 있는지 확인하고 안전하게 접근
                userId = question.author?.id || question.user_id;
            }
        } else if (targetType === 'answer') {
            const response = await fetch(`/api/answers/${targetId}`);
            if (response.ok) {
                const answer = await response.json();
                console.log('답변 데이터:', answer);
                // author 객체가 있는지 확인하고 안전하게 접근
                userId = answer.author?.id || answer.user_id;
            }
        }
        
        if (!userId) {
            alert('사용자 ID를 찾을 수 없습니다.');
            return;
        }

        if (userId) {
            // 사용자 정지 처리
            const suspendResponse = await fetch(`/api/admin/users/${userId}/suspend`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': window.csrfToken || ''
                },
                body: JSON.stringify({
                    status: 'suspended',
                    reason: '부적절한 콘텐츠 신고로 인한 정지',
                    duration: 7 // 7일 정지
                }),
                credentials: 'include'
            });

            if (suspendResponse.ok) {
                showToast('사용자가 정지되었습니다.', 'success');
                // 신고 목록 새로고침
                refreshReports();
            } else {
                throw new Error('사용자 정지 처리에 실패했습니다.');
            }
        } else {
            throw new Error('사용자 정보를 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('사용자 처벌 실패:', error);
        showToast(error.message, 'error');
    }
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
