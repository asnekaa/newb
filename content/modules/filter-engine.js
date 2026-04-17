// B站分区 TID 映射表 (用于减少对 API tname 字段的依赖)
const TID_MAP = {
    "1": "动画", "24": "MAD·AMV", "25": "MMD·3D", "27": "综合(动画)", "32": "完结动画", "47": "短片·手书·配音", "86": "特摄", "210": "手办·模玩", 
    "33": "连载动画(番剧)", "51": "资讯(番剧)", "152": "官方延伸", "153": "国产动画", "168": "国产原创相关", "169": "布袋戏", "170": "资讯(国创)", "195": "动态漫·广播剧", 
    "28": "原创音乐", "29": "音乐现场", "30": "VOCALOID·UTAU", "31": "翻唱", "59": "演奏", "130": "音乐综合", "193": "MV(音乐)", "194": "电音", 
    "20": "宅舞", "154": "舞蹈综合", "156": "舞蹈教程", "198": "街舞", "199": "明星舞蹈", "200": "中国舞", 
    "17": "单机游戏", "19": "Mugen", "65": "网络游戏", "121": "GMV", "136": "音游", "171": "电子竞技", "172": "手机游戏", "173": "桌游棋牌", 
    "122": "野生技术协会", "124": "社科人文", "201": "科学科普", "207": "财经", "208": "校园学习", "209": "职业职场", 
    "95": "手机平板", "189": "电脑装机", "190": "摄影摄像", "191": "影音智能", 
    "21": "日常", "75": "动物圈", "76": "美食圈", "138": "搞笑", "161": "手工", "162": "绘画", "163": "运动", "174": "其他(生活)", "176": "汽车", 
    "22": "鬼畜调教", "26": "音MAD", "126": "人力VOCALOID", "127": "教程演示(鬼畜)", 
    "157": "美妆", "158": "服饰", "159": "T台", "164": "健身(时尚)", "192": "风尚标", 
    "203": "热点", "204": "环球", "205": "社会", "206": "综合(资讯)", 
    "71": "综艺", "137": "明星(娱乐)", "85": "短片(影视)", "182": "影视杂谈", "183": "影视剪辑", "184": "预告·资讯(影视)", 
    "37": "人文·历史", "178": "科学·探索·自然", "179": "军事", "180": "社会·美食·旅行", 
    "83": "其他国家(电影)", "145": "欧美电影", "146": "日本电影", "147": "华语电影", "185": "国产剧", "187": "海外剧"
};

class FilterEngine {
    constructor() {
        this.config = {};
        this.apiCache = new Map(); // 视频详情 API 缓存
        this.pendingLogs =[];     // 待写入的拦截日志队列
        this.logTimer = null;      // 日志防抖定时器
    }

    /**
     * 将视频时长字符串转换为分钟数 (支持 MM:SS 与 HH:MM:SS)
     */
    parseDuration(str) {
        if (typeof str !== 'string') return 0;
        const parts = str.trim().split(':').map(Number);
        if (parts.some(isNaN)) return 0;
        const totalSeconds = parts.reduce((acc, val) => acc * 60 + val, 0);
        return totalSeconds / 60;
    }

    /**
     * 更新过滤规则配置
     * @param {Object} config - 全局配置对象
     */
    updateConfig(config) {
        const filterCfg = config.filter || {};
        this.config = {
            titleRules: this.parseRules(filterCfg.titleKeywords ||[]),
            upRules: this.parseRules(filterCfg.upKeywords ||[]),
            sectionRules: filterCfg.sectionKeywords || [],
            tagRules: this.parseRules(filterCfg.tagKeywords ||[]),
            minDuration: filterCfg.minDuration || 0
        };
    }

