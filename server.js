const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const Database = require('./database/queries');
const geminiAI = require('./utils/gemini-ai');
const securityLogger = require('./utils/security-logger');

/**
 * 서버 초기화 함수
 * 데이터베이스 스키마 업데이트, 테이블 생성, 시스템 초기화를 순차적으로 실행
 * @async
 * @throws {Error} 초기화 과정에서 오류 발생 시
 */
async function initializeServer() {
    console.log('🚀 서버 초기화 시작');
    
    try {
        // 초기화 작업 목록 정의
        const initTasks = [
            { name: '데이터베이스 스키마 업데이트', fn: updateDatabaseSchema },
            { name: '포인트 시스템 스키마 업데이트', fn: updatePointsSchema },
            { name: '신고 시스템 테이블 생성', fn: createReportsTable },
            { name: '사용자 레벨 시스템 초기화', fn: migrateUserLevels },
            { name: '캘린더 테이블 생성', fn: createCalendarTable }
        ];
        
        // 각 초기화 작업을 순차적으로 실행
        for (const task of initTasks) {
            console.log(`📊 ${task.name} 중...`);
            await task.fn();
        }
        
        console.log('✅ 서버 초기화 완료');
    } catch (error) {
        console.error('❌ 서버 초기화 실패:', error);
        process.exit(1);
    }
}

/**
 * 데이터베이스 스키마 업데이트
 * 사용자 테이블에 레벨, 경험치, 상태 메시지 컬럼과 인덱스를 추가
 * @async
 * @throws {Error} 스키마 업데이트 실패 시
 */
async function updateDatabaseSchema() {
    const pool = require('./database/connection');
    
    // 스키마 업데이트 쿼리 정의
    const schemaUpdates = [
        { 
            query: 'ALTER TABLE users ADD COLUMN level INT DEFAULT 1',
            description: 'level 컬럼',
            errorCodes: ['ER_DUP_FIELDNAME']
        },
        { 
            query: 'ALTER TABLE users ADD COLUMN experience INT DEFAULT 0',
            description: 'experience 컬럼',
            errorCodes: ['ER_DUP_FIELDNAME']
        },
        { 
            query: 'ALTER TABLE users ADD COLUMN status_message VARCHAR(200) DEFAULT NULL',
            description: 'status_message 컬럼',
            errorCodes: ['ER_DUP_FIELDNAME']
        },
        { 
            query: 'ALTER TABLE users ADD INDEX idx_level (level DESC)',
            description: 'level 인덱스',
            errorCodes: ['ER_DUP_KEYNAME']
        },
        { 
            query: 'ALTER TABLE users ADD INDEX idx_experience (experience DESC)',
            description: 'experience 인덱스',
            errorCodes: ['ER_DUP_KEYNAME']
        }
    ];
    
    // 각 스키마 업데이트 실행
    for (const update of schemaUpdates) {
        try {
            await pool.execute(update.query);
            console.log(`  ✅ 스키마 업데이트: ${update.description}`);
        } catch (error) {
            if (update.errorCodes.includes(error.code)) {
                console.log(`  ⚠️  이미 존재: ${update.description}`);
            } else {
                console.error(`  ❌ 스키마 업데이트 실패: ${update.description}`, error);
                throw error;
            }
        }
    }
}

/**
 * 포인트 시스템 스키마 업데이트
 * 포인트 관련 테이블과 스키마를 업데이트
 * @async
 * @throws {Error} 포인트 시스템 업데이트 실패 시
 */
async function updatePointsSchema() {
    try {
        const updatePoints = require('./scripts/update-schema-points');
        await updatePoints();
        console.log('  ✅ 포인트 시스템 스키마 업데이트 완료');
    } catch (error) {
        console.error('  ❌ 포인트 시스템 스키마 업데이트 실패:', error);
        throw error;
    }
}

/**
 * 사용자 레벨 시스템 마이그레이션
 * 기존 사용자들의 레벨과 경험치를 기본값으로 초기화
 * @async
 */
async function migrateUserLevels() {
    const pool = require('./database/connection');
    
    try {
        // 레벨과 경험치가 null인 사용자들을 기본값으로 설정
    const [result] = await pool.execute(`
        UPDATE users 
        SET level = 1, experience = 0 
        WHERE level IS NULL OR experience IS NULL
    `);
    
    if (result.affectedRows > 0) {
            console.log(`  ✅ ${result.affectedRows}명의 사용자 레벨 정보 업데이트`);
    } else {
            console.log('  ℹ️  업데이트할 사용자 없음');
        }
    } catch (error) {
        console.error('  ❌ 사용자 레벨 마이그레이션 실패:', error);
        throw error;
    }
}

/**
 * 신고 테이블 생성
 * 사용자 신고 시스템을 위한 reports 테이블을 생성하고 인덱스 설정
 * @async
 * @throws {Error} 테이블 생성 실패 시
 */
