// Роль: настройки игрока — значения по умолчанию, загрузка и сохранение в localStorage.

var settings = copyObjectDeep(CONFIG.settingsDefaults);

function copyObjectDeep(source) {
  var copy = {};
  var keys = Object.keys(source);
  for (var index = 0; index < keys.length; index++) {
    var key = keys[index];
    if (typeof source[key] === 'object') {
      copy[key] = copyObjectDeep(source[key]);
    } else {
      copy[key] = source[key];
    }
  }
  return copy;
}

function hasSameType(defaultValue, savedValue) {
  if (typeof defaultValue !== typeof savedValue) {
    return false;
  }
  if (typeof savedValue === 'number') {
    return isFinite(savedValue);
  }
  return true;
}

// Берём из сохранённого только те поля, которые есть в настройках по умолчанию и совпадают по типу
function mergeSavedSettings(target, saved) {
  var keys = Object.keys(target);
  for (var index = 0; index < keys.length; index++) {
    var key = keys[index];
    var savedValue = saved[key];
    if (savedValue === undefined || savedValue === null) {
      continue;
    }
    if (typeof target[key] === 'object') {
      if (typeof savedValue === 'object') {
        mergeSavedSettings(target[key], savedValue);
      }
    } else if (hasSameType(target[key], savedValue)) {
      target[key] = savedValue;
    }
  }
}

function readSavedText() {
  try {
    return window.localStorage.getItem(CONFIG.storage.settingsKey);
  } catch (error) {
    return null;
  }
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function loadSettings() {
  var text = readSavedText();
  if (text === null) {
    return false;
  }
  var saved = parseJsonSafely(text);
  if (saved === null || typeof saved !== 'object') {
    return false;
  }
  mergeSavedSettings(settings, saved);
  return true;
}

function saveSettings() {
  try {
    window.localStorage.setItem(CONFIG.storage.settingsKey, JSON.stringify(settings));
    return true;
  } catch (error) {
    return false;
  }
}