    /**
     * 解析用户输入的关键词规则 (支持正则与通配符)
     * @param {string[]} keywords - 关键词数组
     * @returns {Array<string|RegExp>} 解析后的规则数组
     */
    parseRules(keywords) {
        return keywords.map(rule => {
            try {
                // 1. 解析标准正则格式 (例: /pattern/i)
                if (rule.startsWith('/') && rule.lastIndexOf('/') > 0) {
                    const lastSlash = rule.lastIndexOf('/');
                    return new RegExp(rule.substring(1, lastSlash), rule.substring(lastSlash + 1));
                }
                // 2. 解析通配符格式 (例: *关键词*)
                if (rule.includes('*')) {
                    const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
                    return new RegExp(`^${escaped}$`, 'i');
                }
                // 3. 普通字符串统一转小写以实现忽略大小写匹配
                return rule.toLowerCase();
            } catch (e) {
                // 解析失败则降级为普通字符串匹配
                return rule.toLowerCase();
            }
        });
    }

    /**
     * 核心匹配逻辑：判断文本是否命中规则库
     * @param {string} text - 待检测文本
     * @param {Array<string|RegExp>} rules - 规则数组
     * @returns {string|boolean} 命中的规则内容或 false
     */
    isHit(text, rules) {
        if (!text) return false;
        const lowerText = text.toLowerCase(); // 缓存小写文本提升性能
        
        for (const rule of rules) {
            if (rule instanceof RegExp) {
                if (rule.test(text)) return rule.source;
            } else {
                if (lowerText.includes(rule)) return rule;
            }
        }
        return false;
    }

    /**
     * 记录拦截日志 (采用防抖机制批量写入 Storage)
     */
    saveLog(title, up, reason, type, videoUrl, upUrl) {
        this.pendingLogs.push({ title, up, reason, type, videoUrl, upUrl, time: Date.now() });
        
        clearTimeout(this.logTimer);
        this.logTimer = setTimeout(() => {
            const logsToSave = [...this.pendingLogs];
            this.pendingLogs = [];
            
            chrome.storage.local.get({ blockedLogs:[] }, ({ blockedLogs }) => {
                // 去重逻辑：5秒内相同标题的拦截记录不重复写入
                const newLogs = logsToSave.filter(nl => 
                    !blockedLogs.some(l => l.title === nl.title && (Date.now() - l.time < 5000))
                );
                // 仅保留最近 100 条记录
                chrome.storage.local.set({ blockedLogs:[...newLogs, ...blockedLogs].slice(0, 100) });
            });
        }, 500);
    }

    /**
     * 隐藏卡片并触发日志记录
     */
    removeCard(card, title, up, reason, type, videoUrl, upUrl) {
        const outer = card.closest('.bili-feed-card, .feed-card, .video-card, .video-page-card-small') || card;
        outer.style.setProperty('display', 'none', 'important');
        this.saveLog(title, up, reason, type, videoUrl, upUrl);
    }

