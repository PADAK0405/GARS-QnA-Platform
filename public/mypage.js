document.addEventListener('DOMContentLoaded', async () => {
    console.log('마이페이지 로딩 시작...');
    try {
        await loadMyPage();
        setupTabs();
        setupEventListeners();
        console.log('마이페이지 로딩 완료');
    } catch (error) {
        console.error('마이페이지 로딩 실패:', error);
        alert('마이페이지를 로드할 수 없습니다.');
    }
});

async function loadMyPage() {
    try {
        // 사용자 정보 로드
        const userResponse = await fetch('/api/user');
        if (!userResponse.ok) {
            throw new Error('로그인이 필요합니다.');
        }
        const user = await userResponse.json();
        
        // 전역 currentUser 설정 (script.js에서 이미 선언됨)
        if (typeof currentUser !== 'undefined') {
            currentUser = user;
        }
        console.log('마이페이지 사용자 정보:', user);
        
        // 프로필 정보 업데이트
        updateProfile(user);
        
        // 내 질문과 답변 로드
        await Promise.all([
            loadMyQuestions(user.id),
            loadMyAnswers(user.id)
        ]);
        
    } catch (error) {
        console.error('마이페이지 로드 실패:', error);
        showToast('마이페이지를 불러오는데 실패했습니다.', 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }
}

function updateProfile(user) {
    document.getElementById('user-name').textContent = user.displayName;
    document.getElementById('user-email').textContent = user.email || '이메일 없음';
    document.getElementById('user-score').textContent = user.score || 0;
    document.getElementById('user-initial').textContent = user.displayName.charAt(0).toUpperCase();
    
    // 포인트 정보 업데이트
    if (user.levelInfo && user.levelInfo.points) {
        document.getElementById('user-points').textContent = user.levelInfo.points.current || 0;
    } else {
        document.getElementById('user-points').textContent = 0;
    }
    
    // 레벨 정보 업데이트
    if (user.levelInfo) {
        const levelInfo = user.levelInfo;
        document.getElementById('level-badge').textContent = `Lv.${levelInfo.level}`;
        document.getElementById('level-title').textContent = levelInfo.title;
        document.getElementById('level-title').style.background = `linear-gradient(135deg, ${levelInfo.color}, ${levelInfo.color}CC)`;
        
        // EXP 정보 업데이트
        document.getElementById('exp-current').textContent = levelInfo.experience;
        document.getElementById('exp-next').textContent = levelInfo.experience + levelInfo.expToNext;
        document.getElementById('exp-to-next').textContent = `다음 레벨까지 ${levelInfo.expToNext} EXP`;
        document.getElementById('progress-fill').style.width = `${levelInfo.progress}%`;
    } else {
        // 기본값 설정
        document.getElementById('level-badge').textContent = 'Lv.1';
        document.getElementById('level-title').textContent = '새로운 멤버';
        document.getElementById('exp-current').textContent = user.experience || 0;
        document.getElementById('exp-next').textContent = 100;
        document.getElementById('exp-to-next').textContent = '다음 레벨까지 100 EXP';
        document.getElementById('progress-fill').style.width = '0%';
    }
    
    // 상태메시지 업데이트
    const statusText = document.getElementById('status-text');
    if (user.statusMessage) {
        statusText.textContent = user.statusMessage;
    } else {
        statusText.textContent = '상태메시지를 설정해보세요!';
    }
}

async function loadMyQuestions(userId) {
    try {
        const response = await fetch('/api/questions');
        const allQuestions = await response.json();
        
        // 내 질문만 필터링
        const myQuestions = allQuestions.filter(q => q.author.id === userId);
        
        // 질문 개수 업데이트
        document.getElementById('question-count').textContent = myQuestions.length;
        document.getElementById('questions-count').textContent = `${myQuestions.length}개`;
        
        // 질문 목록 렌더링
        const container = document.getElementById('my-questions-container');
        
        if (myQuestions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>아직 질문이 없습니다</h3>
                    <p>첫 번째 질문을 올려보세요!</p>
                    <a href="/ask.html" class="primary-btn" style="display: inline-block; margin-top: 16px;">질문하기</a>
                </div>`;
            return;
        }
        
        container.innerHTML = myQuestions.map(q => `
            <div class="my-question-card">
                <h4>${escapeHtml(q.title)}</h4>
                <div class="content">${escapeHtml(q.content).replace(/\n/g, '<br>')}</div>
                <div class="meta">
                    <span>💬 답변 ${q.answers.length}개</span>
                    <span>📷 이미지 ${q.images ? q.images.length : 0}개</span>
                    <span>📅 ${formatDate(q.created_at)}</span>
                </div>
                <div class="actions">
                    <button class="action-btn" onclick="viewQuestion(${q.id})">보기</button>
                    <button class="action-btn" onclick="editQuestion(${q.id})">수정</button>
                    <button class="action-btn danger" onclick="deleteQuestion(${q.id})">삭제</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('내 질문 로드 실패:', error);
        document.getElementById('my-questions-container').innerHTML = `
            <div class="empty-state">
                <h3>질문을 불러올 수 없습니다</h3>
                <p>잠시 후 다시 시도해주세요.</p>
            </div>`;
    }
}

async function loadMyAnswers(userId) {
    try {
        const response = await fetch('/api/questions');
        const allQuestions = await response.json();
        
        // 내 답변만 필터링
        const myAnswers = [];
        allQuestions.forEach(question => {
            question.answers.forEach(answer => {
                if (answer.author.id === userId) {
                    myAnswers.push({
                        ...answer,
                        questionTitle: question.title,
                        questionId: question.id
                    });
                }
            });
        });
        
        // 답변 개수 업데이트
        document.getElementById('answer-count').textContent = myAnswers.length;
        document.getElementById('answers-count').textContent = `${myAnswers.length}개`;
        
        // 답변 목록 렌더링
        const container = document.getElementById('my-answers-container');
        
        if (myAnswers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>아직 답변이 없습니다</h3>
                    <p>질문에 답변을 작성해보세요!</p>
                    <a href="/questions.html" class="primary-btn" style="display: inline-block; margin-top: 16px;">질문 보기</a>
                </div>`;
            return;
        }
        
        container.innerHTML = myAnswers.map(answer => `
            <div class="my-answer-card">
                <h4>질문: ${escapeHtml(answer.questionTitle)}</h4>
                <div class="content">${escapeHtml(answer.content).replace(/\n/g, '<br>')}</div>
                <div class="meta">
                    <span>📷 이미지 ${answer.images ? answer.images.length : 0}개</span>
                    <span>📅 ${formatDate(answer.created_at)}</span>
                </div>
                <div class="actions">
                    <button class="action-btn" onclick="viewQuestion(${answer.questionId})">질문 보기</button>
                    <button class="action-btn" onclick="editAnswer(${answer.id}, ${answer.questionId})">수정</button>
                    <button class="action-btn danger" onclick="deleteAnswer(${answer.id})">삭제</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('내 답변 로드 실패:', error);
        document.getElementById('my-answers-container').innerHTML = `
            <div class="empty-state">
                <h3>답변을 불러올 수 없습니다</h3>
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
        });
    });
}

function setupEventListeners() {
    // 새로고침 버튼
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadMyPage();
            showToast('마이페이지를 새로고침했습니다.', 'success');
        });
    }
    
    // 프로필 수정 버튼
    const editProfileBtn = document.getElementById('edit-profile-btn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', showEditProfileModal);
    }
}

function showEditProfileModal() {
    const user = currentUser;
    console.log('프로필 수정 버튼 클릭, currentUser:', user);
    if (!user) {
        console.error('currentUser가 설정되지 않았습니다.');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>프로필 수정</h3>
                <button class="close-modal" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>닉네임</label>
                    <input type="text" id="edit-display-name" value="${escapeHtml(user.displayName)}" maxlength="20">
                    <small style="color: var(--text-muted); font-size: 0.8rem;">최대 20자까지 입력 가능합니다.</small>
                </div>
                <div class="form-group">
                    <label>상태메시지</label>
                    <textarea id="edit-status-message" maxlength="200" placeholder="나를 소개하는 한 줄을 작성해보세요!">${escapeHtml(user.statusMessage || '')}</textarea>
                    <small style="color: var(--text-muted); font-size: 0.8rem;">최대 200자까지 입력 가능합니다.</small>
                </div>
                <div class="form-group">
                    <label>이메일</label>
                    <input type="email" id="edit-email" value="${escapeHtml(user.email || '')}" readonly style="background: #f5f5f5;">
                    <small style="color: var(--text-muted); font-size: 0.8rem;">이메일은 Google 계정에서만 변경 가능합니다.</small>
                </div>
            </div>
            <div class="modal-footer">
                <button class="secondary-btn" onclick="this.closest('.modal-overlay').remove()">취소</button>
                <button class="primary-btn" onclick="saveProfileEdit()">저장</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function saveProfileEdit() {
    const newDisplayName = document.getElementById('edit-display-name').value.trim();
    const newStatusMessage = document.getElementById('edit-status-message').value.trim();
    
    if (!newDisplayName) {
        showToast('닉네임을 입력해주세요.', 'error');
        return;
    }
    
    if (newDisplayName.length > 20) {
        showToast('닉네임은 20자 이하로 입력해주세요.', 'error');
        return;
    }
    
    if (newStatusMessage.length > 200) {
        showToast('상태메시지는 200자 이하로 입력해주세요.', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                displayName: newDisplayName,
                statusMessage: newStatusMessage || null
            })
        });
        
        if (response.ok) {
            showToast('프로필이 수정되었습니다.', 'success');
            document.querySelector('.modal-overlay').remove();
            
            // 현재 사용자 정보 업데이트
            currentUser.displayName = newDisplayName;
            currentUser.statusMessage = newStatusMessage || null;
            updateProfile(currentUser);
            
            // 네비게이션 업데이트
            await updateUserStatus();
        } else {
            throw new Error('프로필 수정 실패');
        }
    } catch (error) {
        showToast('프로필 수정에 실패했습니다.', 'error');
    }
}

function viewQuestion(questionId) {
    window.location.href = `/question-detail.html?id=${questionId}`;
}

async function editAnswer(answerId, questionId) {
    try {
        const response = await fetch(`/api/answers/${answerId}`);
        if (!response.ok) throw new Error('답변을 불러올 수 없습니다.');
        
        const answer = await response.json();
        showEditAnswerModal(answer, questionId);
    } catch (error) {
        showToast('답변을 불러오는데 실패했습니다.', 'error');
    }
}

function showEditAnswerModal(answer, questionId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>답변 수정</h3>
                <button class="close-modal" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>답변 내용</label>
                    <textarea id="edit-answer-content" rows="8">${escapeHtml(answer.content)}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="secondary-btn" onclick="this.closest('.modal-overlay').remove()">취소</button>
                <button class="primary-btn" onclick="saveAnswerEdit(${answer.id})">저장</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function saveAnswerEdit(answerId) {
    const content = document.getElementById('edit-answer-content').value.trim();
    
    if (!content) {
        showToast('답변 내용을 입력해주세요.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/answers/${answerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        if (response.ok) {
            showToast('답변이 수정되었습니다.', 'success');
            document.querySelector('.modal-overlay').remove();
            loadMyPage(); // 페이지 새로고침
        } else {
            throw new Error('답변 수정 실패');
        }
    } catch (error) {
        showToast('답변 수정에 실패했습니다.', 'error');
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
            loadMyPage(); // 페이지 새로고침
        } else {
            throw new Error('답변 삭제 실패');
        }
    } catch (error) {
        showToast('답변 삭제에 실패했습니다.', 'error');
    }
}

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
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '오늘';
    if (diffDays === 2) return '어제';
    if (diffDays <= 7) return `${diffDays - 1}일 전`;
    if (diffDays <= 30) return `${Math.ceil(diffDays / 7)}주 전`;
    return date.toLocaleDateString('ko-KR');
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

function showLevelUpModal(level, title, message) {
    const modal = document.createElement('div');
    modal.className = 'level-up-modal';
    modal.innerHTML = `
        <div class="level-up-content">
            <div class="level-up-icon">🎉</div>
            <h2 class="level-up-title">레벨업!</h2>
            <div class="level-up-badge">Level ${level}</div>
            <p class="level-up-message">${message}</p>
            <p class="level-up-message">새로운 칭호: <strong>"${title}"</strong></p>
            <button class="primary-btn" onclick="this.closest('.level-up-modal').remove()">확인</button>
        </div>
    `;
    document.body.appendChild(modal);
    
    // 5초 후 자동으로 닫기
    setTimeout(() => {
        if (modal.parentNode) {
            modal.remove();
        }
    }, 5000);
}

// 레벨업 체크 함수 (질문/답변 작성 후 호출)
async function checkLevelUp() {
    try {
        const response = await fetch('/api/user/level');
        if (response.ok) {
            const levelInfo = await response.json();
            
            // 현재 사용자 정보와 비교하여 레벨업 확인
            if (currentUser && currentUser.levelInfo) {
                const oldLevel = currentUser.levelInfo.level;
                const newLevel = levelInfo.level;
                
                if (newLevel > oldLevel) {
                    showLevelUpModal(newLevel, levelInfo.title, `Level ${newLevel} 달성!`);
                    
                    // 현재 사용자 정보 업데이트
                    currentUser.levelInfo = levelInfo;
                    updateProfile(currentUser);
                }
            }
        }
    } catch (error) {
        console.error('레벨업 체크 실패:', error);
    }
}
