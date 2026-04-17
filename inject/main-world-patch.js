(function() {
    const isMasterOn = () => localStorage.getItem('newb_master_switch') !== 'false';
    const isLayoutOptEnabled = () => isMasterOn() && localStorage.getItem('newb_layout_opt') === 'true';
    const isShowIpEnabled = () => isMasterOn() && localStorage.getItem('newb_show_ip') === 'true';

    console.log('newB: Main World Patch Initializing...');

    /* ==========================================
     * 模块 A: Fetch & XHR 网络拦截器 (净化与防遥测)
     * ========================================== */
    const BLOCKED_URLS =['cm.bilibili.com/cm/api/fees/pc', 'data.bilibili.com/v2/log/web', 'data.bilibili.com/log/web'];
    const FEED_API = 'api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd';

    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        if (!isMasterOn()) return originalFetch(input, init);
        
        const urlStr = typeof input === 'string' ? input : (input?.url || '');

        if (BLOCKED_URLS.some(blocked => urlStr.includes(blocked))) {
            return Promise.reject(new Error("Blocked telemetry by newB"));
        }

        if (urlStr.includes(FEED_API)) {
            try {
                const response = await originalFetch(input, init);
                const clone = response.clone();
                const json = await clone.json();

                if (json.data?.item) {
                    json.data.item = json.data.item.filter(item => 
                        !['ad', 'live'].includes(item.goto) && item.card_type !== 'ad_web_s'
                    );
                    return new Response(JSON.stringify(json), { 
                        status: response.status, 
                        statusText: response.statusText, 
                        headers: response.headers 
                    });
                }
                return response;
            } catch (e) {
                return originalFetch(input, init);
            }
        }
        return originalFetch(input, init);
    };

    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._newbUrl = url;
        return originalXhrOpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
        if (isMasterOn() && typeof this._newbUrl === 'string' && BLOCKED_URLS.some(blocked => this._newbUrl.includes(blocked))) {
            this.abort();
            return;
        }
        return originalXhrSend.apply(this, args);
    };

    /* ==========================================
     * 模块 B: Web Components 劫持 (样式注入与 IP 属地)
     * ========================================== */
    const LAYOUT_STYLES = {
        "bili-comments-header-renderer": `
            .bili-comments-bottom-fixed-wrapper { margin-bottom: 1rem; }
            .bili-comments-bottom-fixed-wrapper > div {
                background-color: var(--newb-bottom-bg, #F0F7FC) !important;
                border-radius: .8rem;
                border: 1px solid var(--line_regular, #a5a5a54d) !important;
                box-shadow: rgb(125 131 127 / 14%) 0px 0px 8px 1px;
                padding: 5px 0px !important;
            }
        `,
        "bili-comment-box": `
            #comment-area { margin-right: 1rem; }
            #editor {
                border: 1px solid rgb(0 0 0 / 5%);
                border-radius: .75rem;
                background-color: var(--newb-editor-bg, #F0F7FC) !important;
                transition: background-color 0.2s ease;
            }
            #editor:hover { background-color: var(--newb-editor-hover-bg, #FFFFFF) !important; }
            #editor:focus-within, #editor.is-active { background-color: var(--newb-editor-focus-bg, #FFFFFF) !important; }
            button.tool-btn { border-radius: 6px; }
        `
    };

    const ipBaseSheet = new CSSStyleSheet();
    ipBaseSheet.replaceSync(`
        #reply { position: relative; }
        #reply::after {
            position: absolute; left: 100%; margin-left: 1.5rem;
            white-space: nowrap; font-size: 10px; color: #9499a0; text-align: end; bottom: 2px;
        }
    `);

    const originalDefine = customElements.define;
    customElements.define = function(name, constructor, options) {
        let WrappedConstructor = constructor;
        
        const needsLayoutPatch = isLayoutOptEnabled() && LAYOUT_STYLES[name];
        const needsIpPatch = isShowIpEnabled() && name === 'bili-comment-action-buttons-renderer';

        if (needsLayoutPatch || needsIpPatch) {
            WrappedConstructor = class extends constructor {
                connectedCallback() {
                    super.connectedCallback?.();
                    if (!this.shadowRoot) return;

                    const sheetsToInject =[];

                    if (needsLayoutPatch) {
                        const layoutSheet = new CSSStyleSheet();
                        layoutSheet.replaceSync(LAYOUT_STYLES[name]);
                        sheetsToInject.push(layoutSheet);
                    }

                    if (needsIpPatch) {
                        sheetsToInject.push(ipBaseSheet);
                        const location = this.__data?.reply_control?.location;
                        if (location) {
                            const dynamicIpSheet = new CSSStyleSheet();
                            dynamicIpSheet.replaceSync(`#reply::after { content: "${location}"; }`);
                            sheetsToInject.push(dynamicIpSheet);
                        }
                    }

                    if (sheetsToInject.length > 0) {
                        this.shadowRoot.adoptedStyleSheets =[
                            ...this.shadowRoot.adoptedStyleSheets,
                            ...sheetsToInject
                        ];
                    }
                }
            };
        }
        return originalDefine.call(this, name, WrappedConstructor, options);
    };
})();