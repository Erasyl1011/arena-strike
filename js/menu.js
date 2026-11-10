// Роль: меню закупки, экраны конца раунда и матча, таблица счёта и временная строка раунда (до HUD этапа 7).

var STATS_COLUMNS = ['wins', 'kills', 'deaths', 'accuracy', 'headshots'];
var STATS_ROWS = ['you', 'bots'];
var SCOREBOARD_PREFIX = 'sb';
var MATCH_END_PREFIX = 'me';

var menuState = {
  roundInfoElement: null,
  scoreboardElement: null,
  scoreboardInfoElement: null,
  buyMenuElement: null,
  buyMoneyElement: null,
  buyCloseButton: null,
  buyItems: [],
  buyButtons: [],
  focusables: [],
  isScoreboardShown: false,
  shownStatsVersion: -1,
  shownNextSeconds: -1,
  shownRoundInfo: { phase: '', seconds: -1, round: -1, playerWins: -1, botWins: -1, money: -1 }
};

function getElement(id) {
  return document.getElementById(id);
}

// ---------- таблица статистики (для таблицы счёта и экрана конца матча) ----------

function createCell(tagName, text, id) {
  var cell = document.createElement(tagName);
  cell.textContent = text;
  if (id !== '') {
    cell.id = id;
  }
  return cell;
}

function createHeaderCell(text, scope) {
  var cell = createCell('th', text, '');
  cell.setAttribute('scope', scope);
  return cell;
}

function createStatsHeader() {
  var row = document.createElement('tr');
  row.appendChild(createHeaderCell(CONFIG.text.teamLabel, 'col'));
  for (var index = 0; index < STATS_COLUMNS.length; index++) {
    row.appendChild(createHeaderCell(CONFIG.text.columns[STATS_COLUMNS[index]], 'col'));
  }
  return row;
}

// Ячейки получают id вида «префикс-строка-колонка», например «sb-you-kills»
function createStatsRow(prefix, rowKey) {
  var row = document.createElement('tr');
  var teamName = rowKey === 'you' ? CONFIG.text.scoreYou : CONFIG.text.scoreBots;
  row.appendChild(createHeaderCell(teamName, 'row'));
  for (var index = 0; index < STATS_COLUMNS.length; index++) {
    row.appendChild(createCell('td', '', prefix + '-' + rowKey + '-' + STATS_COLUMNS[index]));
  }
  return row;
}

function createStatsTable(container, prefix) {
  var table = document.createElement('table');
  table.className = 'stats-table';
  table.appendChild(createStatsHeader());
  for (var index = 0; index < STATS_ROWS.length; index++) {
    table.appendChild(createStatsRow(prefix, STATS_ROWS[index]));
  }
  container.appendChild(table);
}

function setCellText(id, value) {
  getElement(id).textContent = String(value);
}

// У ботов убийства — это смерти игрока, а смерти — убийства игрока
function fillStatsTable(prefix) {
  var stats = gameState.stats;
  setCellText(prefix + '-you-wins', gameState.playerWins);
  setCellText(prefix + '-you-kills', stats.kills);
  setCellText(prefix + '-you-deaths', stats.deaths);
  setCellText(prefix + '-you-accuracy', getAccuracyPercent() + '%');
  setCellText(prefix + '-you-headshots', stats.headshots);
  setCellText(prefix + '-bots-wins', gameState.botWins);
  setCellText(prefix + '-bots-kills', stats.deaths);
  setCellText(prefix + '-bots-deaths', stats.kills);
  setCellText(prefix + '-bots-accuracy', CONFIG.text.noValue);
  setCellText(prefix + '-bots-headshots', CONFIG.text.noValue);
}

// ---------- меню закупки ----------

function buildBuyItems() {
  for (var index = 0; index < WEAPON_ORDER.length; index++) {
    var weapon = WEAPONS[WEAPON_ORDER[index]];
    if (weapon.price > 0) {
      menuState.buyItems.push({ kind: 'weapon', weaponIndex: index, price: weapon.price });
    }
  }
  menuState.buyItems.push({ kind: 'armor', weaponIndex: -1, price: CONFIG.economy.armorPrice });
}

// Кнопки пунктов создаются один раз; потом меняются только подписи и disabled
function createBuyButtons() {
  var container = getElement('buy-items');
  for (var index = 0; index < menuState.buyItems.length; index++) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'button buy-item';
    button.setAttribute('data-item-index', String(index));
    button.addEventListener('click', onBuyItemClick);
    container.appendChild(button);
    menuState.buyButtons.push(button);
  }
  menuState.focusables = menuState.buyButtons.concat([menuState.buyCloseButton]);
}

function getBuyItemName(item) {
  if (item.kind === 'armor') {
    return CONFIG.text.buyArmor;
  }
  return WEAPONS[WEAPON_ORDER[item.weaponIndex]].name;
}

