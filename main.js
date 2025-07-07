const GROUPS_URL = './src/data/groups.json';
const PERFORMANCE_URL = './src/data/performance.json';

let groups = {};
let performances = [];

const groupSelect = document.getElementById('group-select');
const memberSelect = document.getElementById('member-select');
const output = document.getElementById('output');

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, match =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[match]
  );
}

function sortRankingWithTies(arr, groupOrder = []) {
  arr.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const aIndex = groupOrder.indexOf(a.name);
    const bIndex = groupOrder.indexOf(b.name);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  let lastCount = null;
  let lastRank = 0;
  arr.forEach((item, i) => {
    if (item.count !== lastCount) {
      lastRank = i + 1;
      lastCount = item.count;
    }
    item.rank = lastRank;
  });
  return arr;
}

function createTable(headers, rows) {
  const ths = headers.map(h => `<th>${h}</th>`).join('');
  const trs = rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

async function fetchGroups() {
  const res = await fetch(GROUPS_URL + '?t=' + Date.now());
  if (!res.ok) throw new Error('groups.json の取得に失敗しました');
  groups = await res.json();
}

async function fetchPerformances() {
  const res = await fetch(PERFORMANCE_URL + '?t=' + Date.now());
  if (!res.ok) throw new Error('performance.json の取得に失敗しました');
  performances = await res.json();
}

function onGroupChange() {
  const selectedGroup = groupSelect.value;
  memberSelect.innerHTML = '<option value="">-- メンバーを選択 --</option>';
  memberSelect.disabled = !selectedGroup;
  output.innerHTML = '';
  if (!selectedGroup) return;

  groups[selectedGroup].forEach(member => {
    const opt = document.createElement('option');
    opt.value = member;
    opt.textContent = member;
    memberSelect.appendChild(opt);
  });
}

function onMemberChange() {
  const group = groupSelect.value;
  const member = memberSelect.value;
  if (!group || !member) return;
  output.innerHTML = '';

  const groupMembers = groups[group] || [];
  const today = new Date();
  const past = performances.filter(p => new Date(p.date) <= today);
  const future = performances.filter(p => new Date(p.date) > today);
  const memberPerformances = past.filter(p => p.members.includes(member));
  const totalCount = memberPerformances.length;

  // 出演履歴
  const historyRows = memberPerformances
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((p, i) => {
      const stageName = p.stage.startsWith(group) ? p.stage.replace(`${group} `, '') : p.stage;
      const time = p.time || '';
      return [ `${totalCount - i}回目`, p.date, stageName, time ];
    });

  // 節目
  const milestoneNum = Math.floor(totalCount / 100) * 100;
  let milestoneDate = '';
  if (milestoneNum > 0) {
    const target = memberPerformances[milestoneNum - 1];
    if (target) {
      milestoneDate = `${milestoneNum}回目は ${target.date} の「${target.stage}」${target.time || ''}`;
    }
  }

  let milestonePrediction = '';
  const mod = totalCount % 100;
  if (mod >= 90 && totalCount > 0) {
    const remain = 100 - mod;
    const fut = future.filter(p => p.members.includes(member));
    const target = fut[remain - 1];
    if (target) {
      milestonePrediction = `（${totalCount + remain}回目は ${target.date} の「${target.stage}」${target.time || ''} の予定）`;
    } else {
      milestonePrediction = `あと${remain}回で${totalCount + remain}回の節目達成！`;
    }
  }

  // 演目別出演回数（同グループのみ）
  const stageCounts = {};
  memberPerformances.forEach(p => {
    const stage = p.stage.startsWith(group) ? p.stage.replace(`${group} `, '') : null;
    if (stage) stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  });

  const stageRows = Object.entries(stageCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([stage, count]) => [stage, `${count}回`]);

  // 演目別ランキング（切り替え形式）
  const stageRankingSections = [];
  Object.keys(stageCounts).forEach(stage => {
    const members = {};
    past.filter(p => p.stage === `${group} ${stage}`).forEach(p => {
      p.members.forEach(m => members[m] = (members[m] || 0) + 1);
    });
    const arr = Object.entries(members).map(([m, c]) => ({ name: m, count: c }));
    const ranked = sortRankingWithTies(arr, groupMembers);
    const rows = ranked.map(r => [`${r.rank}位`, r.name, `${r.count}回`]);
    stageRankingSections.push(`
      <details><summary>${stage}</summary>
      ${createTable(['順位', '名前', '回数'], rows)}
      </details>
    `);
  });

  // 年別ランキング
  const years = new Set(memberPerformances.map(p => p.date.slice(0, 4)));
  const yearRankingSections = [];
  years.forEach(year => {
    const members = {};
    past.filter(p => p.date.startsWith(year) && p.stage.startsWith(group)).forEach(p => {
      p.members.forEach(m => members[m] = (members[m] || 0) + 1);
    });
    const arr = Object.entries(members).map(([m, c]) => ({ name: m, count: c }));
    const ranked = sortRankingWithTies(arr, groupMembers);
    const rows = ranked.map(r => [`${r.rank}位`, r.name, `${r.count}回`]);
    yearRankingSections.push(`
      <details><summary>${year}年</summary>
      ${createTable(['順位', '名前', '回数'], rows)}
      </details>
    `);
  });

  // 共演ランキング
  const co = {};
  memberPerformances.forEach(p => {
    p.members.forEach(m => {
      if (m !== member) co[m] = (co[m] || 0) + 1;
    });
  });
  const coRanked = sortRankingWithTies(Object.entries(co).map(([m, c]) => ({ name: m, count: c })), groupMembers);
  const coRows = coRanked.map(r => [`${r.rank}位`, r.name, `${r.count}回`]);

  // 出力
  output.innerHTML = `
    <div class="highlight">総出演回数: ${totalCount}回</div>
    ${milestoneDate ? `<div>節目達成日: ${milestoneDate}</div>` : ''}
    ${milestonePrediction ? `<div>節目予測: ${milestonePrediction}</div>` : ''}
    <h3>出演履歴</h3>
    ${createTable(['回数', '日付', '演目', '時間'], historyRows)}
    <h3>演目別出演回数</h3>
    ${createTable(['演目', '回数'], stageRows)}
    <h3>演目別出演回数ランキング</h3>
    ${stageRankingSections.join('')}
    <h3>年別出演回数ランキング</h3>
    ${yearRankingSections.join('')}
    <h3>共演回数ランキング</h3>
    ${createTable(['順位', '名前', '回数'], coRows)}
  `;
}

async function init() {
  try {
    await fetchGroups();
    await fetchPerformances();
    Object.keys(groups).forEach(group => {
      const opt = document.createElement('option');
      opt.value = group;
      opt.textContent = group;
      groupSelect.appendChild(opt);
    });
    groupSelect.addEventListener('change', onGroupChange);
    memberSelect.addEventListener('change', onMemberChange);
  } catch (e) {
    output.innerHTML = `<p style="color:red;">読み込み失敗: ${e.message}</p>`;
    groupSelect.disabled = true;
    memberSelect.disabled = true;
  }
}

window.addEventListener('DOMContentLoaded', init);