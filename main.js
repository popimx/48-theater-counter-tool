const GROUPS_URL = './src/data/groups.json';
const PERFORMANCE_FILES_URL = './src/data/performance_files.json';

let groups = {};
let groupFiles = {};  // グループごとのperformanceファイル名一覧
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

// 18文字以上は省略して17文字目に「…」を付ける
function truncateStageNameLong(name) {
  return name.length > 20 ? name.slice(0, 19) + '…' : name;
}

async function fetchGroups() {
  const res = await fetch(GROUPS_URL);
  if (!res.ok) throw new Error('groups.jsonの取得に失敗しました');
  groups = await res.json();
}

async function fetchPerformanceFiles() {
  const res = await fetch(PERFORMANCE_FILES_URL);
  if (!res.ok) throw new Error('performance_files.jsonの取得に失敗しました');
  groupFiles = await res.json();
}

async function loadPerformancesByGroup(group) {
  if (!groupFiles[group]) return [];

  const relatedGroups = [group];
  if (groupFiles[group + ' 卒業生']) {
    relatedGroups.push(group + ' 卒業生');
  }

  const files = relatedGroups.flatMap(g => groupFiles[g] || []);
  const results = [];

  for (const file of files) {
    try {
      const res = await fetch(`./src/data/${file}`);
      if (res.ok) {
        const data = await res.json();
        results.push(...data.map((p, index) => ({
          ...p,
          index,
          members: p.members.map(m => m.trim()),
          time: (p.time || "").trim()
        })));
      } else {
        console.warn(`ファイル取得失敗: ${file}`);
      }
    } catch (e) {
      console.warn(`読み込みエラー: ${file}`, e);
    }
  }

  return results;
}

function setupGroupOptions() {
  Object.keys(groups).forEach(group => {
    const opt = document.createElement('option');
    opt.value = group;
    opt.textContent = group;
    groupSelect.appendChild(opt);
  });
}

let isMemberChangeProcessing = false; // onMemberChangeの多重呼び出し防止用フラグ

function clearMemberSelection() {
  memberSelect.innerHTML = '<option value="">-- メンバーを選択 --</option>';
  memberSelect.disabled = true;
}

async function onGroupChange() {
  const selectedGroup = groupSelect.value;
  clearMemberSelection();
  output.innerHTML = '';
  if (!selectedGroup) return;

  // グループに対応したメンバー一覧をセット
  const memberList = groups[selectedGroup] || [];
  memberList.forEach(member => {
    const opt = document.createElement('option');
    opt.value = member;
    opt.textContent = member;
    memberSelect.appendChild(opt);
  });
  memberSelect.disabled = false;

  // 選択グループのperformanceを先読み（直列）
  output.textContent = 'データを読み込み中…';
  try {
    performances = await loadPerformancesByGroup(selectedGroup);
    output.textContent = '';
  } catch (e) {
    output.innerHTML = `<p style="color:red;">データ読み込みエラー: ${e.message}</p>`;
  }
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

function sortByDateDescendingWithIndex(a, b) {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return b.index - a.index;
}

function sortByDateAscendingWithIndex(a, b) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return a.index - b.index;
}

async function onMemberChange() {
  if (isMemberChangeProcessing) return; // 多重呼び出し防止
  isMemberChangeProcessing = true;

  const selectedGroup = groupSelect.value;
  const member = memberSelect.value;
  output.innerHTML = '';
  if (!selectedGroup || !member) {
    isMemberChangeProcessing = false;
    return;
  }

  // 「AKB48 卒業生」などを外したグループ名
  let targetGroup = selectedGroup;
  if (selectedGroup.endsWith(' 卒業生')) {
    targetGroup = selectedGroup.replace(' 卒業生', '');
  }

  // 該当グループ＋卒業生の全メンバーリスト
  const combinedMembers = [
    ...(groups[targetGroup] || []),
    ...(groups[targetGroup + ' 卒業生'] || [])
  ];

  // 今日の日付
  const todayStr = getTodayString();

  // performances は既に先読み済み
  const relevantPerformances = performances.filter(p => p.stage.startsWith(targetGroup));
  const pastPerformances = relevantPerformances.filter(p => p.date <= todayStr);
  const futurePerformances = relevantPerformances.filter(p => p.date > todayStr);

  const memberPast = pastPerformances
    .filter(p => p.members.includes(member))
    .sort(sortByDateAscendingWithIndex)
    .map((p, i) => ({ ...p, count: i + 1 }));

  const totalCount = memberPast.length;

  const memberFuture = futurePerformances
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

  const historyRows = memberPast.slice().sort(sortByDateDescendingWithIndex).map(p => [
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
    .map(([stage, count]) => [truncateStageNameLong(stage), `${count}回`]);

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

  const coHistoryHtml = coRanking.map(([rankStr, coMember, countStr]) => {
    const count = parseInt(countStr);
    const coPerformances = memberPast
      .filter(p => p.members.includes(coMember))
      .sort(sortByDateDescendingWithIndex);
    const rows = coPerformances.map((p, i) => [
      count - i,
      p.date,
      truncateStageName(p.stage.replace(targetGroup, '').trim()),
      p.time || ''
    ]);
    return `
      <details>
        <summary>${coMember}</summary>
        ${createTableHTML(['回数', '日付', '演目', '時間'], rows)}
      </details>
    `;
  }).join('');

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
    Object.keys(stageCountMap).sort((a, b) => stageCountMap[b] - stageCountMap[a])
    .map(stage =>
      `<details><summary>${stage}</summary>${createTableHTML(['順位', '名前', '回数'], (function(){
        const counts = {};
        pastPerformances.filter(p => p.stage.replace(targetGroup, '').trim() === stage)
          .forEach(p => p.members.forEach(m => counts[m] = (counts[m] || 0) + 1));
        return sortRankingWithTies(
          Object.entries(counts).map(([name, count]) => ({ name, count })),
          combinedMembers
        ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);
      })())}</details>`
    ).join('')
  }`;
  html += `<h3>年別出演回数</h3>${createTableHTML(['年', '回数'], yearRows)}`;
  html += `<h3>年別出演回数ランキング</h3>${
    Object.entries(yearRanking).sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, rows]) =>
        `<details><summary>${year}年</summary>${createTableHTML(['順位', '名前', '回数'], rows)}</details>`
      ).join('')
  }`;

  html += `<h3>共演回数ランキング</h3>${createTableHTML(['順位', '名前', '回数'], coRanking)}`;
  html += `<h3>共演履歴</h3>${coHistoryHtml}`;

  output.innerHTML = html;

  isMemberChangeProcessing = false; // 処理終了フラグOFF
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await fetchGroups();
    await fetchPerformanceFiles();
    setupGroupOptions();

    // いったんイベントリスナーを全部解除してからセット（多重登録防止）
    groupSelect.replaceWith(groupSelect.cloneNode(true));
    memberSelect.replaceWith(memberSelect.cloneNode(true));

    const newGroupSelect = document.getElementById('group-select');
    const newMemberSelect = document.getElementById('member-select');

    newGroupSelect.addEventListener('change', onGroupChange);
    newMemberSelect.addEventListener('change', onMemberChange);
  } catch (e) {
    output.innerHTML = `<p style="color:red;">読み込みエラー: ${e.message}</p>`;
    groupSelect.disabled = true;
    memberSelect.disabled = true;
  }
});