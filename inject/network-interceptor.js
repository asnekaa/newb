/**
 * ==========================================
 * 网络请求拦截器 (Network Interceptor)
 * 运行于 MAIN World，负责拦截遥测数据、净化信息流 API 及视频 CDN 优选
 * ==========================================
 */
(function() {
    // 动态读取本地配置状态
    const isMasterOn = () => localStorage.getItem('newb_master_switch') !== 'false';
    const isCdnOptEnabled = () => isMasterOn() && localStorage.getItem('newb_optimize_cdn') === 'true';

    // 静态规则常量库
    const BLOCKED_URLS =['cm.bilibili.com/cm/api/fees/pc', 'data.bilibili.com/v2/log/web', 'data.bilibili.com/log/web'];
    const FEED_API = 'api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd';
    const BAD_CDNS =["mcdn.bilivideo", "edge.mountaintoys.cn"];
    const DEGRADED_CDN_REGEX = /:\/\/cn-.+\.bilivideo\.com/;
    const PLAYURL_APIS =[
        "https://api.bilibili.com/x/player/wbi/playurl", 
        "https://api.bilibili.com/pgc/player/web/v2/playurl", 
        "https://api.bilibili.com/ogv/player/playview"
    ];

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
     * 2. XHR 拦截器与 CDN 优选引擎
     * ========================================== */
    let dashData = {};
    const urlCache = new Map();

    /**
     * 深度提取视频流 Dash 数据
     * @param {Object} data - API 响应数据
     */
    const extractDash = (data) => {
        dashData = data?.data?.dash || data?.result?.video_info?.dash || data?.data?.video_info?.dash || data?.raw?.data?.video_info?.dash || dashData;
    };

    // 劫持全局 __playinfo__ 变量，获取初始视频流数据
    let playinfoVal;
    Object.defineProperty(window, '__playinfo__', {
        configurable: true,
        enumerable: true,
        get: () => playinfoVal,
        set: (val) => {
            if (isCdnOptEnabled()) extractDash(val);
            playinfoVal = val;
        }
    });

    /**
     * 智能 CDN 优选算法
     * @param {string} originalUrl - 原始请求 URL
     * @returns {string} 优选后的 URL
     */
    const getOptimizedUrl = (originalUrl) => {
        if (urlCache.has(originalUrl)) return urlCache.get(originalUrl);

        // 提取流中所有可用备用节点
        const getAllUrls = (stream) => {
            const urls = new Set();
            if (stream.baseUrl) urls.add(stream.baseUrl);
            if (stream.base_url) urls.add(stream.base_url);
            stream.backupUrl?.forEach(u => u && urls.add(u));
            stream.backup_url?.forEach(u => u && urls.add(u));
            return [...urls];
        };

        // 匹配当前请求对应的流节点集合
        const findStreamUrls = (streams, targetUrl) => {
            if (!streams) return null;
            for (const stream of streams) {
                const urls = getAllUrls(stream);
                if (urls.includes(targetUrl)) {
                    // 剔除黑名单 CDN
                    return urls.filter(u => !BAD_CDNS.some(bad => u.includes(bad)));
                }
            }
            return null;
        };

        let availableUrls = null;
        if (dashData.video && dashData.audio) {
            availableUrls = findStreamUrls(dashData.video, originalUrl) || findStreamUrls(dashData.audio, originalUrl);
        }

        let bestUrl = originalUrl;
        if (availableUrls?.length > 0) {
            // 权重排序：优先使用非降级节点 (非 cn-xxx.bilivideo.com)
            availableUrls.sort((a, b) => (DEGRADED_CDN_REGEX.test(a) ? 1 : 0) - (DEGRADED_CDN_REGEX.test(b) ? 1 : 0));
            bestUrl = availableUrls[0];
        }

        urlCache.set(originalUrl, bestUrl);
        return bestUrl;
    };

    // 劫持 XMLHttpRequest 核心方法
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._newbUrl = url;

        // 2.1 拦截视频流请求并替换为优选 CDN
        if (isCdnOptEnabled() && typeof url === 'string' && url.startsWith('https://') && BAD_CDNS.some(bad => url.includes(bad))) {
            arguments[1] = getOptimizedUrl(url);
        }

        // 2.2 监听播放地址 API 响应，动态更新 Dash 缓存
        this.addEventListener('load', function() {
            if (!isCdnOptEnabled()) return;
            
            if (PLAYURL_APIS.some(api => this.responseURL?.startsWith(api))) {
                try {
                    const responseObj = JSON.parse(this.responseText);
                    extractDash(responseObj);
                    // 覆写 responseText 以防其他脚本读取旧数据
                    Object.defineProperty(this, 'responseText', { value: JSON.stringify(responseObj) });
                } catch (e) {
                    // 忽略解析异常
                }
            }
        });

        return originalXhrOpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
        // 2.3 拦截 XHR 遥测请求
        if (isMasterOn() && typeof this._newbUrl === 'string' && BLOCKED_URLS.some(blocked => this._newbUrl.includes(blocked))) {
            this.abort();
            return;
        }
        return originalXhrSend.apply(this, args);
    };

    console.log('newB: Network Interceptor Active');
})();