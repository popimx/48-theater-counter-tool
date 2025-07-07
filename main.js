const GROUPS_URL = './src/data/groups.json';
const PERFORMANCE_URL = './src/data/performance.json';

let groups = {};
let performances = [];

const groupSelect = document.getElementById('group-select');
const memberSelect = document.getElementById('member-select');
const output = document.getElementById('output');

// グループ読み込み
async function fetchGroups() {
  const res = await fetch(GROUPS_URL + '?t=' + Date.now());
  if (!res.ok) throw new Error('groups.jsonの取得に失敗しました');
  groups = await res.json();
}

// 公演データ読み込み
async function fetchPerformances() {
  const res = await fetch(PERFORMANCE_URL + '?t=' + Date.now());
  if (!res.ok) throw new Error('performance.jsonの取得に失敗しました');
  performances = await res.json();
}

// グループ選択肢セットアップ
function setupGroupOptions() {
  Object.keys(groups).forEach(group => {
    const opt = document.createElement('option');
    opt.value = group;
    opt.textContent = group;
    groupSelect.appendChild(opt);
  });
}

// グループ選択時処理
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

// groups.jsonでのメンバー順位を取得（卒業メンバーは最後）
function getMemberRankInGroup(member, selectedGroup) {
  if (!groups[selectedGroup]) return Infinity;
  const idx = groups[selectedGroup].indexOf(member);
  return idx === -1 ? Infinity : idx;
}

// 日付＋時間でのソート（昼は夜より古い）
function comparePerformanceDateTime(a, b) {
  if (a.date < b.date) return -1;
  if (a.date > b.date) return 1;

  // 同日ならtimeで判定
  const timeOrder = { '昼': 0, '夜': 1, '': 2 };
  const aTime = a.time || '';
  const bTime = b.time || '';
  return (timeOrder[aTime] ?? 2) - (timeOrder[bTime] ?? 2);
}

