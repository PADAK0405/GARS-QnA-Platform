/**
 * 캘린더 클래스
 * 일정 관리 및 캘린더 렌더링을 담당하는 메인 클래스
 */
class Calendar {
    /**
     * 캘린더 인스턴스 생성자
     * 초기 상태를 설정하고 캘린더를 초기화합니다.
     */
    constructor() {
        // 현재 표시할 날짜 (기본값: 오늘)
        this.currentDate = new Date();
        
        // 사용자가 선택한 날짜 (null이면 선택되지 않음)
        this.selectedDate = null;
        
        // 로드된 이벤트 목록
        this.events = [];
        
        // 현재 편집 중인 이벤트 (null이면 새 이벤트)
        this.currentEvent = null;
        
        // 현재 사용자가 관리자인지 여부
        this.isAdmin = false;
        
        // 캘린더 초기화 실행
        this.init();
    }

    /**
     * 캘린더 초기화 메서드
     * 인증 확인, 캘린더 렌더링, 이벤트 로드, 폼 설정을 순차적으로 실행합니다.
     */
    init() {
        this.checkAdminStatus();
        this.renderCalendar();
        this.loadEvents();
        this.setupEventForm();
    }

    /**
     * 관리자 권한 확인
     * 전역 currentUser 변수에서 관리자 권한을 확인합니다.
     */
    checkAdminStatus() {
        try {
            // 홈페이지의 전역 currentUser 변수 확인
            if (typeof currentUser !== 'undefined' && currentUser) {
                // 관리자 권한 확인 (1이면 관리자)
                this.isAdmin = currentUser.is_admin === 1;
            } else {
                this.isAdmin = false;
            }
        } catch (error) {
            console.error('관리자 권한 확인 오류:', error);
            this.isAdmin = false;
        }
    }

    /**
     * 캘린더 렌더링
     * 현재 월의 캘린더를 그리드 형태로 렌더링합니다.
     * 6주(42일)를 표시하여 이전/다음 달의 일부 날짜도 포함합니다.
     */
    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // 월 표시 업데이트
        const monthElement = document.getElementById('current-month');
        if (monthElement) {
            monthElement.textContent = `${year}년 ${month + 1}월`;
        }

        // 캘린더 그리드 컨테이너
        const grid = document.getElementById('calendar-grid');
        if (!grid) {
            console.error('calendar-grid 요소를 찾을 수 없습니다.');
            return;
        }
        
        // 기존 내용 초기화
        grid.innerHTML = '';

