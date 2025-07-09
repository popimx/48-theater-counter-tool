const GROUPS_URL = './src/data/groups.json';
const PERFORMANCE_URL = './src/data/performance.json';

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
  const rawGroup = groupSelect.value;
  memberSelect.innerHTML = '<option value="">-- メンバーを選択 --</option>';
  memberSelect.disabled = !rawGroup;
  output.innerHTML = '';
  if (!rawGroup) return;

  const realGroup = GROUP_ALIAS[rawGroup] || rawGroup;
  const merged = [ ...(groups[realGroup] || []) ];
  const gradGroup = realGroup + ' 卒業生';
  if (groups[gradGroup]) merged.push(...groups[gradGroup]);

  merged.forEach(member => {
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
  arr.forEach((item,i) => {
    if (item.count !== lastCount) {
      lastCount = item.count;
      lastRank = i + 1;
    }
    item.rank = lastRank;
  });
  return arr;
}

function onMemberChange() {
  const rawGroup = groupSelect.value;
  const member = memberSelect.value;
  output.innerHTML = '';
  if (!rawGroup || !member) return;

  const selectedGroup = GROUP_ALIAS[rawGroup] || rawGroup;

  // 今日の日付（例：2025-07-09）を取得して performances の絞り込みに使用
  const todayStr = new Date().toISOString().slice(0,10);

  // 選択グループの現役メンバー・卒業生をまとめて取得
  const allMembers = [...(groups[selectedGroup] || [])];
  const gradGroup = selectedGroup + ' 卒業生';
  if (groups[gradGroup]) allMembers.push(...groups[gradGroup]);

  // performancesから、selectedGroupの公演だけ抽出（stageがグループ名で始まるもの）
  const relevant = performances.filter(p => p.stage.startsWith(selectedGroup));

  // 今日までの公演のみ
  const past = relevant.filter(p => p.date <= todayStr);
  // 今日より未来の公演は今は表示しない
  const future = relevant.filter(p => p.date > todayStr);

  // 選択メンバーが出演した過去公演のみ
  const memberPast = past.filter(p => p.members.includes(member));
  const totalCount = memberPast.length;

  // 次の節目と残り回数計算
  const nextMilestone = Math.ceil(totalCount / 100) * 100;
  const remaining = nextMilestone - totalCount;

  // 未来公演で節目達成予定の公演
  let milestoneFutureEvent = null;
  if (remaining > 0 && remaining <= 10) {
    let count = totalCount;
    for (const perf of future.filter(p => p.members.includes(member))) {
      if (++count >= nextMilestone) {
        milestoneFutureEvent = perf;
        break;
      }
    }
  }

  // 節目達成日を過去公演から計算
  const milestones = [];
  for (let m = 100; m <= totalCount; m += 100) {
    const perf = memberPast[m - 1];
    if (perf) {
      let stage = perf.stage;
      if (stage.startsWith(selectedGroup)) {
        stage = stage.replace(selectedGroup, '').trim();
      }
      milestones.push({ date: perf.date, stage, milestone: m });
    }
  }

  // 出演履歴（降順、時間順も考慮）
  const historyRows = memberPast
    .slice()
    .sort((a,b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      if (a.time === '昼' && b.time === '夜') return -1;
      if (a.time === '夜' && b.time === '昼') return 1;
      return 0;
    })
    .map((p,i,arr) => [arr.length - i, p.date, p.stage.replace(selectedGroup, '').trim(), p.time || '']);

  // 演目別出演回数集計
  const stageCountMap = {};
  memberPast.forEach(p => {
    let stageName = p.stage;
    if (stageName.startsWith(selectedGroup)) {
      stageName = stageName.replace(selectedGroup, '').trim();
    }
    stageCountMap[stageName] = (stageCountMap[stageName] || 0) + 1;
  });
  const stageRows = Object.entries(stageCountMap)
    .sort((a,b) => b[1] - a[1])
    .map(([stage, count]) => [stage, `${count}回`]);

  // 共演回数集計
  const coCounts = {};
  memberPast.forEach(p => {
    p.members.forEach(m => {
      if (m === member) return;
      coCounts[m] = (coCounts[m] || 0) + 1;
    });
  });
  const coRanking = sortRankingWithTies(
    Object.entries(coCounts).map(([name, count]) => ({ name, count })),
    allMembers
  ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);

  // 演目別出演回数ランキング
  const stagesSorted = Object.keys(stageCountMap).sort((a,b) => stageCountMap[b] - stageCountMap[a]);
  const stageRanking = {};
  stagesSorted.forEach(stageName => {
    const countMap = {};
    past.filter(p => {
      let st = p.stage;
      if (st.startsWith(selectedGroup)) {
        st = st.replace(selectedGroup, '').trim();
      }
      return st === stageName;
    }).forEach(p => {
      p.members.forEach(m => {
        countMap[m] = (countMap[m] || 0) + 1;
      });
    });
    stageRanking[stageName] = sortRankingWithTies(
      Object.entries(countMap).map(([name, count]) => ({ name, count })),
      allMembers
    ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);
  });

  // 年別出演回数集計
  const yearCounts = {};
  memberPast.forEach(p => {
    const year = p.date.slice(0,4);
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  });
  const yearRows = Object.entries(yearCounts)
    .sort((a,b) => b[0].localeCompare(a[0]))
    .map(([year, count]) => [`${year}年`, `${count}回`]);

  // 年別出演回数ランキング
  const yearRanking = {};
  Object.keys(yearCounts).forEach(year => {
    const countMap = {};
    past.filter(p => p.date.startsWith(year)).forEach(p => {
      p.members.forEach(m => {
        countMap[m] = (countMap[m] || 0) + 1;
      });
    });
    yearRanking[year] = sortRankingWithTies(
      Object.entries(countMap).map(([name, count]) => ({ name, count })),
      allMembers
    ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);
  });

  // HTML出力
  let html = `<div class="highlight">総出演回数：${totalCount}回</div>`;
  if (remaining > 0 && remaining <= 10) {
    html += `
      <div style="font-size:1rem; color:#000; margin-top:-8px; margin-bottom:2px;">
        ${nextMilestone}回公演まで あと${remaining}回
      </div>
    `;
    if (milestoneFutureEvent) {
      const label = milestoneFutureEvent.time
        ? `${milestoneFutureEvent.date} の ${milestoneFutureEvent.stage.replace(selectedGroup, '').trim()}（${milestoneFutureEvent.time}）`
        : `${milestoneFutureEvent.date} の ${milestoneFutureEvent.stage.replace(selectedGroup, '').trim()}`;
      html += `
        <div style="font-size:1rem; color:#000; margin-top:0; margin-bottom:8px;">
          ${label} で達成予定
        </div>
      `;
    }
  }

  html += `<h3>出演履歴</h3>${createTableHTML(['回数', '日付', '演目', '時間'], historyRows)}`;

  if (milestones.length > 0) {
    html += `<h3>節目達成日</h3>${createTableHTML(['節目', '日付', '演目'], milestones.map(m => [`${m.milestone}回`, m.date, m.stage]))}`;
  }

  html += `<h3>演目別出演回数</h3>${createTableHTML(['演目', '回数'], stageRows)}`;
  html += `<h3>演目別出演回数ランキング</h3>${stagesSorted.map(stage => `<details><summary>${stage}</summary>${createTableHTML(['順位', '名前', '回数'], stageRanking[stage])}</details>`).join('')}`;
  html += `<h3>年別出演回数</h3>${createTableHTML(['年', '回数'], yearRows)}`;
  html += `<h3>年別出演回数ランキング</h3>${Object.entries(yearRanking).map(([year, rows]) => `<details><summary>${year}年</summary>${createTableHTML(['順位', '名前', '回数'], rows)}</details>`).join('')}`;
  html += `<h3>共演回数ランキング</h3>${createTableHTML(['順位', '名前', '回数'], coRanking)}`;

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