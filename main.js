const GROUPS_URL = './src/data/groups.json';
const PERFORMANCE_URL = './src/data/performance.json?v=' + Date.now();

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

function sortRankingWithTies(arr, order = []) {
  arr.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return order.indexOf(a.name) - order.indexOf(b.name);
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
  const member = memberSelect.value;
  output.innerHTML = '';
  if (!member) return;

  const today = new Date();
  const pastPerformances = performances.filter(p => new Date(p.date) <= today);
  const futurePerformances = performances.filter(p => new Date(p.date) > today);
  const memberPast = pastPerformances.filter(p => p.members.includes(member));
  const totalCount = memberPast.length;

  // 出演履歴
  const history = memberPast
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((p, i) =>
      `${totalCount - i}回目　${p.date}　${p.stage}${p.time ? '（' + p.time + '）' : ''}`
    );

  // 節目日と予測
  const milestoneNum = Math.floor(totalCount / 100) * 100;
  let milestoneDate = '';
  if (milestoneNum > 0) {
    const milestonePerf = pastPerformances.find(p => p.members.includes(member) &&
      memberPast.filter(mp => mp.date <= p.date).length === milestoneNum);
    if (milestonePerf) {
      milestoneDate = `${milestoneNum}回目は ${milestonePerf.date} の「${milestonePerf.stage}」${milestonePerf.time ? '（' + milestonePerf.time + '）' : ''} 公演`;
    }
  }

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

  // groupsの順番（ランキングソートで使用）
  const allMembers = Object.values(groups).flat();

  // 演目別出演回数
  const stageSet = new Set(pastPerformances.map(p => p.stage));
  const stageCounts = {};
  stageSet.forEach(stage => {
    stageCounts[stage] = pastPerformances.filter(p => p.stage === stage && p.members.includes(member)).length;
  });

  const sortedStages = [...stageSet].sort((a, b) => stageCounts[b] - stageCounts[a]);

  const stageRanking = {};
  stageSet.forEach(stage => {
    const membersCount = {};
    pastPerformances.filter(p => p.stage === stage).forEach(p => {
      p.members.forEach(m => {
        membersCount[m] = (membersCount[m] || 0) + 1;
      });
    });
    const arr = Object.entries(membersCount).map(([m, c]) => ({ name: m, count: c }));
    stageRanking[stage] = sortRankingWithTies(arr, allMembers);
  });

  // 年別ランキング
  const years = new Set(pastPerformances.map(p => p.date.slice(0, 4)));
  const yearRanking = {};
  years.forEach(year => {
    const membersCount = {};
    pastPerformances.filter(p => p.date.startsWith(year)).forEach(p => {
      p.members.forEach(m => {
        membersCount[m] = (membersCount[m] || 0) + 1;
      });
    });
    const arr = Object.entries(membersCount).map(([m, c]) => ({ name: m, count: c }));
    yearRanking[year] = sortRankingWithTies(arr, allMembers);
  });

  // 共演回数ランキング
  const coCounts = {};
  memberPast.forEach(p => {
    p.members.forEach(m => {
      if (m === member) return;
      coCounts[m] = (coCounts[m] || 0) + 1;
    });
  });
  const coRanking = sortRankingWithTies(Object.entries(coCounts).map(([m, c]) => ({ name: m, count: c })), allMembers);

  // 出力HTML
  let html = `
    <div class="highlight">総出演回数: ${totalCount}回</div>
    ${milestoneDate ? `<div>節目達成日: ${milestoneDate}</div>` : ''}
    ${milestonePrediction ? `<div>節目予測: ${milestonePrediction}</div>` : ''}
    <div>
      <h3>出演履歴</h3>
      <ul>${history.map(h => `<li>${h}</li>`).join('')}</ul>
    </div>
    <div>
      <h3>演目別出演回数</h3>
      <ul>${sortedStages.map(stage => `<li>${stage}：${stageCounts[stage]}回</li>`).join('')}</ul>
    </div>
    <div>
      <h3>演目別出演回数ランキング</h3>
      ${sortedStages.map(stage => `
        <details>
          <summary>${stage}</summary>
          <ul>${stageRanking[stage].map(item => `<li>${item.rank}位　${item.name}　${item.count}回</li>`).join('')}</ul>
        </details>
      `).join('')}
    </div>
    <div>
      <h3>年別出演回数ランキング</h3>
      ${Array.from(years).sort().map(year => `
        <details>
          <summary>${year}年ランキング</summary>
          <ul>${yearRanking[year].map(item => `<li>${item.rank}位　${item.name}　${item.count}回</li>`).join('')}</ul>
        </details>
      `).join('')}
    </div>
    <div>
      <h3>共演回数ランキング</h3>
      <ul>${coRanking.map(item => `<li>${item.rank}位　${item.name}　${item.count}回</li>`).join('')}</ul>
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