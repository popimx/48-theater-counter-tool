const GROUPS_URL = './src/data/groups.json';
const PERFORMANCE_FILES_URL = './src/data/performance_files.json';

let groups = {};
let groupFiles = {};
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
const dateSelect = document.getElementById('date-select');

function getTodayString() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 出演履歴・今後・共演履歴用省略（11文字）
function truncateStageName(stageName) {
  const specialCases = {
    '難波愛～今、小嶋が思うこと～': '難波愛～今、小嶋が思…',
    'きっと見つかる、KOIしてLOVEしてきゅんmart': 'きっと見つかる、KOI…',
    '夢を死なせるわけにいかない': '夢を死なせるわけにい…',
    'ミネルヴァよ、風を起こせ': 'ミネルヴァよ、風を起…',
    'ヤバいよ！ついて来れんのか？！': 'ヤバいよ！ついて来れ…',
    '君も8で泣こうじゃないか': '君も8で泣こうじゃな…',
    'その雫は、未来へと繋がる虹になる。': 'その雫は、未来へと繋…',
    'アップカミング公演〜THE END〜': 'アップカミング公演〜T…',
    "We're Growing Up〜2nd〜": "We're Growing Up〜…",
    'もっと！みんなで一緒にみくもんもん': 'もっと！みんなで一緒…'
  };
  if (specialCases[stageName]) return specialCases[stageName];

  const hasJapanese = /[ぁ-んァ-ン一-龥]/.test(stageName);
  const limit = hasJapanese ? 11 : 9;
  let count = 0, cutIndex = 0;
  for (const ch of stageName) {
    count += hasJapanese ? 1 : 0.5;
    cutIndex++;
    if (count > limit) break;
  }
  return count > limit ? stageName.slice(0, cutIndex) + '…' : stageName;
}

// 演目別出演回数用省略（17文字、英数字・記号0.5文字）
function truncateStageNameLong(stageName) {
  let count = 0, cutIndex = 0;
  for (const ch of stageName) {
    count += /[ぁ-んァ-ン一-龥]/.test(ch) ? 1 : 0.5;
    cutIndex++;
    if (count > 17) break;
  }
  return count > 17 ? stageName.slice(0, cutIndex) + '…' : stageName;
}

// fetch groups.json
async function fetchGroups() {
  const res = await fetch(GROUPS_URL);
  if (!res.ok) throw new Error('groups.jsonの取得に失敗しました');
  groups = await res.json();
}

// fetch performance_files.json
async function fetchPerformanceFiles() {
  const res = await fetch(PERFORMANCE_FILES_URL);
  if (!res.ok) throw new Error('performance_files.jsonの取得に失敗しました');
  groupFiles = await res.json();
}

async function loadPerformancesByGroup(group) {
  if (!groupFiles[group]) return [];

  const relatedGroups = [group];
  if (groupFiles[group + ' 卒業生']) relatedGroups.push(group + ' 卒業生');

  const files = Array.from(new Set(relatedGroups.flatMap(g => groupFiles[g] || [])));
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
          time: '' // 時間表記非表示だがデータは保持
        })));
      } else console.warn(`ファイル取得失敗: ${file}`);
    } catch (e) {
      console.warn(`読み込みエラー: ${file}`, e);
    }
  }

  const seen = new Set();
  const uniquePerformances = [];
  const uniqueKey = (p) => `${p.date}_${p.stage}_${p.members.join(',')}`;
  for (const p of results) {
    const key = uniqueKey(p);
    if (!seen.has(key)) {
      seen.add(key);
      uniquePerformances.push(p);
    }
  }
  return uniquePerformances;
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
  memberSelect.innerHTML = '<option value="">メンバーを選択</option>';
  memberSelect.disabled = !selectedGroup;
  output.innerHTML = '';
  performances = [];
  if (!selectedGroup) return;

  const memberList = groups[selectedGroup] || [];
  for (const member of memberList) {
    const opt = document.createElement('option');
    opt.value = member;
    opt.textContent = member;
    memberSelect.appendChild(opt);
  }

  output.textContent = 'データを読み込み中…';
  loadPerformancesByGroup(selectedGroup).then(loadedPerformances => {
    performances = loadedPerformances;
    output.textContent = '';
  }).catch(e => {
    output.innerHTML = `<p style="color:red;">データ読み込みエラー: ${e.message}</p>`;
  });
}

