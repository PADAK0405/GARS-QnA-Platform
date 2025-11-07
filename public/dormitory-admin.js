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
    
    await loadAdminDormitoryDashboard();
    setupTabs();
    setupEventListeners();
});

async function loadAdminDormitoryDashboard() {
    await Promise.all([
        loadStats(),
        loadStudents(),
        loadLeaveRequests(),
        loadAllPoints(),
        loadAllViolations()
    ]);
}

async function loadStats() {
    try {
        const response = await fetch('/api/dormitory/stats');
        const stats = await response.json();
        
        const container = document.getElementById('stats-container');
        container.innerHTML = `
            <div class="stat-card">
                <span class="stat-number">${stats.active_students || 0}</span>
                <span class="stat-label">활성 기숙사생</span>
            </div>
            <div class="stat-card warning">
                <span class="stat-number">${stats.pending_requests || 0}</span>
                <span class="stat-label">대기중인 신청</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.today_leaves || 0}</span>
                <span class="stat-label">오늘 외출/외박</span>
            </div>
            <div class="stat-card danger">
                <span class="stat-number">${stats.today_violations || 0}</span>
                <span class="stat-label">오늘 위반 기록</span>
            </div>
            <div class="stat-card warning">
                <span class="stat-number">${stats.total_penalty_points || 0}</span>
                <span class="stat-label">총 벌점</span>
            </div>
        `;
    } catch (error) {
        console.error('통계 로드 실패:', error);
        document.getElementById('stats-container').innerHTML = `
            <div class="empty-state">
                <h3>통계를 불러올 수 없습니다</h3>
            </div>
        `;
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    const tabContents = document.querySelectorAll('.admin-tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            
            // 탭별 데이터 로드
            if (targetTab === 'leave-requests') {
                setupLeaveRequestFilters();
            }
        });
    });
}

function setupEventListeners() {
    // 기숙사생 등록 폼
    const registerForm = document.getElementById('register-student-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegisterStudent);
    }
    
    // 벌점/상점 부여 폼
    const pointsForm = document.getElementById('add-points-form');
    if (pointsForm) {
        pointsForm.addEventListener('submit', handleAddPoints);
    }
    
    // 위반 기록 폼
    const violationForm = document.getElementById('record-violation-form');
    if (violationForm) {
        violationForm.addEventListener('submit', handleRecordViolation);
    }
    
    // 자동 정지 체크박스
    const autoSuspendCheckbox = document.getElementById('violation-auto-suspend');
    if (autoSuspendCheckbox) {
        autoSuspendCheckbox.addEventListener('change', (e) => {
            const suspensionDaysGroup = document.getElementById('suspension-days-group');
            if (e.target.checked) {
                suspensionDaysGroup.style.display = 'block';
            } else {
                suspensionDaysGroup.style.display = 'none';
            }
        });
    }
}

async function loadStudents() {
    try {
        const response = await fetch('/api/dormitory/students');
        if (!response.ok) {
            throw new Error('기숙사생 목록을 불러올 수 없습니다.');
        }
        
        const students = await response.json();
        const container = document.getElementById('students-container');
        
        if (students.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>기숙사생이 없습니다</h3>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="students-table">
                <table>
                    <thead>
                        <tr>
                            <th>이름</th>
                            <th>건물</th>
                            <th>층</th>
                            <th>호실</th>
                            <th>벌점</th>
                            <th>상점</th>
                            <th>입사일</th>
                            <th>상태</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map(student => `
                            <tr>
                                <td>${escapeHtml(student.display_name)}</td>
                                <td>${escapeHtml(student.building)}</td>
                                <td>${student.floor}층</td>
                                <td>${escapeHtml(student.room)}</td>
                                <td>${student.total_penalty_points || 0}</td>
                                <td>${student.total_reward_points || 0}</td>
                                <td>${formatDate(student.enrollment_date)}</td>
                                <td>
                                    <span class="status-badge ${student.user_status || 'active'}">
                                        ${getStatusText(student.user_status || 'active')}
                                    </span>
                                </td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn-sm btn-primary" onclick="showAddPointsModalForUser('${student.user_id}', '${escapeHtml(student.display_name)}')">벌점/상점</button>
                                        <button class="btn-sm btn-danger" onclick="showRecordViolationModalForUser('${student.user_id}', '${escapeHtml(student.display_name)}')">위반 기록</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('기숙사생 목록 로드 실패:', error);
    }
}

async function loadLeaveRequests(status = '') {
    try {
        const url = status ? `/api/dormitory/leave-requests?status=${status}` : '/api/dormitory/leave-requests';
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('신청 목록을 불러올 수 없습니다.');
        }
        
        const requests = await response.json();
        const container = document.getElementById('leave-requests-container');
        
        if (requests.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>신청이 없습니다</h3>
                </div>
            `;
            return;
        }
        
        container.innerHTML = requests.map(request => `
            <div class="leave-request-item">
                <div class="request-header">
                    <div>
                        <strong>${escapeHtml(request.display_name)}</strong>
                        <span class="request-type-badge ${request.request_type}" style="margin-left: 10px;">
                            ${request.request_type === 'day_off' ? '외출' : '외박'}
                        </span>
                    </div>
                    <span class="request-status ${request.status}">
                        ${getRequestStatusText(request.status)}
                    </span>
                </div>
                <div style="margin-top: 10px;">
                    <p><strong>시작:</strong> ${formatDateTime(request.start_datetime)}</p>
                    <p><strong>종료:</strong> ${formatDateTime(request.end_datetime)}</p>
                    <p><strong>사유:</strong> ${escapeHtml(request.reason)}</p>
                    ${request.destination ? `<p><strong>목적지:</strong> ${escapeHtml(request.destination)}</p>` : ''}
                    <p><small>신청일: ${formatDateTime(request.created_at)}</small></p>
                </div>
                ${request.status === 'pending' ? `
                    <div class="action-buttons" style="margin-top: 15px;">
                        <button class="btn-sm btn-success" onclick="approveLeaveRequest(${request.id})">승인</button>
                        <button class="btn-sm btn-danger" onclick="rejectLeaveRequest(${request.id})">거부</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('신청 목록 로드 실패:', error);
    }
}

function setupLeaveRequestFilters() {
    document.querySelectorAll('#leave-requests-tab .filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('#leave-requests-tab .filter-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const status = button.dataset.status || '';
            loadLeaveRequests(status);
        });
    });
}