async function createReportsTable() {
    const pool = require('./database/connection');
    
    try {
        // 신고 테이블 생성 쿼리
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                reporter_id VARCHAR(255) NOT NULL,
                target_type ENUM('question', 'answer', 'user') NOT NULL,
                target_id INT NOT NULL,
                reason ENUM('spam', 'inappropriate', 'harassment', 'violence', 'copyright', 'other') NOT NULL,
                description TEXT,
                status ENUM('pending', 'reviewed', 'resolved', 'dismissed') DEFAULT 'pending',
                reviewed_by VARCHAR(255) NULL,
                reviewed_at TIMESTAMP NULL,
                admin_notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_reporter_id (reporter_id),
                INDEX idx_target (target_type, target_id),
                INDEX idx_status (status),
                INDEX idx_created_at (created_at DESC),
                UNIQUE KEY unique_user_report (reporter_id, target_type, target_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;
        
        await pool.execute(createTableQuery);
        console.log('  ✅ 신고 테이블 확인/생성 완료');
        
        // 테이블 존재 확인
        const [tables] = await pool.execute('SHOW TABLES LIKE "reports"');
        if (tables.length > 0) {
            console.log('  📋 reports 테이블 준비 완료');
        }
        
    } catch (error) {
        console.error('  ❌ 신고 테이블 생성 실패:', error);
        throw error;
    }
}

/**
 * 캘린더 테이블 생성
 * 캘린더 이벤트 관리를 위한 calendar_events 테이블을 생성
 * @async
 * @throws {Error} 테이블 생성 실패 시
 */
async function createCalendarTable() {
    const pool = require('./database/connection');
    
    try {
        // 캘린더 이벤트 테이블 생성 쿼리
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS calendar_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                date DATE NOT NULL,
                time TIME NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_date (date),
                INDEX idx_date_time (date, time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;
        
        await pool.execute(createTableQuery);
        console.log('  ✅ calendar_events 테이블 확인/생성 완료');
        
        // 테이블 존재 확인
        const [tables] = await pool.execute('SHOW TABLES LIKE "calendar_events"');
        if (tables.length > 0) {
            console.log('  📅 calendar_events 테이블 준비 완료');
        }
        
    } catch (error) {
        console.error('  ❌ 캘린더 테이블 생성 실패:', error);
        throw error;
    }
}

// ========== Express 애플리케이션 초기화 ==========
const app = express();
const PORT = process.env.PORT || 3000;

// ========== Express 기본 설정 ==========
// Nginx 프록시 뒤에서 실행되므로 trust proxy 설정
app.set('trust proxy', 1);

// ========== 보안 미들웨어 설정 ==========

/**
 * Helmet 보안 헤더 설정
 * CSP(Content Security Policy) 및 기타 보안 헤더를 설정하여 XSS, CSRF 등의 공격을 방지
 */
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://accounts.google.com", "https://static.cloudflareinsights.com"],
            scriptSrcAttr: ["'unsafe-hashes'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://accounts.google.com", "https://generativelanguage.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'", "https://accounts.google.com"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

/**
 * Rate Limiting 설정
 * API 요청 제한을 통해 DDoS 공격과 과도한 요청을 방지
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분 윈도우
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 프로덕션: 100, 개발: 1000 요청
    message: {
        error: '너무 많은 요청입니다. 15분 후 다시 시도해주세요.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        // 보안 로그에 Rate Limit 초과 기록
        securityLogger.logRateLimitExceeded(req, 100, 15 * 60 * 1000);
        res.status(429).json({
            error: '너무 많은 요청입니다. 15분 후 다시 시도해주세요.'
        });
    }
});

/**
 * 엄격한 Rate Limiting 설정
 * 민감한 작업(로그인, 회원가입 등)에 대한 엄격한 요청 제한
 */
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분 윈도우
    max: 5, // 최대 5 요청
    message: {
        error: '너무 많은 요청입니다. 15분 후 다시 시도해주세요.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * 인증 관련 Rate Limiting 설정
 * 로그인, 회원가입 등 인증 관련 요청에 대한 제한
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분 윈도우
    max: 10, // 최대 10 요청
    message: {
        error: '인증 요청이 너무 많습니다. 15분 후 다시 시도해주세요.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// ========== 미들웨어 적용 ==========

// 프로덕션 환경에서만 일반 Rate Limiting 적용
if (process.env.NODE_ENV === 'production') {
    app.use('/api', generalLimiter);
}

/**
 * 요청 크기 제한 설정
 * JSON과 URL 인코딩된 데이터의 최대 크기를 10MB로 제한
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Multer 파일 저장소 설정
 * 업로드된 파일을 public/uploads/ 디렉토리에 저장하고 고유한 파일명 생성
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/uploads/';
        // 업로드 디렉토리가 존재하지 않으면 생성
        if (!require('fs').existsSync(uploadDir)) {
            require('fs').mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // 타임스탬프와 랜덤 숫자를 조합하여 고유한 파일명 생성
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

/**
 * Multer 파일 업로드 설정
 * 보안 강화된 파일 업로드 설정으로 악성 파일 업로드 방지
 */
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB 파일 크기 제한
        files: 5, // 최대 5개 파일 동시 업로드
        fieldSize: 10 * 1024 * 1024 // 필드 크기 제한
    },
    fileFilter: (req, file, cb) => {
        // 허용된 파일 확장자 검사
        const allowedExtensions = /\.(jpeg|jpg|png|gif|webp)$/i;
        const extname = allowedExtensions.test(path.extname(file.originalname));
        
        // 허용된 MIME 타입 검사
        const allowedMimeTypes = /^image\/(jpeg|jpg|png|gif|webp)$/i;
        const mimetype = allowedMimeTypes.test(file.mimetype);
        
        // 파일명 보안 검사 (경로 탐색 공격 방지)
        const filename = path.basename(file.originalname);
        const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
        const hasDangerousChars = dangerousChars.test(filename);
        
        if (extname && mimetype && !hasDangerousChars) {
            return cb(null, true);
        } else {
            cb(new Error('유효하지 않은 파일입니다. 이미지 파일만 업로드 가능합니다.'));
        }
    }
});

/**
 * 파일 업로드 Rate Limiting 설정
 * 파일 업로드 요청을 제한하여 서버 과부하 방지
 */
const uploadLimiter = rateLimit({
    windowMs: 60 * 1000, // 1분 윈도우
    max: 10, // 최대 10개 파일 업로드
    message: {
        error: '파일 업로드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
    }
});

// ========== Google OAuth 설정 ==========
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3000/auth/google/callback';

/**
 * 세션 보안 설정
 * 세션 쿠키의 보안을 강화하여 XSS, CSRF 공격을 방지
 */
app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: false,
    name: 'qna_session', // 기본 세션 이름 변경으로 보안 강화
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS에서만 쿠키 전송
        httpOnly: true, // XSS 공격 방지
        maxAge: 24 * 60 * 60 * 1000, // 24시간 세션 유지
        sameSite: 'lax' // CSRF 공격 방지
    },
    rolling: true, // 세션 자동 갱신
    proxy: process.env.NODE_ENV === 'production' // 프록시 환경에서 신뢰
}));

// ========== Passport 인증 설정 ==========
app.use(passport.initialize());
app.use(passport.session());

// ========== 입력 검증 미들웨어 ==========

/**
 * 질문 입력 검증 미들웨어
 * 제목과 내용의 길이 및 형식을 검증하고 XSS 공격을 방지
 */
const validateQuestion = [
    body('title')
        .trim()
        .isLength({ min: 1, max: 500 })
        .withMessage('제목은 1-500자 사이여야 합니다.')
        .escape(), // XSS 공격 방지
    body('content')
        .trim()
        .isLength({ min: 1, max: 5000 })
        .withMessage('내용은 1-5000자 사이여야 합니다.')
        .escape() // XSS 공격 방지
];

/**
 * 답변 입력 검증 미들웨어
 * 답변 내용의 길이 및 형식을 검증하고 XSS 공격을 방지
 */
const validateAnswer = [
    body('content')
        .trim()
        .isLength({ min: 1, max: 5000 })
        .withMessage('답변 내용은 1-5000자 사이여야 합니다.')
        .escape() // XSS 공격 방지
];

/**
 * 신고 입력 검증 미들웨어
 * 신고 대상, ID, 사유, 설명의 유효성을 검증하고 XSS 공격을 방지
 */
