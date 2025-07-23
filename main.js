const GROUPS_URL = './src/data/groups.json';
const FILES_URL = './src/data/performance_files.json';

let groups = {};
let performanceFiles = {};
let performances = [];
let loadedGroup = '';

const groupSelect = document.getElementById('group-select');
const memberSelect = document.getElementById('member-select');
const output = document.getElementById('output');

function getTodayString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function truncateStageName(name) {
  return name.length > 11 ? name.slice(0, 10) + '…' : name;
}

function truncateStageNameLong(name) {
  return name.length > 20 ? name.slice(0, 19) + '…' : name;
}

async function fetchGroups() {
  const res = await fetch(GROUPS_URL);
  if (!res.ok) throw new Error('groups.jsonの取得に失敗しました');
  groups = await res.json();
}

async function fetchPerformanceFiles() {
  const res = await fetch(FILES_URL);
  if (!res.ok) throw new Error('performance_files.jsonの取得に失敗しました');
  performanceFiles = await res.json();
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
  const group = groupSelect.value;
  memberSelect.innerHTML = '<option value="">-- メンバーを選択 --</option>';
  memberSelect.disabled = !group;
  output.innerHTML = '';

  if (!group) return;

  const members = groups[group] || [];
  members.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    memberSelect.appendChild(opt);
  });

  output.innerHTML = '<p style="margin:10px 0;">データを読み込み中…</p>';
  loadGroupPerformances(group).then(() => {
    output.innerHTML = '';
  }).catch(e => {
    output.innerHTML = `<p style="color:red;">データ読み込みエラー: ${e.message}</p>`;
  });
}

async function loadGroupPerformances(group) {
  if (loadedGroup === group) return;

  const groupKey = group.replace(' 卒業生', '');
  const relatedFiles = [
    ...(performanceFiles[groupKey] || []),
    ...(group.endsWith('卒業生') ? [] : (performanceFiles[group + ' 卒業生'] || []))
  ];

  const fetchedPerformances = [];

  for (const file of relatedFiles) {
    try {
      const res = await fetch(`./src/data/${file}`);
      if (res.ok) {
        const json = await res.json();
        json.forEach((p, idx) => {
          fetchedPerformances.push({
            ...p,
            index: idx,
            members: p.members.map(m => m.trim()),
            time: (p.time || '').trim()
          });
        });
      }
    } catch (e) {
      console.warn(`${file} の読み込みに失敗:`, e);
    }
  }

  performances = fetchedPerformances;
  loadedGroup = group;
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

function sortByDateDescendingWithIndex(a, b) {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return b.index - a.index;
}

function sortByDateAscendingWithIndex(a, b) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return a.index - b.index;
}

