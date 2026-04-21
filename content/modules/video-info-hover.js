// B站分区 TID 映射表 (静态常量，避免污染实例内存)
const VIDEO_TYPE_MAP = {
    "1": "动画", "24": "MAD·AMV", "25": "MMD·3D", "47": "短片·手书", "210": "手办·模玩", "86": "特摄", "253": "动漫杂谈", "27": "综合", "13": "番剧", "51": "资讯", "152": "官方延伸", "32": "完结动画", "33": "连载动画", "167": "国创", "153": "国产动画", "168": "国产原创相关", "169": "布袋戏", "170": "资讯", "195": "动态漫·广播剧", "3": "音乐", "28": "原创音乐", "31": "翻唱", "30": "VOCALOID·UTAU", "59": "演奏", "193": "MV", "29": "音乐现场", "130": "音乐综合", "243": "乐评盘点", "244": "音乐教学", "129": "舞蹈", "20": "宅舞", "154": "舞蹈综合", "156": "舞蹈教程", "198": "街舞", "199": "明星舞蹈", "200": "国风舞蹈", "4": "游戏", "17": "单机游戏", "171": "电子竞技", "172": "手机游戏", "65": "网络游戏", "173": "桌游棋牌", "121": "GMV", "136": "音游", "19": "Mugen", "36": "知识", "201": "科学科普", "124": "社科·法律·心理", "228": "人文历史", "207": "财经商业", "208": "校园学习", "209": "职业职场", "229": "设计·创意", "122": "野生技术协会", "188": "科技", "95": "数码", "230": "软件应用", "231": "计算机技术", "232": "科工机械", "233": "极客DIY", "234": "运动", "235": "篮球", "249": "足球", "164": "健身", "236": "竞技体育", "237": "运动文化", "238": "运动综合", "223": "汽车", "245": "赛车", "246": "改装玩车", "247": "新能源车", "248": "房车", "240": "摩托车", "227": "购车攻略", "176": "汽车生活", "160": "生活", "138": "搞笑", "250": "出行", "251": "三农", "239": "家居房产", "161": "手工", "162": "绘画", "21": "日常", "211": "美食", "76": "美食制作", "212": "美食侦探", "213": "美食测评", "214": "田园美食", "215": "美食记录", "217": "动物圈", "218": "喵星人", "219": "汪星人", "221": "野生动物", "222": "小宠异宠", "75": "动物综合", "119": "鬼畜", "22": "鬼畜调教", "26": "音MAD", "126": "人力VOCALOID", "216": "鬼畜剧场", "127": "教程演示", "155": "时尚", "157": "美妆护肤", "252": "仿妆cos", "158": "穿搭", "159": "时尚潮流", "202": "资讯", "203": "热点", "204": "环球", "205": "社会", "206": "综合", "5": "娱乐", "71": "综艺", "241": "娱乐杂谈", "242": "粉丝创作", "137": "明星综合", "181": "影视", "182": "影视杂谈", "183": "影视剪辑", "85": "小剧场", "184": "预告·资讯", "177": "纪录片", "37": "人文·历史", "178": "科学·探索·自然", "179": "军事", "180": "社会·美食·旅行", "23": "电影", "147": "华语电影", "145": "欧美电影", "146": "日本电影", "83": "其他国家", "11": "电视剧", "185": "国产剧", "187": "海外剧", "257": "配音", "174": "其他"
};

class VideoInfoHoverEngine {
    constructor() {
        this.config = { enabled: true, delay: 500 };
        this.card = null;           // 悬浮窗 DOM 实例
        this.showTimer = null;      // 触发显示的防抖定时器
        this.hideTimer = null;      // 触发隐藏的防抖定时器
        this.currentBvid = null;    // 当前正在展示的视频 BV 号 (用于防御竞态条件)
        this.currentTarget = null;  // 当前触发悬停的 DOM 节点
        
        this.bindEvents();
    }

