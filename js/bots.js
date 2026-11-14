// Роль: боты — состояния и ИИ, навигация по waypoints, зрение и слух, стрельба, урон и смерть, пул объектов.

var BOT_STATE = {
  PATROL: 'patrol',
  INVESTIGATE: 'investigate',
  REACT: 'react',
  ATTACK: 'attack',
  RETREAT: 'retreat',
  DEAD: 'dead'
};

var botSystem = {
  bots: [],
  isFrozen: false,
  scene: null,
  suppressAutoRespawn: false,
  difficultyName: CONFIG.defaultDifficulty,
  respawnTimer: 0,
  pathQueue: [],
  pathPrevious: [],
  pathVisited: []
};

// Параметры текущего выстрела бота (переиспользуются, чтобы не создавать объекты)
var botShot = {
  originX: 0,
  originY: 0,
  originZ: 0,
  dirX: 0,
  dirY: 0,
  dirZ: 0,
  distance: 0
};

// ---------- общие помощники ----------

function randomRange(minValue, maxValue) {
  return minValue + Math.random() * (maxValue - minValue);
}

function getDistance2D(firstX, firstZ, secondX, secondZ) {
  var deltaX = secondX - firstX;
  var deltaZ = secondZ - firstZ;
  return Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
}

// Поворот (yaw), при котором бот смотрит вдоль вектора (deltaX, deltaZ); yaw 0 смотрит в минус z, как у игрока
function getYawToward(deltaX, deltaZ) {
  return Math.atan2(-deltaX, -deltaZ);
}

function normalizeAngle(angle) {
  while (angle > Math.PI) {
    angle -= TWO_PI;
  }
  while (angle < -Math.PI) {
    angle += TWO_PI;
  }
  return angle;
}

// Поворачивает угол к цели по кратчайшей дуге, не быстрее maxChange
function approachAngle(current, target, maxChange) {
  var difference = normalizeAngle(target - current);
  if (Math.abs(difference) <= maxChange) {
    return target;
  }
  return current + Math.sign(difference) * maxChange;
}

function getDifficulty() {
  return CONFIG.difficulties[botSystem.difficultyName];
}

// ---------- создание и пул ----------

function createBotBody() {
  return {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    radius: CONFIG.bots.radius,
    height: CONFIG.bots.height,
    isGrounded: false,
    stepOffset: 0
  };
}

// Бот — простая структура; поля, которые читают другие файлы: health, isAlive, name, hitFlashTimer, onKilled, onDamaged
function createBot(index) {
  var characterIndex = index % 3;
  var character = [
    { name: 'Мейрамбек', face: 'MEYRAMBEK.jpg', voice: 'MEYRAMBEKAUDIO.mp3', death: 'MEYRAMBEKDIEAUDIO.mp3' },
    { name: 'Чуппа', face: 'CHUPPA.jpg', voice: 'CHUPPAAUDIO.mp3', death: 'CHUPADIEAUDIO.mp3' },
    { name: 'Коч', face: 'KOCH.jpg', voice: 'KOCHAUDIO.mp3', death: 'KOCHDIEAUDIO.mp3' }
  ][characterIndex];
  var bot = {
    index: index,
    name: character.name,
    isSpecialBot: characterIndex === 0,
    voicePath: 'assets/audio/bots/' + character.voice,
    deathVoicePath: 'assets/audio/bots/' + character.death,
    model: createBotModel('assets/bots/faces/' + character.face),
    body: createBotBody(),
    isActive: false,
    isAlive: false,
    state: BOT_STATE.DEAD,
    health: 0,
    maxHealth: CONFIG.bots.maxHealth,
    yaw: 0,
    desiredYaw: 0,
    facingLocked: false,
    isMoving: false,
    moveSpeed: 0,
    walkPhase: 0,
    walkBlend: 0,
    aimBlend: 0,
    fallProgress: 0,
    hitFlashTimer: 0,
    deadTimer: 0,
    path: [],
    pathLength: 0,
    pathIndex: 0,
    goalIndex: 0,
    waitTimer: 0,
    stateTimer: 0,
    perceptionTimer: 0,
    fireTimer: 0,
    replanTimer: 0,
    detourTimer: 0,
    strafeTimer: 0,
    strafeDirection: 1,
    seesPlayer: false,
    lastKnownX: 0,
    lastKnownZ: 0,
    memoryTimer: 0,
    stuckTimer: 0,
    stuckMoveTime: 0,
    stuckCheckX: 0,
    stuckCheckZ: 0,
    stuckCount: 0,
    hasRetreated: false,
    onKilled: handleBotKilled,
    onDamaged: handleBotDamaged
  };
  linkBotHitboxes(bot);
  return bot;
}

// По хитбоксу луч находит бота: в userData лежит ссылка на него
function linkBotHitboxes(bot) {
  for (var index = 0; index < bot.model.hitboxes.length; index++) {
    bot.model.hitboxes[index].userData.target = bot;
  }
}

