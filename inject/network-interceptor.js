/**
 * ==========================================
 * 网络请求拦截器 (Network Interceptor)
 * 运行于 MAIN World，负责拦截遥测数据、净化信息流 API 及视频 CDN 优选
 * ==========================================
 */
(function() {
    // 动态读取本地配置状态
    const isMasterOn = () => localStorage.getItem('newb_master_switch') !== 'false';

    // 静态规则常量库
    const BLOCKED_URLS =['cm.bilibili.com/cm/api/fees/pc', 'data.bilibili.com/v2/log/web', 'data.bilibili.com/log/web'];
    const FEED_API = 'api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd';

    /* ==========================================
     * 1. Fetch API 拦截器 (信息流净化 & 遥测拦截)
     * ========================================== */
    const originalFetch = window.fetch;
    
    window.fetch = async function(input, init) {
        if (!isMasterOn()) return originalFetch(input, init);
        
        // 兼容 Request 对象与字符串 URL
        const urlStr = typeof input === 'string' ? input : (input?.url || '');

        // 1.1 拦截遥测与广告追踪请求
        if (BLOCKED_URLS.some(blocked => urlStr.includes(blocked))) {
            return Promise.reject(new Error("Blocked telemetry by newB"));
        }

        // 1.2 拦截并净化首页推荐流 (剔除广告与直播卡片)
        if (urlStr.includes(FEED_API)) {
            try {
                const response = await originalFetch(input, init);
                const clone = response.clone();
                const json = await clone.json();

                if (json.data?.item) {
                    // 核心过滤逻辑：移除 goto 为 ad/live 及特定广告类型的卡片
                    json.data.item = json.data.item.filter(item => 
                        !['ad', 'live'].includes(item.goto) && item.card_type !== 'ad_web_s'
                    );
                    
                    // 重构 Response 对象返回给业务层
                    return new Response(JSON.stringify(json), { 
                        status: response.status, 
                        statusText: response.statusText, 
                        headers: response.headers 
                    });
                }
                return response;
            } catch (e) {
                // 解析失败时降级放行，保障页面可用性
                return originalFetch(input, init);
            }
        }

        return originalFetch(input, init);
    };

    /* ==========================================
     * 2. XHR 拦截器 (仅保留遥测拦截)
     * ========================================== */
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._newbUrl = url;
        return originalXhrOpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
        // 拦截 XHR 遥测请求
        if (isMasterOn() && typeof this._newbUrl === 'string' && BLOCKED_URLS.some(blocked => this._newbUrl.includes(blocked))) {
            this.abort();
            return;
        }
        return originalXhrSend.apply(this, args);
    };

    console.log('newB: Network Interceptor Active');
})();