// Пустая строка — пункт можно купить; иначе причина, почему нельзя
function getBuyItemStatus(item) {
  if (item.kind === 'armor' && player.armor >= CONFIG.player.maxArmor) {
    return CONFIG.text.buyArmorFull;
  }
  if (item.kind === 'weapon' && weaponState.owned[item.weaponIndex]) {
    return CONFIG.text.buyOwned;
  }
  if (!canAfford(item.price)) {
    return CONFIG.text.buyNoMoney;
  }
  return '';
}

function getBuyItemLabel(item) {
  var label = getBuyItemName(item) + ' — ' + item.price + CONFIG.text.moneySuffix;
  var status = getBuyItemStatus(item);
  return status === '' ? label : label + ' · ' + status;
}

function refreshBuyMenu() {
  menuState.buyMoneyElement.textContent = CONFIG.text.moneyLabel + gameState.money + CONFIG.text.moneySuffix;
  for (var index = 0; index < menuState.buyItems.length; index++) {
    var item = menuState.buyItems[index];
    menuState.buyButtons[index].textContent = getBuyItemLabel(item);
    menuState.buyButtons[index].disabled = getBuyItemStatus(item) !== '';
  }
}

function findFocusedIndex() {
  for (var index = 0; index < menuState.focusables.length; index++) {
    if (document.activeElement === menuState.focusables[index]) {
      return index;
    }
  }
  return -1;
}

// Переводит фокус к следующему (direction 1) или предыдущему (-1) доступному пункту; disabled пропускаются
function focusBuyItem(direction) {
  var count = menuState.focusables.length;
  var start = findFocusedIndex();
  if (start === -1 && direction < 0) {
    start = 0;
  }
  for (var offset = 1; offset <= count; offset++) {
    var index = ((start + direction * offset) % count + count) % count;
    if (!menuState.focusables[index].disabled) {
      menuState.focusables[index].focus();
      return;
    }
  }
}

// Купленный пункт становится disabled и теряет фокус: возвращаем его на доступный пункт
function keepFocusOnEnabledItem() {
  var active = document.activeElement;
  var isUsable = menuState.focusables.indexOf(active) !== -1 && !active.disabled;
  if (!isUsable) {
    focusBuyItem(1);
  }
}

function buyItem(item) {
  if (item.kind === 'armor') {
    return buyArmor();
  }
  return buyWeapon(item.weaponIndex);
}

function onBuyItemClick(event) {
  var index = Number(event.currentTarget.getAttribute('data-item-index'));
  buyItem(menuState.buyItems[index]);
  refreshBuyMenu();
  keepFocusOnEnabledItem();
}

function onBuyCloseClick() {
  closeBuyMenu();
}

function showBuyMenu() {
  menuState.buyMenuElement.hidden = false;
  refreshBuyMenu();
  focusBuyItem(1);
}

function hideBuyMenu() {
  menuState.buyMenuElement.hidden = true;
}

// Стрелки выбирают пункт, Enter покупает (обычная кнопка), B закрывает меню (это делает main.js), Esc ставит паузу
function onMenuKeyDown(event) {
  if (!gameState.isBuyMenuOpen) {
    return;
  }
  if (event.code === 'ArrowDown') {
    event.preventDefault();
    focusBuyItem(1);
  } else if (event.code === 'ArrowUp') {
    event.preventDefault();
    focusBuyItem(-1);
  } else if (event.code === 'Escape') {
    pauseGame();
  }
}

// ---------- таблица счёта (Tab) ----------

function isScoreboardRequested() {
  var isRoundScreen = gameState.current === GAME_STATE.PLAYING || gameState.current === GAME_STATE.ROUND_END;
  return isRoundScreen && !gameState.isBuyMenuOpen && isActionPressed('scoreboard');
}

function refreshScoreboard() {
  var difficulty = CONFIG.difficulties[botSystem.difficultyName];
  fillStatsTable(SCOREBOARD_PREFIX);
  menuState.scoreboardInfoElement.textContent =
    CONFIG.text.roundLabel + ' ' + gameState.roundNumber + ' · ' + CONFIG.text.difficultyLabel + difficulty.label;
  menuState.shownStatsVersion = gameState.statsVersion;
}

// Таблица показывается, пока зажат Tab; обновляется при показе и при изменении статистики
function updateScoreboard() {
  var shouldShow = isScoreboardRequested();
  if (shouldShow !== menuState.isScoreboardShown) {
    menuState.isScoreboardShown = shouldShow;
    menuState.scoreboardElement.hidden = !shouldShow;
    if (shouldShow) {
      refreshScoreboard();
    }
  } else if (shouldShow && menuState.shownStatsVersion !== gameState.statsVersion) {
    refreshScoreboard();
  }
}

// ---------- временная строка раунда (таймер, счёт, деньги) ----------

function getPhaseLabel() {
  return gameState.phase === ROUND_PHASE.FREEZE ? CONFIG.text.phaseFreeze : CONFIG.text.phaseFight;
}

