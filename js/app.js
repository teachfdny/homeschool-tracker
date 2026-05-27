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
  document.getElementById('dashboard-streak').innerHTML = '0 <span>week streak</span>';
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
// ADD SUBJECT BUTTON
// =====================
document.getElementById('btn-add-subject').addEventListener('click', () => {
  alert('Subject setup coming soon!');
});

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
