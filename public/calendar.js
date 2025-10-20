class Calendar {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = null;
        this.events = [];
        this.currentEvent = null;
        this.isAdmin = false;
        this.init();
    }

    init() {
        this.checkAuth();
        this.renderCalendar();
        this.loadEvents();
        this.setupEventForm();
    }

    async checkAuth() {
        try {
            // 홈페이지의 인증 시스템 사용
            if (typeof currentUser !== 'undefined' && currentUser) {
                this.isAdmin = currentUser.is_admin === 1;
                this.renderAuthButtons(currentUser);
            } else {
                this.renderLoginButton();
            }
        } catch (error) {
            console.error('인증 확인 오류:', error);
            this.renderLoginButton();
        }
    }

    renderAuthButtons(user) {
        const authContainer = document.getElementById('auth-container');
        authContainer.innerHTML = `
            <div class="user-info">
                <span class="user-name">${user.display_name || user.name}</span>
                <a href="/mypage.html" class="auth-btn">마이페이지</a>
                <button onclick="logout()" class="auth-btn logout">로그아웃</button>
            </div>
        `;
    }

    renderLoginButton() {
        const authContainer = document.getElementById('auth-container');
        authContainer.innerHTML = `
            <a href="/auth/google" class="login-btn">Google로 로그인</a>
        `;
    }

    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // 월 표시 업데이트
        document.getElementById('current-month').textContent = 
            `${year}년 ${month + 1}월`;

        // 캘린더 그리드 생성
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';

        // 요일 헤더
        const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];
        dayHeaders.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = day;
            grid.appendChild(dayHeader);
        });

        // 첫 번째 날과 마지막 날 계산
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        // 42일 (6주) 생성
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = date.getDate();
            
            // 다른 월의 날짜
            if (date.getMonth() !== month) {
                dayElement.classList.add('other-month');
            }
            
            // 오늘 날짜
            const today = new Date();
            if (date.toDateString() === today.toDateString()) {
                dayElement.classList.add('today');
            }
            
            // 선택된 날짜
            if (this.selectedDate && date.toDateString() === this.selectedDate.toDateString()) {
                dayElement.classList.add('selected');
            }
            
            // 이벤트가 있는 날짜
            if (this.hasEventsOnDate(date)) {
                dayElement.classList.add('has-events');
                const eventDot = document.createElement('div');
                eventDot.className = 'event-dot';
                dayElement.appendChild(eventDot);
            }
            
            // 클릭 이벤트
            dayElement.addEventListener('click', () => {
                this.selectDate(date);
            });
            
            grid.appendChild(dayElement);
        }
    }

    hasEventsOnDate(date) {
        return this.events.some(event => {
            const eventDate = new Date(event.date);
            return eventDate.toDateString() === date.toDateString();
        });
    }

    selectDate(date) {
        this.selectedDate = date;
        this.renderCalendar();
        this.showEventsForDate(date);
    }

    showEventsForDate(date) {
        const eventsContainer = document.getElementById('calendar-events');
        const dateString = date.toLocaleDateString('ko-KR');
        
        const eventsOnDate = this.events.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate.toDateString() === date.toDateString();
        });

        let html = `<h3>${dateString} 일정</h3>`;
        
        if (eventsOnDate.length === 0) {
            html += '<p>이 날에는 일정이 없습니다.</p>';
        } else {
            eventsOnDate.forEach(event => {
                html += `
                    <div class="event-item">
                        <div class="event-time">${event.time}</div>
                        <div class="event-title">${event.title}</div>
                        <div class="event-description">${event.description || ''}</div>
                        ${this.isAdmin ? `
                            <div style="margin-top: 10px;">
                                <button class="btn btn-primary" onclick="calendar.editEvent(${event.id})">수정</button>
                                <button class="btn btn-danger" onclick="calendar.deleteEvent(${event.id})">삭제</button>
                            </div>
                        ` : ''}
                    </div>
                `;
            });
        }

        if (this.isAdmin) {
            html += `
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="calendar.addEvent('${date.toISOString().split('T')[0]}')">
                        이 날에 일정 추가
                    </button>
                </div>
            `;
        }

        eventsContainer.innerHTML = html;
    }

    async loadEvents() {
        try {
            const response = await fetch('/api/calendar/events');
            if (response.ok) {
                this.events = await response.json();
                this.renderCalendar();
            }
        } catch (error) {
            console.error('이벤트 로드 오류:', error);
        }
    }

    addEvent(date) {
        this.currentEvent = null;
        document.getElementById('modal-title').textContent = '이벤트 추가';
        document.getElementById('event-date').value = date;
        document.getElementById('event-time').value = '09:00';
        document.getElementById('event-title').value = '';
        document.getElementById('event-description').value = '';
        document.getElementById('delete-btn').style.display = 'none';
        document.getElementById('event-modal').style.display = 'block';
    }

    editEvent(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;

        this.currentEvent = event;
        document.getElementById('modal-title').textContent = '이벤트 수정';
        document.getElementById('event-date').value = event.date;
        document.getElementById('event-time').value = event.time;
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-description').value = event.description || '';
        document.getElementById('delete-btn').style.display = 'inline-block';
        document.getElementById('event-modal').style.display = 'block';
    }

    async deleteEvent(eventId) {
        if (!confirm('정말로 이 이벤트를 삭제하시겠습니까?')) {
            return;
        }

        try {
            const response = await fetch(`/api/calendar/events/${eventId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadEvents();
                this.showEventsForDate(this.selectedDate);
                closeEventModal();
            } else {
                alert('이벤트 삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error('이벤트 삭제 오류:', error);
            alert('이벤트 삭제 중 오류가 발생했습니다.');
        }
    }

    setupEventForm() {
        const form = document.getElementById('event-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                title: document.getElementById('event-title').value,
                date: document.getElementById('event-date').value,
                time: document.getElementById('event-time').value,
                description: document.getElementById('event-description').value
            };

            try {
                let response;
                if (this.currentEvent) {
                    // 수정
                    response = await fetch(`/api/calendar/events/${this.currentEvent.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(formData)
                    });
                } else {
                    // 추가
                    response = await fetch('/api/calendar/events', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(formData)
                    });
                }

                if (response.ok) {
                    await this.loadEvents();
                    this.showEventsForDate(this.selectedDate);
                    closeEventModal();
                } else {
                    alert('이벤트 저장에 실패했습니다.');
                }
            } catch (error) {
                console.error('이벤트 저장 오류:', error);
                alert('이벤트 저장 중 오류가 발생했습니다.');
            }
        });
    }

    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.renderCalendar();
    }

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.renderCalendar();
    }

    goToToday() {
        this.currentDate = new Date();
        this.renderCalendar();
    }
}

// 전역 변수로 캘린더 인스턴스 생성
let calendar;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    calendar = new Calendar();
    
    // 버튼 이벤트 리스너 추가
    document.addEventListener('click', (e) => {
        if (e.target.textContent === '‹') {
            calendar.previousMonth();
        } else if (e.target.textContent === '›') {
            calendar.nextMonth();
        } else if (e.target.textContent === '오늘') {
            calendar.goToToday();
        }
    });
});

// 모달 닫기 함수
function closeEventModal() {
    document.getElementById('event-modal').style.display = 'none';
}

// 로그인 함수
function login() {
    window.location.href = '/auth/google';
}

// 로그아웃 함수
async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('로그아웃 오류:', error);
    }
}
