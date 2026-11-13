// Роль: оружие игрока — стрельба лучом, перезарядка, смена оружия, зум, отдача, урон по целям (ботам), покупка оружия.

var WEAPON_ACTIONS = ['weapon1', 'weapon2', 'weapon3', 'weapon4', 'weapon5'];
var PART_LABELS = { head: 'голова', body: 'тело', legs: 'ноги' };

var weaponState = {
  currentIndex: 0,
  pendingIndex: -1, // -1 — смены нет; иначе номер оружия, на которое переключаемся
  switchTimer: 0,
  owned: [],
  magazine: [],
  reserve: [],
  fireTimer: 0,
  isReloading: false,
  reloadTimer: 0,
  isZoomed: false,
  zoomBlend: 0,
  zoomFov: 0,
  recoilPitch: 0,
  recoilYaw: 0,
  kick: 0,
  wallSoundTimer: 0,
  hitSoundTimer: 0,
  shotHitBot: false, // в текущем выстреле хотя бы одна пуля попала в бота
  shotHitHead: false, // и хотя бы одна из них — в голову
  infoDirty: true,
  infoElement: null,
  hitInfoElement: null,
  hitInfoTimer: 0,
  raycaster: null,
  rayTargets: [],
  rayHits: []
};

// Положение глаз и оси направления выстрела (переиспользуются, чтобы не создавать объекты)
var shotScratch = {
  originX: 0,
  originY: 0,
  originZ: 0,
  forwardX: 0,
  forwardY: 0,
  forwardZ: 0,
  rightX: 0,
  rightZ: 0,
  upX: 0,
  upY: 0,
  upZ: 0
};

// Поза модели оружия: weapon_system заполняет, models.js применяет
var viewPose = {
  weaponIndex: 0,
  kick: 0,
  isReloading: false,
  reloadProgress: 0,
  lower: 0,
  bobPhase: 0,
  bobBlend: 0,
  isHidden: false
};

// ---------- состояние ----------

function getCurrentWeapon() {
  return WEAPONS[WEAPON_ORDER[weaponState.currentIndex]];
}

function resetWeaponTimers() {
  weaponState.pendingIndex = -1;
  weaponState.switchTimer = 0;
  weaponState.fireTimer = 0;
  weaponState.isReloading = false;
  weaponState.reloadTimer = 0;
  weaponState.isZoomed = false;
  weaponState.zoomBlend = 0;
  weaponState.recoilPitch = 0;
  weaponState.recoilYaw = 0;
  weaponState.kick = 0;
  weaponState.wallSoundTimer = 0;
  weaponState.hitSoundTimer = 0;
}

// Выдаёт стартовое оружие (нож и пистолет) и полные патроны по настройкам из weapons.js
function resetWeaponState() {
  for (var index = 0; index < WEAPON_ORDER.length; index++) {
    var weapon = WEAPONS[WEAPON_ORDER[index]];
    weaponState.owned[index] = WEAPON_SETTINGS.startOwned.indexOf(weapon.id) !== -1;
    weaponState.magazine[index] = weapon.magazineSize;
    weaponState.reserve[index] = weapon.reserveAmmo;
  }
  weaponState.currentIndex = WEAPON_ORDER.indexOf(WEAPON_SETTINGS.startWeapon);
  resetWeaponTimers();
  showWeaponViewModel(weaponState.currentIndex);
  updateViewPose();
  weaponState.infoDirty = true;
}

// Новый раунд: выживший игрок сохраняет оружие и патроны, погибший начинает со стартового оружия
function resetWeaponsForRound(playerSurvived) {
  if (!playerSurvived) {
    resetWeaponState();
    return;
  }
  resetWeaponTimers();
  showWeaponViewModel(weaponState.currentIndex);
  updateViewPose();
  weaponState.infoDirty = true;
}

// Выдаёт купленное оружие с полным запасом патронов и берёт его в руки
function giveWeapon(index) {
  var weapon = WEAPONS[WEAPON_ORDER[index]];
  weaponState.owned[index] = true;
  weaponState.magazine[index] = weapon.magazineSize;
  weaponState.reserve[index] = weapon.reserveAmmo;
  requestWeaponSwitch(index);
  weaponState.infoDirty = true;
}

