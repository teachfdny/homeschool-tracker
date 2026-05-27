// =====================
// APP STATE
// =====================
const APP_VERSION = '1.0.0';

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
// FAMILY DATA STRUCTURE
// =====================
function createFamily(officialName, nickname, schoolYearStart) {
  return {
    id: Date.now(),
    officialName,
    nickname,
    schoolYearStart, // e.g. "august"
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

function createSubject(name, type, curriculum, totalLessons, duration, creditBearing, creditMethod) {
  return {
    id: Date.now(),
    name,
    type,        // "core", "elective", "enrichment"
    curriculum,
    totalLessons,
    duration,    // "full" or "half"
    creditBearing,
    creditMethod, // "lessons" or "hours"
    lessonsCompleted: 0,
    hoursLogged: 0,
    createdAt: new Date().toISOString()
  };
}

function createWeeklyLog(weekNumber, startDate, logType, subjectEntries, glow, experienceTags) {
  return {
    id: Date.now(),
    weekNumber,
    startDate,
    logType,       // "school", "adventure", "empty"
    subjectEntries, // array of { subjectId, lessonsCompleted, hoursLogged, notes }
    glow,
    experienceTags, // array e.g. ["travel", "nature"]
    createdAt: new Date().toISOString()
  };
}

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
  console.log('Homeschool Tracker loaded');
  const family = loadData('family');
  if (!family) {
    console.log('No family found — show onboarding');
  } else {
    console.log('Family found:', family.nickname);
  }
});