function createPathStorage(count) {
  var storage = [];
  for (var index = 0; index < count; index++) {
    storage.push(0);
  }
  return storage;
}

function initBots(scene) {
  botSystem.scene = scene;
  var waypointCount = getWaypointCount();
  botSystem.pathQueue = createPathStorage(waypointCount);
  botSystem.pathPrevious = createPathStorage(waypointCount);
  botSystem.pathVisited = createPathStorage(waypointCount);
  for (var index = 0; index < CONFIG.bots.poolSize; index++) {
    var bot = createBot(index);
    bot.path = createPathStorage(waypointCount);
    scene.add(bot.model.group);
    botSystem.bots.push(bot);
  }
}

function getBots() {
  return botSystem.bots;
}

function getAliveBotCount() {
  var count = 0;
  for (var index = 0; index < botSystem.bots.length; index++) {
    if (botSystem.bots[index].isActive && botSystem.bots[index].isAlive) {
      count += 1;
    }
  }
  return count;
}

// Хитбоксы живых ботов: луч выстрела проверяет только их и стены
function addBotHitboxesToList(list) {
  for (var index = 0; index < botSystem.bots.length; index++) {
    var bot = botSystem.bots[index];
    if (bot.isActive && bot.isAlive) {
      for (var boxIndex = 0; boxIndex < bot.model.hitboxes.length; boxIndex++) {
        list.push(bot.model.hitboxes[boxIndex]);
      }
    }
  }
}

// ---------- появление и исчезновение ----------

function isSpawnPointFree(point, placedCount) {
  for (var index = 0; index < placedCount; index++) {
    var other = botSystem.bots[index];
    var distance = getDistance2D(point.x, point.z, other.body.position.x, other.body.position.z);
    if (distance < CONFIG.bots.spawnSpacing) {
      return false;
    }
  }
  return true;
}

// Случайная точка зоны ботов не ближе spawnSpacing к уже стоящим; если не нашлась — берём последнюю попытку
function pickBotSpawnPoint(placedCount) {
  var point = getRandomSpawnPoint(TEAM.BOTS);
  for (var attempt = 0; attempt < CONFIG.bots.spawnTries; attempt++) {
    if (isSpawnPointFree(point, placedCount)) {
      return point;
    }
    point = getRandomSpawnPoint(TEAM.BOTS);
  }
  return point;
}

function resetBotTimers(bot) {
  bot.fallProgress = 0;
  bot.walkPhase = 0;
  bot.walkBlend = 0;
  bot.aimBlend = 0;
  bot.hitFlashTimer = 0;
  bot.deadTimer = 0;
  bot.fireTimer = 0;
  bot.replanTimer = 0;
  bot.detourTimer = 0;
  bot.seesPlayer = false;
  bot.hasRetreated = false;
  bot.stuckCount = 0;
  bot.perceptionTimer = randomRange(0, CONFIG.bots.perceptionInterval);
  resetStuckCheck(bot);
}

function activateBot(bot, point) {
  bot.isActive = true;
  bot.isAlive = true;
  bot.health = bot.maxHealth;
  bot.body.position.x = point.x;
  bot.body.position.y = point.y;
  bot.body.position.z = point.z;
  bot.body.velocity.x = 0;
  bot.body.velocity.y = 0;
  bot.body.velocity.z = 0;
  bot.body.isGrounded = false;
  bot.yaw = degreesToRadians(point.yawDegrees);
  bot.desiredYaw = bot.yaw;
  resetBotTimers(bot);
  setBotModelGlow(bot.model, 0);
  bot.model.group.visible = true;
  applyBotPose(bot);
  bot.model.group.updateMatrixWorld(true);
  enterPatrol(bot);
  bot.waitTimer = randomRange(0, CONFIG.bots.patrolWaitMax);
}

// Бот возвращается в пул: модель скрыта, память не освобождается и не выделяется заново
function deactivateBot(bot) {
  bot.isActive = false;
  bot.isAlive = false;
  bot.state = BOT_STATE.DEAD;
  bot.model.group.visible = false;
}

function spawnBots(count) {
  botSystem.suppressAutoRespawn = false;
  for (var index = 0; index < botSystem.bots.length; index++) {
    deactivateBot(botSystem.bots[index]);
  }
  for (var botIndex = 0; botIndex < count && botIndex < botSystem.bots.length; botIndex++) {
    activateBot(botSystem.bots[botIndex], pickBotSpawnPoint(botIndex));
  }
  botSystem.respawnTimer = 0;
}

