// グループ一覧と公演データのJSONパス
const GROUPS_URL = './src/data/groups.json';
const PERFORMANCE_URL = './src/data/performance.json';

let groups = {};         // グループとメンバー一覧を格納
let performances = [];   // 公演データを格納

// 卒業生グループを通常グループに紐づけるエイリアス
const GROUP_ALIAS = {
  'AKB48 卒業生': 'AKB48',
  'SKE48 卒業生': 'SKE48',
  'NMB48 卒業生': 'NMB48',
  'HKT48 卒業生': 'HKT48',
  'NGT48 卒業生': 'NGT48',
  'STU48 卒業生': 'STU48'
};

// HTMLの各要素を取得
const groupSelect = document.getElementById('group-select');
const memberSelect = document.getElementById('member-select');
const output = document.getElementById('output');

// 今日の日付を YYYY-MM-DD の文字列で返す関数
function getTodayString() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// groups.json を取得し groups 変数に格納する非同期関数
async function fetchGroups() {
  const res = await fetch(GROUPS_URL);
  if (!res.ok) throw new Error('groups.jsonの取得に失敗しました');
  groups = await res.json();
}

// performance.json を取得し、日付＋時間の昇順でソートして performances に格納
async function fetchPerformances() {
  const res = await fetch(PERFORMANCE_URL);
  if (!res.ok) throw new Error('performance.jsonの取得に失敗しました');
  const raw = await res.json();

  // 時間の順序を決める辞書（空文字、昼、夜の順）
  const timeOrder = { "": 0, "昼": 1, "夜": 2 };

  // 取得したデータをトリムしてから日付→時間でソート
  performances = raw.map(p => ({
    ...p,
    members: p.members.map(m => m.trim()),
    time: (p.time || "").trim()
  })).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (timeOrder[a.time] ?? 0) - (timeOrder[b.time] ?? 0);
  });
}

// グループ選択肢を作成
function setupGroupOptions() {
  Object.keys(groups).forEach(group => {
    const opt = document.createElement('option');
    opt.value = group;
    opt.textContent = group;
    groupSelect.appendChild(opt);
  });
}

// グループ変更時：メンバー選択肢を更新し、表示をリセット
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

