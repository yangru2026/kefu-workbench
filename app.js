// ==================== SUPABASE REALTIME FEATURES ====================
// 公告栏 / 登录注册 / 日报 / 售前数据 / 客服排名(实时)

// Called when supabase is initialized
window.onSupabaseReady = function() {
  loadTemplates(); // 预加载模板数据
  if (currentPage === 'home') { loadAnnouncements(); subscribeAnnouncements(); }
  if (currentPage === 'daily') { loadDailyReports(); subscribeDaily(); }
  if (currentPage === 'presale') { loadPresaleData(); subscribePresale(); }
};

// ---------- 公告栏 ----------
let announcements = [];
let annSub = null;

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
  const emptyEl = document.getElementById('daily-empty');
  const myArea = document.getElementById('daily-my-area');
  const myList = document.getElementById('daily-my-list');
  if (!emptyEl) return;
  if (dailyReports.length === 0) {
    emptyEl.style.display = '';
    myArea.style.display = 'none';
    return;
  }
  emptyEl.style.display = 'none';
  myArea.style.display = '';
  myList.innerHTML = dailyReports.map(r => renderDailyReportCard(r)).join('');
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
      ${c.analysis ? `<div style="margin-top:10px;font-size:13px;color:var(--text-secondary);padding:8px;background:#f9f9ff;border-radius:8px;"><strong>未成交分析：</strong>${escapeHtml(c.analysis)}</div>` : ''}
      ${c.followUp ? `<div style="margin-top:6px;font-size:13px;color:var(--text-secondary);padding:8px;background:#f0fff4;border-radius:8px;"><strong>催付情况：</strong>${escapeHtml(c.followUp)}</div>` : ''}
      ${c.feedback ? `<div style="margin-top:6px;font-size:13px;color:var(--text-secondary);padding:8px;background:#fff8f0;border-radius:8px;"><strong>客户反馈：</strong>${escapeHtml(c.feedback)}</div>` : ''}
    </div>
  `;
}

function openDailyForm() {
  if (!currentUser) { showToast('请先登录'); switchPage('login'); return; }
  document.getElementById('daily-form-area').style.display = '';
  document.getElementById('daily-track-area').style.display = 'none';
  document.getElementById('daily-empty').style.display = 'none';
  document.getElementById('daily-my-area').style.display = 'none';
  document.getElementById('daily-date-label').textContent = new Date().toLocaleDateString('zh-CN');

  const today = new Date().toISOString().slice(0, 10);
  const existing = dailyReports.find(r => r.report_date === today);
  const savedShops = existing?.content?.shops;

  // 用历史记录 → 或用该组的模板 → 或空白行
  let shops;
  if (savedShops && savedShops.length) {
    shops = savedShops.map(s => ({
      name: s.name || s, // 兼容旧格式（字符串）
      visitors: s.visitors || '',
      inquiries: s.inquiries || '',
      payments: s.payments || '',
      target: s.target || DEFAULT_TARGET
    }));
  } else {
    const group = currentProfile?.group_name;
    const tpl = getShopTemplate(group);
    shops = tpl.shops.map(s => ({
      name: s.name || s,
      visitors: '', inquiries: '', payments: '',
      target: s.target || DEFAULT_TARGET
    }));
  }

  renderDailyShopInputs(shops);
  document.getElementById('daily-analysis').value = existing?.content?.analysis || '';
  document.getElementById('daily-followup').value = existing?.content?.followUp || '';
  document.getElementById('daily-feedback').value = existing?.content?.feedback || '';
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
  renderDailyList();
}

function renderDailyResult(content) {
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
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:left;">${escapeHtml(s.name)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:center;">${visitors || '-'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:center;">${inquiries || '-'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:center;">${payments || '-'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:center;font-weight:700;${hit ? 'color:#16a34a' : 'color:#dc2626'}">${conv}%${target>0 ? ' <span style="font-size:11px;font-weight:400;color:#999;">/ '+target+'%</span>' : ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:center;font-weight:700;${need !== null && need > 0 ? 'color:#dc2626' : 'color:#16a34a'}">${need !== null ? (need > 0 ? '差'+need : '✓') : '-'}</td>
      </tr>`;
  }).join('');

  const today = new Date();
  const weekDay = ['周日','周一','周二','周三','周四','周五','周六'][today.getDay()];
  const dateStr = today.getFullYear() + '.' + (today.getMonth()+1) + '.' + today.getDate();

  const resultDiv = document.getElementById('daily-result-area');
  resultDiv.innerHTML = `
    <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:16px;padding:24px 20px;box-shadow:0 2px 12px rgba(0,0,0,0.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;line-height:1.5;">
      <!-- 头部 -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <div style="font-size:13px;color:#888;">${dateStr} ${weekDay}</div>
          <div style="font-size:15px;font-weight:600;color:#333;">${escapeHtml(currentProfile?.name || '')} · ${escapeHtml(currentProfile?.group_name || '')}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;color:#888;">总接待量</div>
          <div style="font-size:32px;font-weight:800;color:#2563eb;line-height:1;">${totalV}</div>
        </div>
      </div>
      <!-- 表格 -->
      <div style="overflow-x:auto;">
        <div style="display:flex;justify-content:center;gap:20px;margin-bottom:10px;font-size:12px;">
          <span style="padding:2px 8px;border-radius:10px;background:#dcfce7;color:#16a34a;">✅ 接待量 = 当日数据</span>
          <span style="padding:2px 8px;border-radius:10px;background:#fef3c7;color:#d97706;">⏳ 询单·支付·转化率 = 3天前数据</span>
        </div>
        <table style="width:100%;border-collapse:collapse;min-width:500px;">
          <thead>
            <tr style="background:#f0f4ff;">
              <th style="padding:8px;font-size:13px;text-align:left;border-bottom:2px solid #d0d7ff;">店铺</th>
              <th style="padding:8px;font-size:13px;text-align:center;border-bottom:2px solid #d0d7ff;color:#16a34a;">接待</th>
              <th style="padding:8px;font-size:13px;text-align:center;border-bottom:2px solid #d0d7ff;">询单<span style="font-size:10px;color:#999;display:block;">延3天</span></th>
              <th style="padding:8px;font-size:13px;text-align:center;border-bottom:2px solid #d0d7ff;">支付<span style="font-size:10px;color:#999;display:block;">延3天</span></th>
              <th style="padding:8px;font-size:13px;text-align:center;border-bottom:2px solid #d0d7ff;">达成 / 目标<span style="font-size:10px;color:#999;display:block;">延3天</span></th>
              <th style="padding:8px;font-size:13px;text-align:center;border-bottom:2px solid #d0d7ff;">还差</th>
            </tr>
          </thead>
          <tbody>${shopRows}</tbody>
        </table>
      </div>
      <!-- 汇总 -->
      <div style="display:flex;justify-content:space-around;margin-top:14px;padding:10px 0;border-top:1px solid #eee;border-bottom:1px solid #eee;text-align:center;">
        <div><div style="font-size:11px;color:#888;">总询单</div><div style="font-size:20px;font-weight:700;color:#333;">${totalI}</div></div>
        <div><div style="font-size:11px;color:#888;">总支付</div><div style="font-size:20px;font-weight:700;color:#333;">${totalP}</div></div>
        <div><div style="font-size:11px;color:#888;">总转化率</div><div style="font-size:20px;font-weight:700;color:#2563eb;">${totalI>0 ? (totalP/totalI*100).toFixed(1) : '--'}%</div></div>
        <div><div style="font-size:11px;color:#888;">总还差</div><div style="font-size:20px;font-weight:700;color:${shops.some(s => {const i=parseInt(s.inquiries)||0;const p=parseInt(s.payments)||0;const t=parseFloat(s.target)||0;return t>0&&i>0&&Math.ceil(i*t/100-p)>0;})?'#dc2626':'#16a34a'}">${shops.reduce((sum,s)=>{
          const i=parseInt(s.inquiries)||0,p=parseInt(s.payments)||0,t=parseFloat(s.target)||0;
          return t>0&&i>0 ? sum+Math.max(0,Math.ceil(i*t/100-p)) : sum;
        },0)||'--'}</div></div>
      </div>
      ${content.analysis ? `<div style="margin-top:12px;font-size:12px;color:#666;background:#fff7ed;padding:8px 10px;border-radius:8px;border-left:3px solid #f59e0b;"><strong style="color:#d97706;">未成交分析：</strong>${escapeHtml(content.analysis)}</div>` : ''}
      ${content.followUp ? `<div style="margin-top:8px;font-size:12px;color:#666;background:#f0fdf4;padding:8px 10px;border-radius:8px;border-left:3px solid #22c55e;"><strong style="color:#16a34a;">催付：</strong>${escapeHtml(content.followUp)}</div>` : ''}
      ${content.feedback ? `<div style="margin-top:8px;font-size:12px;color:#666;background:#eff6ff;padding:8px 10px;border-radius:8px;border-left:3px solid #3b82f6;"><strong style="color:#2563eb;">反馈：</strong>${escapeHtml(content.feedback)}</div>` : ''}
      <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;">
        <button onclick="closeDailyForm()" style="padding:8px 20px;border-radius:8px;border:1px solid #d0d7ff;background:#fff;color:#666;font-size:14px;cursor:pointer;">返回</button>
        <button onclick="copyDailyResult()" style="padding:8px 20px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:14px;cursor:pointer;">📋 复制文本</button>
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
  const area = document.getElementById('daily-result-area');
  if (!area) return;
  const text = area.innerText;
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板');
  }).catch(() => {
    showToast('复制失败，请手动截图');
  });
}

async function renderDailyTrack() {
  if (!supabase) return;
  document.getElementById('daily-form-area').style.display = 'none';
  document.getElementById('daily-track-area').style.display = '';
  document.getElementById('daily-empty').style.display = 'none';
  document.getElementById('daily-my-area').style.display = 'none';
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('daily-track-date').textContent = today;

  const [{ data: profiles }, { data: reports }] = await Promise.all([
    supabase.from('profiles').select('id,name,group_name').order('name'),
    supabase.from('daily_reports').select('*').eq('report_date', today)
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

  list.innerHTML = profiles.map(p => {
    const hasReport = !!reportMap[p.id];
    const statusClass = hasReport ? 'done' : 'pending';
    const statusText = hasReport ? '✅ 已提交' : '⏳ 未提交';
    return `
      <div class="daily-track-item" style="cursor:pointer;" onclick="showDailyDetail('${p.id}', '${escapeHtml(p.name || '')}')">
        <div class="daily-track-avatar">${(p.name || '?').charAt(0)}</div>
        <div class="daily-track-info">
          <div class="daily-track-name">${p.name || '未命名'} ${p.group_name ? `<span style="font-size:11px;color:var(--text-secondary);">(${p.group_name})</span>` : ''}</div>
          <div class="daily-track-status ${statusClass}">${statusText}</div>
        </div>
      </div>
    `;
  }).join('');
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
      if (currentPage === 'daily') loadDailyReports();
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
  if (page === 'members' && supabase) { loadMembers(); }
  if (page === 'templates' && supabase) { loadTemplates().then(() => renderTemplates()); }
};

// ---------- 成员管理 ----------
async function loadMembers() {
  if (!supabase) {
    document.getElementById('members-tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-secondary);">Supabase 未初始化</td></tr>';
    return;
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      document.getElementById('members-tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--danger);">加载失败：' + escapeHtml(error.message) + '</td></tr>';
      return;
    }
    renderMembers(data || []);
  } catch (e) {
    document.getElementById('members-tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--danger);">加载异常</td></tr>';
  }
}

function renderMembers(members) {
  const tbody = document.getElementById('members-tbody');
  if (!members.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-secondary);">暂无成员</td></tr>';
    return;
  }
  const roleMap = { admin: '管理员', leader: '组长', staff: '员工' };
  const groupMap = { 'A组': '🔵 A组', 'B组': '🟠 B组', 'C组': '🟢 C组' };
  const isAdmin = currentProfile?.role === 'admin';
  tbody.innerHTML = members.map(m => {
    const date = m.created_at ? new Date(m.created_at).toLocaleDateString('zh-CN') : '-';
    const phone = m.phone || '-';
    return `<tr>
      <td>${escapeHtml(m.name || '未命名')}</td>
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