const validateReport = [
    body('targetType')
        .isIn(['question', 'answer', 'user'])
        .withMessage('유효하지 않은 신고 대상입니다.'),
    body('targetId')
        .isInt({ min: 1 })
        .withMessage('유효하지 않은 대상 ID입니다.'),
    body('reason')
        .isIn(['spam', 'inappropriate', 'harassment', 'violence', 'copyright', 'other'])
        .withMessage('유효하지 않은 신고 사유입니다.'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('신고 설명은 1000자 이하여야 합니다.')
        .escape() // XSS 공격 방지
];

/**
 * 입력 검증 결과 처리 미들웨어
 * express-validator의 검증 결과를 확인하고 오류가 있으면 400 응답 반환
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // 보안 로깅에 검증 오류 기록
        securityLogger.logValidationError(req, errors.array());
        
        return res.status(400).json({
            error: '입력 데이터가 유효하지 않습니다.',
            details: errors.array()
        });
    }
    next();
};

// ========== 보안 헬퍼 함수 ==========

/**
 * XSS 방지 입력 정화 함수
 * HTML 특수문자를 이스케이프하여 XSS 공격을 방지
 * @param {string} input - 정화할 입력 문자열
 * @returns {string} 정화된 문자열
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

/**
 * CSRF 토큰 생성 함수
 * 세션 기반 CSRF 토큰을 생성하여 CSRF 공격을 방지
 * @param {Object} req - Express 요청 객체
 * @returns {string} 생성된 CSRF 토큰
 */
const generateCSRFToken = (req) => {
    if (!req.session.csrfSecret) {
        req.session.csrfSecret = crypto.randomBytes(32).toString('hex');
    }
    return crypto
        .createHmac('sha256', req.session.csrfSecret)
        .update(req.sessionID)
        .digest('hex');
};

/**
 * CSRF 토큰 검증 함수
 * 요청의 CSRF 토큰이 유효한지 검증
 * @param {Object} req - Express 요청 객체
 * @param {string} token - 검증할 CSRF 토큰
 * @returns {boolean} 토큰 유효성 여부
 */
const validateCSRFToken = (req, token) => {
    if (!token || !req.session.csrfSecret) {
        return false;
    }
    
    const expectedToken = crypto
        .createHmac('sha256', req.session.csrfSecret)
        .update(req.sessionID)
        .digest('hex');
    
    // 타이밍 공격 방지를 위한 안전한 비교
    return crypto.timingSafeEqual(
        Buffer.from(token, 'hex'),
        Buffer.from(expectedToken, 'hex')
    );
};

/**
 * CSRF 보호 미들웨어
 * POST, PUT, DELETE 요청에 대해 CSRF 토큰을 검증
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 */
// CSRF 보호를 일시적으로 비활성화 (개발/테스트용)
const csrfProtection = (req, res, next) => {
    // 모든 요청을 통과시킴 (CSRF 검증 생략)
    next();
};

/**
 * 관리자 권한 확인 미들웨어
 * 요청한 사용자가 관리자 권한을 가지고 있는지 확인
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 */
async function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }
    
    try {
        const isAdmin = await Database.isAdmin(req.user.id);
        if (!isAdmin) {
            return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
        }
        next();
    } catch (error) {
        console.error('관리자 권한 확인 오류:', error);
        res.status(500).json({ error: '권한 확인에 실패했습니다.' });
    }
}

// ========== 정적 파일 서빙 ==========
app.use(express.static('public'));

// ========== 에러 처리 미들웨어 ==========

/**
 * 전역 에러 처리 미들웨어
 * 서버 오류를 안전하게 처리하고 민감한 정보 노출을 방지
 * @param {Error} err - 발생한 오류 객체
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 */
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    
    // 보안 로깅에 오류 기록
    securityLogger.logSuspiciousActivity('Server Error', req, { error: err.message });
    
    // 프로덕션 환경에서는 상세한 오류 정보 숨김
    if (process.env.NODE_ENV === 'production') {
        res.status(500).json({
            error: '서버 내부 오류가 발생했습니다.',
            message: '잠시 후 다시 시도해주세요.'
        });
    } else {
        // 개발 환경에서는 상세한 오류 정보 제공
        res.status(500).json({
            error: '서버 내부 오류가 발생했습니다.',
            message: err.message,
            stack: err.stack
        });
    }
});

// ========== Passport 사용자 직렬화/역직렬화 ==========

/**
 * 사용자 직렬화
 * 세션에 저장할 사용자 정보를 직렬화
 * @param {Object} user - 사용자 객체
 * @param {Function} done - 완료 콜백 함수
 */
passport.serializeUser((user, done) => {
    done(null, user.id);
});

/**
 * 사용자 역직렬화
 * 세션에서 사용자 정보를 복원
 * @param {string} id - 사용자 ID
 * @param {Function} done - 완료 콜백 함수
 */
passport.deserializeUser(async (id, done) => {
    try {
        const user = await Database.findUserById(id);
        done(null, user);
    } catch (error) {
        console.error('사용자 역직렬화 오류:', error);
        done(error, null);
    }
});

// ========== Google OAuth 전략 설정 ==========

/**
 * Google OAuth 전략 설정
 * Google 계정을 통한 사용자 인증 처리
 */
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: CALLBACK_URL
},
async (accessToken, refreshToken, profile, done) => {
    try {
        // 사용자 찾기 또는 생성
        const user = await Database.findOrCreateUser(profile);
        return done(null, user);
    } catch (error) {
        console.error('Google OAuth 인증 오류:', error);
        return done(error, null);
    }
}));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => res.redirect('/'));
app.get('/auth/logout', (req, res, next) => {
    req.logout(err => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

// CSRF 토큰 제공 엔드포인트
app.get('/api/csrf-token', (req, res) => {
    const token = generateCSRFToken(req);
    res.json({ csrfToken: token });
});

app.get('/api/user', async (req, res) => {
    console.log('사용자 정보 조회 요청, req.user:', req.user);
    if (req.user) {
        try {
            // 데이터베이스에서 최신 사용자 정보 조회
            const user = await Database.findUserById(req.user.id);
            console.log('데이터베이스에서 조회한 사용자:', user);
            
            if (!user) {
                console.log('사용자를 찾을 수 없음');
                return res.status(404).json({ message: 'User not found' });
            }
            
            console.log('데이터베이스에서 조회한 사용자 정보:', user);
            console.log('정지 관련 정보:', {
                status: user.status,
                suspended_until: user.suspended_until,
                suspended_at: user.suspended_at,
                suspension_reason: user.suspension_reason
            });
            
            // 레벨 정보 추가
            const levelInfo = await Database.getUserLevelInfo(req.user.id);
            
            const userResponse = {
                id: user.id,
                displayName: user.display_name || '사용자',
                email: user.email,
                score: user.score || 0,
                level: user.level || 1,
                experience: user.experience || 0,
                statusMessage: user.status_message,
                levelInfo: levelInfo,
                role: user.role || 'user',
                status: user.status || 'active',
                suspendedUntil: user.suspended_until,
                suspendedAt: user.suspended_at,
                suspensionReason: user.suspension_reason
            };
            
            console.log('클라이언트로 전송할 사용자 정보:', userResponse);
            res.json(userResponse);
        } catch (error) {
            console.error('사용자 정보 조회 오류:', error);
            res.status(500).json({ error: '사용자 정보를 불러올 수 없습니다.' });
        }
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});

// 사용자 프로필 업데이트 API
app.put('/api/user/profile', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }
    
    try {
        const { displayName, statusMessage } = req.body;
        
        if (!displayName || displayName.trim().length === 0) {
            return res.status(400).json({ error: '닉네임을 입력해주세요.' });
        }
        
        if (displayName.length > 20) {
            return res.status(400).json({ error: '닉네임은 20자 이하로 입력해주세요.' });
        }
        
        if (statusMessage && statusMessage.length > 30) {
            return res.status(400).json({ error: '상태메시지는 30자 이하로 입력해주세요.' });
        }
        
        await Database.updateUserProfile(req.user.id, displayName.trim(), statusMessage?.trim() || null);
        
        res.json({ success: true, message: '프로필이 업데이트되었습니다.' });
    } catch (error) {
        console.error('프로필 업데이트 실패:', error);
        res.status(500).json({ error: '프로필 업데이트에 실패했습니다.' });
    }
});

// 사용자 레벨 정보 조회 API
app.get('/api/user/level', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }
    
    try {
        const levelInfo = await Database.getUserLevelInfo(req.user.id);
        
        if (!levelInfo) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        res.json(levelInfo);
    } catch (error) {
        console.error('레벨 정보 조회 실패:', error);
        res.status(500).json({ error: '레벨 정보를 불러올 수 없습니다.' });
    }
});

