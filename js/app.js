// =====================
// FIREBASE IMPORTS
// =====================
import {
  auth,
  signUp,
  signIn,
  sendMagicLink,
  completeMagicLinkSignIn,
  resetPassword,
  logOut,
  saveUserData,
  loadUserData,
  onAuthStateChanged
} from './firebase.js';

// =====================
// APP STATE
// =====================
let currentChildIndex = 0;
let selectedGrade = null;
let selectedAvatar = null;
let currentUser = null;
let appData = null;

// =====================
// DATA HELPERS
// =====================
async function saveData(key, data) {
  if (key === 'family' && currentUser) {
    appData = data;
    await saveUserData(currentUser.uid, data);
  } else {
    localStorage.setItem(key, JSON.stringify(data));
  }
}

function loadData(key) {
  if (key === 'family' && appData) {
    return appData;
  }
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
  
  // If active year label exists use its start date instead
  const family2 = loadData('family');
  if (family2 && family2.children && family2.children[currentChildIndex]) {
    const child2 = family2.children[currentChildIndex];
    const activeYear2 = getActiveYear(child2);
    if (activeYear2 && activeYear2.startDate) {
      const yearStart = new Date(activeYear2.startDate);
      const diff = now - yearStart;
      if (diff > 0) {
        const weeks = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
        return Math.min(52, Math.max(1, weeks));
      }
    }
  }
  
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
  const nameEl = document.getElementById('dashboard-child-name');
  nameEl.innerHTML = `${child.name} <button class="btn-edit-child" id="btn-edit-child-trigger" aria-label="Edit child"><i class="ti ti-pencil" style="font-size:14px"></i></button>`;
  document.getElementById('btn-edit-child-trigger').addEventListener('click', () => {
    openEditChild(currentChildIndex);
  });
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
  checkWrappedSeason();
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
  // Check if this is a magic link redirect
  if (window.location.href.includes('oobCode')) {
    const savedEmail = localStorage.getItem('emailForSignIn');
    if (!savedEmail) {
      showScreen('screen-magic-confirm');
      return;
    }
  }
  // Auth state is handled by onAuthStateChanged
  // Show auth screen by default until Firebase resolves
  showScreen('screen-auth');
});

// =====================
// ADD SUBJECT SCREEN
// =====================
let selectedCreditMethod = 'lessons';
let creditBearing = false;

document.getElementById('btn-add-subject').addEventListener('click', () => {
  // Remove any existing confirm message
  const existingConfirm = document.getElementById('copy-confirm-msg');
  if (existingConfirm) existingConfirm.remove();
  
  updateCopySubjectsBanner();
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
    unitStudies: collectUnitStudyData('school'),
    glow,
    experienceTags: [],
    createdAt: new Date().toISOString()
  });

  family.children[currentChildIndex] = child;
  saveData('family', family);
  resetBookState();
  resetUnitStudies();
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
  const adventureDesc = document.getElementById('adventure-glow-input').value.trim();
  const glow = document.getElementById('adventure-glow-input-final').value.trim();
  if (!adventureDesc) { alert('Please describe what you did this week before saving.'); return; }

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
    unitStudies: collectUnitStudyData('adventure'),
    glow,
    experienceTags: selectedExperienceTags,
    createdAt: new Date().toISOString()
  });

  family.children[currentChildIndex] = child;
  saveData('family', family);
  resetBookState();
  resetUnitStudies();
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
function openSettings() {
  const family = loadData('family');
  if (!family) return;

  document.getElementById('settings-official-name').textContent = family.officialName;
  document.getElementById('settings-nickname').textContent = family.nickname;
  document.getElementById('settings-year-start').textContent =
    family.schoolYearStart.charAt(0).toUpperCase() + family.schoolYearStart.slice(1);

  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);
  const quarters = activeYear?.quarterSettings;

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
}

document.querySelector('.icon-btn').addEventListener('click', openSettings);

// Back from settings
document.getElementById('btn-back-from-settings').addEventListener('click', () => {
  showScreen('screen-dashboard');
});

