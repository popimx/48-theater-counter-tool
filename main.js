const GROUPS_URL = './src/data/groups.json';
const PERFORMANCE_URL = './src/data/performance.json';

let groups = {};
let performances = [];

// 🔽 グループの別名対応マップを追加（AKB48 卒業生 → AKB48 に統一）
const GROUP_ALIAS = {
  'AKB48 卒業生': 'AKB48'
};

const groupSelect = document.getElementById('group-select');
const memberSelect = document.getElementById('member-select');
const output = document.getElementById('output');

async function fetchGroups() {
  const res = await fetch(GROUPS_URL);
  if (!res.ok) throw new Error('groups.jsonの取得に失敗しました');
  groups = await res.json();
}

async function fetchPerformances() {
  const res = await fetch(PERFORMANCE_URL);
  if (!res.ok) throw new Error('performance.jsonの取得に失敗しました');
  performances = await res.json();
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

  groups[selectedGroup].forEach(member => {
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

function onMemberChange() {
  const selectedGroup = groupSelect.value;
  const aliasGroup = GROUP_ALIAS[selectedGroup] || selectedGroup; // 🔽 alias対応
  const member = memberSelect.value;
  output.innerHTML = '';
  if (!member || !selectedGroup) return;

  const todayStr = new Date().toLocaleDateString('ja-JP').replace(/\//g, '-');

  const past = performances.filter(p => p.date.trim() <= todayStr);
  const future = performances.filter(p => p.date.trim() > todayStr);
  const memberPast = past.filter(p => p.members.includes(member));
  const totalCount = memberPast.length;

  const nextMilestone = Math.ceil(totalCount / 100) * 100;
  const remaining = nextMilestone - totalCount;

  let milestoneFutureEvent = null;
  if (remaining > 0 && remaining <= 10) {
    let count = totalCount;
    for (const perf of future) {
      if (perf.members.includes(member)) {
        count++;
        if (count >= nextMilestone) {
          milestoneFutureEvent = perf;
          break;
        }
      }
    }
  }

  const milestones = [];
  for (let milestone = 100; milestone <= totalCount; milestone += 100) {
    const perf = memberPast[milestone - 1];
    if (perf) {
      let displayStage = perf.stage;
      if (perf.stage.startsWith(aliasGroup)) {
        displayStage = perf.stage.replace(aliasGroup, '').trim(); // 🔽 aliasGroup使用
      }
      milestones.push({ date: perf.date, stage: displayStage, milestone });
    }
  }

  const historyRows = memberPast
    .map(p => {
      const groupPrefix = Object.keys(groups).concat(Object.keys(GROUP_ALIAS)).find(g =>
        p.stage.startsWith(GROUP_ALIAS[g] || g)
      );
      const resolvedGroup = GROUP_ALIAS[groupPrefix] || groupPrefix;
      const stage = (resolvedGroup === aliasGroup)
        ? p.stage.replace(resolvedGroup, '').trim()
        : p.stage;
      return { date: p.date, stage, time: p.time || '', full: p };
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.time === '昼' && b.time === '夜') return -1;
      if (a.time === '夜' && b.time === '昼') return 1;
      return 0;
    })
    .reverse()
    .map((entry, i, arr) => [arr.length - i, entry.date, entry.stage, entry.time]);

  const stageCountMap = {};
  memberPast.forEach(p => {
    if (p.stage.startsWith(aliasGroup)) {
      const name = p.stage.replace(aliasGroup, '').trim();
      stageCountMap[name] = (stageCountMap[name] || 0) + 1;
    }
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
    (groups[aliasGroup] || []).flat()
  ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);

  const stageRanking = {};
  const stagesSorted = Object.entries(stageCountMap).sort((a, b) => b[1] - a[1]).map(([stage]) => stage);
  stagesSorted.forEach(stageFull => {
    const countMap = {};
    past.filter(p => p.stage.replace(aliasGroup, '').trim() === stageFull).forEach(p =>
      p.members.forEach(m => countMap[m] = (countMap[m] || 0) + 1)
    );
    stageRanking[stageFull] = sortRankingWithTies(
      Object.entries(countMap).map(([name, count]) => ({ name, count })),
      (groups[aliasGroup] || []).flat()
    ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);
  });

  const yearCounts = {};
  memberPast.forEach(p => {
    const year = p.date.slice(0, 4);
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  });
  const yearRows = Object.entries(yearCounts)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, count]) => [`${year}年`, `${count}回`]);

  const yearRanking = {};
  const years = [...new Set(memberPast.map(p => p.date.slice(0, 4)))];
  years.forEach(year => {
    const countMap = {};
    past.filter(p => p.date.startsWith(year) && p.stage.startsWith(aliasGroup)).forEach(p =>
      p.members.forEach(m => countMap[m] = (countMap[m] || 0) + 1)
    );
    yearRanking[year] = sortRankingWithTies(
      Object.entries(countMap).map(([name, count]) => ({ name, count })),
      (groups[aliasGroup] || []).flat()
    ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);
  });

  let html = `<div class="highlight">総出演回数：${totalCount}回</div>`;

  if (remaining > 0 && remaining <= 10) {
    html += `
      <div style="font-size:1rem; color:#000; margin-top:-8px; margin-bottom:2px;">
        ${nextMilestone}回公演まで あと${remaining}回
      </div>
    `;
    if (milestoneFutureEvent) {
      const { date, stage, time } = milestoneFutureEvent;
      const displayStage = stage.startsWith(aliasGroup)
        ? stage.replace(aliasGroup, '').trim()
        : stage;
      const label = time ? `${date} の ${displayStage}（${time}）` : `${date} の ${displayStage}`;
      html += `
        <div style="font-size:1rem; color:#000; margin-top:0; margin-bottom:8px;">
          ${label} で達成予定
        </div>
      `;
    }
  }

  html += `
    <h3>出演履歴</h3>
    ${createTableHTML(['回数', '日付', '演目', '時間'], historyRows)}
  `;

  if (milestones.length > 0) {
    html += `
      <h3>節目達成日</h3>
      ${createTableHTML(['節目', '日付', '演目'], milestones.map(m => [`${m.milestone}回`, m.date, m.stage]))}
    `;
  }

  html += `
    <h3>演目別出演回数</h3>
    ${createTableHTML(['演目', '回数'], stageRows)}
    <h3>演目別出演回数ランキング</h3>
    ${stagesSorted.map(stage =>
      `<details><summary>${stage}</summary>${createTableHTML(['順位', '名前', '回数'], stageRanking[stage])}</details>`
    ).join('')}
    <h3>年別出演回数</h3>
    ${createTableHTML(['年', '回数'], yearRows)}
    <h3>年別出演回数ランキング</h3>
    ${Object.entries(yearRanking).map(([year, rows]) =>
      `<details><summary>${year}年</summary>${createTableHTML(['順位', '名前', '回数'], rows)}</details>`
    ).join('')}
    <h3>共演回数ランキング</h3>
    ${createTableHTML(['順位', '名前', '回数'], coRanking)}
  `;

  output.innerHTML = html;
}

async function init() {
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
}

window.addEventListener('DOMContentLoaded', init);