    /**
     * 更新引擎配置
     * @param {Object} config - 全局配置对象
     */
     updateConfig(config) {
        const isMasterOn = config.masterSwitch ?? true;
        this.config.enabled = isMasterOn && (config.ui?.videoInfoHover ?? true);
        this.config.aiEnabled = isMasterOn && (config.ui?.videoInfoHoverAi ?? true);
        this.config.replyEnabled = isMasterOn && (config.ui?.videoInfoHoverReply ?? true);
        this.config.delay = config.ui?.infoHoverDelay ?? 500;
        
        if (!this.config.enabled) this.hideCard();
    }

    /**
     * 懒加载获取悬浮窗 DOM 实例，并绑定内部交互事件
     * @returns {HTMLElement} 悬浮窗节点
     */
    getCard() {
        if (!this.card) {
            this.card = document.createElement('div');
            this.card.id = 'newb-video-info-card';
            document.body.appendChild(this.card);

            // 鼠标移入悬浮窗时取消隐藏，移出时恢复隐藏倒计时
            this.card.addEventListener('mouseenter', () => clearTimeout(this.hideTimer));
            this.card.addEventListener('mouseleave', () => {
                this.hideTimer = setTimeout(() => this.hideCard(), 200);
            });
            
            // 简介与热评展开/收起交互 (事件委托)
            this.card.addEventListener('click', (e) => {
                const btn = e.target.closest('.newb-expand-btn');
                if (btn) {
                    // 动态寻找按钮前一个兄弟节点（即被折叠的文本容器）
                    const textEl = btn.previousElementSibling;
                    if (textEl) {
                        const isExpanded = textEl.classList.toggle('is-expanded');
                        btn.innerHTML = isExpanded ? '收起 ▴' : '展开 ▾';
                        // 展开后重新计算位置，防止内容撑破屏幕边界
                        if (this.currentTarget) this.positionCard(this.currentTarget.getBoundingClientRect());
                    }
                    return;
                }

                // AI 总结时间戳点击跳转
                const timeBtn = e.target.closest('.newb-ai-time');
                if (timeBtn && this.currentBvid) {
                    const time = timeBtn.dataset.time;
                    if (time) {
                        window.open(`https://www.bilibili.com/video/${this.currentBvid}/?t=${time}`, '_blank');
                    }
                }
            });
        }
        return this.card;
    }

    /**
     * 将秒数格式化为 MM:SS 或 HH:MM:SS
     */
    formatSeconds(sec) {
        if (!sec || isNaN(sec)) return "00:00";
        sec = Math.floor(sec);
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        const pad = (n) => n.toString().padStart(2, '0');
        if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
        return `${pad(m)}:${pad(s)}`;
    }

