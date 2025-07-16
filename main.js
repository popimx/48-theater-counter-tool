const GROUPS_URL = './src/data/groups.json';
const PERFORMANCE_URL = './src/data/performance.json?' + Date.now();

let groups = {};
let performances = [];

const GROUP_ALIAS = {
  'AKB48 卒業生': 'AKB48',
  'SKE48 卒業生': 'SKE48',
  'NMB48 卒業生': 'NMB48',
  'HKT48 卒業生': 'HKT48',
  'NGT48 卒業生': 'NGT48',
  'STU48 卒業生': 'STU48'
};

const groupSelect = document.getElementById('group-select');
const memberSelect = document.getElementById('member-select');
const output = document.getElementById('output');

function getTodayString() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function truncateStageName(stageName) {
  return stageName.length > 11 ? stageName.slice(0, 10) + '…' : stageName;
}

async function fetchGroups() {
  const res = await fetch(GROUPS_URL);
  if (!res.ok) throw new Error('groups.jsonの取得に失敗しました');
  groups = await res.json();
}

async function fetchPerformances() {
  const res = await fetch(PERFORMANCE_URL);
  if (!res.ok) throw new Error('performance.jsonの取得に失敗しました');
  const raw = await res.json();
  const timeOrder = { "": 0, "昼": 1, "夜": 2 };
  performances = raw.map(p => ({
    ...p,
    members: p.members.map(m => m.trim()),
    time: (p.time || "").trim()
  })).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (timeOrder[a.time] ?? 0) - (timeOrder[b.time] ?? 0);
  });
}

function setupGroupOptions() {
  Object.keys(groups).forEach(group => {
    const opt = document.createElement('option');
    opt.value = group;
    opt.textContent = group;
    groupSelect.appendChild(opt);
  });
}

function onGroupChange() {
  const selectedGroup = groupSelect.value;
  memberSelect.innerHTML = '<option value="">-- メンバーを選択 --</option>';
  memberSelect.disabled = !selectedGroup;
  output.innerHTML = '';
  if (!selectedGroup) return;

  const memberList = groups[selectedGroup] || [];
  memberList.forEach(member => {
    const opt = document.createElement('option');
    opt.value = member;
    opt.textContent = member;
    memberSelect.appendChild(opt);
  });
}