function initWeaponSystem() {
  weaponState.infoElement = document.getElementById('weapon-info-temp');
  weaponState.hitInfoElement = document.getElementById('hit-info-temp');
  weaponState.raycaster = new THREE.Raycaster();
  resetWeaponState();
}

// ---------- обновление за кадр ----------

function updateReloadTimer(delta) {
  if (!weaponState.isReloading) {
    return;
  }
  weaponState.reloadTimer -= delta;
  if (weaponState.reloadTimer <= 0) {
    finishReload();
  }
}

function applyWeaponSwitch() {
  weaponState.currentIndex = weaponState.pendingIndex;
  weaponState.isReloading = false;
  weaponState.fireTimer = 0;
  showWeaponViewModel(weaponState.currentIndex);
  weaponState.infoDirty = true;
}

// Оружие меняется в середине анимации: сначала старое опускается, потом поднимается новое
function updateSwitchTimer(delta) {
  if (weaponState.pendingIndex === -1) {
    return;
  }
  var half = WEAPON_SETTINGS.switchSeconds / 2;
  var wasBeforeHalf = weaponState.switchTimer > half;
  weaponState.switchTimer -= delta;
  if (wasBeforeHalf && weaponState.switchTimer <= half) {
    applyWeaponSwitch();
  }
  if (weaponState.switchTimer <= 0) {
    weaponState.pendingIndex = -1;
    weaponState.switchTimer = 0;
  }
}

function updateWeaponTimers(delta) {
  weaponState.fireTimer = Math.max(0, weaponState.fireTimer - delta);
  weaponState.wallSoundTimer = Math.max(0, weaponState.wallSoundTimer - delta);
  weaponState.hitSoundTimer = Math.max(0, weaponState.hitSoundTimer - delta);
  updateReloadTimer(delta);
  updateSwitchTimer(delta);
}

function updateWeaponSystem(delta) {
  if (gameState.current !== GAME_STATE.PLAYING) {
    return;
  }
  updateHitInfo(delta);
  if (player.isAlive) {
    updateWeaponTimers(delta);
    handleWeaponSwitchInput();
    handleReloadInput();
    handleFireInput();
  }
  updateZoomState(delta);
  updateRecoil(delta);
  updateViewPose();
  refreshWeaponInfo();
}

// ---------- смена оружия ----------

function requestWeaponSwitch(index) {
  var isBusy = weaponState.pendingIndex !== -1;
  if (isBusy || index === weaponState.currentIndex || !weaponState.owned[index]) {
    return;
  }
  weaponState.pendingIndex = index;
  weaponState.switchTimer = WEAPON_SETTINGS.switchSeconds;
  weaponState.isReloading = false;
}

// direction: 1 — следующее, -1 — предыдущее; возвращает номер имеющегося оружия
function findNextOwnedWeapon(direction) {
  var count = WEAPON_ORDER.length;
  for (var offset = 1; offset < count; offset++) {
    var candidate = (weaponState.currentIndex + direction * offset + count) % count;
    if (weaponState.owned[candidate]) {
      return candidate;
    }
  }
  return weaponState.currentIndex;
}

function handleWeaponSwitchInput() {
  for (var index = 0; index < WEAPON_ACTIONS.length; index++) {
    if (wasActionPressed(WEAPON_ACTIONS[index])) {
      requestWeaponSwitch(index);
    }
  }
  var wheelSteps = takeWheelSteps();
  if (wheelSteps !== 0) {
    requestWeaponSwitch(findNextOwnedWeapon(wheelSteps > 0 ? 1 : -1));
  }
}

// 0 — оружие на месте, 1 — полностью опущено (в середине смены)
function getSwitchLowering() {
  if (weaponState.pendingIndex === -1) {
    return 0;
  }
  var progress = 1 - weaponState.switchTimer / WEAPON_SETTINGS.switchSeconds;
  return Math.sin(progress * Math.PI);
}

// ---------- перезарядка ----------

function canReload() {
  var weapon = getCurrentWeapon();
  var index = weaponState.currentIndex;
  var isIdle = !weaponState.isReloading && weaponState.pendingIndex === -1;
  return isIdle && !weapon.isMelee && weaponState.magazine[index] < weapon.magazineSize && weaponState.reserve[index] > 0;
}

