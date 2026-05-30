// =====================
// APP STATE
// =====================
let currentChildIndex = 0;
let selectedGrade = null;
let selectedAvatar = null;

// =====================
// LOCAL STORAGE HELPERS
// =====================
function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function loadData(key) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

// =====================
// SCHOOL YEAR HELPERS
// =====================
function generateYearLabel(schoolYearStart) {
  const now = new Date();
  const monthNames = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const startMonthIndex = monthNames.indexOf(schoolYearStart || 'august');
  let startYear = now.getFullYear();
  if (now.getMonth() < startMonthIndex) {
    startYear = now.getFullYear() - 1;
  }
  return startYear + '-' + (startYear + 1);
}

function createSchoolYear(label, schoolYearStart) {
  const monthNames = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const startMonthIndex = monthNames.indexOf(schoolYearStart || 'august');
  const parts = label.split('-');
  const startYear = parseInt(parts[0]);
  return {
    id: Date.now(),
    label,
    startDate: new Date(startYear, startMonthIndex, 1).toISOString(),
    endDate: new Date(startYear + 1, startMonthIndex, 0).toISOString(),
    subjects: [],
    weeklyLogs: [],
    quarterSettings: {
      q1: { start: '', end: '' },
      q2: { start: '', end: '' },
      q3: { start: '', end: '' },
      q4: { start: '', end: '' }
    },
    isActive: true,
    createdAt: new Date().toISOString()
  };
}

function getActiveYear(child) {
  if (!child.schoolYears) return null;
  return child.schoolYears.find(y => y.isActive) || child.schoolYears[child.schoolYears.length - 1];
}

function getSubjects(child) {
  const year = getActiveYear(child);
  return year ? year.subjects : [];
}

function getLogs(child) {
  const year = getActiveYear(child);
  return year ? year.weeklyLogs : [];
}

// =====================
// DATA CONSTRUCTORS
// =====================
function createFamily(officialName, nickname, schoolYearStart) {
  return {
    id: Date.now(),
    officialName,
    nickname,
    schoolYearStart,
    children: [],
    createdAt: new Date().toISOString()
  };
}

function createChild(name, grade, avatar, schoolYearStart) {
  const yearLabel = generateYearLabel(schoolYearStart);
  const schoolYear = createSchoolYear(yearLabel, schoolYearStart);
  return {
    id: Date.now(),
    name,
    grade,
    avatar,
    schoolYears: [schoolYear],
    createdAt: new Date().toISOString()
  };
}

// =====================
// SCREEN NAVIGATION
// =====================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  window.scrollTo(0, 0);
}

// =====================
// ONBOARDING
// =====================
document.getElementById('btn-onboarding-continue').addEventListener('click', () => {
  const officialName = document.getElementById('official-name').value.trim();
  const nickname = document.getElementById('nickname').value.trim();
  const schoolYearStart = document.getElementById('year-start').value;

  if (!officialName || !nickname) {
    alert('Please fill in both school names to continue.');
    return;
  }

  const family = createFamily(officialName, nickname, schoolYearStart);
  saveData('family', family);
  document.getElementById('display-nickname').textContent = '✦ ' + nickname;
  showScreen('screen-add-child');
});

// =====================
// GRADE SELECTION
// =====================
document.querySelectorAll('.grade-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.grade-chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    selectedGrade = chip.dataset.grade;
  });
});

// =====================
// AVATAR SELECTION
// =====================
document.querySelectorAll('.avatar-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.avatar-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedAvatar = opt.dataset.avatar;
  });
});

// =====================
// ADD CHILD
// =====================
document.getElementById('btn-add-child').addEventListener('click', () => {
  const name = document.getElementById('child-name').value.trim();

  if (!name) { alert('Please enter your child\'s name.'); return; }
  if (!selectedGrade) { alert('Please select a grade level.'); return; }
  if (!selectedAvatar) { alert('Please pick an avatar.'); return; }

  const family = loadData('family');
  const child = createChild(name, selectedGrade, selectedAvatar, family.schoolYearStart);
  family.children.push(child);
  saveData('family', family);

  currentChildIndex = family.children.length - 1;
  renderDashboard();
  showScreen('screen-dashboard');
});

// =====================
// STREAK CALCULATION
// =====================
function calculateStreak(child) {
  const logs = getLogs(child);
  if (!logs || logs.length === 0) return 0;

  const sorted = [...logs].sort((a, b) => b.weekNumber - a.weekNumber);
  const family = loadData('family');
  const currentWeek = getWeekNumber(family);

  let streak = 0;
  let expectedWeek = currentWeek;
  let graceUsed = false;

  for (let i = 0; i < sorted.length; i++) {
    const log = sorted[i];
    if (log.weekNumber === expectedWeek) {
      streak++;
      expectedWeek--;
    } else if (!graceUsed && log.weekNumber === expectedWeek - 1) {
      graceUsed = true;
      streak++;
      expectedWeek = log.weekNumber - 1;
    } else {
      break;
    }
  }
  return streak;
}

