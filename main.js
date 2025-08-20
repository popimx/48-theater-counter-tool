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
  let lengthCount = 0;
  for (const ch of stageName) {
    lengthCount += /[ぁ-んァ-ン一-龥]/.test(ch) ? 1 : 0.5;
  }
  if (lengthCount <= limit) return stageName;

  let count = 0;
  let cutIndex = 0;
  for (const ch of stageName) {
    count += /[ぁ-んァ-ン一-龥]/.test(ch) ? 1 : 0.5;
    cutIndex++;
    if (count > limit) break;
  }
  return stageName.slice(0, cutIndex) + '…';
}

function truncateStageNameLong(stageName) {
  let lengthCount = 0;
  for (const ch of stageName) {
    lengthCount += /[ぁ-んァ-ン一-龥]/.test(ch) ? 1 : 0.5;
  }
  if (lengthCount <= 17) return stageName;

  let count = 0;
  let cutIndex = 0;
  for (const ch of stageName) {
    count += /[ぁ-んァ-ン一-龥]/.test(ch) ? 1 : 0.5;
    cutIndex++;
    if (count > 17) break;
  }
  return stageName.slice(0, cutIndex) + '…';
}

// 全公演データの演目列最大文字数を取得（省略後の表示文字数でカウント）
function getMaxStageLength(allPerformances) {
  let maxLength = 0;
  allPerformances.forEach(p => {
    const stageName = truncateStageName(p.stage.replace(/^(AKB48|SKE48|NMB48|HKT48|NGT48|STU48)/, '').trim());
    let lengthCount = 0;
    for (const ch of stageName) {
      lengthCount += /[ぁ-んァ-ン一-龥]/.test(ch) ? 1 : 0.5;
    }
    if (lengthCount > maxLength) maxLength = lengthCount;
  });
  return maxLength;
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
          time: (p.time || "").trim()
        })));
      } else console.warn(`ファイル取得失敗: ${file}`);
    } catch (e) {
      console.warn(`読み込みエラー: ${file}`, e);
    }
  }

  // 重複排除
  const seen = new Set();
  const uniquePerformances = [];
  const uniqueKey = (p) => `${p.date}_${p.stage}_${p.time}_${p.members.join(',')}`;
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