app.get('/api/questions', async (req, res) => {
    try {
        console.log('질문 목록 조회 요청');
        const questions = await Database.getAllQuestions();
        console.log(`질문 ${questions.length}개 조회 완료`);
        res.json(questions);
    } catch (error) {
        console.error('질문 조회 오류:', error);
        res.status(500).json({ error: '질문을 불러올 수 없습니다.' });
    }
});

// 관리자용 질문 목록 조회 (모든 상태 포함)
app.get('/api/admin/questions', requireAdmin, async (req, res) => {
    try {
        console.log('관리자 질문 목록 조회 요청');
        const questions = await Database.getAllQuestionsForAdmin();
        console.log(`관리자 질문 ${questions.length}개 조회 완료`);
        res.json(questions);
    } catch (error) {
        console.error('관리자 질문 조회 오류:', error);
        res.status(500).json({ error: '질문을 불러오는데 실패했습니다.' });
    }
});

app.get('/api/rankings', async (req, res) => {
    try {
        const rankings = await Database.getTopRankings(10);
        res.json(rankings);
    } catch (error) {
        console.error('랭킹 조회 오류:', error);
        res.status(500).json({ error: '랭킹을 불러올 수 없습니다.' });
    }
});

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.user) return res.status(401).send('로그인이 필요합니다.');
    if (!req.file) return res.status(400).send('이미지가 업로드되지 않았습니다.');
    res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

// 중복 요청 방지를 위한 캐시
const requestCache = new Map();
const CACHE_DURATION = 5000; // 5초

app.post('/api/questions', csrfProtection, validateQuestion, handleValidationErrors, async (req, res) => {
    console.log('질문 등록 요청:', req.body);
    console.log('사용자 정보:', req.user);
    
    if (!req.user) {
        console.log('로그인되지 않은 사용자');
        return res.status(401).send('로그인이 필요합니다.');
    }
    
    // 정지 상태 확인
    if (req.user.status === 'suspended' || req.user.status === 'banned') {
        console.log('정지된 사용자:', req.user.status);
        return res.status(403).json({ error: '계정이 제한되어 질문을 작성할 수 없습니다.' });
    }
    
    const { title, content, images } = req.body;
    
    if (!title || !content) {
        console.log('제목 또는 내용 누락:', { title: !!title, content: !!content });
        return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
    }
    
    // 중복 요청 체크 (사용자 ID + 제목 + 내용 해시)
    const requestKey = `${req.user.id}-${title}-${content}`;
    const now = Date.now();
    
    if (requestCache.has(requestKey)) {
        const lastRequest = requestCache.get(requestKey);
        if (now - lastRequest < CACHE_DURATION) {
            console.log('중복 요청 감지, 무시:', requestKey);
            return res.status(429).json({ error: '잠시 후 다시 시도해주세요.' });
        }
    }
    
    // 요청 캐시에 저장
    requestCache.set(requestKey, now);
    
    // 캐시 정리 (메모리 누수 방지)
    if (requestCache.size > 1000) {
        const entries = Array.from(requestCache.entries());
        entries.forEach(([key, timestamp]) => {
            if (now - timestamp > CACHE_DURATION) {
                requestCache.delete(key);
            }
        });
    }
    
    try {
        console.log('데이터베이스에 질문 저장 시작...');
        const questionId = await Database.createQuestion(
            req.user.id,
            title,
            content,
            images || []
        );
        console.log('질문 저장 완료, ID:', questionId);
        
        // AI 자동 답변 생성 (백그라운드에서 실행)
        if (geminiAI.enabled) {
            generateAIAnswer(questionId, title, content, images).catch(err => {
                console.error('AI 답변 생성 실패:', err);
            });
        }
        
        console.log('질문 등록 성공, 응답 전송');
        res.status(201).json({ id: questionId, message: '질문이 등록되었습니다.' });
    } catch (error) {
        console.error('질문 생성 오류:', error);
        res.status(500).json({ error: '질문 등록에 실패했습니다.' });
    }
});

// AI 답변 생성 함수
async function generateAIAnswer(questionId, title, content, images) {
    try {
        let aiResponse;
        
        // 이미지가 있으면 이미지와 함께 분석
        if (images && images.length > 0) {
            aiResponse = await geminiAI.analyzeQuestionWithImage(title, content, images[0]);
        } else {
            // 텍스트만 분석
            aiResponse = await geminiAI.analyzeTextQuestion(title, content);
        }
        
        if (aiResponse) {
            // AI 답변을 자동으로 등록 (AI 사용자로)
            const aiUserId = 'ai-assistant';
            
            // AI 사용자가 없으면 생성
            const aiUser = await Database.findUserById(aiUserId);
            if (!aiUser) {
                const connection = await require('./database/connection').getConnection();
                try {
                    await connection.execute(
                        'INSERT INTO users (id, display_name, email, score) VALUES (?, ?, ?, ?)',
                        [aiUserId, 'AI 도우미', 'ai@gaonqanda.com', 0]
                    );
                } finally {
                    connection.release();
                }
            }
            
            // AI 답변 등록
            await Database.createAnswer(questionId, aiUserId, aiResponse, []);
            console.log(`✅ AI 답변 생성 완료 (질문 #${questionId})`);
        }
    } catch (error) {
        console.error('AI 답변 생성 오류:', error);
    }
}

