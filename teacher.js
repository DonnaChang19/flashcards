// ============================================================
// teacher.js：老师后台逻辑（登录 / 学生总览 / 高频错误 / Key 管理）
// 复用 cloudstore.js 的 Supabase 客户端；所有读取走 SECURITY DEFINER RPC。
// ============================================================
(function () {
  'use strict';

  // 各套卡片总数（用于完成率分母；与 cards 表实际条数一致）
  const DECK_TOTALS = { vwords: 197, a2words: 282, edaswords: 174, eda2words: 332, apmicrowords: 251, macrowords: 193 };
  const TOTAL_ALL = Object.values(DECK_TOTALS).reduce((a, b) => a + b, 0);
  const DECK_TITLES = { vwords: 'CIE-AS', a2words: 'CIE-A2', edaswords: 'EDX-AS', eda2words: 'EDX-A2', apmicrowords: 'AP微观', macrowords: 'AP宏观' };

  let rpcFn = null; // 测试桩
  let ALL_STUDENTS = []; // 缓存学生列表，供高频错误按学生筛选

  function rpc(name, params) {
    if (rpcFn) return rpcFn(name, params);
    if (!window.CloudStore || !CloudStore.sb) {
      return Promise.reject(new Error('Supabase 未连接'));
    }
    return CloudStore.sb.rpc(name, params);
  }

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function fmtTime(t) { if (!t) return '—'; try { return new Date(t).toLocaleString('zh-CN'); } catch (e) { return String(t); } }
  function showErr(elId, msg) { const el = $(elId); el.textContent = msg; el.classList.remove('hidden'); }
  function clearErr(elId) { const el = $(elId); if (el) { el.classList.add('hidden'); el.textContent = ''; } }

  async function doLogin() {
    clearErr('teacherErr');
    const key = $('teacherKey').value.trim();
    if (!key) { showErr('teacherErr', '请输入老师 Key'); return; }
    try {
      const { data, error } = await rpc('teacher_login', { p_key: key });
      if (error) { showErr('teacherErr', error.message || '登录失败'); return; }
      if (!data || !data.ok) { showErr('teacherErr', (data && data.message) || '老师 Key 不正确'); return; }
      $('loginGate').classList.add('hidden');
      $('dash').classList.remove('hidden');
      $('whoBar').classList.remove('hidden');
      $('whoBar').textContent = '👩‍🏫 ' + (data.teacher.name || '老师') + ' · ' + key;
      initDeckSelect();
      await loadStudents();
    } catch (e) {
      showErr('teacherErr', '连接失败：' + e.message);
    }
  }

  async function loadStudents() {
    clearErr('studentErr');
    try {
      const { data, error } = await rpc('admin_list_students');
      if (error) { showErr('studentErr', error.message); return; }
      const rows = (data || []);
      const body = $('studentBody');
      body.innerHTML = '';
      rows.forEach(r => {
        const studied = Number(r.studied) || 0;
        const pct = Math.round(studied / TOTAL_ALL * 100);
        const tr = document.createElement('tr');
        tr.innerHTML =
          `<td><code>${esc(r.key)}</code></td>` +
          `<td>${esc(r.student_name || '—')}</td>` +
          `<td>${studied}</td>` +
          `<td><span class="bar"><i style="width:${pct}%"></i></span> ${pct}%</td>` +
          `<td>${Number(r.mastered) || 0}</td>` +
          `<td>${Number(r.weak) || 0}</td>` +
          `<td class="muted">${fmtTime(r.last_login)}</td>`;
        body.appendChild(tr);
      });
      $('studentCount').textContent = '共 ' + rows.length + ' 名学生';
      ALL_STUDENTS = rows;
      populateWeakFilter();
    } catch (e) { showErr('studentErr', '加载失败：' + e.message); }
  }

  // 用学生列表填充“高频错误”里的按学生筛选下拉
  function populateWeakFilter() {
    const sel = $('weakStudent');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '';
    const all = document.createElement('option');
    all.value = ''; all.textContent = '全部学生';
    sel.appendChild(all);
    ALL_STUDENTS.forEach(r => {
      const o = document.createElement('option');
      o.value = r.key;
      o.textContent = (r.student_name ? r.student_name + ' · ' : '') + r.key;
      sel.appendChild(o);
    });
    sel.value = cur;
  }

  function initDeckSelect() {
    const sel = $('weakDeck');
    if (sel.options.length) return;
    Object.keys(DECK_TITLES).forEach(slug => {
      const o = document.createElement('option');
      o.value = slug; o.textContent = DECK_TITLES[slug];
      sel.appendChild(o);
    });
  }

  async function loadWeak() {
    clearErr('weakErr');
    const deck = $('weakDeck').value;
    const stu = $('weakStudent') ? $('weakStudent').value : '';
    try {
      const { data, error } = await rpc('admin_top_weak_terms', { p_deck: deck, p_limit: 15, p_student_key: stu || null });
      if (error) { showErr('weakErr', error.message); return; }
      const rows = (data || []);
      const body = $('weakBody');
      body.innerHTML = '';
      if (!rows.length) { body.innerHTML = '<tr><td colspan="4" class="muted">暂无错误记录</td></tr>'; return; }
      rows.forEach(r => {
        const list = Array.isArray(r.students) ? r.students : [];
        const valid = list.filter(s => s && (s.key || s.name));
        const students = valid.map(s =>
          `<span class="stu">${esc(s.key || '')}${s.name ? '·' + esc(s.name) : ''} <em>×${Number(s.cnt) || 0}</em></span>`
        ).join('');
        const debug = valid.length ? '' : ' <span class="muted" title="students 字段未返回有效数据">(数据异常)</span>';
        const tr = document.createElement('tr');
        tr.innerHTML =
          `<td>${esc(r.term)}</td>` +
          `<td>${Number(r.wrongs) || 0}</td>` +
          `<td>${Number(r.student_count) || 0}</td>` +
          `<td class="stus">${students || '—'}${debug}</td>`;
        body.appendChild(tr);
      });
    } catch (e) { showErr('weakErr', '加载失败：' + e.message); }
  }

  async function genKeys() {
    const n = Math.max(1, Math.min(200, parseInt($('genCount').value, 10) || 10));
    const msg = $('keyMsg');
    msg.className = 'msg'; msg.textContent = '生成中…';
    try {
      const { data, error } = await rpc('admin_generate_keys', { p_count: n, p_note: null });
      if (error) { msg.className = 'msg err'; msg.textContent = error.message; return; }
      const keys = (data && data.keys) || [];
      const list = $('keyList');
      list.innerHTML = '';
      keys.forEach(k => {
        const chip = document.createElement('div');
        chip.className = 'keychip';
        chip.innerHTML = `<span>${esc(k)}</span><button data-k="${esc(k)}">复制</button>`;
        list.appendChild(chip);
      });
      msg.className = 'msg ok';
      msg.textContent = '已生成 ' + keys.length + ' 个 Key（点击复制分发）。';
      bindCopy();
    } catch (e) { msg.className = 'msg err'; msg.textContent = '生成失败：' + e.message; }
  }

  function bindCopy() {
    document.querySelectorAll('#keyList button').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.getAttribute('data-k');
        if (navigator.clipboard) navigator.clipboard.writeText(k);
        b.textContent = '已复制';
        setTimeout(() => { b.textContent = '复制'; }, 1200);
      });
    });
  }

  async function resetKey() {
    const k = $('resetKey').value.trim();
    const msg = $('keyMsg');
    if (!k) { msg.className = 'msg err'; msg.textContent = '请输入要解绑的 Key'; return; }
    try {
      const { data, error } = await rpc('admin_reset_key', { p_key: k });
      if (error) { msg.className = 'msg err'; msg.textContent = error.message; return; }
      msg.className = (data && data.ok) ? 'msg ok' : 'msg err';
      msg.textContent = (data && data.message) || '完成';
    } catch (e) { msg.className = 'msg err'; msg.textContent = '操作失败：' + e.message; }
  }

  function switchTab(name) {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    ['students', 'weak', 'keys'].forEach(t => $('tab-' + t).classList.toggle('hidden', t !== name));
  }

  function bind() {
    // 初始化 Supabase 客户端（teacher 不需要 deck）
    if (window.CloudStore && CloudStore.init) { try { CloudStore.init(null); } catch (e) {} }

    $('teacherLoginBtn').addEventListener('click', doLogin);
    $('teacherKey').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    $('refreshStudents').addEventListener('click', loadStudents);
    $('weakBtn').addEventListener('click', loadWeak);
    $('genBtn').addEventListener('click', genKeys);
    $('resetBtn').addEventListener('click', resetKey);
  }

  window.Teacher = { doLogin, loadStudents, loadWeak, genKeys, resetKey, switchTab, rpc, _setRpc(fn) { rpcFn = fn; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