// createTableHTML：columnClasses 対応
function createTableHTML(headers, rows, tableClass = '', columnClasses = []) {
  const classAttr = tableClass ? ` class="${tableClass}"` : '';
  return `
    <table${classAttr}>
      <thead><tr>${
        headers.map((h,i)=>`<th${columnClasses[i]?` class="${columnClasses[i]}"`:''}>${h}</th>`).join('')
      }</tr></thead>
      <tbody>
        ${rows.map(row=>`<tr>${row.map((c,i)=>`<td${columnClasses[i]?` class="${columnClasses[i]}"`:''}>${c}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;
}

function sortRankingWithTies(arr, groupList=[]) {
  arr.sort((a,b)=>{
    if(b.count !== a.count) return b.count - a.count;
    const aIndex = groupList.indexOf(a.name), bIndex = groupList.indexOf(b.name);
    if(aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if(aIndex !== -1) return -1;
    if(bIndex !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  let lastCount=null, lastRank=0;
  arr.forEach((item,i)=>{
    if(item.count !== lastCount) {
      lastCount = item.count;
      lastRank = i+1;
    }
    item.rank = lastRank;
  });
  return arr;
}

function sortByDateDescendingWithIndex(a,b) {
  if(a.date!==b.date) return b.date.localeCompare(a.date);
  return b.index - a.index;
}

function sortByDateAscendingWithIndex(a,b) {
  if(a.date!==b.date) return a.date.localeCompare(b.date);
  return a.index - b.index;
}

// 日付選択（2005-12-08〜今日）
function populateDateSelect() {
  const startDate = new Date('2005-12-08');
  const today = new Date();
  const dates = [];

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }

  dateSelect.innerHTML = '';
  dates.forEach(dateStr => {
    const opt = document.createElement('option');
    opt.value = dateStr;
    opt.textContent = dateStr;
    dateSelect.appendChild(opt);
  });

  dateSelect.value = dates[0]; // 初期値2005-12-08
}

function getSelectedDateString() { return dateSelect.value||getTodayString(); }
dateSelect.addEventListener('change',()=>{ if(memberSelect.value) onMemberChange(); });

// onMemberChange
async function onMemberChange() {
  const selectedGroup = groupSelect.value;
  const member = memberSelect.value;
  output.innerHTML = '';
  if(!selectedGroup || !member) return;
  if(!performances.length){
    output.textContent = 'データを読み込み中…';
    performances = await loadPerformancesByGroup(selectedGroup);
    output.textContent = '';
  }

  const targetGroup = selectedGroup.replace(' 卒業生','');
  const combinedMembers = [...(groups[targetGroup]||[]), ...(groups[targetGroup+' 卒業生']||[])];

  const todayStr = getTodayString(); // 常に今日まで
  const relevantPerformances = performances.filter(p=>p.stage.startsWith(targetGroup));
  const pastPerformances = relevantPerformances.filter(p=>p.date<=todayStr);
  const futurePerformances = relevantPerformances.filter(p=>p.date>todayStr);

  const memberPast = pastPerformances.filter(p=>p.members.includes(member)).sort(sortByDateAscendingWithIndex).map((p,i)=>({...p,count:i+1}));
  const totalCount = memberPast.length;
  const memberFuture = futurePerformances.filter(p=>p.members.includes(member)).sort(sortByDateAscendingWithIndex);

  const nextMilestone = Math.ceil(totalCount/100)*100;
  const remaining = nextMilestone - totalCount;
  let milestoneFutureEvent=null;
  if(remaining>0 && remaining<=10){
    let count = totalCount;
    for(const perf of memberFuture){
      if(++count>=nextMilestone){ milestoneFutureEvent=perf; break; }
    }
  }

  const milestones=[];
  for(let m=100;m<=totalCount;m+=100){
    const perf=memberPast[m-1];
    if(perf){
      const stageName = truncateStageName(perf.stage.replace(targetGroup,'').trim());
      milestones.push({date:perf.date,stage:stageName,milestone:m});
    }
  }
  const sortedMilestones = milestones.sort((a,b)=>b.milestone-a.milestone);

  // 出演履歴
  const historyRows = memberPast.slice().sort(sortByDateDescendingWithIndex).map(p=>[
    p.count,
    p.date,
    truncateStageName(p.stage.replace(targetGroup,'').trim())
  ]);

  // 今後（表示はdate-endが今日なら）
  const futureRows = [];
  if(dateSelect.value === todayStr){
    memberFuture.forEach((p,i)=>{
      futureRows.push([
        totalCount+i+1,
        p.date,
        truncateStageName(p.stage.replace(targetGroup,'').trim())
      ]);
    });
  }

  // 演目別出演回数
  const stageCountMap = {};
  memberPast.forEach(p=>{
    const stageName=p.stage.replace(targetGroup,'').trim();
    stageCountMap[stageName]=(stageCountMap[stageName]||0)+1;
  });
  const stageRows = Object.entries(stageCountMap).sort((a,b)=>b[1]-a[1]).map(([stage,count])=>[truncateStageNameLong(stage),`${count}回`]);

  // 共演回数
  const coCounts = {};
  memberPast.forEach(p=>p.members.forEach(m=>{ if(m!==member) coCounts[m]=(coCounts[m]||0)+1; }));
  const coRanking = sortRankingWithTies(Object.entries(coCounts).map(([name,count])=>({name,count})),combinedMembers).map(p=>[`${p.rank}位`,p.name,`${p.count}回`]);

  // 共演履歴HTML
  const coHistoryHtml = coRanking.map(([rankStr,coMember,countStr])=>{
    const count=parseInt(countStr);
    const coPerformances=memberPast.filter(p=>p.members.includes(coMember)).sort(sortByDateDescendingWithIndex);
    const rows=coPerformances.map((p,i)=>[count-i,p.date,truncateStageName(p.stage.replace(targetGroup,'').trim())]);
    return `<details><summary>${coMember}</summary>${createTableHTML(['回数','日付','演目'],rows,'co-history-table',['','','stage-column-11'])}</details>`;
  }).join('');

  // 年別出演回数
  const yearCounts={};
  memberPast.forEach(p=>{ const y=p.date.slice(0,4); yearCounts[y]=(yearCounts[y]||0)+1; });
  const yearRows=Object.entries(yearCounts).sort((a,b)=>b[0].localeCompare(a[0])).map(([year,count])=>[`${year}年`,`${count}回`]);

  // 年別出演回数ランキング
  const yearRanking={};
  Object.keys(yearCounts).forEach(year=>{
    const counts={};
    pastPerformances.filter(p=>p.date.startsWith(year)).forEach(p=>p.members.forEach(m=>counts[m]=(counts[m]||0)+1));
    yearRanking[year]=sortRankingWithTies(Object.entries(counts).map(([name,count])=>({name,count})),combinedMembers).map(p=>[`${p.rank}位`,p.name,`${p.count}回`]);
  });

  // HTML生成
  let html=`<div class="highlight">総出演回数：${totalCount}回</div>`;
  if(remaining>0 && remaining<=10){
    html+=`<div style="font-size:1rem;color:#000;margin-top:-8px;margin-bottom:2px;">${nextMilestone}回公演まであと${remaining}回</div>`;
    if(milestoneFutureEvent){
      const d=new Date(milestoneFutureEvent.date);
      const dateStr=`${d.getMonth()+1}月${d.getDate()}日`;
      const stageName = truncateStageName(milestoneFutureEvent.stage.replace(targetGroup,'').trim());
      html+=`<div style="font-size:1rem;color:#000;margin-top:0;margin-bottom:8px;">${dateStr}の ${stageName}公演 で達成予定</div>`;
    }
  }

  html+=`<h3>出演履歴</h3>${createTableHTML(['回数','日付','演目'],historyRows,'history-table',['','','stage-column-11'])}`;
  if(futureRows.length>0) html+=`<h3>今後の出演予定</h3>${createTableHTML(['回数','日付','演目'],futureRows,'history-table',['','','stage-column-11'])}`;
  if(sortedMilestones.length>0) html+=`<h3>節目達成日</h3>${createTableHTML(['節目','日付','演目'],sortedMilestones.map(m=>[m.milestone,m.date,m.stage]),'history-table',['','','stage-column-11'])}`;
  html+=`<h3>演目別出演回数</h3>${createTableHTML(['演目','回数'],stageRows,'stage-table',['stage-column-20',''])}`;

  html+=`<h3>演目別出演回数ランキング</h3>${
    Object.keys(stageCountMap).sort((a,b)=>stageCountMap[b]-stageCountMap[a]).map(stage=>`<details><summary>${stage}</summary>${createTableHTML(['順位','名前','回数'],(function(){
      const counts={};
      pastPerformances.filter(p=>p.stage.replace(targetGroup,'').trim()===stage).forEach(p=>p.members.forEach(m=>counts[m]=(counts[m]||0)+1));
      return sortRankingWithTies(Object.entries(counts).map(([name,count])=>({name,count})),combinedMembers).map(p=>[`${p.rank}位`,p.name,`${p.count}回`]);
    })())}</details>`).join('')
  }`;

  html+=`<h3>年別出演回数</h3>${createTableHTML(['年','回数'],yearRows)}`;
  html+=`<h3>年別出演回数ランキング</h3>${
    Object.entries(yearRanking).map(([year,ranks])=>`<details><summary>${year}年</summary>${createTableHTML(['順位','名前','回数'],ranks)}</details>`).join('')
  }`;

  html+=`<h3>共演回数ランキング</h3>${createTableHTML(['順位','名前','回数'],coRanking)}`;
  html+=`<h3>共演履歴</h3>${coHistoryHtml}`;

  output.innerHTML = html;
}

window.addEventListener('DOMContentLoaded', async () => {
  await fetchGroups();
  await fetchPerformanceFiles();
  setupGroupOptions();
  populateDateSelect();

  groupSelect.addEventListener('change', onGroupChange);
  memberSelect.addEventListener('change', onMemberChange);
});