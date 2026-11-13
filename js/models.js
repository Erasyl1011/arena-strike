// Роль: процедурные текстуры (canvas → CanvasTexture) и модели из примитивов: оружие от первого лица, боты.

var FULL_CIRCLE = Math.PI * 2;
var DIAGONAL_ANGLE = Math.PI / 4;
var MIDDLE = 0.5;
var WHITE = '#ffffff';
var BLACK = '#000000';
var RGBA_COMPONENTS = 4;
var RANDOM_MULTIPLIER = 1664525;
var RANDOM_INCREMENT = 1013904223;
var RANDOM_MODULUS = 4294967296;
var HASH_FREQUENCY = 12.9898;
var HASH_AMPLITUDE = 43758.5453;
var HASH_ROW_STEP = 31;
var HASH_COLUMN_STEP = 17;
var HASH_OFFSET = 7;

var TEXTURE_DEFINITIONS = [
  { name: 'concrete', title: 'бетон', draw: drawConcrete },
  { name: 'brick', title: 'кирпич', draw: drawBrick },
  { name: 'crate', title: 'деревянный ящик', draw: drawCrate },
  { name: 'sand', title: 'песок', draw: drawSand },
  { name: 'metal', title: 'металл', draw: drawMetal },
  { name: 'muzzleFlash', title: 'вспышка выстрела', draw: drawRadialGradient },
  { name: 'bulletMark', title: 'след пули', draw: drawRadialGradient }
];

var textures = {};
var textureRandomState = 1;

var viewModelData = {
  root: null,
  groups: [],
  handsGroup: null,
  ready: null,
  materials: {},
  boxGeometry: null,
  cylinderGeometry: null
};

var HANDS_GLB_PATH = 'assets/models/hands/counter-strike_source_viewmodel_hands.glb';
// В этих GLB уже записан поворот экспорта: автоматы/пистолет смотрят вдоль -Z.
// Нож после загрузки смотрит вдоль +Y, поэтому для него нужна отдельная ориентация.
var WEAPON_GLB_MODELS = {
  knife: { path: 'assets/models/weapons/knife_default_ct__cs2.glb', axis: 'y', direction: 1, length: 0.38 },
  pistol: { path: 'assets/models/weapons/deagle_counter_strike_2.glb', axis: 'z', direction: -1, length: 0.38 },
  rifle: { path: 'assets/models/weapons/ak47_counter_strike_2.glb', axis: 'z', direction: -1, length: 0.82 },
  sniper: { path: 'assets/models/weapons/awp_counter_strike_2.glb', axis: 'z', direction: -1, length: 0.95 }
};

// Общие ресурсы моделей ботов: ромб-метка и невидимый материал хитбоксов
var botModelData = {
  markerGeometry: null,
  hitboxMaterial: null,
  faceTextures: {}
};

function loadBotFaceTexture(path) {
  if (botModelData.faceTextures[path] !== undefined) {
    return botModelData.faceTextures[path];
  }
  botModelData.faceTextures[path] = new THREE.TextureLoader().load(
    path,
    undefined,
    undefined,
    function (error) {
      console.error('Не удалось загрузить лицо бота: ' + path, error);
    }
  );
  botModelData.faceTextures[path].encoding = THREE.sRGBEncoding;
  return botModelData.faceTextures[path];
}

// При sRGB-выводе цвета материалов и света нужно переводить в линейное пространство
function createLinearColor(hexColor) {
  var color = new THREE.Color(hexColor);
  color.convertSRGBToLinear();
  return color;
}

// ---------- случайные числа (с фиксированным зерном: текстуры одинаковы при каждом запуске) ----------

function seedTextureRandom(seed) {
  textureRandomState = seed;
}

function nextRandom() {
  textureRandomState = (textureRandomState * RANDOM_MULTIPLIER + RANDOM_INCREMENT) % RANDOM_MODULUS;
  return textureRandomState / RANDOM_MODULUS;
}

function randomBetween(minValue, maxValue) {
  return minValue + nextRandom() * (maxValue - minValue);
}