function findBotSpawnPointAwayFromActiveBots() {
  var point = getRandomSpawnPoint(TEAM.BOTS);
  for (var attempt = 0; attempt < CONFIG.bots.spawnTries; attempt++) {
    point = getRandomSpawnPoint(TEAM.BOTS);
    var isFree = true;
    for (var index = 0; index < botSystem.bots.length; index++) {
      var other = botSystem.bots[index];
      if (other.isActive && other.isAlive &&
          getDistance2D(point.x, point.z, other.body.position.x, other.body.position.z) < CONFIG.bots.spawnSpacing) {
        isFree = false;
        break;
      }
    }
    if (isFree) {
      return point;
    }
  }
  return point;
}

function createBotForConsole() {
  var bot = createBot(botSystem.bots.length);
  bot.path = createPathStorage(botSystem.pathQueue.length || getWaypointCount());
  botSystem.bots.push(bot);
  botSystem.scene.add(bot.model.group);
  return bot;
}

function addBotsFromConsole(count) {
  if (botSystem.scene === null) {
    return 0;
  }
  botSystem.suppressAutoRespawn = false;
  var added = 0;
  for (var index = 0; index < count; index++) {
    var bot = null;
    for (var botIndex = 0; botIndex < botSystem.bots.length; botIndex++) {
      if (!botSystem.bots[botIndex].isActive) {
        bot = botSystem.bots[botIndex];
        break;
      }
    }
    if (bot === null) {
      bot = createBotForConsole();
    }
    activateBot(bot, findBotSpawnPointAwayFromActiveBots());
    added += 1;
  }
  botSystem.respawnTimer = 0;
  return added;
}

function removeBotsFromConsole(count) {
  var removed = 0;
  for (var index = botSystem.bots.length - 1; index >= 0 && removed < count; index--) {
    if (botSystem.bots[index].isActive) {
      deactivateBot(botSystem.bots[index]);
      removed += 1;
    }
  }
  if (getAliveBotCount() === 0) {
    botSystem.suppressAutoRespawn = true;
  }
  botSystem.respawnTimer = 0;
  return removed;
}

function respawnAllBots() {
  spawnBots(getDifficulty().botCount);
}

// Меняет сложность и сразу перезапускает ботов (вызывается пока из консоли, меню сложности будет на этапе 7)
function setBotDifficulty(name) {
  if (CONFIG.difficulties[name] === undefined) {
    return false;
  }
  botSystem.difficultyName = name;
  respawnAllBots();
  return true;
}

// ---------- навигация: поиск пути по waypoints (обход в ширину) ----------

function resetPathScratch() {
  for (var index = 0; index < botSystem.pathVisited.length; index++) {
    botSystem.pathVisited[index] = false;
    botSystem.pathPrevious[index] = -1;
  }
}

// Добавляет в очередь непосещённых соседей точки; возвращает новый конец очереди
function expandPathNeighbors(current, tail) {
  var links = getWaypointNeighbors(current);
  for (var index = 0; index < links.length; index++) {
    var next = links[index];
    if (!botSystem.pathVisited[next]) {
      botSystem.pathVisited[next] = true;
      botSystem.pathPrevious[next] = current;
      botSystem.pathQueue[tail] = next;
      tail += 1;
    }
  }
  return tail;
}

// Путь идёт по цепочке «предыдущих» точек от цели к старту, записываем его в обратном порядке
function writePathToBot(bot, goalIndex) {
  var length = 0;
  for (var node = goalIndex; node !== -1; node = botSystem.pathPrevious[node]) {
    length += 1;
  }
  var writeIndex = length;
  for (var current = goalIndex; current !== -1; current = botSystem.pathPrevious[current]) {
    writeIndex -= 1;
    bot.path[writeIndex] = current;
  }
  return length;
}

// Записывает путь в bot.path и возвращает его длину (0, если пути нет)
function findPath(startIndex, goalIndex, bot) {
  resetPathScratch();
  botSystem.pathQueue[0] = startIndex;
  botSystem.pathVisited[startIndex] = true;
  var head = 0;
  var tail = 1;
  while (head < tail && !botSystem.pathVisited[goalIndex]) {
    tail = expandPathNeighbors(botSystem.pathQueue[head], tail);
    head += 1;
  }
  if (!botSystem.pathVisited[goalIndex]) {
    return 0;
  }
  return writePathToBot(bot, goalIndex);
}

// Ближайшая точка, до которой можно дойти по прямой, не задев стены
function findReachableWaypoint(x, z) {
  var bestIndex = -1;
  var bestDistance = Infinity;
  for (var index = 0; index < getWaypointCount(); index++) {
    var point = getWaypoint(index);
    var distance = getDistance2D(x, z, point.x, point.z);
    if (distance < bestDistance && isWalkSegmentClear(x, z, point.x, point.z)) {
      bestIndex = index;
      bestDistance = distance;
    }
  }
  return bestIndex !== -1 ? bestIndex : findNearestWaypointIndex(x, z);
}

