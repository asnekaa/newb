class UserInfoHoverEngine {
    constructor() {
        this.config = { enabled: true, delay: 500 };
        this.card = null;
        this.showTimer = null;
        this.hideTimer = null;
        this.currentMid = null;
        this.currentTarget = null;
        
        this.bindEvents();
    }

    /**
     * 更新引擎配置
     * @param {Object} config - 全局配置对象
     */
    updateConfig(config) {
        const isMasterOn = config.masterSwitch ?? true;
        this.config.enabled = isMasterOn && (config.ui?.userInfoHover ?? true);
        this.config.delay = config.ui?.videoInfoHoverDelay ?? 500; // 复用悬浮窗延迟配置
        
        if (!this.config.enabled) this.hideCard();
    }

    /**
     * 懒加载获取悬浮窗 DOM 实例，并绑定内部交互事件
     * @returns {HTMLElement} 悬浮窗节点
     */
    getCard() {
        if (!this.card) {
            this.card = document.createElement('div');
            this.card.id = 'newb-user-info-card';
            document.body.appendChild(this.card);

            // 鼠标移入悬浮窗时取消隐藏，移出时恢复隐藏倒计时
            this.card.addEventListener('mouseenter', () => clearTimeout(this.hideTimer));
            this.card.addEventListener('mouseleave', () => {
                this.hideTimer = setTimeout(() => this.hideCard(), 200);
            });
            
            // 关注/拉黑按钮交互 (事件委托)
            this.card.addEventListener('click', async (e) => {
                const btn = e.target.closest('button[data-act]');
                if (!btn) return;
                
                const act = parseInt(btn.dataset.act);
                const mid = btn.dataset.mid;
                
                try {
                    // 禁用按钮防止重复点击
                    btn.style.opacity = '0.5';
                    btn.style.pointerEvents = 'none';
                    
                    await window.newbAPI.modifyRelation(mid, act);
                    
                    // 操作成功后强制刷新当前卡片数据
                    this.showCardFor(this.currentTarget, mid, true);
                } catch (err) {
                    console.error("newB: 关注/拉黑操作失败", err);
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                }
            });
        }
        return this.card;
    }

    /**
     * 渲染真实用户数据到悬浮窗
     * @param {Object} data - API 返回的用户详情数据
     * @param {string} mid - 当前用户 mid
     * @param {string} bannerUrl - 已预加载完成的头图 URL
     */
    renderCard(data, mid, target, bannerUrl) {
        const { info, stat, upstat, relation } = data;
        const card = this.getCard();

        if (!info) {
            card.innerHTML = `<div class="newb-hover-error" style="padding: 20px; text-align: center; color: #fb7299;">获取用户信息失败</div>`;
            return;
        }

        // --- 重新注入丢失的业务逻辑变量 ---
        const avatarUrl = info.face || '';
        const name = info.name || '';
        const sign = info.sign || '这个人很懒，什么都没有写~';
        const level = info.level || 0;
        const sex = info.sex === '男' ? '♂' : (info.sex === '女' ? '♀' : '');
        const sexColor = info.sex === '男' ? '#00aeec' : (info.sex === '女' ? '#fb7299' : '#9499a0');
        const sexHtml = sex ? `<span class="newb-u-sex" style="color: ${sexColor}">${sex}</span>` : '';
        
        let vipHtml = '';
        let nameColor = '';
        if (info.vip && info.vip.status === 1) {
            nameColor = '#fb7299';
            const label = info.vip.label || { text: '大会员', bg_color: '#fb7299', text_color: '#fff' };
            vipHtml = `<span class="newb-u-vip" style="background-color: ${label.bg_color}; color: ${label.text_color};">${label.text}</span>`;
        }
        const nameStyle = nameColor ? `style="color: ${nameColor};"` : '';
        
        const lvSvgUrl = chrome.runtime.getURL('assets/icons/bililv.svg');
        const levelHtml = `<span class="newb-u-level-wrap"><img class="newb-u-level-img" src="${lvSvgUrl}" style="top: -${level * 12}px;"></span>`;

                let verifyHtml = '';
        if (info.official && info.official.role !== 0) {
            const vColor = info.official.type === 0 ? '#f3a034' : '#00aeec';
            verifyHtml = `<div class="newb-u-verify" style="color: ${vColor}"><svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="currentColor"/><g transform="translate(2.75, 2.75) scale(0.75)"><path d="M10.5 6h-3l1-4c.1-.3-.2-.5-.5-.4L3.5 7.5c-.2.2-.1.5.2.5h3l-1 4c-.1.3.2.5.5.4l4.5-5.9c.2-.2.1-.5-.2-.5z" fill="#fff"/></g></svg>${info.official.title}</div>`;
        }

        const cookieMatch = document.cookie.match(/DedeUserID=([^;]+)/);
        const myMid = cookieMatch ? cookieMatch[1] : null;
        const isSelf = mid === myMid;
        let relAttr = relation ? relation.relation.attribute : 0;
        let followBtnHtml = '';
        let blockBtnHtml = '';

        if (!isSelf) {
            if (relAttr === 128) {
                followBtnHtml = `<button class="newb-u-btn btn-disabled" disabled>已拉黑</button>`;
                blockBtnHtml = `<button class="newb-u-btn btn-blocked" data-act="6" data-mid="${mid}">取消拉黑</button>`;
            } else {
                const text = (relAttr === 2 || relAttr === 6) ? (relAttr === 6 ? '已互粉' : '已关注') : '+ 关注';
                const cls = (relAttr === 2 || relAttr === 6) ? 'btn-followed' : 'btn-follow';
                const act = (relAttr === 2 || relAttr === 6) ? 2 : 1;
                followBtnHtml = `<button class="newb-u-btn ${cls}" data-act="${act}" data-mid="${mid}">${text}</button>`;
                blockBtnHtml = `<button class="newb-u-btn btn-block" data-act="5" data-mid="${mid}">拉黑</button>`;
            }
        }

        const { formatNum } = window.newbUtils;
        const following = stat ? stat.following : 0;
        const follower = stat ? stat.follower : 0;
        const likes = upstat ? upstat.likes : 0;
        const views = upstat?.archive?.view || 0;

        // --- 渲染真实 DOM ---
        card.innerHTML = `
            <div class="newb-hover-content">
                <div class="newb-u-banner" style="background-image: url('${bannerUrl}');"></div>
                <div class="newb-u-content">
                    <div class="newb-u-header">
                        <img class="newb-u-avatar" src="${avatarUrl}@100w_100h_1c.webp" referrerpolicy="no-referrer">
                        <div class="newb-u-actions">
                            ${followBtnHtml}
                            ${!isSelf ? `<a class="newb-u-btn btn-msg" href="https://message.bilibili.com/#/whisper/mid${mid}" target="_blank">私信</a>` : ''}
                            ${blockBtnHtml}
                        </div>
                    </div>
                    <div class="newb-u-name-row">
                        <span class="newb-u-name" title="${name}" ${nameStyle}>${name}</span>
                        ${sexHtml}
                        ${levelHtml}
                        ${vipHtml}
                    </div>
                    ${verifyHtml}
                    <div class="newb-u-stats">
                        <div><span>关注</span><b>${formatNum(following)}</b></div>
                        <div><span>粉丝</span><b>${formatNum(follower)}</b></div>
                        <div><span>获赞</span><b>${formatNum(likes)}</b></div>
                        <div><span>播放</span><b>${formatNum(views)}</b></div>
                    </div>
                    <div class="newb-u-sign" title="${sign}">${sign}</div>
                </div>
            </div>
        `;
        this.positionCard(target.getBoundingClientRect());
    }

    /**
     * 智能定位算法：确保悬浮窗始终在可视区域内
     * @param {DOMRect} targetRect - 触发元素的边界信息
     */
    positionCard(targetRect) {
        const card = this.getCard();
        const cardRect = card.getBoundingClientRect();
        const { innerWidth: vw, innerHeight: vh } = window;
        const margin = 15;
        
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
     * 触发悬浮窗显示流程 (骨架屏 -> 数据请求 -> 预加载图片 -> 渲染)
     * @param {HTMLElement} target - 触发 DOM 节点
     * @param {string} mid - 用户 mid
     * @param {boolean} forceRefresh - 是否强制刷新 (用于关注/拉黑操作后)
     */
    async showCardFor(target, mid, forceRefresh = false) {
        if (!forceRefresh) {
            this.currentMid = mid;
            this.currentTarget = target;
        }
        const card = this.getCard();
        
        // 1. 立即渲染 UP 主专属骨架屏
        if (!forceRefresh) {
            // 预判认证状态：检查触发元素或其父级是否含有 B站认证图标类名
            const hasVerify = !!target.closest('.up-name')?.querySelector('.svg-icon.verify, .auth-icon') || !!target.querySelector('.verify-icon');

            card.innerHTML = `
                <div class="newb-skeleton newb-u-skel-banner"></div>
                <div class="newb-u-content">
                    <div class="newb-u-header">
                        <div class="newb-skeleton newb-u-skel-avatar"></div>
                        <div class="newb-u-actions"><div class="newb-skeleton newb-u-skel-btn"></div></div>
                    </div>
                    <div class="newb-skeleton newb-u-skel-name"></div>
                    <div class="newb-skeleton newb-u-skel-verify ${hasVerify ? 'show' : ''}"></div>
                    <div class="newb-u-stats">
                        <div class="newb-skeleton newb-u-skel-stat"></div>
                        <div class="newb-skeleton newb-u-skel-stat"></div>
                        <div class="newb-skeleton newb-u-skel-stat"></div>
                        <div class="newb-skeleton newb-u-skel-stat"></div>
                    </div>
                    <div class="newb-skeleton newb-u-skel-sign"></div>
                </div>
            `;
            card.classList.add('show');
            this.positionCard(target.getBoundingClientRect());
        }
        
        try {
            // 2. 异步获取用户数据
            const data = await window.newbAPI.fetchUserProfile(mid);
            if (this.currentMid !== mid) return; // 竞态防御
            
            // 3. 提取头图 URL 并执行预加载
            const info = data.info || {};
            const rawBanner = info.top_photo_v2?.l_img || info.top_photo || 'https://i2.hdslb.com/bfs/activity-plat/static/VqxBIh6Te8.png';
            const bannerUrl = rawBanner.replace(/^http:/, 'https:') + '@.webp';
            
            const img = new Image();
            img.src = bannerUrl;
            
            // 4. 待图片加载完成（或失败）后，再执行真实 DOM 替换
            const executeRender = () => {
                if (this.currentMid !== mid) return;
                this.renderCard(data, mid, target, bannerUrl);
            };
            
            img.onload = executeRender;
            img.onerror = executeRender;
            
        } catch (e) {
            if (this.currentMid === mid) {
                card.innerHTML = `<div class="newb-hover-error" style="padding: 20px; text-align: center; color: #fb7299;">获取信息失败</div>`;
                card.classList.add('show');
                this.positionCard(target.getBoundingClientRect());
            }
        }
    }

    /**
     * 隐藏悬浮窗并清理状态
     */
    hideCard() {
        this.card?.classList.remove('show');
        this.currentMid = null;
    }

    /**
     * 绑定全局事件监听 (事件委托)
     */
    bindEvents() {
        document.addEventListener('mouseover', (e) => {
            if (!this.config.enabled) return;
            
            // 拦截带有用户 ID 标识的元素或空间链接
            const target = e.target.closest('a, [data-user-id],[data-uid]');
            if (!target || (e.relatedTarget && target.contains(e.relatedTarget))) return;

            let mid = null;
            if (target.dataset.userId) mid = target.dataset.userId;
            else if (target.dataset.uid) mid = target.dataset.uid;
            else if (target.href) {
                const match = target.href.match(/space\.bilibili\.com\/(\d+)/);
                if (match) mid = match[1];
            }

            if (!mid) return;

            // 若当前已在展示该用户，则取消隐藏动作
            clearTimeout(this.hideTimer);
            if (this.currentMid === mid && this.card?.classList.contains('show')) return;

            // 启动触发倒计时
            clearTimeout(this.showTimer);
            this.showTimer = setTimeout(() => this.showCardFor(target, mid), this.config.delay);
        });

        document.addEventListener('mouseout', (e) => {
            if (!this.config.enabled) return;
            
            const target = e.target.closest('a, [data-user-id],[data-uid]');
            if (!target || (e.relatedTarget && target.contains(e.relatedTarget))) return;

            let mid = null;
            if (target.dataset.userId) mid = target.dataset.userId;
            else if (target.dataset.uid) mid = target.dataset.uid;
            else if (target.href) {
                const match = target.href.match(/space\.bilibili\.com\/(\d+)/);
                if (match) mid = match[1];
            }

            if (!mid) return;

            // 取消显示动作，启动隐藏倒计时
            clearTimeout(this.showTimer);
            this.hideTimer = setTimeout(() => this.hideCard(), 200);
        });
    }
}

// 挂载至全局 window 对象
window.newbUserInfoHover = new UserInfoHoverEngine();