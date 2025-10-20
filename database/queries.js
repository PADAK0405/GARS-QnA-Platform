/**
 * 데이터베이스 쿼리 모듈
 * - Prepared Statements로 SQL Injection 방지
 * - 트랜잭션 지원
 * - 메모리 효율적인 쿼리 실행
 */

const pool = require('./connection');
const LevelSystem = require('../utils/level-system');
const PointsSystem = require('../utils/points-system');

class Database {
    // ========== 사용자 관련 쿼리 ==========
    
    /**
     * 사용자 찾기 또는 생성
     */
    static async findOrCreateUser(googleProfile) {
        const connection = await pool.getConnection();
        try {
            const [users] = await connection.execute(
                'SELECT * FROM users WHERE id = ?',
                [googleProfile.id]
            );

            if (users.length > 0) {
                return users[0];
            }

            const displayName = googleProfile.displayName || 
                               googleProfile._json?.name || 
                               googleProfile.name?.givenName ||
                               '사용자';
            
            const email = googleProfile.emails?.[0]?.value || 
                         googleProfile._json?.email || 
                         null;

            await connection.execute(
                'INSERT INTO users (id, display_name, email, score, level, experience, points) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [googleProfile.id, displayName, email, 0, 1, 0, 0]
            );

            const [newUser] = await connection.execute(
                'SELECT * FROM users WHERE id = ?',
                [googleProfile.id]
            );

            return newUser[0];
        } finally {
            connection.release();
        }
    }

