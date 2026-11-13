// Роль: машина состояний игры, раунды и счёт, экономика, статистика, закупка, экраны и захват мыши (pointer lock).

var gameState = {
  current: GAME_STATE.LOADING,
  previous: null,
  pointerLocked: false,
  lockTarget: null,
  lastUnlockTime: 0,
  isUnlockExpected: false, // курсор освобождён намеренно (меню, итог матча): пауза не нужна
  isConsoleOpen: false,
  phase: ROUND_PHASE.FREEZE,
  phaseTimer: 0, // секунд до конца текущей фазы раунда
  summaryTimer: 0, // секунд до конца экрана итога раунда
  roundNumber: 0,
  playerWins: 0,
  botWins: 0,
  money: 0,
  isBuyMenuOpen: false,
  playerSurvived: false, // выжил ли игрок в прошлом раунде: от этого зависит, сохранится ли оружие
  roundResult: { winner: ROUND_WINNER.PLAYER, reason: ROUND_REASON.BOTS_DESTROYED, reward: 0 },
  matchResult: { playerWon: false, scoreStatus: '' },
  stats: { kills: 0, deaths: 0, shots: 0, hits: 0, headshots: 0 },
  statsVersion: 0 // растёт при каждом изменении статистики: по нему таблица понимает, что пора обновиться
};

var transitionTable = buildTransitionTable();
var screenIdByState = buildScreenTable();

function buildTransitionTable() {
  var table = {};
  table[GAME_STATE.LOADING] = [GAME_STATE.MENU];
  table[GAME_STATE.MENU] = [GAME_STATE.PLAYING];
  table[GAME_STATE.PLAYING] = [GAME_STATE.PAUSED, GAME_STATE.ROUND_END];
  table[GAME_STATE.PAUSED] = [GAME_STATE.PLAYING, GAME_STATE.MENU];
  table[GAME_STATE.ROUND_END] = [GAME_STATE.PLAYING, GAME_STATE.MATCH_END];
  table[GAME_STATE.MATCH_END] = [GAME_STATE.MENU, GAME_STATE.PLAYING];
  return table;
}

function buildScreenTable() {
  var table = {};
  table[GAME_STATE.LOADING] = 'screen-loading';
  table[GAME_STATE.MENU] = 'screen-start';
  table[GAME_STATE.PLAYING] = null;
  table[GAME_STATE.PAUSED] = 'screen-pause';
  table[GAME_STATE.ROUND_END] = 'screen-round-end';
  table[GAME_STATE.MATCH_END] = 'screen-match-end';
  return table;
}

function canChangeGameState(newState) {
  var allowedStates = transitionTable[gameState.current];
  return allowedStates.indexOf(newState) !== -1;
}

function setGameState(newState) {
  if (!canChangeGameState(newState)) {
    console.warn('Недопустимый переход состояния: ' + gameState.current + ' -> ' + newState);
    return false;
  }
  gameState.previous = gameState.current;
  gameState.current = newState;
  document.body.setAttribute('data-game-state', newState);
  showScreen(screenIdByState[newState]);
  return true;
}

// ---------- экраны ----------

function hideAllScreens() {
  var screenElements = document.getElementsByClassName('screen');
  for (var index = 0; index < screenElements.length; index++) {
    screenElements[index].hidden = true;
  }
}

function focusFirstButton(screenElement) {
  var button = screenElement.querySelector('button');
  if (button !== null) {
    button.focus();
  }
}

function showScreen(screenId) {
  hideAllScreens();
  if (screenId === null) {
    return;
  }
  var screenElement = document.getElementById(screenId);
  screenElement.hidden = false;
  focusFirstButton(screenElement);
}

function showLockHint(message) {
  var hints = document.getElementsByClassName('lock-hint');
  for (var index = 0; index < hints.length; index++) {
    hints[index].textContent = message;
  }
}

function clearLockHint() {
  showLockHint('');
}

// ---------- захват мыши, старт и пауза ----------

function isPointerLockSupported() {
  return typeof gameState.lockTarget.requestPointerLock === 'function';
}

function getLockWaitMilliseconds() {
  var passed = performance.now() - gameState.lastUnlockTime;
  return CONFIG.pointerLock.retryDelayMs - passed;
}