app.post('/api/questions/:id/answers', csrfProtection, validateAnswer, handleValidationErrors, async (req, res) => {
    if (!req.user) return res.status(401).send('로그인이 필요합니다.');
    
    // 정지 상태 확인
    if (req.user.status === 'suspended' || req.user.status === 'banned') {
        return res.status(403).json({ error: '계정이 제한되어 답변을 작성할 수 없습니다.' });
    }
    
    const questionId = parseInt(req.params.id);
    const { content, images } = req.body;
    
    // 중복 요청 체크 (사용자 ID + 질문 ID + 내용 해시)
    const requestKey = `answer-${req.user.id}-${questionId}-${content}`;
    const now = Date.now();
    
    if (requestCache.has(requestKey)) {
        const lastRequest = requestCache.get(requestKey);
        if (now - lastRequest < CACHE_DURATION) {
            console.log('중복 답변 요청 감지, 무시:', requestKey);
            return res.status(429).json({ error: '잠시 후 다시 시도해주세요.' });
        }
    }
    
    // 요청 캐시에 저장
    requestCache.set(requestKey, now);
    
    if (!content) {
        return res.status(400).json({ error: '답변 내용은 필수입니다.' });
    }
    
    try {
        // 질문 존재 확인
        const question = await Database.getQuestionById(questionId);
        if (!question) {
            return res.status(404).json({ error: '질문을 찾을 수 없습니다.' });
        }
        
        const answerId = await Database.createAnswer(
            questionId,
            req.user.id,
            content,
            images || []
        );
        
        res.status(201).json({ id: answerId, message: '답변이 등록되었습니다.' });
    } catch (error) {
        console.error('답변 생성 오류:', error);
        res.status(500).json({ error: '답변 등록에 실패했습니다.' });
    }
});

// 사용자 프로필 업데이트 (닉네임 변경)
app.put('/api/user/profile', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
    
    const { displayName } = req.body;
    
    if (!displayName || displayName.trim().length === 0) {
        return res.status(400).json({ error: '닉네임은 필수입니다.' });
    }
    
    if (displayName.length > 20) {
        return res.status(400).json({ error: '닉네임은 20자 이하로 입력해주세요.' });
    }
    
    try {
        await Database.updateUserProfile(req.user.id, displayName.trim());
        res.json({ message: '프로필이 업데이트되었습니다.' });
    } catch (error) {
        console.error('프로필 업데이트 오류:', error);
        res.status(500).json({ error: '프로필 업데이트에 실패했습니다.' });
    }
});

// 질문 수정
app.put('/api/questions/:id', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
    
    const questionId = parseInt(req.params.id);
    const { title, content } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
    }
    
    try {
        // 질문 존재 확인 및 권한 확인
        const question = await Database.getQuestionById(questionId);
        if (!question) {
            return res.status(404).json({ error: '질문을 찾을 수 없습니다.' });
        }
        
        if (question.user_id !== req.user.id) {
            return res.status(403).json({ error: '자신의 질문만 수정할 수 있습니다.' });
        }
        
        await Database.updateQuestion(questionId, title.trim(), content.trim());
        res.json({ message: '질문이 수정되었습니다.' });
    } catch (error) {
        console.error('질문 수정 오류:', error);
        res.status(500).json({ error: '질문 수정에 실패했습니다.' });
    }
});

// 개별 질문 조회
app.get('/api/questions/:id', async (req, res) => {
    try {
        const questionId = parseInt(req.params.id);
        const question = await Database.getQuestionById(questionId);
        
        if (!question) {
            return res.status(404).json({ error: '질문을 찾을 수 없습니다.' });
        }
        
        res.json(question);
    } catch (error) {
        console.error('질문 조회 오류:', error);
        res.status(500).json({ error: '질문을 불러오는데 실패했습니다.' });
    }
});

// 질문 삭제
app.delete('/api/questions/:id', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
    
    const questionId = parseInt(req.params.id);
    
    try {
        // 질문 존재 확인 및 권한 확인
        const question = await Database.getQuestionById(questionId);
        if (!question) {
            return res.status(404).json({ error: '질문을 찾을 수 없습니다.' });
        }
        
        // 관리자가 아니고 본인 질문이 아닌 경우 삭제 불가
        if (question.user_id !== req.user.id && !['admin', 'super_admin', 'moderator'].includes(req.user.role)) {
            return res.status(403).json({ error: '자신의 질문만 삭제할 수 있습니다.' });
        }
        
        await Database.deleteQuestion(questionId);
        res.json({ message: '질문이 삭제되었습니다.' });
    } catch (error) {
        console.error('질문 삭제 오류:', error);
        res.status(500).json({ error: '질문 삭제에 실패했습니다.' });
    }
});

// 답변 수정
app.put('/api/answers/:id', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
    
    const answerId = parseInt(req.params.id);
    const { content } = req.body;
    
    if (!content) {
        return res.status(400).json({ error: '답변 내용은 필수입니다.' });
    }
    
    try {
        // 답변 존재 확인 및 권한 확인
        const answer = await Database.getAnswerById(answerId);
        if (!answer) {
            return res.status(404).json({ error: '답변을 찾을 수 없습니다.' });
        }
        
        if (answer.user_id !== req.user.id) {
            return res.status(403).json({ error: '자신의 답변만 수정할 수 있습니다.' });
        }
        
        await Database.updateAnswer(answerId, content.trim());
        res.json({ message: '답변이 수정되었습니다.' });
    } catch (error) {
        console.error('답변 수정 오류:', error);
        res.status(500).json({ error: '답변 수정에 실패했습니다.' });
    }
});

// 개별 답변 조회
app.get('/api/answers/:id', async (req, res) => {
    try {
        const answerId = parseInt(req.params.id);
        const answer = await Database.getAnswerById(answerId);
        
        if (!answer) {
            return res.status(404).json({ error: '답변을 찾을 수 없습니다.' });
        }
        
        res.json(answer);
    } catch (error) {
        console.error('답변 조회 오류:', error);
        res.status(500).json({ error: '답변을 불러오는데 실패했습니다.' });
    }
});

// 답변 삭제
app.delete('/api/answers/:id', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
    
    const answerId = parseInt(req.params.id);
    
    try {
        // 답변 존재 확인 및 권한 확인
        const answer = await Database.getAnswerById(answerId);
        if (!answer) {
            return res.status(404).json({ error: '답변을 찾을 수 없습니다.' });
        }
        
        // 관리자가 아니고 본인 답변이 아닌 경우 삭제 불가
        if (answer.user_id !== req.user.id && !['admin', 'super_admin', 'moderator'].includes(req.user.role)) {
            return res.status(403).json({ error: '자신의 답변만 삭제할 수 있습니다.' });
        }
        
        await Database.deleteAnswer(answerId);
        res.json({ message: '답변이 삭제되었습니다.' });
    } catch (error) {
        console.error('답변 삭제 오류:', error);
        res.status(500).json({ error: '답변 삭제에 실패했습니다.' });
    }
});

// ========== 관리자 API ==========