// =====================
// RECENT GLOWS
// =====================
function renderRecentGlows(child) {
  const container = document.getElementById('recent-glows-list');
  if (!container) return;

  const logs = getLogs(child);

  if (!logs || logs.length === 0) {
    container.innerHTML = `<p style="font-size:14px;color:var(--color-text-secondary);margin-bottom:12px">No glows yet. Log your first week to capture a highlight.</p>`;
    return;
  }

  const glowLogs = [...logs]
    .filter(log => log.glow && log.glow.trim() !== '')
    .sort((a, b) => b.weekNumber - a.weekNumber)
    .slice(0, 3);

  if (glowLogs.length === 0) {
    container.innerHTML = `<p style="font-size:14px;color:var(--color-text-secondary);margin-bottom:12px">No glows recorded yet. Add a glow when you log your next week.</p>`;
    return;
  }

  container.innerHTML = glowLogs.map(log => {
    const isAdventure = log.logType === 'adventure';
    const dotColor = isAdventure ? 'var(--color-pink)' : 'var(--color-accent)';
    const weekLabel = 'Week ' + log.weekNumber + ' · ' + (isAdventure ? 'Adventure week' : 'School week');
    const date = new Date(log.startDate);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `
      <div class="glow-entry">
        <div class="glow-dot" style="background:${dotColor}"></div>
        <div class="glow-entry-content">
          <div class="glow-entry-text">${log.glow}</div>
          <div class="glow-entry-meta">${weekLabel} · ${dateStr}</div>
        </div>
      </div>
    `;
  }).join('');
}

// =====================
// GEM CALCULATION
// =====================
function getEarnedGems(child, family) {
  const gems = [
    { month: 0,  name: 'Garnet',     color: '#8B0000', stroke: '#c0392b' },
    { month: 1,  name: 'Amethyst',   color: '#4a235a', stroke: '#8e44ad' },
    { month: 2,  name: 'Aquamarine', color: '#1a6b7a', stroke: '#1abc9c' },
    { month: 3,  name: 'Diamond',    color: '#c8d8e8', stroke: '#e8f4f8' },
    { month: 4,  name: 'Emerald',    color: '#145a32', stroke: '#27ae60' },
    { month: 5,  name: 'Pearl',      color: '#c0a080', stroke: '#f0d0a0' },
    { month: 6,  name: 'Ruby',       color: '#7b0000', stroke: '#e74c3c' },
    { month: 7,  name: 'Peridot',    color: '#4a6741', stroke: '#82c366' },
    { month: 8,  name: 'Sapphire',   color: '#1a3a6b', stroke: '#5b8dd9' },
    { month: 9,  name: 'Opal',       color: '#5c3a1e', stroke: '#c8a060' },
    { month: 10, name: 'Topaz',      color: '#2d4a6b', stroke: '#6a9fd8' },
    { month: 11, name: 'Turquoise',  color: '#0d4f4f', stroke: '#38bdf8' }
  ];

  const monthNames = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const startMonthIndex = monthNames.indexOf(family.schoolYearStart || 'august');

  const orderedGems = [];
  for (let i = 0; i < 12; i++) {
    orderedGems.push(gems[(startMonthIndex + i) % 12]);
  }

  const logs = getLogs(child);
  const loggedMonths = new Set();
  if (logs) {
    logs.forEach(log => {
      loggedMonths.add(new Date(log.startDate).getMonth());
    });
  }

  return orderedGems.map(gem => ({ ...gem, earned: loggedMonths.has(gem.month) }));
}

function renderGemSVG(gem, size = 24) {
  const h = Math.round(size * 1.2);
  if (!gem.earned) {
    return `<svg width="${size}" height="${h}" viewBox="0 0 30 36" title="${gem.name}">
      <polygon points="15,2 28,10 28,26 15,34 2,26 2,10"
        fill="#2a2040" stroke="#3d3060" stroke-width="0.5" opacity="0.4"/>
    </svg>`;
  }
  return `<svg width="${size}" height="${h}" viewBox="0 0 30 36" title="${gem.name}">
    <polygon points="15,2 28,10 28,26 15,34 2,26 2,10"
      fill="${gem.color}" stroke="${gem.stroke}" stroke-width="0.5"/>
    <polygon points="15,2 28,10 15,18" fill="${gem.stroke}" opacity="0.5"/>
    <polygon points="15,2 2,10 15,18" fill="${gem.color}" opacity="0.8"/>
    <line x1="12" y1="8" x2="18" y2="14" stroke="white" stroke-width="0.5" opacity="0.4"/>
  </svg>`;
}

function getCurrentMonthGem() {
  const gems = [
    { name: 'Garnet' },    { name: 'Amethyst' },   { name: 'Aquamarine' },
    { name: 'Diamond' },   { name: 'Emerald' },     { name: 'Pearl' },
    { name: 'Ruby' },      { name: 'Peridot' },     { name: 'Sapphire' },
    { name: 'Opal' },      { name: 'Topaz' },       { name: 'Turquoise' }
  ];
  return gems[new Date().getMonth()];
}

// =====================
// WEEK HELPERS
// =====================
function getWeekStartDate() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  return monday;
}

function getWeekNumber(family) {
  if (!family.schoolYearStart) return 1;
  const now = new Date();
  const monthNames = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const startMonthIndex = monthNames.indexOf(family.schoolYearStart);
  let startYear = now.getFullYear();
  if (now.getMonth() < startMonthIndex) startYear = now.getFullYear() - 1;
  const schoolStart = new Date(startYear, startMonthIndex, 1);
  if (now < schoolStart) return 1;
  const diff = now - schoolStart;
  const weeks = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.min(52, Math.max(1, weeks));
}