    /**
     * 사용자 ID로 조회
     */
    static async findUserById(userId) {
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );
        return users[0] || null;
    }

    /**
     * 사용자 점수 업데이트
     */
    static async updateUserScore(userId, scoreIncrement) {
        await pool.execute(
            'UPDATE users SET score = score + ? WHERE id = ?',
            [scoreIncrement, userId]
        );
    }

    /**
     * 랭킹 조회 (상위 10명)
     */
    static async getTopRankings(limit = 10) {
        const [rankings] = await pool.execute(
            'SELECT display_name as name, score FROM users ORDER BY score DESC LIMIT ?',
            [limit]
        );
        return rankings;
    }

    // ========== 질문 관련 쿼리 ==========
    
    /**
     * 질문 생성
     */
    static async createQuestion(userId, title, content, images = []) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 질문 삽입
            const [result] = await connection.execute(
                'INSERT INTO questions (user_id, title, content) VALUES (?, ?, ?)',
                [userId, title, content]
            );

            const questionId = result.insertId;

            // 질문 작성 EXP 보상 (트랜잭션 외부에서 처리)
            const expRewards = LevelSystem.getExpRewards();
            const expToAdd = expRewards.QUESTION_POSTED;

            // 이미지 삽입
            if (images.length > 0) {
                const imageValues = images.map(url => [url, 'question', questionId]);
                await connection.query(
                    'INSERT INTO images (url, entity_type, entity_id) VALUES ?',
                    [imageValues]
                );
            }

            await connection.commit();
            
            // EXP 및 포인트 보상은 트랜잭션 외부에서 처리
            try {
                const pointRewards = PointsSystem.getPointRewards();
                await this.addUserExperience(userId, expToAdd);
                await this.addUserPoints(userId, pointRewards.QUESTION_POSTED);
            } catch (rewardError) {
                console.error('보상 처리 실패:', rewardError);
                // 보상 실패는 질문 등록을 막지 않음
            }
            
            return questionId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 모든 질문 조회 (답변과 이미지 포함) - 활성 상태만
     */
    static async getAllQuestions() {
        return await this.getActiveQuestions();
    }

    /**
     * 질문 ID로 조회
     */
    static async getQuestionById(questionId) {
        const [questions] = await pool.execute(
            'SELECT * FROM questions WHERE id = ?',
            [questionId]
        );
        return questions[0] || null;
    }

    // ========== 답변 관련 쿼리 ==========
    
    /**
     * 답변 생성
     */
    static async createAnswer(questionId, userId, content, images = []) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 답변 삽입
            const [result] = await connection.execute(
                'INSERT INTO answers (question_id, user_id, content) VALUES (?, ?, ?)',
                [questionId, userId, content]
            );

            const answerId = result.insertId;

            // 이미지 삽입
            if (images.length > 0) {
                const imageValues = images.map(url => [url, 'answer', answerId]);
                await connection.query(
                    'INSERT INTO images (url, entity_type, entity_id) VALUES ?',
                    [imageValues]
                );
            }

            // 사용자 점수 증가
            await connection.execute(
                'UPDATE users SET score = score + 10 WHERE id = ?',
                [userId]
            );

            await connection.commit();
            
            // EXP 및 포인트 보상은 트랜잭션 외부에서 처리
            try {
                const expRewards = LevelSystem.getExpRewards();
                const pointRewards = PointsSystem.getPointRewards();
                await this.addUserExperience(userId, expRewards.ANSWER_POSTED);
                await this.addUserPoints(userId, pointRewards.ANSWER_POSTED);
            } catch (rewardError) {
                console.error('보상 처리 실패:', rewardError);
                // 보상 실패는 답변 등록을 막지 않음
            }
            
            return answerId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 질문에 대한 모든 답변 조회 - 활성 상태만
     */
    static async getAnswersByQuestionId(questionId) {
        return await this.getActiveAnswersByQuestionId(questionId);
    }

    // ========== 이미지 관련 쿼리 ==========
    
    /**
     * 특정 엔티티의 이미지 조회
     */
    static async getImagesByEntity(entityType, entityId) {
        const [images] = await pool.execute(
            'SELECT url FROM images WHERE entity_type = ? AND entity_id = ?',
            [entityType, entityId]
        );
        return images.map(img => img.url);
    }

    /**
     * 이미지 저장
     */
    static async saveImage(url, entityType, entityId) {
        await pool.execute(
            'INSERT INTO images (url, entity_type, entity_id) VALUES (?, ?, ?)',
            [url, entityType, entityId]
        );
    }

    // ========== 유틸리티 ==========
    
    /**
     * 사용자 프로필 업데이트 (닉네임, 상태메시지 변경)
     */
    static async updateUserProfile(userId, displayName, statusMessage = null) {
        await pool.execute(
            'UPDATE users SET display_name = ?, status_message = ? WHERE id = ?',
            [displayName, statusMessage, userId]
        );
    }

    /**
     * 사용자 EXP 추가 및 레벨업 처리
     */
    static async addUserExperience(userId, expToAdd) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 현재 사용자 정보 조회
            const [users] = await connection.execute(
                'SELECT level, experience FROM users WHERE id = ?',
                [userId]
            );

            if (users.length === 0) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }

            const { level: currentLevel, experience: currentExp } = users[0];
            
            // EXP 추가 및 레벨업 계산
            const result = LevelSystem.addExperience(currentLevel, currentExp, expToAdd);
            
            // 데이터베이스 업데이트
            await connection.execute(
                'UPDATE users SET level = ?, experience = ? WHERE id = ?',
                [result.newLevel, result.newExp, userId]
            );

            await connection.commit();
            
            return {
                leveledUp: result.leveledUp,
                levelsGained: result.levelsGained,
                newLevel: result.newLevel,
                newExp: result.newExp,
                message: result.leveledUp ? LevelSystem.getLevelUpMessage(result.newLevel, result.levelsGained) : null
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 사용자 레벨 정보 조회
     */
    static async getUserLevelInfo(userId) {
        const [users] = await pool.execute(
            'SELECT level, experience, points FROM users WHERE id = ?',
            [userId]
        );
        
        if (users.length === 0) return null;
        
        const { level, experience, points } = users[0];
        const expToNext = LevelSystem.getExpToNextLevel(level, experience);
        const progress = LevelSystem.getProgressPercentage(level, experience);
        const pointsInfo = PointsSystem.getPointsStatus(points);
        
        return {
            level,
            experience,
            expToNext,
            progress,
            title: LevelSystem.getLevelTitle(level),
            color: LevelSystem.getLevelColor(level),
            points: pointsInfo
        };
    }

    /**
     * 사용자 포인트 추가
     */
    static async addUserPoints(userId, points) {
        try {
            await pool.execute(
                'UPDATE users SET points = points + ? WHERE id = ?',
                [points, userId]
            );
            
            // 업데이트된 포인트 조회
            const [rows] = await pool.execute(
                'SELECT points FROM users WHERE id = ?',
                [userId]
            );
            
            return rows[0].points;
        } catch (error) {
            console.error('사용자 포인트 추가 실패:', error);
            throw error;
        }
    }

    // ========== 신고 관련 쿼리 ==========
    
    /**
     * 신고 생성
     */
    static async createReport(reporterId, targetType, targetId, reason, description = null) {
        try {
            const [result] = await pool.execute(
                `INSERT INTO reports (reporter_id, target_type, target_id, reason, description) 
                 VALUES (?, ?, ?, ?, ?)`,
                [reporterId, targetType, targetId, reason, description]
            );
            return result.insertId;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('이미 신고한 게시물입니다.');
            }
            console.error('신고 생성 실패:', error);
            throw error;
        }
    }

    /**
     * 신고 목록 조회 (관리자용)
     */
    static async getReports(status = 'pending', limit = 50, offset = 0) {
        try {
            let query = `
                SELECT r.*, 
                       reporter.display_name as reporter_name,
                       reviewer.display_name as reviewer_name
                FROM reports r
                LEFT JOIN users reporter ON r.reporter_id = reporter.id
                LEFT JOIN users reviewer ON r.reviewed_by = reviewer.id
            `;
            
            const params = [];
            if (status !== 'all') {
                query += ' WHERE r.status = ?';
                params.push(status);
            }
            
            query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);
            
            const [reports] = await pool.execute(query, params);
            return reports;
        } catch (error) {
            console.error('신고 목록 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 신고 상태 업데이트 (관리자용)
     */
    static async updateReportStatus(reportId, status, reviewedBy, adminNotes = null) {
        try {
            await pool.execute(
                `UPDATE reports 
                 SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, admin_notes = ?
                 WHERE id = ?`,
                [status, reviewedBy, adminNotes, reportId]
            );
            return true;
        } catch (error) {
            console.error('신고 상태 업데이트 실패:', error);
            throw error;
        }
    }

    /**
     * 특정 타겟의 신고 수 조회
     */
    static async getReportCount(targetType, targetId) {
        try {
            const [result] = await pool.execute(
                'SELECT COUNT(*) as count FROM reports WHERE target_type = ? AND target_id = ? AND status = "pending"',
                [targetType, targetId]
            );
            return result[0].count;
        } catch (error) {
            console.error('신고 수 조회 실패:', error);
            return 0;
        }
    }

    /**
     * 사용자 포인트 차감 (AI 질문용)
     */
    static async deductUserPoints(userId, points) {
        try {
            await pool.execute(
                'UPDATE users SET points = GREATEST(0, points - ?) WHERE id = ?',
                [points, userId]
            );
            
            // 업데이트된 포인트 조회
            const [rows] = await pool.execute(
                'SELECT points FROM users WHERE id = ?',
                [userId]
            );
            
            return rows[0].points;
        } catch (error) {
            console.error('사용자 포인트 차감 실패:', error);
            throw error;
        }
    }

    /**
     * 사용자 포인트 정보 조회
     */
    static async getUserPoints(userId) {
        try {
            const [rows] = await pool.execute(
                'SELECT points FROM users WHERE id = ?',
                [userId]
            );
            
            if (rows.length === 0) {
                return null;
            }
            
            return PointsSystem.getPointsStatus(rows[0].points);
        } catch (error) {
            console.error('사용자 포인트 정보 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 질문 업데이트
     */
    static async updateQuestion(questionId, title, content) {
        await pool.execute(
            'UPDATE questions SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [title, content, questionId]
        );
    }

    /**
     * 질문 삭제
     */
    static async deleteQuestion(questionId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 관련 이미지 삭제
            await connection.execute(
                'DELETE FROM images WHERE entity_type = "question" AND entity_id = ?',
                [questionId]
            );

            // 질문 삭제 (답변은 CASCADE로 자동 삭제)
            await connection.execute(
                'DELETE FROM questions WHERE id = ?',
                [questionId]
            );

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 답변 ID로 조회
     */
    static async getAnswerById(answerId) {
        const [answers] = await pool.execute(
            'SELECT * FROM answers WHERE id = ?',
            [answerId]
        );
        return answers[0] || null;
    }

    /**
     * 답변 업데이트
     */
    static async updateAnswer(answerId, content) {
        await pool.execute(
            'UPDATE answers SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [content, answerId]
        );
    }

    /**
     * 답변 삭제
     */
    static async deleteAnswer(answerId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 답변의 점수 차감
            const [answer] = await connection.execute(
                'SELECT user_id FROM answers WHERE id = ?',
                [answerId]
            );

            if (answer.length > 0) {
                await connection.execute(
                    'UPDATE users SET score = score - 10 WHERE id = ?',
                    [answer[0].user_id]
                );
            }

            // 관련 이미지 삭제
            await connection.execute(
                'DELETE FROM images WHERE entity_type = "answer" AND entity_id = ?',
                [answerId]
            );

            // 답변 삭제
            await connection.execute(
                'DELETE FROM answers WHERE id = ?',
                [answerId]
            );

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // ========== 관리자 관련 쿼리 ==========
    
    /**
     * 관리자 권한 확인
     */
    static async isAdmin(userId) {
        const [users] = await pool.execute(
            'SELECT role FROM users WHERE id = ? AND status = "active"',
            [userId]
        );
        const user = users[0];
        return user && ['moderator', 'admin', 'super_admin'].includes(user.role);
    }

    /**
     * 사용자 목록 조회 (관리자용)
     */
    static async getAllUsers(limit = 50, offset = 0) {
        const [users] = await pool.execute(`
            SELECT 
                id,
                display_name,
                email,
                score,
                role,
                status,
                suspended_until,
                suspension_reason,
                created_at
            FROM users 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `, [limit, offset]);
        
        return users;
    }

    /**
     * 사용자 상태 변경
     */
    static async updateUserStatus(userId, status, reason = null, suspendedUntil = null) {
        const now = new Date();
        
        if (status === 'suspended' || status === 'banned') {
            // 정지 상태로 변경 시 suspended_at 설정
            await pool.execute(
                'UPDATE users SET status = ?, suspension_reason = ?, suspended_until = ?, suspended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [status, reason, suspendedUntil, userId]
            );
        } else {
            // 정상 상태로 복원 시 suspended_at 초기화
            await pool.execute(
                'UPDATE users SET status = ?, suspension_reason = ?, suspended_until = ?, suspended_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [status, reason, suspendedUntil, userId]
            );
        }
    }

    /**
     * 사용자 역할 변경
     */
    static async updateUserRole(userId, role) {
        await pool.execute(
            'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [role, userId]
        );
    }

    /**
     * 질문 숨기기/복원
     */
    static async updateQuestionStatus(questionId, status, adminId, reason = null) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            if (status === 'hidden') {
                await connection.execute(
                    'UPDATE questions SET status = ?, hidden_by = ?, hidden_reason = ?, hidden_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [status, adminId, reason, questionId]
                );
            } else {
                await connection.execute(
                    'UPDATE questions SET status = ?, hidden_by = NULL, hidden_reason = NULL, hidden_at = NULL WHERE id = ?',
                    [status, questionId]
                );
            }
            
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 답변 숨기기/복원
     */
    static async updateAnswerStatus(answerId, status, adminId, reason = null) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            if (status === 'hidden') {
                await connection.execute(
                    'UPDATE answers SET status = ?, hidden_by = ?, hidden_reason = ?, hidden_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [status, adminId, reason, answerId]
                );
            } else {
                await connection.execute(
                    'UPDATE answers SET status = ?, hidden_by = NULL, hidden_reason = NULL, hidden_at = NULL WHERE id = ?',
                    [status, answerId]
                );
            }
            
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 관리자 로그 기록
     */
    static async logAdminAction(adminId, actionType, targetType, targetId, reason = null, details = null) {
        await pool.execute(
            'INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, reason, details) VALUES (?, ?, ?, ?, ?, ?)',
            [adminId, actionType, targetType, targetId, reason, details ? JSON.stringify(details) : null]
        );
    }

    /**
     * 관리자 로그 조회
     */
    static async getAdminLogs(limit = 100, offset = 0) {
        const [logs] = await pool.execute(`
            SELECT 
                al.*,
                u.display_name as admin_name
            FROM admin_logs al
            JOIN users u ON al.admin_id = u.id
            ORDER BY al.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);
        
        return logs.map(log => ({
            ...log,
            details: log.details ? JSON.parse(log.details) : null
        }));
    }

    /**
     * 통계 정보 조회 (관리자용)
     */
    static async getAdminStats() {
        const [stats] = await pool.execute(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
                (SELECT COUNT(*) FROM users WHERE status = 'suspended') as suspended_users,
                (SELECT COUNT(*) FROM users WHERE status = 'banned') as banned_users,
                (SELECT COUNT(*) FROM questions WHERE status = 'active') as active_questions,
                (SELECT COUNT(*) FROM questions WHERE status = 'hidden') as hidden_questions,
                (SELECT COUNT(*) FROM answers WHERE status = 'active') as active_answers,
                (SELECT COUNT(*) FROM answers WHERE status = 'hidden') as hidden_answers,
                (SELECT COUNT(*) FROM admin_logs WHERE DATE(created_at) = CURDATE()) as today_actions
        `);
        
        return stats[0];
    }

    /**
     * 활성 상태의 질문만 조회 (숨겨진 질문 제외)
     * 
     */
    static async getActiveQuestions() {
        const [questions] = await pool.execute(`
            SELECT 
                q.id,
                q.title,
                q.content,
                q.created_at,
                q.status,
                u.id as author_id,
                u.display_name as author_name,
                u.level as author_level
            FROM questions q
            JOIN users u ON q.user_id = u.id
            WHERE q.status = 'active' AND u.status = 'active'
            ORDER BY q.created_at DESC
        `);

        // 각 질문에 대한 답변과 이미지 조회 (병렬 처리)
        const questionsWithDetails = await Promise.all(
            questions.map(async (question) => {
                const [answers, questionImages] = await Promise.all([
                    this.getActiveAnswersByQuestionId(question.id),
                    this.getImagesByEntity('question', question.id)
                ]);

                return {
                    id: question.id,
                    title: question.title,
                    content: question.content,
                    author: {
                        id: question.author_id,
                        name: question.author_name,
                        level: question.author_level
                    },
                    images: questionImages,
                    answers: answers,
                    created_at: question.created_at,
                    status: question.status
                };
            })
        );

        return questionsWithDetails;
    }

    /**
     * 활성 상태의 답변만 조회
     */
    static async getActiveAnswersByQuestionId(questionId) {
        const [answers] = await pool.execute(`
            SELECT 
                a.id,
                a.content,
                a.created_at,
                a.status,
                u.id as author_id,
                u.display_name as author_name,
                u.level as author_level
            FROM answers a
            JOIN users u ON a.user_id = u.id
            WHERE a.question_id = ? AND a.status = 'active' AND u.status = 'active'
            ORDER BY a.created_at ASC
        `, [questionId]);

        // 각 답변에 대한 이미지 조회
        const answersWithImages = await Promise.all(
            answers.map(async (answer) => {
                const images = await this.getImagesByEntity('answer', answer.id);
                return {
                    id: answer.id,
                    content: answer.content,
                    author: {
                        id: answer.author_id,
                        name: answer.author_name,
                        level: answer.author_level
                    },
                    images: images,
                    created_at: answer.created_at,
                    status: answer.status
                };
            })
        );

        return answersWithImages;
    }

    // ========== 캘린더 관련 쿼리 ==========
    
    /**
     * 캘린더 이벤트 목록 조회
     */
    static async getCalendarEvents() {
        const [events] = await pool.execute(`
            SELECT id, title, date, time, description, created_at
            FROM calendar_events
            ORDER BY date ASC, time ASC
        `);
        return events;
    }

    /**
     * 캘린더 이벤트 생성
     */
    static async createCalendarEvent(title, date, time, description = null) {
        const [result] = await pool.execute(`
            INSERT INTO calendar_events (title, date, time, description)
            VALUES (?, ?, ?, ?)
        `, [title, date, time, description]);
        return result.insertId;
    }

    /**
     * 캘린더 이벤트 수정
     */
    static async updateCalendarEvent(eventId, title, date, time, description = null) {
        await pool.execute(`
            UPDATE calendar_events
            SET title = ?, date = ?, time = ?, description = ?
            WHERE id = ?
        `, [title, date, time, description, eventId]);
    }

    /**
     * 캘린더 이벤트 삭제
     */
    static async deleteCalendarEvent(eventId) {
        await pool.execute(`
            DELETE FROM calendar_events
            WHERE id = ?
        `, [eventId]);
    }

    /**
     * 데이터베이스 초기화 (개발 환경 전용)
     */
    static async initializeDatabase() {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            const schema = await fs.readFile(
                path.join(__dirname, 'schema.sql'),
                'utf8'
            );
            
            const queries = schema.split(';').filter(q => q.trim());
            
            for (const query of queries) {
                if (query.trim()) {
                    await pool.query(query);
                }
            }
            
            console.log('✅ 데이터베이스 초기화 완료!');
        } catch (error) {
            console.error('❌ 데이터베이스 초기화 실패:', error.message);
            throw error;
        }
    }
}

module.exports = Database;

