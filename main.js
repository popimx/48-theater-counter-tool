const GROUPS_URL = './src/data/groups.json';

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

function truncateStageNameLong(name) {
  return name.length > 20 ? name.slice(0, 19) + '…' : name;
}

// groups.json を読み込む
async function fetchGroups() {
  const res = await fetch(GROUPS_URL);
  if (!res.ok) throw new Error('groups.jsonの取得に失敗しました');
  groups = await res.json();
}

// 選ばれたグループ + 各年のperformanceファイルを読み込む
async function fetchPerformancesForGroup(group) {
  const years = Array.from({ length: new Date().getFullYear() - 2020 + 2 }, (_, i) => 2020 + i);
  const targetGroup = group.replace(' 卒業生', '');
  performances = [];

  for (const year of years) {
    const path = `./src/data/${targetGroup}/${year}.json`;
    try {
      const res = await fetch(path + '?' + Date.now());
      if (res.ok) {
        const raw = await res.json();
        performances.push(
          ...raw.map((p, index) => ({
            ...p,
            index,
            members: p.members.map(m => m.trim()),
            time: (p.time || "").trim()
          }))
        );
      }
    } catch {
      // ファイルがなければスキップ
    }
  }
}

// グループ選択のオプション生成
function setupGroupOptions() {
  Object.keys(groups).forEach(group => {
    const opt = document.createElement('option');
    opt.value = group;
    opt.textContent = group;
    groupSelect.appendChild(opt);
  });
}

// グループ選択時に memberSelect をリセット＆performances再ロード
async function onGroupChange() {
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

  await fetchPerformancesForGroup(selectedGroup);
}