function setBotDestination(bot, goalIndex) {
  var startIndex = findReachableWaypoint(bot.body.position.x, bot.body.position.z);
  bot.goalIndex = goalIndex;
  bot.pathIndex = 0;
  bot.pathLength = findPath(startIndex, goalIndex, bot);
  return bot.pathLength > 0;
}

function pickRandomWaypoint(excludeIndex) {
  var count = getWaypointCount();
  var index = Math.floor(Math.random() * count);
  if (index === excludeIndex) {
    index = (index + 1) % count;
  }
  return index;
}

// ---------- движение ----------

function lockFacingOnPlayer(bot) {
  bot.facingLocked = true;
  bot.desiredYaw = getYawToward(
    player.position.x - bot.body.position.x,
    player.position.z - bot.body.position.z
  );
}

// Задаёт скорость на этот шаг; если взгляд не закреплён на игроке, бот смотрит по ходу движения
function commandBotMove(bot, targetX, targetZ, speed) {
  var deltaX = targetX - bot.body.position.x;
  var deltaZ = targetZ - bot.body.position.z;
  var distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
  if (distance < CONFIG.physics.contactEpsilon) {
    return;
  }
  bot.body.velocity.x = deltaX / distance * speed;
  bot.body.velocity.z = deltaZ / distance * speed;
  bot.isMoving = true;
  bot.moveSpeed = speed;
  if (!bot.facingLocked) {
    bot.desiredYaw = getYawToward(deltaX, deltaZ);
  }
}

// Идёт по bot.path; возвращает false, когда путь закончился
function followBotPath(bot, speed) {
  while (bot.pathIndex < bot.pathLength) {
    var point = getWaypoint(bot.path[bot.pathIndex]);
    var distance = getDistance2D(bot.body.position.x, bot.body.position.z, point.x, point.z);
    if (distance > CONFIG.bots.waypointReachDistance) {
      commandBotMove(bot, point.x, point.z, speed);
      return true;
    }
    bot.pathIndex += 1;
  }
  return false;
}

function pushApartFrom(bot, otherX, otherZ) {
  var deltaX = bot.body.position.x - otherX;
  var deltaZ = bot.body.position.z - otherZ;
  var distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
  var minDistance = CONFIG.bots.separationDistance;
  if (distance >= minDistance || distance < CONFIG.physics.contactEpsilon) {
    return;
  }
  var strength = (1 - distance / minDistance) * CONFIG.bots.separationSpeed;
  bot.body.velocity.x += deltaX / distance * strength;
  bot.body.velocity.z += deltaZ / distance * strength;
}

// Мягкое расталкивание: боты не слипаются друг с другом и с игроком
function applyBotSeparation(bot) {
  for (var index = 0; index < botSystem.bots.length; index++) {
    var other = botSystem.bots[index];
    if (other !== bot && other.isActive && other.isAlive) {
      pushApartFrom(bot, other.body.position.x, other.body.position.z);
    }
  }
  if (player.isAlive) {
    pushApartFrom(bot, player.position.x, player.position.z);
  }
}

// Коллизии и гравитация — те же функции, что у игрока
function applyBotMotion(bot, step) {
  var body = bot.body;
  body.velocity.y = Math.max(body.velocity.y - CONFIG.physics.gravity * step, -CONFIG.physics.maxFallSpeed);
  applyBotSeparation(bot);
  moveBodyWithCollisions(body, step);
  bot.yaw = approachAngle(bot.yaw, bot.desiredYaw, CONFIG.bots.turnSpeed * step);
}

// ---------- защита от застревания ----------

function resetStuckCheck(bot) {
  bot.stuckTimer = 0;
  bot.stuckMoveTime = 0;
  bot.stuckCheckX = bot.body.position.x;
  bot.stuckCheckZ = bot.body.position.z;
}

// Бот застрял: выбирает другой waypoint и несколько секунд идёт к нему
function handleBotStuck(bot) {
  var goalIndex = pickRandomWaypoint(bot.goalIndex);
  bot.stuckCount += 1;
  if (setBotDestination(bot, goalIndex)) {
    bot.detourTimer = CONFIG.bots.detourSeconds;
    bot.replanTimer = 0;
  }
}

// Раз в секунду проверяем: бот должен был идти (почти всё время), но сдвинулся меньше порога
function updateStuckCheck(bot, step) {
  bot.stuckTimer += step;
  if (bot.isMoving) {
    bot.stuckMoveTime += step;
  }
  if (bot.stuckTimer < CONFIG.bots.stuckCheckSeconds) {
    return;
  }
  var moved = getDistance2D(bot.body.position.x, bot.body.position.z, bot.stuckCheckX, bot.stuckCheckZ);
  var wasTryingToMove = bot.stuckMoveTime >= bot.stuckTimer * CONFIG.bots.stuckMoveRatio;
  if (wasTryingToMove && moved < CONFIG.bots.stuckMinDistance) {
    handleBotStuck(bot);
  }
  resetStuckCheck(bot);
}