// Вызывается только из обработчика клика или нажатия клавиши: иначе браузер откажет в захвате мыши
function requestGameLock(skipRetryDelay) {
  if (!isPointerLockSupported()) {
    showLockHint(CONFIG.text.lockUnsupported);
    return;
  }
  if (!skipRetryDelay && getLockWaitMilliseconds() > 0) {
    showLockHint(CONFIG.text.lockWait);
    return;
  }
  clearLockHint();
  gameState.lockTarget.requestPointerLock();
}

function onLockButtonClick() {
  requestGameLock();
}

// Освобождает курсор для меню или экрана итога; paузу при этом включать не нужно
function releasePointerLockForMenu() {
  if (document.pointerLockElement === null) {
    return;
  }
  gameState.isUnlockExpected = true;
  document.exitPointerLock();
}

function releasePointerLockForConsole() {
  if (document.pointerLockElement === null) {
    return;
  }
  gameState.isUnlockExpected = true;
  document.exitPointerLock();
}

// Мышь захвачена: из меню и после матча начинается новый матч, из паузы игра продолжается
function startPlaying() {
  var state = gameState.current;
  if (state === GAME_STATE.MENU || state === GAME_STATE.MATCH_END) {
    resetInputState();
    startNewMatch();
    setGameState(GAME_STATE.PLAYING);
  } else if (state === GAME_STATE.PAUSED) {
    resetInputState();
    setGameState(GAME_STATE.PLAYING);
  }
}

function pauseGame() {
  if (gameState.current !== GAME_STATE.PLAYING) {
    return;
  }
  if (gameState.isBuyMenuOpen) {
    gameState.isBuyMenuOpen = false;
    hideBuyMenu();
  }
  resetInputState();
  setGameState(GAME_STATE.PAUSED);
  if (document.pointerLockElement !== null) {
    document.exitPointerLock();
  }
}

function onPointerLockChange() {
  gameState.pointerLocked = (document.pointerLockElement === gameState.lockTarget);
  if (gameState.pointerLocked) {
    clearLockHint();
    startPlaying();
    return;
  }
  if (gameState.isUnlockExpected) {
    gameState.isUnlockExpected = false;
    return;
  }
  gameState.lastUnlockTime = performance.now();
  pauseGame();
}

// Если мышь не удалось вернуть во время игры (например, после закрытия меню), включаем паузу с кнопкой «Продолжить»
function onPointerLockError() {
  showLockHint(CONFIG.text.lockError);
  if (gameState.current === GAME_STATE.PLAYING && !gameState.pointerLocked) {
    pauseGame();
  }
}

function onWindowBlur() {
  pauseGame();
}

function onTabVisibilityChange() {
  if (document.hidden) {
    pauseGame();
  }
}

function initGame(canvasElement) {
  gameState.lockTarget = canvasElement;
  document.getElementById('button-start').addEventListener('click', onLockButtonClick);
  document.getElementById('button-resume').addEventListener('click', onLockButtonClick);
  document.getElementById('button-play-again').addEventListener('click', onLockButtonClick);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', onPointerLockError);
  window.addEventListener('blur', onWindowBlur);
  document.addEventListener('visibilitychange', onTabVisibilityChange);
}

// ---------- экономика: деньги всегда от 0 до максимума ----------

function addMoney(amount) {
  gameState.money = clampValue(gameState.money + amount, 0, CONFIG.economy.maxMoney);
}

function canAfford(price) {
  return gameState.money >= price;
}

// Списывает деньги; возвращает false, если денег не хватает
function spendMoney(price) {
  if (!canAfford(price)) {
    return false;
  }
  gameState.money = clampValue(gameState.money - price, 0, CONFIG.economy.maxMoney);
  return true;
}

// ---------- статистика матча ----------

function markStatsChanged() {
  gameState.statsVersion += 1;
}

function resetStats() {
  gameState.stats.kills = 0;
  gameState.stats.deaths = 0;
  gameState.stats.shots = 0;
  gameState.stats.hits = 0;
  gameState.stats.headshots = 0;
  markStatsChanged();
}

// Игрок убил бота: счёт и награда
function registerPlayerKill() {
  gameState.stats.kills += 1;
  addMoney(CONFIG.economy.killReward);
  markStatsChanged();
}