function startReload() {
  var weapon = getCurrentWeapon();
  weaponState.isReloading = true;
  weaponState.reloadTimer = weapon.reloadSeconds;
  weaponState.infoDirty = true;
  playWeaponReloadSound(weapon, 1);
}

function finishReload() {
  var index = weaponState.currentIndex;
  var weapon = getCurrentWeapon();
  var needed = weapon.magazineSize - weaponState.magazine[index];
  var taken = Math.min(needed, weaponState.reserve[index]);
  weaponState.magazine[index] += taken;
  weaponState.reserve[index] -= taken;
  weaponState.isReloading = false;
  weaponState.infoDirty = true;
}

function handleReloadInput() {
  if (wasActionPressed('reload') && canReload()) {
    startReload();
  }
}

// ---------- стрельба ----------

// В заморозку и после конца раунда стрелять нельзя
function canFire() {
  var isReady = !weaponState.isReloading && weaponState.pendingIndex === -1 && weaponState.fireTimer <= 0;
  return isReady && isCombatAllowed();
}

function handleFireInput() {
  var weapon = getCurrentWeapon();
  var wantsToFire = weapon.isAutomatic ? isMouseButtonDown(MOUSE_BUTTON.LEFT) : wasMouseButtonPressed(MOUSE_BUTTON.LEFT);
  if (wantsToFire && canFire()) {
    fireWeapon(weapon);
  }
}

// Пустой магазин: щелчок и автоматическая перезарядка, если есть запас
function handleEmptyMagazine() {
  weaponState.fireTimer = WEAPON_SETTINGS.emptyClickInterval;
  playEmptyClickSound();
  if (canReload()) {
    startReload();
  }
}

function fireWeapon(weapon) {
  if (weapon.isMelee) {
    meleeAttack(weapon);
    return;
  }
  var index = weaponState.currentIndex;
  if (weaponState.magazine[index] === 0) {
    handleEmptyMagazine();
    return;
  }
  weaponState.magazine[index] -= 1;
  weaponState.fireTimer = 1 / weapon.shotsPerSecond;
  weaponState.infoDirty = true;
  notifyBotsOfShot(player.position.x, player.position.z);
  shootPellets(weapon);
  applyRecoil(weapon);
  showWeaponMuzzleFlash(weapon);
  playWeaponShotSound(weapon, 1);
}

// Разброс зависит от состояния игрока: прыжок хуже бега, бег хуже стойки (тихий шаг и присед — «стоя»)
function getCurrentSpreadDegrees(weapon) {
  var degrees = weapon.spread.standing;
  if (!player.isGrounded) {
    degrees = weapon.spread.jumping;
  } else if (getHorizontalSpeed() > WEAPON_SETTINGS.movingSpeedThreshold) {
    degrees = weapon.spread.moving;
  }
  if (weaponState.zoomBlend >= WEAPON_SETTINGS.zoomedBlendThreshold) {
    degrees *= weapon.zoomSpreadMultiplier;
  }
  return degrees;
}

// Направление «вперёд» учитывает отдачу, поэтому пули летят туда же, куда смотрит камера
function computeShotBasis() {
  var yaw = player.yaw + weaponState.recoilYaw;
  var pitch = player.pitch + weaponState.recoilPitch;
  var sinYaw = Math.sin(yaw);
  var cosYaw = Math.cos(yaw);
  var sinPitch = Math.sin(pitch);
  var cosPitch = Math.cos(pitch);
  shotScratch.originX = player.position.x;
  shotScratch.originY = player.position.y + player.eyeHeight;
  shotScratch.originZ = player.position.z;
  shotScratch.forwardX = -sinYaw * cosPitch;
  shotScratch.forwardY = sinPitch;
  shotScratch.forwardZ = -cosYaw * cosPitch;
  shotScratch.rightX = cosYaw;
  shotScratch.rightZ = -sinYaw;
  shotScratch.upX = sinYaw * sinPitch;
  shotScratch.upY = cosPitch;
  shotScratch.upZ = cosYaw * sinPitch;
  weaponState.raycaster.ray.origin.set(shotScratch.originX, shotScratch.originY, shotScratch.originZ);
}

