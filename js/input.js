// Роль: клавиатура и мышь — состояние нажатий, привязки действий к клавишам, переназначение.

var MOUSE_BUTTON = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2
};
var MOUSE_BUTTON_COUNT = 3;

var input = {
  keysDown: {},
  keysPressedThisFrame: {},
  mouseButtonsDown: [false, false, false],
  mouseButtonsPressedThisFrame: [false, false, false],
  mouseDeltaX: 0,
  mouseDeltaY: 0,
  wheelSteps: 0
};

// ---------- привязки действий к клавишам (хранятся в settings.keys по event.code) ----------

function findActionByKey(keyCode) {
  var actionNames = Object.keys(settings.keys);
  for (var index = 0; index < actionNames.length; index++) {
    if (settings.keys[actionNames[index]] === keyCode) {
      return actionNames[index];
    }
  }
  return '';
}

function isActionPressed(actionName) {
  return input.keysDown[settings.keys[actionName]] === true;
}

function wasActionPressed(actionName) {
  return input.keysPressedThisFrame[settings.keys[actionName]] === true;
}

// Возвращает 1, -1 или 0: удобно для пар «вперёд / назад»
function getActionAxis(positiveAction, negativeAction) {
  var axis = 0;
  if (isActionPressed(positiveAction)) {
    axis += 1;
  }
  if (isActionPressed(negativeAction)) {
    axis -= 1;
  }
  return axis;
}

function isReservedKey(keyCode) {
  return CONFIG.input.reservedKeys.indexOf(keyCode) !== -1;
}

// Если клавиша уже занята другим действием, действия меняются клавишами местами
function rebindAction(actionName, keyCode) {
  if (settings.keys[actionName] === undefined || isReservedKey(keyCode)) {
    return false;
  }
  var otherAction = findActionByKey(keyCode);
  if (otherAction !== '' && otherAction !== actionName) {
    settings.keys[otherAction] = settings.keys[actionName];
  }
  settings.keys[actionName] = keyCode;
  saveSettings();
  return true;
}

// ---------- мышь ----------

function isMouseButtonDown(button) {
  return input.mouseButtonsDown[button] === true;
}

function wasMouseButtonPressed(button) {
  return input.mouseButtonsPressedThisFrame[button] === true;
}

function takeMouseDeltaX() {
  var delta = input.mouseDeltaX;
  input.mouseDeltaX = 0;
  return delta;
}

function takeMouseDeltaY() {
  var delta = input.mouseDeltaY;
  input.mouseDeltaY = 0;
  return delta;
}

// Возвращает число шагов колеса: больше нуля — вниз, меньше нуля — вверх
function takeWheelSteps() {
  var steps = input.wheelSteps;
  input.wheelSteps = 0;
  return steps;
}

// ---------- сброс состояния ----------

function clearObjectKeys(object) {
  for (var key in object) {
    delete object[key];
  }
}

function clearMousePressedFlags() {
  for (var index = 0; index < MOUSE_BUTTON_COUNT; index++) {
    input.mouseButtonsPressedThisFrame[index] = false;
  }
}

// Вызывается в конце каждого кадра: «нажато в этом кадре» живёт ровно один кадр
function endInputFrame() {
  clearObjectKeys(input.keysPressedThisFrame);
  clearMousePressedFlags();
}

// При паузе и потере фокуса браузер может не прислать keyup, поэтому всё сбрасываем сами
function resetInputState() {
  clearObjectKeys(input.keysDown);
  clearObjectKeys(input.keysPressedThisFrame);
  clearMousePressedFlags();
  for (var index = 0; index < MOUSE_BUTTON_COUNT; index++) {
    input.mouseButtonsDown[index] = false;
  }
  input.mouseDeltaX = 0;
  input.mouseDeltaY = 0;
  input.wheelSteps = 0;
}

// ---------- обработчики событий ----------

// В меню клавиши браузера (Tab, Пробел) должны работать для навигации по кнопкам, F3 блокируем всегда
function shouldBlockBrowserDefault(keyCode) {
  var actionName = findActionByKey(keyCode);
  if (actionName === '') {
    return false;
  }
  return actionName === 'toggleFps' || gameState.current === GAME_STATE.PLAYING;
}

function onKeyDown(event) {
  if (shouldBlockBrowserDefault(event.code)) {
    event.preventDefault();
  }
  if (!input.keysDown[event.code]) {
    input.keysPressedThisFrame[event.code] = true;
  }
  input.keysDown[event.code] = true;
}

function onKeyUp(event) {
  delete input.keysDown[event.code];
}

function onMouseDown(event) {
  if (!gameState.pointerLocked) {
    return;
  }
  input.mouseButtonsDown[event.button] = true;
  input.mouseButtonsPressedThisFrame[event.button] = true;
}

function onMouseUp(event) {
  input.mouseButtonsDown[event.button] = false;
}

function onMouseMove(event) {
  if (!gameState.pointerLocked) {
    return;
  }
  var isSpike = Math.abs(event.movementX) > CONFIG.input.maxMouseDelta ||
    Math.abs(event.movementY) > CONFIG.input.maxMouseDelta;
  if (isSpike) {
    return;
  }
  input.mouseDeltaX += event.movementX;
  input.mouseDeltaY += event.movementY;
}

// Ctrl + колесо в браузере масштабирует страницу, а Ctrl у нас — присед
function onWheel(event) {
  if (!gameState.pointerLocked) {
    return;
  }
  event.preventDefault();
  input.wheelSteps += Math.sign(event.deltaY);
}

function onContextMenu(event) {
  if (gameState.pointerLocked) {
    event.preventDefault();
  }
}

function initInput() {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('wheel', onWheel, { passive: false });
  document.addEventListener('contextmenu', onContextMenu);
}