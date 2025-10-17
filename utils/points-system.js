/**
 * 포인트 시스템 유틸리티
 * AI 질문을 위한 포인트 관리 시스템
 */

class PointsSystem {
    constructor() {
        // 포인트 보상 설정
        this.pointRewards = {
            QUESTION_POSTED: 3,    // 질문 작성 시 3포인트
            ANSWER_POSTED: 10,     // 답변 작성 시 10포인트
            AI_QUESTION_COST: 50   // AI 질문 비용 50포인트
        };
    }

    /**
     * 포인트 보상 정보 반환
     */
    getPointRewards() {
        return this.pointRewards;
    }

    /**
     * AI 질문 가능 여부 확인
     * @param {number} userPoints - 사용자 포인트
     * @returns {boolean}
     */
    canAskAI(userPoints) {
        return userPoints >= this.pointRewards.AI_QUESTION_COST;
    }

    /**
     * AI 질문 후 남을 포인트 계산
     * @param {number} userPoints - 사용자 포인트
     * @returns {number}
     */
    getPointsAfterAIQuestion(userPoints) {
        return Math.max(0, userPoints - this.pointRewards.AI_QUESTION_COST);
    }

    /**
     * 포인트 상태 메시지 생성
     * @param {number} currentPoints - 현재 포인트
     * @param {number} requiredPoints - 필요 포인트 (기본값: AI_QUESTION_COST)
     * @returns {object}
     */
    getPointsStatus(currentPoints, requiredPoints = null) {
        const required = requiredPoints || this.pointRewards.AI_QUESTION_COST;
        const needed = Math.max(0, required - currentPoints);
        
        return {
            current: currentPoints,
            required: required,
            needed: needed,
            canAskAI: this.canAskAI(currentPoints),
            progress: Math.min(100, (currentPoints / required) * 100)
        };
    }
}

module.exports = new PointsSystem();
