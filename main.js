const GROUPS_URL = './src/data/groups.json';
const PERFORMANCE_URL = './src/data/performance.json';

let groups = {};
let performances = [];

async function fetchGroups() {
  const res = await fetch(`${GROUPS_URL}?t=${Date.now()}`);
  if (!res.ok) throw new Error('groups.jsonの取得に失敗しました');
  groups = await res.json();
}

async function fetchPerformances() {
  const res = await fetch(`${PERFORMANCE_URL}?t=${Date.now()}`);
  if (!res.ok) throw new Error('performance.jsonの取得に失敗しました');
  performances = await res.json();
}

function sortRankingWithTies(arr, groupOrder = []) {
  arr.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (groupOrder.length > 0) {
      return groupOrder.indexOf(a.name) - groupOrder.indexOf(b.name);
    }
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

function formatHistory(index, p) {
  return `${index + 1}回目　${p.date}　${p.stage}${p.time ? '　' + p.time : ''}`;
}

function formatRank(item) {
  return `${item.rank}位　${item.name}　${item.count}回`;
}

function onGroupChange() {
  const groupSelect = document.getElementById('group-select');
  const memberSelect = document.getElementById('member-select');
  const output = document.getElementById('output');
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

function onMemberChange() {
  const groupSelect = document.getElementById('group-select');
  const memberSelect = document.getElementById('member-select');
  const output = document.getElementById('output');

  const member = memberSelect.value;
  const groupMembers = groups[groupSelect.value] || [];
  output.innerHTML = '';
  if (!member) return;

  const today = new Date();
  const pastPerformances = performances.filter(p => new Date(p.date) <= today);
  const futurePerformances = performances.filter(p => new Date(p.date) > today);
  const memberPast = pastPerformances.filter(p => p.members.includes(member));
  const totalCount = memberPast.length;

  const history = memberPast
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((p, i) => formatHistory(totalCount - i - 1, p));

  const milestoneNum = Math.floor(totalCount / 100) * 100;
  let milestoneDate = '';
  if (milestoneNum > 0) {
    const milestonePerf = pastPerformances.find(p =>
      p.members.includes(member) &&
      memberPast.filter(mp => mp.date <= p.date).length === milestoneNum
    );
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

  const stageCounts = {};
  pastPerformances.forEach(p => {
    if (p.members.includes(member)) {
      stageCounts[p.stage] = (stageCounts[p.stage] || 0) + 1;
    }
  });

  const sortedStages = Object.entries(stageCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);

  const stageRanking = {};
  sortedStages.forEach(stage => {
    const membersCount = {};
    pastPerformances
      .filter(p => p.stage === stage)
      .forEach(p => {
        p.members.forEach(m => {
          membersCount[m] = (membersCount[m] || 0) + 1;
        });
      });
    const arr = Object.entries(membersCount).map(([m, c]) => ({ name: m, count: c }));
    stageRanking[stage] = sortRankingWithTies(arr, groupMembers);
  });

  const years = new Set(pastPerformances.map(p => p.date.slice(0, 4)));
  const yearRanking = {};
  years.forEach(year => {
    const membersCount = {};
    pastPerformances
      .filter(p => p.date.startsWith(year))
      .forEach(p => {
        p.members.forEach(m => {
          membersCount[m] = (membersCount[m] || 0) + 1;
        });
      });
    const arr = Object.entries(membersCount).map(([m, c]) => ({ name: m, count: c }));
    yearRanking[year] = sortRankingWithTies(arr, groupMembers);
  });

  const coCounts = {};
  memberPast.forEach(p => {
    p.members.forEach(m => {
      if (m !== member) {
        coCounts[m] = (coCounts[m] || 0) + 1;
      }
    });
  });
  const coRanking = sortRankingWithTies(Object.entries(coCounts).map(([m, c]) => ({ name: m, count: c })), groupMembers);

  let html = `
    <div class="highlight">総出演回数: ${totalCount}回</div>
    ${milestoneDate ? `<div>節目達成日: ${milestoneDate}</div>` : ''}
    ${milestonePrediction ? `<div>節目予測: ${milestonePrediction}</div>` : ''}
    <div>
      <h3>出演履歴</h3>
      <ol>${history.map(h => `<li>${h}</li>`).join('')}</ol>
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
          <ol>${stageRanking[stage].map(item => `<li>${formatRank(item)}</li>`).join('')}</ol>
        </details>
      `).join('')}
    </div>
    <div>
      <h3>年別出演回数ランキング</h3>
      ${Array.from(years).sort().map(year => `
        <details>
          <summary>${year}年ランキング</summary>
          <ol>${yearRanking[year].map(item => `<li>${formatRank(item)}</li>`).join('')}</ol>
        </details>
      `).join('')}
    </div>
    <div>
      <h3>共演回数ランキング</h3>
      <ol>${coRanking.map(item => `<li>${formatRank(item)}</li>`).join('')}</ol>
    </div>
  `;

  output.innerHTML = html;
}

async function init() {
  try {
    await fetchGroups();
    await fetchPerformances();
    const groupSelect = document.getElementById('group-select');
    const memberSelect = document.getElementById('member-select');
    Object.keys(groups).forEach(group => {
      const opt = document.createElement('option');
      opt.value = group;
      opt.textContent = group;
      groupSelect.appendChild(opt);
    });
    groupSelect.addEventListener('change', onGroupChange);
    memberSelect.addEventListener('change', onMemberChange);
  } catch (e) {
    const output = document.getElementById('output');
    output.innerHTML = `<p style="color:red;">データの読み込みに失敗しました: ${e.message}</p>`;
    document.getElementById('group-select').disabled = true;
    document.getElementById('member-select').disabled = true;
  }
}

window.addEventListener('DOMContentLoaded', init);