function isRoundInfoChanged(seconds) {
  var shown = menuState.shownRoundInfo;
  return shown.phase !== gameState.phase || shown.seconds !== seconds || shown.round !== gameState.roundNumber ||
    shown.playerWins !== gameState.playerWins || shown.botWins !== gameState.botWins || shown.money !== gameState.money;
}

function rememberRoundInfo(seconds) {
  var shown = menuState.shownRoundInfo;
  shown.phase = gameState.phase;
  shown.seconds = seconds;
  shown.round = gameState.roundNumber;
  shown.playerWins = gameState.playerWins;
  shown.botWins = gameState.botWins;
  shown.money = gameState.money;
}

function buildScoreText() {
  return CONFIG.text.scoreYou + ' ' + gameState.playerWins + ' : ' + gameState.botWins + ' ' + CONFIG.text.scoreBots;
}

function buildRoundInfoText(seconds) {
  return CONFIG.text.roundLabel + ' ' + gameState.roundNumber + ' · ' + getPhaseLabel() + ' ' + seconds +
    CONFIG.text.secondsSuffix + ' · ' + buildScoreText() + ' · ' + gameState.money + CONFIG.text.moneySuffix;
}

// Строка собирается только когда что-то изменилось (раз в секунду или при покупке), а не каждый кадр
function updateRoundInfo() {
  var seconds = Math.ceil(gameState.phaseTimer);
  if (!isRoundInfoChanged(seconds)) {
    return;
  }
  rememberRoundInfo(seconds);
  menuState.roundInfoElement.textContent = buildRoundInfoText(seconds);
}

// ---------- экран конца раунда ----------

function getReasonText(reason) {
  if (reason === ROUND_REASON.BOTS_DESTROYED) {
    return CONFIG.text.reasonBotsDestroyed;
  }
  if (reason === ROUND_REASON.PLAYER_KILLED) {
    return CONFIG.text.reasonPlayerKilled;
  }
  return CONFIG.text.reasonTimeOut;
}

function updateRoundEndCountdown() {
  if (gameState.current !== GAME_STATE.ROUND_END) {
    return;
  }
  var seconds = Math.max(0, Math.ceil(gameState.summaryTimer));
  if (seconds === menuState.shownNextSeconds) {
    return;
  }
  menuState.shownNextSeconds = seconds;
  var prefix = isMatchOver() ? CONFIG.text.matchResultIn : CONFIG.text.nextRoundIn;
  getElement('round-end-next').textContent = prefix + seconds + CONFIG.text.secondsSuffix;
}

function showRoundEndScreen() {
  var result = gameState.roundResult;
  var playerWon = result.winner === ROUND_WINNER.PLAYER;
  getElement('round-end-title').textContent = playerWon ? CONFIG.text.roundTitleWin : CONFIG.text.roundTitleLoss;
  getElement('round-end-reason').textContent = getReasonText(result.reason);
  getElement('round-end-reward').textContent =
    CONFIG.text.rewardLabel + '+' + result.reward + CONFIG.text.moneySuffix +
    ' · ' + CONFIG.text.moneyLabel + gameState.money + CONFIG.text.moneySuffix;
  getElement('round-end-score').textContent = buildScoreText();
  menuState.shownNextSeconds = -1;
  updateRoundEndCountdown();
}

// ---------- экран конца матча ----------

function setMatchScoreStatus(text) {
  getElement('match-end-status').textContent = text;
}

// Экран показывается сразу после начала отправки результата, поэтому статус — «отправка»
function showMatchEndScreen() {
  var playerWon = gameState.matchResult.playerWon;
  getElement('match-end-title').textContent = playerWon ? CONFIG.text.matchTitleWin : CONFIG.text.matchTitleLoss;
  getElement('match-end-score').textContent = buildScoreText();
  fillStatsTable(MATCH_END_PREFIX);
  setMatchScoreStatus(CONFIG.text.scoreSending);
}

// ---------- запуск и обновление ----------

function initMenu() {
  menuState.roundInfoElement = getElement('round-info-temp');
  menuState.scoreboardElement = getElement('scoreboard');
  menuState.scoreboardInfoElement = getElement('scoreboard-info');
  menuState.buyMenuElement = getElement('buy-menu');
  menuState.buyMoneyElement = getElement('buy-money');
  menuState.buyCloseButton = getElement('button-buy-close');
  buildBuyItems();
  createBuyButtons();
  createStatsTable(getElement('scoreboard-table'), SCOREBOARD_PREFIX);
  createStatsTable(getElement('match-end-table'), MATCH_END_PREFIX);
  menuState.buyCloseButton.addEventListener('click', onBuyCloseClick);
  document.addEventListener('keydown', onMenuKeyDown);
}

// Вызывается каждый кадр; DOM меняется только при изменениях
function updateMenu() {
  updateRoundInfo();
  updateScoreboard();
  updateRoundEndCountdown();
}