/**
 * 纯 JS 实现的 MD5 算法 (无外部依赖)
 * 专用于 B站 Wbi 接口的 w_rid 签名计算
 */
const biliMD5 = (function () {
    function d(n, t) { var r = (65535 & n) + (65535 & t); return (n >> 16) + (t >> 16) + (r >> 16) << 16 | 65535 & r }
    function f(n, t, r, e, o, u) { return d((u = d(d(t, n), d(e, u))) << o | u >>> 32 - o, r) }
    function l(n, t, r, e, o, u, c) { return f(t & r | ~t & e, n, t, o, u, c) }
    function g(n, t, r, e, o, u, c) { return f(t & e | r & ~e, n, t, o, u, c) }
    function v(n, t, r, e, o, u, c) { return f(t ^ r ^ e, n, t, o, u, c) }
    function m(n, t, r, e, o, u, c) { return f(r ^ (t | ~e), n, t, o, u, c) }
    function c(n, t) {
        var r, e, o, u; n[t >> 5] |= 128 << t % 32, n[14 + (t + 64 >>> 9 << 4)] = t;
        for (var c = 1732584193, f = -271733879, i = -1732584194, a = 271733878, h = 0; h < n.length; h += 16)
            c = l(r = c, e = f, o = i, u = a, n[h], 7, -680876936), a = l(a, c, f, i, n[h + 1], 12, -389564586), i = l(i, a, c, f, n[h + 2], 17, 606105819), f = l(f, i, a, c, n[h + 3], 22, -1044525330), c = l(c, f, i, a, n[h + 4], 7, -176418897), a = l(a, c, f, i, n[h + 5], 12, 1200080426), i = l(i, a, c, f, n[h + 6], 17, -1473231341), f = l(f, i, a, c, n[h + 7], 22, -45705983), c = l(c, f, i, a, n[h + 8], 7, 1770035416), a = l(a, c, f, i, n[h + 9], 12, -1958414417), i = l(i, a, c, f, n[h + 10], 17, -42063), f = l(f, i, a, c, n[h + 11], 22, -1990404162), c = l(c, f, i, a, n[h + 12], 7, 1804603682), a = l(a, c, f, i, n[h + 13], 12, -40341101), i = l(i, a, c, f, n[h + 14], 17, -1502002290), c = g(c, f = l(f, i, a, c, n[h + 15], 22, 1236535329), i, a, n[h + 1], 5, -165796510), a = g(a, c, f, i, n[h + 6], 9, -1069501632), i = g(i, a, c, f, n[h + 11], 14, 643717713), f = g(f, i, a, c, n[h], 20, -373897302), c = g(c, f, i, a, n[h + 5], 5, -701558691), a = g(a, c, f, i, n[h + 10], 9, 38016083), i = g(i, a, c, f, n[h + 15], 14, -660478335), f = g(f, i, a, c, n[h + 4], 20, -405537848), c = g(c, f, i, a, n[h + 9], 5, 568446438), a = g(a, c, f, i, n[h + 14], 9, -1019803690), i = g(i, a, c, f, n[h + 3], 14, -187363961), f = g(f, i, a, c, n[h + 8], 20, 1163531501), c = g(c, f, i, a, n[h + 13], 5, -1444681467), a = g(a, c, f, i, n[h + 2], 9, -51403784), i = g(i, a, c, f, n[h + 7], 14, 1735328473), c = v(c, f = g(f, i, a, c, n[h + 12], 20, -1926607734), i, a, n[h + 5], 4, -378558), a = v(a, c, f, i, n[h + 8], 11, -2022574463), i = v(i, a, c, f, n[h + 11], 16, 1839030562), f = v(f, i, a, c, n[h + 14], 23, -35309556), c = v(c, f, i, a, n[h + 1], 4, -1530992060), a = v(a, c, f, i, n[h + 4], 11, 1272893353), i = v(i, a, c, f, n[h + 7], 16, -155497632), f = v(f, i, a, c, n[h + 10], 23, -1094730640), c = v(c, f, i, a, n[h + 13], 4, 681279174), a = v(a, c, f, i, n[h], 11, -358537222), i = v(i, a, c, f, n[h + 3], 16, -722521979), f = v(f, i, a, c, n[h + 6], 23, 76029189), c = v(c, f, i, a, n[h + 9], 4, -640364487), a = v(a, c, f, i, n[h + 12], 11, -421815835), i = v(i, a, c, f, n[h + 15], 16, 530742520), c = m(c, f = v(f, i, a, c, n[h + 2], 23, -995338651), i, a, n[h], 6, -198630844), a = m(a, c, f, i, n[h + 7], 10, 1126891415), i = m(i, a, c, f, n[h + 14], 15, -1416354905), f = m(f, i, a, c, n[h + 5], 21, -57434055), c = m(c, f, i, a, n[h + 12], 6, 1700485571), a = m(a, c, f, i, n[h + 3], 10, -1894986606), i = m(i, a, c, f, n[h + 10], 15, -1051523), f = m(f, i, a, c, n[h + 1], 21, -2054922799), c = m(c, f, i, a, n[h + 8], 6, 1873313359), a = m(a, c, f, i, n[h + 15], 10, -30611744), i = m(i, a, c, f, n[h + 6], 15, -1560198380), f = m(f, i, a, c, n[h + 13], 21, 1309151649), c = m(c, f, i, a, n[h + 4], 6, -145523070), a = m(a, c, f, i, n[h + 11], 10, -1120210379), i = m(i, a, c, f, n[h + 2], 15, 718787259), f = m(f, i, a, c, n[h + 9], 21, -343485551), c = d(c, r), f = d(f, e), i = d(i, o), a = d(a, u);
        return[c, f, i, a]
    }
    function i(n) { for (var t = "", r = 32 * n.length, e = 0; e < r; e += 8)t += String.fromCharCode(n[e >> 5] >>> e % 32 & 255); return t }
    function a(n) { var t = []; for (t[(n.length >> 2) - 1] = void 0, e = 0; e < t.length; e += 1)t[e] = 0; for (var r = 8 * n.length, e = 0; e < r; e += 8)t[e >> 5] |= (255 & n.charCodeAt(e / 8)) << e % 32; return t }
    function e(n) { for (var t, r = "0123456789abcdef", e = "", o = 0; o < n.length; o += 1)t = n.charCodeAt(o), e += r.charAt(t >>> 4 & 15) + r.charAt(15 & t); return e }
    function r(n) { return unescape(encodeURIComponent(n)) }
    function o(n) { return i(c(a(n = r(n)), 8 * n.length)) }
    function u(n, t) { return function (n, t) { var r, e = a(n), o =[], u = []; for (o[15] = u[15] = void 0, 16 < e.length && (e = c(e, 8 * n.length)), r = 0; r < 16; r += 1)o[r] = 909522486 ^ e[r], u[r] = 1549556828 ^ e[r]; return t = c(o.concat(a(t)), 512 + 8 * t.length), i(c(u.concat(t), 640)) }(r(n), r(t)) }
    return function (n, t, r) { return t ? r ? u(t, n) : e(u(t, n)) : r ? o(n) : e(o(n)) }
})();

