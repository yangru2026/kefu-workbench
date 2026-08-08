// ==================== SUPABASE REALTIME FEATURES ====================
// 公告栏 / 登录注册 / 日报 / 售前数据 / 客服排名(实时)

// Called when supabase is initialized
window.onSupabaseReady = function() {
  loadTemplates(); // 预加载模板数据
  if (currentPage === 'home') { loadAnnouncements(); subscribeAnnouncements(); }
  if (currentPage === 'daily') { loadDailyReports(); subscribeDaily(); }
  if (currentPage === 'presale') { loadPresaleData(); subscribePresale(); }
  if (currentPage === 'members') { loadMembers(); subscribeProfiles(); }
  if (currentPage === 'staff-info') { loadStaffInfo(); subscribeStaffInfo(); }
  if (currentPage === 'templates') { loadTemplates().then(() => renderTemplates()); subscribeTemplates(); }
  if (currentPage === 'training') { if (window.loadTrainingCategories) loadTrainingCategories(); if (window.loadTrainingFromDB) loadTrainingFromDB(); if (window.renderTraining) renderTraining(); }
  if (currentPage === 'patterns') {
    // 修复: switchPage 内部已处理首次加载和数据存在时的渲染，这里只兜底，不要重复调 loadPatternsFromDB
    if (window.getPatternBrands && window.getPatternBrands().length === 0) {
      if (window.loadPatternCategories) window.loadPatternCategories();
      if (window.loadPatternsFromDB) window.loadPatternsFromDB();
    }
  }
};

// ---------- 公告栏 ----------
let announcements = [];
let annSub = null;
let lastDailyContent = null;

async function loadAnnouncements() {
  if (!supabase) {
    document.getElementById('announcement-list').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);">Supabase 未初始化，请刷新页面</div>';
    return;
  }
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, profiles(name)')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      console.error('公告加载失败', error);
      document.getElementById('announcement-list').innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">加载失败：' + escapeHtml(error.message) + '<br><button class="btn-sm primary" style="margin-top:12px;" onclick="loadAnnouncements()">重试</button></div>';
      return;
    }
    announcements = data || [];
    renderAnnouncements();
  } catch (e) {
    console.error('公告加载异常', e);
    document.getElementById('announcement-list').innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">加载异常，请刷新页面重试</div>';
  }
}

