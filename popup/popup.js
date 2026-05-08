document.addEventListener("DOMContentLoaded", async () => {
  const configManager = window.newbConfigManager;
  let config = await configManager.loadConfig();

  /**
   * 初始化应用状态 (恢复上次打开的 Tab)
   */
  const init = async () => {
    const { lastTabId } = await chrome.storage.local.get("lastTabId");
    if (lastTabId) {
      const targetTab = document.querySelector(
        `.nav-links li[data-target="${lastTabId}"]`,
      );
      if (targetTab) {
        document
          .querySelectorAll(".nav-links li, .tab-pane")
          .forEach((el) => el.classList.remove("active"));
        targetTab.classList.add("active");
        document.getElementById(lastTabId)?.classList.add("active");
      }
    }
    renderAll();
    bindEvents();
  };

  /**
   * 渲染所有 UI 组件与配置状态
   */
  const renderAll = () => {
    // 1. 基础设置渲染
    document.getElementById("master-switch").checked =
      config.masterSwitch ?? true;
    document.getElementById("cleanup-enabled").checked = config.cleanup.enabled;
    document.getElementById("min-duration").value = config.filter.minDuration;

    // 渲染过滤子项开关 (兼容旧版配置，默认开启)
    document.getElementById("duration-enabled").checked =
      config.filter.durationEnabled ?? true;
    document.getElementById("title-enabled").checked =
      config.filter.titleEnabled ?? true;
    document.getElementById("up-enabled").checked =
      config.filter.upEnabled ?? true;
    document.getElementById("section-enabled").checked =
      config.filter.sectionEnabled ?? true;
    document.getElementById("tag-enabled").checked =
      config.filter.tagEnabled ?? true;

    // 2. UI 增强开关渲染
    const ui = config.ui;
    document.getElementById("ui-layout-opt").checked = ui.layoutOptimization;
    document.getElementById("ui-hide-hot-search").checked =
      ui.hideHotSearch ?? false;
    document.getElementById("ui-hide-recommend").checked =
      ui.hideRecommend ?? false;
    document.getElementById("ui-redirect-home").checked =
      ui.redirectHomeToSearch ?? false;
    document.getElementById("ui-hide-home-feed").checked =
      ui.hideHomeFeed ?? false;
    document.getElementById("ui-video-info-hover").checked =
      ui.videoInfoHover ?? true;
    document.getElementById("ui-video-info-hover-ai").checked =
      ui.videoInfoHoverAi ?? true;
    document.getElementById("ui-video-info-hover-reply").checked =
      ui.videoInfoHoverReply ?? true;
    document.getElementById("ui-user-info-hover").checked =
      ui.userInfoHover ?? true;
    document.getElementById("ui-video-info-delay").value =
      ui.infoHoverDelay ?? 500;
    document.getElementById("ui-show-ip").checked = ui.showIpLocation;
    document.getElementById("ui-show-cover-viewer").checked =
      ui.showCoverViewer ?? false;
    document.getElementById("ui-hao-van-de").checked = ui.haoVanDe ?? false;

    // 3.  Dark♂ 模式渲染与自身主题切换
    const nm = ui.nightMode || {
      enabled: true,
      followSystem: true,
      start: "18:00",
      end: "06:00",
    };

    // 状态映射：优先读取显式保存的 mode，兼容旧版配置
    let mode = nm.mode;
    if (!mode) {
      if (!nm.enabled) mode = "off";
      else if (nm.followSystem) mode = "system";
      else if (nm.start === "00:00" && nm.end === "23:59") mode = "on";
      else mode = "custom";
    }
    document.getElementById("ui-night-mode-select").value = mode;
    document.getElementById("ui-night-start").value = nm.start;
    document.getElementById("ui-night-end").value = nm.end;

    // 控制时间选择器的显示状态 (仅在自定义时段时展开)
    const timeRangeEl = document.getElementById("night-time-range");
    if (mode === "custom") {
      timeRangeEl.style.maxHeight = "40px";
      timeRangeEl.style.opacity = "1";
      timeRangeEl.style.marginTop = "8px";
      timeRangeEl.style.pointerEvents = "auto";
    } else {
      timeRangeEl.style.maxHeight = "0";
      timeRangeEl.style.opacity = "0";
      timeRangeEl.style.marginTop = "0";
      timeRangeEl.style.pointerEvents = "none";
    }

    // 视频悬浮窗子面板的联动折叠
    const videoHoverEnabled = ui.videoInfoHover ?? true;
    const subPanel = document.getElementById("video-hover-sub-panel");
    if (videoHoverEnabled) {
      subPanel.style.maxHeight = "150px";
      subPanel.style.opacity = "1";
      subPanel.style.marginTop = "10px";
      subPanel.style.pointerEvents = "auto";
    } else {
      subPanel.style.maxHeight = "0";
      subPanel.style.opacity = "0";
      subPanel.style.marginTop = "0";
      subPanel.style.pointerEvents = "none";
    }

    const isTimeInRange = (startStr, endStr) => {
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const [sH, sM] = startStr.split(":").map(Number);
      const [eH, eM] = endStr.split(":").map(Number);
      const startMins = sH * 60 + sM;
      const endMins = eH * 60 + eM;
      return startMins < endMins
        ? currentMins >= startMins && currentMins <= endMins
        : currentMins >= startMins || currentMins <= endMins;
    };

    // 动态判断 Popup 自身是否需要开启 Dark♂ 模式
    const isSystemDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    let isDarkTime = false;
    if (mode === "on") isDarkTime = true;
    else if (mode === "system") isDarkTime = isSystemDark;
    else if (mode === "custom") isDarkTime = isTimeInRange(nm.start, nm.end);

    document.body.classList.toggle("dark-mode", mode !== "off" && isDarkTime);

    // 4. 关键词标签渲染
    const renderTags = (containerId, list, type) => {
      const container = document.getElementById(containerId);
      container.innerHTML = list
        .map(
          (word) => `
                <div class="tag">${word}<span class="tag-remove" data-type="${type}" data-word="${word}">×</span></div>
            `,
        )
        .join("");
    };

    renderTags("title-tags", config.filter.titleKeywords, "titleKeywords");
    renderTags("up-tags", config.filter.upKeywords, "upKeywords");
    renderTags(
      "section-tags",
      config.filter.sectionKeywords,
      "sectionKeywords",
    );
    renderTags("tag-tags", config.filter.tagKeywords || [], "tagKeywords");

    // 5. 渲染拦截日志
    renderLogs();
  };

  /**
   * 保存当前表单状态至本地并刷新 UI
   */
  const saveAndRefresh = async () => {
    // 好van的拦截器：若开启，则通过随机字典读取错位的 DOM 状态
    const getVal = (id) => {
      if (id === "ui-hao-van-de" || id === "master-switch") {
        const el = document.getElementById(id);
        return el ? el.checked : false;
      }
      const mappedId =
        config.ui.haoVanDe && config.ui.haoVanDeMap
          ? config.ui.haoVanDeMap[id] || id
          : id;
      const el = document.getElementById(mappedId);
      return el ? el.checked : false;
    };

    config.masterSwitch = document.getElementById("master-switch").checked;
    config.filter.minDuration =
      parseFloat(document.getElementById("min-duration").value) || 0;
    config.ui.infoHoverDelay =
      parseInt(document.getElementById("ui-video-info-delay").value) || 500;

    // 经过拦截器处理的开关状态
    config.cleanup.enabled = getVal("cleanup-enabled");
    config.filter.durationEnabled = getVal("duration-enabled");
    config.filter.titleEnabled = getVal("title-enabled");
    config.filter.upEnabled = getVal("up-enabled");
    config.filter.sectionEnabled = getVal("section-enabled");
    config.filter.tagEnabled = getVal("tag-enabled");

    config.ui.layoutOptimization = getVal("ui-layout-opt");
    config.ui.hideHotSearch = getVal("ui-hide-hot-search");
    config.ui.hideRecommend = getVal("ui-hide-recommend");
    config.ui.redirectHomeToSearch = getVal("ui-redirect-home");
    config.ui.hideHomeFeed = getVal("ui-hide-home-feed");
    config.ui.videoInfoHover = getVal("ui-video-info-hover");
    config.ui.videoInfoHoverAi = getVal("ui-video-info-hover-ai");
    config.ui.videoInfoHoverReply = getVal("ui-video-info-hover-reply");
    config.ui.userInfoHover = getVal("ui-user-info-hover");
    config.ui.showIpLocation = getVal("ui-show-ip");
    config.ui.showCoverViewer = getVal("ui-show-cover-viewer");
    config.ui.haoVanDe = getVal("ui-hao-van-de"); // 确保状态同步时包含自身，但已被 getVal 豁免错位

    const nightModeSelect = document.getElementById(
      "ui-night-mode-select",
    ).value;
    config.ui.nightMode = {
      mode: nightModeSelect, // 显式保存 UI 模式，防止时间重合导致的状态回弹
      enabled: nightModeSelect !== "off",
      followSystem: nightModeSelect === "system",
      // 巧妙映射：当选择"始终开启"时，将时间段设为全天，无需修改底层引擎代码
      start:
        nightModeSelect === "on"
          ? "00:00"
          : document.getElementById("ui-night-start").value,
      end:
        nightModeSelect === "on"
          ? "23:59"
          : document.getElementById("ui-night-end").value,
    };

    await configManager.saveLocal(config);
    renderAll(); // 确保状态同步
  };

  /**
   * 渲染拦截日志列表
   */
  const renderLogs = () => {
    chrome.storage.local.get({ blockedLogs: [] }, (data) => {
      const listEl = document.getElementById("log-list");
      if (data.blockedLogs.length === 0) {
        listEl.innerHTML = '<div class="empty-log">暂无拦截记录</div>';
        return;
      }

      listEl.innerHTML = data.blockedLogs
        .map((log) => {
          // 安全校验：防止 XSS 与非法协议跳转
          const isValidUrl = (url) =>
            url && url !== "#" && !url.startsWith("javascript:");

          const titleHtml = isValidUrl(log.videoUrl)
            ? `<a class="log-title-link" href="${log.videoUrl}" target="_blank">${log.title}</a>`
            : `<span class="log-title-link no-link">${log.title}</span>`;

          let upHtml = "";
          if (log.up) {
            const upLinkHtml = isValidUrl(log.upUrl)
              ? `<a class="log-up-link" href="${log.upUrl}" target="_blank">${log.up}</a>`
              : `<span class="log-up-link no-link">${log.up}</span>`;
            upHtml = `<div class="log-up">UP: ${upLinkHtml}</div>`;
          }

          return `
                    <div class="log-item">
                        <div class="log-meta">
                            <span class="log-tag">${log.type}: ${log.reason}</span>
                            <span class="log-time">${new Date(log.time).toLocaleTimeString()}</span>
                        </div>
                        ${titleHtml}
                        ${upHtml}
                    </div>
                `;
        })
        .join("");
    });
  };

  /**
   * 绑定所有 DOM 事件
   */
  const bindEvents = () => {
    // 1. 绑定所有开关与输入框的 Change 事件
    const inputs = [
      "master-switch",
      "cleanup-enabled",
      "duration-enabled",
      "min-duration",
      "title-enabled",
      "up-enabled",
      "section-enabled",
      "tag-enabled",
      "ui-night-mode-select",
      "ui-night-start",
      "ui-night-end",
      "ui-layout-opt",
      "ui-hide-hot-search",
      "ui-hide-recommend",
      "ui-redirect-home",
      "ui-hide-home-feed",
      "ui-video-info-hover",
      "ui-video-info-hover-ai",
      "ui-video-info-hover-reply",
      "ui-user-info-hover",
      "ui-video-info-delay",
      "ui-show-ip",
      "ui-show-cover-viewer",
    ];
    inputs.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", saveAndRefresh);
    });

    // 2. Tab 切换逻辑
    document.querySelectorAll(".nav-links li").forEach((li) => {
      li.addEventListener("click", () => {
        const targetId = li.dataset.target;
        document
          .querySelectorAll(".nav-links li, .tab-pane")
          .forEach((el) => el.classList.remove("active"));
        li.classList.add("active");
        document.getElementById(targetId)?.classList.add("active");
        chrome.storage.local.set({ lastTabId: targetId });
      });
    });

    // 3. 关键词添加逻辑封装
    const setupAdd = (prefix, type) => {
      const input = document.getElementById(`${prefix}-input`);
      const btn = document.getElementById(`${prefix}-add`);
      if (!input || !btn) return;

      const addKeyword = async () => {
        const val = input.value.trim();
        config.filter[type] = config.filter[type] || [];
        if (val && !config.filter[type].includes(val)) {
          config.filter[type].push(val);
          await saveAndRefresh();
          input.value = "";
        }
      };

      btn.addEventListener("click", addKeyword);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addKeyword();
      });
    };

    setupAdd("title", "titleKeywords");
    setupAdd("up", "upKeywords");
    setupAdd("section", "sectionKeywords");
    setupAdd("tag", "tagKeywords");

    // 4. 关键词删除逻辑 (事件委托)
    document.body.addEventListener("click", async (e) => {
      if (e.target.classList.contains("tag-remove")) {
        const { type, word } = e.target.dataset;
        config.filter[type] = config.filter[type].filter((w) => w !== word);
        await saveAndRefresh();
      }
    });

    // 5. 日志清理
    document.getElementById("clear-logs").addEventListener("click", () => {
      chrome.storage.local.set({ blockedLogs: [] }, renderLogs);
    });

    // 6. 云端同步与导入导出
    document
      .getElementById("btn-upload")
      .addEventListener("click", async (e) => {
        const btn = e.target;
        btn.innerText = "正在备份...";
        const res = await configManager.uploadToCloud();
        document.getElementById("sync-status").innerText = res.success
          ? `备份成功! 版本:${res.version}`
          : `失败: ${res.error}`;
        btn.innerText = "备份当前配置到云端 ↑";
      });

    document
      .getElementById("btn-download")
      .addEventListener("click", async () => {
        if (!confirm("确定要从云端恢复吗？当前本地配置将被覆盖。")) return;
        const res = await configManager.downloadFromCloud();
        if (res.success) {
          config = res.config;
          renderAll();
          alert("恢复成功！");
        } else {
          alert(res.error);
        }
      });

    document
      .getElementById("btn-export")
      .addEventListener("click", () => configManager.exportJSON(config));

    const fileInput = document.getElementById("file-import");
    document
      .getElementById("btn-import-trigger")
      .addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async (e) => {
      if (e.target.files[0]) {
        config = await configManager.importJSON(e.target.files[0]);
        renderAll();
        alert("导入成功！");
      }
    });

    // 7. 监听 Storage 变化，实现日志实时更新
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.blockedLogs) renderLogs();
    });

    // 8. 监听系统主题变化 (实时更新 Popup 自身主题)
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (config.ui?.nightMode?.followSystem) renderAll();
      });

    // 9. 好van的逻辑 (独立于常规 inputs 监听)
    const haoVanDeToggle = document.getElementById("ui-hao-van-de");
    const haoVanDeModal = document.getElementById("hao-van-de-modal");

    // 定义两个独立的隔离区，防止跨区错位
    const filterSwitches = [
      "cleanup-enabled",
      "duration-enabled",
      "title-enabled",
      "up-enabled",
      "section-enabled",
      "tag-enabled",
    ];
    const uiSwitches = [
      "ui-layout-opt",
      "ui-hide-hot-search",
      "ui-hide-recommend",
      "ui-redirect-home",
      "ui-hide-home-feed",
      "ui-video-info-hover",
      "ui-video-info-hover-ai",
      "ui-video-info-hover-reply",
      "ui-user-info-hover",
      "ui-show-ip",
      "ui-show-cover-viewer",
    ];

    // 洗牌算法 (Fisher-Yates)
    const shuffleArray = (array) => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    // 生成随机映射字典
    const generateMap = () => {
      const map = {};
      const shuffledFilter = shuffleArray(filterSwitches);
      const shuffledUI = shuffleArray(uiSwitches);
      filterSwitches.forEach((id, index) => (map[id] = shuffledFilter[index]));
      uiSwitches.forEach((id, index) => (map[id] = shuffledUI[index]));
      return map;
    };

    if (haoVanDeToggle) {
      haoVanDeToggle.addEventListener("change", (e) => {
        if (e.target.checked) {
          e.target.checked = false; // 视觉上先恢复，等待用户确认
          haoVanDeModal.classList.add("show");
        } else {
          // 关闭好van的，销毁随机字典
          config.ui.haoVanDe = false;
          config.ui.haoVanDeMap = null;
          saveAndRefresh();
        }
      });
    }

    document
      .getElementById("modal-btn-cancel")
      ?.addEventListener("click", () => {
        haoVanDeModal.classList.remove("show");
      });

    document
      .getElementById("modal-btn-export")
      ?.addEventListener("click", () => {
        configManager.exportJSON(config);
      });

    document
      .getElementById("modal-btn-confirm")
      ?.addEventListener("click", () => {
        haoVanDeModal.classList.remove("show");
        config.ui.haoVanDe = true;
        config.ui.haoVanDeMap = generateMap(); // 生成全新的混沌闭环
        haoVanDeToggle.checked = true;
        saveAndRefresh();
      });
  };

  init();
});