        // 요일 헤더 생성 (일요일부터 토요일까지)
        const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];
        dayHeaders.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = day;
            grid.appendChild(dayHeader);
        });

        // 캘린더 날짜 계산
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        // 42일 (6주) 생성
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayElement = this.createDayElement(date, month);
            grid.appendChild(dayElement);
        }
    }

    /**
     * 개별 날짜 요소 생성
     * @param {Date} date - 생성할 날짜
     * @param {number} currentMonth - 현재 월
     * @returns {HTMLElement} 생성된 날짜 요소
     */
    createDayElement(date, currentMonth) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = date.getDate();
        
        // 다른 월의 날짜 스타일 적용
        if (date.getMonth() !== currentMonth) {
            dayElement.classList.add('other-month');
        }
        
        // 오늘 날짜 하이라이트
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            dayElement.classList.add('today');
        }
        
        // 선택된 날짜 하이라이트
        if (this.selectedDate && date.toDateString() === this.selectedDate.toDateString()) {
            dayElement.classList.add('selected');
        }
        
        // 이벤트가 있는 날짜 표시
        if (this.hasEventsOnDate(date)) {
            dayElement.classList.add('has-events');
            const eventDot = document.createElement('div');
            eventDot.className = 'event-dot';
            dayElement.appendChild(eventDot);
        }
        
        // 클릭 이벤트 리스너 추가
        dayElement.addEventListener('click', () => {
            this.selectDate(date);
        });
        
        return dayElement;
    }

    /**
     * 특정 날짜에 이벤트가 있는지 확인
     * @param {Date} date - 확인할 날짜
     * @returns {boolean} 이벤트 존재 여부
     */
    hasEventsOnDate(date) {
        return this.events.some(event => {
            const eventDate = new Date(event.date);
            return eventDate.toDateString() === date.toDateString();
        });
    }

    /**
     * 날짜 선택 처리
     * 선택된 날짜를 저장하고 캘린더를 다시 렌더링한 후 해당 날짜의 이벤트를 표시합니다.
     * @param {Date} date - 선택된 날짜
     */
    selectDate(date) {
        this.selectedDate = date;
        this.renderCalendar();
        this.showEventsForDate(date);
    }

    /**
     * 선택된 날짜의 이벤트 표시
     * 해당 날짜의 모든 이벤트를 사이드바에 표시합니다.
     * @param {Date} date - 표시할 날짜
     */
    showEventsForDate(date) {
        const eventsContainer = document.getElementById('calendar-events');
        if (!eventsContainer) {
            console.error('calendar-events 요소를 찾을 수 없습니다.');
            return;
        }
        
        const dateString = date.toLocaleDateString('ko-KR');
        
        // 해당 날짜의 이벤트 필터링
        const eventsOnDate = this.events.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate.toDateString() === date.toDateString();
        });

        let html = `<h3>${dateString} 일정</h3>`;
        
        if (eventsOnDate.length === 0) {
            html += '<p>이 날에는 일정이 없습니다.</p>';
        } else {
            // 이벤트 목록 렌더링
            eventsOnDate.forEach(event => {
                html += this.createEventHTML(event);
            });
        }

        // 관리자인 경우 이벤트 추가 버튼 표시
        if (this.isAdmin) {
            html += this.createAddEventButton(date);
        }

        eventsContainer.innerHTML = html;
    }

    /**
     * 개별 이벤트 HTML 생성
     * @param {Object} event - 이벤트 객체
     * @returns {string} 이벤트 HTML 문자열
     */
    createEventHTML(event) {
        const adminControls = this.isAdmin ? `
            <div style="margin-top: 10px;">
                <button class="btn btn-primary" onclick="calendar.editEvent(${event.id})">수정</button>
                <button class="btn btn-danger" onclick="calendar.deleteEvent(${event.id})">삭제</button>
            </div>
        ` : '';
        
        return `
            <div class="event-item">
                <div class="event-time">${event.time}</div>
                <div class="event-title">${this.escapeHtml(event.title)}</div>
                <div class="event-description">${this.escapeHtml(event.description || '')}</div>
                ${adminControls}
            </div>
        `;
    }

    /**
     * 이벤트 추가 버튼 HTML 생성
     * @param {Date} date - 이벤트를 추가할 날짜
     * @returns {string} 버튼 HTML 문자열
     */
    createAddEventButton(date) {
        const dateString = date.toISOString().split('T')[0];
        return `
            <div style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="calendar.addEvent('${dateString}')">
                    이 날에 일정 추가
                </button>
            </div>
        `;
    }

    /**
     * HTML 이스케이프 처리
     * XSS 공격을 방지하기 위해 HTML 특수문자를 이스케이프합니다.
     * @param {string} text - 이스케이프할 텍스트
     * @returns {string} 이스케이프된 텍스트
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 서버에서 이벤트 목록 로드
     * API를 통해 모든 이벤트를 가져와서 캘린더를 다시 렌더링합니다.
     * @async
     */
    async loadEvents() {
        try {
            const response = await fetch('/api/calendar/events');
            if (response.ok) {
                this.events = await response.json();
                this.renderCalendar();
            } else {
                console.error('이벤트 로드 실패:', response.status);
            }
        } catch (error) {
            console.error('이벤트 로드 오류:', error);
        }
    }

    /**
     * 새 이벤트 추가 모달 열기
     * @param {string} date - 이벤트 날짜 (YYYY-MM-DD 형식)
     */
    addEvent(date) {
        this.currentEvent = null;
        
        // 모달 제목 설정
        const titleElement = document.getElementById('modal-title');
        if (titleElement) titleElement.textContent = '이벤트 추가';
        
        // 폼 필드 초기화
        this.setFormValues({
            date: date,
            time: '09:00',
            title: '',
            description: ''
        });
        
        // 삭제 버튼 숨기기
        const deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn) deleteBtn.style.display = 'none';
        
        // 모달 표시
        const modal = document.getElementById('event-modal');
        if (modal) modal.style.display = 'block';
    }

    /**
     * 이벤트 수정 모달 열기
     * @param {number} eventId - 수정할 이벤트 ID
     */
    editEvent(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) {
            console.error('이벤트를 찾을 수 없습니다:', eventId);
            return;
        }

        this.currentEvent = event;
        
        // 모달 제목 설정
        const titleElement = document.getElementById('modal-title');
        if (titleElement) titleElement.textContent = '이벤트 수정';
        
        // 폼 필드에 기존 값 설정
        this.setFormValues({
            date: event.date,
            time: event.time,
            title: event.title,
            description: event.description || ''
        });
        
        // 삭제 버튼 표시
        const deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
        
        // 모달 표시
        const modal = document.getElementById('event-modal');
        if (modal) modal.style.display = 'block';
    }

    /**
     * 폼 필드 값 설정
     * @param {Object} values - 설정할 값들
     */
    setFormValues(values) {
        const fields = ['event-date', 'event-time', 'event-title', 'event-description'];
        const valueKeys = ['date', 'time', 'title', 'description'];
        
        fields.forEach((fieldId, index) => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.value = values[valueKeys[index]] || '';
            }
        });
    }

    /**
     * 이벤트 삭제
     * 사용자 확인 후 서버에서 이벤트를 삭제합니다.
     * @param {number} eventId - 삭제할 이벤트 ID
     * @async
     */
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
                if (this.selectedDate) {
                    this.showEventsForDate(this.selectedDate);
                }
                closeEventModal();
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert(`이벤트 삭제에 실패했습니다: ${errorData.message || '알 수 없는 오류'}`);
            }
        } catch (error) {
            console.error('이벤트 삭제 오류:', error);
            alert('이벤트 삭제 중 오류가 발생했습니다.');
        }
    }

    /**
     * 이벤트 폼 설정
     * 폼 제출 이벤트 리스너를 등록하고 유효성 검사를 수행합니다.
     */
    setupEventForm() {
        const form = document.getElementById('event-form');
        if (!form) {
            console.error('event-form 요소를 찾을 수 없습니다.');
            return;
        }
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 폼 데이터 수집
            const formData = this.getFormData();
            
            // 유효성 검사
            if (!this.validateFormData(formData)) {
                return;
            }

            try {
                const response = await this.submitEvent(formData);
                
                if (response.ok) {
                    await this.loadEvents();
                    if (this.selectedDate) {
                        this.showEventsForDate(this.selectedDate);
                    }
                    closeEventModal();
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    alert(`이벤트 저장에 실패했습니다: ${errorData.message || '알 수 없는 오류'}`);
                }
            } catch (error) {
                console.error('이벤트 저장 오류:', error);
                alert('이벤트 저장 중 오류가 발생했습니다.');
            }
        });
    }

    /**
     * 폼 데이터 수집
     * @returns {Object} 폼에서 수집한 데이터
     */
    getFormData() {
        return {
            title: document.getElementById('event-title')?.value || '',
            date: document.getElementById('event-date')?.value || '',
            time: document.getElementById('event-time')?.value || '',
            description: document.getElementById('event-description')?.value || ''
        };
    }

    /**
     * 폼 데이터 유효성 검사
     * @param {Object} formData - 검사할 폼 데이터
     * @returns {boolean} 유효성 검사 통과 여부
     */
    validateFormData(formData) {
        if (!formData.title.trim()) {
            alert('제목을 입력해주세요.');
            return false;
        }
        
        if (!formData.date) {
            alert('날짜를 선택해주세요.');
            return false;
        }
        
        if (!formData.time) {
            alert('시간을 입력해주세요.');
            return false;
        }
        
        return true;
    }

    /**
     * 이벤트 서버 제출
     * @param {Object} formData - 제출할 폼 데이터
     * @returns {Promise<Response>} 서버 응답
     */
    async submitEvent(formData) {
        const url = this.currentEvent 
            ? `/api/calendar/events/${this.currentEvent.id}`
            : '/api/calendar/events';
        
        const method = this.currentEvent ? 'PUT' : 'POST';
        
        return await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
    }

    /**
     * 이전 달로 이동
     * 현재 표시 중인 달에서 한 달 전으로 이동합니다.
     */
    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.renderCalendar();
    }

    /**
     * 다음 달로 이동
     * 현재 표시 중인 달에서 한 달 후로 이동합니다.
     */
    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.renderCalendar();
    }

    /**
     * 오늘 날짜로 이동
     * 현재 날짜로 캘린더를 이동시킵니다.
     */
    goToToday() {
        this.currentDate = new Date();
        this.renderCalendar();
    }
}

