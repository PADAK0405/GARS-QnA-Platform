document.addEventListener('DOMContentLoaded', async () => {
    // CSRF 토큰 초기화
    if (typeof fetchCSRFToken === 'function') {
        await fetchCSRFToken();
    }
    
    await loadDormitoryDashboard();
    setupTabs();
    setupEventListeners();
});

async function loadDormitoryDashboard() {
    await Promise.all([
        loadStudentInfo(),
        loadMyRequests(),
        loadPointsHistory(),
        loadViolations()
    ]);
}

async function loadStudentInfo() {
    try {
        const response = await fetch('/api/dormitory/student');
        if (!response.ok) {
            if (response.status === 404) {
                document.getElementById('student-info-container').innerHTML = `
                    <div class="empty-state">
                        <h3>기숙사생 정보가 없습니다</h3>
                        <p>관리자에게 문의하여 기숙사생으로 등록해주세요.</p>
                    </div>
                `;
                return;
            }
            throw new Error('기숙사생 정보를 불러올 수 없습니다.');
        }
        
        const student = await response.json();
        
        // 포인트 업데이트
        document.getElementById('penalty-points').textContent = student.total_penalty_points || 0;
        document.getElementById('reward-points').textContent = student.total_reward_points || 0;
        
        // 기숙사생 정보 표시
        document.getElementById('student-info-container').innerHTML = `
            <h2>기숙사생 정보</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;">
                <div>
                    <strong>건물:</strong> ${escapeHtml(student.building)}
                </div>
                <div>
                    <strong>층:</strong> ${student.floor}층
                </div>
                <div>
                    <strong>호실:</strong> ${escapeHtml(student.room)}
                </div>
                <div>
                    <strong>입사일:</strong> ${formatDate(student.enrollment_date)}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('기숙사생 정보 로드 실패:', error);
        document.getElementById('student-info-container').innerHTML = `
            <div class="empty-state">
                <h3>오류 발생</h3>
                <p>기숙사생 정보를 불러올 수 없습니다.</p>
            </div>
        `;
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.dormitory-tab');
    const tabContents = document.querySelectorAll('.dormitory-tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // 모든 탭과 콘텐츠에서 active 제거
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // 선택된 탭과 콘텐츠에 active 추가
            tab.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
}

function setupEventListeners() {
    // 외출/외박 신청 폼
    const form = document.getElementById('leave-request-form');
    if (form) {
        form.addEventListener('submit', handleLeaveRequestSubmit);
    }
}

async function handleLeaveRequestSubmit(e) {
    e.preventDefault();
    
    const requestType = document.getElementById('request-type').value;
    const startDatetime = document.getElementById('start-datetime').value;
    const endDatetime = document.getElementById('end-datetime').value;
    const reason = document.getElementById('reason').value;
    const destination = document.getElementById('destination').value;
    const emergencyContact = document.getElementById('emergency-contact').value;
    
    if (!requestType || !startDatetime || !endDatetime || !reason) {
        showToast('필수 항목을 모두 입력해주세요.', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/dormitory/leave-requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requestType,
                startDatetime,
                endDatetime,
                reason,
                destination: destination || null,
                emergencyContact: emergencyContact || null
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '신청에 실패했습니다.');
        }
        
        const result = await response.json();
        showToast('외출/외박 신청이 접수되었습니다.', 'success');
        
        // 폼 초기화
        document.getElementById('leave-request-form').reset();
        
        // 신청 내역 새로고침
        loadMyRequests();
    } catch (error) {
        console.error('외출/외박 신청 실패:', error);
        showToast(error.message, 'error');
    }
}

async function loadMyRequests() {
    try {
        const response = await fetch('/api/dormitory/leave-requests');
        if (!response.ok) {
            throw new Error('신청 내역을 불러올 수 없습니다.');
        }
        
        const requests = await response.json();
        const container = document.getElementById('my-requests-container');
        
        if (requests.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>신청 내역이 없습니다</h3>
                    <p>아직 외출/외박 신청이 없습니다.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = requests.map(request => `
            <div class="leave-request-item">
                <div class="request-header">
                    <div>
                        <span class="request-type-badge ${request.request_type}">
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
                    ${request.rejection_reason ? `<p style="color: #dc3545;"><strong>거부 사유:</strong> ${escapeHtml(request.rejection_reason)}</p>` : ''}
                    ${request.approver_name ? `<p><strong>승인자:</strong> ${escapeHtml(request.approver_name)}</p>` : ''}
                    <p><small>신청일: ${formatDateTime(request.created_at)}</small></p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('신청 내역 로드 실패:', error);
        document.getElementById('my-requests-container').innerHTML = `
            <div class="empty-state">
                <h3>오류 발생</h3>
                <p>신청 내역을 불러올 수 없습니다.</p>
            </div>
        `;
    }
}

async function loadPointsHistory() {
    try {
        const response = await fetch('/api/dormitory/points');
        if (!response.ok) {
            throw new Error('벌점/상점 내역을 불러올 수 없습니다.');
        }
        
        const points = await response.json();
        const container = document.getElementById('points-history-container');
        
        if (points.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>벌점/상점 내역이 없습니다</h3>
                    <p>아직 벌점이나 상점이 부여되지 않았습니다.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = points.map(point => `
            <div class="leave-request-item">
                <div class="request-header">
                    <span class="request-type-badge ${point.point_type}">
                        ${point.point_type === 'penalty' ? '벌점' : '상점'}
                    </span>
                    <span style="font-size: 18px; font-weight: bold; color: ${point.point_type === 'penalty' ? '#dc3545' : '#28a745'};">
                        ${point.point_type === 'penalty' ? '-' : '+'}${point.points}점
                    </span>
                </div>
                <div style="margin-top: 10px;">
                    <p><strong>사유:</strong> ${escapeHtml(point.reason)}</p>
                    ${point.category ? `<p><strong>카테고리:</strong> ${escapeHtml(point.category)}</p>` : ''}
                    <p><strong>부여자:</strong> ${escapeHtml(point.awarded_by_name)}</p>
                    <p><small>부여일: ${formatDateTime(point.created_at)}</small></p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('벌점/상점 내역 로드 실패:', error);
        document.getElementById('points-history-container').innerHTML = `
            <div class="empty-state">
                <h3>오류 발생</h3>
                <p>벌점/상점 내역을 불러올 수 없습니다.</p>
            </div>
        `;
    }
}

async function loadViolations() {
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
                    <p>아직 위반 기록이 없습니다.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = violations.map(violation => `
            <div class="leave-request-item">
                <div class="request-header">
                    <span style="font-weight: 600; color: #dc3545;">
                        ${escapeHtml(violation.violation_type)}
                    </span>
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
        document.getElementById('violations-container').innerHTML = `
            <div class="empty-state">
                <h3>오류 발생</h3>
                <p>위반 기록을 불러올 수 없습니다.</p>
            </div>
        `;
    }
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