    /**
     * 格式化时间戳为标准日期字符串
     * @param {number} timestamp - 秒级时间戳
     * @returns {string} 格式化后的时间 (例: 2023-08-01 12:30:00)
     */
    formatDate(timestamp) {
        const d = new Date(timestamp * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    /**
     * 渲染真实视频数据到悬浮窗
     * @param {Object} data - API 返回的视频详情数据
     */
    renderCard(data) {
        const { View: view, Tags: tags =[], Conclusion: conclusion, Reply: reply } = data;
        const type = VIDEO_TYPE_MAP[view.tid] || "未知";
        
        // 提取前 6 个标签
        const tagsHtml = tags.slice(0, 6)
            .map(t => `<span class="newb-tag">${t.tag_name}</span>`)
            .join('');
            
        const timeStr = this.formatDate(view.pubdate);
        const upName = view.owner?.name || '未知UP';
        const { formatNum } = window.newbUtils;

        // --- 1. 构建 AI 总结 HTML ---
        let aiHtml = '';
        if (this.config.aiEnabled) {
            if (conclusion && conclusion.model_result && conclusion.model_result.result_type !== 0) {
                const summary = conclusion.model_result.summary;
                const outline = conclusion.model_result.outline;
                
                let outlineHtml = '';
                if (outline && outline.length > 0) {
                    outlineHtml = outline.map(sec => `
                        <div class="newb-ai-sec">
                            <div class="newb-ai-sec-title">${sec.title}</div>
                            ${sec.part_outline.map(part => `
                                <div class="newb-ai-part">
                                    <span class="newb-ai-time" data-time="${part.timestamp}">${this.formatSeconds(part.timestamp)}</span>
                                    <span class="newb-ai-content">${part.content}</span>
                                </div>
                            `).join('')}
                        </div>
                    `).join('');
                }
                aiHtml = `
                    <div class="newb-hover-ai">
                        <div class="newb-ai-header">
                            <svg width="16" height="16" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.53976 2.34771C8.17618 1.81736 9.12202 1.90335 9.65237 2.53976L12.1524 5.53976C12.6827 6.17618 12.5967 7.12202 11.9603 7.65237C11.3239 8.18272 10.3781 8.09673 9.84771 7.46031L7.34771 4.46031C6.81736 3.8239 6.90335 2.87805 7.53976 2.34771Z" fill="#18191c"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M21.9602 2.34771C21.3238 1.81736 20.378 1.90335 19.8476 2.53976L17.3476 5.53976C16.8173 6.17618 16.9033 7.12202 17.5397 7.65237C18.1761 8.18272 19.1219 8.09673 19.6523 7.46031L22.1523 4.46031C22.6826 3.8239 22.5967 2.87805 21.9602 2.34771Z" fill="#18191c"></path><path d="M4.78613 14.2091C4.78613 11.9263 6.44484 9.96205 8.71139 9.6903C13.2069 9.1513 16.7678 9.13141 21.3132 9.68091C23.5697 9.95371 25.2147 11.9138 25.2147 14.1868V19.192C25.2147 21.3328 23.7551 23.2258 21.6452 23.5884C16.903 24.4032 13.1705 24.2461 8.55936 23.5137C6.36235 23.1647 4.78613 21.2323 4.78613 19.0078V14.2091Z" fill="#18191c"></path></svg>
                            AI 视频总结
                        </div>
                        <div class="newb-ai-summary">${summary || ''}</div>
                        <div class="newb-ai-outline">${outlineHtml}</div>
                    </div>
                `;
            } else {
                aiHtml = `
                    <div class="newb-hover-ai empty">
                        <div class="newb-ai-header">
                            <svg width="16" height="16" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.53976 2.34771C8.17618 1.81736 9.12202 1.90335 9.65237 2.53976L12.1524 5.53976C12.6827 6.17618 12.5967 7.12202 11.9603 7.65237C11.3239 8.18272 10.3781 8.09673 9.84771 7.46031L7.34771 4.46031C6.81736 3.8239 6.90335 2.87805 7.53976 2.34771Z" fill="#9499a0"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M21.9602 2.34771C21.3238 1.81736 20.378 1.90335 19.8476 2.53976L17.3476 5.53976C16.8173 6.17618 16.9033 7.12202 17.5397 7.65237C18.1761 8.18272 19.1219 8.09673 19.6523 7.46031L22.1523 4.46031C22.6826 3.8239 22.5967 2.87805 21.9602 2.34771Z" fill="#9499a0"></path><path d="M4.78613 14.2091C4.78613 11.9263 6.44484 9.96205 8.71139 9.6903C13.2069 9.1513 16.7678 9.13141 21.3132 9.68091C23.5697 9.95371 25.2147 11.9138 25.2147 14.1868V19.192C25.2147 21.3328 23.7551 23.2258 21.6452 23.5884C16.903 24.4032 13.1705 24.2461 8.55936 23.5137C6.36235 23.1647 4.78613 21.2323 4.78613 19.0078V14.2091Z" fill="#9499a0"></path></svg>
                            该视频暂无 AI 总结
                        </div>
                    </div>
                `;
            }
        }

        // --- 2. 构建热评 HTML ---
        let replyHtml = '';
        if (this.config.replyEnabled) {
            const replies = reply?.replies;
            if (replies && replies.length > 0) {
                let hotComment = replies.find(r => r.attr === 32768) || replies.reduce((l, r) => l.like > r.like ? l : r);
                if (hotComment) {
                    const member = hotComment.member;
                    const content = hotComment.content;
                    let message = content.message;
                    
                    // 简单处理表情渲染
                    if (content.emote) {
                        for (const [key, emote] of Object.entries(content.emote)) {
                            message = message.replaceAll(key, `<img src="${emote.url}" style="height: 1.2em; vertical-align: text-bottom; display: inline-block;">`);
                        }
                    }

                    // 移除标题，直接展示内容
                    replyHtml = `
                        <div class="newb-hover-reply">
                            <div class="newb-reply-content">
                                <span class="newb-reply-user">${member.uname}:</span>
                                <span class="newb-reply-text">${message}</span>
                            </div>
                        </div>
                    `;
                }
            }
        }

        const card = this.getCard();
        card.innerHTML = `
            <div class="newb-hover-content">
                <div class="newb-hover-title">${view.title}</div>
                <div class="newb-hover-meta">
                    <span class="newb-hover-up">UP: ${upName}</span>
                    <span class="newb-hover-time">${timeStr}</span>
                </div>
                <div class="newb-hover-desc">${view.desc || '暂无简介'}</div>
                <div class="newb-hover-tags">
                    <span class="newb-hover-type">#${type}</span>
                    ${tagsHtml}
                </div>
                <div class="newb-hover-stats">
                    <div>播放 <b>${formatNum(view.stat.view)}</b></div>
                    <div>弹幕 <b>${formatNum(view.stat.danmaku)}</b></div>
                    <div>点赞 <b>${formatNum(view.stat.like)}</b></div>
                    <div>硬币 <b>${formatNum(view.stat.coin)}</b></div>
                    <div>收藏 <b>${formatNum(view.stat.favorite)}</b></div>
                    <div>分享 <b>${formatNum(view.stat.share)}</b></div>
                </div>
                ${aiHtml}
                ${replyHtml}
            </div>
        `;

        // 检查简介与热评是否溢出，若溢出则动态插入"展开"按钮
        requestAnimationFrame(() => {
            const checkOverflow = (selector) => {
                const el = card.querySelector(selector);
                if (el && el.scrollHeight > el.clientHeight) {
                    el.insertAdjacentHTML('afterend', `<div class="newb-expand-btn">展开 ▾</div>`);
                }
            };
            checkOverflow('.newb-hover-desc');
            checkOverflow('.newb-reply-content');
        });
    }

    /**
     * 智能定位算法：确保悬浮窗始终在可视区域内
     * @param {DOMRect} targetRect - 触发元素的边界信息
     */
    positionCard(targetRect) {
        const card = this.getCard();
        const cardRect = card.getBoundingClientRect();
        const { innerWidth: vw, innerHeight: vh } = window;
        const margin = 15; // 安全边距
        
        // 默认展示在目标元素右侧
        let left = targetRect.right + margin;
        let top = targetRect.top;

        // 碰撞检测：若右侧空间不足，尝试移至左侧
        if (left + cardRect.width > vw) {
            left = targetRect.left - cardRect.width - margin;
        }
        
        // 碰撞检测：若左侧空间也不足，则居中并移至目标元素下方
        if (left < 0) {
            left = Math.max(10, (vw - cardRect.width) / 2);
            top = targetRect.bottom + margin;
        }

        // 碰撞检测：底部溢出修正
        if (top + cardRect.height > vh) {
            top = vh - cardRect.height - margin;
        }
        
        // 碰撞检测：顶部溢出修正
        if (top < 0) top = margin;

        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
    }

    /**
     * 触发悬浮窗显示流程 (骨架屏 -> 数据请求 -> 渲染)
     * @param {HTMLElement} target - 触发 DOM 节点
     * @param {string} bvid - 视频 BV 号
     */
    async showCardFor(target, bvid) {
        this.currentBvid = bvid;
        this.currentTarget = target;
        const card = this.getCard();
        
        // 预判标题行数：根据触发元素的文本长度（B站首页卡片标题通常超过24字会换行）
        const rawTitle = target.innerText || target.title || "";
        const isTwoLines = rawTitle.length > 24;

        // 1. 重置状态并渲染动态骨架屏
        card.classList.remove('is-expanded');
        const skeletonAiHtml = this.config.aiEnabled ? `<div class="newb-skeleton newb-skel-ai"></div>` : '';
        card.innerHTML = `
            <div class="newb-skeleton newb-skel-title ${isTwoLines ? 'is-two-lines' : ''}"></div>
            <div class="newb-skeleton newb-skel-desc"></div>
            <div class="newb-skeleton newb-skel-desc short"></div>
            <div class="newb-skel-tags">
                <div class="newb-skeleton newb-skel-tag"></div>
                <div class="newb-skeleton newb-skel-tag"></div>
                <div class="newb-skeleton newb-skel-tag"></div>
            </div>
            <div class="newb-skeleton newb-skel-stats"></div>
            ${skeletonAiHtml}
        `;
        card.classList.add('show');
        this.positionCard(target.getBoundingClientRect());

        // 2. 异步获取数据
        try {
            const data = await window.newbAPI.fetchVideoInfo(bvid);
            
            // 竞态条件防御：若在请求期间用户移到了其他视频，则丢弃当前结果
            if (this.currentBvid !== bvid) return;

            // 3. 并行获取 AI 总结与热评数据 (根据开关状态决定是否发起请求)
            const aid = data.View.aid;
            const cid = data.View.cid;
            const up_mid = data.View.owner.mid;

            // 使用 Promise.allSettled 防止单一接口失败导致整个卡片无法渲染
            const[conclusionRes, replyRes] = await Promise.allSettled([
                this.config.aiEnabled ? window.newbAPI.fetchVideoConclusion(bvid, cid, up_mid) : Promise.resolve(null),
                this.config.replyEnabled ? window.newbAPI.fetchVideoReply(aid) : Promise.resolve(null)
            ]);

            if (this.currentBvid !== bvid) return;

            data.Conclusion = conclusionRes.status === 'fulfilled' ? conclusionRes.value : null;
            data.Reply = replyRes.status === 'fulfilled' ? replyRes.value : null;
            
            this.renderCard(data);
            this.positionCard(target.getBoundingClientRect());
        } catch (e) {
            if (this.currentBvid === bvid) {
                card.innerHTML = `<div class="newb-hover-error">获取信息失败</div>`;
            }
        }
    }

    /**
     * 隐藏悬浮窗并清理状态
     */
    hideCard() {
        this.card?.classList.remove('show');
        this.currentBvid = null;
    }

    /**
     * 绑定全局事件监听 (事件委托)
     */
    bindEvents() {
        document.addEventListener('mouseover', (e) => {
            if (!this.config.enabled) return;
            
            const target = e.target.closest('a');
            // 过滤无效链接及内部子元素冒泡
            if (!target?.href || (e.relatedTarget && target.contains(e.relatedTarget))) return;

            const match = target.href.match(/\/video\/(BV[a-zA-Z0-9]+)/);
            if (!match) return;
            
            const bvid = match[1];

            // 若当前已在展示该视频，则取消隐藏动作
            clearTimeout(this.hideTimer);
            if (this.currentBvid === bvid && this.card?.classList.contains('show')) return;

            // 启动触发倒计时
            clearTimeout(this.showTimer);
            this.showTimer = setTimeout(() => this.showCardFor(target, bvid), this.config.delay);
        });

        document.addEventListener('mouseout', (e) => {
            if (!this.config.enabled) return;
            
            const target = e.target.closest('a');
            if (!target?.href || (e.relatedTarget && target.contains(e.relatedTarget))) return;
            if (!target.href.match(/\/video\/(BV[a-zA-Z0-9]+)/)) return;

            // 取消显示动作，启动隐藏倒计时
            clearTimeout(this.showTimer);
            this.hideTimer = setTimeout(() => this.hideCard(), 200);
        });
    }
}

window.newbVideoInfoHover = new VideoInfoHoverEngine();