document.getElementById('btn-sign-out').addEventListener('click', async () => {
  if (confirm('Sign out of your account?')) {
    await logOut();
    appData = null;
    currentUser = null;
    showScreen('screen-auth');
  }
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
function refreshSchoolBookList() {
  renderBookList(schoolBooks, 'school-book-list', (index) => {
    schoolBooks.splice(index, 1);
    refreshSchoolBookList();
  });
}

document.getElementById('school-book-add').addEventListener('click', () => {
  const input = document.getElementById('school-book-input');
  const title = input.value.trim();
  if (!title) { alert('Please enter a book title.'); return; }
  schoolBooks.push({ title, category: schoolSelectedCat, addedAt: new Date().toISOString() });
  input.value = '';
  refreshSchoolBookList();
});

// =====================
// ADVENTURE WEEK BOOKS
// =====================

function refreshAdventureBookList() {
  renderBookList(adventureBooks, 'adventure-book-list', (index) => {
    adventureBooks.splice(index, 1);
    refreshAdventureBookList();
  });
}
document.getElementById('adventure-book-add').addEventListener('click', () => {
  const input = document.getElementById('adventure-book-input');
  const title = input.value.trim();
  if (!title) { alert('Please enter a book title.'); return; }
  adventureBooks.push({ title, category: adventureSelectedCat, addedAt: new Date().toISOString() });
  input.value = '';
  refreshAdventureBookList();
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
// =====================
// REPORT STATE
// =====================
let reportIncludeWeekly = false;
let reportIncludeBooks = true;
let reportIncludeHighlights = true;

// =====================
// REPORT OPTION TOGGLES
// =====================
function setupReportToggle(id, getVal, setVal) {
  const toggle = document.getElementById(id);
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    setVal(!getVal());
    if (getVal()) {
      toggle.classList.add('on');
    } else {
      toggle.classList.remove('on');
    }
  });
}

setupReportToggle('toggle-weekly-log',
  () => reportIncludeWeekly,
  (v) => { reportIncludeWeekly = v; }
);

setupReportToggle('toggle-books',
  () => reportIncludeBooks,
  (v) => { reportIncludeBooks = v; }
);

setupReportToggle('toggle-highlights',
  () => reportIncludeHighlights,
  (v) => { reportIncludeHighlights = v; }
);

// =====================
// REPORT RANGE SELECTOR
// =====================
document.getElementById('report-range').addEventListener('change', () => {
  const val = document.getElementById('report-range').value;
  const customFields = document.getElementById('custom-range-fields');
  customFields.style.display = val === 'custom' ? 'block' : 'none';
});

// =====================
// GET REPORT DATE RANGE
// =====================
function getReportDateRange() {
  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);
  const rangeVal = document.getElementById('report-range').value;

  if (rangeVal === 'custom') {
    const start = document.getElementById('report-start').value;
    const end = document.getElementById('report-end').value;
    if (!start || !end) {
      alert('Please select a start and end date for your custom range.');
      return null;
    }
    return { start: new Date(start + 'T00:00:00'), end: new Date(end + 'T23:59:59'), label: 'Custom range' };
  }

  if (rangeVal === 'fullyear') {
    const start = new Date(activeYear.startDate);
    const end = new Date();
    return { start, end, label: 'Full year to date' };
  }

  // Quarter ranges
  const quarters = activeYear?.quarterSettings;
  if (!quarters) {
    alert('Please set up your quarter dates in settings first.');
    return null;
  }

  const q = quarters[rangeVal];
  if (!q || !q.start || !q.end) {
    alert('Please set up your ' + rangeVal.toUpperCase() + ' dates in the quarterly reporting section above.');
    return null;
  }

  const quarterLabels = { q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4' };
  return {
    start: new Date(q.start + 'T00:00:00'),
    end: new Date(q.end + 'T23:59:59'),
    label: quarterLabels[rangeVal]
  };
}

// =====================
// FILTER LOGS BY DATE
// =====================
function filterLogsByDateRange(logs, start, end) {
  return logs.filter(log => {
    const logDate = new Date(log.startDate);
    return logDate >= start && logDate <= end;
  });
}

// =====================
// FORMAT DATE
// =====================
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// =====================
// GENERATE REPORT
// =====================
document.getElementById('btn-generate-report').addEventListener('click', () => {
  const range = getReportDateRange();
  if (!range) return;

  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);
  const logs = getLogs(child);
  const filteredLogs = filterLogsByDateRange(logs, range.start, range.end);
  const subjects = getSubjects(child);

  const schoolWeeks = filteredLogs.filter(l => l.logType === 'school');
  const adventureWeeks = filteredLogs.filter(l => l.logType === 'adventure');

  // Book totals
  const allBooks = filteredLogs.flatMap(l => l.books || []);
  const readAlouds = allBooks.filter(b => b.category === 'readaloud');
  const personalReads = allBooks.filter(b => b.category === 'personal');
  const assignedReads = allBooks.filter(b => b.category === 'assigned');

  // All glows
  const allGlows = filteredLogs.filter(l => l.glow && l.glow.trim() !== '');

  // Build report HTML
  let html = `<div class="report-doc">`;

  // Header
  html += `
    <div class="report-header">
      <div>
        <div class="report-school-name">${family.officialName}</div>
        <div class="report-meta">${child.name} · ${child.grade} grade · ${activeYear.label} school year</div>
        <div class="report-meta">Report period: ${formatDate(range.start)} – ${formatDate(range.end)} (${range.label})</div>
        <div class="report-disclaimer">This is a personal learning record prepared by ${family.nickname}. It is not an official government document.</div>
      </div>
      <div class="report-generated">Generated ${formatDate(new Date())}</div>
    </div>
  `;

  // Summary
  html += `
    <div class="report-section">
      <div class="report-section-title">Summary</div>
      <div class="report-summary-grid">
        <div class="report-summary-card">
          <div class="report-summary-num">${filteredLogs.length}</div>
          <div class="report-summary-label">Weeks logged</div>
        </div>
        <div class="report-summary-card">
          <div class="report-summary-num">${schoolWeeks.length}</div>
          <div class="report-summary-label">School weeks</div>
        </div>
        <div class="report-summary-card">
          <div class="report-summary-num">${adventureWeeks.length}</div>
          <div class="report-summary-label">Adventure weeks</div>
        </div>
        <div class="report-summary-card">
          <div class="report-summary-num">${allBooks.length}</div>
          <div class="report-summary-label">Books finished</div>
        </div>
        <div class="report-summary-card">
          <div class="report-summary-num">${readAlouds.length}</div>
          <div class="report-summary-label">Read alouds</div>
        </div>
        <div class="report-summary-card">
          <div class="report-summary-num">${personalReads.length + assignedReads.length}</div>
          <div class="report-summary-label">Independent reads</div>
        </div>
      </div>
    </div>
  `;

  // Subject progress
  html += `
    <div class="report-section">
      <div class="report-section-title">Subject progress</div>
  `;

  subjects.forEach(subject => {
    const pct = subject.totalLessons > 0
      ? Math.round((subject.lessonsCompleted / subject.totalLessons) * 100)
      : 0;
    const archivedBadge = subject.archived
      ? `<span class="report-archived-badge">archived</span>`
      : '';
    html += `
      <div class="report-subject-row">
        <div class="report-subject-info">
          <div class="report-subject-name">${subject.name} ${archivedBadge}</div>
          <div class="report-subject-curriculum">${subject.curriculum}</div>
        </div>
        <div>
          <div class="report-progress-bg">
            <div class="report-progress-fill" style="width:${Math.min(pct,100)}%"></div>
          </div>
        </div>
        <div class="report-subject-stats">
          <div class="report-subject-pct">${pct}%</div>
          <div class="report-subject-lessons">${subject.lessonsCompleted} of ${subject.totalLessons} lessons</div>
        </div>
      </div>
    `;
  });

  html += `</div>`;

  // Weekly log detail
  if (reportIncludeWeekly && filteredLogs.length > 0) {
    html += `
      <div class="report-section">
        <div class="report-section-title">Weekly log</div>
    `;

    filteredLogs.sort((a, b) => a.weekNumber - b.weekNumber).forEach(log => {
      const logDate = new Date(log.startDate);
      const endDate = new Date(logDate);
      endDate.setDate(logDate.getDate() + 6);
      const dateRange = formatDateShort(log.startDate) + ' – ' + formatDateShort(endDate);
      const badgeClass = log.logType === 'adventure' ? 'badge-adventure' : 'badge-school';
      const badgeLabel = log.logType === 'adventure' ? 'Adventure week' : 'School week';

      html += `
        <div class="report-week-entry">
          <div class="report-week-header">
            <span class="report-week-label">Week ${log.weekNumber} · ${dateRange}</span>
            <span class="report-week-badge ${badgeClass}">${badgeLabel}</span>
          </div>
      `;

      if (log.logType === 'adventure') {
        if (log.experienceTags && log.experienceTags.length > 0) {
          html += `<div class="report-exp-tags">`;
          log.experienceTags.forEach(tag => {
            html += `<span class="report-exp-tag">${tag}</span>`;
          });
          html += `</div>`;
        }
        if (log.glow) {
          html += `<div class="report-week-subject">${log.glow}</div>`;
        }
      } else {
        if (log.subjectEntries && log.subjectEntries.length > 0) {
          log.subjectEntries.forEach(entry => {
            const subject = subjects.find(s => s.id === entry.subjectId);
            const subjectName = subject ? subject.name : 'Unknown subject';
            const details = [];
            if (entry.lessonsCompleted > 0) details.push(`${entry.lessonsCompleted} lesson${entry.lessonsCompleted > 1 ? 's' : ''}`);
            if (entry.hoursLogged > 0) details.push(`${entry.hoursLogged} hrs`);
            if (entry.notes) details.push(entry.notes);
            html += `
              <div class="report-week-subject">
                <span class="report-week-subject-name">${subjectName}</span>
                ${details.join(' · ')}
              </div>
            `;
          });
        }
      }

      if (log.books && log.books.length > 0) {
        const catLabels = { readaloud: 'Read aloud', personal: 'Personal', assigned: 'Assigned' };
        const bookList = log.books.map(b => `${b.title} (${catLabels[b.category]})`).join(', ');
        html += `<div class="report-week-books">Books finished: ${bookList}</div>`;
      }

      html += `</div>`;
    });

    html += `</div>`;
  }

// Unit and book studies
  const allUnitStudies = [];
  filteredLogs.forEach(log => {
    if (log.unitStudies && log.unitStudies.length > 0) {
      log.unitStudies.forEach(study => {
        if (!study.title) return;
        const existing = allUnitStudies.find(s => s.title === study.title && s.type === study.type);
        if (existing) {
          existing.weeks.push(log.weekNumber);
          if (study.notes && !existing.notes.includes(study.notes)) {
            existing.notes.push(study.notes);
          }
        } else {
          allUnitStudies.push({
            title: study.title,
            type: study.type || 'unit',
            subjects: study.subjects || [],
            weeks: [log.weekNumber],
            notes: study.notes ? [study.notes] : []
          });
        }
      });
    }
  });

  if (allUnitStudies.length > 0) {
    html += `
      <div class="report-section">
        <div class="report-section-title">Unit &amp; book studies</div>
    `;

    allUnitStudies.forEach(study => {
      const typeLabel = study.type === 'book' ? 'Book study' : 'Unit study';
      const weeks = study.weeks.sort((a, b) => a - b);
      const weekRange = weeks.length === 1
        ? 'Week ' + weeks[0]
        : 'Weeks ' + weeks[0] + '–' + weeks[weeks.length - 1];
      const subjectList = study.subjects && study.subjects.length > 0
        ? study.subjects.join(', ')
        : '';
      const combinedNotes = study.notes.filter(n => n).join(' · ');

      html += `
        <div class="report-subject-row">
          <div class="report-subject-info">
            <div class="report-subject-name">
              ${study.title}
              <span class="report-archived-badge">${typeLabel}</span>
            </div>
            ${subjectList ? `<div class="report-subject-curriculum">${subjectList}</div>` : ''}
            ${combinedNotes ? `<div class="report-subject-curriculum" style="font-style:italic">${combinedNotes}</div>` : ''}
          </div>
          <div class="report-subject-stats">
            <div class="report-subject-pct" style="font-size:12px;font-weight:500">${weekRange}</div>
            <div class="report-subject-lessons">${weeks.length} week${weeks.length > 1 ? 's' : ''}</div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
  }
  
  // Books finished
  if (reportIncludeBooks && allBooks.length > 0) {
    html += `
      <div class="report-section">
        <div class="report-section-title">Books finished this period</div>
        <div class="report-books-grid">
    `;

    allBooks.forEach(book => {
      const catClass = book.category === 'readaloud' ? 'rcat-readaloud' :
                       book.category === 'personal' ? 'rcat-personal' : 'rcat-assigned';
      const catLabel = book.category === 'readaloud' ? 'Read aloud' :
                       book.category === 'personal' ? 'Personal' : 'Assigned';
      html += `
        <div class="report-book-entry">
          <span class="report-book-cat ${catClass}">${catLabel}</span>
          <span class="report-book-title">${book.title}</span>
        </div>
      `;
    });

    html += `</div></div>`;
  }

  // Highlights
  if (reportIncludeHighlights && allGlows.length > 0) {
    html += `
      <div class="report-section">
        <div class="report-section-title">Highlights — moments that mattered</div>
    `;

    allGlows.sort((a, b) => a.weekNumber - b.weekNumber).forEach(log => {
      const isAdventure = log.logType === 'adventure';
      const weekLabel = `Week ${log.weekNumber} · ${isAdventure ? 'Adventure week' : 'School week'} · ${formatDateShort(log.startDate)}`;
      html += `
        <div class="report-glow-entry">
          <div class="report-glow-text">"${log.glow}"</div>
          <div class="report-glow-meta">${weekLabel}</div>
        </div>
      `;
    });

    html += `</div>`;
  }

  // Footer
  html += `
    <div class="report-footer">
      <div class="report-footer-text">
        This document is a personal learning record prepared by ${family.nickname} for the ${activeYear.label} school year.
        It is not an official government document. All information is self-reported by the family.
      </div>
    </div>
  `;

  html += `</div>`;

  document.getElementById('report-content').innerHTML = html;
  showScreen('screen-report');
});

// =====================
// BACK FROM REPORT
// =====================
document.getElementById('btn-back-from-report').addEventListener('click', () => {
  showScreen('screen-settings');
});

// =====================
// PRINT REPORT
// =====================
document.getElementById('btn-print-report').addEventListener('click', () => {
  window.print();
});
// =====================
// WRAPPED HELPERS
// =====================
function getRandomGlows(logs, count) {
  const glowLogs = logs.filter(l => l.glow && l.glow.trim() !== '');
  if (glowLogs.length <= count) return glowLogs;
  const shuffled = [...glowLogs].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function getAdventureCount(logs) {
  return logs.filter(l => l.logType === 'adventure').length;
}

function getTopExperienceTags(logs) {
  const tagCounts = {};
  logs.forEach(log => {
    if (log.experienceTags) {
      log.experienceTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });
  return Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);
}

function getCurriculaFinished(subjects) {
  return subjects.filter(s => {
    if (s.totalLessons === 0) return false;
    const pct = (s.lessonsCompleted / s.totalLessons) * 100;
    return pct >= 80;
  }).length;
}

function isWrappedSeason(family) {
  const now = new Date();
  const monthNames = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const startMonthIndex = monthNames.indexOf(family.schoolYearStart || 'august');
  const endMonthIndex = (startMonthIndex + 11) % 12;
  return now.getMonth() === endMonthIndex;
}

// =====================
// BUILD WRAPPED CARD
// =====================
function buildWrappedCard(family, child, activeYear) {
  const logs = getLogs(child);
  const subjects = getSubjects(child);
  const streak = calculateStreak(child);
  const earnedGems = getEarnedGems(child, family);
  const glows = getRandomGlows(logs, 3);
  const adventureCount = getAdventureCount(logs);
  const topTags = getTopExperienceTags(logs);
  const curriculaFinished = getCurriculaFinished(subjects);
  const earnedCount = earnedGems.filter(g => g.earned).length;

  const monthNames = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const startMonthIndex = monthNames.indexOf(family.schoolYearStart || 'august');
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const orderedMonthLabels = [];
  for (let i = 0; i < 12; i++) {
    orderedMonthLabels.push(monthLabels[(startMonthIndex + i) % 12]);
  }

  const gemsHTML = earnedGems.map(gem => {
    if (!gem.earned) {
      return `<svg width="25" height="30" viewBox="0 0 30 36">
        <polygon points="15,2 28,10 28,26 15,34 2,26 2,10" fill="#2a2040" stroke="#3d3060" stroke-width="0.5" opacity="0.3"/>
      </svg>`;
    }
    return `<svg width="25" height="30" viewBox="0 0 30 36">
      <polygon points="15,2 28,10 28,26 15,34 2,26 2,10" fill="${gem.color}" stroke="${gem.stroke}" stroke-width="0.5"/>
      <polygon points="15,2 28,10 15,18" fill="${gem.stroke}" opacity="0.5"/>
      <polygon points="15,2 2,10 15,18" fill="${gem.color}" opacity="0.8"/>
      <line x1="12" y1="8" x2="18" y2="14" stroke="white" stroke-width="0.5" opacity="0.4"/>
    </svg>`;
  }).join('');

  const monthLabelsHTML = orderedMonthLabels.map(m =>
    `<span class="wrapped-gem-month">${m}</span>`
  ).join('');

  const glowsHTML = glows.map(log => {
    const isAdventure = log.logType === 'adventure';
    const adventureClass = isAdventure ? ' adventure' : '';
    const weekLabel = `Week ${log.weekNumber} · ${isAdventure ? 'Adventure' : 'School'} week`;
    return `
      <div class="wrapped-glow-entry${adventureClass}">
        <div class="wrapped-glow-text">"${log.glow}"</div>
        <div class="wrapped-glow-meta">${weekLabel}</div>
      </div>
    `;
  }).join('');

  const noGlowsHTML = glows.length === 0
    ? `<div style="font-size:12px;color:#6b5f85;font-style:italic;padding:8px 0">No highlights logged yet. Add glows to your weekly logs to see them here.</div>`
    : '';

  const tagsDisplay = topTags.length > 0
    ? topTags.join(' · ')
    : 'field trips · nature · travel';

  const card = document.getElementById('wrapped-card');
  card.innerHTML = `
    <div class="wrapped-glow-top"></div>
    <div class="wrapped-glow-bottom"></div>

    <div class="wrapped-year-label">${activeYear.label} school year</div>
    <svg width="346" height="80" viewBox="0 0 346 80" style="display:block;margin-bottom:8px;overflow:visible">
      <defs>
        <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#e879f9"/>
          <stop offset="50%" style="stop-color:#818cf8"/>
          <stop offset="100%" style="stop-color:#38bdf8"/>
        </linearGradient>
      </defs>
      <text x="0" y="38" font-family="Nunito, sans-serif" font-size="36" font-weight="800" fill="url(#titleGrad)">Your Year,</text>
      <text x="0" y="76" font-family="Nunito, sans-serif" font-size="36" font-weight="800" fill="url(#titleGrad)">Wrapped</text>
    </svg>

    <div class="wrapped-identity">
      <div class="wrapped-avatar">${child.avatar}</div>
      <div>
        <div class="wrapped-identity-name">${child.grade} grade</div>
        <div class="wrapped-identity-school">${family.nickname}</div>
      </div>
    </div>

    <div class="wrapped-divider"></div>

    <div class="wrapped-section-label">✦ gems collected</div>
    <div class="wrapped-gems-row">${gemsHTML}</div>
    <div class="wrapped-gem-months">${monthLabelsHTML}</div>
    <div class="wrapped-gem-count">${earnedCount} of 12 gems unlocked</div>

    <div class="wrapped-divider"></div>

    <div class="wrapped-section-label">✦ moments that mattered</div>
    ${glowsHTML}
    ${noGlowsHTML}

    <div class="wrapped-divider"></div>

    <div class="wrapped-stats-grid">
      <div class="wrapped-stat-card adventures">
        <div class="wrapped-stat-label">Adventures</div>
        <div class="wrapped-stat-num">${adventureCount}</div>
        <div class="wrapped-stat-sub">${tagsDisplay}</div>
      </div>
      <div class="wrapped-stat-card curricula">
        <div class="wrapped-stat-label">Curricula finished</div>
        <div class="wrapped-stat-num">${curriculaFinished} <span style="font-size:13px;font-weight:400;color:#c4b5fd">of ${subjects.length}</span></div>
        <div class="wrapped-stat-sub">80%+ completion</div>
      </div>
    </div>

    <div class="wrapped-streak-row">
      <div class="wrapped-streak-icon">🔥</div>
      <div>
        <div class="wrapped-streak-text">${streak}-week logging streak</div>
        <div class="wrapped-streak-sub">You showed up all year long</div>
      </div>
    </div>

    <div style="height:16px"></div>

    <div class="wrapped-branding">✦ made with A Tale of Changes ✦</div>
  `;
}

// =====================
// SHOW WRAPPED SCREEN
// =====================
function showWrapped() {
  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);

  buildWrappedCard(family, child, activeYear);
  showScreen('screen-wrapped');
}

// =====================
// WRAPPED TRIGGERS
// =====================
document.getElementById('btn-wrapped-dashboard').addEventListener('click', () => {
  showWrapped();
});

document.getElementById('btn-wrapped-settings').addEventListener('click', () => {
  showWrapped();
});

document.getElementById('btn-regenerate-wrapped').addEventListener('click', () => {
  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);
  buildWrappedCard(family, child, activeYear);
});

document.getElementById('btn-back-from-wrapped').addEventListener('click', () => {
  showScreen('screen-dashboard');
});

// =====================
// SAVE WRAPPED IMAGE
// =====================
document.getElementById('btn-save-wrapped').addEventListener('click', () => {
  const card = document.getElementById('wrapped-card');
  const btn = document.getElementById('btn-save-wrapped');

  btn.textContent = 'Saving...';
  btn.disabled = true;

  html2canvas(card, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#1a0a2e',
    logging: false,
    width: 390,
    height: card.offsetHeight
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = 'my-homeschool-wrapped.png';
    link.href = canvas.toDataURL('image/png');
    link.click();

    btn.innerHTML = '<i class="ti ti-download"></i> Save image';
    btn.disabled = false;
  }).catch(err => {
    console.error('Wrapped save error:', err);
    btn.innerHTML = '<i class="ti ti-download"></i> Save image';
    btn.disabled = false;
    alert('Something went wrong saving the image. Try again.');
  });
});

// =====================
// CHECK WRAPPED SEASON
// =====================
function checkWrappedSeason() {
  const family = loadData('family');
  if (!family) return;

  const banner = document.getElementById('wrapped-banner');
  if (!banner) return;

  if (isWrappedSeason(family)) {
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }
}
// =====================
// AUTH UI HELPERS
// =====================
function showAuthError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}

function hideAuthError(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.style.display = 'none';
}

function getAuthErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Try again or use a magic link.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/invalid-credential': 'Incorrect email or password.',
  };
  return messages[code] || 'Something went wrong. Please try again.';
}

// =====================
// AUTH TABS
// =====================
document.getElementById('tab-signin').addEventListener('click', () => {
  document.getElementById('tab-signin').classList.add('active');
  document.getElementById('tab-signup').classList.remove('active');
  document.getElementById('auth-signin-form').style.display = 'block';
  document.getElementById('auth-signup-form').style.display = 'none';
  hideAuthError('auth-error');
});

document.getElementById('tab-signup').addEventListener('click', () => {
  document.getElementById('tab-signup').classList.add('active');
  document.getElementById('tab-signin').classList.remove('active');
  document.getElementById('auth-signup-form').style.display = 'block';
  document.getElementById('auth-signin-form').style.display = 'none';
  hideAuthError('signup-error');
});

// =====================
// SIGN IN
// =====================
document.getElementById('btn-signin').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  hideAuthError('auth-error');

  if (!email || !password) {
    showAuthError('auth-error', 'Please enter your email and password.');
    return;
  }

  try {
    await signIn(email, password);
  } catch (err) {
    showAuthError('auth-error', getAuthErrorMessage(err.code));
  }
});

// =====================
// SIGN UP
// =====================
document.getElementById('btn-signup').addEventListener('click', async () => {
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;
  hideAuthError('signup-error');

  if (!email || !password || !confirm) {
    showAuthError('signup-error', 'Please fill in all fields.');
    return;
  }

  if (password !== confirm) {
    showAuthError('signup-error', 'Passwords do not match.');
    return;
  }

  if (password.length < 6) {
    showAuthError('signup-error', 'Password must be at least 6 characters.');
    return;
  }

  try {
    await signUp(email, password);
  } catch (err) {
    showAuthError('signup-error', getAuthErrorMessage(err.code));
  }
});

// =====================
// MAGIC LINK
// =====================
document.getElementById('btn-magic-link').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  hideAuthError('auth-error');

  if (!email) {
    showAuthError('auth-error', 'Please enter your email address first.');
    return;
  }

  try {
    await sendMagicLink(email);
    localStorage.setItem('emailForSignIn', email);
    document.getElementById('magic-email-display').textContent = email;
    showScreen('screen-magic-sent');
  } catch (err) {
    showAuthError('auth-error', getAuthErrorMessage(err.code));
  }
});

document.getElementById('btn-back-to-auth').addEventListener('click', () => {
  showScreen('screen-auth');
});

// =====================
// MAGIC LINK CONFIRM
// =====================
document.getElementById('btn-magic-confirm').addEventListener('click', async () => {
  const email = document.getElementById('magic-confirm-email').value.trim();
  hideAuthError('magic-confirm-error');

  if (!email) {
    showAuthError('magic-confirm-error', 'Please enter your email address.');
    return;
  }

  try {
    await completeMagicLinkSignIn(email);
    localStorage.removeItem('emailForSignIn');
  } catch (err) {
    showAuthError('magic-confirm-error', getAuthErrorMessage(err.code));
  }
});

// =====================
// FORGOT PASSWORD
// =====================
document.getElementById('btn-forgot-password').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  hideAuthError('auth-error');

  if (!email) {
    showAuthError('auth-error', 'Please enter your email address first.');
    return;
  }

  try {
    await resetPassword(email);
    showAuthError('auth-error', 'Password reset email sent. Check your inbox.');
    document.getElementById('auth-error').style.background = '#f0fdf4';
    document.getElementById('auth-error').style.borderColor = '#86efac';
    document.getElementById('auth-error').style.color = '#166534';
  } catch (err) {
    showAuthError('auth-error', getAuthErrorMessage(err.code));
  }
});

// =====================
// SIGN OUT
// =====================
document.querySelector('.icon-btn').addEventListener('click', () => {
  const family = loadData('family');
  if (!family) return;

  // Check if coming from settings gear or opening settings
  // We'll handle this by checking if settings screen is already active
  if (document.getElementById('screen-settings').classList.contains('active')) return;

  const officialName = document.getElementById('settings-official-name');
  if (officialName) {
    document.getElementById('settings-official-name').textContent = family.officialName;
    document.getElementById('settings-nickname').textContent = family.nickname;
    document.getElementById('settings-year-start').textContent =
      family.schoolYearStart.charAt(0).toUpperCase() + family.schoolYearStart.slice(1);

    const child = family.children[currentChildIndex];
    const activeYear = getActiveYear(child);
    const quarters = activeYear?.quarterSettings;

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
  }
});

// =====================
// AUTH STATE LISTENER
// =====================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;

    // Check for magic link completion
    if (window.location.href.includes('oobCode')) {
      const savedEmail = localStorage.getItem('emailForSignIn');
      if (savedEmail) {
        try {
          await completeMagicLinkSignIn(savedEmail);
          localStorage.removeItem('emailForSignIn');
        } catch (err) {
          console.error('Magic link error:', err);
        }
      } else {
        showScreen('screen-magic-confirm');
        return;
      }
    }

    // Load user data from Firestore
    try {
      const data = await loadUserData(user.uid);
      if (data) {
        appData = migrateData(data);
        if (appData !== data) {
          await saveUserData(user.uid, appData);
        }
        renderDashboard();
        checkNewYearPrompt();
        if (document.getElementById('screen-new-year').classList.contains('active')) return;
        showScreen('screen-dashboard');
      } else {
        showScreen('screen-onboarding');
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      showScreen('screen-onboarding');
    }
  } else {
    currentUser = null;
    appData = null;
    showScreen('screen-auth');
  }
});
// =====================
// EDIT CHILD
// =====================
let editingChildIndex = null;
let editSelectedGrade = null;
let editSelectedAvatar = null;

function openEditChild(childIndex) {
  const family = loadData('family');
  const child = family.children[childIndex];
  editingChildIndex = childIndex;
  editSelectedGrade = child.grade;
  editSelectedAvatar = child.avatar;

  // Pre-fill name
  document.getElementById('edit-child-name').value = child.name;

  // Pre-select grade
  document.querySelectorAll('.edit-grade-chip').forEach(chip => {
    chip.classList.remove('selected');
    if (chip.dataset.grade === child.grade) {
      chip.classList.add('selected');
    }
  });

  // Pre-select avatar
  document.querySelectorAll('.edit-avatar-opt').forEach(opt => {
    opt.classList.remove('selected');
    if (opt.dataset.avatar === child.avatar) {
      opt.classList.add('selected');
    }
  });

  showScreen('screen-edit-child');
}

// Grade selection
document.querySelectorAll('.edit-grade-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.edit-grade-chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    editSelectedGrade = chip.dataset.grade;
  });
});

// Avatar selection
document.querySelectorAll('.edit-avatar-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.edit-avatar-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    editSelectedAvatar = opt.dataset.avatar;
  });
});

// Back button
document.getElementById('btn-back-from-edit-child').addEventListener('click', () => {
  showScreen('screen-dashboard');
});

// Save changes
document.getElementById('btn-save-edit-child').addEventListener('click', async () => {
  const name = document.getElementById('edit-child-name').value.trim();

  if (!name) { alert('Please enter a name.'); return; }
  if (!editSelectedGrade) { alert('Please select a grade.'); return; }
  if (!editSelectedAvatar) { alert('Please select an avatar.'); return; }

  const family = loadData('family');
  family.children[editingChildIndex].name = name;
  family.children[editingChildIndex].grade = editSelectedGrade;
  family.children[editingChildIndex].avatar = editSelectedAvatar;

  await saveData('family', family);
  renderDashboard();
  showScreen('screen-dashboard');
});

// Delete child
document.getElementById('btn-delete-child').addEventListener('click', async () => {
  const family = loadData('family');
  const child = family.children[editingChildIndex];

  if (!confirm(`Remove ${child.name}? This permanently deletes all their data and cannot be undone.`)) return;

  family.children.splice(editingChildIndex, 1);

  if (family.children.length === 0) {
    await saveData('family', family);
    showScreen('screen-add-child');
    return;
  }

  currentChildIndex = 0;
  await saveData('family', family);
  renderDashboard();
  showScreen('screen-dashboard');
});
// =====================
// NEW SCHOOL YEAR PROMPT
// =====================
function getNextYearLabel(family) {
  const monthNames = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const startMonthIndex = monthNames.indexOf(family.schoolYearStart || 'august');
  const now = new Date();
  let startYear = now.getFullYear();
  if (now.getMonth() < startMonthIndex) startYear = now.getFullYear() - 1;
  return (startYear + 1) + '-' + (startYear + 2);
}

function shouldShowNewYearPrompt(family) {
  const monthNames = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
 const startMonthIndex = monthNames.indexOf(family.schoolYearStart || 'august');
  const now = new Date();

  // Only show in the school year start month
  if (now.getMonth() !== startMonthIndex) return false;

  // Check if already dismissed this month
  const dismissed = localStorage.getItem('newYearDismissed');
  if (dismissed) {
    const dismissedDate = new Date(dismissed);
    if (dismissedDate.getMonth() === now.getMonth() &&
        dismissedDate.getFullYear() === now.getFullYear()) {
      return false;
    }
  }

  // Check if snoozed
  const snoozed = localStorage.getItem('newYearSnoozed');
  if (snoozed) {
    const snoozeDate = new Date(snoozed);
    if (now < snoozeDate) return false;
  }

  // Check if active year is already the new year
  const child = family.children[0];
  if (!child) return false;
  const activeYear = getActiveYear(child);
  if (!activeYear) return false;

 const nextLabel = getNextYearLabel(family);
  const currentLabel = generateYearLabel(family.schoolYearStart);
  if (activeYear.label === nextLabel || activeYear.label === currentLabel) return false;

  return true;
}

function checkNewYearPrompt() {
  const family = loadData('family');
  if (!family || !family.children || family.children.length === 0) return;
  if (!shouldShowNewYearPrompt(family)) return;

  const nextLabel = getNextYearLabel(family);
  const monthNames = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const startMonthIndex = monthNames.indexOf(family.schoolYearStart || 'august');
  const monthLabel = new Date(2024, startMonthIndex, 1)
    .toLocaleString('default', { month: 'long' });

  document.getElementById('new-year-title').textContent =
    'Ready for a new school year?';
  document.getElementById('new-year-sub').textContent =
    'It\'s ' + monthLabel + ' — time to start fresh.';
  document.getElementById('new-year-label').textContent = nextLabel;

  showScreen('screen-new-year');
}

// Start new year
document.getElementById('btn-start-new-year').addEventListener('click', async () => {
  const family = loadData('family');
  const nextLabel = getNextYearLabel(family);

  // Archive current year and create new one for each child
  family.children = family.children.map(child => {
    // Mark current year inactive
    if (child.schoolYears) {
      child.schoolYears = child.schoolYears.map(y => ({ ...y, isActive: false }));
    }

    // Create fresh new year
    const newYear = createSchoolYear(nextLabel, family.schoolYearStart);
    child.schoolYears.push(newYear);
    return child;
  });

  // Clear snooze and dismiss flags
  localStorage.removeItem('newYearSnoozed');
  localStorage.removeItem('newYearDismissed');

  await saveData('family', family);
  currentChildIndex = 0;
  renderDashboard();
  showScreen('screen-dashboard');
});

// Snooze 2 weeks
document.getElementById('btn-snooze-new-year').addEventListener('click', () => {
  const snoozeUntil = new Date();
  snoozeUntil.setDate(snoozeUntil.getDate() + 14);
  localStorage.setItem('newYearSnoozed', snoozeUntil.toISOString());
  showScreen('screen-dashboard');
});

// Dismiss for this month
document.getElementById('btn-dismiss-new-year').addEventListener('click', () => {
  localStorage.setItem('newYearDismissed', new Date().toISOString());
  showScreen('screen-dashboard');
});
// =====================
// UNIT STUDY STATE
// =====================
let schoolUnitStudies = [];
let adventureUnitStudies = [];

const UNIT_SUBJECTS = ['Science', 'Geography', 'History', 'Literature', 'Math', 'Art', 'Writing', 'Music', 'PE', 'Health'];

// =====================
// UNIT STUDY HELPERS
// =====================
function createUnitStudyEntry(prefix, index) {
  const entryId = prefix + '-unit-' + index;
  const div = document.createElement('div');
  div.className = 'unit-entry';
  div.id = entryId;

  div.innerHTML = `
    <div class="unit-entry-header">
      <span class="unit-entry-label">Study ${index + 1}</span>
      <button class="unit-remove-btn" data-index="${index}" data-prefix="${prefix}">×</button>
    </div>
    <div class="unit-type-chips">
      <div class="unit-type-chip selected" data-type="unit" data-index="${index}" data-prefix="${prefix}">Unit study</div>
      <div class="unit-type-chip" data-type="book" data-index="${index}" data-prefix="${prefix}">Book study</div>
    </div>
    <input class="unit-input" placeholder="Study or book title..." id="${prefix}-unit-title-${index}" />
    <span class="unit-subject-label">Subject connections</span>
    <div class="unit-subject-tags" id="${prefix}-unit-tags-${index}">
      ${UNIT_SUBJECTS.map(s => `
        <span class="unit-subject-tag" data-subject="${s}" data-index="${index}" data-prefix="${prefix}">${s}</span>
      `).join('')}
    </div>
    <textarea class="unit-notes" rows="2" placeholder="What did you cover this week within this study?" id="${prefix}-unit-notes-${index}"></textarea>
  `;

  // Type chip listeners
  div.querySelectorAll('.unit-type-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      div.querySelectorAll('.unit-type-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      const studies = prefix === 'school' ? schoolUnitStudies : adventureUnitStudies;
      studies[chip.dataset.index].type = chip.dataset.type;
    });
  });

  // Subject tag listeners
  div.querySelectorAll('.unit-subject-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      tag.classList.toggle('selected');
      const studies = prefix === 'school' ? schoolUnitStudies : adventureUnitStudies;
      const study = studies[parseInt(tag.dataset.index)];
      if (!study.subjects) study.subjects = [];
      if (tag.classList.contains('selected')) {
        study.subjects.push(tag.dataset.subject);
      } else {
        study.subjects = study.subjects.filter(s => s !== tag.dataset.subject);
      }
    });
  });

  // Remove button
  div.querySelector('.unit-remove-btn').addEventListener('click', () => {
    const idx = parseInt(div.querySelector('.unit-remove-btn').dataset.index);
    if (prefix === 'school') {
      schoolUnitStudies.splice(idx, 1);
      renderUnitStudies('school');
    } else {
      adventureUnitStudies.splice(idx, 1);
      renderUnitStudies('adventure');
    }
  });

  return div;
}

function renderUnitStudies(prefix) {
  const container = document.getElementById(prefix + '-unit-study-entries');
  if (!container) return;
  container.innerHTML = '';

  const studies = prefix === 'school' ? schoolUnitStudies : adventureUnitStudies;
  studies.forEach((study, index) => {
    const entry = createUnitStudyEntry(prefix, index);
    container.appendChild(entry);

    // Restore values
    const titleEl = document.getElementById(prefix + '-unit-title-' + index);
    const notesEl = document.getElementById(prefix + '-unit-notes-' + index);
    if (titleEl) titleEl.value = study.title || '';
    if (notesEl) notesEl.value = study.notes || '';

    // Restore type
    entry.querySelectorAll('.unit-type-chip').forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.type === (study.type || 'unit'));
    });

    // Restore subjects
    if (study.subjects) {
      entry.querySelectorAll('.unit-subject-tag').forEach(tag => {
        tag.classList.toggle('selected', study.subjects.includes(tag.dataset.subject));
      });
    }
  });
}

function collectUnitStudyData(prefix) {
  const studies = prefix === 'school' ? schoolUnitStudies : adventureUnitStudies;
  return studies.map((study, index) => {
    const titleEl = document.getElementById(prefix + '-unit-title-' + index);
    const notesEl = document.getElementById(prefix + '-unit-notes-' + index);
    return {
      title: titleEl ? titleEl.value.trim() : study.title || '',
      type: study.type || 'unit',
      subjects: study.subjects || [],
      notes: notesEl ? notesEl.value.trim() : study.notes || ''
    };
  }).filter(s => s.title !== '');
}

// =====================
// UNIT STUDY TOGGLES
// =====================
function setupUnitStudyToggle(toggleId, sectionId, prefix) {
  const toggle = document.getElementById(toggleId);
  const section = document.getElementById(sectionId);
  if (!toggle || !section) return;

  toggle.addEventListener('click', () => {
    const isOn = toggle.classList.contains('on');
    if (isOn) {
      toggle.classList.remove('on');
      section.style.display = 'none';
    } else {
      toggle.classList.add('on');
      section.style.display = 'block';
    }
  });
}

setupUnitStudyToggle('toggle-unit-study', 'unit-study-section', 'school');
setupUnitStudyToggle('toggle-unit-study-adventure', 'unit-study-section-adventure', 'adventure');

// =====================
// ADD UNIT STUDY BUTTONS
// =====================
document.getElementById('btn-add-unit-study').addEventListener('click', () => {
  schoolUnitStudies.push({ title: '', type: 'unit', subjects: [], notes: '' });
  renderUnitStudies('school');
});

document.getElementById('btn-add-unit-study-adventure').addEventListener('click', () => {
  adventureUnitStudies.push({ title: '', type: 'unit', subjects: [], notes: '' });
  renderUnitStudies('adventure');
});

// =====================
// RESET UNIT STUDIES
// =====================
function resetUnitStudies() {
  schoolUnitStudies = [];
  adventureUnitStudies = [];

  const schoolSection = document.getElementById('unit-study-section');
  const adventureSection = document.getElementById('unit-study-section-adventure');
  if (schoolSection) schoolSection.style.display = 'none';
  if (adventureSection) adventureSection.style.display = 'none';

  document.getElementById('toggle-unit-study')?.classList.remove('on');
  document.getElementById('toggle-unit-study-adventure')?.classList.remove('on');

  const schoolEntries = document.getElementById('school-unit-study-entries');
  const adventureEntries = document.getElementById('adventure-unit-study-entries');
  if (schoolEntries) schoolEntries.innerHTML = '';
  if (adventureEntries) adventureEntries.innerHTML = '';
}
// =====================
// COPY SUBJECTS
// =====================
function updateCopySubjectsBanner() {
  const family = loadData('family');
  if (!family) return;

  const banner = document.getElementById('copy-subjects-banner');
  if (!banner) return;

  // Find other children with subjects
  const otherChildren = family.children.filter((child, index) => {
    if (index === currentChildIndex) return false;
    const subjects = getSubjects(child);
    return subjects && subjects.filter(s => !s.archived).length > 0;
  });

  if (otherChildren.length === 0) {
    banner.style.display = 'none';
    return;
  }

  // Use the first sibling with subjects
  const sibling = otherChildren[0];
  const siblingSubjects = getSubjects(sibling).filter(s => !s.archived);

  banner.style.display = 'block';
  document.getElementById('copy-subjects-avatar').textContent = sibling.avatar;
  document.getElementById('copy-subjects-label').textContent = 'Copy from ' + sibling.name;
  document.getElementById('copy-subjects-sub').textContent =
    siblingSubjects.length + ' subject' + (siblingSubjects.length !== 1 ? 's' : '') + ' · ' + sibling.grade + ' grade';
}

document.getElementById('btn-copy-subjects').addEventListener('click', async () => {
  const family = loadData('family');
  if (!family) return;

  // Find sibling with subjects
  const otherChildren = family.children.filter((child, index) => {
    if (index === currentChildIndex) return false;
    const subjects = getSubjects(child);
    return subjects && subjects.filter(s => !s.archived).length > 0;
  });

  if (otherChildren.length === 0) return;

  const sibling = otherChildren[0];
  const siblingSubjects = getSubjects(sibling).filter(s => !s.archived);

  // Copy subjects to current child with fresh lesson counts
  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);

  const copiedSubjects = siblingSubjects.map(subject => ({
    id: Math.floor(Date.now() + Math.random() * 1000),
    name: subject.name,
    type: subject.type,
    curriculum: subject.curriculum,
    totalLessons: subject.totalLessons,
    duration: subject.duration,
    creditBearing: false,
    creditMethod: subject.creditMethod || 'lessons',
    lessonsCompleted: 0,
    hoursLogged: 0,
    archived: false,
    copied: true,
    createdAt: new Date().toISOString()
  }));

 activeYear.subjects = [...activeYear.subjects, ...copiedSubjects];
  family.children[currentChildIndex] = child;
  await saveData('family', family);

  // Hide copy banner
  document.getElementById('copy-subjects-banner').style.display = 'none';

  // Show copied subjects list for review
  showCopiedSubjectsReview(sibling.name, copiedSubjects.length);
});

function showCopiedSubjectsReview(siblingName, count) {
  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);
  const copiedSubjects = activeYear.subjects.filter(s => s.copied && !s.archived);

  const screen = document.getElementById('screen-add-subject');
  const existingReview = document.getElementById('copied-review-section');
  if (existingReview) existingReview.remove();

  const reviewDiv = document.createElement('div');
  reviewDiv.id = 'copied-review-section';
  reviewDiv.innerHTML = `
    <div class="copy-confirm-banner" style="margin-bottom:14px">
      <i class="ti ti-circle-check" style="font-size:16px;color:#059669;flex-shrink:0;margin-top:1px"></i>
      <div class="copy-confirm-text">
        ${count} subject${count !== 1 ? 's' : ''} copied from ${siblingName}.
        Remove any that don't apply, then add new ones below.
      </div>
    </div>
    <div class="section-label">Copied subjects</div>
    <div id="copied-subjects-list"></div>
    <div class="divider"></div>
  `;

  const formGroup = document.querySelector('#screen-add-subject .form-group');
  if (formGroup) {
    formGroup.parentNode.insertBefore(reviewDiv, formGroup);
  }

  renderCopiedSubjectsList();
}

function renderCopiedSubjectsList() {
  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const activeYear = getActiveYear(child);
  const copiedSubjects = activeYear.subjects.filter(s => s.copied && !s.archived);

  const list = document.getElementById('copied-subjects-list');
  if (!list) return;

  if (copiedSubjects.length === 0) {
    list.innerHTML = `<p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:12px">All copied subjects removed.</p>`;
    return;
  }

  list.innerHTML = copiedSubjects.map(subject => `
    <div class="subject-card" style="display:flex;align-items:center;gap:8px;cursor:default" data-copied-id="${subject.id}">
      <div style="flex:1;min-width:0">
        <div class="subject-name">${subject.name} <span class="copied-badge">copied</span></div>
        <div class="subject-meta" style="margin-top:2px">
          <span>${subject.curriculum}</span>
          <span>${subject.totalLessons} lessons</span>
        </div>
      </div>
      <button class="btn-remove-copied" data-id="${subject.id}" style="background:none;border:none;color:var(--color-text-tertiary);font-size:20px;cursor:pointer;padding:0;flex-shrink:0">×</button>
    </div>
  `).join('');

  list.querySelectorAll('.btn-remove-copied').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseFloat(btn.dataset.id);
      const family = loadData('family');
      const child = family.children[currentChildIndex];
      const activeYear = getActiveYear(child);
      const subjectIndex = activeYear.subjects.findIndex(s => s.id === id);
      if (subjectIndex !== -1) {
        activeYear.subjects.splice(subjectIndex, 1);
        family.children[currentChildIndex] = child;
        await saveData('family', family);
        renderCopiedSubjectsList();
        renderDashboard();
      }
    });
  });
}
