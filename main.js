const GROUPS_URL = './src/data/groups.json';
const PERFORMANCE_BASE = './src/data/performance_';

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

function truncateStageNameLong(name) {
  return name.length > 20 ? name.slice(0, 19) + '…' : name;
}

async function fetchGroups() {
  const res = await fetch(GROUPS_URL);
  if (!res.ok) throw new Error('groups.jsonの取得に失敗しました');
  groups = await res.json();
}

async function fetchPerformancesForGroup(group) {
  const groupKey = group.replace(/\s*卒業生$/, '').toLowerCase();
  const startYear = 2005;
  const currentYear = new Date().getFullYear();
  const allPerformances = [];

  for (let y = startYear; y <= currentYear; y++) {
    const url = `${PERFORMANCE_BASE}${groupKey}_${y}.json?${Date.now()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      allPerformances.push(
        ...json.map((p, index) => ({
          ...p,
          index,
          members: p.members.map(m => m.trim()),
          time: (p.time || "").trim()
        }))
      );
    } catch (e) {
      // 該当ファイルが存在しない場合など、無視
    }
  }
  return allPerformances;
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

  const memberList = groups[selectedGroup] || [];
  memberList.forEach(member => {
    const opt = document.createElement('option');
    opt.value = member;
    opt.textContent = member;
    memberSelect.appendChild(opt);
  });
}

async function fetchPerformances(group) {
  performances = await fetchPerformancesForGroup(group);
}

function sortRankingWithTies(arr, groupList = []) {
  arr.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const ai = groupList.indexOf(a.name), bi = groupList.indexOf(b.name);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
  let lastCount = null, lastRank = 0;
  arr.forEach((item, i) => {
    if (item.count !== lastCount) { lastCount = item.count; lastRank = i + 1; }
    item.rank = lastRank;
  });
  return arr;
}

function sortByDate(a, b, asc = false) {
  if (a.date !== b.date) return asc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
  return asc ? a.index - b.index : b.index - a.index;
}

function onMemberChange() {
  const g = groupSelect.value;
  const member = memberSelect.value;
  output.innerHTML = '';
  if (!g || !member) return;

  const baseGroup = g.replace(/\s*卒業生$/, '');
  const combined = [
    ...(groups[baseGroup] || []),
    ...(groups[baseGroup + ' 卒業生'] || [])
  ];

  fetchPerformances(baseGroup).then(() => {
    const today = getTodayString();
    const rel = performances.filter(p => p.stage.startsWith(baseGroup));
    const past = rel.filter(p => p.date <= today);
    const future = rel.filter(p => p.date > today);

    const mpast = past.filter(p => p.members.includes(member)).sort((a,b)=>sortByDate(a,b,true));
    const total = mpast.length;
    const mfuture = future.filter(p => p.members.includes(member)).sort((a,b)=>sortByDate(a,b,true));

    const nextMilestone = Math.ceil(total/100)*100;
    const rem = nextMilestone - total;
    let milestoneEvent = null;
    if (rem > 0 && rem <= 10) {
      let cnt = total;
      for (const p of mfuture) {
        if (++cnt >= nextMilestone) { milestoneEvent = p; break; }
      }
    }

    const milestones = [];
    for (let m = 100; m <= total; m += 100) {
      const p = mpast[m-1];
      if (p) milestones.push({ milestone: m, date: p.date, stage: truncateStageName(p.stage.replace(baseGroup, '').trim()) });
    }
    milestones.sort((a,b)=>b.milestone-a.milestone);

    const historyRows = mpast.slice().sort((a,b)=>sortByDate(a,b,false)).map((p,i)=>[
      i+1, p.date, truncateStageName(p.stage.replace(baseGroup,'').trim()), p.time || ''
    ]);
    const futureRows = mfuture.map((p,i)=>[
      total+i+1, p.date, truncateStageName(p.stage.replace(baseGroup,'').trim()), p.time || ''
    ]);

    const stageMap = {};
    mpast.forEach(p => {
      const st = p.stage.replace(baseGroup,'').trim();
      stageMap[st] = (stageMap[st] || 0) + 1;
    });
    const stageRows = Object.entries(stageMap).sort((a,b)=>b[1]-a[1])
      .map(([st,cnt])=>[truncateStageNameLong(st), `${cnt}回`]);

    const stageRankings = Object.entries(stageMap).sort((a,b)=>b[1]-a[1]).map(([st]) => {
      const counts = {};
      past.filter(p => p.stage.replace(baseGroup,'').trim() === st)
        .forEach(p => p.members.forEach(m=>counts[m]=(counts[m]||0)+1));
      const ranked = sortRankingWithTies(Object.entries(counts).map(([n,c])=>({name:n,count:c})), combined)
        .map(p=>[`${p.rank}位`, p.name, `${p.count}回`]);
      return { stage: st, rows: ranked };
    });

    const yearMap = {};
    mpast.forEach(p => {
      const y = p.date.slice(0,4);
      yearMap[y] = (yearMap[y] || 0) + 1;
    });
    const yearRows = Object.entries(yearMap).sort((a,b)=>b[0].localeCompare(a[0]))
      .map(([y,c])=>[`${y}年`, `${c}回`]);

    const yearRankings = {};
    Object.keys(yearMap).forEach(y => {
      const counts = {};
      past.filter(p => p.date.startsWith(y)).forEach(p => {
        p.members.forEach(m=>counts[m]=(counts[m]||0)+1);
      });
      yearRankings[y] = sortRankingWithTies(Object.entries(counts).map(([n,c])=>({name:n,count:c})), combined)
        .map(p=>[`${p.rank}位`, p.name, `${p.count}回`]);
    });

    const coCounts = {};
    mpast.forEach(p => {
      p.members.filter(m=>m!==member).forEach(m=>coCounts[m]=(coCounts[m]||0)+1);
    });
    const coRanking = sortRankingWithTies(Object.entries(coCounts).map(([n,c])=>({name:n,count:c})), combined)
      .map(p=>[`${p.rank}位`, p.name, `${p.count}回`]);
    const coDetails = coRanking.map(([rank, name, cnt]) => {
      const cop = mpast.filter(p=>p.members.includes(name)).sort((a,b)=>sortByDate(a,b,false));
      const rows = cop.map((p,i)=>[`${parseInt(cnt)-i}`, p.date, truncateStageName(p.stage.replace(baseGroup,'').trim()), p.time||'']);
      return `<details><summary>${name}</summary>${createTableHTML(['回数','日付','演目','時間'], rows)}</details>`;
    }).join('');

    // ✨ HTML出力
    let html = `<div class="highlight">総出演回数：${total}回</div>`;
    html += `<h3>出演履歴</h3>${createTableHTML(['回数','日付','演目','時間'], historyRows)}`;
    if (futureRows.length) html += `<h3>今後の出演予定</h3>${createTableHTML(['回数','日付','演目','時間'], futureRows)}`;
    if (milestones.length) html += `<h3>節目達成日</h3>${createTableHTML(['節目','日付','演目'], milestones.map(m=>[`${m.milestone}回`, m.date, m.stage]))}`;
    html += `<h3>演目別出演回数</h3>${createTableHTML(['演目','回数'], stageRows)}`;
    html += `<h3>演目別出演回数ランキング</h3>` +
      stageRankings.map(sr=>`<details><summary>${sr.stage}</summary>` +
        createTableHTML(['順位','名前','回数'], sr.rows)+`</details>`).join('');
    html += `<h3>年別出演回数</h3>${createTableHTML(['年','回数'], yearRows)}`;
    html += `<h3>年別出演回数ランキング</h3>` +
      Object.entries(yearRankings).sort((a,b)=>b[0].localeCompare(a[0]))
        .map(([y,rows])=>`<details><summary>${y}年</summary>`+
          createTableHTML(['順位','名前','回数'], rows)+`</details>`).join('');
    html += `<h3>共演回数ランキング</h3>${createTableHTML(['順位','名前','回数'], coRanking)}`;
    html += `<h3>共演履歴</h3>${coDetails}`;

    output.innerHTML = html;
  }).catch(e => {
    output.innerHTML = `<p style="color:red;">読み込みエラー: ${e.message}</p>`;
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await fetchGroups();
    setupGroupOptions();
    groupSelect.addEventListener('change', onGroupChange);
    memberSelect.addEventListener('change', onMemberChange);
  } catch (e) {
    output.innerHTML = `<p style="color:red;">初期設定エラー: ${e.message}</p>`;
    groupSelect.disabled = memberSelect.disabled = true;
  }
});