async function loadAllPoints() {
    try {
        // 관리자는 userId 파라미터 없이 호출하면 모든 기록 조회
        const response = await fetch('/api/dormitory/points');
        if (!response.ok) {
            throw new Error('벌점/상점 내역을 불러올 수 없습니다.');
        }
        
        const points = await response.json();
        const container = document.getElementById('points-container');
        
        if (points.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>벌점/상점 내역이 없습니다</h3>
                    <p>아직 벌점이나 상점이 부여되지 않았습니다.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="students-table">
                <table>
                    <thead>
                        <tr>
                            <th>사용자</th>
                            <th>유형</th>
                            <th>점수</th>
                            <th>사유</th>
                            <th>카테고리</th>
                            <th>부여자</th>
                            <th>일시</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${points.map(point => `
                            <tr>
                                <td>${escapeHtml(point.display_name || point.user_id)}</td>
                                <td>
                                    <span class="request-type-badge ${point.point_type}">
                                        ${point.point_type === 'penalty' ? '벌점' : '상점'}
                                    </span>
                                </td>
                                <td style="font-weight: bold; color: ${point.point_type === 'penalty' ? '#dc3545' : '#28a745'};">
                                    ${point.point_type === 'penalty' ? '-' : '+'}${point.points}점
                                </td>
                                <td>${escapeHtml(point.reason)}</td>
                                <td>${escapeHtml(point.category || '-')}</td>
                                <td>${escapeHtml(point.awarded_by_name)}</td>
                                <td>${formatDateTime(point.created_at)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('벌점/상점 내역 로드 실패:', error);
        document.getElementById('points-container').innerHTML = `
            <div class="empty-state">
                <h3>오류 발생</h3>
                <p>벌점/상점 내역을 불러올 수 없습니다.</p>
            </div>
        `;
    }
}

async function loadAllViolations() {
    try {
        const response = await fetch('/api/dormitory/violations');
        if (!response.ok) {
            throw new Error('위반 기록을 불러올 수 없습니다.');
        }
        
        const violations = await response.json();
        const container = document.getElementById('violations-container');
        
        if (violations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>위반 기록이 없습니다</h3>
                </div>
            `;
            return;
        }
        
        container.innerHTML = violations.map(violation => `
            <div class="leave-request-item">
                <div class="request-header">
                    <div>
                        <strong>${escapeHtml(violation.display_name)}</strong>
                        <span style="margin-left: 10px; color: #dc3545; font-weight: 600;">
                            ${escapeHtml(violation.violation_type)}
                        </span>
                    </div>
                    ${violation.auto_suspended ? '<span class="request-status rejected">자동 정지</span>' : ''}
                </div>
                <div style="margin-top: 10px;">
                    <p><strong>설명:</strong> ${escapeHtml(violation.description)}</p>
                    ${violation.penalty_points > 0 ? `<p><strong>벌점:</strong> ${violation.penalty_points}점</p>` : ''}
                    ${violation.suspension_days > 0 ? `<p><strong>정지 기간:</strong> ${violation.suspension_days}일</p>` : ''}
                    <p><strong>기록자:</strong> ${escapeHtml(violation.recorded_by_name)}</p>
                    <p><small>기록일: ${formatDateTime(violation.created_at)}</small></p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('위반 기록 로드 실패:', error);
    }
}

async function handleRegisterStudent(e) {
    e.preventDefault();
    
    const userId = document.getElementById('register-user-id').value;
    const building = document.getElementById('register-building').value;
    const floor = document.getElementById('register-floor').value;
    const room = document.getElementById('register-room').value;
    const enrollmentDate = document.getElementById('register-enrollment-date').value;
    
    try {
        const response = await fetch('/api/dormitory/students', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                building,
                floor,
                room,
                enrollmentDate
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '등록에 실패했습니다.');
        }
        
        showToast('기숙사생이 등록되었습니다.', 'success');
        closeModal('register-student-modal');
        document.getElementById('register-student-form').reset();
        loadStudents();
    } catch (error) {
        console.error('기숙사생 등록 실패:', error);
        showToast(error.message, 'error');
    }
}

async function handleAddPoints(e) {
    e.preventDefault();
    
    const userId = document.getElementById('points-user-id').value;
    const pointType = document.getElementById('points-type').value;
    const points = parseInt(document.getElementById('points-value').value);
    const reason = document.getElementById('points-reason').value;
    const category = document.getElementById('points-category').value;
    
    try {
        const response = await fetch('/api/dormitory/points', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                pointType,
                points,
                reason,
                category: category || null
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '부여에 실패했습니다.');
        }
        
        showToast('벌점/상점이 부여되었습니다.', 'success');
        closeModal('add-points-modal');
        document.getElementById('add-points-form').reset();
        loadStudents();
        loadStats();
    } catch (error) {
        console.error('벌점/상점 부여 실패:', error);
        showToast(error.message, 'error');
    }
}

async function handleRecordViolation(e) {
    e.preventDefault();
    
    const userId = document.getElementById('violation-user-id').value;
    const violationType = document.getElementById('violation-type').value;
    const description = document.getElementById('violation-description').value;
    const penaltyPoints = parseInt(document.getElementById('violation-penalty-points').value) || 0;
    const autoSuspend = document.getElementById('violation-auto-suspend').checked;
    const suspensionDays = autoSuspend ? parseInt(document.getElementById('violation-suspension-days').value) || 1 : 0;
    
    try {
        const response = await fetch('/api/dormitory/violations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                violationType,
                description,
                penaltyPoints,
                autoSuspend,
                suspensionDays
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '기록에 실패했습니다.');
        }
        
        showToast('위반 기록이 등록되었습니다.', 'success');
        closeModal('record-violation-modal');
        document.getElementById('record-violation-form').reset();
        document.getElementById('suspension-days-group').style.display = 'none';
        loadAllViolations();
        loadStudents();
        loadStats();
    } catch (error) {
        console.error('위반 기록 실패:', error);
        showToast(error.message, 'error');
    }
}

async function approveLeaveRequest(requestId) {
    try {
        const response = await fetch(`/api/dormitory/leave-requests/${requestId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'approved'
            })
        });
        
        if (!response.ok) {
            throw new Error('승인에 실패했습니다.');
        }
        
        showToast('신청이 승인되었습니다.', 'success');
        loadLeaveRequests();
        loadStats();
    } catch (error) {
        console.error('신청 승인 실패:', error);
        showToast(error.message, 'error');
    }
}