// В списке луча только стены и хитбоксы живых ботов: остальная сцена не проверяется
function fillRayTargets() {
  var targets = weaponState.rayTargets;
  var walls = getWallMeshes();
  targets.length = 0;
  for (var wallIndex = 0; wallIndex < walls.length; wallIndex++) {
    targets.push(walls[wallIndex]);
  }
  addBotHitboxesToList(targets);
}

// Точка в круге разброса: корень из случайного числа даёт равномерное распределение по площади
function setPelletDirection(spreadDegrees) {
  var scratch = shotScratch;
  var spreadSize = Math.tan(degreesToRadians(spreadDegrees)) * Math.sqrt(Math.random());
  var angle = Math.random() * TWO_PI;
  var offsetRight = Math.cos(angle) * spreadSize;
  var offsetUp = Math.sin(angle) * spreadSize;
  var x = scratch.forwardX + scratch.rightX * offsetRight + scratch.upX * offsetUp;
  var y = scratch.forwardY + scratch.upY * offsetUp;
  var z = scratch.forwardZ + scratch.rightZ * offsetRight + scratch.upZ * offsetUp;
  var length = Math.sqrt(x * x + y * y + z * z);
  weaponState.raycaster.ray.direction.set(x / length, y / length, z / length);
}

// Возвращает ближайшее попадание или null; массив попаданий переиспользуется
function castRay(range) {
  weaponState.raycaster.far = range;
  weaponState.rayHits.length = 0;
  weaponState.raycaster.intersectObjects(weaponState.rayTargets, false, weaponState.rayHits);
  if (weaponState.rayHits.length === 0) {
    return null;
  }
  return weaponState.rayHits[0];
}

// Все пули выстрела разбираются вместе, в статистику идёт один выстрел: попал или нет, была ли голова
function shootPellets(weapon) {
  computeShotBasis();
  fillRayTargets();
  weaponState.shotHitBot = false;
  weaponState.shotHitHead = false;
  var spreadDegrees = getCurrentSpreadDegrees(weapon);
  for (var pellet = 0; pellet < weapon.pellets; pellet++) {
    setPelletDirection(spreadDegrees);
    var hit = castRay(weapon.range);
    spawnShotTracer(weapon, hit);
    if (hit !== null) {
      handleShotHit(weapon, hit);
    }
  }
  registerPlayerShot(weaponState.shotHitBot, weaponState.shotHitHead);
}

function meleeAttack(weapon) {
  weaponState.fireTimer = 1 / weapon.shotsPerSecond;
  computeShotBasis();
  fillRayTargets();
  setPelletDirection(0);
  var hit = castRay(weapon.range);
  if (hit !== null) {
    handleShotHit(weapon, hit);
  }
  applyRecoil(weapon);
  playWeaponShotSound(weapon, 1);
}

// ---------- попадания ----------

function getPartMultiplier(part) {
  if (part === 'head') {
    return CONFIG.combat.headMultiplier;
  }
  if (part === 'legs') {
    return CONFIG.combat.legMultiplier;
  }
  return CONFIG.combat.bodyMultiplier;
}

function hitTarget(weapon, hit, target) {
  var part = hit.object.userData.part;
  var direction = weaponState.raycaster.ray.direction;
  weaponState.shotHitBot = true;
  if (part === 'head') {
    weaponState.shotHitHead = true;
  }
  if (damageTarget(target, part, weapon.damage * getPartMultiplier(part))) {
    registerPlayerKill();
  }
  spawnSparks(
    hit.point.x, hit.point.y, hit.point.z,
    -direction.x, -direction.y, -direction.z,
    CONFIG.effects.sparks.targetCount, CONFIG.effects.sparks.targetColor
  );
  if (weaponState.hitSoundTimer <= 0) {
    playHitSound(part);
    weaponState.hitSoundTimer = WEAPON_SETTINGS.wallSoundInterval;
  }
}

function hitWall(hit) {
  var normal = hit.face.normal;
  spawnSparks(
    hit.point.x, hit.point.y, hit.point.z,
    normal.x, normal.y, normal.z,
    CONFIG.effects.sparks.wallCount, CONFIG.effects.sparks.wallColor
  );
  spawnBulletMark(hit.point.x, hit.point.y, hit.point.z, normal.x, normal.y, normal.z);
  if (weaponState.wallSoundTimer <= 0) {
    playWallHitSound();
    weaponState.wallSoundTimer = WEAPON_SETTINGS.wallSoundInterval;
  }
}

