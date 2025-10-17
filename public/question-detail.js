document.addEventListener('DOMContentLoaded', async () => {
    // script.js에서 이미 currentUser가 설정되어 있는지 확인
    if (typeof currentUser === 'undefined' || !currentUser) {
        // 사용자 정보 로드
        try {
            const response = await fetch('/api/user');
            if (response.ok) {
                currentUser = await response.json();
                console.log('question-detail.js에서 사용자 정보 로드:', currentUser);
            }
        } catch (error) {
            console.error('사용자 정보 로드 실패:', error);
        }
    } else {
        console.log('script.js에서 이미 로드된 사용자 정보 사용:', currentUser);
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const questionId = urlParams.get('id');
    
    if (!questionId) {
        showToast('질문 ID가 없습니다.', 'error');
        setTimeout(() => {
            window.location.href = '/questions.html';
        }, 2000);
        return;
    }
    
    await loadQuestionDetail(questionId);
    setupEventListeners(questionId);
});

async function loadQuestionDetail(questionId) {
    const container = document.getElementById('question-detail-container');
    
    try {
        const response = await fetch('/api/questions');
        const questions = await response.json();
        
        const question = questions.find(q => q.id == questionId);
        
        if (!question) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>질문을 찾을 수 없습니다</h3>
                    <p>존재하지 않는 질문이거나 삭제된 질문입니다.</p>
                    <a href="/questions.html" class="primary-btn" style="display: inline-block; margin-top: 16px;">목록으로 돌아가기</a>
                </div>`;
            return;
        }
        
        container.innerHTML = `
            <div class="question-detail">
                <div class="question-header">
                    <div class="question-title-section">
                        <h1>${escapeHtml(question.title)}</h1>
                        <button class="report-btn" onclick="showReportModal('question', ${question.id}, '${escapeHtml(question.title)}')" title="신고하기">
                            🚨 신고
                        </button>
                    </div>
                    <div class="question-meta">
                        <span>👤 ${escapeHtml(question.author.name)} (Lv.${question.author.level || 1})</span>
                        <span>•</span>
                        <span>📅 ${formatDate(question.created_at)}</span>
                        ${question.images && question.images.length > 0 ? `
                            <span>•</span>
                            <span>📷 이미지 ${question.images.length}개</span>
                        ` : ''}
                    </div>
                </div>
                
                <div class="question-content-full">
                    ${escapeHtml(question.content).replace(/\n/g, '<br>')}
                </div>
                
                ${question.images && question.images.length > 0 ? `
                    <div class="image-gallery">
                        ${question.images.map(img => `<img src="${img}" alt="첨부 이미지" onclick="openImageModal('${img}')">`).join('')}
                    </div>
                ` : ''}
                
                <div class="question-actions">
                    ${isMyQuestion(question) ? `
                        <button class="action-btn" onclick="editQuestion(${question.id})">수정</button>
                        <button class="action-btn danger" onclick="deleteQuestion(${question.id})">삭제</button>
                    ` : ''}
                    ${currentUser && ['moderator', 'admin', 'super_admin'].includes(currentUser.role) ? `
                        <button class="action-btn danger" onclick="hideQuestion(${question.id})">숨기기</button>
                    ` : ''}
                </div>
            </div>
            
            <div class="answers-section">
                <div class="section-header">
                    <h2>답변 (${question.answers.length}개)</h2>
                </div>
                
                <div class="answers-list">
                    ${question.answers.length === 0 ? `
                        <div class="empty-state">
                            <h3>아직 답변이 없습니다</h3>
                            <p>첫 번째 답변을 작성해보세요!</p>
                        </div>
                    ` : question.answers.map(answer => `
                        <div class="answer-item">
                            <div class="answer-header">
                                <span class="answer-author">👤 ${escapeHtml(answer.author.name)} (Lv.${answer.author.level || 1})</span>
                                <div class="answer-header-right">
                                    <span class="answer-date">${formatDate(answer.created_at)}</span>
                                    <button class="report-btn" onclick="showReportModal('answer', ${answer.id}, '${escapeHtml(answer.content.substring(0, 50))}...')" title="신고하기">
                                        🚨 신고
                                    </button>
                                </div>
                            </div>
                            <div class="answer-content">
                                ${escapeHtml(answer.content).replace(/\n/g, '<br>')}
                            </div>
                            ${answer.images && answer.images.length > 0 ? `
                                <div class="image-gallery">
                                    ${answer.images.map(img => `<img src="${img}" alt="첨부 이미지" onclick="openImageModal('${img}')">`).join('')}
                                </div>
                            ` : ''}
                            ${isMyAnswer(answer) ? `
                                <div class="answer-actions">
                                    <button class="action-btn" onclick="editAnswer(${answer.id}, ${question.id})">수정</button>
                                    <button class="action-btn danger" onclick="deleteAnswer(${answer.id})">삭제</button>
                                </div>
                            ` : ''}
                            ${currentUser && ['moderator', 'admin', 'super_admin'].includes(currentUser.role) ? `
                                <div class="answer-actions">
                                    <button class="action-btn danger" onclick="hideAnswer(${answer.id})">숨기기</button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
                
                <div class="answer-form-section">
                    <h3>답변 작성</h3>
                    <div class="answer-form">
                        <textarea id="answer-content" placeholder="이 질문에 대한 답변을 작성해주세요..." rows="6"></textarea>
                        <div class="form-actions">
                            <button id="submit-answer-btn" class="primary-btn" data-question-id="${question.id}">답변 등록</button>
                        </div>
                    </div>
                </div>
            </div>`;
        
        // 이미지 모달 설정
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
        
    } catch (error) {
        console.error('질문 상세 로드 실패:', error);
        container.innerHTML = `
            <div class="empty-state">
                <h3>질문을 불러올 수 없습니다</h3>
                <p>잠시 후 다시 시도해주세요.</p>
                <a href="/questions.html" class="primary-btn" style="display: inline-block; margin-top: 16px;">목록으로 돌아가기</a>
            </div>`;
    }
}

function setupEventListeners(questionId) {
    // 새로고침 버튼
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadQuestionDetail(questionId);
            showToast('질문을 새로고침했습니다.', 'success');
        });
    }
    
    // 답변 등록 버튼
    const submitBtn = document.getElementById('submit-answer-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitAnswer);
    }
}

let isSubmittingAnswer = false; // 답변 중복 제출 방지 플래그

async function submitAnswer(event) {
    // 이미 제출 중이면 무시
    if (isSubmittingAnswer) {
        console.log('이미 답변 제출 중입니다. 중복 제출 방지');
        return;
    }
    
    const button = event.target;
    const questionId = button.dataset.questionId;
    const content = document.getElementById('answer-content').value.trim();
    
    console.log('답변 등록 시도:', { questionId, content, currentUser });
    
    if (!content) {
        showToast('답변 내용을 입력해주세요.', 'error');
        return;
    }
    
    if (!currentUser) {
        showToast('로그인이 필요합니다.', 'error');
        window.location.href = '/';
        return;
    }
    
    // 제출 시작
    isSubmittingAnswer = true;
    button.classList.add('loading');
    button.disabled = true;
    button.textContent = '등록 중...';
    
    try {
        const response = await fetch(`/api/questions/${questionId}/answers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        if (response.ok) {
            showToast('답변이 등록되었습니다! +10 포인트 획득!', 'success');
            document.getElementById('answer-content').value = '';
            
            // 레벨업 체크
            setTimeout(async () => {
                await checkLevelUp();
            }, 1000);
            
            await loadQuestionDetail(questionId);
        } else if (response.status === 429) {
            showToast('잠시 후 다시 시도해주세요.', 'warning');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || '답변 등록에 실패했습니다.');
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        // 제출 완료 후 플래그 해제
        isSubmittingAnswer = false;
        button.classList.remove('loading');
        button.disabled = false;
        button.textContent = '답변 등록';
    }
}

function isMyQuestion(question) {
    return question.author && currentUser && question.author.id === currentUser.id;
}

function isMyAnswer(answer) {
    return answer.author && currentUser && answer.author.id === currentUser.id;
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

// 레벨업 체크 함수
async function checkLevelUp() {
    try {
        const response = await fetch('/api/user/level');
        if (response.ok) {
            const levelInfo = await response.json();
            
            if (currentUser && currentUser.levelInfo) {
                const oldLevel = currentUser.levelInfo.level;
                const newLevel = levelInfo.level;
                
                if (newLevel > oldLevel) {
                    showLevelUpModal(newLevel, levelInfo.title, `Level ${newLevel} 달성!`);
                }
            }
        }
    } catch (error) {
        console.error('레벨업 체크 실패:', error);
    }
}

// 레벨업 모달 표시 함수
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
    
    setTimeout(() => {
        if (modal.parentNode) {
            modal.remove();
        }
    }, 5000);
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