function renderAnnouncements() {
  const el = document.getElementById('announcement-list');
  if (!el) return;
  if (announcements.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);">暂无公告</div>';
    return;
  }
  const isAdmin = currentProfile?.role === 'admin' || currentProfile?.role === 'leader';
  el.innerHTML = announcements.map(a => {
    const date = new Date(a.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const author = a.profiles?.name || '管理员';
    return `
      <div class="announcement-card${a.is_pinned ? ' pinned' : ''}">
        ${a.is_pinned ? '<span class="ann-pin">📌 置顶</span>' : ''}
        <h4>${escapeHtml(a.title)}</h4>
        <div class="ann-meta">${author} · ${date}</div>
        <div class="ann-content">${escapeHtml(a.content)}</div>
        ${isAdmin ? `<div class="ann-actions">
          <button class="btn-sm outline" onclick="deleteAnnouncement(${a.id})">🗑 删除</button>
        </div>` : ''}
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return String(text || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// 成员管理 - 点击编辑姓名
function editMemberName(spanEl, userId, currentName) {
  const oldHtml = spanEl.innerHTML;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.style.cssText = 'padding:4px 8px;border:1px solid var(--primary);border-radius:6px;font-size:13px;width:100px;background:var(--card-bg);color:var(--text);';
  spanEl.replaceWith(input);
  input.focus();
  input.select();

  const save = async () => {
    const newName = input.value.trim();
    if (newName && newName !== currentName) {
      await updateMemberName(userId, newName);
    } else {
      // Restore original display
      input.replaceWith(spanEl);
    }
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { input.value = currentName; input.blur(); }
  });
}

function editMemberRealName(spanEl, userId, currentName) {
  const oldHtml = spanEl.innerHTML;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.style.cssText = 'padding:4px 8px;border:1px solid var(--primary);border-radius:6px;font-size:13px;width:100px;background:var(--card-bg);color:var(--text);';
  spanEl.replaceWith(input);
  input.focus();
  input.select();

  const save = async () => {
    const newName = input.value.trim();
    if (newName && newName !== currentName) {
      await updateMemberRealName(userId, newName);
    } else {
      input.replaceWith(spanEl);
    }
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { input.value = currentName; input.blur(); }
  });
}

async function updateMemberRealName(userId, newName) {
  if (!supabase) return;
  const { error } = await supabase.from('profiles').update({ real_name: newName.trim() || null }).eq('id', userId);
  if (error) { showToast('更新失败：' + error.message); return; }
  showToast('真实姓名已更新');
  loadMembers();
}

async function openAnnounceForm() {
  if (!currentUser) { showToast('请先登录'); switchPage('login'); return; }
  const title = prompt('公告标题：');
  if (!title) return;
  const content = prompt('公告内容：');
  if (!content) return;
  const { error } = await supabase.from('announcements').insert({
    title, content, author_id: currentUser.id, is_pinned: false
  });
  if (error) { showToast('发布失败：' + error.message); }
  else { showToast('公告发布成功'); loadAnnouncements(); }
}

async function deleteAnnouncement(id) {
  if (!confirm('确定删除这条公告？')) return;
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) { showToast('删除失败：' + error.message); }
  else { showToast('已删除'); loadAnnouncements(); }
}

function subscribeAnnouncements() {
  if (!supabase || annSub) return;
  annSub = supabase.channel('announcements')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
      loadAnnouncements();
    })
    .subscribe();
}

// ---------- 登录注册 ----------
function switchLoginTab(tab) {
  document.querySelectorAll('.login-tab').forEach(t => {
    t.classList.toggle('active', t.textContent.includes(tab === 'login' ? '登录' : '注册'));
  });
  document.getElementById('login-form').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? '' : 'none';
}

async function doLogin() {
  if (!supabase) { showToast('系统初始化中，请稍后再试'); return; }
  const phone = document.getElementById('login-phone').value.trim();
  const password = document.getElementById('login-password').value;
  if (!phone || !password) { showToast('请填写手机号和密码'); return; }
  try {
    const ok = await signIn(phone, password);
    if (ok) switchPage('home');
  } catch(e) {
    showToast('登录失败：' + (e.message || '网络错误'));
    console.error(e);
  }
}

async function doRegister() {
  if (!supabase) { showToast('系统初始化中，请稍后再试'); return; }
  const name = document.getElementById('reg-name').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;
  if (!name || !phone || !password) { showToast('请填写完整信息'); return; }
  if (password !== password2) { showToast('两次密码不一致'); return; }
  if (password.length < 6) { showToast('密码至少6位'); return; }
  try {
    const ok = await signUp(name, phone, password);
    if (ok) switchLoginTab('login');
  } catch(e) {
    showToast('注册失败：' + (e.message || '网络错误'));
    console.error(e);
  }
}

// ---------- 日报 ----------
let dailyReports = [];
let dailySub = null;
// 各组预置店铺模板（每个店铺独立目标，admin可在模板管理中修改）
const DEFAULT_TEMPLATES = {
  'A组': { shops: ['TM-弥生','KS-弥生','TM-极氧','DY弥生官方','TM-护眼','XHS-弥生','DY-YOUHOO','DY-极氧','JD-弥生','XHS-极氧','有赞-拼多多'].map(n => ({ name: n, target: 15 })) },
  'B组': { shops: ['PDD-1店','PDD-2店','PDD-3店','PDD-4店','PDD-5店','PDD-6店','PDD-YOUHOO','XHS-弥生','XHS-YOUHOO'].map(n => ({ name: n, target: 15 })) },
  'C组': { shops: ['DY官方-一店','DY旗舰-二店','DY眼镜-三店','DY电子-四店'].map(n => ({ name: n, target: 15 })) }
};
// 默认目标转化率（新店铺默认值）
const DEFAULT_TARGET = 15;
let shopTemplates = null; // { 'A组': { shops: [...], target: 15 }, 'B组': {...}, 'C组': {...} }

// ---------- 模板 ----------
function getShopTemplate(group) {
  // 优先用 Supabase 模板 → 默认模板
  if (shopTemplates && shopTemplates[group]) return shopTemplates[group];
  if (DEFAULT_TEMPLATES[group]) return DEFAULT_TEMPLATES[group];
  return { shops: [], target: DEFAULT_TARGET };
}

async function loadTemplates() {
  if (!supabase) return;
  const { data, error } = await supabase.from('shop_templates').select('*');
  if (error) {
    console.error('模板加载失败', error);
    shopTemplates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    return;
  }
  const map = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
  (data || []).forEach(t => {
    // 兼容旧格式：shops 可能是字符串数组或对象数组
    const shops = (t.shops || []).map(s => {
      if (typeof s === 'string') return { name: s, target: t.default_target || DEFAULT_TARGET };
      return { name: s.name, target: s.target || t.default_target || DEFAULT_TARGET };
    });
    map[t.group_name] = { shops, id: t.id };
  });
  shopTemplates = map;
}

async function saveTemplate(groupName, shops) {
  if (!supabase) return false;
  const payload = { group_name: groupName, shops, updated_by: currentUser?.id };
  const { error } = await supabase.from('shop_templates').upsert(payload, { onConflict: 'group_name' });
  if (error) { showToast('保存失败：' + error.message); return false; }
  showToast(groupName + ' 模板已保存');
  return true;
}

let templatesSub = null;
function subscribeTemplates() {
  if (!supabase || templatesSub) return;
  templatesSub = supabase.channel('shop_templates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_templates' }, async () => {
      await loadTemplates();
      if (currentPage === 'templates') renderTemplates();
    })
    .subscribe();
}

function renderTemplates() {
  const el = document.getElementById('templates-content');
  const groups = ['A组', 'B组', 'C组'];

  function render() {
    el.innerHTML = groups.map(g => {
      const tpl = getShopTemplate(g);
      const shops = tpl.shops;
      return `<div style="margin-bottom:20px;border:1px solid var(--border);border-radius:12px;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#f8f9ff;border-bottom:1px solid var(--border);">
          <h3 style="margin:0;font-size:16px;">${g} · ${shops.length}个店铺</h3>
          <button class="btn-sm primary" onclick="saveTemplatesFromUI()">💾 保存全部</button>
        </div>
        <div style="padding:12px 16px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:#f0f4ff;">
              <th style="padding:8px;text-align:left;font-size:13px;">店铺名</th>
              <th style="padding:8px;text-align:center;font-size:13px;width:120px;">目标转化率</th>
              <th style="padding:8px;text-align:center;font-size:13px;width:60px;">操作</th>
            </tr></thead>
            <tbody id="tpl-tbody-${g}">
              ${shops.map((s, i) => `
                <tr>
                  <td style="padding:6px 8px;"><input type="text" class="tpl-shop-name" data-group="${g}" data-idx="${i}" value="${escapeHtml(s.name || '')}" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--card-bg);color:var(--text);"></td>
                  <td style="padding:6px 8px;text-align:center;"><input type="number" class="tpl-shop-target" data-group="${g}" data-idx="${i}" value="${s.target || DEFAULT_TARGET}" style="width:70px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;text-align:center;background:var(--card-bg);color:var(--text);" min="1" max="100"> %</td>
                  <td style="padding:6px 8px;text-align:center;"><button class="btn-sm outline" style="color:var(--danger);border-color:var(--danger);padding:2px 10px;font-size:12px;" onclick="deleteTplShop(this,'${g}',${i})">×</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
          <button class="btn-sm outline" style="margin-top:8px;font-size:13px;" onclick="addTplShop('${g}')">+ 添加店铺</button>
        </div>
      </div>`;
    }).join('');
  }

  render();

  // exposed global functions for template editing
  window.addTplShop = function(group) {
    const tbody = document.getElementById('tpl-tbody-' + group);
    const idx = tbody.querySelectorAll('tr').length;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="padding:6px 8px;"><input type="text" class="tpl-shop-name" data-group="${group}" data-idx="${idx}" value="" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--card-bg);color:var(--text);" placeholder="新店铺名"></td>
      <td style="padding:6px 8px;text-align:center;"><input type="number" class="tpl-shop-target" data-group="${group}" data-idx="${idx}" value="${DEFAULT_TARGET}" style="width:70px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;text-align:center;background:var(--card-bg);color:var(--text);" min="1" max="100"> %</td>
      <td style="padding:6px 8px;text-align:center;"><button class="btn-sm outline" style="color:var(--danger);border-color:var(--danger);padding:2px 10px;font-size:12px;" onclick="deleteTplShop(this,'${group}',${idx})">×</button></td>`;
    tbody.appendChild(tr);
  };

  window.deleteTplShop = function(btn, group, idx) {
    btn.closest('tr').remove();
  };

  window.saveTemplatesFromUI = async function() {
    for (const g of groups) {
      const nameInputs = document.querySelectorAll('.tpl-shop-name[data-group="' + g + '"]');
      const targetInputs = document.querySelectorAll('.tpl-shop-target[data-group="' + g + '"]');
      const shops = [];
      nameInputs.forEach((inp, i) => {
        const name = inp.value.trim();
        if (name) {
          const target = parseInt(targetInputs[i]?.value) || DEFAULT_TARGET;
          shops.push({ name, target });
        }
      });
      await saveTemplate(g, shops);
    }
    await loadTemplates();
    renderTemplates();
  };
}

async function loadDailyReports() {
  if (!supabase || !currentUser) return;
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('report_date', { ascending: false })
    .limit(30);
  if (!error) dailyReports = data || [];
  renderDailyList();
}

function renderDailyList() {
  // 日报页面已精简：普通客服只看到填写/提交入口 + 结果卡片
  // 不展示历史列表、存档、统计等
}

function renderDailyReportCard(r) {
  const c = r.content || {};
  const shops = c.shops || [];
  const totalVisitors = shops.reduce((s, shop) => s + (parseInt(shop.visitors) || 0), 0);
  const totalInquiries = shops.reduce((s, shop) => s + (parseInt(shop.inquiries) || 0), 0);
  const totalPayments = shops.reduce((s, shop) => s + (parseInt(shop.payments) || 0), 0);
  const avgConversion = totalInquiries > 0 ? (totalPayments / totalInquiries * 100).toFixed(2) : '0.00';

  const shopRows = shops.map(s => {
    const conv = s.inquiries > 0 ? (s.payments / s.inquiries * 100).toFixed(2) : '0.00';
    const need = s.target ? Math.max(0, Math.ceil(s.inquiries * s.target / 100 - s.payments)) : '-';
    return `<tr><td>${escapeHtml(s.name)}</td><td>${s.visitors || 0}</td><td>${s.inquiries || 0}</td><td>${s.payments || 0}</td><td>${conv}%</td><td>${s.target || '-'}%</td><td>${need}</td></tr>`;
  }).join('');

  return `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <h4 style="margin:0;">📅 ${r.report_date} <span style="font-size:12px;color:var(--text-secondary);font-weight:normal;">${r.status === 'submitted' ? '✅ 已提交' : '📝 草稿'}</span></h4>
        <div style="font-size:13px;color:var(--primary);">总接待：<strong>${totalVisitors}</strong> · 转化率：<strong>${avgConversion}%</strong></div>
      </div>
      <div style="overflow-x:auto;">
        <table class="ranking-table" style="min-width:600px;font-size:13px;">
          <thead><tr><th>店铺</th><th>接待量</th><th>询单</th><th>支付</th><th>转化率</th><th>目标</th><th>还需</th></tr></thead>
          <tbody>${shopRows}</tbody>
        </table>
      </div>
      ${c.analysis ? `<div style="margin-top:10px;font-size:13px;color:var(--text-secondary);padding:8px;background:#fff7ed;border-radius:8px;"><strong>未成交分析：</strong>${escapeHtml(c.analysis)}</div>` : ''}
      ${c.followUp ? `<div style="margin-top:6px;font-size:13px;color:var(--text-secondary);padding:8px;background:#f0fdf4;border-radius:8px;"><strong>催付：</strong>${escapeHtml(c.followUp)}</div>` : ''}
      ${c.feedback ? `<div style="margin-top:6px;font-size:13px;color:var(--text-secondary);padding:8px;background:#eff6ff;border-radius:8px;"><strong>反馈：</strong>${escapeHtml(c.feedback)}</div>` : ''}
    </div>
  `;
}

async function openDailyForm() {
  if (!currentUser) { showToast('请先登录'); switchPage('login'); return; }
  document.getElementById('daily-form-area').style.display = '';
  document.getElementById('daily-track-area').style.display = 'none';
  document.getElementById('daily-result-area').style.display = 'none';
  document.getElementById('daily-date-label').textContent = new Date().toLocaleDateString('zh-CN');

  const today = new Date().toISOString().slice(0, 10);
  const existing = dailyReports.find(r => r.report_date === today);
  const savedShops = existing?.content?.shops;
  document.getElementById('daily-analysis').value = existing?.content?.analysis || '';
  document.getElementById('daily-followup').value = existing?.content?.followUp || '';
  document.getElementById('daily-feedback').value = existing?.content?.feedback || '';

  // 实时拉取最新模板（管理员可能已修改目标）
  await loadTemplates();
  const group = currentProfile?.group_name;
  const tpl = getShopTemplate(group);
  // 构建店铺名→目标的映射
  const tplTargetMap = {};
  (tpl.shops || []).forEach(s => { if (s.name) tplTargetMap[s.name] = s.target; });

  // 用历史记录 → 或用该组的模板 → 或空白行
  let shops;
  if (savedShops && savedShops.length) {
    // 已有草稿：保留已填数据，但用最新模板更新目标
    shops = savedShops.map(s => {
      const shopName = s.name || s;
      return {
        name: shopName,
        visitors: s.visitors || '',
        inquiries: s.inquiries || '',
        payments: s.payments || '',
        target: tplTargetMap[shopName] || s.target || DEFAULT_TARGET
      };
    });
  } else {
    shops = tpl.shops.map(s => ({
      name: s.name || s,
      visitors: '', inquiries: '', payments: '',
      target: s.target || DEFAULT_TARGET
    }));
  }

  renderDailyShopInputs(shops);
  updateDailyTotal();
}

function renderDailyShopInputs(shops) {
  const tbody = document.getElementById('daily-shop-tbody');
  tbody.innerHTML = shops.map((s, i) => `
    <tr data-idx="${i}">
      <td style="position:relative;">
        <input type="text" class="daily-shop-name" value="${escapeHtml(s.name)}" style="width:110px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-weight:600;text-align:center;background:var(--card-bg);color:var(--text);" placeholder="店铺名">
      </td>
      <td><input type="number" class="daily-shop-visitors" value="${s.visitors || ''}" style="width:75px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;text-align:center;" placeholder="0" oninput="updateDailyTotal()"></td>
      <td><input type="number" class="daily-shop-inquiries" value="${s.inquiries || ''}" style="width:75px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;text-align:center;" placeholder="0" oninput="calculateDailyRow(this)"></td>
      <td><input type="number" class="daily-shop-payments" value="${s.payments || ''}" style="width:75px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;text-align:center;" placeholder="0" oninput="calculateDailyRow(this)"></td>
      <td class="daily-shop-conversion" style="text-align:center;font-weight:600;color:var(--primary);font-size:13px;">-</td>
      <td><input type="number" class="daily-shop-target" value="${s.target || ''}" style="width:65px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;text-align:center;" placeholder="%" oninput="calculateDailyRow(this)"></td>
      <td class="daily-shop-need" style="text-align:center;font-weight:600;font-size:13px;">-</td>
      <td style="padding:4px;"><button type="button" class="btn-sm outline" style="padding:2px 8px;font-size:12px;color:var(--danger);border-color:var(--danger);" onclick="removeDailyShopRow(this)" title="删除此行">×</button></td>
    </tr>
  `).join('');
  // Add "add row" row at bottom
  const addRow = document.createElement('tr');
  addRow.innerHTML = `
    <td colspan="8" style="text-align:center;padding:8px;">
      <button type="button" class="btn-sm outline" style="font-size:13px;" onclick="addDailyShopRow()">+ 添加店铺</button>
      <span style="font-size:12px;color:var(--text-secondary);margin-left:12px;">可手动输入店铺名，没有数据的店铺留空即可</span>
    </td>
  `;
  tbody.appendChild(addRow);
  // Calculate all rows
  setTimeout(() => {
    tbody.querySelectorAll('tr[data-idx]').forEach(row => calculateDailyRow(row.querySelector('.daily-shop-inquiries')));
  }, 0);
}

function addDailyShopRow() {
  const tbody = document.getElementById('daily-shop-tbody');
  const addRow = tbody.lastElementChild;
  const newRow = document.createElement('tr');
  const idx = tbody.querySelectorAll('tr[data-idx]').length;
  newRow.setAttribute('data-idx', idx);
  newRow.innerHTML = `
    <td style="position:relative;">
      <input type="text" class="daily-shop-name" value="" style="width:110px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--card-bg);color:var(--text);" placeholder="店铺名">
    </td>
    <td><input type="number" class="daily-shop-visitors" value="" style="width:75px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;" placeholder="0" oninput="updateDailyTotal()"></td>
    <td><input type="number" class="daily-shop-inquiries" value="" style="width:75px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;" placeholder="0" oninput="calculateDailyRow(this)"></td>
    <td><input type="number" class="daily-shop-payments" value="" style="width:75px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;" placeholder="0" oninput="calculateDailyRow(this)"></td>
    <td class="daily-shop-conversion" style="text-align:center;font-weight:600;color:var(--primary);font-size:13px;">-</td>
    <td><input type="number" class="daily-shop-target" value="" style="width:65px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;" placeholder="%" oninput="calculateDailyRow(this)"></td>
    <td class="daily-shop-need" style="text-align:center;font-weight:600;font-size:13px;">-</td>
    <td style="padding:4px;"><button type="button" class="btn-sm outline" style="padding:2px 8px;font-size:12px;color:var(--danger);border-color:var(--danger);" onclick="removeDailyShopRow(this)" title="删除此行">×</button></td>
  `;
  tbody.insertBefore(newRow, addRow);
}

function removeDailyShopRow(btn) {
  const row = btn.closest('tr');
  if (row) {
    row.remove();
    updateDailyTotal();
  }
}

function calculateDailyRow(el) {
  if (!el) return;
  const row = el.closest('tr');
  if (!row) return;
  const inquiries = parseFloat(row.querySelector('.daily-shop-inquiries')?.value) || 0;
  const payments = parseFloat(row.querySelector('.daily-shop-payments')?.value) || 0;
  const target = parseFloat(row.querySelector('.daily-shop-target')?.value) || 0;
  const convEl = row.querySelector('.daily-shop-conversion');
  const needEl = row.querySelector('.daily-shop-need');
  if (convEl) convEl.textContent = inquiries > 0 ? (payments / inquiries * 100).toFixed(2) + '%' : '-';
  if (needEl) {
    if (target > 0 && inquiries > 0) {
      const need = Math.ceil(inquiries * target / 100 - payments);
      needEl.textContent = need > 0 ? need : '0';
      needEl.style.color = need > 0 ? 'var(--danger)' : 'var(--success)';
    } else {
      needEl.textContent = '-';
      needEl.style.color = '';
    }
  }
}

function updateDailyTotal() {
  const tbody = document.getElementById('daily-shop-tbody');
  if (!tbody) return;
  let total = 0;
  tbody.querySelectorAll('.daily-shop-visitors').forEach(inp => { total += parseInt(inp.value) || 0; });
  const el = document.getElementById('daily-total-visitors');
  if (el) el.textContent = total;
}

function closeDailyForm() {
  document.getElementById('daily-form-area').style.display = 'none';
  document.getElementById('daily-result-area').style.display = 'none';
}

function getShopDelayDays(shopName) {
  const name = (shopName || '').toLowerCase();
  if (name.includes('dy') || name.includes('抖音')) return 1;
  if (name.includes('tm') || name.includes('天猫') || name.includes('pdd') || name.includes('拼多多') || name.includes('ks') || name.includes('快手')) return 3;
  return 3; // 默认3天
}

function renderDailyResult(content) {
  lastDailyContent = content;
  const shops = content.shops || [];
  const totalV = shops.reduce((s, r) => s + (parseInt(r.visitors) || 0), 0);
  const totalI = shops.reduce((s, r) => s + (parseInt(r.inquiries) || 0), 0);
  const totalP = shops.reduce((s, r) => s + (parseInt(r.payments) || 0), 0);

  const shopRows = shops.map(s => {
    const inquiries = parseInt(s.inquiries) || 0;
    const payments = parseInt(s.payments) || 0;
    const visitors = parseInt(s.visitors) || 0;
    const target = parseFloat(s.target) || 0;
    const conv = inquiries > 0 ? (payments / inquiries * 100).toFixed(1) : '--';
    const convNum = inquiries > 0 ? (payments / inquiries * 100) : 0;
    const need = target > 0 && inquiries > 0 ? Math.ceil(inquiries * target / 100 - payments) : null;
    const hit = target > 0 ? convNum >= target : true;

    return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f0eeeb;font-size:13px;text-align:left;font-weight:500;">${escapeHtml(s.name)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0eeeb;font-size:13px;text-align:center;">${visitors || '-'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0eeeb;font-size:13px;text-align:center;">${inquiries || '-'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0eeeb;font-size:13px;text-align:center;">${payments || '-'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0eeeb;font-size:13px;text-align:center;font-weight:700;${hit ? 'color:#16a34a' : 'color:#ef4444'}">${conv}%${target>0 ? ' <span style="font-size:11px;font-weight:400;color:#999;">/ '+target+'%</span>' : ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0eeeb;font-size:13px;text-align:center;font-weight:700;${need !== null && need > 0 ? 'color:#ef4444' : 'color:#16a34a'}">${need !== null ? (need > 0 ? '差'+need : '✓') : '-'}</td>
      </tr>`;
  }).join('');

  const today = new Date();
  const weekDay = ['周日','周一','周二','周三','周四','周五','周六'][today.getDay()];
  const dateStr = today.getFullYear() + '.' + (today.getMonth()+1) + '.' + today.getDate();

  // 计算涉及的数据延迟类型
  const delaySet = new Set();
  shops.forEach(s => { delaySet.add(getShopDelayDays(s.name)); });
  const delays = Array.from(delaySet).sort((a,b) => a-b);
  const delayLabels = delays.map(d => {
    const shopNames = shops.filter(s => getShopDelayDays(s.name) === d).map(s => s.name);
    // 提取平台简称
    const platforms = [];
    if (shopNames.some(n => /tm|天猫/i.test(n))) platforms.push('天猫');
    if (shopNames.some(n => /pdd|拼多多/i.test(n))) platforms.push('拼多多');
    if (shopNames.some(n => /ks|快手/i.test(n))) platforms.push('快手');
    if (shopNames.some(n => /dy|抖音/i.test(n))) platforms.push('抖音');
    const prefix = platforms.length > 0 ? platforms.join('/') + ' ' : '';
    return `<span style="padding:2px 8px;border-radius:10px;background:#fef3c7;color:#d97706;">⏳ ${prefix}数据 = ${d}天前</span>`;
  }).join('');

  const resultDiv = document.getElementById('daily-result-area');
  resultDiv.innerHTML = `
    <div style="max-width:680px;margin:0 auto;background:#f4f2ef;border-radius:16px;padding:20px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2d2d2d;line-height:1.5;">
      <div class="daily-screenshot-card" style="background:#fff;border-radius:12px;padding:20px 18px;border:1px solid #e2e0dc;">
        <!-- 头部 -->
        <div style="margin-bottom:16px;border-bottom:1px solid #f0eeeb;padding-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div style="font-size:13px;color:#7a7a7a;font-weight:500;">${dateStr} ${weekDay}</div>
            <span style="font-size:11px;background:#7c6fae;color:#fff;padding:3px 12px;border-radius:10px;font-weight:600;letter-spacing:1px;">售前</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end;">
            <div style="font-size:16px;font-weight:700;color:#2d2d2d;">${escapeHtml(currentProfile?.name || '')} · ${escapeHtml(currentProfile?.group_name || '')}</div>
            <div style="text-align:right;">
              <div style="font-size:11px;color:#8a8a8a;margin-bottom:3px;">总接待量</div>
              <div style="font-size:30px;font-weight:800;color:#3a5a8a;line-height:1;">${totalV}</div>
            </div>
          </div>
        </div>
        <!-- 数据新鲜度标签 -->
        <div style="display:flex;justify-content:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;font-size:12px;">
          <span style="padding:3px 10px;border-radius:10px;background:#dcfce7;color:#16a34a;">接待量 = 当日数据</span>
          ${delayLabels}
        </div>
        <!-- 表格 -->
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;min-width:500px;">
            <thead>
              <tr style="background:#f5f6f8;">
                <th style="padding:9px 8px;font-size:12px;text-align:left;border-bottom:1.5px solid #ddd;color:#555;font-weight:600;">店铺</th>
                <th style="padding:9px 8px;font-size:12px;text-align:center;border-bottom:1.5px solid #ddd;color:#555;font-weight:600;">接待</th>
                <th style="padding:9px 8px;font-size:12px;text-align:center;border-bottom:1.5px solid #ddd;color:#555;font-weight:600;">询单</th>
                <th style="padding:9px 8px;font-size:12px;text-align:center;border-bottom:1.5px solid #ddd;color:#555;font-weight:600;">支付</th>
                <th style="padding:9px 8px;font-size:12px;text-align:center;border-bottom:1.5px solid #ddd;color:#555;font-weight:600;">达成 / 目标</th>
                <th style="padding:9px 8px;font-size:12px;text-align:center;border-bottom:1.5px solid #ddd;color:#555;font-weight:600;">还差</th>
              </tr>
            </thead>
            <tbody>${shopRows}</tbody>
          </table>
        </div>
        <!-- 汇总 -->
        <div style="display:flex;justify-content:space-around;margin-top:14px;padding:12px 0;border-top:1px solid #eee;border-bottom:1px solid #eee;text-align:center;background:#fafaf9;border-radius:8px;">
          <div><div style="font-size:11px;color:#8a8a8a;margin-bottom:2px;">总询单</div><div style="font-size:20px;font-weight:700;color:#2d2d2d;">${totalI}</div></div>
          <div><div style="font-size:11px;color:#8a8a8a;margin-bottom:2px;">总支付</div><div style="font-size:20px;font-weight:700;color:#2d2d2d;">${totalP}</div></div>
          <div><div style="font-size:11px;color:#8a8a8a;margin-bottom:2px;">总转化率</div><div style="font-size:20px;font-weight:700;color:#3a5a8a;">${totalI>0 ? (totalP/totalI*100).toFixed(1) : '--'}%</div></div>
          <div><div style="font-size:11px;color:#8a8a8a;margin-bottom:2px;">总还差</div><div style="font-size:20px;font-weight:700;color:${shops.some(s => {const i=parseInt(s.inquiries)||0;const p=parseInt(s.payments)||0;const t=parseFloat(s.target)||0;return t>0&&i>0&&Math.ceil(i*t/100-p)>0;})?'#ef4444':'#16a34a'}">${shops.reduce((sum,s)=>{
          const i=parseInt(s.inquiries)||0,p=parseInt(s.payments)||0,t=parseFloat(s.target)||0;
          return t>0&&i>0 ? sum+Math.max(0,Math.ceil(i*t/100-p)) : sum;
        },0)||'--'}</div></div>
        </div>
        ${content.analysis ? `<div style="margin-top:14px;font-size:12px;color:#5a5a5a;background:#fcf7ef;padding:10px 12px;border-radius:8px;border-left:3px solid #c9a66b;"><strong style="color:#8a6d3b;">未成交分析：</strong>${escapeHtml(content.analysis)}</div>` : ''}
        ${content.followUp ? `<div style="margin-top:8px;font-size:12px;color:#5a5a5a;background:#f1f7f1;padding:10px 12px;border-radius:8px;border-left:3px solid #7ab87a;"><strong style="color:#4a7c4e;">催付：</strong>${escapeHtml(content.followUp)}</div>` : ''}
        ${content.feedback ? `<div style="margin-top:8px;font-size:12px;color:#5a5a5a;background:#eef2f7;padding:10px 12px;border-radius:8px;border-left:3px solid #7a9dc9;"><strong style="color:#3a5a8a;">反馈：</strong>${escapeHtml(content.feedback)}</div>` : ''}
        <div style="margin-top:18px;display:flex;gap:10px;justify-content:center;">
          <button onclick="closeDailyForm()" style="padding:8px 22px;border-radius:8px;border:1px solid #d5d3d0;background:#f9f8f7;color:#666;font-size:14px;cursor:pointer;">返回</button>
          <button onclick="copyDailyResult()" style="padding:8px 22px;border-radius:8px;border:none;background:#5a6d8a;color:#fff;font-size:14px;cursor:pointer;">📷 复制截图</button>
        </div>
      </div>
    </div>
  `;
}

