/**
 * 보안 이벤트 로깅 시스템
 * 의심스러운 활동이나 보안 위협을 모니터링합니다.
 */

const fs = require('fs');
const path = require('path');

class SecurityLogger {
    constructor() {
        this.logFile = path.join(__dirname, '../logs/security.log');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    formatLogEntry(level, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        const ip = metadata.ip || 'unknown';
        const userAgent = metadata.userAgent || 'unknown';
        const userId = metadata.userId || 'anonymous';
        
        return JSON.stringify({
            timestamp,
            level,
            message,
            ip,
            userAgent,
            userId,
            metadata
        }) + '\n';
    }

    writeLog(level, message, metadata = {}) {
        const logEntry = this.formatLogEntry(level, message, metadata);
        
        // 콘솔에 출력 (개발 환경)
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[${level.toUpperCase()}] ${message}`, metadata);
        }
        
        // 파일에 기록
        fs.appendFileSync(this.logFile, logEntry);
    }

    // 보안 이벤트 로깅 메서드들
    logSuspiciousActivity(message, req, additionalData = {}) {
        this.writeLog('WARNING', message, {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id,
            url: req.originalUrl,
            method: req.method,
            ...additionalData
        });
    }

    logFailedAuth(message, req, additionalData = {}) {
        this.writeLog('ERROR', message, {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id,
            url: req.originalUrl,
            method: req.method,
            ...additionalData
        });
    }

    logRateLimitExceeded(req, limit, windowMs) {
        this.writeLog('WARNING', 'Rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id,
            url: req.originalUrl,
            method: req.method,
            limit,
            windowMs
        });
    }

    logFileUploadAttempt(req, fileName, fileSize, success, reason = null) {
        this.writeLog(success ? 'INFO' : 'WARNING', 'File upload attempt', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id,
            fileName,
            fileSize,
            success,
            reason
        });
    }

    logAdminAction(adminId, action, targetType, targetId, additionalData = {}) {
        this.writeLog('INFO', 'Admin action performed', {
            adminId,
            action,
            targetType,
            targetId,
            ...additionalData
        });
    }

    logValidationError(req, errors) {
        this.writeLog('WARNING', 'Input validation failed', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id,
            url: req.originalUrl,
            method: req.method,
            errors
        });
    }

    logSecurityThreat(threatType, message, req, additionalData = {}) {
        this.writeLog('CRITICAL', `Security threat detected: ${threatType}`, {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id,
            url: req.originalUrl,
            method: req.method,
            threatType,
            message,
            ...additionalData
        });
    }
}

// 싱글톤 인스턴스
const securityLogger = new SecurityLogger();

module.exports = securityLogger;