function formatWeekDates(startDate) {
  const end = new Date(startDate);
  end.setDate(startDate.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return startDate.toLocaleDateString('en-US', opts) + ' – ' + end.toLocaleDateString('en-US', opts);
}

function getCurrentWeekDates() {
  return formatWeekDates(getWeekStartDate());
}

// =====================
// DASHBOARD
// =====================
function renderDashboard() {
  const family = loadData('family');
  if (!family) return;

  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);

  document.getElementById('display-nickname').textContent = '✦ ' + family.nickname;
  document.getElementById('dashboard-avatar').textContent = child.avatar;
  document.getElementById('dashboard-child-name').textContent = child.name;
  document.getElementById('dashboard-child-grade').textContent =
    child.grade + ' grade · ' + (activeYear ? activeYear.label : '') + ' school year';

  const streak = calculateStreak(child);
  document.getElementById('dashboard-streak').innerHTML = streak + ' <span>week streak</span>';

  const earnedGems = getEarnedGems(child, family);
  const gemContainer = document.getElementById('dashboard-gems');
  if (gemContainer) {
    gemContainer.innerHTML = earnedGems.map(gem => renderGemSVG(gem, 20)).join('');
  }

  document.getElementById('log-week-label').textContent =
    'Week ' + getWeekNumber(family) + ' · ' + getCurrentWeekDates();

  renderChildSwitcher(family);
  renderSubjectList(child);
  renderRecentGlows(child);
}

function renderChildSwitcher(family) {
  const switcher = document.getElementById('child-switcher');
  switcher.innerHTML = '';

  family.children.forEach((child, index) => {
    const chip = document.createElement('div');
    chip.className = 'child-chip' + (index === currentChildIndex ? ' active' : '');
    chip.innerHTML = `<div class="child-chip-avatar">${child.avatar}</div>${child.name}`;
    chip.addEventListener('click', () => {
      currentChildIndex = index;
      renderDashboard();
    });
    switcher.appendChild(chip);
  });

  if (family.children.length < 5) {
    const addChip = document.createElement('div');
    addChip.className = 'child-chip';
    addChip.style.borderStyle = 'dashed';
    addChip.style.color = 'var(--color-primary)';
    addChip.innerHTML = `<div class="child-chip-avatar" style="background:var(--color-primary-light)">+</div>Add child`;
    addChip.addEventListener('click', () => {
      document.getElementById('child-name').value = '';
      selectedGrade = null;
      selectedAvatar = null;
      document.querySelectorAll('.grade-chip').forEach(c => c.classList.remove('selected'));
      document.querySelectorAll('.avatar-opt').forEach(o => o.classList.remove('selected'));
      showScreen('screen-add-child');
    });
    switcher.appendChild(addChip);
  }
}

function renderSubjectList(child) {
  const list = document.getElementById('subject-list');
  list.innerHTML = '';

  const subjects = getSubjects(child);
  const activeSubjects = subjects.filter(s => !s.archived);

  if (activeSubjects.length === 0) {
    list.innerHTML = `<p style="font-size:14px;color:var(--color-text-secondary);margin-bottom:12px">No subjects set up yet. Add your first subject to get started.</p>`;
  } else {
    activeSubjects.forEach(subject => {
      const pct = subject.totalLessons > 0
        ? Math.round((subject.lessonsCompleted / subject.totalLessons) * 100)
        : 0;
      const card = document.createElement('div');
      card.className = 'subject-card';
      card.dataset.id = subject.id;
      card.innerHTML = `
        <div class="subject-header-row">
          <span class="subject-name">${subject.name}</span>
          <span class="subject-pct">${pct}%</span>
        </div>
        <div class="progress-bg">
          <div class="progress-fill" style="width:${Math.min(pct,100)}%"></div>
        </div>
        <div class="subject-meta">
          <span>${subject.curriculum}</span>
          <span>${subject.lessonsCompleted} of ${subject.totalLessons} lessons</span>
        </div>
      `;
      list.appendChild(card);
    });
  }

  attachSubjectCardListeners();
  renderArchivedSubjects(child);
}

// =====================
// INIT
// =====================
// =====================
// MIGRATION
// =====================
function migrateData(family) {
  if (!family) return family;
  let changed = false;

  family.children = family.children.map(child => {
    // If child already has schoolYears, skip
    if (child.schoolYears) return child;

    // Migrate old structure to new
    changed = true;
    const yearLabel = generateYearLabel(family.schoolYearStart);
    const schoolYear = createSchoolYear(yearLabel, family.schoolYearStart);

    // Move existing subjects and logs into the school year
    schoolYear.subjects = child.subjects || [];
    schoolYear.weeklyLogs = child.weeklyLogs || [];

    const { subjects, weeklyLogs, ...childWithoutOldData } = child;
    return {
      ...childWithoutOldData,
      schoolYears: [schoolYear]
    };
  });

  if (changed) saveData('family', family);
  return family;
}

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
  let family = loadData('family');
  family = migrateData(family);

  if (family && family.children.length > 0) {
    renderDashboard();
    showScreen('screen-dashboard');
  } else if (family) {
    showScreen('screen-add-child');
  } else {
    showScreen('screen-onboarding');
  }
});
// =====================
// ADD SUBJECT SCREEN
// =====================
let selectedCreditMethod = 'lessons';
let creditBearing = false;

