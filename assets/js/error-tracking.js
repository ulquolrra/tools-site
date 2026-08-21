// 错误监控系统
// 支持多种错误捕获方式：全局错误、Promise错误、资源加载错误

(function() {
    'use strict';

    // 配置项
    const config = {
        // 错误日志存储键名
        storageKey: 'alltoolsbox_errors',
        // 最大存储错误数
        maxErrors: 50,
        // 是否启用Sentry（如果配置了DSN）
        sentryEnabled: false,
        sentryDsn: '',
        // 是否启用本地存储
        localStorageEnabled: true
    };

    // 错误信息结构
    function createErrorInfo(error, context) {
        return {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            message: error.message || String(error),
            stack: error.stack || '',
            type: context.type || 'error',
            context: context.context || {}
        };
    }

    // 存储错误到本地
    function storeError(errorInfo) {
        if (!config.localStorageEnabled) return;

        try {
            let errors = JSON.parse(localStorage.getItem(config.storageKey)) || [];
            errors.push(errorInfo);
            
            // 保持最新的maxErrors个错误
            if (errors.length > config.maxErrors) {
                errors = errors.slice(-config.maxErrors);
            }
            
            localStorage.setItem(config.storageKey, JSON.stringify(errors));
        } catch (e) {
            console.warn('无法保存错误日志到localStorage:', e);
        }
    }

    // 发送错误到Sentry
    function sendToSentry(errorInfo) {
        if (!config.sentryEnabled || !config.sentryDsn || typeof Sentry === 'undefined') {
            return;
        }
        
        try {
            Sentry.captureException(errorInfo.message, {
                extra: errorInfo
            });
        } catch (e) {
            console.warn('Sentry错误发送失败:', e);
        }
    }

    // 错误处理器
    function handleError(error, context = {}) {
        const errorInfo = createErrorInfo(error, context);
        
        // 发送到Sentry
        sendToSentry(errorInfo);
        
        // 存储到本地
        storeError(errorInfo);
        
        // 控制台输出
        console.error('AllToolsBox错误:', errorInfo.message, errorInfo.stack);
    }

    // 全局错误监听
    window.addEventListener('error', function(event) {
        handleError(event.error || new Error(event.message), {
            type: 'global_error',
            context: {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            }
        });
    });

    // 未捕获的Promise拒绝
    window.addEventListener('unhandledrejection', function(event) {
        handleError(event.reason || new Error('Promise rejection'), {
            type: 'promise_rejection'
        });
    });

    // 资源加载错误（图片、脚本、样式表等）
    window.addEventListener('error', function(event) {
        if (event.target && event.target.tagName) {
            // 忽略广告脚本加载错误
            const src = event.target.src || event.target.href || '';
            if (src.includes('adsbygoogle.js') || src.includes('googlesyndication.com')) {
                return; // 不处理广告脚本错误
            }
            handleError(new Error(`资源加载失败: ${event.target.tagName}`), {
                type: 'resource_error',
                context: {
                    tag: event.target.tagName,
                    src: src
                }
            });
        }
    }, true);

    // 手动报告错误的API
    window.reportError = function(error, customContext) {
        handleError(error, customContext || {});
    };

    // 导出配置函数，用于动态配置Sentry等
    window.configureErrorTracking = function(options) {
        if (options) {
            Object.assign(config, options);
            
            // 如果启用Sentry且有DSN，则初始化
            if (config.sentryEnabled && config.sentryDsn && typeof Sentry !== 'undefined') {
                Sentry.init({ dsn: config.sentryDsn });
            }
        }
        return config;
    };

    // 自动初始化 - 尝试从data属性获取配置
    const errorConfigEl = document.getElementById('error-tracking-config');
    if (errorConfigEl) {
        const dsn = errorConfigEl.dataset.sentryDsn;
        const enabled = errorConfigEl.dataset.sentryEnabled === 'true';
        
        if (dsn) {
            config.sentryDsn = dsn;
            config.sentryEnabled = enabled;
            
            if (enabled && typeof Sentry !== 'undefined') {
                Sentry.init({ dsn: dsn });
            }
        }
    }
})();
