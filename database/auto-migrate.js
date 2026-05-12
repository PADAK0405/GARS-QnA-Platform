/**
 * 자동 데이터베이스 마이그레이션 시스템
 * 서버 시작 시 자동으로 실행되어 DB 구조를 코드 요구사항에 맞게 동기화
 * 
 * 주의사항:
 * - 기존 데이터는 절대 삭제하지 않음
 * - CREATE TABLE IF NOT EXISTS 및 ALTER TABLE ADD COLUMN 방식만 사용
 * - 외래키 타입 정합성 보장 (users.id = INT)
 */

const pool = require('./connection');

class DatabaseMigration {
    /**
     * 전체 마이그레이션 실행
     */
    static async runMigrations() {
        console.log('🔧 데이터베이스 마이그레이션 시작...');
        
        try {
            // 1. 필수 테이블 생성
            await this.createTables();
            
            // 2. users 테이블 컬럼 추가
            await this.migrateUsersTable();
            
            // 3. questions 테이블 컬럼 추가
            await this.migrateQuestionsTable();
            
            // 4. answers 테이블 컬럼 추가
            await this.migrateAnswersTable();
            
            // 5. 인덱스 추가
            await this.addIndexes();
            
            console.log('✅ 데이터베이스 마이그레이션 완료!');
            return { success: true };
        } catch (error) {
            console.error('❌ 데이터베이스 마이그레이션 실패:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 필수 테이블 생성
     */
    static async createTables() {
        const connection = await pool.getConnection();
        try {
            console.log('📦 필수 테이블 생성 중...');

            // users 테이블
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    google_id VARCHAR(255) UNIQUE,
                    username VARCHAR(255),
                    password VARCHAR(255),
                    login_provider ENUM('local', 'google', 'system') DEFAULT 'google',
                    display_name VARCHAR(255) NOT NULL,
                    email VARCHAR(255),
                    score INT DEFAULT 0,
                    level INT DEFAULT 1,
                    experience INT DEFAULT 0,
                    points INT DEFAULT 0,
                    status_message VARCHAR(200) DEFAULT NULL,
                    role ENUM('user', 'moderator', 'admin', 'super_admin') DEFAULT 'user',
                    status ENUM('active', 'suspended', 'banned') DEFAULT 'active',
                    suspended_until TIMESTAMP NULL,
                    suspended_at TIMESTAMP NULL,
                    suspension_reason TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✓ users 테이블 확인/생성 완료');

            // questions 테이블
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS questions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    title VARCHAR(500) NOT NULL,
                    content TEXT NOT NULL,
                    views INT DEFAULT 0,
                    status ENUM('active', 'hidden', 'deleted') DEFAULT 'active',
                    hidden_by INT NULL,
                    hidden_reason TEXT NULL,
                    hidden_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✓ questions 테이블 확인/생성 완료');

            // answers 테이블
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS answers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    question_id INT NOT NULL,
                    user_id INT NOT NULL,
                    content TEXT NOT NULL,
                    status ENUM('active', 'hidden', 'deleted') DEFAULT 'active',
                    hidden_by INT NULL,
                    hidden_reason TEXT NULL,
                    hidden_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✓ answers 테이블 확인/생성 완료');

            // images 테이블
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS images (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    url VARCHAR(500) NOT NULL,
                    entity_type ENUM('question', 'answer') NOT NULL,
                    entity_id INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✓ images 테이블 확인/생성 완료');

            // sessions 테이블
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
                    expires INT UNSIGNED NOT NULL,
                    data MEDIUMTEXT COLLATE utf8mb4_bin,
                    PRIMARY KEY (session_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✓ sessions 테이블 확인/생성 완료');

            // admin_logs 테이블
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS admin_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    admin_id INT NOT NULL,
                    action_type ENUM('user_suspend', 'user_ban', 'user_unban', 'question_hide', 'question_restore', 'answer_hide', 'answer_restore', 'role_change', 'content_delete', 'server_initialize', 'server_initialize_failed') NOT NULL,
                    target_type ENUM('user', 'question', 'answer', 'system') NOT NULL,
                    target_id VARCHAR(255) NOT NULL,
                    reason TEXT,
                    details JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✓ admin_logs 테이블 확인/생성 완료');

            // reports 테이블
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS reports (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    reporter_id INT NOT NULL,
                    target_type ENUM('question', 'answer', 'user') NOT NULL,
                    target_id INT NOT NULL,
                    reason ENUM('spam', 'inappropriate', 'harassment', 'violence', 'copyright', 'other') NOT NULL,
                    description TEXT,
                    status ENUM('pending', 'reviewed', 'resolved', 'dismissed') DEFAULT 'pending',
                    reviewed_by INT NULL,
                    reviewed_at TIMESTAMP NULL,
                    admin_notes TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✓ reports 테이블 확인/생성 완료');

            // calendar_events 테이블
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS calendar_events (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    date DATE NOT NULL,
                    time TIME NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✓ calendar_events 테이블 확인/생성 완료');

            // dormitory_students 테이블
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS dormitory_students (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    building VARCHAR(50) NOT NULL,
                    floor INT NOT NULL,
                    room VARCHAR(50) NOT NULL,
                    enrollment_date DATE NOT NULL,
                    graduation_date DATE NULL,
                    total_penalty_points INT DEFAULT 0,
                    total_reward_points INT DEFAULT 0,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✓ dormitory_students 테이블 확인/생성 완료');

            // leave_requests 테이블
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS leave_requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    request_type ENUM('day_off', 'overnight') NOT NULL,
                    start_datetime DATETIME NOT NULL,
                    end_datetime DATETIME NOT NULL,
                    reason TEXT NOT NULL,
                    destination VARCHAR(255),
                    emergency_contact VARCHAR(100),
                    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
                    approved_by INT NULL,
                    approved_at TIMESTAMP NULL,
                    rejection_reason TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✓ leave_requests 테이블 확인/생성 완료');

            // dormitory_points 테이블
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS dormitory_points (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    point_type ENUM('penalty', 'reward') NOT NULL,
                    points INT NOT NULL,
                    reason TEXT NOT NULL,
                    category VARCHAR(100),
                    awarded_by INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (awarded_by) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✓ dormitory_points 테이블 확인/생성 완료');

            // dormitory_violations 테이블
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS dormitory_violations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    violation_type VARCHAR(100) NOT NULL,
                    description TEXT NOT NULL,
                    penalty_points INT DEFAULT 0,
                    auto_suspended BOOLEAN DEFAULT FALSE,
                    suspension_days INT DEFAULT 0,
                    recorded_by INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✓ dormitory_violations 테이블 확인/생성 완료');

        } finally {
            connection.release();
        }
    }

    /**
     * users 테이블 컬럼 추가
     */
    static async migrateUsersTable() {
        const connection = await pool.getConnection();
        try {
            console.log('👤 users 테이블 마이그레이션 중...');

            // 컬럼 존재 여부 확인 후 추가
            const columns = [
                { name: 'suspended_until', sql: 'ADD COLUMN suspended_until TIMESTAMP NULL' },
                { name: 'suspended_at', sql: 'ADD COLUMN suspended_at TIMESTAMP NULL' },
                { name: 'suspension_reason', sql: 'ADD COLUMN suspension_reason TEXT NULL' },
                { name: 'updated_at', sql: 'ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' },
                { name: 'status_message', sql: 'ADD COLUMN status_message VARCHAR(200) DEFAULT NULL' }
            ];

            for (const column of columns) {
                try {
                    const [rows] = await connection.execute(
                        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                         WHERE TABLE_SCHEMA = DATABASE() 
                         AND TABLE_NAME = 'users' 
                         AND COLUMN_NAME = ?`,
                        [column.name]
                    );

                    if (rows.length === 0) {
                        await connection.execute(`ALTER TABLE users ${column.sql}`);
                        console.log(`  ✓ ${column.name} 컬럼 추가됨`);
                    }
                } catch (error) {
                    if (error.code !== 'ER_DUP_FIELDNAME') {
                        console.warn(`  ⚠ ${column.name} 추가 실패:`, error.message);
                    }
                }
            }

            console.log('✓ users 테이블 마이그레이션 완료');
        } finally {
            connection.release();
        }
    }

    /**
     * questions 테이블 컬럼 추가
     */
    static async migrateQuestionsTable() {
        const connection = await pool.getConnection();
        try {
            console.log('❓ questions 테이블 마이그레이션 중...');

            const columns = [
                { name: 'updated_at', sql: 'ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
            ];

            for (const column of columns) {
                try {
                    const [rows] = await connection.execute(
                        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                         WHERE TABLE_SCHEMA = DATABASE() 
                         AND TABLE_NAME = 'questions' 
                         AND COLUMN_NAME = ?`,
                        [column.name]
                    );

                    if (rows.length === 0) {
                        await connection.execute(`ALTER TABLE questions ${column.sql}`);
                        console.log(`  ✓ ${column.name} 컬럼 추가됨`);
                    }
                } catch (error) {
                    if (error.code !== 'ER_DUP_FIELDNAME') {
                        console.warn(`  ⚠ ${column.name} 추가 실패:`, error.message);
                    }
                }
            }

            console.log('✓ questions 테이블 마이그레이션 완료');
        } finally {
            connection.release();
        }
    }

    /**
     * answers 테이블 컬럼 추가
     */
    static async migrateAnswersTable() {
        const connection = await pool.getConnection();
        try {
            console.log('💬 answers 테이블 마이그레이션 중...');

            const columns = [
                { name: 'updated_at', sql: 'ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
            ];

            for (const column of columns) {
                try {
                    const [rows] = await connection.execute(
                        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                         WHERE TABLE_SCHEMA = DATABASE() 
                         AND TABLE_NAME = 'answers' 
                         AND COLUMN_NAME = ?`,
                        [column.name]
                    );

                    if (rows.length === 0) {
                        await connection.execute(`ALTER TABLE answers ${column.sql}`);
                        console.log(`  ✓ ${column.name} 컬럼 추가됨`);
                    }
                } catch (error) {
                    if (error.code !== 'ER_DUP_FIELDNAME') {
                        console.warn(`  ⚠ ${column.name} 추가 실패:`, error.message);
                    }
                }
            }

            console.log('✓ answers 테이블 마이그레이션 완료');
        } finally {
            connection.release();
        }
    }

    /**
     * 인덱스 추가
     */
    static async addIndexes() {
        const connection = await pool.getConnection();
        try {
            console.log('📇 인덱스 추가 중...');

            const indexes = [
                { table: 'users', name: 'idx_score', sql: 'CREATE INDEX idx_score ON users(score DESC)' },
                { table: 'users', name: 'idx_level', sql: 'CREATE INDEX idx_level ON users(level DESC)' },
                { table: 'users', name: 'idx_role', sql: 'CREATE INDEX idx_role ON users(role)' },
                { table: 'users', name: 'idx_status', sql: 'CREATE INDEX idx_status ON users(status)' },
                { table: 'questions', name: 'idx_user_id', sql: 'CREATE INDEX idx_user_id ON questions(user_id)' },
                { table: 'questions', name: 'idx_created_at', sql: 'CREATE INDEX idx_created_at ON questions(created_at DESC)' },
                { table: 'answers', name: 'idx_question_id', sql: 'CREATE INDEX idx_question_id ON answers(question_id)' },
                { table: 'answers', name: 'idx_user_id', sql: 'CREATE INDEX idx_user_id ON answers(user_id)' },
                { table: 'images', name: 'idx_entity', sql: 'CREATE INDEX idx_entity ON images(entity_type, entity_id)' },
                { table: 'admin_logs', name: 'idx_admin_id', sql: 'CREATE INDEX idx_admin_id ON admin_logs(admin_id)' },
                { table: 'reports', name: 'idx_reporter_id', sql: 'CREATE INDEX idx_reporter_id ON reports(reporter_id)' },
                { table: 'reports', name: 'idx_target', sql: 'CREATE INDEX idx_target ON reports(target_type, target_id)' },
                { table: 'reports', name: 'idx_status', sql: 'CREATE INDEX idx_status ON reports(status)' }
            ];

            for (const index of indexes) {
                try {
                    const [rows] = await connection.execute(
                        `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
                         WHERE TABLE_SCHEMA = DATABASE() 
                         AND TABLE_NAME = ? 
                         AND INDEX_NAME = ?`,
                        [index.table, index.name]
                    );

                    if (rows.length === 0) {
                        await connection.execute(index.sql);
                        console.log(`  ✓ ${index.table}.${index.name} 인덱스 추가됨`);
                    }
                } catch (error) {
                    if (error.code !== 'ER_DUP_KEYNAME') {
                        console.warn(`  ⚠ ${index.name} 인덱스 추가 실패:`, error.message);
                    }
                }
            }

            console.log('✓ 인덱스 추가 완료');
        } finally {
            connection.release();
        }
    }

    /**
     * DB 구조 검증
     */
    static async validateSchema() {
        const connection = await pool.getConnection();
        try {
            console.log('🔍 DB 스키마 검증 중...');

            // 필수 테이블 확인
            const requiredTables = [
                'users', 'questions', 'answers', 'images', 'sessions',
                'admin_logs', 'reports', 'calendar_events',
                'dormitory_students', 'leave_requests', 'dormitory_points', 'dormitory_violations'
            ];

            const [tables] = await connection.execute(
                `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
                 WHERE TABLE_SCHEMA = DATABASE()`
            );

            const existingTables = tables.map(t => t.TABLE_NAME);
            const missingTables = requiredTables.filter(t => !existingTables.includes(t));

            if (missingTables.length > 0) {
                console.warn('⚠ 누락된 테이블:', missingTables.join(', '));
                return { valid: false, missingTables };
            }

            console.log('✓ 모든 필수 테이블이 존재합니다');
            return { valid: true };
        } finally {
            connection.release();
        }
    }
}

module.exports = DatabaseMigration;
