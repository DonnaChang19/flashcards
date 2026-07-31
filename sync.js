// ============================================================
// Sync：学习进度云端同步（Phase 3）
// 依赖：CloudStore（cloudstore.js，提供 pullProgress/pushProgress）
//       每个 HTML 注入的 window.__deckStore（PROG/CPROG 访问器）
// 策略：云端优先合并（方案 A）；评分后去抖批量上传；
//       CloudStore 不可用（无网/未登录/CDN 失败）时自动 no-op，localStorage 兜底照常。
// ============================================================

(function () {
  'use strict';

  const Sync = {
    _timer: null,

    // 初始化：把当前套册 slug 交给 CloudStore
    init(deckSlug) {
      if (typeof CloudStore !== 'undefined') CloudStore.init(deckSlug);
    },

    // 取得本页注入的访问器；不存在则无法同步
    _store() {
      return (typeof window !== 'undefined' && window.__deckStore) ? window.__deckStore : null;
    },

    _cloudReady() {
      return typeof CloudStore !== 'undefined' && CloudStore.isReady();
    },

    // 登录成功后调用：拉取云端进度，云端优先合并到本地
    async pull() {
      const st = this._store();
      if (!st || !this._cloudReady()) return;
      try {
        // 单词卡进度
        const cloudWord = await CloudStore.pullProgress(st.deckSlug, 'word');
        if (cloudWord && Object.keys(cloudWord).length) {
          const local = st.getProg() || {};
          // 云端优先：以云端值为准覆盖本地同 key，本地独有 key 保留
          st.setProg(Object.assign({}, local, cloudWord));
        }
        // 挖空卡进度（仅 4 套含 CPROG）
        if (typeof st.hasCloze === 'function' ? st.hasCloze() : st.hasCloze) {
          const cloudCloze = await CloudStore.pullProgress(st.deckSlug, 'cloze');
          if (cloudCloze && Object.keys(cloudCloze).length) {
            const local = st.getCProg() || {};
            st.setCProg(Object.assign({}, local, cloudCloze));
          }
        }
        console.info('[Sync] pull + merge done for deck', st.deckSlug);
      } catch (e) {
        console.warn('[Sync] pull failed, keep local:', e && e.message);
      }
    },

    // 评分 / 完成后调用：去抖批量上传（0.6s 合并连续评分，降低请求数）
    push() {
      const st = this._store();
      if (!st || !this._cloudReady()) return;
      if (this._timer) return; // 已排队，等待 flush
      const self = this;
      this._timer = setTimeout(function () {
        self._timer = null;
        self._flush();
      }, 600);
    },

    async _flush() {
      const st = this._store();
      if (!st || !this._cloudReady()) return;
      try {
        const word = st.getProg() || {};
        await CloudStore.pushProgress(word, st.deckSlug, 'word');
        if (typeof st.hasCloze === 'function' ? st.hasCloze() : st.hasCloze) {
          const cloze = st.getCProg() || {};
          await CloudStore.pushProgress(cloze, st.deckSlug, 'cloze');
        }
        console.info('[Sync] push done for deck', st.deckSlug);
      } catch (e) {
        console.warn('[Sync] push failed:', e && e.message);
      }
    }
  };

  if (typeof window !== 'undefined') window.Sync = Sync;
})();