async function submitDaily() {
  if (!currentUser) return;
  const today = new Date().toISOString().slice(0, 10);
  const tbody = document.getElementById('daily-shop-tbody');
  const shops = [];
  tbody.querySelectorAll('tr[data-idx]').forEach(row => {
    const name = row.querySelector('.daily-shop-name')?.value.trim();
    if (!name) return;
    shops.push({
      name,
      visitors: parseInt(row.querySelector('.daily-shop-visitors')?.value) || 0,
      inquiries: parseInt(row.querySelector('.daily-shop-inquiries')?.value) || 0,
      payments: parseInt(row.querySelector('.daily-shop-payments')?.value) || 0,
      target: parseFloat(row.querySelector('.daily-shop-target')?.value) || 0
    });
  });
  const content = {
    shops,
    analysis: document.getElementById('daily-analysis').value.trim(),
    followUp: document.getElementById('daily-followup').value.trim(),
    feedback: document.getElementById('daily-feedback').value.trim()
  };
  const { error } = await supabase.from('daily_reports').upsert({
    user_id: currentUser.id,
    report_date: today,
    content: content,
    status: 'submitted'
  }, { onConflict: 'user_id,report_date' });
  if (error) { showToast('提交失败：' + error.message); }
  else {
    showToast('日报提交成功');
    // 展示结果卡片（截图发群）
    renderDailyResult(content);
    document.getElementById('daily-form-area').style.display = 'none';
    document.getElementById('daily-result-area').style.display = '';
    loadDailyReports();
  }
}

function copyDailyResult() {
  // 显示 loading 遮罩
  let loader = document.getElementById('daily-screenshot-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'daily-screenshot-loader';
    loader.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.35);z-index:9999;display:flex;align-items:center;justify-content:center;';
    loader.innerHTML = '<div style="background:#fff;border-radius:14px;padding:28px 36px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);"><div style="width:40px;height:40px;border:3px solid #e2e0dc;border-top-color:#7B9B6A;border-radius:50%;margin:0 auto 14px;animation:dailySpin 0.8s linear infinite;"></div><div style="font-size:15px;font-weight:600;color:#2C3328;">正在生成截图...</div><div style="font-size:12px;color:#8B8E87;margin-top:4px;">请稍等几秒</div></div>';
    document.body.appendChild(loader);
    if (!document.getElementById('daily-spin-style')) {
      const style = document.createElement('style');
      style.id = 'daily-spin-style';
      style.textContent = '@keyframes dailySpin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }
  }
  loader.style.display = 'flex';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        const canvas = renderDailyReportCanvas(lastDailyContent || {});
        canvas.toBlob(async (blob) => {
          loader.style.display = 'none';
          if (!blob) {
            showToast('生成图片失败');
            return;
          }
          try {
            if (navigator.clipboard && navigator.clipboard.write) {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
              showToast('✅ 截图已复制到剪贴板');
            } else {
              downloadDailyScreenshot(blob);
            }
          } catch (err) {
            downloadDailyScreenshot(blob);
          }
        }, 'image/png');
      } catch (err) {
        console.error('截图绘制失败', err);
        loader.style.display = 'none';
        showToast('截图生成失败，请手动截图');
      }
    });
  });
}

function downloadDailyScreenshot(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `日报-${new Date().toISOString().slice(0,10)}.png`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('截图已下载（请手动复制）');
}

