// Роль: эффекты стрельбы — вспышка, следы пуль, искры, следы на стенах. Все объекты создаются заранее (пулы).

var effects = {
  flash: null,
  flashTimer: 0,
  tracers: [],
  nextTracerIndex: 0,
  sparks: {
    points: null,
    positions: null,
    colors: null,
    baseColors: null,
    velocities: null,
    lifetimes: null,
    maxLifetimes: null,
    nextIndex: 0
  },
  marks: [],
  nextMarkIndex: 0
};

function randomSigned() {
  return Math.random() * 2 - 1;
}

// ---------- создание пулов ----------

// Вспышка живёт в сцене оружия, поэтому всегда рисуется поверх мира
function createFlash(weaponScene) {
  var material = new THREE.MeshBasicMaterial({
    map: getTexture('muzzleFlash'),
    transparent: true,
    opacity: CONFIG.effects.flash.opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  effects.flash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  effects.flash.visible = false;
  weaponScene.add(effects.flash);
}

function createTracerPool(scene) {
  var settings = CONFIG.effects.tracer;
  var geometry = new THREE.BoxGeometry(1, 1, 1);
  for (var index = 0; index < settings.poolSize; index++) {
    var material = new THREE.MeshBasicMaterial({
      color: settings.color,
      transparent: true,
      opacity: settings.opacity,
      depthWrite: false,
      fog: false
    });
    var mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    scene.add(mesh);
    effects.tracers.push({ mesh: mesh, material: material, timeLeft: 0 });
  }
}

// Все искры — одна система точек; неактивные искры чёрные и при сложении цветов не видны
function createSparkPool(scene) {
  var settings = CONFIG.effects.sparks;
  var sparks = effects.sparks;
  var valueCount = settings.poolSize * VECTOR_COMPONENTS;
  sparks.positions = new Float32Array(valueCount);
  sparks.colors = new Float32Array(valueCount);
  sparks.baseColors = new Float32Array(valueCount);
  sparks.velocities = new Float32Array(valueCount);
  sparks.lifetimes = new Float32Array(settings.poolSize);
  sparks.maxLifetimes = new Float32Array(settings.poolSize);
  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(sparks.positions, VECTOR_COMPONENTS));
  geometry.setAttribute('color', new THREE.BufferAttribute(sparks.colors, VECTOR_COMPONENTS));
  var material = new THREE.PointsMaterial({
    size: settings.size,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  sparks.points = new THREE.Points(geometry, material);
  sparks.points.frustumCulled = false;
  scene.add(sparks.points);
}

function createMarkPool(scene) {
  var settings = CONFIG.effects.marks;
  var geometry = new THREE.PlaneGeometry(1, 1);
  var material = new THREE.MeshBasicMaterial({
    map: getTexture('bulletMark'),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  for (var index = 0; index < settings.poolSize; index++) {
    var mark = new THREE.Mesh(geometry, material);
    mark.visible = false;
    scene.add(mark);
    effects.marks.push(mark);
  }
}

// Вызывается после создания текстур и сцены оружия
function initEffects(scene, weaponScene) {
  createFlash(weaponScene);
  createTracerPool(scene);
  createSparkPool(scene);
  createMarkPool(scene);
}

// ---------- запуск эффектов ----------

// Координаты — в пространстве камеры (сцена оружия); при включённом «reduceFlashing» вспышки нет
function showMuzzleFlash(x, y, z, size) {
  if (settings.reduceFlashing || size <= 0) {
    return;
  }
  effects.flash.position.set(x, y, z);
  effects.flash.scale.set(size, size, 1);
  effects.flash.rotation.z = Math.random() * Math.PI * 2;
  effects.flash.visible = true;
  effects.flashTimer = CONFIG.effects.flash.durationSeconds;
}

// Берёт следующий трассер по кругу: самый старый заменяется новым, пул не растёт
function spawnTracer(fromX, fromY, fromZ, toX, toY, toZ) {
  var settings = CONFIG.effects.tracer;
  var tracer = effects.tracers[effects.nextTracerIndex];
  effects.nextTracerIndex = (effects.nextTracerIndex + 1) % effects.tracers.length;
  var deltaX = toX - fromX;
  var deltaY = toY - fromY;
  var deltaZ = toZ - fromZ;
  var length = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
  tracer.mesh.position.set(fromX + deltaX / 2, fromY + deltaY / 2, fromZ + deltaZ / 2);
  tracer.mesh.scale.set(settings.thickness, settings.thickness, length);
  tracer.mesh.lookAt(toX, toY, toZ);
  tracer.material.opacity = settings.opacity;
  tracer.mesh.visible = true;
  tracer.timeLeft = settings.durationSeconds;
}

function resetSpark(slot, x, y, z, normalX, normalY, normalZ, color) {
  var settings = CONFIG.effects.sparks;
  var sparks = effects.sparks;
  var offset = slot * VECTOR_COMPONENTS;
  var speed = settings.wallSpeed * (settings.minSpeedRatio + Math.random() * (1 - settings.minSpeedRatio));
  var lifetime = settings.lifetimeSeconds * (settings.minLifeRatio + Math.random() * (1 - settings.minLifeRatio));
  sparks.positions[offset] = x;
  sparks.positions[offset + 1] = y;
  sparks.positions[offset + 2] = z;
  sparks.velocities[offset] = normalX * speed + randomSigned() * settings.spread;
  sparks.velocities[offset + 1] = normalY * speed + randomSigned() * settings.spread;
  sparks.velocities[offset + 2] = normalZ * speed + randomSigned() * settings.spread;
  for (var axis = 0; axis < VECTOR_COMPONENTS; axis++) {
    sparks.baseColors[offset + axis] = color[axis];
    sparks.colors[offset + axis] = color[axis];
  }
  sparks.lifetimes[slot] = lifetime;
  sparks.maxLifetimes[slot] = lifetime;
}

// normal — направление, куда летят искры (нормаль поверхности); color — массив [r, g, b] из конфига
function spawnSparks(x, y, z, normalX, normalY, normalZ, count, color) {
  var poolSize = CONFIG.effects.sparks.poolSize;
  for (var index = 0; index < count; index++) {
    var slot = effects.sparks.nextIndex;
    effects.sparks.nextIndex = (slot + 1) % poolSize;
    resetSpark(slot, x, y, z, normalX, normalY, normalZ, color);
  }
}

// Следы на стенах тоже по кругу: самый старый след исчезает, когда пул заполнен
function spawnBulletMark(x, y, z, normalX, normalY, normalZ) {
  var settings = CONFIG.effects.marks;
  var mark = effects.marks[effects.nextMarkIndex];
  effects.nextMarkIndex = (effects.nextMarkIndex + 1) % effects.marks.length;
  mark.position.set(
    x + normalX * settings.surfaceOffset,
    y + normalY * settings.surfaceOffset,
    z + normalZ * settings.surfaceOffset
  );
  mark.scale.set(settings.size, settings.size, 1);
  mark.lookAt(x + normalX, y + normalY, z + normalZ);
  mark.rotateZ(Math.random() * Math.PI * 2);
  mark.visible = true;
}

// ---------- обновление ----------

function updateFlash(delta) {
  if (effects.flashTimer <= 0) {
    return;
  }
  effects.flashTimer -= delta;
  if (effects.flashTimer <= 0) {
    effects.flash.visible = false;
  }
}

function updateTracers(delta) {
  var settings = CONFIG.effects.tracer;
  for (var index = 0; index < effects.tracers.length; index++) {
    var tracer = effects.tracers[index];
    if (tracer.timeLeft > 0) {
      tracer.timeLeft -= delta;
      tracer.mesh.visible = tracer.timeLeft > 0;
      tracer.material.opacity = settings.opacity * Math.max(0, tracer.timeLeft) / settings.durationSeconds;
    }
  }
}

function advanceSpark(slot, delta) {
  var settings = CONFIG.effects.sparks;
  var sparks = effects.sparks;
  var offset = slot * VECTOR_COMPONENTS;
  sparks.lifetimes[slot] -= delta;
  var fade = Math.max(0, sparks.lifetimes[slot] / sparks.maxLifetimes[slot]);
  sparks.velocities[offset + 1] -= settings.gravity * delta;
  for (var axis = 0; axis < VECTOR_COMPONENTS; axis++) {
    sparks.positions[offset + axis] += sparks.velocities[offset + axis] * delta;
    sparks.colors[offset + axis] = sparks.baseColors[offset + axis] * fade;
  }
}

function updateSparks(delta) {
  var sparks = effects.sparks;
  var anyActive = false;
  for (var slot = 0; slot < CONFIG.effects.sparks.poolSize; slot++) {
    if (sparks.lifetimes[slot] > 0) {
      advanceSpark(slot, delta);
      anyActive = true;
    }
  }
  if (anyActive) {
    sparks.points.geometry.attributes.position.needsUpdate = true;
    sparks.points.geometry.attributes.color.needsUpdate = true;
  }
}

function updateEffects(delta) {
  updateFlash(delta);
  updateTracers(delta);
  updateSparks(delta);
}

// ---------- сброс перед новым матчем ----------

function hideAllTracers() {
  for (var index = 0; index < effects.tracers.length; index++) {
    effects.tracers[index].timeLeft = 0;
    effects.tracers[index].mesh.visible = false;
  }
}

function clearSparks() {
  var sparks = effects.sparks;
  for (var slot = 0; slot < CONFIG.effects.sparks.poolSize; slot++) {
    sparks.lifetimes[slot] = 0;
  }
  for (var index = 0; index < sparks.colors.length; index++) {
    sparks.colors[index] = 0;
  }
  sparks.points.geometry.attributes.color.needsUpdate = true;
}

function hideAllMarks() {
  for (var index = 0; index < effects.marks.length; index++) {
    effects.marks[index].visible = false;
  }
  effects.nextMarkIndex = 0;
}

// Прячет все следы, трассеры, искры и вспышку: новый матч начинается с чистой карты (объекты остаются в пулах)
function resetEffects() {
  effects.flash.visible = false;
  effects.flashTimer = 0;
  hideAllTracers();
  clearSparks();
  hideAllMarks();
}