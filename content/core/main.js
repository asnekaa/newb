(function() {
    let domObserver = null;
    let debounceTimer = null;
    let activeConfig = null; // 维护全局最新配置状态

    /**
     * 解析当前页面路由上下文
     */
    const getContext = () => {
        const path = location.pathname;
        const host = location.hostname;
        const isHome =['/', '/index.html'].includes(path) || (host === 'www.bilibili.com' && path === '/');
        const isPlay = path.startsWith('/video/') || path.startsWith('/list/');
        return { isHome, isPlay, shouldRunFilter: isHome || isPlay };
    };

    /**
     * 核心执行逻辑：调度清理与过滤引擎
     */
    const executeEngines = (config) => {
        const { shouldRunFilter } = getContext();
        if (!shouldRunFilter || config.masterSwitch === false) return;

        // 1. 执行静态与动态广告/直播清理
        window.newbCleanup?.run(config);
        
        // 2. 遍历并处理所有视频卡片 (应用标题/UP主/标签等过滤规则)
        const cards = document.querySelectorAll('.feed-card, .bili-video-card, .video-card, .video-page-card-small');
        cards.forEach(card => window.newbFilter?.processCard(card));
    };

    /**
     * 防抖包装器：避免 DOM 频繁变动导致性能瓶颈
     */
    const debouncedExecute = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (activeConfig) executeEngines(activeConfig);
        }, 300);
    };

    /**
     * 系统启动引导程序
     */
    const bootstrap = async () => {
        activeConfig = await window.newbConfigManager.loadConfig();
        const { shouldRunFilter } = getContext();

        // 1. 初始化 UI 引擎 (同步执行以防页面闪烁)
        window.newbUIEngine?.update(activeConfig);

        // 2. 定时轮询 Dark♂ 模式状态 (每分钟检查一次时间区间)
        setInterval(async () => {
            activeConfig = await window.newbConfigManager.loadConfig();
            window.newbUIEngine?.update(activeConfig);
        }, 60000);

        // 3. 按需初始化业务模块
        if (shouldRunFilter && activeConfig.masterSwitch !== false) {
            window.newbCleanup?.run(activeConfig);
            window.newbFilter?.updateConfig(activeConfig);
        }
        window.newbVideoInfoHover?.updateConfig(activeConfig);
        window.newbUserInfoHover?.updateConfig(activeConfig);
        window.newbCoverViewer?.updateConfig(activeConfig);

        // 4. 建立 DOM 监听 (处理 SPA 架构下的动态内容加载)
        if (!domObserver) {
            domObserver = new MutationObserver((mutations) => {
                // 仅当有新节点插入时触发，过滤无关的属性变化以提升性能
                if (mutations.some(m => m.addedNodes.length > 0)) {
                    debouncedExecute();
                }
            });
            domObserver.observe(document.documentElement, { childList: true, subtree: true });
        }

        // 5. 首次执行
        executeEngines(activeConfig);
    };

    /**
     * 配置热更新监听 (无需刷新页面即刻生效)
     */
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.newb_settings_v1) return;
        
        const newConfig = changes.newb_settings_v1.newValue;
        if (!newConfig) return;

        activeConfig = newConfig; // 更新全局配置引用

        // 更新各独立模块配置
        window.newbUIEngine?.update(activeConfig);
        window.newbVideoInfoHover?.updateConfig(activeConfig);
        window.newbUserInfoHover?.updateConfig(activeConfig);
        window.newbCoverViewer?.updateConfig(activeConfig);

        const { shouldRunFilter } = getContext();
        if (shouldRunFilter) {
            // 状态重置：恢复被隐藏的卡片，以便重新应用新的过滤规则
            document.querySelectorAll('[data-newb-processed="true"]').forEach(el => {
                el.dataset.newbProcessed = 'false';
                const outer = el.closest('.feed-card, .bili-feed-card, .video-card, .video-page-card-small') || el;
                outer.style.display = '';
            });

            if (activeConfig.masterSwitch === false) {
                window.newbCleanup?.stop();
            } else {
                window.newbCleanup?.run(activeConfig);
                window.newbFilter?.updateConfig(activeConfig);
                executeEngines(activeConfig);
            }
        }
    });
    
    // 优先利用缓存配置极速初始化 UI，防止深色模式闪屏
    window.newbConfigManager.loadConfig().then(cfg => window.newbUIEngine?.update(cfg));
    
    // 确保在 DOM 准备就绪后挂载核心逻辑
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();