class ConfigManager {
    constructor() {
        this.configKey = "newb_settings_v1";
        this.cloudKey = "newb_cloud_sync";
        
        // 默认配置模板
        this.defaultConfig = {
            version: Date.now(),
            masterSwitch: true,
            cleanup: {
                enabled: true,
                hideLive: true,
                hideAds: true
            },
            filter: {
                enabled: true,
                minDuration: 0,
                titleKeywords: [],
                upKeywords:[],
                sectionKeywords: [],
                tagKeywords:[]
            },
            ui: {
                nightMode: {
                    enabled: true,
                    followSystem: true,
                    start: "18:30",
                    end: "06:00"
                },
                layoutOptimization: true,
                hideRecommend: false,
                hideHotSearch: true,
                videoInfoHover: true,
                videoInfoHoverAi: true,
                videoInfoHoverReply: true,
                userInfoHover: true,
                videoInfoHoverDelay: 500,
                showIpLocation: false,
                showCoverViewer: false
            }
        };
    }

    /**
     * 加载本地配置并与默认配置进行深度合并
     * @returns {Promise<Object>} 合并后的完整配置对象
     */
    async loadConfig() {
        const res = await chrome.storage.local.get(this.configKey);
        const defaultCfg = JSON.parse(JSON.stringify(this.defaultConfig));
        const savedCfg = res[this.configKey];

        if (!savedCfg) return defaultCfg;

        const mergeValidKeys = (base, target) => {
            const result = { ...base };
            for (const key in target) {
                if (Object.prototype.hasOwnProperty.call(base, key)) {
                    if (typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
                        result[key] = mergeValidKeys(base[key], target[key]);
                    } else {
                        result[key] = target[key];
                    }
                }
            }
            return result;
        };

        const mergedConfig = mergeValidKeys(defaultCfg, savedCfg);
        
        // 独立处理版本号逻辑
        mergedConfig.version = savedCfg.version || defaultCfg.version;

        return mergedConfig;
    }

    /**
     * 保存配置到本地存储，并更新版本时间戳
     * @param {Object} config - 待保存的配置对象
     * @returns {Promise<Object>} 保存后的配置对象
     */
    async saveLocal(config) {
        config.version = Date.now();
        await chrome.storage.local.set({ [this.configKey]: config });
        return config;
    }

    /**
     * 将本地配置备份至 Chrome 云端同步空间
     * @returns {Promise<Object>} 包含 success 状态和 version/error 信息的对象
     */
    async uploadToCloud() {
        try {
            const localConfig = await this.loadConfig();
            await chrome.storage.sync.set({[this.cloudKey]: localConfig });
            return { success: true, version: localConfig.version };
        } catch (e) {
            return { success: false, error: "数据过大或网络异常，同步失败" };
        }
    }

    /**
     * 从 Chrome 云端恢复配置到本地
     * @returns {Promise<Object>} 包含 success 状态和 config/error 信息的对象
     */
    async downloadFromCloud() {
        try {
            const res = await chrome.storage.sync.get(this.cloudKey);
            const cloudConfig = res[this.cloudKey];
            
            if (cloudConfig) {
                await chrome.storage.local.set({[this.configKey]: cloudConfig });
                return { success: true, config: cloudConfig };
            }
            return { success: false, error: "云端未找到备份数据" };
        } catch (e) {
            return { success: false, error: "读取云端数据失败" };
        }
    }

    /**
     * 导出配置为 JSON 文件供用户下载
     * @param {Object} config - 当前配置对象
     */
    exportJSON(config) {
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `newB_config_${Date.now()}.json`;
        a.click();
        
        // 释放内存
        URL.revokeObjectURL(url);
    }

    /**
     * 解析用户上传的 JSON 文件并覆盖本地配置
     * @param {File} file - 用户选择的 JSON 文件
     * @returns {Promise<Object>} 解析并保存后的配置对象
     */
    async importJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    if (typeof config !== 'object' || !config) throw new Error("Invalid Format");
                    
                    await this.saveLocal(config);
                    resolve(config);
                } catch (err) {
                    reject(new Error("无效的配置文件，解析失败"));
                }
            };
            
            reader.onerror = () => reject(new Error("文件读取失败"));
            reader.readAsText(file);
        });
    }
}

// 挂载至全局 window 对象，供其他模块调用
window.newbConfigManager = new ConfigManager();