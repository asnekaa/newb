window.newbUtils = {
  /**
   * 格式化大数字为易读的万级单位 (例: 12345 -> "1.2万", 10000 -> "1万")
   * @param {number|string} num - 原始数字
   * @returns {string|number} 格式化后的字符串或原数字
   */
  formatNum(num) {
    const n = Number(num);
    if (isNaN(n)) return 0; // 拦截非数字输入

    // 超过一万则保留一位小数，并正则剔除多余的 ".0" 以优化 UI 视觉
    return n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, "") + "万" : n;
  },
};