function createTableHTML(headers, rows) {
  return `
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
}

function sortRankingWithTies(arr, groupList = []) {
  arr.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const ai = groupList.indexOf(a.name);
    const bi = groupList.indexOf(b.name);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
  let lastCount = null, lastRank = 0;
  arr.forEach((it, i) => {
    if (it.count !== lastCount) {
      lastCount = it.count;
      lastRank = i + 1;
    }
    it.rank = lastRank;
  });
  return arr;
}

function sortByDateDescendingWithIndex(a, b) {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return b.index - a.index;
}
function sortByDateAscendingWithIndex(a, b) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return a.index - b.index;
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
  const relevant = performances.filter(p => p.stage.startsWith(targetGroup));
  const past = relevant.filter(p => p.date <= todayStr);
  const future = relevant.filter(p => p.date > todayStr);

  const memberPast = past
    .filter(p => p.members.includes(member))
    .sort(sortByDateAscendingWithIndex)
    .map((p, i) => ({ ...p, count: i + 1 }));
  const totalCount = memberPast.length;

  const memberFuture = future
    .filter(p => p.members.includes(member))
    .sort(sortByDateAscendingWithIndex);

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

  const historyRows = memberPast.slice().sort(sortByDateDescendingWithIndex)
    .map(p => [p.count, p.date, truncateStageName(p.stage.replace(targetGroup, '').trim()), p.time || '']);

  const futureRows = memberFuture.map((p, i) => [totalCount + i + 1, p.date, truncateStageName(p.stage.replace(targetGroup, '').trim()), p.time || '']);

  const stageCountMap = {};
  memberPast.forEach(p => {
    const stageName = p.stage.replace(targetGroup, '').trim();
    stageCountMap[stageName] = (stageCountMap[stageName] || 0) + 1;
  });
  const stageRows = Object.entries(stageCountMap)
    .sort((a, b) => b[1] - a[1])
    .map(([stage, cnt]) => [truncateStageNameLong(stage), `${cnt}回`]);

  const coCounts = {};
  memberPast.forEach(p => {
    p.members.forEach(m => {
      if (m === member) return;
      coCounts[m] = (coCounts[m] || 0) + 1;
    });
  });
  const coRanking = sortRankingWithTies(
    Object.entries(coCounts).map(([name, cnt]) => ({ name, count: cnt })),
    combinedMembers
  ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);
  const coHistoryHtml = coRanking.map(([rankStr, coMember, countStr]) => {
    const cnt = parseInt(countStr);
    const perfList = memberPast
      .filter(p => p.members.includes(coMember))
      .sort(sortByDateDescendingWithIndex);
    const rows = perfList.map((p, i) => [cnt - i, p.date, truncateStageName(p.stage.replace(targetGroup, '').trim()), p.time || '']);
    return `<details><summary>${coMember}</summary>${createTableHTML(['回数','日付','演目','時間'], rows)}</details>`;
  }).join('');

  const yearCounts = {};
  memberPast.forEach(p => {
    const y = p.date.slice(0,4);
    yearCounts[y] = (yearCounts[y] || 0) + 1;
  });
  const yearRows = Object.entries(yearCounts)
    .sort((a,b) => b[0].localeCompare(a[0]))
    .map(([y,c]) => [`${y}年`, `${c}回`]);
  const yearRanking = {};
  Object.keys(yearCounts).forEach(year => {
    const counts = {};
    past.filter(p => p.date.startsWith(year)).forEach(perf => {
      perf.members.forEach(m => counts[m] = (counts[m]||0) + 1);
    });
    yearRanking[year] = sortRankingWithTies(
      Object.entries(counts).map(([name,c]) => ({ name, count: c })),
      combinedMembers
    ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);
  });

  let html = `<div class="highlight">総出演回数：${totalCount}回</div>`;
  if (remaining > 0 && remaining <= 10) {
    html += `<div style="font-size:1rem;color:#000;margin-top:-8px;margin-bottom:2px;">
      ${nextMilestone}回公演まであと${remaining}回
    </div>`;
    if (milestoneFutureEvent) {
      const d = new Date(milestoneFutureEvent.date);
      const dateStr = `${d.getMonth()+1}月${d.getDate()}日`;
      const stageName = truncateStageName(milestoneFutureEvent.stage.replace(targetGroup, '').trim());
      html += `<div style="font-size:1rem;color:#000;margin:0 0 8px;">
        ${dateStr}の ${stageName}公演 で達成予定
      </div>`;
    }
  }

  html += `<h3>出演履歴</h3>${createTableHTML(['回数','日付','演目','時間'], historyRows)}`;
  if (futureRows.length) {
    html += `<h3>今後の出演予定</h3>${createTableHTML(['回数','日付','演目','時間'], futureRows)}`;
  }
  if (sortedMilestones.length) {
    html += `<h3>節目達成日</h3>${createTableHTML(['節目','日付','演目'], sortedMilestones.map(m => [`${m.milestone}回`, m.date, m.stage]))}`;
  }
  html += `<h3>演目別出演回数</h3>${createTableHTML(['演目','回数'], stageRows)}`;
  html += `<h3>共演回数ランキング</h3>${createTableHTML(['順位','名前','回数'], coRanking)}`;
  html += `<h3>共演履歴</h3>${coHistoryHtml}`;
  html += `<h3>年別出演回数</h3>${createTableHTML(['年','回数'], yearRows)}`;
  html += `<h3>年別出演ランキング</h3>${
    Object.entries(yearRanking).sort((a,b)=> b[0].localeCompare(a[0]))
    .map(([year, rows])=>`<details><summary>${year}年</summary>${createTableHTML(['順位','名前','回数'], rows)}</details>`).join('')
  }`;

  output.innerHTML = html;
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await fetchGroups();
    setupGroupOptions();
    groupSelect.addEventListener('change', onGroupChange);
    memberSelect.addEventListener('change', onMemberChange);
  } catch (e) {
    output.innerHTML = `<p style="color:red;">読み込みエラー: ${e.message}</p>`;
    groupSelect.disabled = true;
    memberSelect.disabled = true;
  }
});