// Один выстрел игрока (для дробовика — один выстрел, а не одна дробинка)
function registerPlayerShot(didHit, didHitHead) {
  gameState.stats.shots += 1;
  if (didHit) {
    gameState.stats.hits += 1;
  }
  if (didHitHead) {
    gameState.stats.headshots += 1;
  }
  markStatsChanged();
}

function getAccuracyPercent() {
  if (gameState.stats.shots === 0) {
    return 0;
  }
  return Math.round(gameState.stats.hits / gameState.stats.shots * PERCENT_MAX);
}

// ---------- раунды ----------

// Стрелять можно только в фазе боя
function isCombatAllowed() {
  return gameState.current === GAME_STATE.PLAYING && gameState.phase === ROUND_PHASE.FIGHT;
}

// Новый раунд: все на точках появления, боты как новые, оружие сохраняется только у выжившего игрока
function startRound() {
  var keptArmor = player.armor;
  var survived = gameState.playerSurvived;
  gameState.roundNumber += 1;
  gameState.phase = ROUND_PHASE.FREEZE;
  gameState.phaseTimer = CONFIG.round.freezeSeconds;
  resetPlayer(getRandomSpawnPoint(TEAM.PLAYER));
  if (survived) {
    player.armor = keptArmor;
  }
  resetWeaponsForRound(survived);
  respawnAllBots();
}

function beginFight() {
  gameState.phase = ROUND_PHASE.FIGHT;
  gameState.phaseTimer = CONFIG.round.fightSeconds;
}

function recordRoundScore(playerWon) {
  if (playerWon) {
    gameState.playerWins += 1;
  } else {
    gameState.botWins += 1;
  }
  if (!player.isAlive) {
    gameState.stats.deaths += 1;
  }
  markStatsChanged();
}

function endRound(winner, reason) {
  var result = gameState.roundResult;
  var playerWon = winner === ROUND_WINNER.PLAYER;
  result.winner = winner;
  result.reason = reason;
  result.reward = playerWon ? CONFIG.economy.roundWinReward : CONFIG.economy.roundLossReward;
  addMoney(result.reward);
  recordRoundScore(playerWon);
  gameState.playerSurvived = player.isAlive;
  gameState.summaryTimer = CONFIG.round.summarySeconds;
  resetInputState();
  setGameState(GAME_STATE.ROUND_END);
  showRoundEndScreen();
}

// Поражение: игрок убит; победа: не осталось живых ботов
function checkRoundOutcome() {
  if (!player.isAlive) {
    endRound(ROUND_WINNER.BOTS, ROUND_REASON.PLAYER_KILLED);
  } else if (getAliveBotCount() === 0) {
    endRound(ROUND_WINNER.PLAYER, ROUND_REASON.BOTS_DESTROYED);
  }
}

// Заморозка не кончается, пока открыто меню закупки: так игрок не останется с курсором посреди боя
function finishPhase() {
  if (gameState.phase === ROUND_PHASE.FREEZE) {
    if (!gameState.isBuyMenuOpen) {
      beginFight();
    }
  } else {
    endRound(ROUND_WINNER.BOTS, ROUND_REASON.TIME_OUT);
  }
}

// Вызывается в фиксированном шаге, пока идёт игра (не пауза)
function updateRound(step) {
  gameState.phaseTimer = Math.max(0, gameState.phaseTimer - step);
  if (gameState.phase === ROUND_PHASE.FIGHT) {
    checkRoundOutcome();
  }
  if (gameState.current !== GAME_STATE.PLAYING || gameState.phaseTimer > 0) {
    return;
  }
  finishPhase();
}

// Пока показан итог раунда, убитые боты дозавершают падение и исчезают
function updateCorpses(step) {
  var bots = getBots();
  for (var index = 0; index < bots.length; index++) {
    if (bots[index].isActive && bots[index].state === BOT_STATE.DEAD) {
      updateDeadBot(bots[index], step);
    }
  }
}

function isMatchOver() {
  var winsNeeded = CONFIG.round.winsToWinMatch;
  return gameState.playerWins >= winsNeeded || gameState.botWins >= winsNeeded;
}

