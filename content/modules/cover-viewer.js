class CoverViewerEngine {
    constructor() {
        this.enabled = false;
        this.timer = null;
        this.isRunning = false; // 异步并发锁，防止重复扫描
    }

    /**
     * 更新配置并控制引擎启停
     * @param {Object} config - 全局配置对象
     */
    updateConfig(config) {
        const isMasterOn = config.masterSwitch ?? true;
        this.enabled = isMasterOn && !!config.ui?.showCoverViewer;
        this.enabled ? this.start() : this.stop();
    }

    /**
     * 启动定时扫描任务 (每 2 秒执行一次)
     */
    start() {
        if (!this.timer) {
            this.timer = setInterval(() => this.scan(), 2000);
        }
    }

    /**
     * 停止定时扫描任务
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * 扫描 DOM 中的视频卡片并注入在线人数
     */
    async scan() {
        if (this.isRunning || !this.enabled) return;
        this.isRunning = true;

        try {
            const statElements = document.querySelectorAll('.bili-video-card__stats--left');
            
            for (const statElement of statElements) {
                if (!this.enabled) break;

                const targetElement = statElement.closest('a');
                if (!targetElement?.href) continue;

                // 节流控制：每个卡片 120 秒内只请求一次
                const lastTS = statElement.dataset.newbCvTs;
                if (lastTS && (Date.now() - Number(lastTS) < 120 * 1000)) continue;

                // 提取 BV 号
                const match = targetElement.href.match(/\/video\/(BV[a-zA-Z0-9]+)/);
                if (!match) continue;
                const bvid = match[1];

                let aid = statElement.dataset.newbAid;
                let cid = statElement.dataset.newbCid;

                // 若无 aid/cid 缓存，则先请求视频详情接口获取
                if (!aid || !cid) {
                    try {
                        const videoInfo = await window.newbAPI.fetchVideoInfo(bvid);
                        if (!videoInfo?.View) continue;
                        
                        aid = videoInfo.View.aid;
                        cid = videoInfo.View.cid;
                        statElement.dataset.newbAid = aid;
                        statElement.dataset.newbCid = cid;
                    } catch (e) {
                        if (e.message === "412_BANNED") return this.forcedClose();
                        continue;
                    }
                }

                // 请求在线人数接口并渲染 UI
                try {
                    const onlineTotal = await window.newbAPI.getOnlineTotal(aid, cid, bvid);
                    let targetSpan = document.getElementById(`newb-cv-${bvid}`);
                    
                    if (!targetSpan) {
                        targetSpan = document.createElement('span');
                        targetSpan.id = `newb-cv-${bvid}`;
                        targetSpan.className = 'bili-video-card__stats--item';
                        statElement.appendChild(targetSpan);
                    }
                
                    targetSpan.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18" fill="currentColor" class="bili-video-card__stats--icon">
                            <path d="M8.905125 4.21875C5.3084925 4.21875 2.91858 7.0112925 1.9141875 8.486775C1.6989299999999998 8.801475 1.6989299999999998 9.198525 1.9141875 9.513225C2.91858 10.9887 5.3084925 13.78125 8.905125 13.78125C12.475237499999999 13.78125 14.959274999999998 11.032275 16.03575 9.5415375C16.274437499999999 9.2125875 16.274437499999998 8.7874125 16.03575 8.4584625C14.959274999999998 6.9677325 12.475237499999999 4.21875 8.905125 4.21875zM0.982035 7.857037500000001C2.0200875 6.33186 4.7038575 3.09375 8.905125 3.09375C13.062375 3.09375 15.84075 6.266655 16.950075000000002 7.803112499999999C17.4696375 8.523787500000001 17.4696375 9.476212499999999 16.950075000000002 10.1968875C15.84075 11.733337500000001 13.062375 14.90625 8.905125 14.90625C4.7038575 14.90625 2.0200875 11.668162500000001 0.982035 10.1429625C0.5096475 9.4478625 0.5096475 8.5521375 0.982035 7.857037500000001z" fill="currentColor"></path>
                            <path d="M9 6.84375C7.809150000000001 6.84375 6.84375 7.809150000000001 6.84375 9C6.84375 10.19085 7.809150000000001 11.15625 9 11.15625C10.19085 11.15625 11.15625 10.19085 11.15625 9C11.15625 7.809150000000001 10.19085 6.84375 9 6.84375zM5.71875 9C5.71875 7.18782 7.18782 5.71875 9 5.71875C10.8121875 5.71875 12.28125 7.18782 12.28125 9C12.28125 10.8121875 10.8121875 12.28125 9 12.28125C7.18782 12.28125 5.71875 10.8121875 5.71875 9z" fill="currentColor"></path>
                        </svg>
                        <span>${onlineTotal.total || '1+'}</span>
                    `;
                    statElement.dataset.newbCvTs = Date.now();
                } catch (e) {
                    if (e.message === "412_BANNED") return this.forcedClose();
                }
            }
        } finally {
            this.isRunning = false; // 释放锁
        }
    }

    /**
     * 熔断机制：当触发 B 站 API 频率限制 (412) 时，自动关闭该功能并保存配置
     */
    forcedClose() {
        this.stop();
        this.enabled = false;
        console.error("newB: 触发 API 频率限制，已自动关闭封面在线人数功能。");
        
        window.newbConfigManager.loadConfig().then(config => {
            if (config.ui?.showCoverViewer) {
                config.ui.showCoverViewer = false;
                window.newbConfigManager.saveLocal(config);
            }
        });
    }
}

window.newbCoverViewer = new CoverViewerEngine();