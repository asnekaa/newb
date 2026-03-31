/**
 * ==========================================
 * 页面净化引擎 (Cleanup Engine)
 * 负责精准识别并移除信息流中的广告、直播、课程等推广内容
 * ==========================================
 */
class CleanupEngine {
    constructor() {
        this.observer = null;
        
        // 静态特征黑名单：直接命中这些选择器的元素将被无条件移除
        this.staticBlacklist =[
            '.pop-live-small-mode', '.floor-single-card', '.bili-live-card', 
            '.ad-report', '.bili-video-card__info--ad', '.bili-video-card__info--creative-ad', 
            '#bannerAd', '#slide_ad', '#right-bottom-banner', '.video-card-ad-small', 
            '.video-page-game-card-small', '.ad-floor-exp', '.desktop-download-tip'
        ];
    }

    /**
     * 智能提取卡片元数据 (用于拦截日志展示)
     * @param {HTMLElement} card - 视频/推广卡片 DOM 节点
     * @returns {Object} 包含标题、UP主、分类、链接等信息的对象
     */
    extractCardInfo(card) {
        // 1. 提取标题
        const titleEl = card.querySelector('.bili-video-card__info--tit, .title, .video-name, .room-title, .bili-live-card__info--tit, .course-title');
        const title = titleEl?.title || titleEl?.textContent?.trim() || "推广/活动内容";
        
        // 2. 提取视频链接 (排除 javascript: 伪链接)
        const linkEl = card.querySelector('a');
        const videoUrl = (linkEl?.href && !linkEl.href.startsWith('javascript:')) ? linkEl.href : "";

        // 3. 提取 UP 主主页链接
        let upUrl = "";
        const upLinkEl = card.querySelector('a[href*="space.bilibili.com"]');
        if (upLinkEl?.href && !upLinkEl.href.startsWith('javascript:')) {
            upUrl = upLinkEl.href;
        } else {
            const uidNode = card.querySelector('[data-uid], [data-user-id], [data-mid]');
            const uid = uidNode?.dataset.uid || uidNode?.dataset.userId || uidNode?.dataset.mid;
            if (uid) upUrl = `https://space.bilibili.com/${uid}`;
        }

        // 4. 提取 UP 主名称
        const upEl = card.querySelector('.bili-video-card__info--author, .up-name__text, .up-name, .upname .name, .bili-live-card__info--uname, .bili-live-card__info--uname-text, .bili-live-card__info--author, .room-anchor, .name-text, .author-name, .up-info__name, .author');
        let up = upEl?.textContent?.trim() || upLinkEl?.textContent?.trim();
        
        // 兜底：尝试从头像 alt 属性获取 UP 主名称
        if (!up || up === "未知UP") {
            const avatarImg = card.querySelector('.bili-video-card__avatar img, .bili-live-card__avatar img, .avatar img, .up-avatar img, .v-img img');
            up = avatarImg?.alt?.trim() || "未知UP";
        }
        // 清理换行符与多余空格
        up = up.replace(/[\r\n]+/g, '').replace(/\s+/g, ' ').trim();

        // 5. 智能推断内容分类
        let category = "";
        const badges = card.querySelectorAll('.bili-video-card__info--ad, .bili-video-card__info--badge, .bili-live-card__info--badge, .v-img, span, div');
        
        // 5.1 基于角标文本推断
        for (const b of badges) {
            const txt = b.textContent.trim();
            if (["广告", "🔥广告", "优质推广", "赞助"].includes(txt)) { category = "广告"; up = ""; break; }
            if (["直播", "正在直播"].includes(txt)) { category = "直播"; break; }
            if (["番剧", "国创", "电影", "纪录片", "电视剧", "综艺"].includes(txt)) { category = txt; up = ""; break; }
            if (txt.includes("课程") || txt.includes("课堂")) { category = "课程"; break; }
        }

        // 5.2 基于 URL 或 DOM 结构特征推断 (兜底策略)
        if (!category) {
            if (videoUrl.includes('cheese.bilibili.com') || videoUrl.includes('/cheese/')) category = "课程";
            else if (card.classList.contains('bili-live-card') || card.querySelector('.bili-live-card__info--living__icon') || card.querySelector('.pop-live-small-mode') || videoUrl.includes('live.bilibili.com')) category = "直播";
            else if (card.querySelector('svg.vui_icon')?.innerHTML.includes('M13.5')) { category = "广告"; up = ""; } // 识别特定的广告 SVG 图标
            else if (card.querySelector('.ad-report, .video-card-ad-small, #bannerAd, .ad-floor-exp')) { category = "广告"; up = ""; }
            else if (card.classList.contains('floor-single-card') || card.id === 'right-bottom-banner') { category = "活动推广"; up = ""; }
        }

        return { title, up, category, videoUrl, upUrl };
    }

    /**
     * 记录拦截日志并移交 FilterEngine 统一存储
     * @param {Object} info - 卡片元数据
     * @param {string} [overrideCategory] - 强制覆盖的分类名称
     */
    log(info, overrideCategory) {
        if (!window.newbFilter) return;
        const finalCategory = overrideCategory || info.category || "未知拦截";
        window.newbFilter.saveLog(info.title, info.up, finalCategory, "净化", info.videoUrl, info.upUrl);
    }

    /**
     * 执行页面净化扫描
     * @param {Object} config - 全局配置对象
     */
    run(config) {
        this.stop();
        if (!config.cleanup?.enabled) return;

        /**
         * 核心扫描逻辑：遍历并隐藏违规卡片
         */
        const scan = () => {
            // 1. 静态黑名单扫描
            this.staticBlacklist.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    // 向上寻找最外层卡片容器
                    const card = el.closest('.feed-card, .bili-feed-card, .video-card, .video-page-card-small') || el;
                    if (card.style.display !== 'none') {
                        const info = this.extractCardInfo(card);
                        this.log(info, info.category || "静态拦截");
                        card.style.display = 'none';
                        card.dataset.newbProcessed = 'true';
                    }
                });
            });

            // 2. 动态卡片扫描 (识别伪装成普通视频的广告/直播)
            document.querySelectorAll('.bili-video-card, .feed-card, .video-card').forEach(card => {
                if (card.style.display === 'none' || card.dataset.newbProcessed === 'true') return;
                
                const info = this.extractCardInfo(card);
                if (info.category) {
                    this.log(info);
                    card.style.display = 'none';
                    card.dataset.newbProcessed = 'true';
                }
            });
        };

        // 初始多频次扫描，应对 B 站首屏分段渲染机制
        scan();
        setTimeout(scan, 500);
        setTimeout(scan, 2000);

        // 建立 DOM 监听，处理滚动加载的新卡片
        this.observer = new MutationObserver((mutations) => {
            if (mutations.some(m => m.addedNodes.length > 0)) {
                // 利用 requestIdleCallback 在浏览器空闲时执行，避免引起页面滚动卡顿
                window.requestIdleCallback ? window.requestIdleCallback(scan) : scan();
            }
        });
        
        this.observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    /**
     * 停止净化引擎并断开 DOM 监听
     */
    stop() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

// 挂载至全局 window 对象
window.newbCleanup = new CleanupEngine();