// Если игрок успел освободить курсор (Esc) во время итога, следующий раунд ждёт его на паузе
function beginNextRound() {
  startRound();
  setGameState(GAME_STATE.PLAYING);
  if (!gameState.pointerLocked) {
    pauseGame();
  }
}

function updateRoundSummary(step) {
  updateCorpses(step);
  gameState.summaryTimer -= step;
  if (gameState.summaryTimer > 0) {
    return;
  }
  if (isMatchOver()) {
    finishMatch();
  } else {
    beginNextRound();
  }
}

// ---------- матч ----------

function buildScoreData() {
  return {
    difficulty: botSystem.difficultyName,
    rounds: gameState.roundNumber,
    playerWins: gameState.playerWins,
    botWins: gameState.botWins,
    kills: gameState.stats.kills,
    deaths: gameState.stats.deaths,
    shots: gameState.stats.shots,
    hits: gameState.stats.hits,
    headshots: gameState.stats.headshots,
    accuracyPercent: getAccuracyPercent()
  };
}

function onScoreSubmitted(isSuccess) {
  gameState.matchResult.scoreStatus = isSuccess ? CONFIG.text.scoreSent : CONFIG.text.scoreFailed;
  setMatchScoreStatus(gameState.matchResult.scoreStatus);
}

// TODO-BACKEND: пока submitScore имитирует отправку (см. config.js)
function submitMatchScore() {
  gameState.matchResult.scoreStatus = CONFIG.text.scoreSending;
  submitScore(buildScoreData(), onScoreSubmitted);
}

function finishMatch() {
  gameState.matchResult.playerWon = gameState.playerWins > gameState.botWins;
  setGameState(GAME_STATE.MATCH_END);
  releasePointerLockForMenu();
  showMatchEndScreen();
  submitMatchScore();
}

// Полный сброс: счёт, деньги, статистика, оружие, боты, эффекты. Объекты в пулах переиспользуются, новые не копятся
function startNewMatch() {
  gameState.playerWins = 0;
  gameState.botWins = 0;
  gameState.roundNumber = 0;
  gameState.money = CONFIG.economy.startMoney;
  gameState.playerSurvived = false;
  gameState.isBuyMenuOpen = false;
  hideBuyMenu();
  resetStats();
  resetEffects();
  startRound();
}

// Меняет сложность; во время игры матч начинается заново (пока вызывается из консоли, меню сложности будет на этапе 7)
function setMatchDifficulty(name) {
  if (CONFIG.difficulties[name] === undefined) {
    return false;
  }
  botSystem.difficultyName = name;
  if (gameState.current === GAME_STATE.PLAYING) {
    startNewMatch();
  }
  return true;
}

// ---------- закупка (только в заморозку) ----------

function isBuyAllowed() {
  return gameState.current === GAME_STATE.PLAYING && gameState.phase === ROUND_PHASE.FREEZE && player.isAlive;
}

function canOpenBuyMenu() {
  return isBuyAllowed() && !gameState.isBuyMenuOpen;
}

// Для мыши в меню курсор освобождается; пауза от этого не включается
function openBuyMenu() {
  gameState.isBuyMenuOpen = true;
  resetInputState();
  releasePointerLockForMenu();
  showBuyMenu();
}

// Вызывается из клика или нажатия B: только так браузер разрешит снова захватить мышь
function closeBuyMenu() {
  gameState.isBuyMenuOpen = false;
  hideBuyMenu();
  requestGameLock();
}

function toggleBuyMenu() {
  if (gameState.isBuyMenuOpen) {
    closeBuyMenu();
  } else if (canOpenBuyMenu()) {
    openBuyMenu();
  }
}

// Возвращает true, если оружие куплено: деньги списываются последними, когда все проверки пройдены
function buyWeapon(weaponIndex) {
  var weapon = WEAPONS[WEAPON_ORDER[weaponIndex]];
  if (!isBuyAllowed() || weaponState.owned[weaponIndex] || !spendMoney(weapon.price)) {
    return false;
  }
  giveWeapon(weaponIndex);
  return true;
}

function buyArmor() {
  if (!isBuyAllowed() || player.armor >= CONFIG.player.maxArmor || !spendMoney(CONFIG.economy.armorPrice)) {
    return false;
  }
  player.armor = CONFIG.player.maxArmor;
  weaponState.infoDirty = true;
  return true;
}