// ---------- Canvas 原生绘制日报截图（绕过 html2canvas 卡顿）----------
function renderDailyReportCanvas(content) {
  const shops = (content && content.shops) || [];
  const totalV = shops.reduce((s, r) => s + (parseInt(r.visitors) || 0), 0);
  const totalI = shops.reduce((s, r) => s + (parseInt(r.inquiries) || 0), 0);
  const totalP = shops.reduce((s, r) => s + (parseInt(r.payments) || 0), 0);

  const today = new Date();
  const weekDay = ['周日','周一','周二','周三','周四','周五','周六'][today.getDay()];
  const dateStr = today.getFullYear() + '.' + (today.getMonth()+1) + '.' + today.getDate();

  const W = 720;                 // 逻辑宽度
  const PAGE_X = 24;             // 卡片左边距
  const PAGE_Y = 24;             // 卡片上边距
  const CARD_W = W - PAGE_X * 2; // 卡片宽度
  const INNER_X = PAGE_X + 18;    // 内容左边距
  const INNER_W = CARD_W - 36;   // 内容可用宽度

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // 辅助：绘制圆角矩形路径
  function roundedRect(x, y, w, h, r) {
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }

  // 辅助：测量文字
  function measure(text, font) {
    ctx.font = font;
    return ctx.measureText(text).width;
  }

  // 辅助：自动换行
  function wrapText(text, maxWidth) {
    const chars = String(text || '').split('');
    const lines = [];
    let line = '';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
    for (const ch of chars) {
      const test = line + ch;
      if (measure(test, ctx.font) > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // 辅助：徽章尺寸（不绘制）
  function measureBadge(text) {
    const padX = 10;
    const font = 'bold 12px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
    return { w: measure(text, font) + padX * 2, h: 24 };
  }

  // 辅助：绘制徽章标签
  function drawBadge(item, x, y) {
    const padX = 10;
    const h = 24;
    const font = 'bold 12px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
    const tw = measure(item.text, font) + padX * 2;
    roundedRect(x, y, tw, h, 10);
    ctx.fillStyle = item.bg;
    ctx.fill();
    ctx.fillStyle = item.color;
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(item.text, x + padX, y + h/2 + 1);
    return { w: tw, h };
  }

  // 辅助：绘制多行徽章（自动换行）
  function drawBadges(items, x, y, maxWidth) {
    let cx = x;
    let cy = y;
    let rowH = 0;
    for (const item of items) {
      const size = measureBadge(item.text);
      if (cx + size.w > x + maxWidth && cx > x) {
        cx = x;
        cy += rowH + 8;
        rowH = 0;
      }
      drawBadge(item, cx, cy);
      cx += size.w + 8;
      rowH = Math.max(rowH, size.h);
    }
    return cy - y + rowH;
  }

  // 辅助：截断文本
  function truncate(text, maxWidth, font) {
    let t = String(text || '');
    if (measure(t, font) <= maxWidth) return t;
    while (t.length > 0 && measure(t + '...', font) > maxWidth) t = t.slice(0, -1);
    return t + '...';
  }

  // 计算延迟标签
  const labels = [{ text: '接待量 = 当日数据', bg: '#dcfce7', color: '#16a34a' }];
  const delaySet = new Set();
  shops.forEach(s => { delaySet.add(getShopDelayDays(s.name)); });
  const delays = Array.from(delaySet).sort((a,b) => a-b);
  for (const d of delays) {
    const shopNames = shops.filter(s => getShopDelayDays(s.name) === d).map(s => s.name);
    const platforms = [];
    if (shopNames.some(n => /tm|天猫/i.test(n))) platforms.push('天猫');
    if (shopNames.some(n => /pdd|拼多多/i.test(n))) platforms.push('拼多多');
    if (shopNames.some(n => /ks|快手/i.test(n))) platforms.push('快手');
    if (shopNames.some(n => /dy|抖音/i.test(n))) platforms.push('抖音');
    const prefix = platforms.length > 0 ? platforms.join('/') + ' ' : '';
    labels.push({ text: `⏳ ${prefix}数据 = ${d}天前`, bg: '#fef3c7', color: '#d97706' });
  }

  // 预计算各区域高度
  const headerH = 124;
  const tagsH = drawBadges(labels, INNER_X, PAGE_Y + headerH, INNER_W) + 16;
  const tableHeaderH = 38;
  const tableRowH = 36;
  const tableH = tableHeaderH + shops.length * tableRowH;
  const summaryH = 90;
  const sectionGap = 16;

  let notesH = 0;
  const notes = [];
  if (content && content.analysis) notes.push({ title: '未成交分析：', text: content.analysis, bg: '#fffbeb', border: '#f59e0b', titleColor: '#b45309' });
  if (content && content.followUp) notes.push({ title: '催付：', text: content.followUp, bg: '#f0fdf4', border: '#22c55e', titleColor: '#15803d' });
  if (content && content.feedback) notes.push({ title: '反馈：', text: content.feedback, bg: '#eff6ff', border: '#3b82f6', titleColor: '#1d4ed8' });
  for (const note of notes) {
    const maxTextW = INNER_W - 30;
    const lines = wrapText(note.title + note.text, maxTextW);
    notesH += 18 + lines.length * 18 + 18;
  }

  const totalH = PAGE_Y * 2 + headerH + tagsH + tableH + sectionGap + summaryH + sectionGap + notesH;

  canvas.width = W * dpr;
  canvas.height = totalH * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = totalH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 背景
  ctx.fillStyle = '#f4f2ef';
  ctx.fillRect(0, 0, W, totalH);

  // 卡片外框
  roundedRect(PAGE_X, PAGE_Y, CARD_W, totalH - PAGE_Y * 2, 12);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#e2e0dc';
  ctx.stroke();

  let y = PAGE_Y + 24;

  // 头部：日期 + 售前徽章
  ctx.fillStyle = '#7a7a7a';
  ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(dateStr + ' ' + weekDay, INNER_X, y);

  const badgeText = '售前';
  const badgeW = measure(badgeText, 'bold 12px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif') + 22;
  roundedRect(INNER_X + INNER_W - badgeW, y - 11, badgeW, 22, 10);
  ctx.fillStyle = '#7c6fae';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, INNER_X + INNER_W - badgeW/2, y + 1);

  // 姓名/分组 + 总接待量（同一行左右分布，避免上下挤）
  const nameY = PAGE_Y + 78;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2d2d2d';
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  const nameText = `${currentProfile?.name || ''} · ${currentProfile?.group_name || ''}`;
  ctx.fillText(nameText, INNER_X, nameY);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#8a8a8a';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('总接待量', INNER_X + INNER_W, nameY - 14);

  ctx.fillStyle = '#3a5a8a';
  ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(String(totalV), INNER_X + INNER_W, nameY + 20);

  // 分隔线
  const sepY = PAGE_Y + 110;
  ctx.beginPath();
  ctx.moveTo(INNER_X, sepY);
  ctx.lineTo(INNER_X + INNER_W, sepY);
  ctx.strokeStyle = '#f0eeeb';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 数据新鲜度标签
  y = PAGE_Y + headerH;
  drawBadges(labels, INNER_X, y, INNER_W);
  y += tagsH - 16;

  // 表格
  const colX = [0, 180, 250, 320, 390, 520, INNER_W];
  const tableTop = y;

  // 表头背景
  ctx.fillStyle = '#f5f6f8';
  ctx.fillRect(INNER_X, tableTop, INNER_W, tableHeaderH - 1);
  // 表头下边框
  ctx.beginPath();
  ctx.moveTo(INNER_X, tableTop + tableHeaderH - 1);
  ctx.lineTo(INNER_X + INNER_W, tableTop + tableHeaderH - 1);
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const headers = ['店铺', '接待', '询单', '支付', '达成 / 目标', '还差'];
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#555555';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < headers.length; i++) {
    const cx = INNER_X + (colX[i] + colX[i+1]) / 2;
    ctx.textAlign = 'center';
    ctx.fillText(headers[i], cx, tableTop + tableHeaderH/2 + 1);
  }

  // 表格行
  y = tableTop + tableHeaderH;
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  for (const s of shops) {
    const inquiries = parseInt(s.inquiries) || 0;
    const payments = parseInt(s.payments) || 0;
    const visitors = parseInt(s.visitors) || 0;
    const target = parseFloat(s.target) || 0;
    const conv = inquiries > 0 ? (payments / inquiries * 100).toFixed(1) : '--';
    const convNum = inquiries > 0 ? (payments / inquiries * 100) : 0;
    const need = target > 0 && inquiries > 0 ? Math.ceil(inquiries * target / 100 - payments) : null;
    const hit = target > 0 ? convNum >= target : true;

    // 行底部线
    ctx.beginPath();
    ctx.moveTo(INNER_X, y + tableRowH - 1);
    ctx.lineTo(INNER_X + INNER_W, y + tableRowH - 1);
    ctx.strokeStyle = '#f0eeeb';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 店铺名（左对齐，超长截断）
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2d2d2d';
    ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
    const nameW = colX[1] - colX[0] - 16;
    ctx.fillText(truncate(s.name || '', nameW, ctx.font), INNER_X + 8, y + tableRowH/2 + 1);

    const values = [
      visitors || '-',
      inquiries || '-',
      payments || '-',
      inquiries > 0 ? `${conv}%${target > 0 ? ' / ' + target + '%' : ''}` : '--',
      need !== null ? (need > 0 ? '差' + need : '✓') : '-'
    ];

    for (let i = 0; i < values.length; i++) {
      const idx = i + 1;
      const cx = INNER_X + (colX[idx] + colX[idx+1]) / 2;
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
      if (i === 3) ctx.fillStyle = hit ? '#16a34a' : '#ef4444';
      else if (i === 4) ctx.fillStyle = (need !== null && need > 0) ? '#ef4444' : '#16a34a';
      else ctx.fillStyle = '#2d2d2d';
      ctx.fillText(String(values[i]), cx, y + tableRowH/2 + 1);
    }

    y += tableRowH;
  }

  // 汇总区域
  y += sectionGap;
  const totalNeed = shops.reduce((sum, s) => {
    const i = parseInt(s.inquiries) || 0;
    const p = parseInt(s.payments) || 0;
    const t = parseFloat(s.target) || 0;
    return t > 0 && i > 0 ? sum + Math.max(0, Math.ceil(i * t / 100 - p)) : sum;
  }, 0) || '--';
  const totalConvStr = totalI > 0 ? (totalP / totalI * 100).toFixed(1) + '%' : '--%';
  const anyNeed = shops.some(s => {
    const i = parseInt(s.inquiries) || 0;
    const p = parseInt(s.payments) || 0;
    const t = parseFloat(s.target) || 0;
    return t > 0 && i > 0 && Math.ceil(i * t / 100 - p) > 0;
  });

  roundedRect(INNER_X, y, INNER_W, summaryH, 8);
  ctx.fillStyle = '#fafaf9';
  ctx.fill();
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  ctx.stroke();

  const summaryItems = [
    { label: '总询单', value: String(totalI) },
    { label: '总支付', value: String(totalP) },
    { label: '总转化率', value: totalConvStr, color: '#3a5a8a' },
    { label: '总还差', value: String(totalNeed), color: anyNeed ? '#ef4444' : '#16a34a' }
  ];
  const itemW = INNER_W / 4;
  for (let i = 0; i < summaryItems.length; i++) {
    const item = summaryItems[i];
    const cx = INNER_X + itemW * i + itemW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8a8a8a';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(item.label, cx, y + 28);
    ctx.fillStyle = item.color || '#2d2d2d';
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(item.value, cx, y + 58);
  }

  // 备注区域
  y += summaryH + sectionGap;
  for (const note of notes) {
    const maxTextW = INNER_W - 30;
    const lines = wrapText(note.title + note.text, maxTextW);
    const blockH = 18 + lines.length * 18 + 18;

    roundedRect(INNER_X, y, INNER_W, blockH, 8);
    ctx.fillStyle = note.bg;
    ctx.fill();

    // 左侧色条
    ctx.fillStyle = note.border;
    ctx.fillRect(INNER_X, y, 3, blockH);

    ctx.textAlign = 'left';
    let ly = y + 24;
    for (let i = 0; i < lines.length; i++) {
      if (i === 0) {
        ctx.fillStyle = note.titleColor;
        ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
      } else {
        ctx.fillStyle = '#5a5a5a';
        ctx.font = '13px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
      }
      ctx.fillText(lines[i], INNER_X + 12, ly);
      ly += 18;
    }
    y += blockH + 10;
  }

  return canvas;
}

// ==================== DAILY STATS PANEL ====================
let dailyStatsExpanded = false;
function toggleDailyStats() {
  dailyStatsExpanded = !dailyStatsExpanded;
  document.getElementById('daily-stats-content').style.display = dailyStatsExpanded ? '' : 'none';
  document.getElementById('daily-stats-toggle').textContent = dailyStatsExpanded ? '▲' : '▼';
  if (dailyStatsExpanded) renderDailyStats();
}

async function renderDailyStats() {
  if (!supabase) return;
  const body = document.getElementById('daily-stats-body');
  body.innerHTML = '计算中...';

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2,'0')}`;

  // 1. Get schedule data for current month
  const monthSchedule = scheduleData[monthKey];
  if (!monthSchedule || !monthSchedule.staff) {
    body.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;">本月暂无排班数据，无法统计出勤天数</p>';
    return;
  }

  // 2. Get all daily reports for current month
  const start = `${monthKey}-01`;
  const end = `${monthKey}-31`;
  const { data: reports } = await supabase
    .from('daily_reports')
    .select('*, profiles(name, group_name)')
    .gte('report_date', start)
    .lte('report_date', end);

  const allReports = reports || [];

  // 3. Calculate attendance days from schedule (non-rest days)
  const staffAttendance = {};
  monthSchedule.staff.forEach(s => {
    const name = s.name;
    const shifts = s.shifts || [];
    const workDays = shifts.filter(day => day && day.trim() && day !== '休').length;
    staffAttendance[name] = workDays;
  });

  // 4. Calculate total visitors per staff from reports
  const staffVisitors = {};
  allReports.forEach(r => {
    const name = r.profiles?.name || '未知';
    const v = (r.content?.shops || []).reduce((s, sh) => s + (parseInt(sh.visitors) || 0), 0);
    if (!staffVisitors[name]) staffVisitors[name] = 0;
    staffVisitors[name] += v;
  });

  // 5. Group by group
  const groupStats = {};
  monthSchedule.staff.forEach(s => {
    const name = s.name;
    const group = s.group || '未分组';
    const attendance = staffAttendance[name] || 0;
    const visitors = staffVisitors[name] || 0;
    const avg = attendance > 0 ? (visitors / attendance).toFixed(1) : '0.0';

    if (!groupStats[group]) groupStats[group] = { staff: [], totalVisitors: 0, totalAttendance: 0 };
    groupStats[group].staff.push({ name, attendance, visitors, avg });
    groupStats[group].totalVisitors += visitors;
    groupStats[group].totalAttendance += attendance;
  });

  // 6. Render
  let html = '';
  Object.keys(groupStats).forEach(g => {
    const gs = groupStats[g];
    const groupAvg = gs.totalAttendance > 0 ? (gs.totalVisitors / gs.totalAttendance).toFixed(1) : '0.0';
    html += `<div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:700;font-size:14px;">${g}</span>
        <span style="font-size:12px;color:var(--text-secondary);">组日均接待 <strong style="color:var(--primary);">${groupAvg}</strong></span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));gap:8px;">
        ${gs.staff.map(s => `
          <div style="padding:8px;background:#f8f9ff;border-radius:8px;font-size:12px;">
            <div style="font-weight:600;margin-bottom:4px;">${s.name}</div>
            <div style="display:flex;justify-content:space-between;color:#888;">
              <span>出勤 ${s.attendance}天</span>
              <span>总接 ${s.visitors}</span>
            </div>
            <div style="margin-top:4px;color:var(--primary);font-weight:700;">日均 ${s.avg}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
  });

  body.innerHTML = html;
}

// ==================== DAILY ARCHIVE CALENDAR ====================
let archiveMonth = new Date();
let archiveReports = [];

// ==================== SHOP GROUP EDITOR (admin-only) ====================
function toggleGroupEditor() {
  const content = document.getElementById('daily-group-content');
  const toggle = document.getElementById('daily-group-toggle');
  const isOpen = content.style.display !== 'none';
  content.style.display = isOpen ? 'none' : '';
  toggle.textContent = isOpen ? '▼' : '▲';
  if (!isOpen) renderGroupEditor();
}

function renderGroupEditor() {
  const body = document.getElementById('daily-group-body');
  const groups = ['A组', 'B组', 'C组'];
  // Build flat list of all shops with their current group
  const allShops = [];
  groups.forEach(g => {
    const tpl = getShopTemplate(g);
    (tpl.shops || []).forEach(s => {
      allShops.push({ name: s.name, target: s.target || DEFAULT_TARGET, group: g });
    });
  });
  // Also add any shops from DEFAULT_TEMPLATES not in current templates
  const existingNames = new Set(allShops.map(s => s.name));
  groups.forEach(g => {
    const def = DEFAULT_TEMPLATES[g];
    if (def) {
      def.shops.forEach(s => {
        if (!existingNames.has(s.name)) {
          allShops.push({ name: s.name, target: s.target || DEFAULT_TARGET, group: g });
          existingNames.add(s.name);
        }
      });
    }
  });

  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:6px;margin-bottom:10px;">';
  allShops.forEach(s => {
    html += `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:#f8f9ff;border-radius:6px;">
      <span style="flex:1;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
      <select class="group-editor-select" data-shop="${escapeAttr(s.name)}" style="padding:2px 6px;border-radius:4px;border:1px solid var(--border);font-size:11px;background:var(--card-bg);color:var(--text);">
        ${groups.map(g => `<option value="${g}" ${s.group===g?'selected':''}>${g}</option>`).join('')}
      </select>
    </div>`;
  });
  html += '</div>';
  html += '<button class="btn-sm primary" onclick="saveGroupEdits()" style="font-size:12px;">💾 保存分组修改（同步到模板和存档）</button>';
  html += '<span style="font-size:11px;color:var(--text-secondary);margin-left:8px;">修改后日报汇总和存档将按新分组展示</span>';
  body.innerHTML = html;
}

async function saveGroupEdits() {
  if (!supabase) { showToast('系统未初始化'); return; }
  const selects = document.querySelectorAll('.group-editor-select');
  const groupMap = { 'A组': [], 'B组': [], 'C组': [] };
  selects.forEach(sel => {
    const name = sel.getAttribute('data-shop');
    const group = sel.value;
    if (name && groupMap[group]) {
      // Preserve target from current template
      const tpl = getShopTemplate(group);
      const existing = (tpl.shops || []).find(s => s.name === name);
      groupMap[group].push({ name, target: existing?.target || DEFAULT_TARGET });
    }
  });

  // Save each group
  for (const g of Object.keys(groupMap)) {
    if (groupMap[g].length > 0) {
      await saveTemplate(g, groupMap[g]);
    }
  }
  await loadTemplates();
  showToast('店铺分组已保存，汇总和存档已同步');
}

function changeArchiveMonth(delta) {
  archiveMonth.setMonth(archiveMonth.getMonth() + delta);
  renderArchiveCalendar();
}

async function loadArchiveReports(year, month) {
  if (!supabase) return;
  const start = `${year}-${String(month).padStart(2,'0')}-01`;
  const end = `${year}-${String(month).padStart(2,'0')}-31`;
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*, profiles(name, group_name)')
    .gte('report_date', start)
    .lte('report_date', end)
    .order('report_date', { ascending: false });
  if (!error) archiveReports = data || [];
}

async function renderArchiveCalendar() {
  const year = archiveMonth.getFullYear();
  const month = archiveMonth.getMonth() + 1;
  document.getElementById('daily-archive-month').textContent = `${year}年${month}月`;
  await loadArchiveReports(year, month);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();

  // Group reports by date
  const reportsByDate = {};
  archiveReports.forEach(r => {
    const d = r.report_date;
    if (!reportsByDate[d]) reportsByDate[d] = [];
    reportsByDate[d].push(r);
  });

  let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;font-size:11px;max-width:380px;">';
  const wk = ['日','一','二','三','四','五','六'];
  wk.forEach(d => { html += `<div style="text-align:center;padding:4px;font-weight:700;color:var(--text-secondary);font-size:10px;">${d}</div>`; });

  for (let i = 0; i < firstDay; i++) html += '<div></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const hasData = reportsByDate[dateStr];
    const isToday = dateStr === new Date().toISOString().slice(0,10);
    const totalV = hasData ? hasData.reduce((s, r) => s + (r.content?.shops || []).reduce((ss, sh) => ss + (parseInt(sh.visitors)||0), 0), 0) : 0;
    html += `
      <div data-date="${dateStr}" class="archive-day${hasData ? ' has-data' : ''}${isToday ? ' is-today' : ''}" style="
        aspect-ratio:0.85;display:flex;flex-direction:column;align-items:center;justify-content:center;
        border-radius:6px;cursor:pointer;transition:all 0.2s;
        background:${hasData ? '#e8f4ff' : 'var(--card-bg)'};
        border:${isToday ? '2px solid var(--primary)' : '1px solid var(--border)'};
        color:${hasData ? 'var(--primary)' : 'var(--text)'};
        font-weight:${hasData ? '600' : '400'};font-size:11px;
      ">
        <span style="font-size:12px;">${d}</span>
        ${hasData ? `<span style="font-size:9px;margin-top:1px;color:#888;">${hasData.length}人</span>` : ''}
      </div>`;
  }
  html += '</div>';

  // Monthly summary
  const monthTotalV = archiveReports.reduce((s, r) => s + (r.content?.shops || []).reduce((ss, sh) => ss + (parseInt(sh.visitors)||0), 0), 0);
  const uniqueDates = Object.keys(reportsByDate).length;
  const uniqueStaff = new Set(archiveReports.map(r => r.user_id)).size;
  html += `
    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;font-size:11px;">
      <span style="padding:3px 8px;background:#f0f4ff;border-radius:6px;">📅 有日报 ${uniqueDates} 天</span>
      <span style="padding:3px 8px;background:#f0f4ff;border-radius:6px;">👥 参与 ${uniqueStaff} 人</span>
      <span style="padding:3px 8px;background:#f0f4ff;border-radius:6px;">📊 月总接待 ${monthTotalV}</span>
    </div>
  `;

  document.getElementById('daily-archive-calendar').innerHTML = html;
  document.getElementById('daily-archive-detail').style.display = 'none';

  // Bind click events after rendering
  document.querySelectorAll('#daily-archive-calendar .archive-day').forEach(el => {
    el.addEventListener('click', () => {
      const ds = el.getAttribute('data-date');
      if (ds) showArchiveDate(ds);
    });
    el.addEventListener('mouseenter', () => {
      el.style.background = el.classList.contains('has-data') ? '#d0e8ff' : '#f0f4ff';
    });
    el.addEventListener('mouseleave', () => {
      el.style.background = el.classList.contains('has-data') ? '#e8f4ff' : 'var(--card-bg)';
    });
  });
}

function showArchiveDate(dateStr) {
  const reports = archiveReports.filter(r => r.report_date === dateStr);
  if (!reports.length) return;

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <h4 style="margin:0;">${dateStr} 日报详情</h4>
    <button class="btn-sm outline" onclick="document.getElementById('daily-archive-detail').style.display='none'">收起</button>
  </div>`;

  // 1. 收集所有店铺数据，按提交人所属组 + 店铺名组织
  const shopData = {};
  reports.forEach(r => {
    const name = r.profiles?.name || '未知';
    const group = r.profiles?.group_name || '未分组';
    const shops = r.content?.shops || [];
    shops.forEach(s => {
      const sn = s.name || '未知店铺';
      const key = group + '|||' + sn;
      if (!shopData[key]) shopData[key] = [];
      shopData[key].push({
        name,
        inquiries: parseInt(s.inquiries) || 0,
        payments: parseInt(s.payments) || 0,
        target: parseFloat(s.target) || 15
      });
    });
  });

  // 2. 按组重组
  const groupData = {};
  Object.keys(shopData).forEach(key => {
    const [g, sn] = key.split('|||');
    if (!groupData[g]) groupData[g] = {};
    groupData[g][sn] = shopData[key];
  });

  // 转化率颜色辅助
  function rateColor(rate, target) {
    const r = parseFloat(rate);
    const t = parseFloat(target) || 15;
    if (r >= t) return '#16a34a';
    if (r >= t * 0.8) return '#d97706';
    return '#dc2626';
  }
  function rateBg(rate, target) {
    const r = parseFloat(rate);
    const t = parseFloat(target) || 15;
    if (r >= t) return '#dcfce7';
    if (r >= t * 0.8) return '#fef3c7';
    return '#fee2e2';
  }

  // 4. 渲染：每组一个区域
  const groupOrder = ['A组', 'B组', 'C组'];
  const allGroups = Object.keys(groupData).sort((a, b) => {
    const ia = groupOrder.indexOf(a);
    const ib = groupOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  allGroups.forEach(g => {
    html += `<div style="margin-bottom:10px;">
      <div style="padding:6px 10px;background:#f0f4ff;font-weight:700;font-size:12px;border-radius:6px 6px 0 0;border:1px solid var(--border);border-bottom:none;">${escapeHtml(g)}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:8px;padding:8px;border:1px solid var(--border);border-radius:0 0 6px 6px;background:var(--card-bg);">`;

    const shops = Object.keys(groupData[g]).sort();
    shops.forEach(shopName => {
      const rows = groupData[g][shopName];
      let totalInq = 0, totalPay = 0, totalTarget = 15;
      rows.forEach(r => {
        totalInq += r.inquiries;
        totalPay += r.payments;
        totalTarget = r.target || totalTarget;
      });
      const totalRate = totalInq > 0 ? (totalPay / totalInq * 100).toFixed(2) : '0.00';
      const tRateColor = rateColor(totalRate, totalTarget);
      const tRateBg = rateBg(totalRate, totalTarget);

      html += `<div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.03);">
        <div style="padding:5px 8px;background:#f8f9ff;font-weight:700;font-size:11px;text-align:center;border-bottom:1px solid #e5e7eb;">${escapeHtml(shopName)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#f0f4ff;">
              <th style="padding:4px 3px;text-align:center;border-bottom:1px solid #e5e7eb;font-weight:600;width:28%;">客服</th>
              <th style="padding:4px 3px;text-align:center;border-bottom:1px solid #e5e7eb;font-weight:600;width:24%;">询单</th>
              <th style="padding:4px 3px;text-align:center;border-bottom:1px solid #e5e7eb;font-weight:600;width:24%;">付款</th>
              <th style="padding:4px 3px;text-align:center;border-bottom:1px solid #e5e7eb;font-weight:600;width:24%;">转化</th>
            </tr>
          </thead>
          <tbody>`;

      rows.forEach(row => {
        const rate = row.inquiries > 0 ? (row.payments / row.inquiries * 100).toFixed(2) : '0.00';
        const rc = rateColor(rate, row.target);
        html += `<tr>
          <td style="padding:4px 3px;text-align:center;border-bottom:1px solid #f3f4f6;font-weight:500;">${escapeHtml(row.name)}</td>
          <td style="padding:4px 3px;text-align:center;border-bottom:1px solid #f3f4f6;">${row.inquiries}</td>
          <td style="padding:4px 3px;text-align:center;border-bottom:1px solid #f3f4f6;">${row.payments}</td>
          <td style="padding:4px 3px;text-align:center;border-bottom:1px solid #f3f4f6;font-weight:600;color:${rc};">${rate}%</td>
        </tr>`;
      });

      html += `<tr style="background:#f8f9ff;font-weight:700;">
        <td style="padding:4px 3px;text-align:center;">合计</td>
        <td style="padding:4px 3px;text-align:center;">${totalInq}</td>
        <td style="padding:4px 3px;text-align:center;">${totalPay}</td>
        <td style="padding:4px 3px;text-align:center;color:${tRateColor};background:${tRateBg};">${totalRate}%</td>
      </tr>`;

      html += `</tbody></table></div>`;
    });

    html += `</div></div>`;
  });

  const detail = document.getElementById('daily-archive-detail');
  detail.innerHTML = html;
  detail.style.display = '';
}

function closeDailyTrack() {
  document.getElementById('daily-track-area').style.display = 'none';
  renderDailyList();
}

async function renderDailyTrack() {
  if (!supabase) return;
  document.getElementById('daily-form-area').style.display = 'none';
  document.getElementById('daily-result-area').style.display = 'none';
  document.getElementById('daily-track-area').style.display = '';
  const today = new Date();
  const todayDateStr = today.toISOString().slice(0, 10);
  document.getElementById('daily-track-date').textContent = todayDateStr;

  const [{ data: profiles }, { data: reports }] = await Promise.all([
    supabase.from('profiles').select('id,name,group_name,real_name').order('name'),
    supabase.from('daily_reports').select('*').eq('report_date', todayDateStr)
  ]);

  const reportMap = {};
  (reports || []).forEach(r => { reportMap[r.user_id] = r; });

  const list = document.getElementById('daily-track-list');
  if (!profiles || profiles.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">暂无客服人员数据</p>';
    return;
  }

  const isLeader = currentProfile?.role === 'admin' || currentProfile?.role === 'leader';
  if (!isLeader) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">仅管理员/组长可查看全员提交情况</p>';
    return;
  }

  // 读取当日排班表，找出当班人员
  const monthKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  const todayDay = String(today.getDate());
  const monthSchedule = scheduleData[monthKey];
  // 构建排班映射：名字 → 今日班次
  const shiftMap = {};
  if (monthSchedule && monthSchedule.staff) {
    monthSchedule.staff.forEach(s => {
      const shift = s.schedule[todayDay];
      if (shift && !shift.includes('休息') && !shift.includes('休')) {
        shiftMap[s.name] = shift;
      }
    });
  }

  // 用排班映射中的花名匹配 profiles 中的 name
  // 同时检查：如果 profile 的 name 在排班中找不到，也试试用排班名去 match
  const onShiftProfiles = [];
  const matchedScheduleNames = new Set();

  profiles.forEach(p => {
    const pname = p.name || '';
    const rname = p.real_name || '';
    // 优先精确匹配花名
    if (shiftMap[pname]) {
      onShiftProfiles.push({ ...p, shift: shiftMap[pname] });
      matchedScheduleNames.add(pname);
      return;
    }
    // 精确匹配真实姓名
    if (rname && shiftMap[rname]) {
      onShiftProfiles.push({ ...p, shift: shiftMap[rname] });
      matchedScheduleNames.add(rname);
      return;
    }
    // 模糊匹配：排班表中的名字包含 profile 名字或反之（同时检查花名和真名）
    for (const sname of Object.keys(shiftMap)) {
      if (!matchedScheduleNames.has(sname)) {
        if (sname.includes(pname) || pname.includes(sname) || (rname && (sname.includes(rname) || rname.includes(sname)))) {
          onShiftProfiles.push({ ...p, shift: shiftMap[sname] });
          matchedScheduleNames.add(sname);
          return;
        }
      }
    }
  });

  // 排班表中当班但未找到对应 profile 的人
  for (const sname of Object.keys(shiftMap)) {
    if (!matchedScheduleNames.has(sname)) {
      onShiftProfiles.push({ id: '__unknown__', name: sname, group_name: '', shift: shiftMap[sname], noProfile: true });
    }
  }

  // 未提交人员列表（用于顶部提醒）
  const notSubmitted = onShiftProfiles.filter(p => !reportMap[p.id] && !p.noProfile);
  const hasAllSubmitted = notSubmitted.length === 0 && onShiftProfiles.every(p => p.noProfile || reportMap[p.id]);

  // 按组分组
  const grouped = {};
  onShiftProfiles.forEach(p => {
    const g = p.group_name || '未分组';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(p);
  });

  // 渲染
  let html = '';

  // 顶部提醒横幅
  if (onShiftProfiles.length === 0) {
    html += '<div style="text-align:center;padding:20px;color:var(--text-secondary);background:#fff7ed;border-radius:10px;margin-bottom:16px;">⚠️ 今日排班表中未找到当班人员，或排班数据为空</div>';
  } else if (notSubmitted.length > 0) {
    html += `<div style="padding:12px 16px;background:#FFF3D4;border-radius:10px;margin-bottom:16px;border-left:4px solid #f59e0b;">
      <div style="font-size:14px;font-weight:700;color:#b45309;margin-bottom:4px;">⏳ 以下当班人员尚未提交日报：</div>
      <div style="font-size:13px;color:#92400e;">${notSubmitted.map(p => '<strong>' + escapeHtml(p.name) + '</strong>（' + (p.group_name || '未分组') + ' · ' + (p.shift || '当班') + '）').join('、')}</div>
    </div>`;
  } else {
    html += '<div style="padding:12px 16px;background:#dcfce7;border-radius:10px;margin-bottom:16px;border-left:4px solid #22c55e;"><div style="font-size:14px;font-weight:700;color:#16a34a;">✅ 今日当班人员已全部提交日报</div></div>';
  }

  // 统计卡片
  const totalOnShift = onShiftProfiles.length;
  const submitted = onShiftProfiles.filter(p => !p.noProfile && reportMap[p.id]).length;
  html += `<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
    <div style="flex:1;min-width:80px;background:#eff6ff;border-radius:8px;padding:8px;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#2563eb;">${totalOnShift}</div>
      <div style="font-size:11px;color:#666;">今日当班</div>
    </div>
    <div style="flex:1;min-width:80px;background:#dcfce7;border-radius:8px;padding:8px;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#16a34a;">${submitted}</div>
      <div style="font-size:11px;color:#666;">已提交</div>
    </div>
    <div style="flex:1;min-width:80px;background:#fff3d4;border-radius:8px;padding:8px;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#d97706;">${totalOnShift - submitted}</div>
      <div style="font-size:11px;color:#666;">未提交</div>
    </div>
  </div>`;

  // 按组展示
  const groupOrder = ['A组','B组','C组'];
  const remaining = Object.keys(grouped).filter(g => !groupOrder.includes(g));
  const sortedGroups = [...groupOrder.filter(g => grouped[g]), ...remaining.sort()];

  sortedGroups.forEach(g => {
    const members = grouped[g];
    html += `<div style="margin-bottom:10px;border:1px solid var(--border);border-radius:10px;overflow:hidden;">
      <div style="padding:6px 14px;background:#f8f9ff;border-bottom:1px solid var(--border);font-size:13px;font-weight:700;">${escapeHtml(g)} · ${members.length}人当班</div>
      <div style="padding:4px 14px;">`;

    members.forEach(m => {
      const hasReport = m.noProfile ? false : !!reportMap[m.id];
      const statusClass = hasReport ? 'done' : 'pending';
      const statusText = hasReport ? '✅ 已提交' : (m.noProfile ? '⚠️ 未注册' : '⏳ 未提交');
      const statusColor = hasReport ? 'var(--success)' : (m.noProfile ? 'var(--warning)' : 'var(--danger)');
      html += `
        <div class="daily-track-item" style="cursor:${m.noProfile ? 'default' : 'pointer'};" onclick="${m.noProfile ? '' : "showDailyDetail('" + m.id + "', '" + escapeAttr(m.name || '') + "')"}">
          <div class="daily-track-avatar" style="background:${hasReport ? 'var(--success)' : 'var(--primary-light)'};">${(m.name || '?').charAt(0)}</div>
          <div class="daily-track-info">
            <div class="daily-track-name">${escapeHtml(m.name || '未命名')} <span style="font-size:11px;color:var(--text-secondary);">${m.shift ? '(' + escapeHtml(m.shift) + ')' : ''}</span></div>
            <div class="daily-track-status" style="color:${statusColor};">${statusText}</div>
          </div>
        </div>`;
    });

    html += '</div></div>';
  });

  list.innerHTML = html;

  // ===== 已提交日报按组汇总 =====
  const submittedReports = (reports || []).filter(r => r.status === 'submitted' && r.content?.shops?.length);
  if (submittedReports.length === 0) return;

  // 建立 userId → profile 映射
  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.id] = p; });

  // 按组聚合店铺数据
  const groupAgg = {}; // { 'A组': { 'TM-弥生': { visitors, inquiries, payments, targets, count } } }
  submittedReports.forEach(r => {
    const p = profileMap[r.user_id];
    if (!p) return;
    const g = p.group_name || '未分组';
    if (!groupAgg[g]) groupAgg[g] = {};
    const shops = r.content.shops || [];
    shops.forEach(s => {
      const sn = s.name || s;
      if (!sn) return;
      if (!groupAgg[g][sn]) groupAgg[g][sn] = { visitors: 0, inquiries: 0, payments: 0, targets: [], count: 0 };
      groupAgg[g][sn].visitors += parseInt(s.visitors) || 0;
      groupAgg[g][sn].inquiries += parseInt(s.inquiries) || 0;
      groupAgg[g][sn].payments += parseInt(s.payments) || 0;
      if (s.target) groupAgg[g][sn].targets.push(parseFloat(s.target));
      groupAgg[g][sn].count++;
    });
  });

  // 渲染汇总表格：先移除旧的
  const oldAgg = document.getElementById('daily-track-agg');
  if (oldAgg) oldAgg.remove();

  const aggContainer = document.createElement('div');
  aggContainer.id = 'daily-track-agg';
  aggContainer.style.marginTop = '18px';
  aggContainer.innerHTML = '<h4 style="margin-bottom:10px;font-size:15px;">📊 今日已提交数据汇总（按组）</h4>';

  const aggGroupOrder = ['A组','B组','C组'];
  const aggRemaining = Object.keys(groupAgg).filter(g => !aggGroupOrder.includes(g));
  const aggSorted = [...aggGroupOrder.filter(g => groupAgg[g]), ...aggRemaining.sort()];

  aggSorted.forEach(g => {
    const shops = groupAgg[g];
    const shopNames = Object.keys(shops).sort();
    if (shopNames.length === 0) return;

    let totalV = 0, totalI = 0, totalP = 0;
    const rows = shopNames.map(sn => {
      const d = shops[sn];
      totalV += d.visitors; totalI += d.inquiries; totalP += d.payments;
      const conv = d.inquiries > 0 ? (d.payments / d.inquiries * 100).toFixed(1) : '--';
      const avgTarget = d.targets.length > 0 ? (d.targets.reduce((a,b)=>a+b,0)/d.targets.length).toFixed(0) : '-';
      return `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:12px;font-weight:600;">${escapeHtml(sn)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:center;">${d.visitors}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:center;">${d.inquiries}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:center;">${d.payments}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:center;font-weight:700;color:var(--primary);">${conv}%</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:center;color:var(--text-secondary);">${avgTarget !== '-' ? avgTarget+'%' : '-'}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:center;color:var(--text-secondary);">${d.count}人</td>
      </tr>`;
    }).join('');

    const gConv = totalI > 0 ? (totalP / totalI * 100).toFixed(1) : '--';

    aggContainer.innerHTML += `
      <div style="margin-bottom:14px;border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        <div style="padding:7px 14px;background:#f0f4ff;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700;font-size:13px;">${escapeHtml(g)} · ${Object.values(groupAgg[g]).reduce((s, d) => s + d.count, 0) / (shopNames.length || 1)}人次填报</span>
          <span style="font-size:11px;color:var(--text-secondary);">总接待 <strong>${totalV}</strong> · 总询单 <strong>${totalI}</strong> · 总支付 <strong>${totalP}</strong> · 转化率 <strong style="color:var(--primary);">${gConv}%</strong></span>
        </div>
        <div style="overflow-x:auto;padding:4px 14px;">
          <table class="ranking-table" style="min-width:450px;font-size:12px;">
            <thead><tr>
              <th style="text-align:left;padding:4px 8px;">店铺</th><th style="padding:4px 8px;">接待量</th><th style="padding:4px 8px;">询单</th><th style="padding:4px 8px;">支付</th><th style="padding:4px 8px;">转化率</th><th style="padding:4px 8px;">平均目标</th><th style="padding:4px 8px;">填报人数</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  });

  list.parentElement.appendChild(aggContainer);
}

async function showDailyDetail(userId, userName) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from('daily_reports').select('*').eq('user_id', userId).eq('report_date', today).single();
  if (!data) { showToast(userName + ' 今日未提交日报'); return; }
  // Show in a simple alert or modal - for now use a card in the track area
  const list = document.getElementById('daily-track-list');
  const detailCard = document.createElement('div');
  detailCard.innerHTML = renderDailyReportCard(data);
  detailCard.style.marginTop = '16px';
  list.appendChild(detailCard);
}

function subscribeDaily() {
  if (!supabase || dailySub) return;
  dailySub = supabase.channel('daily_reports')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' }, () => {
      if (currentPage === 'daily') {
        loadDailyReports();
        // 如果正在查看跟踪视图，自动刷新
        if (document.getElementById('daily-track-area')?.style.display !== 'none') {
          renderDailyTrack();
        }
      }
    })
    .subscribe();
}

// ---------- 售前数据 ----------
let presaleRecords = [];
let presaleSub = null;

async function loadPresaleData() {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('presale_data')
    .select('*')
    .order('record_date', { ascending: false })
    .limit(30);
  if (!error) presaleRecords = data || [];
  renderPresale();
}

function renderPresale() {
  const tbody = document.getElementById('presale-tbody');
  const empty = document.getElementById('presale-empty');
  const stats = document.getElementById('presale-stats-row');
  if (!tbody) return;

  if (presaleRecords.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = '';
    if (stats) stats.innerHTML = '';
    return;
  }
  empty.style.display = 'none';

  // Stats
  const totalRevenue = presaleRecords.reduce((s, r) => s + ((r.metrics?.total_revenue) || 0), 0);
  const avgConv = presaleRecords.length > 0
    ? (presaleRecords.reduce((s, r) => s + ((r.metrics?.conversion) || 0), 0) / presaleRecords.length).toFixed(1)
    : 0;
  if (stats) {
    stats.innerHTML = `
      <div class="stat-card"><div class="num">${presaleRecords.length}</div><div class="label">录入天数</div></div>
      <div class="stat-card"><div class="num">¥${(totalRevenue / 10000).toFixed(1)}万</div><div class="label">累计销售</div></div>
      <div class="stat-card"><div class="num">${avgConv}%</div><div class="label">平均转化</div></div>
      <div class="stat-card"><div class="num">${presaleRecords[0]?.metrics?.total_visitors || 0}</div><div class="label">最新接待</div></div>
    `;
  }

  tbody.innerHTML = presaleRecords.map(r => {
    const m = r.metrics || {};
    return `<tr>
      <td>${r.record_date}</td>
      <td>${m.total_visitors || 0}</td>
      <td>${m.total_orders || 0}</td>
      <td>¥${(m.total_revenue || 0).toLocaleString()}</td>
      <td>${m.conversion || 0}%</td>
      <td>${m.avg_response || 0}</td>
      <td>${m.satisfaction || 0}%</td>
    </tr>`;
  }).join('');
}

function openPresaleForm() {
  if (!currentUser) { showToast('请先登录'); switchPage('login'); return; }
  document.getElementById('presale-form-area').style.display = '';
  document.getElementById('presale-list-area').style.display = 'none';
  document.getElementById('presale-date-label').textContent = new Date().toLocaleDateString('zh-CN');
  document.getElementById('presale-date-input').value = new Date().toISOString().slice(0, 10);
}

function closePresaleForm() {
  document.getElementById('presale-form-area').style.display = 'none';
  document.getElementById('presale-list-area').style.display = '';
}

async function submitPresale() {
  if (!currentUser) return;
  const date = document.getElementById('presale-date-input').value;
  if (!date) { showToast('请选择日期'); return; }
  const metrics = {
    total_visitors: parseInt(document.getElementById('presale-total-visitors').value) || 0,
    total_orders: parseInt(document.getElementById('presale-total-orders').value) || 0,
    total_revenue: parseInt(document.getElementById('presale-total-revenue').value) || 0,
    conversion: parseFloat(document.getElementById('presale-conversion').value) || 0,
    avg_response: parseInt(document.getElementById('presale-avg-response').value) || 0,
    satisfaction: parseFloat(document.getElementById('presale-satisfaction').value) || 0
  };
  const { error } = await supabase.from('presale_data').upsert({
    record_date: date,
    metrics: metrics,
    created_by: currentUser.id
  }, { onConflict: 'record_date' });
  if (error) { showToast('保存失败：' + error.message); }
  else {
    showToast('数据保存成功');
    closePresaleForm();
    loadPresaleData();
  }
}

function subscribePresale() {
  if (!supabase || presaleSub) return;
  presaleSub = supabase.channel('presale_data')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'presale_data' }, () => {
      if (currentPage === 'presale') loadPresaleData();
    })
    .subscribe();
}

// ---------- 页面切换钩子 ----------
const _origSwitchPage = switchPage;
switchPage = function(page) {
  _origSwitchPage(page);
  if (page === 'home' && supabase) { loadAnnouncements(); subscribeAnnouncements(); }
  if (page === 'daily' && supabase) { loadDailyReports(); subscribeDaily(); }
  if (page === 'presale' && supabase) { loadPresaleData(); subscribePresale(); }
  if (page === 'members' && supabase) { loadMembers(); subscribeProfiles(); }
  if (page === 'templates' && supabase) { loadTemplates().then(() => renderTemplates()); subscribeTemplates(); }
};

// ---------- 成员管理 ----------
async function loadMembers() {
  if (!supabase) {
    document.getElementById('members-tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-secondary);">Supabase 未初始化</td></tr>';
    return;
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      document.getElementById('members-tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--danger);">加载失败：' + escapeHtml(error.message) + '</td></tr>';
      return;
    }
    renderMembers(data || []);
  } catch (e) {
    document.getElementById('members-tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--danger);">加载异常</td></tr>';
  }
}

function renderMembers(members) {
  const tbody = document.getElementById('members-tbody');
  if (!members.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-secondary);">暂无成员</td></tr>';
    return;
  }
  const roleMap = { admin: '管理员', leader: '组长', staff: '员工' };
  const groupMap = { 'A组': '🔵 A组', 'B组': '🟠 B组', 'C组': '🟢 C组' };
  const isAdmin = currentProfile?.role === 'admin';
  tbody.innerHTML = members.map(m => {
    const date = m.created_at ? new Date(m.created_at).toLocaleDateString('zh-CN') : '-';
    const phone = m.phone || '-';
    return `<tr>
      <td>
        ${isAdmin ? `<span class="member-name-editable" onclick="editMemberName(this, '${m.id}', '${escapeAttr(m.name || '')}')" title="点击修改花名" style="cursor:pointer;border-bottom:1px dashed var(--primary-light);">${escapeHtml(m.name || '未命名')}</span>` : escapeHtml(m.name || '未命名')}
      </td>
      <td>
        ${isAdmin ? `<span class="member-name-editable" onclick="editMemberRealName(this, '${m.id}', '${escapeAttr(m.real_name || '')}')" title="点击修改真实姓名" style="cursor:pointer;border-bottom:1px dashed var(--primary-light);color:var(--text-secondary);">${escapeHtml(m.real_name || '-')}</span>` : escapeHtml(m.real_name || '-')}
      </td>
      <td>${escapeHtml(phone)}</td>
      <td>
        ${isAdmin ? `<select onchange="updateMemberGroup('${m.id}', this.value)" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);font-size:13px;">
          <option value="" ${!m.group_name?'selected':''}>未分组</option>
          <option value="A组" ${m.group_name==='A组'?'selected':''}>A组</option>
          <option value="B组" ${m.group_name==='B组'?'selected':''}>B组</option>
          <option value="C组" ${m.group_name==='C组'?'selected':''}>C组</option>
        </select>` : (groupMap[m.group_name] || (m.group_name || '未分组'))}
      </td>
      <td><span class="badge" style="background:${m.role==='admin'?'var(--danger)':m.role==='leader'?'var(--warning)':'var(--success)'};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">${roleMap[m.role] || '员工'}</span></td>
      <td>${date}</td>
      <td>
        ${isAdmin ? `<select onchange="updateMemberRole('${m.id}', this.value)" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);font-size:13px;">
          <option value="staff" ${m.role==='staff'?'selected':''}>员工</option>
          <option value="leader" ${m.role==='leader'?'selected':''}>组长</option>
          <option value="admin" ${m.role==='admin'?'selected':''}>管理员</option>
        </select>` : '-'}
      </td>
    </tr>`;
  }).join('');
}

async function updateMemberGroup(userId, groupName) {
  if (!supabase) return;
  const { error } = await supabase.from('profiles').update({ group_name: groupName }).eq('id', userId);
  if (error) { showToast('更新失败：' + error.message); return; }
  showToast('组别已更新');
  loadMembers();
}

async function updateMemberName(userId, newName) {
  if (!supabase) return;
  if (!newName || !newName.trim()) { showToast('姓名不能为空'); return; }
  const { error } = await supabase.from('profiles').update({ name: newName.trim() }).eq('id', userId);
  if (error) { showToast('更新失败：' + error.message); return; }
  showToast('姓名已更新为 ' + newName.trim());
  loadMembers();
}

let profilesSub = null;
function subscribeProfiles() {
  if (!supabase || profilesSub) return;
  profilesSub = supabase.channel('profiles')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
      if (currentPage === 'members') loadMembers();
    })
    .subscribe();
}

// ---------- 扫码注册：URL参数自动切换 ----------
(function() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'register') {
    // Wait for DOM & supabase init
    const trySwitch = setInterval(() => {
      if (document.getElementById('register-form') && supabase) {
        switchPage('login');
        switchLoginTab('register');
        clearInterval(trySwitch);
      }
    }, 300);
    // Stop trying after 10 seconds
    setTimeout(() => clearInterval(trySwitch), 10000);
  }
})();

// ==================== 客服信息管理 ====================
let allStaffData = [];
let staffSearchTerm = '';
let allOvertimeRecords = [];  // all overtime records from Supabase
let allLeaveRecords = [];     // all compensatory leave records from Supabase
let otDrawerProfileId = null;

async function loadStaffInfo() {
  if (!supabase) {
    document.getElementById('staff-tbody').innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-secondary);">Supabase 未初始化</td></tr>';
    return;
  }
  try {
    const [profRes, otRes, lvRes] = await Promise.all([
      supabase.from('profiles').select('*').order('group_name', { ascending: true }).order('name', { ascending: true }),
      supabase.from('overtime_records').select('*').order('date', { ascending: false }),
      supabase.from('compensatory_leave_records').select('*').order('date', { ascending: false })
    ]);
    if (profRes.error) {
      document.getElementById('staff-tbody').innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--danger);">加载失败：' + escapeHtml(profRes.error.message) + '</td></tr>';
      return;
    }
    allStaffData = profRes.data || [];
    allOvertimeRecords = otRes.data || [];
    allLeaveRecords = lvRes.data || [];
    renderStaffTable();
  } catch (e) {
    document.getElementById('staff-tbody').innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--danger);">加载异常</td></tr>';
  }
}

function getOTSummary(profileId) {
  const otRecs = allOvertimeRecords.filter(r => r.profile_id === profileId);
  const lvRecs = allLeaveRecords.filter(r => r.profile_id === profileId);
  const totalOT = otRecs.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const totalLV = lvRecs.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const remain = Math.max(0, totalOT - totalLV);
  return { totalOT: roundH(totalOT), totalLV: roundH(totalLV), remain: roundH(remain) };
}

function roundH(v) { return Math.round(v * 10) / 10; }

function renderStaffTable() {
  const tbody = document.getElementById('staff-tbody');
  const term = staffSearchTerm.toLowerCase();
  const filtered = allStaffData.filter(s => {
    if (!term) return true;
    const name = (s.name || '').toLowerCase();
    const real = (s.real_name || '').toLowerCase();
    const phone = (s.phone || '').toLowerCase();
    return name.includes(term) || real.includes(term) || phone.includes(term);
  });

  document.getElementById('staff-count').textContent = '共 ' + filtered.length + ' 人（总计 ' + allStaffData.length + ' 人）';

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-secondary);">' + (term ? '无匹配结果' : '暂无客服数据') + '</td></tr>';
    return;
  }

  const isAdmin = currentProfile?.role === 'admin';
  const groupMap = { 'A组': '🔵 A组', 'B组': '🟠 B组', 'C组': '🟢 C组' };

  tbody.innerHTML = filtered.map(s => {
    const nickname = s.name || '-';
    const realName = s.real_name || '-';
    const phone = s.phone || '-';
    const hireDate = s.hire_date || '-';
    const position = s.position || '-';
    const group = groupMap[s.group_name] || (s.group_name || '未分组');

    const ot = getOTSummary(s.id);

    const onClickEdit = isAdmin ? ' onclick="event.stopPropagation();startEditStaffField(this,\'' + s.id + '\',\'nickname\',\'' + escapeAttr(nickname) + '\')"' : '';
    const onClickReal = isAdmin ? ' onclick="event.stopPropagation();startEditStaffField(this,\'' + s.id + '\',\'real_name\',\'' + escapeAttr(realName) + '\')"' : '';
    const onClickPhone = isAdmin ? ' onclick="event.stopPropagation();startEditStaffField(this,\'' + s.id + '\',\'phone\',\'' + escapeAttr(phone) + '\')"' : '';
    const onClickHire = isAdmin ? ' onclick="event.stopPropagation();startEditStaffField(this,\'' + s.id + '\',\'hire_date\',\'' + escapeAttr(hireDate) + '\')"' : '';
    const onClickPos = isAdmin ? ' onclick="event.stopPropagation();startEditStaffField(this,\'' + s.id + '\',\'position\',\'' + escapeAttr(position) + '\')"' : '';

    const otColor = ot.totalOT > 0 ? '#e67e22' : '#999';
    const lvColor = ot.totalLV > 0 ? '#3498db' : '#999';
    const rmColor = ot.remain > 0 ? '#27ae60' : '#999';

    return '<tr>'
      + '<td' + (isAdmin ? ' style="cursor:pointer;"' : '') + onClickEdit + '>' + escapeHtml(nickname) + '</td>'
      + '<td' + (isAdmin ? ' style="cursor:pointer;"' : '') + onClickReal + '>' + escapeHtml(realName) + '</td>'
      + '<td' + (isAdmin ? ' style="cursor:pointer;"' : '') + onClickPhone + '>' + escapeHtml(phone) + '</td>'
      + '<td' + (isAdmin ? ' style="cursor:pointer;"' : '') + onClickHire + '>' + escapeHtml(hireDate) + '</td>'
      + '<td' + (isAdmin ? ' style="cursor:pointer;"' : '') + onClickPos + '>' + escapeHtml(position) + '</td>'
      + '<td>' + group + '</td>'
      + '<td class="staff-ot-cell" onclick="event.stopPropagation();openOTDrawer(\'' + s.id + '\',\'' + escapeAttr(nickname) + '\')">'
      + '<div class="ot-cell-val" style="color:' + otColor + '">' + ot.totalOT + 'h</div></td>'
      + '<td class="staff-ot-cell" onclick="event.stopPropagation();openOTDrawer(\'' + s.id + '\',\'' + escapeAttr(nickname) + '\')">'
      + '<div class="ot-cell-val" style="color:' + lvColor + '">' + ot.totalLV + 'h</div></td>'
      + '<td class="staff-ot-cell" onclick="event.stopPropagation();openOTDrawer(\'' + s.id + '\',\'' + escapeAttr(nickname) + '\')">'
      + '<div class="ot-cell-val" style="color:' + rmColor + '">' + ot.remain + 'h</div></td>'
      + '<td><div class="staff-btn-row">'
      + '<button class="btn-sm outline" onclick="event.stopPropagation();openAcctsModal(\'' + s.id + '\',\'' + escapeAttr(nickname) + '\')" title="账号本">📒</button>'
      + '<button class="btn-sm outline" onclick="event.stopPropagation();openOTDrawer(\'' + s.id + '\',\'' + escapeAttr(nickname) + '\')" title="管理加班调休">⏱️</button>'
      + '<button class="btn-sm outline" onclick="event.stopPropagation();copyStaffRow(\'' + s.id + '\')" title="复制该行">📋</button>'
      + '</div></td>'
      + '</tr>';
  }).join('');
}

// ========== 加班调休抽屉 ==========

function openOTDrawer(profileId, nickname) {
  otDrawerProfileId = profileId;
  document.getElementById('ot-drawer-name').textContent = '⏱️ ' + nickname + ' - 加班调休';
  document.getElementById('ot-drawer-overlay').classList.add('show');
  document.getElementById('ot-drawer').classList.add('show');

  const isAdmin = currentProfile?.role === 'admin';
  document.getElementById('ot-add-overtime-btn').style.display = isAdmin ? '' : 'none';
  document.getElementById('ot-add-leave-btn').style.display = isAdmin ? '' : 'none';
  hideOTAddForm('overtime');
  hideOTAddForm('leave');

  renderOTDrawer();
}

function closeOTDrawer() {
  document.getElementById('ot-drawer-overlay').classList.remove('show');
  document.getElementById('ot-drawer').classList.remove('show');
  otDrawerProfileId = null;
}

function renderOTDrawer() {
  const pid = otDrawerProfileId;
  if (!pid) return;

  const ot = getOTSummary(pid);
  document.getElementById('ot-drawer-summary').innerHTML =
    '<div class="ot-stat ot-total"><div class="ot-stat-val">' + ot.totalOT + 'h</div><div class="ot-stat-label">累计加班</div></div>' +
    '<div class="ot-stat ot-used"><div class="ot-stat-val">' + ot.totalLV + 'h</div><div class="ot-stat-label">已调休</div></div>' +
    '<div class="ot-stat ot-remain"><div class="ot-stat-val">' + ot.remain + 'h</div><div class="ot-stat-label">剩余可调</div></div>';

  // Overtime list
  const otRecs = allOvertimeRecords.filter(r => r.profile_id === pid);
  const otList = document.getElementById('ot-overtime-list');
  if (!otRecs.length) {
    otList.innerHTML = '<div class="ot-list-empty">暂无加班记录</div>';
  } else {
    otList.innerHTML = otRecs.map(r => {
      const isAdmin = currentProfile?.role === 'admin';
      return '<div class="ot-record-item overtime-rec">'
        + '<span class="ot-rec-date">' + (r.date || '-') + '</span>'
        + '<span class="ot-rec-hours">+' + roundH(r.hours) + 'h</span>'
        + '<span class="ot-rec-note">' + escapeHtml(r.note || '') + '</span>'
        + (isAdmin ? '<button class="ot-rec-del" onclick="deleteOTRecord(\'overtime\',\'' + r.id + '\')" title="删除">🗑️</button>' : '')
        + '</div>';
    }).join('');
  }

  // Leave list
  const lvRecs = allLeaveRecords.filter(r => r.profile_id === pid);
  const lvList = document.getElementById('ot-leave-list');
  if (!lvRecs.length) {
    lvList.innerHTML = '<div class="ot-list-empty">暂无调休记录</div>';
  } else {
    lvList.innerHTML = lvRecs.map(r => {
      const isAdmin = currentProfile?.role === 'admin';
      return '<div class="ot-record-item leave-rec">'
        + '<span class="ot-rec-date">' + (r.date || '-') + '</span>'
        + '<span class="ot-rec-hours" style="color:#3498db;">-' + roundH(r.hours) + 'h</span>'
        + '<span class="ot-rec-note">' + escapeHtml(r.note || '') + '</span>'
        + (isAdmin ? '<button class="ot-rec-del" onclick="deleteOTRecord(\'leave\',\'' + r.id + '\')" title="删除">🗑️</button>' : '')
        + '</div>';
    }).join('');
  }
}

function showOTAddForm(type) {
  if (type === 'overtime') {
    document.getElementById('ot-overtime-form').style.display = 'flex';
    document.getElementById('ot-ov-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('ot-ov-hours').value = '';
    document.getElementById('ot-ov-note').value = '';
    setTimeout(() => document.getElementById('ot-ov-hours').focus(), 100);
  } else {
    document.getElementById('ot-leave-form').style.display = 'flex';
    document.getElementById('ot-lv-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('ot-lv-hours').value = '';
    document.getElementById('ot-lv-note').value = '';
    setTimeout(() => document.getElementById('ot-lv-hours').focus(), 100);
  }
}

function hideOTAddForm(type) {
  document.getElementById(type === 'overtime' ? 'ot-overtime-form' : 'ot-leave-form').style.display = 'none';
}

async function saveOTRecord(type) {
  const pid = otDrawerProfileId;
  if (!pid || !supabase) return;

  const prefix = type === 'overtime' ? 'ot-ov-' : 'ot-lv-';
  const dateVal = document.getElementById(prefix + 'date').value;
  const hoursVal = parseFloat(document.getElementById(prefix + 'hours').value);
  const noteVal = document.getElementById(prefix + 'note').value.trim();

  if (!dateVal) { showToast('请选择日期'); return; }
  if (!hoursVal || hoursVal <= 0) { showToast('请输入有效小时数'); return; }

  const table = type === 'overtime' ? 'overtime_records' : 'compensatory_leave_records';
  const { data, error } = await supabase.from(table).insert({
    profile_id: pid,
    date: dateVal,
    hours: hoursVal,
    note: noteVal || null
  }).select().single();

  if (error) { showToast('保存失败：' + error.message); return; }

  showToast(type === 'overtime' ? '加班记录已添加' : '调休记录已添加');
  hideOTAddForm(type);

  // Update local cache
  if (type === 'overtime') {
    allOvertimeRecords.unshift(data);
  } else {
    allLeaveRecords.unshift(data);
  }

  renderOTDrawer();
  renderStaffTable();
}

async function deleteOTRecord(type, recordId) {
  if (!supabase) return;
  if (!confirm('确定删除该条记录？')) return;

  const table = type === 'overtime' ? 'overtime_records' : 'compensatory_leave_records';
  const { error } = await supabase.from(table).delete().eq('id', recordId);
  if (error) { showToast('删除失败：' + error.message); return; }

  showToast('已删除');

  // Update local cache
  if (type === 'overtime') {
    allOvertimeRecords = allOvertimeRecords.filter(r => r.id !== recordId);
  } else {
    allLeaveRecords = allLeaveRecords.filter(r => r.id !== recordId);
  }

  renderOTDrawer();
  renderStaffTable();
}

// ========== 账号本 ==========

let acctsUserId = null;

async function openAcctsModal(userId, nickname) {
  acctsUserId = userId;
  const s = allStaffData.find(x => x.id === userId);
  document.getElementById('accts-title').textContent = '📒 ' + nickname + ' - 账号本';
  document.getElementById('accts-textarea').value = (s && s.store_accounts) || '';
  document.getElementById('accts-overlay').classList.add('show');
  document.getElementById('accts-modal').classList.add('show');
  setTimeout(() => document.getElementById('accts-textarea').focus(), 150);
}

function closeAcctsModal() {
  document.getElementById('accts-overlay').classList.remove('show');
  document.getElementById('accts-modal').classList.remove('show');
  acctsUserId = null;
}

async function saveAccts() {
  if (!acctsUserId || !supabase) return;
  const content = document.getElementById('accts-textarea').value;
  const { error } = await supabase.from('profiles').update({ store_accounts: content || null }).eq('id', acctsUserId);
  if (error) { showToast('保存失败：' + error.message); return; }
  const idx = allStaffData.findIndex(s => s.id === acctsUserId);
  if (idx >= 0) allStaffData[idx].store_accounts = content;
  showToast('已保存');
}

function copyAccts() {
  const content = document.getElementById('accts-textarea').value;
  if (!content.trim()) { showToast('内容为空'); return; }
  navigator.clipboard.writeText(content).then(() => showToast('已复制到剪贴板'));
}

function filterStaff() {
  staffSearchTerm = document.getElementById('staff-search').value;
  renderStaffTable();
}

function startEditStaffField(td, userId, field, currentValue) {
  // Prevent duplicate edit
  if (td.querySelector('input')) return;

  const oldHtml = td.innerHTML;
  const isDate = field === 'hire_date';
  const inputType = isDate ? 'date' : 'text';
  const placeholder = isDate ? 'YYYY-MM-DD' : field === 'phone' ? '手机号' : '';

  const input = document.createElement('input');
  input.type = inputType;
  input.value = currentValue === '-' ? '' : currentValue;
  input.className = 'staff-input';
  input.style.cssText = 'padding:4px 8px;border:1.5px solid var(--primary);border-radius:6px;font-size:14px;width:100%;max-width:140px;font-family:inherit;background:var(--card-bg);color:var(--text);';
  if (placeholder) input.placeholder = placeholder;

  td.innerHTML = '';
  td.appendChild(input);
  input.focus();
  input.select();

  const save = async () => {
    const newVal = input.value.trim();
    const oldVal = currentValue === '-' ? '' : currentValue;
    if (newVal === oldVal) { td.innerHTML = oldHtml; return; }

    const payload = {};
    if (isDate) {
      payload[field] = newVal || null;
    } else {
      payload[field] = newVal || null;
    }

    const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
    if (error) {
      showToast('保存失败：' + error.message);
      td.innerHTML = oldHtml;
      return;
    }
    showToast('已更新');
    const idx = allStaffData.findIndex(s => s.id === userId);
    if (idx >= 0) {
      if (isDate) {
        allStaffData[idx][field] = newVal || null;
      } else {
        allStaffData[idx][field] = newVal || null;
      }
    }
    renderStaffTable();
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { td.innerHTML = oldHtml; }
  });
}

async function copyStaffRow(userId) {
  const s = allStaffData.find(x => x.id === userId);
  if (!s) { showToast('未找到该客服'); return; }
  const ot = getOTSummary(userId);
  const text = [
    '花名：' + (s.name || '-'),
    '真实姓名：' + (s.real_name || '-'),
    '手机号：' + (s.phone || '-'),
    '入职日期：' + (s.hire_date || '-'),
    '岗位：' + (s.position || '-'),
    '组别：' + (s.group_name || '未分组'),
    '累计加班：' + ot.totalOT + 'h',
    '已调休：' + ot.totalLV + 'h',
    '剩余可调：' + ot.remain + 'h'
  ].join('\n');
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板');
  } catch (e) {
    showToast('复制失败，请手动复制');
  }
}

function copyAllStaff() {
  const term = staffSearchTerm.toLowerCase();
  const filtered = term ? allStaffData.filter(s => {
    const name = (s.name || '').toLowerCase();
    const real = (s.real_name || '').toLowerCase();
    const phone = (s.phone || '').toLowerCase();
    return name.includes(term) || real.includes(term) || phone.includes(term);
  }) : allStaffData;

  const text = filtered.map(s => {
    const ot = getOTSummary(s.id);
    return [
      s.name || '-',
      s.real_name || '-',
      s.phone || '-',
      s.hire_date || '-',
      s.position || '-',
      s.group_name || '未分组',
      ot.totalOT + 'h',
      ot.totalLV + 'h',
      ot.remain + 'h'
    ].join('\t');
  }).join('\n');

  const header = '花名\t真实姓名\t手机号\t入职日期\t岗位\t组别\t累计加班(h)\t已调休(h)\t剩余可调(h)';
  const full = header + '\n' + text;

  try {
    navigator.clipboard.writeText(full).then(() => showToast('已复制 ' + filtered.length + ' 条记录'));
  } catch (e) {
    showToast('复制失败');
  }
}

function exportStaffCSV() {
  const term = staffSearchTerm.toLowerCase();
  const filtered = term ? allStaffData.filter(s => {
    const name = (s.name || '').toLowerCase();
    const real = (s.real_name || '').toLowerCase();
    const phone = (s.phone || '').toLowerCase();
    return name.includes(term) || real.includes(term) || phone.includes(term);
  }) : allStaffData;

  const header = '花名,真实姓名,手机号,入职日期,岗位,组别,累计加班(h),已调休(h),剩余可调(h)';
  const rows = filtered.map(s => {
    const ot = getOTSummary(s.id);
    return [
      '"' + (s.name || '') + '"',
      '"' + (s.real_name || '') + '"',
      '"' + (s.phone || '') + '"',
      '"' + (s.hire_date || '') + '"',
      '"' + (s.position || '') + '"',
      '"' + (s.group_name || '未分组') + '"',
      ot.totalOT,
      ot.totalLV,
      ot.remain
    ].join(',');
  });
  const csv = '\uFEFF' + header + '\n' + rows.join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '客服信息_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  showToast('已导出 ' + filtered.length + ' 条记录');
}

let staffSub = null;
function subscribeStaffInfo() {
  if (!supabase || staffSub) return;
  staffSub = supabase.channel('staff-info')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      if (currentPage === 'staff-info') loadStaffInfo();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'overtime_records' }, () => {
      if (currentPage === 'staff-info') loadStaffInfo();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'compensatory_leave_records' }, () => {
      if (currentPage === 'staff-info') loadStaffInfo();
    })
    .subscribe();
}