// Одно и то же число даёт один и тот же результат от 0 до 1: нужно, чтобы шов текстуры совпадал
function hashToUnit(number) {
  var value = Math.sin(number * HASH_FREQUENCY) * HASH_AMPLITUDE;
  return value - Math.floor(value);
}

// ---------- общие помощники рисования ----------

function toColorString(red, green, blue) {
  return 'rgb(' + Math.round(red) + ',' + Math.round(green) + ',' + Math.round(blue) + ')';
}

function getShadedColor(baseColor, variation, seed) {
  var shift = (hashToUnit(seed) * 2 - 1) * variation;
  return toColorString(baseColor[0] + shift, baseColor[1] + shift, baseColor[2] + shift);
}

function createTextureCanvas(size) {
  var canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function fillAll(context, size, color) {
  context.fillStyle = color;
  context.fillRect(0, 0, size, size);
}

function addNoise(context, size, strength) {
  var image = context.getImageData(0, 0, size, size);
  var data = image.data;
  for (var index = 0; index < data.length; index += RGBA_COMPONENTS) {
    var shift = (nextRandom() * 2 - 1) * strength;
    data[index] += shift;
    data[index + 1] += shift;
    data[index + 2] += shift;
  }
  context.putImageData(image, 0, 0);
}

// Круг рисуется 9 раз со сдвигом на размер текстуры, чтобы часть за краем появилась с другой стороны
function drawCircleWrapped(context, size, x, y, radius) {
  for (var offsetY = -size; offsetY <= size; offsetY += size) {
    for (var offsetX = -size; offsetX <= size; offsetX += size) {
      context.beginPath();
      context.arc(x + offsetX, y + offsetY, radius, 0, FULL_CIRCLE);
      context.fill();
    }
  }
}

// Цвет и прозрачность задаёт вызывающий
function drawRandomCircles(context, size, count, radiusMin, radiusMax) {
  for (var index = 0; index < count; index++) {
    var radius = randomBetween(radiusMin, radiusMax);
    drawCircleWrapped(context, size, nextRandom() * size, nextRandom() * size, radius);
  }
}

// Светлые и тёмные пятна: придают поверхности неравномерность
function drawBlotches(context, size, params) {
  context.globalAlpha = params.blotchAlpha;
  context.fillStyle = WHITE;
  drawRandomCircles(context, size, params.blotchCount, params.blotchRadiusMin, params.blotchRadiusMax);
  context.fillStyle = BLACK;
  drawRandomCircles(context, size, params.blotchCount, params.blotchRadiusMin, params.blotchRadiusMax);
  context.globalAlpha = 1;
}

// ---------- бетон ----------

function drawSpeckles(context, size, params) {
  context.globalAlpha = params.speckleAlpha;
  for (var index = 0; index < params.speckleCount; index++) {
    context.fillStyle = nextRandom() < MIDDLE ? WHITE : BLACK;
    context.fillRect(nextRandom() * size, nextRandom() * size, params.speckleSize, params.speckleSize);
  }
  context.globalAlpha = 1;
}

function drawSeams(context, size, params) {
  context.fillStyle = params.seamColor;
  context.fillRect(0, 0, params.seamWidth, size);
  context.fillRect(0, 0, size, params.seamWidth);
}

function drawConcrete(context, size, params) {
  fillAll(context, size, params.baseColor);
  drawBlotches(context, size, params);
  drawSpeckles(context, size, params);
  drawSeams(context, size, params);
  addNoise(context, size, params.noise);
}

// ---------- кирпич ----------

function getBrickColor(row, column, params) {
  var seed = row * HASH_ROW_STEP + column * HASH_COLUMN_STEP + HASH_OFFSET;
  return getShadedColor(params.color, params.variation, seed);
}

// Колонка -1 рисуется с цветом последней, чтобы кирпич на шве текстуры был одного цвета с обеих сторон
function drawBrickRow(context, row, brickWidth, brickHeight, params) {
  var rowOffset = (row % 2) * brickWidth / 2;
  var halfMortar = params.mortar / 2;
  for (var column = -1; column < params.columns; column++) {
    var wrappedColumn = (column + params.columns) % params.columns;
    context.fillStyle = getBrickColor(row, wrappedColumn, params);
    context.fillRect(
      rowOffset + column * brickWidth + halfMortar,
      row * brickHeight + halfMortar,
      brickWidth - params.mortar,
      brickHeight - params.mortar
    );
  }
}

function drawBrick(context, size, params) {
  fillAll(context, size, params.mortarColor);
  var brickWidth = size / params.columns;
  var brickHeight = size / params.rows;
  for (var row = 0; row < params.rows; row++) {
    drawBrickRow(context, row, brickWidth, brickHeight, params);
  }
  addNoise(context, size, params.noise);
}

// ---------- деревянный ящик (одна текстура = одна грань ящика) ----------

function clipToInnerArea(context, size, params) {
  var inner = size - params.frameWidth * 2;
  context.beginPath();
  context.rect(params.frameWidth, params.frameWidth, inner, inner);
  context.clip();
}

function drawPlanks(context, size, params) {
  var inner = size - params.frameWidth * 2;
  var plankWidth = inner / params.plankCount;
  for (var index = 0; index < params.plankCount; index++) {
    var seed = index * HASH_COLUMN_STEP + HASH_OFFSET;
    context.fillStyle = getShadedColor(params.plankColor, params.plankVariation, seed);
    context.fillRect(
      params.frameWidth + index * plankWidth + params.plankGap / 2,
      params.frameWidth,
      plankWidth - params.plankGap,
      inner
    );
  }
}

function drawGrain(context, size, params) {
  var inner = size - params.frameWidth * 2;
  context.globalAlpha = params.grainAlpha;
  context.fillStyle = BLACK;
  for (var index = 0; index < params.grainCount; index++) {
    var x = params.frameWidth + nextRandom() * inner;
    var y = params.frameWidth + nextRandom() * inner;
    context.fillRect(x, y, 1, randomBetween(params.grainLengthMin, params.grainLengthMax));
  }
  context.globalAlpha = 1;
}

function drawBrace(context, size, params) {
  var inner = size - params.frameWidth * 2;
  var length = inner * Math.SQRT2;
  var halfLength = length / 2;
  var halfWidth = params.braceWidth / 2;
  context.save();
  context.translate(size / 2, size / 2);
  context.rotate(DIAGONAL_ANGLE);
  context.fillStyle = params.braceEdgeColor;
  context.fillRect(-halfLength, -halfWidth, length, params.braceWidth);
  context.fillStyle = params.braceColor;
  context.fillRect(-halfLength, -halfWidth + params.braceEdge, length, params.braceWidth - params.braceEdge * 2);
  context.restore();
}

function drawNails(context, size, params) {
  var near = params.frameWidth / 2;
  var positions = [near, size - near];
  context.fillStyle = params.nailColor;
  for (var xIndex = 0; xIndex < positions.length; xIndex++) {
    for (var yIndex = 0; yIndex < positions.length; yIndex++) {
      context.beginPath();
      context.arc(positions[xIndex], positions[yIndex], params.nailRadius, 0, FULL_CIRCLE);
      context.fill();
    }
  }
}

function drawCrate(context, size, params) {
  fillAll(context, size, params.frameColor);
  context.save();
  clipToInnerArea(context, size, params);
  drawPlanks(context, size, params);
  drawGrain(context, size, params);
  drawBrace(context, size, params);
  context.restore();
  drawNails(context, size, params);
  addNoise(context, size, params.noise);
}

// ---------- песок ----------

function drawPebbles(context, size, params) {
  context.globalAlpha = params.pebbleAlpha;
  context.fillStyle = params.pebbleColor;
  drawRandomCircles(context, size, params.pebbleCount, params.pebbleRadiusMin, params.pebbleRadiusMax);
  context.globalAlpha = 1;
}

function drawSand(context, size, params) {
  fillAll(context, size, params.baseColor);
  drawBlotches(context, size, params);
  drawPebbles(context, size, params);
  addNoise(context, size, params.noise);
}

// ---------- металл (рифлёный лист) ----------

function drawCorrugation(context, size, params) {
  var stripeCount = size / params.stripeWidth;
  for (var index = 0; index < stripeCount; index++) {
    var left = index * params.stripeWidth;
    var gradient = context.createLinearGradient(left, 0, left + params.stripeWidth, 0);
    gradient.addColorStop(0, params.stripeDark);
    gradient.addColorStop(MIDDLE, params.stripeLight);
    gradient.addColorStop(1, params.stripeDark);
    context.fillStyle = gradient;
    context.fillRect(left, 0, params.stripeWidth, size);
  }
}

function drawRust(context, size, params) {
  context.globalAlpha = params.rustAlpha;
  context.fillStyle = params.rustColor;
  drawRandomCircles(context, size, params.rustCount, params.rustRadiusMin, params.rustRadiusMax);
  context.globalAlpha = 1;
}

function drawScratches(context, size, params) {
  context.globalAlpha = params.scratchAlpha;
  for (var index = 0; index < params.scratchCount; index++) {
    context.fillStyle = nextRandom() < MIDDLE ? WHITE : BLACK;
    var length = randomBetween(params.scratchLengthMin, params.scratchLengthMax);
    context.fillRect(nextRandom() * size, nextRandom() * size, length, 1);
  }
  context.globalAlpha = 1;
}

function drawMetal(context, size, params) {
  drawCorrugation(context, size, params);
  drawRust(context, size, params);
  drawScratches(context, size, params);
  addNoise(context, size, params.noise);
}

// ---------- круглые текстуры с прозрачностью для эффектов (вспышка, след пули) ----------

function drawRadialGradient(context, size, params) {
  var center = size / 2;
  var gradient = context.createRadialGradient(center, center, 0, center, center, center);
  for (var index = 0; index < params.stops.length; index++) {
    gradient.addColorStop(params.stops[index].at, params.stops[index].color);
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
}

// ---------- создание текстур ----------

function createTextureFromCanvas(canvas, maxAnisotropy) {
  var texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = Math.min(CONFIG.textures.anisotropy, maxAnisotropy);
  return texture;
}

// Создаёт одну текстуру по номеру в TEXTURE_DEFINITIONS: загрузка вызывает эту функцию по шагу на текстуру
function createTextureByIndex(index, maxAnisotropy) {
  var definition = TEXTURE_DEFINITIONS[index];
  var size = CONFIG.textures.size;
  var canvas = createTextureCanvas(size);
  seedTextureRandom(CONFIG.textures.randomSeed + index);
  definition.draw(canvas.getContext('2d'), size, CONFIG.textures[definition.name]);
  textures[definition.name] = createTextureFromCanvas(canvas, maxAnisotropy);
}

function getTexture(name) {
  return textures[name];
}

function getTextureCount() {
  return TEXTURE_DEFINITIONS.length;
}

function getTextureTitle(index) {
  return TEXTURE_DEFINITIONS[index].title;
}

// ---------- общие геометрии и материалы моделей ----------

// Единичные куб и цилиндр (ось цилиндра вдоль z); размеры задаются масштабом меша
function createModelGeometries() {
  if (viewModelData.boxGeometry !== null) {
    return;
  }
  viewModelData.boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  var cylinder = new THREE.CylinderGeometry(1, 1, 1, WEAPON_SETTINGS.view.cylinderSegments);
  cylinder.rotateX(Math.PI / 2);
  viewModelData.cylinderGeometry = cylinder;
}

function getViewModelMaterial(hexColor) {
  if (viewModelData.materials[hexColor] === undefined) {
    viewModelData.materials[hexColor] = new THREE.MeshLambertMaterial({ color: createLinearColor(hexColor) });
  }
  return viewModelData.materials[hexColor];
}

// ---------- оружие от первого лица ----------

function addViewModelPart(group, part) {
  var isCylinder = part.shape === 'cylinder';
  var geometry = isCylinder ? viewModelData.cylinderGeometry : viewModelData.boxGeometry;
  var mesh = new THREE.Mesh(geometry, getViewModelMaterial(part.color));
  mesh.position.set(part.x, part.y, part.z);
  if (isCylinder) {
    mesh.scale.set(part.radius, part.radius, part.length);
  } else {
    mesh.scale.set(part.w, part.h, part.d);
  }
  mesh.rotation.set(part.rx || 0, part.ry || 0, part.rz || 0);
  group.add(mesh);
}

function loadGLB(path) {
  return new Promise(function (resolve, reject) {
    var loader = new THREE.GLTFLoader();
    loader.load(path, resolve, undefined, reject);
  });
}

function getGLBObjectBounds(object) {
  object.updateMatrixWorld(true);
  var bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) {
    throw new Error('В GLB нет видимой модели: ' + object.name);
  }
  return bounds;
}

function loadHandsModel() {
  return loadGLB(HANDS_GLB_PATH).then(function (gltf) {
    var bounds = getGLBObjectBounds(gltf.scene);
    var size = bounds.getSize(new THREE.Vector3());
    var center = bounds.getCenter(new THREE.Vector3());
    var largestDimension = Math.max(size.x, size.y, size.z);
    if (largestDimension <= 0) {
      throw new Error('Не удалось определить размер модели рук: ' + HANDS_GLB_PATH);
    }
    // Модель рук экспортирована в меньшем масштабе; приводим её к размеру от первого лица.
    var scale = 0.58 / largestDimension;
    var fitted = new THREE.Group();
    fitted.scale.setScalar(scale);
    fitted.position.copy(center).multiplyScalar(-scale);
    fitted.add(gltf.scene);
    viewModelData.handsGroup.add(fitted);
  });
}

function loadWeaponModel(group, weaponId, definition) {
  var modelSpec = WEAPON_GLB_MODELS[weaponId];
  if (modelSpec === undefined) {
    for (var index = 0; index < definition.viewModel.parts.length; index++) {
      addViewModelPart(group, definition.viewModel.parts[index]);
    }
    return null;
  }
  return loadGLB(modelSpec.path).then(function (gltf) {
    var bounds = getGLBObjectBounds(gltf.scene);
    var size = bounds.getSize(new THREE.Vector3());
    var center = bounds.getCenter(new THREE.Vector3());
    var sourceAxis = new THREE.Vector3(
      modelSpec.axis === 'x' ? modelSpec.direction : 0,
      modelSpec.axis === 'y' ? modelSpec.direction : 0,
      modelSpec.axis === 'z' ? modelSpec.direction : 0
    );
    var targetAxis = new THREE.Vector3(0, 0, -1);
    var axisLength = size[modelSpec.axis];
    if (axisLength <= 0) {
      throw new Error('Не удалось определить длину модели оружия: ' + modelSpec.path);
    }
    var scale = modelSpec.length / axisLength;
    var rotation = new THREE.Quaternion().setFromUnitVectors(sourceAxis, targetAxis);
    var fitted = new THREE.Group();
    fitted.quaternion.copy(rotation);
    fitted.scale.setScalar(scale);
    fitted.position.copy(center).negate().applyQuaternion(rotation).multiplyScalar(scale);
    fitted.add(gltf.scene);
    group.position.z = -modelSpec.length / 2;
    group.add(fitted);
  });
}

function createWeaponViewModel(weapon, weaponId) {
  var group = new THREE.Group();
  group.userData.loadPromise = loadWeaponModel(group, weaponId, weapon);
  group.visible = false;
  return group;
}

// Возвращает общий корень моделей: его нужно добавить в сцену оружия
function createWeaponViewModels() {
  createModelGeometries();
  viewModelData.root = new THREE.Group();
  viewModelData.groups = [];
  viewModelData.handsGroup = new THREE.Group();
  viewModelData.handsGroup.position.set(-0.2, -0.04, -0.16);
  viewModelData.root.add(viewModelData.handsGroup);
  var loading = [loadHandsModel()];
  for (var index = 0; index < WEAPON_ORDER.length; index++) {
    var weaponId = WEAPON_ORDER[index];
    var group = createWeaponViewModel(WEAPONS[weaponId], weaponId);
    viewModelData.groups.push(group);
    viewModelData.root.add(group);
    if (group.userData.loadPromise !== null) {
      loading.push(group.userData.loadPromise);
    }
  }
  viewModelData.ready = Promise.all(loading);
  return viewModelData.root;
}

function showWeaponViewModel(index) {
  for (var groupIndex = 0; groupIndex < viewModelData.groups.length; groupIndex++) {
    viewModelData.groups[groupIndex].visible = (groupIndex === index);
  }
}

// Ставит модель по текущей позе: покачивание при ходьбе, отдача, перезарядка, смена оружия.
// pose — объект viewPose из weapon_system.js.
function applyViewPose(pose) {
  var weapon = WEAPONS[WEAPON_ORDER[pose.weaponIndex]];
  var view = WEAPON_SETTINGS.view;
  var base = weapon.viewModel.position;
  var bobAngle = pose.bobPhase * FULL_CIRCLE;
  var swayX = Math.sin(bobAngle) * view.bobSwayX * pose.bobBlend;
  var liftY = Math.sin(bobAngle * CONFIG.camera.bobBouncesPerCycle) * view.bobLiftY * pose.bobBlend;
  var dip = pose.isReloading ? Math.sin(pose.reloadProgress * Math.PI) : 0;
  var root = viewModelData.root;
  root.position.set(
    base.x + swayX,
    base.y + liftY - dip * view.reloadDip - pose.lower * view.lowerDistance,
    base.z + pose.kick * weapon.viewModel.kickBack
  );
  root.rotation.set(
    pose.kick * weapon.viewModel.kickUp + dip * view.reloadTilt - pose.lower * view.lowerTilt,
    0,
    dip * view.reloadRoll
  );
  root.visible = !pose.isHidden;
}

// ---------- бот: торс, голова, руки, ноги, оружие, метка команды и невидимые хитбоксы ----------

// Ромб-метка и невидимый материал для хитбоксов создаются один раз на всех ботов
function ensureBotModelResources() {
  if (botModelData.markerGeometry !== null) {
    return;
  }
  botModelData.markerGeometry = new THREE.OctahedronGeometry(CONFIG.bots.model.marker.radius);
  botModelData.hitboxMaterial = new THREE.MeshBasicMaterial({ visible: false });
}

// У каждого бота свои материалы: так можно подсвечивать конкретного бота при попадании
function createBotMaterial(model, hexColor) {
  var material = new THREE.MeshLambertMaterial({ color: createLinearColor(hexColor) });
  model.materials.push(material);
  return material;
}

function createScaledBox(material, spec) {
  var mesh = new THREE.Mesh(viewModelData.boxGeometry, material);
  mesh.scale.set(spec.w, spec.h, spec.d);
  mesh.position.set(0, spec.y, 0);
  return mesh;
}

// Конечность вращается вокруг сустава (pivot): сама деталь сдвинута вниз от него на половину длины
function createLimbPivot(material, spec, side) {
  var pivot = new THREE.Group();
  var limb = new THREE.Mesh(viewModelData.boxGeometry, material);
  pivot.position.set(spec.x * side, spec.pivotY, 0);
  limb.scale.set(spec.w, spec.h, spec.d);
  limb.position.set(0, -spec.h / 2, 0);
  pivot.add(limb);
  return pivot;
}

function addBotBodyParts(model, spec, facePath) {
  var weapon = new THREE.Mesh(viewModelData.boxGeometry, createBotMaterial(model, spec.weapon.color));
  weapon.scale.set(spec.weapon.w, spec.weapon.h, spec.weapon.d);
  weapon.position.set(spec.weapon.x, spec.weapon.y, spec.weapon.z);
  var markerMaterial = new THREE.MeshBasicMaterial({ color: spec.marker.color, fog: false });
  var marker = new THREE.Mesh(botModelData.markerGeometry, markerMaterial);
  marker.position.set(0, spec.marker.y, 0);
  model.group.add(createScaledBox(createBotMaterial(model, spec.torso.color), spec.torso));
  model.group.add(createScaledBox(createBotMaterial(model, spec.head.color), spec.head));
  // Бот смотрит вдоль -z, поэтому картинка лица находится на передней стороне головы.
  var faceMaterial = new THREE.MeshBasicMaterial({ map: loadBotFaceTexture(facePath), transparent: true });
  var face = new THREE.Mesh(new THREE.PlaneGeometry(spec.head.w * 0.62, spec.head.h * 0.82), faceMaterial);
  // PlaneGeometry по умолчанию смотрит в +z, а перед головы бота — в -z.
  face.rotation.y = Math.PI;
  face.position.set(0, spec.head.y, -spec.head.d / 2 - 0.002);
  model.group.add(face);
  model.group.add(weapon);
  model.group.add(marker);
}

// Минус — левая сторона бота, плюс — правая (бот смотрит в минус z)
function addBotLimbs(model, spec) {
  var legMaterial = createBotMaterial(model, spec.leg.color);
  var armMaterial = createBotMaterial(model, spec.arm.color);
  model.legLeft = createLimbPivot(legMaterial, spec.leg, -1);
  model.legRight = createLimbPivot(legMaterial, spec.leg, 1);
  model.armLeft = createLimbPivot(armMaterial, spec.arm, -1);
  model.armRight = createLimbPivot(armMaterial, spec.arm, 1);
  model.group.add(model.legLeft);
  model.group.add(model.legRight);
  model.group.add(model.armLeft);
  model.group.add(model.armRight);
}

// Хитбоксы не рисуются, но луч выстрела их находит; название части лежит в userData
function addBotHitboxes(model) {
  var hitboxes = CONFIG.bots.hitboxes;
  var partNames = Object.keys(hitboxes);
  for (var index = 0; index < partNames.length; index++) {
    var spec = hitboxes[partNames[index]];
    var mesh = new THREE.Mesh(viewModelData.boxGeometry, botModelData.hitboxMaterial);
    mesh.scale.set(spec.w, spec.h, spec.d);
    mesh.position.set(0, spec.y, 0);
    mesh.userData.part = partNames[index];
    model.group.add(mesh);
    model.hitboxes.push(mesh);
  }
}

// Возвращает {group, hitboxes[], materials[], legLeft, legRight, armLeft, armRight}; модель скрыта, пока бот не появился
function createBotModel(facePath) {
  createModelGeometries();
  ensureBotModelResources();
  var spec = CONFIG.bots.model;
  var botFacePath = facePath || 'assets/bots/faces/CHUPPA.jpg';
  var model = {
    group: new THREE.Group(),
    hitboxes: [],
    materials: [],
    legLeft: null,
    legRight: null,
    armLeft: null,
    armRight: null
  };
  model.group.rotation.order = 'YXZ'; // сначала поворот по yaw, потом падение
  addBotBodyParts(model, spec, botFacePath);
  addBotLimbs(model, spec);
  addBotHitboxes(model);
  model.group.visible = false;
  return model;
}

// Красноватая подсветка при попадании: glow от 0 до 1
function setBotModelGlow(model, glow) {
  var sideGlow = glow * CONFIG.bots.flashSideRatio;
  for (var index = 0; index < model.materials.length; index++) {
    model.materials[index].emissive.setRGB(glow, sideGlow, sideGlow);
  }
}

// Ставит модель по состоянию бота: положение, поворот, качание ног и рук, падение при смерти
function applyBotPose(bot) {
  var model = bot.model;
  var pose = CONFIG.bots.pose;
  var legSwing = Math.sin(bot.walkPhase * FULL_CIRCLE) * pose.legSwing * bot.walkBlend;
  var armSwing = legSwing * pose.armSwingRatio * (1 - bot.aimBlend);
  var armRaise = bot.aimBlend * pose.armAimAngle;
  model.legLeft.rotation.x = legSwing;
  model.legRight.rotation.x = -legSwing;
  model.armLeft.rotation.x = -armSwing + armRaise;
  model.armRight.rotation.x = armSwing + armRaise;
  model.group.position.set(bot.body.position.x, bot.body.position.y, bot.body.position.z);
  model.group.rotation.set(bot.fallProgress * pose.fallAngle, bot.yaw, 0);
}