// 관리자 대시보드 통계
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const stats = await Database.getAdminStats();
        res.json(stats);
    } catch (error) {
        console.error('관리자 통계 조회 오류:', error);
        res.status(500).json({ error: '통계를 불러올 수 없습니다.' });
    }
});

// 사용자 목록 조회
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        const users = await Database.getAllUsers(limit, offset);
        res.json(users);
    } catch (error) {
        console.error('사용자 목록 조회 오류:', error);
        res.status(500).json({ error: '사용자 목록을 불러올 수 없습니다.' });
    }
});

// 사용자 상태 변경 (정지/차단)
app.put('/api/admin/users/:id/status', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { status, reason, suspendedUntil } = req.body;
        
        if (!['active', 'suspended', 'banned'].includes(status)) {
            return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
        }
        
        // 디버깅: 정지 정보 확인
        console.log('🔍 정지 설정:', {
            userId,
            status,
            reason,
            suspendedUntil,
            suspendedUntilType: typeof suspendedUntil
        });
        
        await Database.updateUserStatus(userId, status, reason, suspendedUntil);
        
        // 관리자 로그 기록
        const actionType = status === 'suspended' ? 'user_suspend' : 
                          status === 'banned' ? 'user_ban' : 'user_unban';
        await Database.logAdminAction(
            req.user.id, 
            actionType, 
            'user', 
            userId, 
            reason,
            { suspendedUntil }
        );
        
        res.json({ message: '사용자 상태가 변경되었습니다.' });
    } catch (error) {
        console.error('사용자 상태 변경 오류:', error);
        res.status(500).json({ error: '사용자 상태 변경에 실패했습니다.' });
    }
});

// 사용자 역할 변경
app.put('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { role } = req.body;
        
        if (!['user', 'moderator', 'admin', 'super_admin'].includes(role)) {
            return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
        }
        
        await Database.updateUserRole(userId, role);
        
        // 관리자 로그 기록
        await Database.logAdminAction(
            req.user.id, 
            'role_change', 
            'user', 
            userId, 
            null,
            { newRole: role }
        );
        
        res.json({ message: '사용자 역할이 변경되었습니다.' });
    } catch (error) {
        console.error('사용자 역할 변경 오류:', error);
        res.status(500).json({ error: '사용자 역할 변경에 실패했습니다.' });
    }
});

// 질문 숨기기/복원
app.put('/api/admin/questions/:id/status', requireAdmin, async (req, res) => {
    try {
        const questionId = parseInt(req.params.id);
        const { status, reason } = req.body;
        
        if (!['active', 'hidden'].includes(status)) {
            return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
        }
        
        await Database.updateQuestionStatus(questionId, status, req.user.id, reason);
        
        // 관리자 로그 기록
        const actionType = status === 'hidden' ? 'question_hide' : 'question_restore';
        await Database.logAdminAction(
            req.user.id, 
            actionType, 
            'question', 
            questionId.toString(), 
            reason
        );
        
        res.json({ message: '질문 상태가 변경되었습니다.' });
    } catch (error) {
        console.error('질문 상태 변경 오류:', error);
        res.status(500).json({ error: '질문 상태 변경에 실패했습니다.' });
    }
});

// 답변 숨기기/복원
app.put('/api/admin/answers/:id/status', requireAdmin, async (req, res) => {
    try {
        const answerId = parseInt(req.params.id);
        const { status, reason } = req.body;
        
        if (!['active', 'hidden'].includes(status)) {
            return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
        }
        
        await Database.updateAnswerStatus(answerId, status, req.user.id, reason);
        
        // 관리자 로그 기록
        const actionType = status === 'hidden' ? 'answer_hide' : 'answer_restore';
        await Database.logAdminAction(
            req.user.id, 
            actionType, 
            'answer', 
            answerId.toString(), 
            reason
        );
        
        res.json({ message: '답변 상태가 변경되었습니다.' });
    } catch (error) {
        console.error('답변 상태 변경 오류:', error);
        res.status(500).json({ error: '답변 상태 변경에 실패했습니다.' });
    }
});

// 관리자 로그 조회
app.get('/api/admin/logs', requireAdmin, async (req, res) => {
    try {
        console.log('관리자 로그 조회 요청:', req.query);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;
        
        console.log(`관리자 로그 조회 파라미터: page=${page}, limit=${limit}, offset=${offset}`);
        
        const logs = await Database.getAdminLogs(limit, offset);
        console.log(`관리자 로그 조회 완료: ${logs.length}개`);
        
        res.json(logs);
    } catch (error) {
        console.error('관리자 로그 조회 오류:', error);
        res.status(500).json({ error: '관리자 로그를 불러올 수 없습니다.' });
    }
});

// 관리자 권한 확인
app.get('/api/admin/check', requireAdmin, (req, res) => {
    res.json({ 
        isAdmin: true, 
        userId: req.user.id,
        role: req.user.role 
    });
});