async function onMemberChange() {
  const selectedGroup = groupSelect.value;
  const member = memberSelect.value;
  output.innerHTML = '';

  if (!selectedGroup || !member) return;

  if (!performances.length) {
    output.textContent = 'データを読み込み中…';
    performances = await loadPerformancesByGroup(selectedGroup);
    output.textContent = '';
  }

  const targetGroup = selectedGroup.replace(' 卒業生', '');
  const combinedMembers = [
    ...(groups[targetGroup] || []),
    ...(groups[targetGroup + ' 卒業生'] || [])
  ];

  const todayStr = getSelectedDateString();
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

  // 全演目で最大文字数を計算（過去・未来・演目別・共演用）
  const allStageNames = [
    ...memberPast.map(p => truncateStageName(p.stage.replace(targetGroup, '').trim())),
    ...memberFuture.map(p => truncateStageName(p.stage.replace(targetGroup, '').trim())),
    ...Object.keys(memberPast.reduce((acc, p) => {
      const stage = p.stage.replace(targetGroup, '').trim();
      acc[stage] = true;
      return acc;
    }, {}))
  ];

  const stageMaxLength = Math.max(...allStageNames.map(name => {
    let len = 0;
    for (const ch of name) len += /[ぁ-んァ-ン一-龥]/.test(ch) ? 1 : 0.5;
    return len;
  }));

  function truncateStageUniform(stageName) {
    let count = 0;
    let cutIndex = 0;
    for (const ch of stageName) {
      count += /[ぁ-んァ-ン一-龥]/.test(ch) ? 1 : 0.5;
      cutIndex++;
      if (count > stageMaxLength) break;
    }
    return stageName.slice(0, cutIndex) + (count > stageMaxLength ? '…' : '');
  }

  // 出演履歴
  const historyRows = memberPast.slice().sort(sortByDateDescendingWithIndex).map(p => [
    p.count,
    p.date,
    truncateStageUniform(p.stage.replace(targetGroup, '').trim()),
    p.time || ''
  ]);

  // 今後の出演予定
  const futureRows = memberFuture.map((p, i) => [
    totalCount + i + 1,
    p.date,
    truncateStageUniform(p.stage.replace(targetGroup, '').trim()),
    p.time || ''
  ]);

  // 演目別出演回数
  const stageCountMap = {};
  memberPast.forEach(p => {
    const stage = p.stage.replace(targetGroup, '').trim();
    stageCountMap[stage] = (stageCountMap[stage] || 0) + 1;
  });
  const stageRows = Object.entries(stageCountMap)
    .sort((a, b) => b[1] - a[1])
    .map(([stage, count]) => [truncateStageUniform(stage), `${count}回`]);

  // 共演回数と共演履歴
  const coCounts = {};
  memberPast.forEach(p => {
    p.members.forEach(m => {
      if (m !== member) coCounts[m] = (coCounts[m] || 0) + 1;
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
      truncateStageUniform(p.stage.replace(targetGroup, '').trim()),
      p.time || ''
    ]);
    return `
      <details>
        <summary>${coMember}</summary>
        ${createTableHTML(['回数', '日付', '演目', '時間'], rows)}
      </details>
    `;
  }).join('');

  // 年別出演回数とランキング
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

  // HTML生成（指定順序で出力）
  let html = `<div class="highlight">総出演回数：${totalCount}回</div>`;

  if (remaining > 0 && remaining <= 10 && milestoneFutureEvent) {
    const d = new Date(milestoneFutureEvent.date);
    const dateStr = `${d.getMonth() + 1}月${d.getDate()}日`;
    const stageName = truncateStageUniform(milestoneFutureEvent.stage.replace(targetGroup, '').trim());
    html += `<div style="font-size:1rem;color:#000;margin-top:-8px;margin-bottom:8px;">
      ${nextMilestone}回公演まであと${remaining}回。${dateStr}の ${stageName}公演 で達成予定
    </div>`;
  }

  // 1. 出演履歴
  html += `<h3>出演履歴</h3>${createTableHTML(['回数', '日付', '演目', '時間'], historyRows)}`;

  // 2. 今後の出演予定
  if (futureRows.length) html += `<h3>今後の出演予定</h3>${createTableHTML(['回数', '日付', '演目', '時間'], futureRows)}`;

  // 3. 節目達成日
  const milestones = [];
  for (let m = 100; m <= totalCount; m += 100) {
    const perf = memberPast[m - 1];
    if (perf) {
      const stageName = truncateStageUniform(perf.stage.replace(targetGroup, '').trim());
      milestones.push({ date: perf.date, stage: stageName, milestone: m });
    }
  }
  const sortedMilestones = milestones.sort((a, b) => b.milestone - a.milestone);
  if (sortedMilestones.length) {
    html += `<h3>節目達成日</h3>${createTableHTML(['節目', '日付', '演目'], sortedMilestones.map(m => [`${m.milestone}回`, m.date, m.stage]))}`;
  }

  // 4. 演目別出演回数
  html += `<h3>演目別出演回数</h3>${createTableHTML(['演目', '回数'], stageRows)}`;

  // 5. 演目別出演回数ランキング
  html += `<h3>演目別出演回数ランキング</h3>${
    Object.keys(stageCountMap).sort((a, b) => stageCountMap[b] - stageCountMap[a])
      .map(stage => `<details><summary>${truncateStageUniform(stage)}</summary>${createTableHTML(
        ['順位', '名前', '回数'],
        (function() {
          const counts = {};
          pastPerformances.filter(p => p.stage.replace(targetGroup, '').trim() === stage)
            .forEach(p => p.members.forEach(m => counts[m] = (counts[m] || 0) + 1));
          return sortRankingWithTies(
            Object.entries(counts).map(([name, count]) => ({ name, count })),
            combinedMembers
          ).map(p => [`${p.rank}位`, p.name, `${p.count}回`]);
        })()
      )}</details>`).join('')
  } `;

  // 6. 年別出演回数
  html += `<h3>年別出演回数</h3>${createTableHTML(['年', '回数'], yearRows)}`;

  // 7. 年別出演回数ランキング
  html += `<h3>年別出演回数ランキング</h3>${
    Object.entries(yearRanking)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, rows]) => `<details><summary>${year}年</summary>${createTableHTML(['順位', '名前', '回数'], rows)}</details>`)
      .join('')
  }`;

  // 8. 共演回数ランキング
  html += `<h3>共演回数ランキング</h3>${createTableHTML(['順位', '名前', '回数'], coRanking)}`;

  // 9. 共演履歴
  html += `<h3>共演履歴</h3>${coHistoryHtml}`;

  output.innerHTML = html;
}