function createTableHTML(headers, rows) {
  return `
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
}

function onMemberChange() {
  const selectedGroup = groupSelect.value;
  const member = memberSelect.value;
  output.innerHTML = '';
  if (!selectedGroup || !member) return;

  const targetGroup = selectedGroup.replace(' 卒業生', '');
  const todayStr = getTodayString();

  const combinedMembers = [
    ...(groups[targetGroup] || []),
    ...(groups[targetGroup + ' 卒業生'] || [])
  ];

  const relevantPerformances = performances.filter(p => p.stage.startsWith(targetGroup));
  const past = relevantPerformances.filter(p => p.date <= todayStr);
  const future = relevantPerformances.filter(p => p.date > todayStr);

  const memberPast = past.filter(p => p.members.includes(member)).sort(sortByDateAscendingWithIndex);
  const totalCount = memberPast.length;

  const memberFuture = future.filter(p => p.members.includes(member)).sort(sortByDateAscendingWithIndex);

  const nextMilestone = Math.ceil(totalCount / 100) * 100;
  const remaining = nextMilestone - totalCount;

  let milestoneEvent = null;
  if (remaining > 0 && remaining <= 10) {
    let count = totalCount;
    for (const p of memberFuture) {
      count++;
      if (count >= nextMilestone) {
        milestoneEvent = p;
        break;
      }
    }
  }

  const milestones = [];
  for (let i = 100; i <= totalCount; i += 100) {
    const perf = memberPast[i - 1];
    if (perf) {
      milestones.push({
        milestone: i,
        date: perf.date,
        stage: truncateStageName(perf.stage.replace(targetGroup, '').trim())
      });
    }
  }

  const historyRows = memberPast.slice().reverse().map((p, i) => [
    totalCount - i,
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

  const stageCounts = {};
  memberPast.forEach(p => {
    const s = p.stage.replace(targetGroup, '').trim();
    stageCounts[s] = (stageCounts[s] || 0) + 1;
  });

  const stageRows = Object.entries(stageCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => [truncateStageNameLong(name), `${count}回`]);

  const stageRankings = Object.keys(stageCounts).sort((a, b) => stageCounts[b] - stageCounts[a]).map(stage => {
    const members = {};
    past.filter(p => p.stage.replace(targetGroup, '').trim() === stage)
        .forEach(p => p.members.forEach(m => members[m] = (members[m] || 0) + 1));
    return `
      <details><summary>${stage}</summary>
      ${createTableHTML(['順位', '名前', '回数'], sortRankingWithTies(
        Object.entries(members).map(([name, count]) => ({ name, count })),
        combinedMembers
      ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]))}</details>`;
  }).join('');

  const yearCounts = {};
  memberPast.forEach(p => {
    const y = p.date.slice(0, 4);
    yearCounts[y] = (yearCounts[y] || 0) + 1;
  });

  const yearRows = Object.entries(yearCounts)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([y, c]) => [`${y}年`, `${c}回`]);

  const yearRankings = Object.fromEntries(
    Object.keys(yearCounts).map(year => {
      const counts = {};
      past.filter(p => p.date.startsWith(year)).forEach(p => {
        p.members.forEach(m => counts[m] = (counts[m] || 0) + 1);
      });
      return [year, sortRankingWithTies(
        Object.entries(counts).map(([name, count]) => ({ name, count })),
        combinedMembers
      ).map(p => [`${p.rank}位`, p.name, `${p.count}回`])];
    })
  );

  const coCounts = {};
  memberPast.forEach(p => {
    p.members.forEach(m => {
      if (m !== member) coCounts[m] = (coCounts[m] || 0) + 1;
    });
  });

  const coRanking = sortRankingWithTies(
    Object.entries(coCounts).map(([name, count]) => ({ name, count })),
    combinedMembers
  ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);

  const coHistories = coRanking.map(([rank, name, count]) => {
    const perf = memberPast.filter(p => p.members.includes(name)).sort(sortByDateDescendingWithIndex);
    const rows = perf.map((p, i) => [
      parseInt(count) - i,
      p.date,
      truncateStageName(p.stage.replace(targetGroup, '').trim()),
      p.time || ''
    ]);
    return `<details><summary>${name}</summary>${createTableHTML(['回数', '日付', '演目', '時間'], rows)}</details>`;
  }).join('');

  let html = `<div class="highlight">総出演回数：${totalCount}回</div>`;

  if (remaining > 0 && remaining <= 10 && milestoneEvent) {
    const d = new Date(milestoneEvent.date);
    html += `<div style="font-size:1rem;color:#000;margin-top:-8px;margin-bottom:8px;">
      ${nextMilestone}回公演まであと${remaining}回<br>${d.getMonth() + 1}月${d.getDate()}の ${truncateStageName(milestoneEvent.stage.replace(targetGroup, '').trim())}公演 で達成予定
    </div>`;
  }

  html += `<h3>出演履歴</h3>${createTableHTML(['回数', '日付', '演目', '時間'], historyRows)}`;
  if (futureRows.length > 0) {
    html += `<h3>今後の出演予定</h3>${createTableHTML(['回数', '日付', '演目', '時間'], futureRows)}`;
  }
  if (milestones.length > 0) {
    html += `<h3>節目達成日</h3>${createTableHTML(['節目', '日付', '演目'], milestones.map(m => [`${m.milestone}回`, m.date, m.stage]))}`;
  }

  html += `<h3>演目別出演回数</h3>${createTableHTML(['演目', '回数'], stageRows)}`;
  html += `<h3>演目別出演回数ランキング</h3>${stageRankings}`;
  html += `<h3>年別出演回数</h3>${createTableHTML(['年', '回数'], yearRows)}`;
  html += `<h3>年別出演回数ランキング</h3>${
    Object.entries(yearRankings).map(([y, rows]) =>
      `<details><summary>${y}年</summary>${createTableHTML(['順位', '名前', '回数'], rows)}</details>`
    ).join('')
  }`;
  html += `<h3>共演回数ランキング</h3>${createTableHTML(['順位', '名前', '回数'], coRanking)}`;
  html += `<h3>共演履歴</h3>${coHistories}`;

  output.innerHTML = html;
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await fetchGroups();
    await fetchPerformanceFiles();
    setupGroupOptions();
    groupSelect.addEventListener('change', onGroupChange);
    memberSelect.addEventListener('change', onMemberChange);
  } catch (e) {
    output.innerHTML = `<p style="color:red;">初期読み込みエラー: ${e.message}</p>`;
    groupSelect.disabled = true;
    memberSelect.disabled = true;
  }
});