document.getElementById('btn-add-subject').addEventListener('click', () => {
  showScreen('screen-add-subject');
});

document.getElementById('btn-back-from-subject').addEventListener('click', () => {
  showScreen('screen-dashboard');
});

document.getElementById('credit-toggle').addEventListener('click', () => {
  creditBearing = !creditBearing;
  const toggle = document.getElementById('credit-toggle');
  const creditOptions = document.getElementById('credit-options');
  if (creditBearing) {
    toggle.classList.add('on');
    creditOptions.style.opacity = '1';
    creditOptions.style.pointerEvents = 'auto';
  } else {
    toggle.classList.remove('on');
    creditOptions.style.opacity = '0.35';
    creditOptions.style.pointerEvents = 'none';
  }
});

document.querySelectorAll('.credit-method').forEach(method => {
  method.addEventListener('click', () => {
    document.querySelectorAll('.credit-method').forEach(m => {
      m.classList.remove('selected');
      m.querySelector('.radio').classList.remove('selected');
    });
    method.classList.add('selected');
    method.querySelector('.radio').classList.add('selected');
    selectedCreditMethod = method.dataset.method;
  });
});

document.getElementById('btn-save-subject').addEventListener('click', () => {
  const name = document.getElementById('subject-name').value.trim();
  const type = document.getElementById('subject-type').value;
  const curriculum = document.getElementById('subject-curriculum').value.trim();
  const totalLessons = parseInt(document.getElementById('subject-lessons').value);
  const duration = document.getElementById('subject-duration').value;

  if (!name) { alert('Please enter a subject name.'); return; }
  if (!curriculum) { alert('Please enter a curriculum or resource name.'); return; }
  if (!totalLessons || totalLessons < 1) { alert('Please enter the total number of lessons.'); return; }

  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);

  const subject = {
    id: Date.now(),
    name, type, curriculum, totalLessons, duration,
    creditBearing, creditMethod: selectedCreditMethod,
    lessonsCompleted: 0, hoursLogged: 0,
    archived: false,
    createdAt: new Date().toISOString()
  };

  activeYear.subjects.push(subject);
  family.children[currentChildIndex] = child;
  saveData('family', family);

  document.getElementById('subject-name').value = '';
  document.getElementById('subject-curriculum').value = '';
  document.getElementById('subject-lessons').value = '';
  document.getElementById('subject-duration').value = 'full';
  document.getElementById('subject-type').value = 'core';
  creditBearing = false;
  selectedCreditMethod = 'lessons';
  document.getElementById('credit-toggle').classList.remove('on');
  document.getElementById('credit-options').style.opacity = '0.35';
  document.getElementById('credit-options').style.pointerEvents = 'none';
  document.querySelectorAll('.credit-method').forEach(m => {
    m.classList.remove('selected');
    m.querySelector('.radio').classList.remove('selected');
  });
  document.getElementById('method-lessons').classList.add('selected');
  document.getElementById('method-lessons').querySelector('.radio').classList.add('selected');

  renderDashboard();
  showScreen('screen-dashboard');
});

// =====================
// WEEKLY LOG STATE
// =====================
let currentWeekType = null;
let selectedExperienceTags = [];
let currentWeekNumber = 1;
let currentWeekStartDate = null;

document.getElementById('btn-log-week').addEventListener('click', () => {
  const family = loadData('family');
  currentWeekStartDate = getWeekStartDate();
  currentWeekNumber = getWeekNumber(family);
  const weekLabel = 'Week ' + currentWeekNumber + ' · ' + formatWeekDates(currentWeekStartDate);

  document.getElementById('week-type-label').textContent = weekLabel;

  const gem = getCurrentMonthGem();
  document.getElementById('week-gem-notice-text').textContent =
    'Log this week to work toward your ' + gem.name + ' — ' +
    new Date().toLocaleString('default', { month: 'long' }) + '\'s gem.';

  currentWeekType = null;
  document.querySelectorAll('.week-type-card').forEach(c => c.classList.remove('selected'));
  resetBookState();
  showScreen('screen-week-type');
});