// ===== 전역 변수 및 초기화 =====

/**
 * 전역 캘린더 인스턴스
 * 페이지 전체에서 사용할 캘린더 객체
 */
let calendar;

/**
 * 페이지 로드 시 초기화
 * DOM이 완전히 로드된 후 캘린더를 초기화하고 이벤트 리스너를 등록합니다.
 */
document.addEventListener('DOMContentLoaded', () => {
    try {
        // 캘린더 인스턴스 생성
        calendar = new Calendar();
        
        // 네비게이션 버튼 이벤트 리스너 등록
        setupNavigationListeners();
    } catch (error) {
        console.error('캘린더 초기화 오류:', error);
    }
});

/**
 * 네비게이션 버튼 이벤트 리스너 설정
 * 캘린더 네비게이션 버튼들의 클릭 이벤트를 처리합니다.
 */
function setupNavigationListeners() {
    document.addEventListener('click', (e) => {
        // 이전 달 버튼
        if (e.target.textContent === '‹') {
            calendar?.previousMonth();
        } 
        // 다음 달 버튼
        else if (e.target.textContent === '›') {
            calendar?.nextMonth();
        } 
        // 오늘 버튼
        else if (e.target.textContent === '오늘') {
            calendar?.goToToday();
        }
    });
}

// ===== 전역 유틸리티 함수 =====

/**
 * 이벤트 모달 닫기
 * 이벤트 추가/수정 모달을 닫습니다.
 */
function closeEventModal() {
    const modal = document.getElementById('event-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}