async function rejectLeaveRequest(requestId) {
    const reason = prompt('거부 사유를 입력하세요:');
    if (!reason) return;
    
    try {
        const response = await fetch(`/api/dormitory/leave-requests/${requestId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'rejected',
                rejectionReason: reason
            })
        });
        
        if (!response.ok) {
            throw new Error('거부에 실패했습니다.');
        }
        
        showToast('신청이 거부되었습니다.', 'success');
        loadLeaveRequests();
        loadStats();
    } catch (error) {
        console.error('신청 거부 실패:', error);
        showToast(error.message, 'error');
    }
}

function showRegisterStudentModal() {
    document.getElementById('register-student-modal').classList.add('active');
}

function showAddPointsModal() {
    document.getElementById('add-points-modal').classList.add('active');
}

function showAddPointsModalForUser(userId, userName) {
    document.getElementById('points-user-id').value = userId;
    document.getElementById('add-points-modal').classList.add('active');
}

function showRecordViolationModal() {
    document.getElementById('record-violation-modal').classList.add('active');
}

function showRecordViolationModalForUser(userId, userName) {
    document.getElementById('violation-user-id').value = userId;
    document.getElementById('record-violation-modal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function getRequestStatusText(status) {
    const statusMap = {
        'pending': '대기중',
        'approved': '승인됨',
        'rejected': '거부됨',
        'cancelled': '취소됨'
    };
    return statusMap[status] || status;
}

function getStatusText(status) {
    const statusMap = {
        'active': '활성',
        'suspended': '정지',
        'banned': '차단'
    };
    return statusMap[status] || status;
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        alert(message);
    }
}