// ソートしつつ順位付け、同点はグループ順で決定
function sortRankingWithTies(arr, selectedGroup) {
  arr.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    // 同点はgroups.jsonの順序で
    const aRank = getMemberRankInGroup(a.name, selectedGroup);
    const bRank = getMemberRankInGroup(b.name, selectedGroup);
    return aRank - bRank;
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

// テーブル生成ヘルパー（columnsは配列、rowsは配列の配列）
function createTableHTML(columns, rows) {
  return `
    <table>
      <thead>
        <tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows
          .map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`)
          .join('')}
      </tbody>
    </table>
  `;
}

// 出力処理
function onMemberChange() {
  const member = memberSelect.value;
  output.innerHTML = '';
  if (!member) return;

  const selectedGroup = groupSelect.value;
  const today = new Date();

  // 過去・未来公演分け
  const pastPerformances = performances.filter(p => new Date(p.date) <= today);
  const futurePerformances = performances.filter(p => new Date(p.date) > today);

  // 選択メンバーの過去出演公演（time順昇順）
  const memberPast = pastPerformances
    .filter(p => p.members.includes(member))
    .sort(comparePerformanceDateTime);

  const totalCount = memberPast.length;

  // 出演履歴（回数＋日付＋グループ省略したステージ名＋time表示）
  const historyRows = memberPast.map((p, i) => {
    // ステージ名の先頭グループと選択グループが同じなら省略
    const stageGroupPrefix = Object.keys(groups).find(g => p.stage.startsWith(g));
    const stageName = (stageGroupPrefix === selectedGroup) ? p.stage.slice(selectedGroup.length).trim() : p.stage;
    const countStr = `${i + 1}回目`;
    const timeStr = p.time ? ` ${p.time}` : '';
    return [countStr, p.date, stageName + timeStr];
  });

  // 節目達成日判定
  const milestoneNum = Math.floor(totalCount / 100) * 100;
  let milestoneDate = '';
  if (milestoneNum > 0) {
    const milestonePerf = pastPerformances.find(p => p.members.includes(member) &&
      memberPast.filter(mp => comparePerformanceDateTime(mp, p) <= 0).length === milestoneNum);
    if (milestonePerf) {
      milestoneDate = `${milestoneNum}回目は ${milestonePerf.date} の「${milestonePerf.stage}」${milestonePerf.time ? '（' + milestonePerf.time + '）' : ''} 公演`;
    }
  }

  // 節目予測
  let milestonePrediction = '';
  const countMod100 = totalCount % 100;
  if (countMod100 >= 90 && totalCount > 0) {
    const remaining = 100 - countMod100;
    const futureMilestonePerf = futurePerformances.filter(p => p.members.includes(member))[remaining - 1];
    if (futureMilestonePerf) {
      milestonePrediction = `（${totalCount + remaining}回目は ${futureMilestonePerf.date} の「${futureMilestonePerf.stage}」${futureMilestonePerf.time ? '（' + futureMilestonePerf.time + '）' : ''} 公演の予定）`;
    } else {
      milestonePrediction = `あと${remaining}回で${totalCount + remaining}回の節目達成！`;
    }
  }

  // 出演した演目セット（出演履歴のstage名と同じものだけ）
  const playedStagesSet = new Set(memberPast.map(p => p.stage));

  // 演目別出演回数（出演履歴と同じstageのみ、かつ選択グループとstageの先頭グループが同じもの）
  const stageCounts = {};
  playedStagesSet.forEach(stage => {
    const stageGroupPrefix = Object.keys(groups).find(g => stage.startsWith(g));
    if (stageGroupPrefix !== selectedGroup) return; // グループ違いはスキップ
    stageCounts[stage] = pastPerformances.filter(p => p.stage === stage && p.members.includes(member)).length;
  });

  // 演目別出演回数ランキング（出演履歴と同じstageのみ）
  const stageRanking = {};
  playedStagesSet.forEach(stage => {
    const stageGroupPrefix = Object.keys(groups).find(g => stage.startsWith(g));
    if (stageGroupPrefix !== selectedGroup) return;
    const membersCount = {};
    pastPerformances.filter(p => p.stage === stage).forEach(p => {
      p.members.forEach(m => {
        membersCount[m] = (membersCount[m] || 0) + 1;
      });
    });
    const arr = Object.entries(membersCount).map(([m, c]) => ({ name: m, count: c }));
    stageRanking[stage] = sortRankingWithTies(arr, selectedGroup);
  });

  // 年別集合（出演履歴に基づく年のみ）
  const yearsSet = new Set(memberPast.map(p => p.date.slice(0, 4)));
  const years = Array.from(yearsSet).sort();

  // 年別出演回数ランキング
  const yearRanking = {};
  years.forEach(year => {
    const membersCount = {};
    pastPerformances.filter(p => p.date.startsWith(year)).forEach(p => {
      p.members.forEach(m => {
        membersCount[m] = (membersCount[m] || 0) + 1;
      });
    });
    const arr = Object.entries(membersCount).map(([m, c]) => ({ name: m, count: c }));
    yearRanking[year] = sortRankingWithTies(arr, selectedGroup);
  });

  // 共演回数（選択メンバーと同じ公演に出演した回数）
  const coCounts = {};
  memberPast.forEach(p => {
    p.members.forEach(m => {
      if (m === member) return;
      coCounts[m] = (coCounts[m] || 0) + 1;
    });
  });
  const coRanking = sortRankingWithTies(Object.entries(coCounts).map(([m, c]) => ({ name: m, count: c })), selectedGroup);

  // 出力HTML作成
  let html = `
    <div class="highlight">総出演回数: ${totalCount}回</div>
    ${milestoneDate ? `<div>節目達成日: ${milestoneDate}</div>` : ''}
    ${milestonePrediction ? `<div>節目予測: ${milestonePrediction}</div>` : ''}
    <div>
      <h3>出演履歴</h3>
      ${createTableHTML(['回数', '日付', '演目'], historyRows)}
    </div>
    <div>
      <h3>演目別出演回数</h3>
      ${createTableHTML(
        ['演目', '出演回数'],
        Object.entries(stageCounts).map(([stage, count]) => {
          const stageGroupPrefix = Object.keys(groups).find(g => stage.startsWith(g));
          const stageName = (stageGroupPrefix === selectedGroup) ? stage.slice(selectedGroup.length).trim() : stage;
          return [stageName, count];
        })
      )}
    </div>
    <div>
      <h3>演目別出演回数ランキング</h3>
      ${Object.entries(stageRanking).map(([stage, ranking]) => {
        const stageGroupPrefix = Object.keys(groups).find(g => stage.startsWith(g));
        if (stageGroupPrefix !== selectedGroup) return '';
        const stageName = stage.slice(selectedGroup.length).trim();
        return `
          <details>
            <summary>${stageName}</summary>
            ${createTableHTML(['順位', 'メンバー', '回数'], ranking.map(r => [`${r.rank}位`, r.name, r.count]))}
          </details>
        `;
      }).join('')}
    </div>
    <div>
      <h3>年別出演回数ランキング</h3>
      ${years.map(year => `
        <details>
          <summary>${year}年</summary>
          ${createTableHTML(['順位', 'メンバー', '回数'], yearRanking[year].map(r => [`${r.rank}位`, r.name, r.count]))}
        </details>
      `).join('')}
    </div>
    <div>
      <h3>共演回数ランキング</h3>
      ${createTableHTML(['順位', 'メンバー', '回数'], coRanking.map(r => [`${r.rank}位`, r.name, r.count]))}
    </div>
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