// テーブルのHTMLを作成するヘルパー関数
function createTableHTML(headers, rows) {
  return `
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
}

// 同順位に対応したランキングを作成する関数
// groupListはメンバー並び順の優先リスト
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

// メンバー変更時：詳細表示を更新
function onMemberChange() {
  const selectedGroup = groupSelect.value;
  const member = memberSelect.value;
  output.innerHTML = '';
  if (!selectedGroup || !member) return;

  // 卒業生表記を除去して通常グループ名に変換
  let targetGroup = selectedGroup;
  if (selectedGroup.endsWith(' 卒業生')) {
    targetGroup = selectedGroup.replace(' 卒業生', '');
  }

  // 対象グループの現役メンバー＋卒業生を統合した配列を作成
  const combinedMembers = [
    ...(groups[targetGroup] || []),
    ...(groups[targetGroup + ' 卒業生'] || [])
  ];

  const todayStr = getTodayString();

  // 対象グループの公演のみ抽出
  const relevantPerformances = performances.filter(p => p.stage.startsWith(targetGroup));

  // 今日以前の公演（過去公演）
  const pastPerformances = relevantPerformances.filter(p => p.date <= todayStr);
  // 今日以降の公演（未来公演）
  const futurePerformances = relevantPerformances.filter(p => p.date > todayStr);

  // 過去公演のうち、対象メンバーが出演したものを抽出し、日付＋時間順でソート
  const memberPast = pastPerformances
    .filter(p => p.members.includes(member))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      // timeOrder は fetchPerformances のスコープ外なので再定義
      const timeOrder = { "": 0, "昼": 1, "夜": 2 };
      return (timeOrder[a.time] ?? 0) - (timeOrder[b.time] ?? 0);
    })
    // 日付順に連番（count）を付与。これで通算回数の順が保証される
    .map((p, i) => ({ ...p, count: i + 1 }));

  const totalCount = memberPast.length;

  // 未来公演のうち、対象メンバーが出演するものを抽出し、同様に日付＋時間順でソート
  const memberFuture = futurePerformances
    .filter(p => p.members.includes(member))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const timeOrder = { "": 0, "昼": 1, "夜": 2 };
      return (timeOrder[a.time] ?? 0) - (timeOrder[b.time] ?? 0);
    });

  // 次の節目（100回単位）の計算
  const nextMilestone = Math.ceil(totalCount / 100) * 100;
  const remaining = nextMilestone - totalCount;

  // 節目達成予定の公演を未来公演から探す（残り10回以内のみ対象）
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

  // 過去の節目達成日一覧を作成（100回ごと）
  const milestones = [];
  for (let m = 100; m <= totalCount; m += 100) {
    const perf = memberPast[m - 1]; // count は1から始まるので m-1 が配列インデックス
    if (perf) {
      const stageName = perf.stage.replace(targetGroup, '').trim();
      milestones.push({ date: perf.date, stage: stageName, milestone: m });
    }
  }
  // 節目は大きい数から順に並べる
  const sortedMilestones = milestones.sort((a, b) => b.milestone - a.milestone);

  // 出演履歴テーブル用の行データを作成（新しい順）
  const historyRows = memberPast
    .slice()
    .sort((a, b) => b.count - a.count)
    .map(p => [p.count, p.date, p.stage.replace(targetGroup, '').trim(), p.time || '']);

  // 今後の出演予定テーブル用の行データを作成（こちらは通算回数順に並べる）
  const futureRows = memberFuture.map((p, i) => {
    const count = totalCount + i + 1;
    return [count, p.date, p.stage.replace(targetGroup, '').trim(), p.time || ''];
  });

  // 演目ごとの出演回数を集計
  const stageCountMap = {};
  memberPast.forEach(p => {
    const stageName = p.stage.replace(targetGroup, '').trim();
    stageCountMap[stageName] = (stageCountMap[stageName] || 0) + 1;
  });
  const stageRows = Object.entries(stageCountMap)
    .sort((a, b) => b[1] - a[1])
    .map(([stage, count]) => [stage, `${count}回`]);

  // 共演回数を集計（対象メンバー以外）
  const coCounts = {};
  memberPast.forEach(p => {
    p.members.forEach(m => {
      if (m === member) return;
      coCounts[m] = (coCounts[m] || 0) + 1;
    });
  });
  // 共演ランキングを作成
  const coRanking = sortRankingWithTies(
    Object.entries(coCounts).map(([name, count]) => ({ name, count })),
    combinedMembers
  ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);

  // 演目別出演回数ランキング（該当グループ全体）
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

  // 年別出演回数集計
  const yearCounts = {};
  memberPast.forEach(p => {
    const y = p.date.slice(0, 4);
    yearCounts[y] = (yearCounts[y] || 0) + 1;
  });
  const yearRows = Object.entries(yearCounts)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, count]) => [`${year}年`, `${count}回`]);

  // 年別出演回数ランキング（該当グループ全体）
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

  // HTML構築スタート
  let html = `<div class="highlight">総出演回数：${totalCount}回</div>`;

  // 次の節目まであと10回以内の場合、節目達成予定表示
  if (remaining > 0 && remaining <= 10) {
    html += `<div style="font-size:1rem;color:#000;margin-top:-8px;margin-bottom:2px;">
      ${nextMilestone}回公演まであと${remaining}回
    </div>`;
    if (milestoneFutureEvent) {
      const dateObj = new Date(milestoneFutureEvent.date);
      const mm = dateObj.getMonth() + 1;
      const dd = dateObj.getDate();
      const dateStr = `${mm}月${dd}日`;
      const stageName = milestoneFutureEvent.stage.replace(targetGroup, '').trim();
      html += `<div style="font-size:1rem;color:#000;margin-top:0;margin-bottom:8px;">
        ${dateStr}の ${stageName}公演 で達成予定
      </div>`;
    }
  }

  // 出演履歴表示
  html += `<h3>出演履歴</h3>${createTableHTML(['回数', '日付', '演目', '時間'], historyRows)}`;

  // 今後の出演予定があれば表示
  if (futureRows.length > 0) {
    html += `<h3>今後の出演予定</h3>${createTableHTML(['回数', '日付', '演目', '時間'], futureRows)}`;
  }

  // 節目達成日表示
  if (sortedMilestones.length > 0) {
    html += `<h3>節目達成日</h3>${createTableHTML(['節目', '日付', '演目'], sortedMilestones.map(m => [`${m.milestone}回`, m.date, m.stage]))}`;
  }

  // 演目別出演回数表示
  html += `<h3>演目別出演回数</h3>${createTableHTML(['演目', '回数'], stageRows)}`;

  // 演目別出演回数ランキング表示
  html += `<h3>演目別出演回数ランキング</h3>${
    stagesSorted.map(stage =>
      `<details><summary>${stage}</summary>${createTableHTML(['順位', '名前', '回数'], stageRanking[stage])}</details>`
    ).join('')}`;

  // 年別出演回数表示
  html += `<h3>年別出演回数</h3>${createTableHTML(['年', '回数'], yearRows)}`;

  // 年別出演回数ランキング表示
  html += `<h3>年別出演回数ランキング</h3>${
    Object.entries(yearRanking)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, rows]) =>
        `<details><summary>${year}年</summary>${createTableHTML(['順位', '名前', '回数'], rows)}</details>`
      ).join('')
  }`;

  // 共演回数ランキング表示
  html += `<h3>共演回数ランキング</h3>${createTableHTML(['順位', '名前', '回数'], coRanking)}`;

  // 出力領域にセット
  output.innerHTML = html;
}

// 初期化処理：グループと公演データの読み込み、イベント設定
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

// ページ読み込み時に初期化を実行
window.addEventListener('DOMContentLoaded', init);