    /**
     * 处理单个视频卡片，执行基础过滤逻辑
     * @param {HTMLElement} card - 视频卡片 DOM 节点
     */
    async processCard(card) {
        // 避免重复处理或处理已被隐藏的卡片
        if (card.dataset.newbProcessed === 'true' || card.style.display === 'none') return;
        card.dataset.newbProcessed = 'true';

        const titleEl = card.querySelector('.bili-video-card__info--tit, .video-name, .title');
        const linkEl = card.querySelector('a[href*="/BV"]');
        if (!titleEl || !linkEl) return;

        const title = titleEl.textContent.trim();
        const videoUrl = linkEl.href;

        const upEl = card.querySelector('.bili-video-card__info--author, .up-name__text, .up-name, .upname .name, .bili-video-card__info--owner, .bili-video-card__info--rcmd, .bili-live-card__info--author, .bili-live-card__info--uname-text');
        let upLinkEl = card.querySelector('a[href*="space.bilibili.com"]');
        if (!upLinkEl) {
            upLinkEl = card.querySelector('a.bili-video-card__info--owner, a.up-name, a[href*="live.bilibili.com"], a[href*="bangumi/play/"]');
        }
        
        let up = upEl?.textContent?.trim() || upLinkEl?.textContent?.trim();
        
        if (!up || up === "未知UP") {
            const bottomEl = card.querySelector('.bili-video-card__info--bottom, .bili-live-card__info--text');
            if (bottomEl) {
                const bottomText = bottomEl.textContent.replace(/[\r\n]+/g, '').replace(/\s+/g, ' ').split('·')[0].trim();
                if (bottomText && !bottomText.includes('播放') && !bottomText.includes('弹幕') && !bottomText.includes('人气')) {
                    up = bottomText;
                }
            }
        }

        const upUrl = upLinkEl?.href && !upLinkEl.href.startsWith('javascript:') ? upLinkEl.href : '';

        up = (up || "").replace(/[\r\n]+/g, '').replace(/\s+/g, ' ').trim();

        // 错误数据清洗与官方内容强制覆盖
        if (upUrl.includes('bangumi/play')) {
            up = "未知UP";
        } else if (!up || up === "未知UP" || /\d+(\.\d+)?万/.test(up) || /^(番剧|国创|电影|纪录片|电视剧|综艺|直播|课堂)$/.test(up)) {
            if (upUrl.includes('live.bilibili.com')) up = "直播间";
            else up = "未知UP";
        }

        // 1. 时长过滤 (无需 API 请求，性能最高)
        if (this.config.minDuration > 0) {
            const durationEl = card.querySelector('.bili-video-card__stats__duration, .duration, .bpx-player-homepage-time-label-total-time');
            if (durationEl) {
                const durationText = durationEl.textContent.trim().replace(/^时长[:：]?\s*/, '');
                if (this.parseDuration(durationText) < this.config.minDuration) {
                    return this.removeCard(card, title, up, durationText, '时长', videoUrl, upUrl);
                }
            }
        }

        // 2. 标题过滤
        const hitTitle = this.isHit(title, this.config.titleRules);
        if (hitTitle) return this.removeCard(card, title, up, hitTitle, '标题', videoUrl, upUrl);

        // 3. UP主过滤
        const hitUp = this.isHit(up, this.config.upRules);
        if (hitUp) return this.removeCard(card, title, up, hitUp, 'UP主', videoUrl, upUrl);

        // 4. 高级过滤 (分区/标签) - 需发起 API 请求
        if (this.config.sectionRules.length > 0 || this.config.tagRules.length > 0) {
            const bvidMatch = videoUrl.match(/BV\w+/);
            if (bvidMatch) this.checkAdvanced(card, bvidMatch[0], title, up, videoUrl, upUrl);
        }
    }

    /**
     * 执行高级过滤逻辑 (依赖 API 数据)
     */
    async checkAdvanced(card, bvid, title, up, videoUrl, upUrl) {
        let apiData = this.apiCache.get(bvid);
        
        if (!apiData) {
            try {
                apiData = await window.newbAPI.fetchVideoInfo(bvid);
                // 内存泄漏防御：限制缓存上限为 500 条
                if (this.apiCache.size > 500) this.apiCache.clear();
                this.apiCache.set(bvid, apiData);
            } catch (e) { 
                return; // 网络异常或风控时静默失败，放行卡片
            }
        }

        const view = apiData?.View;
        if (!view) return;

        // 4.1 分区过滤
        if (this.config.sectionRules.length > 0) {
            const tname = TID_MAP[view.tid] || view.tname || "未知分区";
            const hitKw = this.config.sectionRules.find(kw => tname.includes(kw));
            if (hitKw) return this.removeCard(card, title, up, tname, '分区', videoUrl, upUrl);
        }

        // 4.2 标签过滤
        if (this.config.tagRules.length > 0 && apiData.Tags) {
            for (const { tag_name } of apiData.Tags) {
                const hitTag = this.isHit(tag_name, this.config.tagRules);
                if (hitTag) return this.removeCard(card, title, up, hitTag, '标签', videoUrl, upUrl);
            }
        }
    }
}

window.newbFilter = new FilterEngine();