// У мешей-хитбоксов ботов в userData лежит ссылка на цель, у стен — ничего
function handleShotHit(weapon, hit) {
  var target = hit.object.userData.target;
  if (target !== undefined) {
    hitTarget(weapon, hit, target);
  } else {
    hitWall(hit);
  }
}

// Урон по цели (боту): уменьшает здоровье и вызывает обработчики цели —
// onKilled при гибели и onDamaged, если цель выжила. Возвращает true, если цель уничтожена.
function damageTarget(target, hitPart, amount) {
  if (!target.isAlive) {
    return false;
  }
  target.health = Math.max(0, target.health - amount);
  target.isAlive = target.health > 0;
  target.hitFlashTimer = CONFIG.bots.hitFlashSeconds;
  showHitInfo(target, hitPart, amount);
  playBotDamageVoice(target.voicePath);
  if (!target.isAlive && target.onKilled !== undefined) {
    target.onKilled(target);
  } else if (target.isAlive && target.onDamaged !== undefined) {
    target.onDamaged(target, hitPart, amount);
  }
  return !target.isAlive;
}

// ---------- отдача, зум, поза модели ----------

function applyRecoil(weapon) {
  var maxRecoil = degreesToRadians(WEAPON_SETTINGS.maxRecoilDegrees);
  var pitchKick = degreesToRadians(weapon.recoil.pitchDegrees);
  var yawKick = degreesToRadians(weapon.recoil.yawDegrees) * randomSigned();
  weaponState.recoilPitch = Math.min(weaponState.recoilPitch + pitchKick, maxRecoil);
  weaponState.recoilYaw = clampValue(weaponState.recoilYaw + yawKick, -maxRecoil, maxRecoil);
  weaponState.kick = 1;
  addCameraShake(weapon.cameraShake);
}

// Отдача плавно возвращается к нулю: прицел опускается обратно
function updateRecoil(delta) {
  var keepRatio = Math.max(0, 1 - WEAPON_SETTINGS.recoilRecoveryPerSecond * delta);
  weaponState.recoilPitch *= keepRatio;
  weaponState.recoilYaw *= keepRatio;
  weaponState.kick = Math.max(0, weaponState.kick - WEAPON_SETTINGS.kickRecoveryPerSecond * delta);
}

// Вызывается после applyPlayerToCamera: добавляет отдачу к повороту камеры
function applyWeaponRecoilToCamera(camera) {
  var limit = Math.PI / 2 - CONFIG.physics.contactEpsilon;
  camera.rotation.x = clampValue(camera.rotation.x + weaponState.recoilPitch, -limit, limit);
  camera.rotation.y += weaponState.recoilYaw;
}

function canZoom(weapon) {
  return weapon.zoomFovDegrees > 0 && weaponState.pendingIndex === -1 && !weaponState.isReloading;
}

function updateZoomState(delta) {
  var weapon = getCurrentWeapon();
  var wantsZoom = player.isAlive && canZoom(weapon) && isMouseButtonDown(MOUSE_BUTTON.RIGHT);
  weaponState.isZoomed = wantsZoom;
  if (wantsZoom) {
    weaponState.zoomFov = weapon.zoomFovDegrees;
  }
  weaponState.zoomBlend = approachValue(weaponState.zoomBlend, wantsZoom ? 1 : 0, WEAPON_SETTINGS.zoomSpeed * delta);
}