// ---------- зрение и слух ----------

function isBotAlert(bot) {
  return bot.state === BOT_STATE.REACT || bot.state === BOT_STATE.ATTACK || bot.state === BOT_STATE.RETREAT;
}

function isBotUnaware(bot) {
  return bot.isAlive && (bot.state === BOT_STATE.PATROL || bot.state === BOT_STATE.INVESTIGATE);
}

// Дальность и угол обзора; уже заметивший игрока бот угол не проверяет
function isPlayerInFieldOfView(bot, difficulty) {
  var deltaX = player.position.x - bot.body.position.x;
  var deltaZ = player.position.z - bot.body.position.z;
  if (Math.sqrt(deltaX * deltaX + deltaZ * deltaZ) > difficulty.viewDistance) {
    return false;
  }
  if (isBotAlert(bot)) {
    return true;
  }
  var angleToPlayer = Math.abs(normalizeAngle(getYawToward(deltaX, deltaZ) - bot.yaw));
  return angleToPlayer <= degreesToRadians(difficulty.viewAngleDegrees) / 2;
}

// Прямая видимость до глаз или до центра тела игрока: из-за низкого ящика можно увидеть голову
function hasLineToPlayer(bot) {
  var botX = bot.body.position.x;
  var botEyeY = bot.body.position.y + CONFIG.bots.eyeHeight;
  var botZ = bot.body.position.z;
  var playerEyeY = player.position.y + player.eyeHeight;
  var playerCenterY = player.position.y + player.height * HALF;
  return isLineOfSightClear(botX, botEyeY, botZ, player.position.x, playerEyeY, player.position.z) ||
    isLineOfSightClear(botX, botEyeY, botZ, player.position.x, playerCenterY, player.position.z);
}

function canBotSeePlayer(bot) {
  return player.isAlive && isPlayerInFieldOfView(bot, getDifficulty()) && hasLineToPlayer(bot);
}

function rememberPlayerPosition(bot) {
  bot.lastKnownX = player.position.x;
  bot.lastKnownZ = player.position.z;
  bot.memoryTimer = CONFIG.bots.memorySeconds;
}

// Проверка зрения не каждый кадр, а раз в perceptionInterval
function updatePerception(bot, step) {
  bot.perceptionTimer -= step;
  if (bot.perceptionTimer > 0) {
    return;
  }
  bot.perceptionTimer = CONFIG.bots.perceptionInterval;
  bot.seesPlayer = canBotSeePlayer(bot);
  if (!bot.seesPlayer) {
    return;
  }
  rememberPlayerPosition(bot);
  if (isBotUnaware(bot)) {
    enterReact(bot);
  }
}

// Вызывается оружием игрока при выстреле: бот, который не знает об игроке, идёт к источнику звука
function notifyBotsOfShot(x, z) {
  for (var index = 0; index < botSystem.bots.length; index++) {
    var bot = botSystem.bots[index];
    var isInRange = getDistance2D(x, z, bot.body.position.x, bot.body.position.z) <= CONFIG.bots.hearingDistance;
    if (bot.isActive && isBotUnaware(bot) && isInRange) {
      enterInvestigate(bot, x, z);
    }
  }
}

// ---------- стрельба бота ----------

// Направление на центр игрока с ошибкой прицела внутри конуса (чем выше сложность, тем конус уже)
function computeBotShot(bot) {
  var shot = botShot;
  var errorSize = Math.tan(degreesToRadians(getDifficulty().aimErrorDegrees)) * Math.sqrt(Math.random());
  var angle = Math.random() * TWO_PI;
  shot.originX = bot.body.position.x;
  shot.originY = bot.body.position.y + CONFIG.bots.eyeHeight;
  shot.originZ = bot.body.position.z;
  var deltaX = player.position.x - shot.originX;
  var deltaY = player.position.y + player.height * HALF - shot.originY;
  var deltaZ = player.position.z - shot.originZ;
  shot.distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
  var forwardX = deltaX / shot.distance;
  var forwardY = deltaY / shot.distance;
  var forwardZ = deltaZ / shot.distance;
  var flat = Math.max(Math.sqrt(forwardX * forwardX + forwardZ * forwardZ), CONFIG.physics.contactEpsilon);
  var offsetRight = Math.cos(angle) * errorSize;
  var offsetUp = Math.sin(angle) * errorSize;
  var dirX = forwardX - forwardZ / flat * offsetRight - forwardX * forwardY / flat * offsetUp;
  var dirY = forwardY + flat * offsetUp;
  var dirZ = forwardZ + forwardX / flat * offsetRight - forwardZ * forwardY / flat * offsetUp;
  var length = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
  shot.dirX = dirX / length;
  shot.dirY = dirY / length;
  shot.dirZ = dirZ / length;
}

