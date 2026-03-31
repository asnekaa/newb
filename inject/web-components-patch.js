/**
 * ==========================================
 * Web Components 样式穿透补丁 (Shadow DOM Patcher)
 * 运行于 MAIN World，通过劫持 customElements.define 突破 Shadow DOM 隔离，
 * 动态注入自定义布局样式与评论 IP 属地显示功能。
 * ==========================================
 */
(function() {
    // 动态读取本地配置状态 (跨 World 通信依赖 localStorage)
    const isMasterOn = () => localStorage.getItem('newb_master_switch') !== 'false';
    const isLayoutOptEnabled = () => isMasterOn() && localStorage.getItem('newb_layout_opt') === 'true';
    const isShowIpEnabled = () => isMasterOn() && localStorage.getItem('newb_show_ip') === 'true';

    // 预编译的布局优化样式字典 (针对特定 Web Component 标签名)
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

    // 预编译的 IP 属地基础样式表 (复用实例以节省内存)
    const ipBaseSheet = new CSSStyleSheet();
    ipBaseSheet.replaceSync(`
        #reply { position: relative; }
        #reply::after {
            position: absolute; left: 100%; margin-left: 1.5rem;
            white-space: nowrap; font-size: 10px; color: #9499a0; text-align: end; bottom: 2px;
        }
    `);

    // 缓存浏览器原生的组件注册方法
    const originalDefine = customElements.define;

    /**
     * 劫持全局组件注册，动态混入自定义生命周期逻辑
     */
    customElements.define = function(name, constructor, options) {
        let WrappedConstructor = constructor;
        
        // 判定当前组件是否命中注入规则
        const needsLayoutPatch = isLayoutOptEnabled() && LAYOUT_STYLES[name];
        const needsIpPatch = isShowIpEnabled() && name === 'bili-comment-action-buttons-renderer';

        if (needsLayoutPatch || needsIpPatch) {
            // 继承原组件类，重写 connectedCallback 钩子
            WrappedConstructor = class extends constructor {
                connectedCallback() {
                    // 确保 B 站原生逻辑优先执行完毕
                    super.connectedCallback?.();
                    
                    if (!this.shadowRoot) return;

                    const sheetsToInject =[];

                    // 1. 注入布局优化样式
                    if (needsLayoutPatch) {
                        const layoutSheet = new CSSStyleSheet();
                        layoutSheet.replaceSync(LAYOUT_STYLES[name]);
                        sheetsToInject.push(layoutSheet);
                    }

                    // 2. 注入 IP 属地显示样式
                    if (needsIpPatch) {
                        sheetsToInject.push(ipBaseSheet);
                        
                        // 核心：从 B 站组件的内部数据对象 (__data) 中提取 IP 属地信息
                        const location = this.__data?.reply_control?.location;
                        if (location) {
                            const dynamicIpSheet = new CSSStyleSheet();
                            dynamicIpSheet.replaceSync(`#reply::after { content: "${location}"; }`);
                            sheetsToInject.push(dynamicIpSheet);
                        }
                    }

                    // 批量追加新样式表到 Shadow DOM，避免覆盖原有样式
                    if (sheetsToInject.length > 0) {
                        this.shadowRoot.adoptedStyleSheets =[
                            ...this.shadowRoot.adoptedStyleSheets,
                            ...sheetsToInject
                        ];
                    }
                }
            };
        }

        // 调用原生方法完成注册
        return originalDefine.call(this, name, WrappedConstructor, options);
    };
})();