function applyZoomToCamera(camera) {
  var baseFov = CONFIG.render.fovDegrees;
  var fov = baseFov + (weaponState.zoomFov - baseFov) * weaponState.zoomBlend;
  if (Math.abs(camera.fov - fov) > CONFIG.physics.contactEpsilon) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

// При зуме мышь замедляется пропорционально сужению угла обзора (вызывается до updatePlayerLook)
function applyZoomToMouseDelta() {
  var fovRatio = weaponState.zoomFov / CONFIG.render.fovDegrees;
  var scale = 1 + (fovRatio - 1) * weaponState.zoomBlend;
  input.mouseDeltaX *= scale;
  input.mouseDeltaY *= scale;
}

function updateViewPose() {
  var weapon = getCurrentWeapon();
  viewPose.weaponIndex = weaponState.currentIndex;
  viewPose.kick = weaponState.kick;
  viewPose.isReloading = weaponState.isReloading;
  viewPose.reloadProgress = weaponState.isReloading ? 1 - weaponState.reloadTimer / weapon.reloadSeconds : 0;
  viewPose.lower = getSwitchLowering();
  viewPose.bobPhase = player.bobPhase;
  viewPose.bobBlend = player.bobBlend;
  viewPose.isHidden = weaponState.zoomBlend > WEAPON_SETTINGS.hideModelBlend;
}

// ---------- визуальные эффекты выстрела ----------

function showWeaponMuzzleFlash(weapon) {
  if (weaponState.zoomBlend > WEAPON_SETTINGS.hideModelBlend) {
    return;
  }
  var base = weapon.viewModel.position;
  var muzzle = weapon.viewModel.muzzle;
  showMuzzleFlash(base.x + muzzle.x, base.y + muzzle.y, base.z + muzzle.z, weapon.flashSize);
}

function getTracerEndX(hit, length) {
  return hit !== null ? hit.point.x : shotScratch.originX + weaponState.raycaster.ray.direction.x * length;
}

function getTracerEndY(hit, length) {
  return hit !== null ? hit.point.y : shotScratch.originY + weaponState.raycaster.ray.direction.y * length;
}

function getTracerEndZ(hit, length) {
  return hit !== null ? hit.point.z : shotScratch.originZ + weaponState.raycaster.ray.direction.z * length;
}

// Трассер идёт от места чуть правее и ниже глаз (где у игрока ствол) до точки попадания
function spawnShotTracer(weapon, hit) {
  var tracer = CONFIG.effects.tracer;
  var scratch = shotScratch;
  var length = Math.min(weapon.range, WEAPON_SETTINGS.tracerMaxLength);
  var startX = scratch.originX + scratch.rightX * tracer.startRight - scratch.upX * tracer.startDown + scratch.forwardX * tracer.startForward;
  var startY = scratch.originY - scratch.upY * tracer.startDown + scratch.forwardY * tracer.startForward;
  var startZ = scratch.originZ + scratch.rightZ * tracer.startRight - scratch.upZ * tracer.startDown + scratch.forwardZ * tracer.startForward;
  spawnTracer(startX, startY, startZ, getTracerEndX(hit, length), getTracerEndY(hit, length), getTracerEndZ(hit, length));
}

// ---------- временная информация на экране (на этапе 7 заменится HUD) ----------

function getPlayerStatusText() {
  return 'HP ' + Math.round(player.health) + '  Броня ' + Math.round(player.armor);
}

function getWeaponInfoText() {
  var weapon = getCurrentWeapon();
  var index = weaponState.currentIndex;
  var text = weapon.name;
  if (!weapon.isMelee) {
    text += '  ' + weaponState.magazine[index] + ' / ' + weaponState.reserve[index];
  }
  if (weaponState.isReloading) {
    text += '  — перезарядка';
  }
  return text + '   ' + getPlayerStatusText();
}

// Текст меняется только когда что-то изменилось, а не каждый кадр
function refreshWeaponInfo() {
  if (!weaponState.infoDirty) {
    return;
  }
  weaponState.infoElement.textContent = getWeaponInfoText();
  weaponState.infoDirty = false;
}

function showHitInfo(target, hitPart, amount) {
  var text = target.name + ': ' + PART_LABELS[hitPart] + ', −' + Math.round(amount) + ' (осталось ' + Math.round(target.health) + ')';
  if (!target.isAlive) {
    text += ', уничтожен';
  }
  weaponState.hitInfoElement.textContent = text;
  weaponState.hitInfoTimer = CONFIG.tempHud.hitInfoSeconds;
}

function updateHitInfo(delta) {
  if (weaponState.hitInfoTimer <= 0) {
    return;
  }
  weaponState.hitInfoTimer -= delta;
  if (weaponState.hitInfoTimer <= 0) {
    weaponState.hitInfoElement.textContent = '';
  }
}
