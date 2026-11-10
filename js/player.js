// Роль: игрок — состояние, движение с ускорением и трением, общие коллизии тел (игрок и боты), камера, здоровье.

var TWO_PI = Math.PI * 2;
var HALF = 0.5;
var DEGREES_IN_HALF_TURN = 180;

// «Тело» для коллизий: position, velocity, radius, height, isGrounded, stepOffset (и необязательный onLanded).
// Такие же поля есть у bot.body, поэтому боты используют те же функции движения.
var player = {
  position: { x: 0, y: 0, z: 0 }, // y — уровень ног
  velocity: { x: 0, y: 0, z: 0 },
  radius: CONFIG.player.radius,
  height: CONFIG.player.standingHeight,
  isGrounded: false,
  stepOffset: 0,
  onLanded: onPlayerLanded,
  wishX: 0,
  wishZ: 0,
  yaw: 0,
  pitch: 0,
  eyeHeight: CONFIG.player.standingEyeHeight,
  isCrouching: false,
  isAlive: true,
  health: CONFIG.player.maxHealth,
  armor: 0,
  bobPhase: 0,
  bobBlend: 0,
  shakeAmount: 0
};

// ---------- общие помощники ----------

function clampValue(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function approachValue(current, target, maxChange) {
  if (current < target) {
    return Math.min(current + maxChange, target);
  }
  return Math.max(current - maxChange, target);
}

function degreesToRadians(degrees) {
  return degrees * Math.PI / DEGREES_IN_HALF_TURN;
}

function getHorizontalSpeed() {
  return Math.sqrt(player.velocity.x * player.velocity.x + player.velocity.z * player.velocity.z);
}

// ---------- боксы ----------

// Каждый бокс карты должен пройти через эту функцию: она считает границы для коллизий
function addBoxBounds(box) {
  box.minX = box.x - box.w * HALF;
  box.maxX = box.x + box.w * HALF;
  box.minY = box.y - box.h * HALF;
  box.maxY = box.y + box.h * HALF;
  box.minZ = box.z - box.d * HALF;
  box.maxZ = box.z + box.d * HALF;
  return box;
}

function getOffsetFromBoxX(body, box) {
  return body.position.x - clampValue(body.position.x, box.minX, box.maxX);
}

function getOffsetFromBoxZ(body, box) {
  return body.position.z - clampValue(body.position.z, box.minZ, box.maxZ);
}

// Пересекается ли круг тела с прямоугольником бокса в плоскости XZ
function isBodyOverBox(body, box) {
  var offsetX = getOffsetFromBoxX(body, box);
  var offsetZ = getOffsetFromBoxZ(body, box);
  return offsetX * offsetX + offsetZ * offsetZ < body.radius * body.radius;
}

// ---------- сброс ----------

function setCrouching(isCrouching) {
  player.isCrouching = isCrouching;
  player.height = isCrouching ? CONFIG.player.crouchHeight : CONFIG.player.standingHeight;
}

function resetPlayerPosition(spawn) {
  player.position.x = spawn.x;
  player.position.y = spawn.y;
  player.position.z = spawn.z;
  player.velocity.x = 0;
  player.velocity.y = 0;
  player.velocity.z = 0;
  player.yaw = degreesToRadians(spawn.yawDegrees);
  player.pitch = 0;
  player.isGrounded = false;
  setCrouching(false);
}

function resetPlayerStats() {
  player.health = CONFIG.player.maxHealth;
  player.armor = CONFIG.player.startArmor;
  player.isAlive = true;
}

function resetPlayerCameraState() {
  player.eyeHeight = CONFIG.player.standingEyeHeight;
  player.stepOffset = 0;
  player.bobPhase = 0;
  player.bobBlend = 0;
  player.shakeAmount = 0;
}

// spawn — объект {x, y, z, yawDegrees}
function resetPlayer(spawn) {
  resetPlayerPosition(spawn);
  resetPlayerStats();
  resetPlayerCameraState();
}

// ---------- обзор мышью (вызывается каждый кадр, не в фиксированном шаге) ----------

function getMaxPitch() {
  return degreesToRadians(CONFIG.player.maxPitchDegrees);
}

function updatePlayerLook() {
  var deltaX = takeMouseDeltaX();
  var deltaY = takeMouseDeltaY();
  if (gameState.current !== GAME_STATE.PLAYING || !player.isAlive) {
    return;
  }
  var radiansPerPixel = CONFIG.player.mouseRadiansPerPixel * settings.mouseSensitivity;
  player.yaw -= deltaX * radiansPerPixel;
  player.pitch = clampValue(player.pitch - deltaY * radiansPerPixel, -getMaxPitch(), getMaxPitch());
}

// ---------- присед ----------

function hasHeadroomToStand() {
  var crouchTop = player.position.y + CONFIG.player.crouchHeight;
  var standingTop = player.position.y + CONFIG.player.standingHeight;
  for (var index = 0; index < mapData.boxes.length; index++) {
    var box = mapData.boxes[index];
    if (box.maxY > crouchTop && box.minY < standingTop && isBodyOverBox(player, box)) {
      return false;
    }
  }
  return true;
}

function updateCrouch(step) {
  if (isActionPressed('crouch')) {
    setCrouching(true);
  } else if (player.isCrouching && hasHeadroomToStand()) {
    setCrouching(false);
  }
  var eyeTarget = player.isCrouching ? CONFIG.player.crouchEyeHeight : CONFIG.player.standingEyeHeight;
  player.eyeHeight = approachValue(player.eyeHeight, eyeTarget, CONFIG.player.crouchTransitionSpeed * step);
}

// ---------- скорость: ускорение, трение, прыжок, гравитация ----------

function updateWishDirection() {
  var forwardAmount = getActionAxis('moveForward', 'moveBackward');
  var strafeAmount = getActionAxis('moveRight', 'moveLeft');
  var sinYaw = Math.sin(player.yaw);
  var cosYaw = Math.cos(player.yaw);
  var wishX = -sinYaw * forwardAmount + cosYaw * strafeAmount;
  var wishZ = -cosYaw * forwardAmount - sinYaw * strafeAmount;
  var length = Math.sqrt(wishX * wishX + wishZ * wishZ);
  if (length > 0) {
    wishX /= length;
    wishZ /= length;
  }
  player.wishX = wishX;
  player.wishZ = wishZ;
}

function getTargetSpeed() {
  if (player.isCrouching) {
    return CONFIG.player.crouchSpeed;
  }
  if (isActionPressed('quietWalk')) {
    return CONFIG.player.quietWalkSpeed;
  }
  return CONFIG.player.walkSpeed;
}

function applyGroundFriction(step) {
  var speed = getHorizontalSpeed();
  if (speed === 0) {
    return;
  }
  var drop = Math.max(speed, CONFIG.physics.stopSpeed) * CONFIG.physics.groundFriction * step;
  var scale = Math.max(0, speed - drop) / speed;
  player.velocity.x *= scale;
  player.velocity.z *= scale;
}

// Разгоняет только вдоль желаемого направления и не выше целевой скорости
function accelerateHorizontally(targetSpeed, acceleration, step) {
  var currentSpeed = player.velocity.x * player.wishX + player.velocity.z * player.wishZ;
  var speedToAdd = targetSpeed - currentSpeed;
  if (speedToAdd <= 0) {
    return;
  }
  var speedGain = Math.min(acceleration * step, speedToAdd);
  player.velocity.x += player.wishX * speedGain;
  player.velocity.z += player.wishZ * speedGain;
}

function updateHorizontalVelocity(step) {
  var acceleration = CONFIG.physics.airAcceleration;
  if (player.isGrounded) {
    applyGroundFriction(step);
    acceleration = CONFIG.physics.groundAcceleration;
  }
  accelerateHorizontally(getTargetSpeed(), acceleration, step);
}

function updateVerticalVelocity(step) {
  if (player.isGrounded && isActionPressed('jump')) {
    player.velocity.y = CONFIG.player.jumpSpeed;
    player.isGrounded = false;
    return;
  }
  var newSpeed = player.velocity.y - CONFIG.physics.gravity * step;
  player.velocity.y = Math.max(newSpeed, -CONFIG.physics.maxFallSpeed);
}

// ---------- коллизии тел: горизонталь ----------

// Бокс ниже высоты шага тело просто переступает, а бокс выше головы не мешает
function blocksHorizontally(body, box) {
  var feetY = body.position.y;
  return box.maxY > feetY + CONFIG.player.maxStepHeight && box.minY < feetY + body.height;
}

// Сдвигает тело вдоль нормали и убирает часть скорости, направленную в стену (отсюда скольжение)
function applyPush(body, normalX, normalZ, pushDistance) {
  body.position.x += normalX * pushDistance;
  body.position.z += normalZ * pushDistance;
  var speedIntoWall = body.velocity.x * normalX + body.velocity.z * normalZ;
  if (speedIntoWall < 0) {
    body.velocity.x -= speedIntoWall * normalX;
    body.velocity.z -= speedIntoWall * normalZ;
  }
}

function pushOutFromEdge(body, offsetX, offsetZ, distance) {
  var pushDistance = body.radius - distance + CONFIG.physics.contactEpsilon;
  applyPush(body, offsetX / distance, offsetZ / distance, pushDistance);
}

// Центр тела оказался внутри бокса: выталкиваем через ближайшую грань
function pushOutFromInside(body, box) {
  var toMinX = body.position.x - box.minX;
  var toMaxX = box.maxX - body.position.x;
  var toMinZ = body.position.z - box.minZ;
  var toMaxZ = box.maxZ - body.position.z;
  var nearest = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
  var extra = body.radius + CONFIG.physics.contactEpsilon;
  if (nearest === toMinX) {
    applyPush(body, -1, 0, toMinX + extra);
  } else if (nearest === toMaxX) {
    applyPush(body, 1, 0, toMaxX + extra);
  } else if (nearest === toMinZ) {
    applyPush(body, 0, -1, toMinZ + extra);
  } else {
    applyPush(body, 0, 1, toMaxZ + extra);
  }
}

function pushBodyOutOfBox(body, box) {
  var offsetX = getOffsetFromBoxX(body, box);
  var offsetZ = getOffsetFromBoxZ(body, box);
  var distanceSquared = offsetX * offsetX + offsetZ * offsetZ;
  if (distanceSquared >= body.radius * body.radius) {
    return false;
  }
  if (distanceSquared === 0) {
    pushOutFromInside(body, box);
  } else {
    pushOutFromEdge(body, offsetX, offsetZ, Math.sqrt(distanceSquared));
  }
  return true;
}

// Несколько проходов нужны для углов, где тело выталкивают сразу две стены
function resolveHorizontalCollisions(body) {
  for (var pass = 0; pass < CONFIG.physics.collisionPasses; pass++) {
    var wasPushed = false;
    for (var index = 0; index < mapData.boxes.length; index++) {
      var box = mapData.boxes[index];
      if (blocksHorizontally(body, box) && pushBodyOutOfBox(body, box)) {
        wasPushed = true;
      }
    }
    if (!wasPushed) {
      return;
    }
  }
}

// ---------- коллизии тел: вертикаль ----------

// Самая высокая поверхность под ногами: пол или верх бокса, до которого тело может дотянуться
function findSupportHeight(body) {
  var reachY = body.position.y + CONFIG.player.maxStepHeight + CONFIG.physics.contactEpsilon;
  var supportHeight = CONFIG.physics.floorHeight;
  for (var index = 0; index < mapData.boxes.length; index++) {
    var box = mapData.boxes[index];
    if (box.maxY <= reachY && box.maxY > supportHeight && isBodyOverBox(body, box)) {
      supportHeight = box.maxY;
    }
  }
  return supportHeight;
}

// Самый низкий потолок над головой (Infinity, если потолка нет)
function findCeilingHeight(body, headY) {
  var ceilingHeight = Infinity;
  for (var index = 0; index < mapData.boxes.length; index++) {
    var box = mapData.boxes[index];
    var isAboveHead = box.minY >= headY - CONFIG.physics.contactEpsilon;
    if (isAboveHead && box.minY < ceilingHeight && isBodyOverBox(body, box)) {
      ceilingHeight = box.minY;
    }
  }
  return ceilingHeight;
}

function addCameraShake(amount) {
  player.shakeAmount = Math.min(player.shakeAmount + amount, CONFIG.camera.maxShake);
}

function onPlayerLanded(impactSpeed) {
  if (impactSpeed >= CONFIG.camera.landingShakeMinSpeed) {
    addCameraShake(impactSpeed * CONFIG.camera.landingShakePerSpeed);
  }
}

// Сообщает телу о приземлении, если у него есть обработчик (у игрока — тряска камеры, у ботов его нет)
function notifyBodyLanded(body, impactSpeed) {
  if (body.onLanded !== undefined) {
    body.onLanded(impactSpeed);
  }
}

function landOn(body, supportHeight) {
  if (!body.isGrounded) {
    notifyBodyLanded(body, -body.velocity.y);
  } else if (supportHeight > body.position.y) {
    // Камера не должна дёргаться при шаге на выступ: опускаем её и плавно возвращаем
    body.stepOffset -= supportHeight - body.position.y;
  }
  body.position.y = supportHeight;
  body.velocity.y = 0;
  body.isGrounded = true;
}

function moveDown(body, deltaY) {
  var supportHeight = findSupportHeight(body);
  var newY = body.position.y + deltaY;
  if (newY <= supportHeight + CONFIG.physics.contactEpsilon) {
    landOn(body, supportHeight);
  } else {
    body.position.y = newY;
    body.isGrounded = false;
  }
}

function moveUp(body, deltaY) {
  var headY = body.position.y + body.height;
  var ceilingHeight = findCeilingHeight(body, headY);
  body.isGrounded = false;
  if (headY + deltaY >= ceilingHeight) {
    body.position.y = ceilingHeight - body.height;
    body.velocity.y = 0;
  } else {
    body.position.y += deltaY;
  }
}

function moveVertically(body, deltaY) {
  if (deltaY > 0) {
    moveUp(body, deltaY);
  } else {
    moveDown(body, deltaY);
  }
}

// ---------- движение подшагами ----------

function moveSubstep(body, deltaX, deltaY, deltaZ) {
  body.position.x += deltaX;
  body.position.z += deltaZ;
  resolveHorizontalCollisions(body);
  moveVertically(body, deltaY);
}

// Шаг делится так, чтобы за один подшаг тело сдвигалось не дальше maxMoveStep: сквозь стену не пролететь
function moveBodyWithCollisions(body, step) {
  var moveX = body.velocity.x * step;
  var moveY = body.velocity.y * step;
  var moveZ = body.velocity.z * step;
  var distance = Math.max(Math.sqrt(moveX * moveX + moveZ * moveZ), Math.abs(moveY));
  var substeps = Math.max(1, Math.ceil(distance / CONFIG.physics.maxMoveStep));
  for (var index = 0; index < substeps; index++) {
    moveSubstep(body, moveX / substeps, moveY / substeps, moveZ / substeps);
  }
}

// ---------- камера: покачивание, тряска, применение к камере ----------

function updateHeadBob(step) {
  var speed = getHorizontalSpeed();
  var strength = 0;
  if (player.isGrounded && settings.headBob) {
    strength = Math.min(1, speed / CONFIG.player.walkSpeed);
  }
  player.bobBlend = approachValue(player.bobBlend, strength, CONFIG.camera.bobBlendSpeed * step);
  player.bobPhase = (player.bobPhase + speed * CONFIG.camera.bobCyclesPerMeter * step) % 1;
}

function updateCameraEffects(step) {
  updateHeadBob(step);
  player.stepOffset = approachValue(player.stepOffset, 0, CONFIG.camera.stepSmoothSpeed * step);
  player.shakeAmount = Math.max(0, player.shakeAmount - CONFIG.camera.shakeDecayPerSecond * step);
}

function getBobVertical() {
  var phase = player.bobPhase * TWO_PI * CONFIG.camera.bobBouncesPerCycle;
  return Math.sin(phase) * CONFIG.camera.bobVerticalAmplitude * player.bobBlend;
}

function getBobRoll() {
  return Math.sin(player.bobPhase * TWO_PI) * CONFIG.camera.bobRollAmplitude * player.bobBlend;
}

// Случайное смещение от -shakeAmount до +shakeAmount; на паузе и при выключенной настройке тряски даёт 0
function getShakeValue() {
  var isShaking = settings.cameraShake && gameState.current === GAME_STATE.PLAYING;
  if (!isShaking || player.shakeAmount === 0) {
    return 0;
  }
  return (Math.random() * 2 - 1) * player.shakeAmount;
}

function applyPlayerToCamera(camera) {
  var eyeY = player.position.y + player.eyeHeight + player.stepOffset + getBobVertical();
  camera.position.set(player.position.x, eyeY, player.position.z);
  camera.rotation.set(
    player.pitch + getShakeValue(),
    player.yaw + getShakeValue(),
    getBobRoll() + getShakeValue()
  );
}

// ---------- здоровье (раунды появятся на этапе 6) ----------

// Игрок погиб: движение и стрельба отключаются (updatePlayer и оружие проверяют isAlive), экран затемняет main.js
function killPlayer() {
  player.isAlive = false;
  player.health = 0;
  player.velocity.x = 0;
  player.velocity.z = 0;
  // TODO этап 6: сообщить game.js о проигранном раунде
}

// Броня поглощает часть урона (armorAbsorbRatio) и убывает на поглощённую часть
function damagePlayer(amount) {
  if (!player.isAlive) {
    return;
  }
  var absorbed = Math.min(player.armor, amount * CONFIG.combat.armorAbsorbRatio);
  player.armor -= absorbed;
  player.health = Math.max(0, player.health - (amount - absorbed));
  if (player.health === 0) {
    killPlayer();
  }
}

// ---------- шаг логики ----------

function updatePlayer(step) {
  if (!player.isAlive) {
    return;
  }
  updateCrouch(step);
  updateWishDirection();
  updateHorizontalVelocity(step);
  updateVerticalVelocity(step);
  moveBodyWithCollisions(player, step);
  updateCameraEffects(step);
}