document.getElementById('select-school-week').addEventListener('click', () => {
  currentWeekType = 'school';
  document.querySelectorAll('.week-type-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('select-school-week').classList.add('selected');

  const family = loadData('family');
  const child = family.children[currentChildIndex];
  document.getElementById('school-log-label').textContent =
    'Week ' + currentWeekNumber + ' · ' + formatWeekDates(currentWeekStartDate);

  renderSchoolLogEntries(child);
  document.getElementById('school-glow-input').value = '';
  setTimeout(() => showScreen('screen-school-log'), 150);
});

document.getElementById('select-adventure-week').addEventListener('click', () => {
  currentWeekType = 'adventure';
  document.querySelectorAll('.week-type-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('select-adventure-week').classList.add('selected');
  selectedExperienceTags = [];
  document.querySelectorAll('.exp-tag').forEach(t => t.classList.remove('selected'));
  setTimeout(() => showScreen('screen-adventure-tags'), 150);
});

function renderSchoolLogEntries(child) {
  const container = document.getElementById('school-subject-entries');
  container.innerHTML = '';

  const subjects = getSubjects(child);
  const activeSubjects = subjects.filter(s => !s.archived);

  if (activeSubjects.length === 0) {
    container.innerHTML = `<p style="font-size:14px;color:var(--color-text-secondary);margin-bottom:16px">No subjects set up yet. Add subjects from the dashboard first.</p>`;
    return;
  }

  activeSubjects.forEach(subject => {
    const card = document.createElement('div');
    card.className = 'subject-log-card';
    const tagClass = 'tag-' + subject.type;
    card.innerHTML = `
      <div class="subject-log-header" data-id="${subject.id}">
        <div class="subject-log-header-left">
          <span class="subject-log-name">${subject.name}</span>
          <span class="subject-type-tag ${tagClass}">${subject.type}</span>
        </div>
        <i class="ti ti-chevron-down" style="color:var(--color-text-secondary);font-size:16px"></i>
      </div>
      <div class="subject-log-body" id="log-body-${subject.id}">
        <div class="subject-log-row">
          <div class="subject-log-field">
            <label>Lessons completed</label>
            <input type="number" min="0" placeholder="0" id="lessons-${subject.id}" />
          </div>
          <div class="subject-log-field">
            <label>Hours (optional)</label>
            <input type="number" min="0" step="0.5" placeholder="0" id="hours-${subject.id}" />
          </div>
        </div>
        <div class="subject-log-wide">
          <label>Notes</label>
          <input type="text" placeholder="What did you cover?" id="notes-${subject.id}" />
        </div>
      </div>
      <div class="subject-collapsed-hint" id="hint-${subject.id}">Tap to log this week's work</div>
    `;
    container.appendChild(card);

    card.querySelector('.subject-log-header').addEventListener('click', () => {
      const body = document.getElementById('log-body-' + subject.id);
      const hint = document.getElementById('hint-' + subject.id);
      const icon = card.querySelector('[class*="ti-chevron"]');
      const isOpen = body.classList.contains('open');
      body.classList.toggle('open');
      hint.style.display = isOpen ? 'block' : 'none';
      if (icon) {
        icon.className = isOpen ? 'ti ti-chevron-down' : 'ti ti-chevron-up';
        icon.style.color = 'var(--color-text-secondary)';
        icon.style.fontSize = '16px';
      }
    });
  });
}

document.getElementById('btn-back-from-week-type').addEventListener('click', () => showScreen('screen-dashboard'));
document.getElementById('btn-back-from-school-log').addEventListener('click', () => showScreen('screen-week-type'));
document.getElementById('btn-back-from-adventure-tags').addEventListener('click', () => showScreen('screen-week-type'));
document.getElementById('btn-back-from-adventure-glow').addEventListener('click', () => showScreen('screen-adventure-tags'));

document.getElementById('btn-save-school-week').addEventListener('click', () => {
  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);
  const glow = document.getElementById('school-glow-input').value.trim();

  const subjects = getSubjects(child);
  const subjectEntries = [];

  subjects.forEach(subject => {
    const lessonsEl = document.getElementById('lessons-' + subject.id);
    const hoursEl = document.getElementById('hours-' + subject.id);
    const notesEl = document.getElementById('notes-' + subject.id);

    const lessons = parseInt(lessonsEl?.value) || 0;
    const hours = parseFloat(hoursEl?.value) || 0;
    const notes = notesEl?.value.trim() || '';

    if (lessons > 0 || hours > 0 || notes) {
      subjectEntries.push({ subjectId: subject.id, lessonsCompleted: lessons, hoursLogged: hours, notes });
      const subjectIndex = activeYear.subjects.findIndex(s => s.id === subject.id);
      if (subjectIndex !== -1) {
        activeYear.subjects[subjectIndex].lessonsCompleted += lessons;
        activeYear.subjects[subjectIndex].hoursLogged += hours;
      }
    }
  });

  activeYear.weeklyLogs.push({
    id: Date.now(),
    weekNumber: currentWeekNumber,
    startDate: currentWeekStartDate.toISOString(),
    logType: 'school',
    subjectEntries,
    books: [...schoolBooks],
    glow,
    experienceTags: [],
    createdAt: new Date().toISOString()
  });

  family.children[currentChildIndex] = child;
  saveData('family', family);
  resetBookState();
  renderDashboard();
  showScreen('screen-dashboard');
});
document.querySelectorAll('.exp-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    tag.classList.toggle('selected');
    const value = tag.dataset.tag;
    if (tag.classList.contains('selected')) {
      selectedExperienceTags.push(value);
    } else {
      selectedExperienceTags = selectedExperienceTags.filter(t => t !== value);
    }
  });
});

document.getElementById('btn-adventure-tags-continue').addEventListener('click', () => {
  if (selectedExperienceTags.length === 0) {
    alert('Please select at least one experience type.');
    return;
  }
  const gem = getCurrentMonthGem();
  document.getElementById('adventure-gem-notice-text').textContent =
    'Logging this adventure keeps your ' + gem.name + ' streak alive. Real learning happens everywhere.';
  document.getElementById('adventure-glow-input').value = '';
  showScreen('screen-adventure-glow');
});

