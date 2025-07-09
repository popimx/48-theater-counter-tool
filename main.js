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
  const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  const relevant = performances.filter(p => p.stage.startsWith(selectedGroup));
  const past = relevant.filter(p => p.date <= todayStr);
  const future = relevant.filter(p => p.date > todayStr);
  const memberPast = past.filter(p => p.members.includes(member));
  const totalCount = memberPast.length;

  const nextMilestone = Math.ceil(totalCount / 100) * 100;
  const remaining = nextMilestone - totalCount;

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

  const milestones = [];
  for (let m = 100; m <= totalCount; m += 100) {
    const perf = memberPast[m-1];
    if (perf) {
      const stage = perf.stage.replace(selectedGroup, '').trim();
      milestones.push({ date: perf.date, stage, milestone: m });
    }
  }

  const historyRows = memberPast
    .sort((a,b) => a.date !== b.date ? b.date.localeCompare(a.date) : (a.time==='昼'? -1:1))
    .map((p,i,arr) => [arr.length - i, p.date, p.stage.replace(selectedGroup,'').trim(), p.time||'']);

  const stageCountMap = {};
  memberPast.forEach(p => {
    const st = p.stage.replace(selectedGroup,'').trim();
    stageCountMap[st] = (stageCountMap[st]||0)+1;
  });
  const stageRows = Object.entries(stageCountMap).sort((a,b)=>b[1]-a[1]).map(([st,n])=>[st,`${n}回`]);

  const coCounts = {};
  memberPast.forEach(p => p.members.forEach(m => {
    if (m===member) return;
    coCounts[m] = (coCounts[m]||0)+1;
  }));
  const mergedGroupList = [ ...(groups[selectedGroup] || []), ...(groups[selectedGroup + ' 卒業生'] || []) ];
  const coRanking = sortRankingWithTies(Object.entries(coCounts).map(([n,c])=>({name:n,count:c})), mergedGroupList)
    .map(p=>[`${p.rank}位`,p.name,`${p.count}回`]);

  const stagesSorted = Object.keys(stageCountMap).sort((a,b)=>stageCountMap[b]-stageCountMap[a]);
  const stageRanking = {};
  stagesSorted.forEach(st => {
    const counts = {};
    past.filter(p=>p.stage.replace(selectedGroup,'').trim()===st).forEach(p=>{
      p.members.forEach(m=>counts[m]=(counts[m]||0)+1);
    });
    stageRanking[st] = sortRankingWithTies(Object.entries(counts).map(([n,c])=>({name:n,count:c})), mergedGroupList)
      .map(p=>[`${p.rank}位`,p.name,`${p.count}回`]);
  });

  const yearCounts = {};
  memberPast.forEach(p => {
    const y=p.date.slice(0,4);
    yearCounts[y] = (yearCounts[y]||0)+1;
  });
  const yearRows = Object.entries(yearCounts)
    .sort((a,b)=>b[0].localeCompare(a[0]))
    .map(([y,c])=>[`${y}年`,`${c}回`]);

  const yearRanking = {};
  Object.keys(yearCounts).forEach(y=>{
    const counts = {};
    past.filter(p=>p.date.startsWith(y)).forEach(p=>{
      p.members.forEach(m=>counts[m]=(counts[m]||0)+1);
    });
    yearRanking[y] = sortRankingWithTies(Object.entries(counts).map(([n,c])=>({name:n,count:c})), mergedGroupList)
      .map(p=>[`${p.rank}位`,p.name,`${p.count}回`]);
  });

  let html = `<div class="highlight">総出演回数：${totalCount}回</div>`;
  if (remaining > 0 && remaining <= 10) {
    html += `<div style="font-size:1rem;color:#000;margin-top:-8px;margin-bottom:2px;">
      ${nextMilestone}回公演まで あと${remaining}回
    </div>`;
    if (milestoneFutureEvent) {
      const label = milestoneFutureEvent.time
        ? `${milestoneFutureEvent.date} の ${milestoneFutureEvent.stage.replace(selectedGroup,'').trim()}（${milestoneFutureEvent.time}）`
        : `${milestoneFutureEvent.date} の ${milestoneFutureEvent.stage.replace(selectedGroup,'').trim()}`;
      html += `<div style="font-size:1rem;color:#000;margin-top:0;margin-bottom:8px;">${label} で達成予定</div>`;
    }
  }

  html += `<h3>出演履歴</h3>${createTableHTML(['回数','日付','演目','時間'],historyRows)}`;

  if (milestones.length>0) {
    html += `<h3>節目達成日</h3>${createTableHTML(['節目','日付','演目'],milestones.map(m=>[`${m.milestone}回`,m.date,m.stage]))}`;
  }

  html += `<h3>演目別出演回数</h3>${createTableHTML(['演目','回数'],stageRows)}`;
  html += `<h3>演目別出演回数ランキング</h3>${stagesSorted.map(st=>`<details><summary>${st}</summary>${createTableHTML(['順位','名前','回数'],stageRanking[st])}</details>`).join('')}`;
  html += `<h3>年別出演回数</h3>${createTableHTML(['年','回数'],yearRows)}`;
  html += `<h3>年別出演回数ランキング</h3>${Object.entries(yearRanking).map(([y,rows])=>`<details><summary>${y}年</summary>${createTableHTML(['順位','名前','回数'],rows)}</details>`).join('')}`;
  html += `<h3>共演回数ランキング</h3>${createTableHTML(['順位','名前','回数'],coRanking)}`;

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
    groupSelect.disabled = memberSelect.disabled = true;
  }
}

window.addEventListener('DOMContentLoaded', init);