// Попадание: расстояние от центра игрока до луча не больше радиуса попадания
function doesBotShotHitPlayer() {
  var shot = botShot;
  var toX = player.position.x - shot.originX;
  var toY = player.position.y + player.height * HALF - shot.originY;
  var toZ = player.position.z - shot.originZ;
  var along = toX * shot.dirX + toY * shot.dirY + toZ * shot.dirZ;
  if (along < 0) {
    return false;
  }
  var missSquared = toX * toX + toY * toY + toZ * toZ - along * along;
  return missSquared <= CONFIG.bots.playerHitRadius * CONFIG.bots.playerHitRadius;
}

function spawnBotTracer() {
  var shot = botShot;
  var forward = CONFIG.bots.tracerStartForward;
  var length = shot.distance + CONFIG.bots.tracerExtraLength;
  spawnTracer(
    shot.originX + shot.dirX * forward,
    shot.originY - CONFIG.bots.tracerStartDown + shot.dirY * forward,
    shot.originZ + shot.dirZ * forward,
    shot.originX + shot.dirX * length,
    shot.originY + shot.dirY * length,
    shot.originZ + shot.dirZ * length
  );
}

function applyBotShotDamage() {
  damagePlayer(CONFIG.bots.shotDamage);
  addCameraShake(CONFIG.bots.hitShake);
  weaponState.infoDirty = true;
}

function fireBotShot(bot) {
  computeBotShot(bot);
  if (doesBotShotHitPlayer()) {
    applyBotShotDamage();
  }
  spawnBotTracer();
  var volume = Math.max(CONFIG.bots.minShotVolume, 1 - botShot.distance / CONFIG.bots.hearingDistance);
  playWeaponShotSound(WEAPONS[CONFIG.bots.weaponId], volume);
}

// Стреляет, если перезарядка выстрела прошла и бот повёрнут к игроку достаточно точно
function tryBotShoot(bot) {
  if (bot.fireTimer > 0) {
    return;
  }
  var deltaX = player.position.x - bot.body.position.x;
  var deltaZ = player.position.z - bot.body.position.z;
  var aimError = Math.abs(normalizeAngle(getYawToward(deltaX, deltaZ) - bot.yaw));
  if (aimError > degreesToRadians(CONFIG.bots.fireAngleDegrees)) {
    return;
  }
  fireBotShot(bot);
  bot.fireTimer = getDifficulty().shotIntervalSeconds;
}

// ---------- переходы между состояниями ----------

function shouldBotRetreat(bot) {
  return bot.health < CONFIG.bots.retreatHealth && !bot.hasRetreated;
}

function enterPatrol(bot) {
  bot.state = BOT_STATE.PATROL;
  bot.pathLength = 0;
  bot.pathIndex = 0;
  bot.waitTimer = 0;
}

function enterInvestigate(bot, x, z) {
  bot.state = BOT_STATE.INVESTIGATE;
  bot.lastKnownX = x;
  bot.lastKnownZ = z;
  bot.stateTimer = CONFIG.bots.investigateLookSeconds;
  setBotDestination(bot, findReachableWaypoint(x, z));
}

// Реакция: бот замирает и поворачивается к игроку на время, зависящее от сложности
function enterReact(bot) {
  bot.state = BOT_STATE.REACT;
  bot.stateTimer = getDifficulty().reactionSeconds;
  bot.pathLength = 0;
}

function enterAttack(bot) {
  bot.state = BOT_STATE.ATTACK;
  bot.fireTimer = 0;
  bot.replanTimer = 0;
  bot.strafeTimer = CONFIG.bots.strafeSeconds;
  bot.pathLength = 0;
}

// Укрытие: ближайший к боту waypoint, который игрок не видит и который достаточно далеко от него
function pickHidingWaypoint(bot) {
  var playerEyeY = player.position.y + player.eyeHeight;
  var bestIndex = -1;
  var bestDistance = Infinity;
  for (var index = 0; index < getWaypointCount(); index++) {
    var point = getWaypoint(index);
    var fromPlayer = getDistance2D(point.x, point.z, player.position.x, player.position.z);
    var fromBot = getDistance2D(point.x, point.z, bot.body.position.x, bot.body.position.z);
    var isSeen = isLineOfSightClear(player.position.x, playerEyeY, player.position.z, point.x, CONFIG.bots.eyeHeight, point.z);
    if (!isSeen && fromPlayer >= CONFIG.bots.retreatMinPlayerDistance && fromBot < bestDistance) {
      bestIndex = index;
      bestDistance = fromBot;
    }
  }
  return bestIndex !== -1 ? bestIndex : pickRandomWaypoint(bot.goalIndex);
}