document.getElementById('btn-save-adventure-week').addEventListener('click', () => {
  const glow = document.getElementById('adventure-glow-input-final').value.trim();
  if (!glow) { alert('Please write a sentence about your adventure before saving.'); return; }

  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);

  activeYear.weeklyLogs.push({
    id: Date.now(),
    weekNumber: currentWeekNumber,
    startDate: currentWeekStartDate.toISOString(),
    logType: 'adventure',
    subjectEntries: [],
    books: [...adventureBooks],
    glow,
    experienceTags: selectedExperienceTags,
    createdAt: new Date().toISOString()
  });

  family.children[currentChildIndex] = child;
  saveData('family', family);
  resetBookState();
  renderDashboard();
  showScreen('screen-dashboard');
});

// =====================
// EDIT SUBJECT STATE
// =====================
let editingSubjectId = null;
let editCreditBearing = false;
let editCreditMethod = 'lessons';

function openEditSubject(subjectId) {
  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const subjects = getSubjects(child);
  const subject = subjects.find(s => s.id === subjectId);
  if (!subject) return;

  editingSubjectId = subjectId;
  editCreditBearing = subject.creditBearing;
  editCreditMethod = subject.creditMethod || 'lessons';

  document.getElementById('edit-subject-name').value = subject.name;
  document.getElementById('edit-subject-type').value = subject.type;
  document.getElementById('edit-subject-curriculum').value = subject.curriculum;
  document.getElementById('edit-subject-lessons').value = subject.totalLessons;
  document.getElementById('edit-subject-duration').value = subject.duration;

  const toggle = document.getElementById('edit-credit-toggle');
  const creditOptions = document.getElementById('edit-credit-options');
  if (subject.creditBearing) {
    toggle.classList.add('on');
    creditOptions.style.opacity = '1';
    creditOptions.style.pointerEvents = 'auto';
  } else {
    toggle.classList.remove('on');
    creditOptions.style.opacity = '0.35';
    creditOptions.style.pointerEvents = 'none';
  }

  document.querySelectorAll('#edit-credit-options .credit-method').forEach(m => {
    m.classList.remove('selected');
    m.querySelector('.radio').classList.remove('selected');
  });
  const activeMethod = document.getElementById(
    editCreditMethod === 'hours' ? 'edit-method-hours' : 'edit-method-lessons'
  );
  if (activeMethod) {
    activeMethod.classList.add('selected');
    activeMethod.querySelector('.radio').classList.add('selected');
  }

  showScreen('screen-edit-subject');
}

function attachSubjectCardListeners() {
  document.querySelectorAll('.subject-card').forEach(card => {
    card.addEventListener('click', () => {
      const subjectId = parseInt(card.dataset.id);
      if (subjectId) openEditSubject(subjectId);
    });
  });
}

document.getElementById('btn-back-from-edit-subject').addEventListener('click', () => showScreen('screen-dashboard'));

document.getElementById('edit-credit-toggle').addEventListener('click', () => {
  editCreditBearing = !editCreditBearing;
  const toggle = document.getElementById('edit-credit-toggle');
  const creditOptions = document.getElementById('edit-credit-options');
  if (editCreditBearing) {
    toggle.classList.add('on');
    creditOptions.style.opacity = '1';
    creditOptions.style.pointerEvents = 'auto';
  } else {
    toggle.classList.remove('on');
    creditOptions.style.opacity = '0.35';
    creditOptions.style.pointerEvents = 'none';
  }
});

document.querySelectorAll('#edit-credit-options .credit-method').forEach(method => {
  method.addEventListener('click', () => {
    document.querySelectorAll('#edit-credit-options .credit-method').forEach(m => {
      m.classList.remove('selected');
      m.querySelector('.radio').classList.remove('selected');
    });
    method.classList.add('selected');
    method.querySelector('.radio').classList.add('selected');
    editCreditMethod = method.dataset.method;
  });
});

document.getElementById('btn-save-edit-subject').addEventListener('click', () => {
  const name = document.getElementById('edit-subject-name').value.trim();
  const type = document.getElementById('edit-subject-type').value;
  const curriculum = document.getElementById('edit-subject-curriculum').value.trim();
  const totalLessons = parseInt(document.getElementById('edit-subject-lessons').value);
  const duration = document.getElementById('edit-subject-duration').value;

  if (!name) { alert('Please enter a subject name.'); return; }
  if (!curriculum) { alert('Please enter a curriculum name.'); return; }
  if (!totalLessons || totalLessons < 1) { alert('Please enter total lessons.'); return; }

  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);
  const subjectIndex = activeYear.subjects.findIndex(s => s.id === editingSubjectId);
  if (subjectIndex === -1) return;

  const existing = activeYear.subjects[subjectIndex];
  activeYear.subjects[subjectIndex] = {
    ...existing,
    name, type, curriculum,
    totalLessons: Math.max(totalLessons, existing.lessonsCompleted),
    duration,
    creditBearing: editCreditBearing,
    creditMethod: editCreditMethod
  };

  family.children[currentChildIndex] = child;
  saveData('family', family);
  renderDashboard();
  showScreen('screen-dashboard');
});

