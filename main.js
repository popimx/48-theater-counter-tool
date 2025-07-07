const GROUPS_URL = './src/data/groups.json';
const PERFORMANCE_URL = './src/data/performance.json';

let groups = {};
let performances = [];

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

function sortRankingWithTies(arr, selectedGroup, groupsOrder) {
  // 出演回数が同じなら groups.jsonの順に
  arr.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    // 同点は groups.json 順序優先。存在しないメンバーは最後尾扱い。
    const aIdx = groupsOrder.hasOwnProperty(a.name) ? groupsOrder[a.name] : 999999;
    const bIdx = groupsOrder.hasOwnProperty(b.name) ? groupsOrder[b.name] : 999999;
    return aIdx - bIdx;
  });
  // ランク付け（順位は連続）
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

function stripGroupName(stageName, selectedGroup) {
  // stageNameの先頭が selectedGroup + 半角スペース なら削る
  if (!stageName) return '';
  if (selectedGroup && stageName.startsWith(selectedGroup + ' ')) {
    return stageName.slice(selectedGroup.length + 1);
  }
  return stageName;
}

function onMemberChange() {
  const selectedGroup = groupSelect.value;
  const member = memberSelect.value;
  output.innerHTML = '';
  if (!member) return;

  // groups.jsonのメンバー順序マップ作成（高速化用）
  // 複数グループ混在防止のため、選択グループのメンバーだけで作成
  const groupsOrder = {};
  if (groups[selectedGroup]) {
    groups[selectedGroup].forEach((m, i) => {
      groupsOrder[m] = i;
    });
  }

  const today = new Date();
  const pastPerformances = performances.filter(p => new Date(p.date) <= today);
  const futurePerformances = performances.filter(p => new Date(p.date) > today);
  const memberPast = pastPerformances.filter(p => p.members.includes(member));
  const totalCount = memberPast.length;

  // --- 出演履歴テーブル作成 ---
  // 新しい順に並べ替え
  const historySorted = memberPast
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  // 出演履歴テーブルHTML
  let historyHtml = `
    <h3>出演履歴</h3>
    <table>
      <thead><tr><th>回数</th><th>日付</th><th>演目</th></tr></thead>
      <tbody>
  `;

  historySorted.forEach((p, i) => {
    const countStr = `${totalCount - i}回目`;
    const stageDisplay = stripGroupName(p.stage, selectedGroup);
    historyHtml += `<tr><td>${countStr}</td><td>${p.date}</td><td>${stageDisplay}</td></tr>`;
  });
  historyHtml += '</tbody></table>';

  // 節目達成日
  const milestoneNum = Math.floor(totalCount / 100) * 100;
  let milestoneDate = '';
  if (milestoneNum > 0) {
    const milestonePerf = pastPerformances.find(p => p.members.includes(member) &&
      memberPast.filter(mp => mp.date <= p.date).length === milestoneNum);
    if (milestonePerf) {
      milestoneDate = `${milestoneNum}回目は ${milestonePerf.date} の「${stripGroupName(milestonePerf.stage, selectedGroup)}」公演`;
    }
  }

  let milestonePrediction = '';
  const countMod100 = totalCount % 100;
  if (countMod100 >= 90 && totalCount > 0) {
    const remaining = 100 - countMod100;
    const futureMilestonePerf = futurePerformances.filter(p => p.members.includes(member))[remaining - 1];
    if (futureMilestonePerf) {
      milestonePrediction = `（${totalCount + remaining}回目は ${futureMilestonePerf.date} の「${stripGroupName(futureMilestonePerf.stage, selectedGroup)}」公演の予定）`;
    } else {
      milestonePrediction = `あと${remaining}回で${totalCount + remaining}回の節目達成！`;
    }
  }

  // --- 演目別出演回数 ---
  // 選択メンバーが出演した演目だけ抽出（重複なし）
  const stageSet = new Set(memberPast.map(p => p.stage));
  // 選択メンバー出演の演目リスト（グループ名省略版）
  const stageList = Array.from(stageSet).map(s => stripGroupName(s, selectedGroup));

  // 演目別出演回数集計（選択グループの同じ演目だけ）
  const stageCounts = {};
  stageSet.forEach(stageName => {
    // stageNameの先頭グループが選択グループと一致するもののみカウント
    if (!stageName.startsWith(selectedGroup)) return;
    stageCounts[stageName] = pastPerformances.filter(p => p.stage === stageName && p.members.includes(member)).length;
  });

  // 演目別出演回数テーブル作成（多い順に並べ替え）
  const stageCountArr = Object.entries(stageCounts)
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count);

  let stageCountHtml = `
    <h3>演目別出演回数</h3>
    <table>
      <thead><tr><th>演目</th><th>出演回数</th></tr></thead>
      <tbody>
  `;

  stageCountArr.forEach(({ stage, count }) => {
    stageCountHtml += `<tr><td>${stripGroupName(stage, selectedGroup)}</td><td>${count}</td></tr>`;
  });
  stageCountHtml += '</tbody></table>';

  // --- 演目別出演回数ランキング ---
  let stageRankingHtml = `<h3>演目別出演回数ランキング</h3>`;

  stageCountArr.forEach(({ stage }) => {
    // その演目のメンバー別出演回数
    const membersCount = {};
    pastPerformances.filter(p => p.stage === stage).forEach(p => {
      p.members.forEach(m => {
        membersCount[m] = (membersCount[m] || 0) + 1;
      });
    });

    let arr = Object.entries(membersCount).map(([m, c]) => ({ name: m, count: c }));

    // groups.jsonのメンバー順にソートしつつランク付け
    arr = sortRankingWithTies(arr, selectedGroup, groupsOrder);

    stageRankingHtml += `
      <h4>${stripGroupName(stage, selectedGroup)}</h4>
      <table>
        <thead><tr><th>順位</th><th>メンバー</th><th>出演回数</th></tr></thead>
        <tbody>
    `;
    arr.forEach(({ rank, name, count }) => {
      stageRankingHtml += `<tr><td>${rank}位</td><td>${name}</td><td>${count}</td></tr>`;
    });
    stageRankingHtml += `</tbody></table>`;
  });

  // --- 年別出演回数ランキング ---
  // 年の集合（メンバー出演した公演から）
  const yearsSet = new Set(memberPast.map(p => p.date.slice(0, 4)));
  const years = Array.from(yearsSet).sort();

  let yearRankingHtml = `<h3>年別出演回数ランキング</h3>`;

  years.forEach(year => {
    const membersCount = {};
    pastPerformances.filter(p => p.date.startsWith(year)).forEach(p => {
      p.members.forEach(m => {
        membersCount[m] = (membersCount[m] || 0) + 1;
      });
    });

    let arr = Object.entries(membersCount).map(([m, c]) => ({ name: m, count: c }));
    arr = sortRankingWithTies(arr, selectedGroup, groupsOrder);

    yearRankingHtml += `
      <h4>${year}年</h4>
      <table>
        <thead><tr><th>順位</th><th>メンバー</th><th>出演回数</th></tr></thead>
        <tbody>
    `;
    arr.forEach(({ rank, name, count }) => {
      yearRankingHtml += `<tr><td>${rank}位</td><td>${name}</td><td>${count}</td></tr>`;
    });
    yearRankingHtml += `</tbody></table>`;
  });

  // --- 共演回数ランキング ---
  const coCounts = {};
  memberPast.forEach(p => {
    p.members.forEach(m => {
      if (m === member) return;
      coCounts[m] = (coCounts[m] || 0) + 1;
    });
  });
  let coArr = Object.entries(coCounts).map(([m, c]) => ({ name: m, count: c }));
  coArr = sortRankingWithTies(coArr, selectedGroup, groupsOrder);

  let coRankingHtml = `
    <h3>共演回数ランキング</h3>
    <table>
      <thead><tr><th>順位</th><th>メンバー</th><th>共演回数</th></tr></thead>
      <tbody>
  `;
  coArr.forEach(({ rank, name, count }) => {
    coRankingHtml += `<tr><td>${rank}位</td><td>${name}</td><td>${count}</td></tr>`;
  });
  coRankingHtml += `</tbody></table>`;

  // --- 総出演回数・節目表示 ---
  let html = `
    <div class="highlight">総出演回数: ${totalCount}回</div>
    ${milestoneDate ? `<div>節目達成日: ${milestoneDate}</div>` : ''}
    ${milestonePrediction ? `<div>節目予測: ${milestonePrediction}</div>` : ''}
    ${historyHtml}
    ${stageCountHtml}
    ${stageRankingHtml}
    ${yearRankingHtml}
    ${coRankingHtml}
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
    output.innerHTML = `<p style="color:red;">データの読み込みに失敗しました: ${e.message}</p>`;
    groupSelect.disabled = true;
    memberSelect.disabled = true;
  }
}

window.addEventListener('DOMContentLoaded', init);