function enterRetreat(bot) {
  bot.state = BOT_STATE.RETREAT;
  bot.hasRetreated = true;
  bot.stateTimer = CONFIG.bots.retreatHideSeconds;
  setBotDestination(bot, pickHidingWaypoint(bot));
}

// Вызывается из damageTarget, когда бот получил урон, но выжил
function handleBotDamaged(bot) {
  rememberPlayerPosition(bot);
  if (shouldBotRetreat(bot)) {
    enterRetreat(bot);
  } else if (isBotUnaware(bot)) {
    enterReact(bot);
  }
}

// Вызывается из damageTarget, когда здоровье бота дошло до нуля
function handleBotKilled(bot) {
  playBotDeathVoice(bot.deathVoicePath);
  bot.state = BOT_STATE.DEAD;
  bot.fallProgress = 0;
  bot.deadTimer = CONFIG.bots.corpseSeconds;
  bot.pathLength = 0;
  bot.body.velocity.x = 0;
  bot.body.velocity.z = 0;
}

// ---------- поведение в состояниях ----------

function pickPatrolDestination(bot) {
  for (var attempt = 0; attempt < CONFIG.bots.spawnTries; attempt++) {
    if (setBotDestination(bot, pickRandomWaypoint(bot.goalIndex))) {
      return;
    }
  }
}

function updatePatrol(bot, step) {
  if (bot.waitTimer > 0) {
    bot.waitTimer -= step;
    return;
  }
  if (followBotPath(bot, CONFIG.bots.patrolSpeed)) {
    return;
  }
  if (bot.pathLength > 0) {
    bot.pathLength = 0;
    bot.waitTimer = randomRange(CONFIG.bots.patrolWaitMin, CONFIG.bots.patrolWaitMax);
  } else {
    pickPatrolDestination(bot);
  }
}

// Дошёл до места звука: осматривается и возвращается к патрулю
function updateInvestigate(bot, step) {
  if (followBotPath(bot, CONFIG.bots.investigateSpeed)) {
    return;
  }
  bot.stateTimer -= step;
  if (bot.stateTimer <= 0) {
    enterPatrol(bot);
  }
}

function updateReact(bot, step) {
  if (!bot.seesPlayer) {
    enterInvestigate(bot, bot.lastKnownX, bot.lastKnownZ);
    return;
  }
  lockFacingOnPlayer(bot);
  bot.stateTimer -= step;
  if (bot.stateTimer <= 0) {
    enterAttack(bot);
  }
}

// Путь к waypoint рядом с точкой; план обновляется не чаще replanSeconds
function chasePathToPosition(bot, x, z) {
  if (bot.replanTimer <= 0) {
    setBotDestination(bot, findReachableWaypoint(x, z));
    bot.replanTimer = CONFIG.bots.replanSeconds;
  }
  followBotPath(bot, CONFIG.bots.chaseSpeed);
}

function approachPlayer(bot) {
  var targetX = player.position.x;
  var targetZ = player.position.z;
  if (isWalkSegmentClear(bot.body.position.x, bot.body.position.z, targetX, targetZ)) {
    commandBotMove(bot, targetX, targetZ, CONFIG.bots.chaseSpeed);
  } else {
    chasePathToPosition(bot, targetX, targetZ);
  }
}

// Вблизи бот двигается боком по кругу и меняет сторону каждые strafeSeconds
function strafeAroundPlayer(bot, step) {
  bot.strafeTimer -= step;
  if (bot.strafeTimer <= 0) {
    bot.strafeTimer = CONFIG.bots.strafeSeconds;
    bot.strafeDirection = -bot.strafeDirection;
  }
  var deltaX = player.position.x - bot.body.position.x;
  var deltaZ = player.position.z - bot.body.position.z;
  var length = Math.max(Math.sqrt(deltaX * deltaX + deltaZ * deltaZ), CONFIG.physics.contactEpsilon);
  commandBotMove(
    bot,
    bot.body.position.x - deltaZ / length * bot.strafeDirection,
    bot.body.position.z + deltaX / length * bot.strafeDirection,
    CONFIG.bots.strafeSpeed
  );
}

function updateAttackMovement(bot, step) {
  var distance = getDistance2D(bot.body.position.x, bot.body.position.z, player.position.x, player.position.z);
  if (distance > CONFIG.bots.closeDistance) {
    approachPlayer(bot);
  } else {
    strafeAroundPlayer(bot, step);
  }
}

// Потерял игрока из виду: идёт к последнему известному месту, пока не истечёт память
function chaseLastKnownPosition(bot, step) {
  bot.memoryTimer -= step;
  if (bot.memoryTimer <= 0) {
    enterPatrol(bot);
    return;
  }
  chasePathToPosition(bot, bot.lastKnownX, bot.lastKnownZ);
}