// 수동 서버 초기화 (관리자용)
app.post('/api/admin/initialize', requireAdmin, async (req, res) => {
    try {
        console.log('🔧 관리자에 의한 수동 서버 초기화 시작...');
        
        // 서버 초기화 실행
        await initializeServer();
        
        // 관리자 로그 기록
        await Database.logAdminAction(
            req.user.id, 
            'server_initialize', 
            'system', 
            'server', 
            '수동 서버 초기화 실행'
        );
        
        console.log('✅ 수동 서버 초기화 완료');
        
        res.json({ 
            success: true, 
            message: '서버 초기화가 완료되었습니다.',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ 수동 서버 초기화 실패:', error);
        
        // 관리자 로그 기록
        await Database.logAdminAction(
            req.user.id, 
            'server_initialize_failed', 
            'system', 
            'server', 
            `초기화 실패: ${error.message}`
        );
        
        res.status(500).json({ 
            error: '서버 초기화에 실패했습니다.',
            details: error.message 
        });
    }
});

// 서버 상태 확인 (관리자용)
app.get('/api/admin/status', requireAdmin, async (req, res) => {
    try {
        const pool = require('./database/connection');
        
        // 데이터베이스 연결 상태 확인
        const [dbStatus] = await pool.execute('SELECT 1 as connected');
        
        // 기본 테이블 존재 확인
        const [tables] = await pool.execute(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE()
        `);
        
        const tableNames = tables.map(t => t.TABLE_NAME);
        const requiredTables = ['users', 'questions', 'answers', 'reports'];
        const missingTables = requiredTables.filter(table => !tableNames.includes(table));
        
        res.json({
            success: true,
            server: {
                status: 'running',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date().toISOString()
            },
            database: {
                connected: dbStatus.length > 0,
                tables: {
                    total: tableNames.length,
                    required: requiredTables.length,
                    missing: missingTables,
                    all: tableNames
                }
            },
            features: {
                geminiAI: geminiAI.enabled,
                securityLogger: !!securityLogger,
                pointsSystem: true,
                levelSystem: true,
                reportSystem: true
            }
        });
    } catch (error) {
        console.error('서버 상태 확인 오류:', error);
        res.status(500).json({ 
            error: '서버 상태 확인에 실패했습니다.',
            details: error.message 
        });
    }
});

// 서버 시작 시 자동 마이그레이션
async function startServer() {
    try {
        // 데이터베이스 연결 확인
        await ensureSuspendedAtColumn();
        console.log('✅ MySQL 데이터베이스 연결 성공!');
        
        // 서버 초기화는 수동으로 제어 (자동 실행 안함)
        console.log('💡 서버 초기화는 /api/admin/initialize 명령어로 수동 실행 가능합니다.');
        
        // 서버 시작
        app.listen(PORT, () => {
            console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
            console.log('🎮 마이페이지 개선 및 레벨업 시스템이 활성화되었습니다!');
        });
    } catch (error) {
        console.error('❌ 서버 시작 실패:', error);
        process.exit(1);
    }
}

// suspended_at 컬럼 확인 및 추가 함수
async function ensureSuspendedAtColumn() {
    const pool = require('./database/connection');
    let connection;
    
    try {
        connection = await pool.getConnection();
        
        // suspended_at 컬럼 존재 여부 확인
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'suspended_at'
        `);
        
        if (columns.length === 0) {
            console.log('📝 suspended_at 컬럼 추가 중...');
            
            // suspended_at 컬럼 추가
            await connection.execute(`
                ALTER TABLE users
                ADD COLUMN suspended_at TIMESTAMP NULL
            `);
            
            console.log('✅ suspended_at 컬럼 추가 완료');
            
            // 기존 정지 사용자들의 suspended_at을 updated_at으로 설정
            await connection.execute(`
                UPDATE users
                SET suspended_at = updated_at
                WHERE status IN ('suspended', 'banned') AND suspended_at IS NULL
            `);
            
            console.log('✅ 기존 정지 사용자들의 정지 시작일 설정 완료');
        } else {
            console.log('✅ suspended_at 컬럼이 이미 존재합니다');
        }
        
    } catch (error) {
        console.error('❌ 스키마 확인 실패:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

// AI 채팅 엔드포인트
app.post('/api/ai-chat', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }
        
        const { message } = req.body;
        
        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: '메시지를 입력해주세요.' });
        }
        
        if (!geminiAI.enabled) {
            return res.status(503).json({ error: 'AI 서비스가 현재 사용할 수 없습니다. GEMINI_API_KEY를 설정해주세요.' });
        }
        
        console.log(`AI 채팅 요청 - 사용자: ${req.user.id}, 메시지: ${message.substring(0, 50)}...`);
        
        // Gemini AI로 채팅 응답 생성
        const aiResponse = await geminiAI.analyzeTextQuestion(message, []);
        
        console.log('AI 채팅 응답 생성 완료');
        
        res.json({ 
            success: true, 
            response: aiResponse,
            message: 'AI 응답이 생성되었습니다.'
        });
    } catch (error) {
        console.error('AI 채팅 오류:', error);
        res.status(500).json({ error: 'AI 채팅에 실패했습니다.' });
    }
});

// AI 질문 엔드포인트 (포인트 차감)
app.post('/api/ai-question', upload.array('images', 3), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }
        
        const { question } = req.body;
        const images = req.files || [];
        
        if (!question || question.trim().length === 0) {
            return res.status(400).json({ error: '질문을 입력해주세요.' });
        }
        
        if (!geminiAI.enabled) {
            return res.status(503).json({ error: 'AI 서비스가 현재 사용할 수 없습니다. GEMINI_API_KEY를 설정해주세요.' });
        }
        
        // 사용자 포인트 확인
        const userPoints = await Database.getUserPoints(req.user.id);
        if (!userPoints || !userPoints.canAskAI) {
            return res.status(402).json({ 
                error: '포인트가 부족합니다.', 
                needed: userPoints?.needed || 50 
            });
        }
        
        console.log(`AI 질문 요청 - 사용자: ${req.user.id}, 포인트: ${userPoints.current}, 질문: ${question.substring(0, 50)}..., 이미지: ${images.length}개`);
        
        // 포인트 차감
        const PointsSystem = require('./utils/points-system');
        const pointCost = PointsSystem.getPointRewards().AI_QUESTION_COST;
        await Database.deductUserPoints(req.user.id, pointCost);
        
        // Gemini AI로 질문 분석 및 답변 생성
        let aiResponse;
        if (images.length > 0) {
            // 이미지가 있는 경우
            const imageUrls = images.map(file => `/uploads/${file.filename}`);
            aiResponse = await geminiAI.analyzeQuestionWithImage(question, imageUrls);
        } else {
            // 텍스트만 있는 경우
            aiResponse = await geminiAI.analyzeTextQuestion(question, []);
        }
        
        console.log('AI 질문 응답 생성 완료');
        
        res.json({ 
            success: true, 
            answer: aiResponse,
            message: 'AI 답변이 생성되었습니다.',
            pointsUsed: pointCost,
            remainingPoints: userPoints.current - pointCost
        });
    } catch (error) {
        console.error('AI 질문 오류:', error);
        res.status(500).json({ error: 'AI 질문에 실패했습니다.' });
    }
});

// ========== 신고 관련 API ==========

// 신고 생성
app.post('/api/reports', csrfProtection, validateReport, handleValidationErrors, async (req, res) => {
    try {
        const { targetType, targetId, reason, description } = req.body;

        if (!req.user) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }

        const userId = req.user.id;

        if (!targetType || !targetId || !reason) {
            return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
        }

        // 유효한 reason인지 확인
        const validReasons = ['spam', 'inappropriate', 'harassment', 'violence', 'copyright', 'other'];
        if (!validReasons.includes(reason)) {
            return res.status(400).json({ error: '유효하지 않은 신고 사유입니다.' });
        }

        const reportId = await Database.createReport(userId, targetType, targetId, reason, description);
        
        res.json({ 
            success: true, 
            message: '신고가 접수되었습니다.',
            reportId: reportId
        });
    } catch (error) {
        console.error('신고 생성 오류:', error);
        if (error.message === '이미 신고한 게시물입니다.') {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: '신고 접수에 실패했습니다.' });
    }
});

// 캘린더 이벤트 목록 조회
app.get('/api/calendar/events', async (req, res) => {
    try {
        const events = await Database.getCalendarEvents();
        res.json(events);
    } catch (error) {
        console.error('캘린더 이벤트 조회 오류:', error);
        res.status(500).json({ error: '이벤트 조회에 실패했습니다.' });
    }
});

