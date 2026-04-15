window.newbUtils = {
    /**
     * 将视频时长字符串转换为分钟数 (支持 MM:SS 与 HH:MM:SS)
     * @param {string} str - 时长字符串 (例: "12:34" 或 "1:12:34")
     * @returns {number} 总分钟数 (例: 12.56)
     */
    parseDuration(str) {
        if (typeof str !== 'string') return 0;
        
        const parts = str.trim().split(':').map(Number);
        if (parts.some(isNaN)) return 0; // 拦截非法格式
        
        // 巧妙利用 reduce 累加计算总秒数，再统一转为分钟
        const totalSeconds = parts.reduce((acc, val) => acc * 60 + val, 0);
        return totalSeconds / 60;
    },
    
    /**
     * 格式化大数字为易读的万级单位 (例: 12345 -> "1.2万", 10000 -> "1万")
     * @param {number|string} num - 原始数字
     * @returns {string|number} 格式化后的字符串或原数字
     */
    formatNum(num) {
        const n = Number(num);
        if (isNaN(n)) return 0; // 拦截非数字输入
        
        // 超过一万则保留一位小数，并正则剔除多余的 ".0" 以优化 UI 视觉
        return n >= 10000 
            ? (n / 10000).toFixed(1).replace(/\.0$/, '') + '万' 
            : n;
    },
    
    /**
     * 将秒数格式化为 MM:SS 或 HH:MM:SS
     * @param {number} sec - 总秒数
     * @returns {string} 格式化后的时间字符串
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
};