function updateAttack(bot, step) {
  if (shouldBotRetreat(bot)) {
    enterRetreat(bot);
    return;
  }
  if (bot.seesPlayer) {
    lockFacingOnPlayer(bot);
    updateAttackMovement(bot, step);
    tryBotShoot(bot);
  } else {
    chaseLastKnownPosition(bot, step);
  }
}

// Добежал до укрытия: ждёт; если игрок подошёл вплотную или время вышло — возвращается к бою
function updateRetreat(bot, step) {
  if (followBotPath(bot, CONFIG.bots.retreatSpeed)) {
    return;
  }
  bot.stateTimer -= step;
  var playerDistance = getDistance2D(bot.body.position.x, bot.body.position.z, player.position.x, player.position.z);
  if (bot.seesPlayer && playerDistance < CONFIG.bots.retreatMinPlayerDistance) {
    enterAttack(bot);
  } else if (bot.stateTimer <= 0) {
    enterInvestigate(bot, bot.lastKnownX, bot.lastKnownZ);
  }
}

function runBotDetour(bot) {
  if (!followBotPath(bot, CONFIG.bots.chaseSpeed)) {
    bot.detourTimer = 0;
  }
}

function runBotState(bot, step) {
  if (bot.detourTimer > 0) {
    runBotDetour(bot);
  } else if (bot.state === BOT_STATE.PATROL) {
    updatePatrol(bot, step);
  } else if (bot.state === BOT_STATE.INVESTIGATE) {
    updateInvestigate(bot, step);
  } else if (bot.state === BOT_STATE.REACT) {
    updateReact(bot, step);
  } else if (bot.state === BOT_STATE.ATTACK) {
    updateAttack(bot, step);
  } else if (bot.state === BOT_STATE.RETREAT) {
    updateRetreat(bot, step);
  }
}

// ---------- анимация и обновление ----------

function updateBotFlash(bot, step) {
  if (bot.hitFlashTimer <= 0) {
    return;
  }
  bot.hitFlashTimer = Math.max(0, bot.hitFlashTimer - step);
  setBotModelGlow(bot.model, bot.hitFlashTimer / CONFIG.bots.hitFlashSeconds);
}

function updateBotAnimation(bot, step) {
  var pose = CONFIG.bots.pose;
  var isAiming = bot.state === BOT_STATE.REACT || bot.state === BOT_STATE.ATTACK;
  bot.walkBlend = approachValue(bot.walkBlend, bot.isMoving ? 1 : 0, pose.walkBlendSpeed * step);
  bot.aimBlend = approachValue(bot.aimBlend, isAiming ? 1 : 0, pose.aimBlendSpeed * step);
  bot.walkPhase = (bot.walkPhase + bot.moveSpeed * pose.strideCyclesPerMeter * step) % 1;
  updateBotFlash(bot, step);
  applyBotPose(bot);
}

function updateDeadBot(bot, step) {
  bot.fallProgress = Math.min(1, bot.fallProgress + step / CONFIG.bots.deathFallSeconds);
  bot.deadTimer -= step;
  updateBotFlash(bot, step);
  applyBotPose(bot);
  if (bot.deadTimer <= 0) {
    deactivateBot(bot);
  }
}

// Сбрасывает команды прошлого шага и уменьшает таймеры
function prepareBotStep(bot, step) {
  bot.facingLocked = false;
  bot.isMoving = false;
  bot.moveSpeed = 0;
  bot.body.velocity.x = 0;
  bot.body.velocity.z = 0;
  bot.fireTimer = Math.max(0, bot.fireTimer - step);
  bot.replanTimer = Math.max(0, bot.replanTimer - step);
  bot.detourTimer = Math.max(0, bot.detourTimer - step);
}

function updateBot(bot, step) {
  if (!bot.isActive) {
    return;
  }
  if (bot.state === BOT_STATE.DEAD) {
    updateDeadBot(bot, step);
    return;
  }
  prepareBotStep(bot, step);
  updatePerception(bot, step);
  runBotState(bot, step);
  applyBotMotion(bot, step);
  updateStuckCheck(bot, step);
  updateBotAnimation(bot, step);
}

// Временно, до раундов этапа 6: когда все боты исчезли, они появляются заново
function updateBotRespawn(step, activeCount) {
  if (activeCount > 0) {
    botSystem.respawnTimer = 0;
    return;
  }
  if (botSystem.suppressAutoRespawn) {
    return;
  }
  botSystem.respawnTimer += step;
  if (botSystem.respawnTimer >= CONFIG.bots.respawnAllSeconds) {
    respawnAllBots();
  }
}

function updateBots(step) {
  if (botSystem.isFrozen) {
    return;
  }
  var activeCount = 0;
  for (var index = 0; index < botSystem.bots.length; index++) {
    updateBot(botSystem.bots[index], step);
    if (botSystem.bots[index].isActive) {
      activeCount += 1;
    }
  }
  updateBotRespawn(step, activeCount);
}