class BiliAPI {
    constructor() {
        this.wbiKeys = null;         // 缓存的 Wbi 密钥对 (img_key, sub_key)
        this.wbiKeysFetchTime = 0;   // 密钥获取时间戳，用于控制缓存失效
    }

    /**
     * 生成 Wbi 签名 (核心鉴权逻辑)
     * @param {Object} params - 原始请求参数
     * @param {string} img_key - 从 nav 接口获取的 img_key
     * @param {string} sub_key - 从 nav 接口获取的 sub_key
     * @returns {string} 拼接好 w_rid 签名的 URL 查询字符串
     */
    encWbi(params, img_key, sub_key) {
        // B站固定的混淆表，用于打乱密钥字符顺序
        const mixinKeyEncTab =[
            46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
            33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
            61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
            36, 20, 34, 44, 52
        ];
        
        // 1. 拼接并混淆生成最终的 mixin_key
        const orig = img_key + sub_key;
        const mixin_key = mixinKeyEncTab.map(n => orig[n]).join('').slice(0, 32);

        // 2. 注入当前时间戳并过滤非法字符
        const curr_time = Math.round(Date.now() / 1000);
        const chr_filter = /[!'()*]/g;
        const queryParams = { ...params, wts: curr_time };
        
        // 3. 按字典序排序参数并拼接
        const queryString = Object.keys(queryParams)
            .sort()
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key].toString().replace(chr_filter, ''))}`)
            .join('&');
            
        // 4. 计算 MD5 得到 w_rid
        const wbi_sign = biliMD5(queryString + mixin_key);
        return `${queryString}&w_rid=${wbi_sign}`;
    }

    /**
     * 获取并缓存 Wbi 密钥 (有效期 12 小时)
     * @returns {Promise<Object|null>} 包含 img_key 和 sub_key 的对象
     */
    async getWbiKeys() {
        // 命中缓存则直接返回
        if (this.wbiKeys && (Date.now() - this.wbiKeysFetchTime < 12 * 60 * 60 * 1000)) {
            return this.wbiKeys;
        }
        
        try {
            const res = await fetch('https://api.bilibili.com/x/web-interface/nav');
            const { data } = await res.json();
            const { img_url, sub_url } = data.wbi_img;
            
            // 从 URL 中提取 key (截取文件名部分)
            this.wbiKeys = {
                img_key: img_url.slice(img_url.lastIndexOf('/') + 1, img_url.lastIndexOf('.')),
                sub_key: sub_url.slice(sub_url.lastIndexOf('/') + 1, sub_url.lastIndexOf('.'))
            };
            this.wbiKeysFetchTime = Date.now();
            return this.wbiKeys;
        } catch (e) {
            console.error("newB: Wbi 密钥获取失败", e);
            return null;
        }
    }

    /**
     * 获取视频详细信息 (带 Wbi 签名)
     * @param {string} bvid - 视频的 BV 号
     * @returns {Promise<Object>} 视频详情数据
     */
        async fetchVideoInfo(bvid) {
        const keys = await this.getWbiKeys();
        if (!keys) throw new Error("Wbi keys fetch failed");
        
        const query = this.encWbi({ bvid }, keys.img_key, keys.sub_key);
        const res = await fetch(`https://api.bilibili.com/x/web-interface/view/detail?${query}`, { credentials: 'include' });
        
        // 触发风控拦截
        if (res.status === 412) throw new Error("412_BANNED");
        
        const json = await res.json();
        if (json.code !== 0) throw new Error(json.message);
        
        return json.data;
    }

    /**
     * 获取视频 AI 总结
     * @param {string} bvid - 视频 BV 号
     * @param {number} cid - 视频 cid
     * @param {number} up_mid - UP主 mid
     * @returns {Promise<Object>} AI 总结数据
     */
    async fetchVideoConclusion(bvid, cid, up_mid) {
        const keys = await this.getWbiKeys();
        if (!keys) throw new Error("Wbi keys fetch failed");
        
        const query = this.encWbi({ bvid, cid, up_mid }, keys.img_key, keys.sub_key);
        const res = await fetch(`https://api.bilibili.com/x/web-interface/view/conclusion/get?${query}`, { credentials: 'include' });
        
        if (res.status === 412) throw new Error("412_BANNED");
        const json = await res.json();
        if (json.code !== 0) throw new Error(json.message);
        return json.data;
    }

    /**
     * 获取视频热评
     * @param {number} aid - 视频 aid (oid)
     * @returns {Promise<Object>} 评论数据
     */
    async fetchVideoReply(aid) {
        const keys = await this.getWbiKeys();
        if (!keys) throw new Error("Wbi keys fetch failed");
        
        const query = this.encWbi({ type: 1, oid: aid }, keys.img_key, keys.sub_key);
        const res = await fetch(`https://api.bilibili.com/x/v2/reply/wbi/main?${query}`, { credentials: 'include' });
        
        if (res.status === 412) throw new Error("412_BANNED");
        const json = await res.json();
        if (json.code !== 0) throw new Error(json.message);
        return json.data;
    }

    /**
     * 获取 UP 主个人资料与统计数据 (并发请求)
     * @param {string|number} mid - UP主 mid
     * @returns {Promise<Object>} 聚合后的用户数据
     */
    async fetchUserProfile(mid) {
        const keys = await this.getWbiKeys();
        if (!keys) throw new Error("Wbi keys fetch failed");

        const infoQuery = this.encWbi({ mid }, keys.img_key, keys.sub_key);
        const relQuery = this.encWbi({ mid }, keys.img_key, keys.sub_key);

        // 并发请求：基础信息、关注数/粉丝数、播放量/获赞数、当前登录用户的关注关系
        const [infoRes, statRes, upstatRes, relRes] = await Promise.allSettled([
            fetch(`https://api.bilibili.com/x/space/wbi/acc/info?${infoQuery}`, { credentials: 'include' }).then(r => r.json()),
            fetch(`https://api.bilibili.com/x/relation/stat?vmid=${mid}`, { credentials: 'include' }).then(r => r.json()),
            fetch(`https://api.bilibili.com/x/space/upstat?mid=${mid}`, { credentials: 'include' }).then(r => r.json()),
            fetch(`https://api.bilibili.com/x/space/wbi/acc/relation?${relQuery}`, { credentials: 'include' }).then(r => r.json())
        ]);

        return {
            info: infoRes.status === 'fulfilled' && infoRes.value.code === 0 ? infoRes.value.data : null,
            stat: statRes.status === 'fulfilled' && statRes.value.code === 0 ? statRes.value.data : null,
            upstat: upstatRes.status === 'fulfilled' && upstatRes.value.code === 0 ? upstatRes.value.data : null,
            relation: relRes.status === 'fulfilled' && relRes.value.code === 0 ? relRes.value.data : null
        };
    }

    /**
     * 修改用户关注/拉黑状态
     * @param {string|number} mid - 目标用户 mid
     * @param {number} act - 操作类型 (1:关注 2:取消关注 5:拉黑 6:取消拉黑)
     * @returns {Promise<Object>}
     */
    async modifyRelation(mid, act) {
        // 从 Cookie 中提取 CSRF Token (bili_jct)
        const match = document.cookie.match(/bili_jct=([^;]+)/);
        const csrf = match ? match[1] : '';
        if (!csrf) throw new Error("CSRF token not found");

        const formData = new URLSearchParams();
        formData.append('fid', mid);
        formData.append('act', act);
        formData.append('re_src', 11);
        formData.append('csrf', csrf);

        const res = await fetch('https://api.bilibili.com/x/relation/modify', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        const json = await res.json();
        if (json.code !== 0) throw new Error(json.message);
        return json;
    }

    /**
     * 获取视频当前在线观看人数
     * @param {string|number} aid - 稿件 avid
     * @param {string|number} cid - 视频 cid
     * @param {string} bvid - 稿件 bvid
     * @returns {Promise<Object>} 在线人数统计数据
     */
    async getOnlineTotal(aid, cid, bvid) {
        const res = await fetch(`https://api.bilibili.com/x/player/online/total?aid=${aid}&cid=${cid}&bvid=${bvid}`);
        
        // 触发风控拦截
        if (res.status === 412) throw new Error("412_BANNED");
        
        const json = await res.json();
        if (json.code !== 0) throw new Error(json.message);
        
        return json.data;
    }
}

// 挂载至全局 window 对象，供其他模块调用
window.newbAPI = new BiliAPI();