// 캘린더 이벤트 추가 (관리자용)
app.post('/api/calendar/events', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }

        const user = await Database.findUserById(req.user.id);
        if (!user || !['admin', 'moderator', 'super_admin'].includes(user.role)) {
            return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
        }

        const { title, date, time, description } = req.body;
        
        if (!title || !date || !time) {
            return res.status(400).json({ error: '제목, 날짜, 시간은 필수입니다.' });
        }

        const eventId = await Database.createCalendarEvent(title, date, time, description);
        res.json({ success: true, eventId });
    } catch (error) {
        console.error('캘린더 이벤트 생성 오류:', error);
        res.status(500).json({ error: '이벤트 생성에 실패했습니다.' });
    }
});

// 캘린더 이벤트 수정 (관리자용)
app.put('/api/calendar/events/:id', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }

        const user = await Database.findUserById(req.user.id);
        if (!user || !['admin', 'moderator', 'super_admin'].includes(user.role)) {
            return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
        }

        const { title, date, time, description } = req.body;
        const eventId = req.params.id;
        
        if (!title || !date || !time) {
            return res.status(400).json({ error: '제목, 날짜, 시간은 필수입니다.' });
        }

        await Database.updateCalendarEvent(eventId, title, date, time, description);
        res.json({ success: true });
    } catch (error) {
        console.error('캘린더 이벤트 수정 오류:', error);
        res.status(500).json({ error: '이벤트 수정에 실패했습니다.' });
    }
});

// 캘린더 이벤트 삭제 (관리자용)
app.delete('/api/calendar/events/:id', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }

        const user = await Database.findUserById(req.user.id);
        if (!user || !['admin', 'moderator', 'super_admin'].includes(user.role)) {
            return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
        }

        const eventId = req.params.id;
        await Database.deleteCalendarEvent(eventId);
        res.json({ success: true });
    } catch (error) {
        console.error('캘린더 이벤트 삭제 오류:', error);
        res.status(500).json({ error: '이벤트 삭제에 실패했습니다.' });
    }
});

// 신고 목록 조회 (관리자용)
app.get('/api/reports', async (req, res) => {
    try {
        console.log('신고 목록 조회 요청:', req.query);
        console.log('사용자 정보:', req.user);
        
        if (!req.user) {
            console.log('사용자가 로그인되지 않음');
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }

        const user = await Database.findUserById(req.user.id);
        console.log('데이터베이스에서 조회한 사용자:', user);

        if (!user || !['admin', 'moderator', 'super_admin'].includes(user.role)) {
            console.log('관리자 권한 없음:', user?.role);
            return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
        }

        const { status = 'pending', page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        console.log('신고 조회 파라미터:', { status, page, limit, offset });

        const reports = await Database.getReports(status, parseInt(limit), parseInt(offset));
        console.log('조회된 신고 개수:', reports.length);
        
        res.json({ 
            success: true, 
            reports: reports
        });
    } catch (error) {
        console.error('신고 목록 조회 오류:', error);
        res.status(500).json({ error: '신고 목록을 불러오는데 실패했습니다.' });
    }
});

// 신고 상태 업데이트 (관리자용)
app.put('/api/reports/:reportId', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }

        const user = await Database.findUserById(req.user.id);

        if (!user || !['admin', 'moderator', 'super_admin'].includes(user.role)) {
            return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
        }

        const { reportId } = req.params;
        const { status, adminNotes } = req.body;

        const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
        }

        await Database.updateReportStatus(reportId, status, req.user.id, adminNotes);
        
        res.json({ 
            success: true, 
            message: '신고 상태가 업데이트되었습니다.'
        });
    } catch (error) {
        console.error('신고 상태 업데이트 오류:', error);
        res.status(500).json({ error: '신고 상태 업데이트에 실패했습니다.' });
    }
});

// 점수 랭킹 API
app.get('/api/ranking/score', async (req, res) => {
    try {
        console.log('점수 랭킹 API 요청됨');
        const pool = require('./database/connection');
        const [rankings] = await pool.execute(`
            SELECT id, display_name, score, level, experience, points
            FROM users 
            WHERE status = 'active'
            ORDER BY score DESC, experience DESC
            LIMIT 50
        `);
        
        console.log(`점수 랭킹 조회 완료: ${rankings.length}명`);
        res.json(rankings);
    } catch (error) {
        console.error('점수 랭킹 조회 실패:', error);
        res.status(500).json({ error: '랭킹 정보를 조회할 수 없습니다.' });
    }
});

// 레벨 랭킹 API
app.get('/api/ranking/level', async (req, res) => {
    try {
        console.log('레벨 랭킹 API 요청됨');
        const pool = require('./database/connection');
        const [rankings] = await pool.execute(`
            SELECT id, display_name, score, level, experience, points
            FROM users 
            WHERE status = 'active'
            ORDER BY level DESC, experience DESC, score DESC
            LIMIT 50
        `);
        
        console.log(`레벨 랭킹 조회 완료: ${rankings.length}명`);
        res.json(rankings);
    } catch (error) {
        console.error('레벨 랭킹 조회 실패:', error);
        res.status(500).json({ error: '랭킹 정보를 조회할 수 없습니다.' });
    }
});

// 사용자 랭킹 정보 API
app.get('/api/user/ranking', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }
    try {
        const userId = req.user.id;
        
        // 사용자의 현재 점수와 레벨 정보 조회
        const [userInfo] = await pool.execute(`
            SELECT score, level, experience, points
            FROM users 
            WHERE id = ?
        `, [userId]);
        
        if (userInfo.length === 0) {
            return res.status(404).json({ error: '사용자 정보를 찾을 수 없습니다.' });
        }
        
        const user = userInfo[0];
        
        // 점수 기준 랭킹에서의 순위 조회
        const [scoreRankResult] = await pool.execute(`
            SELECT COUNT(*) + 1 as rank
            FROM users 
            WHERE status = 'active' AND score > ?
        `, [user.score]);
        
        // 레벨 기준 랭킹에서의 순위 조회
        const [levelRankResult] = await pool.execute(`
            SELECT COUNT(*) + 1 as rank
            FROM users 
            WHERE status = 'active' AND (level > ? OR (level = ? AND experience > ?))
        `, [user.level, user.level, user.experience]);
        
        const userRanking = {
            score: user.score,
            level: user.level,
            experience: user.experience,
            points: user.points,
            scoreRank: scoreRankResult[0].rank,
            levelRank: levelRankResult[0].rank
        };
        
        console.log(`사용자 랭킹 정보 조회 완료: ${req.user.displayName} (점수 ${user.score}, 레벨 ${user.level})`);
        res.json(userRanking);
    } catch (error) {
        console.error('사용자 랭킹 정보 조회 실패:', error);
        res.status(500).json({ error: '랭킹 정보를 조회할 수 없습니다.' });
    }
});

// 404 에러 처리 (모든 라우트 다음에 위치)
app.use((req, res) => {
    securityLogger.logSuspiciousActivity('404 Not Found', req);
    res.status(404).json({
        error: '요청한 리소스를 찾을 수 없습니다.'
    });
});

// 서버 시작
startServer();