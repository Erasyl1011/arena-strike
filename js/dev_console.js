// In-game developer console: command parsing, history, and Pointer Lock handoff.
var developerConsole = {
  element: null,
  output: null,
  form: null,
  input: null,
  closeButton: null,
  isOpen: false,
  restorePointerLock: false,
  history: [],
  historyIndex: 0,
  maxLines: 180
};

function isDeveloperConsoleOpen() {
  return developerConsole.isOpen;
}

function initDeveloperConsole() {
  developerConsole.element = document.getElementById('developer-console');
  developerConsole.output = document.getElementById('developer-console-output');
  developerConsole.form = document.getElementById('developer-console-form');
  developerConsole.input = document.getElementById('developer-console-input');
  developerConsole.closeButton = document.getElementById('developer-console-close');
  developerConsole.form.addEventListener('submit', onDeveloperConsoleSubmit);
  developerConsole.input.addEventListener('keydown', onDeveloperConsoleInputKeyDown);
  developerConsole.closeButton.addEventListener('click', closeDeveloperConsole);
  document.addEventListener('keydown', onDeveloperConsoleGlobalKeyDown);
  appendDeveloperConsoleLine('Консоль готова. Введите help для списка команд.', 'success');
}

function onDeveloperConsoleGlobalKeyDown(event) {
  if (event.code === 'Backquote' || event.key === '~' || event.key === 'ё' || event.key === 'Ё') {
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    if (developerConsole.isOpen) closeDeveloperConsole();
    else openDeveloperConsole();
    return;
  }
  if (developerConsole.isOpen && event.code === 'Escape') {
    event.preventDefault();
    closeDeveloperConsole();
  }
}

function openDeveloperConsole() {
  if (developerConsole.isOpen) return;
  developerConsole.restorePointerLock = gameState.current === GAME_STATE.PLAYING &&
    document.pointerLockElement === gameState.lockTarget;
  developerConsole.isOpen = true;
  gameState.isConsoleOpen = true;
  resetInputState();
  developerConsole.element.hidden = false;
  releasePointerLockForConsole();
  developerConsole.input.value = '';
  developerConsole.historyIndex = developerConsole.history.length;
  developerConsole.input.focus();
}

function closeDeveloperConsole() {
  if (!developerConsole.isOpen) return;
  developerConsole.isOpen = false;
  gameState.isConsoleOpen = false;
  developerConsole.element.hidden = true;
  resetInputState();
  var shouldRestore = developerConsole.restorePointerLock;
  developerConsole.restorePointerLock = false;
  if (shouldRestore && gameState.current === GAME_STATE.PLAYING && player.isAlive) {
    requestGameLock(true);
  }
}

function onDeveloperConsoleInputKeyDown(event) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  event.preventDefault();
  if (developerConsole.history.length === 0) return;
  if (event.key === 'ArrowUp') {
    developerConsole.historyIndex = Math.max(0, developerConsole.historyIndex - 1);
  } else {
    developerConsole.historyIndex = Math.min(developerConsole.history.length, developerConsole.historyIndex + 1);
  }
  developerConsole.input.value = developerConsole.history[developerConsole.historyIndex] || '';
  developerConsole.input.setSelectionRange(developerConsole.input.value.length, developerConsole.input.value.length);
}

function appendDeveloperConsoleLine(message, type) {
  var line = document.createElement('div');
  line.className = 'developer-console-line ' + (type || '');
  line.textContent = message;
  developerConsole.output.appendChild(line);
  while (developerConsole.output.childElementCount > developerConsole.maxLines) {
    developerConsole.output.removeChild(developerConsole.output.firstElementChild);
  }
  developerConsole.output.scrollTop = developerConsole.output.scrollHeight;
}

function onDeveloperConsoleSubmit(event) {
  event.preventDefault();
  var source = developerConsole.input.value.trim();
  if (source === '') return;
  developerConsole.history.push(source);
  developerConsole.historyIndex = developerConsole.history.length;
  appendDeveloperConsoleLine('> ' + source, 'command');
  developerConsole.input.value = '';
  executeDeveloperCommand(source);
}

function parseConsoleNumber(value, allowNegative) {
  if (value === undefined || value.trim() === '') return null;
  var number = Number(value);
  if (!Number.isFinite(number) || (!allowNegative && number < 0)) return null;
  return number;
}

function consoleUsage(message) {
  appendDeveloperConsoleLine(message, 'error');
}

function executeDeveloperCommand(source) {
  var parts = source.trim().split(/\s+/);
  var command = parts[0].toLowerCase();
  var argument = parts[1];
  var amount;

  if (command === 'help') {
    appendDeveloperConsoleLine('give_money <число> | money <число> — изменить деньги (например: money -250)', 'success');
    appendDeveloperConsoleLine('set_hp <число> — установить здоровье; give_hp <число> | hp <число> — изменить его', 'success');
    appendDeveloperConsoleLine('bot_add [число] — добавить ботов; bot_kick <число|all> | bot_remove <число|all> — убрать', 'success');
    appendDeveloperConsoleLine('help — показать эту справку. Консоль: ~ / Ё.', 'success');
    return;
  }

  if (command === 'give_money' || command === 'money') {
    amount = parseConsoleNumber(argument, true);
    if (amount === null || parts.length !== 2) return consoleUsage('Использование: ' + command + ' <число>');
    addMoney(amount);
    appendDeveloperConsoleLine('Деньги: $' + gameState.money, 'success');
    return;
  }

  if (command === 'set_hp' || command === 'give_hp' || command === 'hp') {
    amount = parseConsoleNumber(argument, command !== 'set_hp');
    if (amount === null || parts.length !== 2) return consoleUsage('Использование: ' + command + ' <число>');
    player.health = clampValue(command === 'set_hp' ? amount : player.health + amount, 0, player.maxHealth);
    player.isAlive = player.health > 0;
    if (!player.isAlive) {
      killPlayer();
    } else {
      player.velocity.x = 0;
      player.velocity.y = 0;
      player.velocity.z = 0;
    }
    appendDeveloperConsoleLine('Здоровье: ' + player.health + '/' + player.maxHealth, 'success');
    return;
  }

  if (command === 'bot_add') {
    amount = argument === undefined ? 1 : parseConsoleNumber(argument, false);
    if (amount === null || !Number.isInteger(amount) || parts.length > 2) return consoleUsage('Использование: bot_add [целое число]');
    if (amount > 100) return consoleUsage('За одну команду можно добавить не больше 100 ботов.');
    var added = addBotsFromConsole(amount);
    appendDeveloperConsoleLine('Добавлено ботов: ' + added + '. Сейчас активно: ' + getAliveBotCount(), 'success');
    return;
  }

  if (command === 'bot_kick' || command === 'bot_remove') {
    if (parts.length > 2 || argument === undefined) return consoleUsage('Использование: ' + command + ' <целое число|all>');
    var active = 0;
    for (var botIndex = 0; botIndex < botSystem.bots.length; botIndex++) {
      if (botSystem.bots[botIndex].isActive) active += 1;
    }
    if (argument.toLowerCase() === 'all') {
      amount = active;
    } else {
      amount = parseConsoleNumber(argument, false);
      if (amount === null || !Number.isInteger(amount)) return consoleUsage('Количество должно быть целым числом или all.');
    }
    var removed = removeBotsFromConsole(Math.min(amount, active));
    appendDeveloperConsoleLine('Удалено ботов: ' + removed + '. Сейчас активно: ' + getAliveBotCount(), 'success');
    return;
  }

  appendDeveloperConsoleLine('Неизвестная команда: ' + command + '. Введите help.', 'error');
}