function createTableHTML(headers, rows) {
  return `
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
}

function sortRankingWithTies(arr, groupList = []) {
  arr.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const aIndex = groupList.indexOf(a.name);
    const bIndex = groupList.indexOf(b.name);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
  let lastCount = null, lastRank = 0;
  arr.forEach((item, i) => {
    if (item.count !== lastCount) {
      lastCount = item.count;
      lastRank = i + 1;
    }
    item.rank = lastRank;
  });
  return arr;
}

function onMemberChange() {
  const selectedGroup = groupSelect.value;
  const member = memberSelect.value;
  output.innerHTML = '';
  if (!selectedGroup || !member) return;

  let targetGroup = selectedGroup;
  if (selectedGroup.endsWith(' 卒業生')) {
    targetGroup = selectedGroup.replace(' 卒業生', '');
  }

  const combinedMembers = [
    ...(groups[targetGroup] || []),
    ...(groups[targetGroup + ' 卒業生'] || [])
  ];

  const todayStr = getTodayString();
  const relevantPerformances = performances.filter(p => p.stage.startsWith(targetGroup));
  const pastPerformances = relevantPerformances.filter(p => p.date <= todayStr);
  const futurePerformances = relevantPerformances.filter(p => p.date > todayStr);

  const timeOrder = { "": 0, "昼": 1, "夜": 2 };

  const memberPast = pastPerformances
    .filter(p => p.members.includes(member))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (timeOrder[a.time] ?? 0) - (timeOrder[b.time] ?? 0);
    }).map((p, i) => ({ ...p, count: i + 1 }));

  const totalCount = memberPast.length;

  const memberFuture = futurePerformances
    .filter(p => p.members.includes(member))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (timeOrder[a.time] ?? 0) - (timeOrder[b.time] ?? 0);
    });

  const nextMilestone = Math.ceil(totalCount / 100) * 100;
  const remaining = nextMilestone - totalCount;

  let milestoneFutureEvent = null;
  if (remaining > 0 && remaining <= 10) {
    let count = totalCount;
    for (const perf of memberFuture) {
      if (++count >= nextMilestone) {
        milestoneFutureEvent = perf;
        break;
      }
    }
  }

  const milestones = [];
  for (let m = 100; m <= totalCount; m += 100) {
    const perf = memberPast[m - 1];
    if (perf) {
      const stageName = truncateStageName(perf.stage.replace(targetGroup, '').trim());
      milestones.push({ date: perf.date, stage: stageName, milestone: m });
    }
  }
  const sortedMilestones = milestones.sort((a, b) => b.milestone - a.milestone);

  const historyRows = memberPast.slice().sort((a, b) => b.count - a.count)
    .map(p => [
      p.count,
      p.date,
      truncateStageName(p.stage.replace(targetGroup, '').trim()),
      p.time || ''
    ]);

  const futureRows = memberFuture.map((p, i) => [
    totalCount + i + 1,
    p.date,
    truncateStageName(p.stage.replace(targetGroup, '').trim()),
    p.time || ''
  ]);

  const stageCountMap = {};
  memberPast.forEach(p => {
    const stageName = p.stage.replace(targetGroup, '').trim();
    stageCountMap[stageName] = (stageCountMap[stageName] || 0) + 1;
  });
  const stageRows = Object.entries(stageCountMap)
    .sort((a, b) => b[1] - a[1])
    .map(([stage, count]) => [stage, `${count}回`]);

  const coCounts = {};
  memberPast.forEach(p => {
    p.members.forEach(m => {
      if (m === member) return;
      coCounts[m] = (coCounts[m] || 0) + 1;
    });
  });
  const coRanking = sortRankingWithTies(
    Object.entries(coCounts).map(([name, count]) => ({ name, count })),
    combinedMembers
  ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);

  const stagesSorted = Object.keys(stageCountMap).sort((a, b) => stageCountMap[b] - stageCountMap[a]);
  const stageRanking = {};
  stagesSorted.forEach(stage => {
    const counts = {};
    pastPerformances.filter(p => p.stage.replace(targetGroup, '').trim() === stage).forEach(p => {
      p.members.forEach(m => counts[m] = (counts[m] || 0) + 1);
    });
    stageRanking[stage] = sortRankingWithTies(
      Object.entries(counts).map(([name, count]) => ({ name, count })),
      combinedMembers
    ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);
  });

  const yearCounts = {};
  memberPast.forEach(p => {
    const y = p.date.slice(0, 4);
    yearCounts[y] = (yearCounts[y] || 0) + 1;
  });
  const yearRows = Object.entries(yearCounts)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, count]) => [`${year}年`, `${count}回`]);

  const yearRanking = {};
  Object.keys(yearCounts).forEach(year => {
    const counts = {};
    pastPerformances.filter(p => p.date.startsWith(year)).forEach(p => {
      p.members.forEach(m => counts[m] = (counts[m] || 0) + 1);
    });
    yearRanking[year] = sortRankingWithTies(
      Object.entries(counts).map(([name, count]) => ({ name, count })),
      combinedMembers
    ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);
  });

  let html = `<div class="highlight">総出演回数：${totalCount}回</div>`;

  if (remaining > 0 && remaining <= 10) {
    html += `<div style="font-size:1rem;color:#000;margin-top:-8px;margin-bottom:2px;">
      ${nextMilestone}回公演まであと${remaining}回
    </div>`;
    if (milestoneFutureEvent) {
      const dateObj = new Date(milestoneFutureEvent.date);
      const mm = dateObj.getMonth() + 1;
      const dd = dateObj.getDate();
      const dateStr = `${mm}月${dd}日`;
      const stageName = truncateStageName(milestoneFutureEvent.stage.replace(targetGroup, '').trim());
      html += `<div style="font-size:1rem;color:#000;margin-top:0;margin-bottom:8px;">
        ${dateStr}の ${stageName}公演 で達成予定
      </div>`;
    }
  }

  html += `<h3>出演履歴</h3>${createTableHTML(['回数', '日付', '演目', '時間'], historyRows)}`;
  if (futureRows.length > 0) {
    html += `<h3>今後の出演予定</h3>${createTableHTML(['回数', '日付', '演目', '時間'], futureRows)}`;
  }
  if (sortedMilestones.length > 0) {
    html += `<h3>節目達成日</h3>${createTableHTML(['節目', '日付', '演目'], sortedMilestones.map(m => [`${m.milestone}回`, m.date, m.stage]))}`;
  }
  html += `<h3>演目別出演回数</h3>${createTableHTML(['演目', '回数'], stageRows)}`;
  html += `<h3>演目別出演回数ランキング</h3>${
    stagesSorted.map(stage =>
      `<details><summary>${stage}</summary>${createTableHTML(['順位', '名前', '回数'], stageRanking[stage])}</details>`
    ).join('')}`;
  html += `<h3>年別出演回数</h3>${createTableHTML(['年', '回数'], yearRows)}`;
  html += `<h3>年別出演回数ランキング</h3>${
    Object.entries(yearRanking).sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, rows]) =>
        `<details><summary>${year}年</summary>${createTableHTML(['順位', '名前', '回数'], rows)}</details>`
      ).join('')
  }`;
  html += `<h3>共演回数ランキング</h3>${createTableHTML(['順位', '名前', '回数'], coRanking)}`;

  output.innerHTML = html;
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await fetchGroups();
    await fetchPerformances();
    setupGroupOptions();
    groupSelect.addEventListener('change', onGroupChange);
    memberSelect.addEventListener('change', onMemberChange);
  } catch (e) {
    output.innerHTML = `<p style="color:red;">読み込みエラー: ${e.message}</p>`;
    groupSelect.disabled = true;
    memberSelect.disabled = true;
  }
});