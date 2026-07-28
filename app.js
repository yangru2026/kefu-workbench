// ==================== SUPABASE REALTIME FEATURES ====================
// 公告栏 / 登录注册 / 日报 / 售前数据 / 客服排名(实时)

// Called when supabase is initialized
window.onSupabaseReady = function() {
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

// ---------- 日报 ----------
let dailyReports = [];
let dailySub = null;
const DEFAULT_SHOPS = ['TM-弥生','KS-弥生','TM-极氧','DY弥生官方','TM-护眼','XHS-弥生','DY-YOUHOO','DY-极氧','JD-弥生','XHS-极氧','有赞-拼多多'];

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
  const shops = savedShops && savedShops.length ? savedShops : DEFAULT_SHOPS.map(name => ({ name, visitors: '', inquiries: '', payments: '', target: '' }));

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
      <td><input type="text" class="daily-shop-name" value="${escapeHtml(s.name)}" style="width:100px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--card-bg);color:var(--text);" placeholder="店铺名"></td>
      <td><input type="number" class="daily-shop-visitors" value="${s.visitors || ''}" style="width:80px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;" placeholder="0" oninput="updateDailyTotal()"></td>
      <td><input type="number" class="daily-shop-inquiries" value="${s.inquiries || ''}" style="width:80px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;" placeholder="0" oninput="calculateDailyRow(this)"></td>
      <td><input type="number" class="daily-shop-payments" value="${s.payments || ''}" style="width:80px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;" placeholder="0" oninput="calculateDailyRow(this)"></td>
      <td class="daily-shop-conversion" style="text-align:center;font-weight:600;color:var(--primary);">-</td>
      <td><input type="number" class="daily-shop-target" value="${s.target || ''}" style="width:70px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;" placeholder="%" oninput="calculateDailyRow(this)"></td>
      <td class="daily-shop-need" style="text-align:center;font-weight:600;">-</td>
    </tr>
  `).join('');
  // Calculate all rows
  setTimeout(() => {
    tbody.querySelectorAll('tr').forEach(row => calculateDailyRow(row.querySelector('.daily-shop-inquiries')));
  }, 0);
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
  renderDailyList();
}

async function submitDaily() {
  if (!currentUser) return;
  const today = new Date().toISOString().slice(0, 10);
  const tbody = document.getElementById('daily-shop-tbody');
  const shops = [];
  tbody.querySelectorAll('tr').forEach(row => {
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
    closeDailyForm();
    loadDailyReports();
  }
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
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-secondary);">暂无成员</td></tr>';
    return;
  }
  const roleMap = { admin: '管理员', leader: '组长', staff: '员工' };
  const isAdmin = currentProfile?.role === 'admin';
  tbody.innerHTML = members.map(m => {
    const date = m.created_at ? new Date(m.created_at).toLocaleDateString('zh-CN') : '-';
    const phone = m.phone || '-';
    return `<tr>
      <td>${escapeHtml(m.name || '未命名')}</td>
      <td>${escapeHtml(phone)}</td>
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

async function updateMemberRole(userId, newRole) {
  if (!supabase) return;
  const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
  if (error) { showToast('更新失败：' + error.message); return; }
  showToast('角色已更新');
  loadMembers();
}