document.getElementById('btn-archive-subject').addEventListener('click', () => {
  if (!confirm('Archive this subject? It will be removed from your dashboard and log screens but preserved in your year history.')) return;

  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);
  const subjectIndex = activeYear.subjects.findIndex(s => s.id === editingSubjectId);
  if (subjectIndex === -1) return;

  activeYear.subjects[subjectIndex].archived = true;
  family.children[currentChildIndex] = child;
  saveData('family', family);
  renderDashboard();
  showScreen('screen-dashboard');
});

function renderArchivedSubjects(child) {
  const subjects = getSubjects(child);
  const archived = subjects.filter(s => s.archived);
  const container = document.getElementById('archived-subjects-container');
  if (!container) return;

  if (archived.length === 0) {
    container.innerHTML = '';
    document.getElementById('archived-toggle-btn').style.display = 'none';
    return;
  }

  document.getElementById('archived-toggle-btn').style.display = 'flex';

  const list = document.getElementById('archived-subjects-list');
  if (!list) return;

  list.innerHTML = archived.map(subject => {
    const pct = subject.totalLessons > 0
      ? Math.round((subject.lessonsCompleted / subject.totalLessons) * 100)
      : 0;
    return `
      <div class="archived-card">
        <div class="archived-card-left">
          <div class="archived-card-name">${subject.name}</div>
          <div class="archived-card-curriculum">${subject.curriculum}</div>
          <div class="archived-card-pct">${pct}% complete when archived</div>
        </div>
        <button class="btn-unarchive" data-id="${subject.id}">Restore</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.btn-unarchive').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const family = loadData('family');
      const child = family.children[currentChildIndex];
      const activeYear = getActiveYear(child);
      const subjectIndex = activeYear.subjects.findIndex(s => s.id === id);
      if (subjectIndex !== -1) {
        activeYear.subjects[subjectIndex].archived = false;
        family.children[currentChildIndex] = child;
        saveData('family', family);
        renderDashboard();
      }
    });
  });
}

document.addEventListener('click', (e) => {
  const toggleBtn = e.target.closest('#archived-toggle-btn');
  if (toggleBtn) {
    toggleBtn.classList.toggle('open');
    const list = document.getElementById('archived-subjects-list');
    if (list) {
      list.classList.toggle('open');
      if (list.classList.contains('open')) {
        const family = loadData('family');
        const child = family.children[currentChildIndex];
        renderArchivedSubjects(child);
        list.classList.add('open');
      }
    }
  }
});
// =====================
// SETTINGS SCREEN
// =====================
let quarteringEnabled = false;

// Open settings
document.querySelector('.icon-btn').addEventListener('click', () => {
  const family = loadData('family');
  if (!family) return;

  // Populate school info
  document.getElementById('settings-official-name').textContent = family.officialName;
  document.getElementById('settings-nickname').textContent = family.nickname;
  document.getElementById('settings-year-start').textContent =
    family.schoolYearStart.charAt(0).toUpperCase() + family.schoolYearStart.slice(1);

  // Load quarter settings from active year of current child
  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);
  const quarters = activeYear?.quarterSettings;

  // Set toggle state
  quarteringEnabled = activeYear?.quarteringEnabled || false;
  const toggle = document.getElementById('quarterly-toggle');
  const fields = document.getElementById('quarter-date-fields');

  if (quarteringEnabled) {
    toggle.classList.add('on');
    fields.style.display = 'block';
  } else {
    toggle.classList.remove('on');
    fields.style.display = 'none';
  }

  // Pre-fill dates if they exist
  if (quarters) {
    document.getElementById('q1-start').value = quarters.q1?.start || '';
    document.getElementById('q1-end').value = quarters.q1?.end || '';
    document.getElementById('q2-start').value = quarters.q2?.start || '';
    document.getElementById('q2-end').value = quarters.q2?.end || '';
    document.getElementById('q3-start').value = quarters.q3?.start || '';
    document.getElementById('q3-end').value = quarters.q3?.end || '';
    document.getElementById('q4-start').value = quarters.q4?.start || '';
    document.getElementById('q4-end').value = quarters.q4?.end || '';
  }

  showScreen('screen-settings');
});

// Back from settings
document.getElementById('btn-back-from-settings').addEventListener('click', () => {
  showScreen('screen-dashboard');
});

// Quarterly toggle
document.getElementById('quarterly-toggle').addEventListener('click', () => {
  quarteringEnabled = !quarteringEnabled;
  const toggle = document.getElementById('quarterly-toggle');
  const fields = document.getElementById('quarter-date-fields');

  if (quarteringEnabled) {
    toggle.classList.add('on');
    fields.style.display = 'block';
  } else {
    toggle.classList.remove('on');
    fields.style.display = 'none';
  }
});

// Save quarter dates
document.getElementById('btn-save-quarters').addEventListener('click', () => {
  const q1start = document.getElementById('q1-start').value;
  const q1end = document.getElementById('q1-end').value;
  const q2start = document.getElementById('q2-start').value;
  const q2end = document.getElementById('q2-end').value;
  const q3start = document.getElementById('q3-start').value;
  const q3end = document.getElementById('q3-end').value;
  const q4start = document.getElementById('q4-start').value;
  const q4end = document.getElementById('q4-end').value;

  // Validate all fields filled if quarterly enabled
  if (quarteringEnabled) {
    if (!q1start || !q1end || !q2start || !q2end ||
        !q3start || !q3end || !q4start || !q4end) {
      alert('Please fill in all quarter start and end dates.');
      return;
    }

    // Validate dates are in order
    if (new Date(q1start) >= new Date(q1end)) {
      alert('Q1 start date must be before end date.'); return;
    }
    if (new Date(q2start) >= new Date(q2end)) {
      alert('Q2 start date must be before end date.'); return;
    }
    if (new Date(q3start) >= new Date(q3end)) {
      alert('Q3 start date must be before end date.'); return;
    }
    if (new Date(q4start) >= new Date(q4end)) {
      alert('Q4 start date must be before end date.'); return;
    }
  }

  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);

  activeYear.quarteringEnabled = quarteringEnabled;
  activeYear.quarterSettings = {
    q1: { start: q1start, end: q1end },
    q2: { start: q2start, end: q2end },
    q3: { start: q3start, end: q3end },
    q4: { start: q4start, end: q4end }
  };

  family.children[currentChildIndex] = child;
  saveData('family', family);

  alert('Quarter dates saved.');
  showScreen('screen-dashboard');
});
// =====================
// BOOK LOGGING STATE
// =====================
let schoolBooks = [];
let adventureBooks = [];
let schoolSelectedCat = 'readaloud';
let adventureSelectedCat = 'readaloud';

// =====================
// BOOK CATEGORY BUTTONS
// =====================
function setupCategoryButtons(prefix, getCat, setCat) {
  ['readaloud', 'personal', 'assigned'].forEach(cat => {
    const btn = document.getElementById(prefix + '-cat-' + cat);
    if (!btn) return;
    btn.addEventListener('click', () => {
      document.querySelectorAll('#' + prefix + '-cat-readaloud, #' + prefix + '-cat-personal, #' + prefix + '-cat-assigned')
        .forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      setCat(cat);
    });
  });
}

setupCategoryButtons('school',
  () => schoolSelectedCat,
  (cat) => { schoolSelectedCat = cat; }
);

setupCategoryButtons('adventure',
  () => adventureSelectedCat,
  (cat) => { adventureSelectedCat = cat; }
);

// =====================
// RENDER BOOK LIST
// =====================
function renderBookList(books, listId, removeCallback) {
  const list = document.getElementById(listId);
  if (!list) return;

  if (books.length === 0) {
    list.innerHTML = '';
    return;
  }

  const catLabels = {
    readaloud: 'Read aloud',
    personal: 'Personal',
    assigned: 'Assigned'
  };

  list.innerHTML = books.map((book, index) => `
    <div class="book-list-item">
      <div class="book-item-left">
        <span class="book-item-cat cat-${book.category}">${catLabels[book.category]}</span>
        <span class="book-item-title">${book.title}</span>
      </div>
      <button class="book-remove" data-index="${index}">×</button>
    </div>
  `).join('');

  list.querySelectorAll('.book-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      removeCallback(index);
    });
  });
}

// =====================
// SCHOOL WEEK BOOKS
// =====================
document.getElementById('school-book-add').addEventListener('click', () => {
  const input = document.getElementById('school-book-input');
  const title = input.value.trim();
  if (!title) { alert('Please enter a book title.'); return; }

  schoolBooks.push({ title, category: schoolSelectedCat, addedAt: new Date().toISOString() });
  input.value = '';
  renderBookList(schoolBooks, 'school-book-list', (index) => {
    schoolBooks.splice(index, 1);
    renderBookList(schoolBooks, 'school-book-list', arguments.callee);
  });
});

// =====================
// ADVENTURE WEEK BOOKS
// =====================
document.getElementById('adventure-book-add').addEventListener('click', () => {
  const input = document.getElementById('adventure-book-input');
  const title = input.value.trim();
  if (!title) { alert('Please enter a book title.'); return; }

  adventureBooks.push({ title, category: adventureSelectedCat, addedAt: new Date().toISOString() });
  input.value = '';
  renderBookList(adventureBooks, 'adventure-book-list', (index) => {
    adventureBooks.splice(index, 1);
    renderBookList(adventureBooks, 'adventure-book-list', arguments.callee);
  });
});

// =====================
// RESET BOOK STATE
// =====================
function resetBookState() {
  schoolBooks = [];
  adventureBooks = [];
  schoolSelectedCat = 'readaloud';
  adventureSelectedCat = 'readaloud';

  const schoolInput = document.getElementById('school-book-input');
  if (schoolInput) schoolInput.value = '';
  const adventureInput = document.getElementById('adventure-book-input');
  if (adventureInput) adventureInput.value = '';

  const schoolList = document.getElementById('school-book-list');
  if (schoolList) schoolList.innerHTML = '';
  const adventureList = document.getElementById('adventure-book-list');
  if (adventureList) adventureList.innerHTML = '';

  ['school', 'adventure'].forEach(prefix => {
    document.querySelectorAll(`#${prefix}-cat-readaloud, #${prefix}-cat-personal, #${prefix}-cat-assigned`)
      .forEach(b => b.classList.remove('sel'));
    const defaultBtn = document.getElementById(`${prefix}-cat-readaloud`);
    if (defaultBtn) defaultBtn.classList.add('sel');
  });
}
