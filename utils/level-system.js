/**
 * 레벨업 시스템 유틸리티
 * - EXP 계산 및 레벨업 로직
 * - 레벨별 필요 EXP 계산
 */

class LevelSystem {
    /**
     * 레벨별 필요 EXP 계산
     * 레벨이 올라갈수록 필요한 EXP가 증가하는 공식
     * Level 1: 100 EXP
     * Level 2: 250 EXP (150 추가)
     * Level 3: 450 EXP (200 추가)
     * Level 4: 700 EXP (250 추가)
     * Level 5: 1000 EXP (300 추가)
     * ...
     * 공식: level * 50 + (level - 1) * 50 + 100
     * 간소화: level * 100 + (level - 1) * 50
     */
    static getRequiredExp(level) {
        if (level <= 1) return 0;
        return level * 100 + (level - 1) * 50;
    }

    /**
     * 현재 레벨에서 다음 레벨까지 필요한 EXP
     */
    static getExpToNextLevel(currentLevel, currentExp) {
        const nextLevelExp = this.getRequiredExp(currentLevel + 1);
        return Math.max(0, nextLevelExp - currentExp);
    }

    /**
     * EXP 추가 후 레벨업 처리
     * @param {number} currentLevel - 현재 레벨
     * @param {number} currentExp - 현재 EXP
     * @param {number} expToAdd - 추가할 EXP
     * @returns {Object} { newLevel, newExp, leveledUp, levelsGained }
     */
    static addExperience(currentLevel, currentExp, expToAdd) {
        let newExp = currentExp + expToAdd;
        let newLevel = currentLevel;
        let leveledUp = false;
        let levelsGained = 0;

        // 레벨업 체크
        while (newExp >= this.getRequiredExp(newLevel + 1)) {
            newLevel++;
            leveledUp = true;
            levelsGained++;
        }

        return {
            newLevel,
            newExp,
            leveledUp,
            levelsGained
        };
    }

    /**
     * 레벨별 칭호 반환
     */
    static getLevelTitle(level) {
        if (level >= 50) return '전설의 지식인';
        if (level >= 40) return '지식의 대가';
        if (level >= 30) return '지혜로운 멘토';
        if (level >= 25) return '경험 많은';
        if (level >= 20) return '전문가';
        if (level >= 15) return '숙련자';
        if (level >= 10) return '열정적인';
        if (level >= 5) return '중급자';
        if (level >= 3) return '입문자';
        return '새로운 멤버';
    }

    /**
     * 레벨별 색상 반환
     */
    static getLevelColor(level) {
        if (level >= 50) return '#FFD700'; // 금색
        if (level >= 40) return '#C0C0C0'; // 은색
        if (level >= 30) return '#CD7F32'; // 동색
        if (level >= 20) return '#8A2BE2'; // 보라색
        if (level >= 15) return '#FF4500'; // 주황색
        if (level >= 10) return '#32CD32'; // 초록색
        if (level >= 5) return '#1E90FF'; // 파란색
        return '#808080'; // 회색
    }

    /**
     * EXP 보상 계산
     */
    static getExpRewards() {
        return {
            QUESTION_POSTED: 20,      // 질문 작성
            ANSWER_POSTED: 30,        // 답변 작성
            FIRST_ANSWER: 10,         // 첫 답변 보너스
            HELPFUL_ANSWER: 15,       // 도움이 된 답변
            DAILY_LOGIN: 5,           // 일일 로그인
            WEEKLY_ACTIVE: 25,        // 주간 활동 보너스
        };
    }

    /**
     * 레벨업 알림 메시지 생성
     */
    static getLevelUpMessage(level, levelsGained) {
        const title = this.getLevelTitle(level);
        if (levelsGained === 1) {
            return `🎉 레벨업! Level ${level} 달성! "${title}" 칭호를 획득했습니다!`;
        } else {
            return `🎉 대단해요! Level ${level} 달성! "${title}" 칭호를 획득했습니다!`;
        }
    }

    /**
     * 진행률 계산 (0-100)
     */
    static getProgressPercentage(currentLevel, currentExp) {
        const currentLevelExp = this.getRequiredExp(currentLevel);
        const nextLevelExp = this.getRequiredExp(currentLevel + 1);
        const progress = currentExp - currentLevelExp;
        const total = nextLevelExp - currentLevelExp;
        
        return Math.round((progress / total) * 100);
    }
}

module.exports = LevelSystem;
