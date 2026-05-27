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

function createChild(name, grade, avatar) {
  return {
    id: Date.now(),
    name,
    grade,
    avatar,
    subjects: [],
    weeklyLogs: [],
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

  if (!name) {
    alert('Please enter your child\'s name.');
    return;
  }
  if (!selectedGrade) {
    alert('Please select a grade level.');
    return;
  }
  if (!selectedAvatar) {
    alert('Please pick an avatar.');
    return;
  }

  const family = loadData('family');
  const child = createChild(name, selectedGrade, selectedAvatar);
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
  if (!child.weeklyLogs || child.weeklyLogs.length === 0) return 0;

  // Sort logs by week number descending
  const logs = [...child.weeklyLogs].sort((a, b) => b.weekNumber - a.weekNumber);

  const family = loadData('family');
  const currentWeek = getWeekNumber(family);

  let streak = 0;
  let expectedWeek = currentWeek;

  // Allow one grace week gap
  let graceUsed = false;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    if (log.weekNumber === expectedWeek) {
      streak++;
      expectedWeek--;
    } else if (!graceUsed && log.weekNumber === expectedWeek - 1) {
      // Gap of one week — use grace
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
// DASHBOARD
// =====================
function renderDashboard() {
  const family = loadData('family');
  if (!family) return;

  const child = family.children[currentChildIndex];

  document.getElementById('display-nickname').textContent = '✦ ' + family.nickname;
  document.getElementById('dashboard-avatar').textContent = child.avatar;
  document.getElementById('dashboard-child-name').textContent = child.name;
  document.getElementById('dashboard-child-grade').textContent = child.grade + ' grade · ' + new Date().getFullYear() + ' school year';
  const streak = calculateStreak(child);
  document.getElementById('dashboard-streak').innerHTML = streak + ' <span>week streak</span>';
  document.getElementById('log-week-label').textContent = 'Week 1 · ' + getCurrentWeekDates();

  renderChildSwitcher(family);
  renderSubjectList(child);
}

function getCurrentWeekDates() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return monday.toLocaleDateString('en-US', opts) + ' – ' + sunday.toLocaleDateString('en-US', opts);
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

  if (child.subjects.length === 0) {
    list.innerHTML = `<p style="font-size:14px;color:var(--color-text-secondary);margin-bottom:12px">No subjects set up yet. Add your first subject to get started.</p>`;
    return;
  }

  child.subjects.forEach(subject => {
    const pct = subject.totalLessons > 0
      ? Math.round((subject.lessonsCompleted / subject.totalLessons) * 100)
      : 0;

    const card = document.createElement('div');
    card.className = 'subject-card';
    card.innerHTML = `
      <div class="subject-header-row">
        <span class="subject-name">${subject.name}</span>
        <span class="subject-pct">${pct}%</span>
      </div>
      <div class="progress-bg">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="subject-meta">
        <span>${subject.curriculum}</span>
        <span>${subject.lessonsCompleted} of ${subject.totalLessons} lessons</span>
      </div>
    `;
    list.appendChild(card);
  });
}



// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
  const family = loadData('family');
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

// Credit toggle
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

// Credit method selection
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

// Save subject
document.getElementById('btn-save-subject').addEventListener('click', () => {
  const name = document.getElementById('subject-name').value.trim();
  const type = document.getElementById('subject-type').value;
  const curriculum = document.getElementById('subject-curriculum').value.trim();
  const totalLessons = parseInt(document.getElementById('subject-lessons').value);
  const duration = document.getElementById('subject-duration').value;

  if (!name) {
    alert('Please enter a subject name.');
    return;
  }
  if (!curriculum) {
    alert('Please enter a curriculum or resource name.');
    return;
  }
  if (!totalLessons || totalLessons < 1) {
    alert('Please enter the total number of lessons.');
    return;
  }

  const family = loadData('family');
  const child = family.children[currentChildIndex];

  const subject = {
    id: Date.now(),
    name,
    type,
    curriculum,
    totalLessons,
    duration,
    creditBearing,
    creditMethod: selectedCreditMethod,
    lessonsCompleted: 0,
    hoursLogged: 0,
    createdAt: new Date().toISOString()
  };

  child.subjects.push(subject);
  family.children[currentChildIndex] = child;
  saveData('family', family);

  // Reset form for next use
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
  const startYear = now.getMonth() >= startMonthIndex ? now.getFullYear() : now.getFullYear() - 1;
  const schoolStart = new Date(startYear, startMonthIndex, 1);
  const diff = now - schoolStart;
  const weeks = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, weeks);
}

function formatWeekDates(startDate) {
  const end = new Date(startDate);
  end.setDate(startDate.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return startDate.toLocaleDateString('en-US', opts) + ' – ' + end.toLocaleDateString('en-US', opts);
}

function getCurrentMonthGem() {
  const gems = [
    { name: 'Garnet', color: '#8B0000' },
    { name: 'Amethyst', color: '#4a235a' },
    { name: 'Aquamarine', color: '#1a6b7a' },
    { name: 'Diamond', color: '#c8d8e8' },
    { name: 'Emerald', color: '#145a32' },
    { name: 'Pearl', color: '#c0a080' },
    { name: 'Ruby', color: '#7b0000' },
    { name: 'Peridot', color: '#4a6741' },
    { name: 'Sapphire', color: '#1a3a6b' },
    { name: 'Opal', color: '#5c3a1e' },
    { name: 'Topaz', color: '#2d4a6b' },
    { name: 'Turquoise', color: '#1a3a6b' }
  ];
  return gems[new Date().getMonth()];
}

// =====================
// LOG THIS WEEK BUTTON
// =====================
document.getElementById('btn-log-week').addEventListener('click', () => {
  const family = loadData('family');
  currentWeekStartDate = getWeekStartDate();
  currentWeekNumber = getWeekNumber(family);
  const weekLabel = 'Week ' + currentWeekNumber + ' · ' + formatWeekDates(currentWeekStartDate);

  document.getElementById('week-type-label').textContent = weekLabel;

  const gem = getCurrentMonthGem();
  document.getElementById('week-gem-notice-text').textContent =
    'Log this week to work toward your ' + gem.name + ' — ' + new Date().toLocaleString('default', { month: 'long' }) + '\'s gem.';

  currentWeekType = null;
  document.querySelectorAll('.week-type-card').forEach(c => c.classList.remove('selected'));

  showScreen('screen-week-type');
});

// =====================
// WEEK TYPE SELECTION
// =====================
document.getElementById('select-school-week').addEventListener('click', () => {
  currentWeekType = 'school';
  document.querySelectorAll('.week-type-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('select-school-week').classList.add('selected');

  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const weekLabel = 'Week ' + currentWeekNumber + ' · ' + formatWeekDates(currentWeekStartDate);
  document.getElementById('school-log-label').textContent = weekLabel;

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

// =====================
// SCHOOL LOG — RENDER SUBJECTS
// =====================
function renderSchoolLogEntries(child) {
  const container = document.getElementById('school-subject-entries');
  container.innerHTML = '';

  if (child.subjects.length === 0) {
    container.innerHTML = `<p style="font-size:14px;color:var(--color-text-secondary);margin-bottom:16px">No subjects set up yet. Add subjects from the dashboard first.</p>`;
    return;
  }

  child.subjects.forEach(subject => {
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
            <input type="number" min="0" placeholder="0"
              id="lessons-${subject.id}" />
          </div>
          <div class="subject-log-field">
            <label>Hours (optional)</label>
            <input type="number" min="0" step="0.5" placeholder="0"
              id="hours-${subject.id}" />
          </div>
        </div>
        <div class="subject-log-wide">
          <label>Notes</label>
          <input type="text" placeholder="What did you cover?"
            id="notes-${subject.id}" />
        </div>
      </div>
      <div class="subject-collapsed-hint" id="hint-${subject.id}">Tap to log this week's work</div>
    `;

    container.appendChild(card);

    // Toggle open/close
    card.querySelector('.subject-log-header').addEventListener('click', () => {
      const body = document.getElementById('log-body-' + subject.id);
      const hint = document.getElementById('hint-' + subject.id);
      const icon = card.querySelector('.ti-chevron-down, .ti-chevron-up');
      const isOpen = body.classList.contains('open');

      body.classList.toggle('open');
      hint.style.display = isOpen ? 'block' : 'none';
      icon.className = isOpen ? 'ti ti-chevron-down' : 'ti ti-chevron-up';
      icon.style.color = 'var(--color-text-secondary)';
      icon.style.fontSize = '16px';
    });
  });
}

// =====================
// BACK BUTTONS — LOG FLOW
// =====================
document.getElementById('btn-back-from-week-type').addEventListener('click', () => {
  showScreen('screen-dashboard');
});

document.getElementById('btn-back-from-school-log').addEventListener('click', () => {
  showScreen('screen-week-type');
});

document.getElementById('btn-back-from-adventure-tags').addEventListener('click', () => {
  showScreen('screen-week-type');
});

document.getElementById('btn-back-from-adventure-glow').addEventListener('click', () => {
  showScreen('screen-adventure-tags');
});

// =====================
// SAVE SCHOOL WEEK
// =====================
document.getElementById('btn-save-school-week').addEventListener('click', () => {
  const family = loadData('family');
  const child = family.children[currentChildIndex];
  const glow = document.getElementById('school-glow-input').value.trim();

  const subjectEntries = [];
  child.subjects.forEach(subject => {
    const lessonsEl = document.getElementById('lessons-' + subject.id);
    const hoursEl = document.getElementById('hours-' + subject.id);
    const notesEl = document.getElementById('notes-' + subject.id);

    const lessons = parseInt(lessonsEl?.value) || 0;
    const hours = parseFloat(hoursEl?.value) || 0;
    const notes = notesEl?.value.trim() || '';

    if (lessons > 0 || hours > 0 || notes) {
      subjectEntries.push({
        subjectId: subject.id,
        lessonsCompleted: lessons,
        hoursLogged: hours,
        notes
      });

      // Update subject totals
      subject.lessonsCompleted += lessons;
      subject.hoursLogged += hours;
    }
  });

  const log = {
    id: Date.now(),
    weekNumber: currentWeekNumber,
    startDate: currentWeekStartDate.toISOString(),
    logType: 'school',
    subjectEntries,
    glow,
    experienceTags: [],
    createdAt: new Date().toISOString()
  };

  child.weeklyLogs.push(log);
  family.children[currentChildIndex] = child;
  saveData('family', family);

  renderDashboard();
  showScreen('screen-dashboard');
});

// =====================
// EXPERIENCE TAGS
// =====================
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

// =====================
// SAVE ADVENTURE WEEK
// =====================
document.getElementById('btn-save-adventure-week').addEventListener('click', () => {
  const glow = document.getElementById('adventure-glow-input').value.trim();

  if (!glow) {
    alert('Please write a sentence about your adventure before saving.');
    return;
  }

  const family = loadData('family');
  const child = family.children[currentChildIndex];

  const log = {
    id: Date.now(),
    weekNumber: currentWeekNumber,
    startDate: currentWeekStartDate.toISOString(),
    logType: 'adventure',
    subjectEntries: [],
    glow,
    experienceTags: selectedExperienceTags,
    createdAt: new Date().toISOString()
  };

  child.weeklyLogs.push(log);
  family.children[currentChildIndex] = child;
  saveData('family', family);

  renderDashboard();
  showScreen('screen-dashboard');
});
