// Роль: карта «Пыльный двор» — данные (боксы, зоны появления, waypoints), сборка уровня и запросы для других модулей.

var TEAM = {
  PLAYER: 'player',
  BOTS: 'bots'
};

var VECTOR_COMPONENTS = 3;
var UV_COMPONENTS = 2;
var FACE_CORNERS = 4;
var PARALLEL_EPSILON = 0.000001;

// Координаты: x, y, z — центр бокса, w, h, d — размеры по осям x, y, z. Арена 60x60 м с центром в (0, 0).
// Север — минус z. База игрока на юге, база ботов на севере. Карта симметрична при повороте на 180°.
// Высоты подобраны под достижимость игрока (прыжок ~0.96 м + шаг 0.4 м = ~1.36 м): ящики не выше 1.6 м,
// всё остальное выше 3 м, поэтому по цепочке ящиков залезть на стены и блоки нельзя.
var mapData = {
  name: 'Пыльный двор',
  bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 },
  floorTexture: 'sand',
  floorMargin: 1,
  navigation: { maxLinkDistance: 16, clearance: 0.5 },
  debug: { height: 0.3, pointSize: 10, pointColor: 0xffb02e, lineColor: 0x4fd1ff, renderOrder: 10 },

  boxes: [
    // Внешние стены
    { x: 0, y: 3, z: -30.5, w: 62, h: 6, d: 1, texture: 'concrete' },
    { x: 0, y: 3, z: 30.5, w: 62, h: 6, d: 1, texture: 'concrete' },
    { x: -30.5, y: 3, z: 0, w: 1, h: 6, d: 60, texture: 'concrete' },
    { x: 30.5, y: 3, z: 0, w: 1, h: 6, d: 60, texture: 'concrete' },

    // Стены боковых коридоров (окно шириной 6 м в середине) и стены баз (ворота шириной 12 м)
    { x: -22.5, y: 2, z: -9.25, w: 1, h: 4, d: 12.5, texture: 'brick' },
    { x: -22.5, y: 2, z: 9.25, w: 1, h: 4, d: 12.5, texture: 'brick' },
    { x: 22.5, y: 2, z: -9.25, w: 1, h: 4, d: 12.5, texture: 'brick' },
    { x: 22.5, y: 2, z: 9.25, w: 1, h: 4, d: 12.5, texture: 'brick' },
    { x: -14.5, y: 2, z: 16, w: 17, h: 4, d: 1, texture: 'brick' },
    { x: 14.5, y: 2, z: 16, w: 17, h: 4, d: 1, texture: 'brick' },
    { x: -14.5, y: 2, z: -16, w: 17, h: 4, d: 1, texture: 'brick' },
    { x: 14.5, y: 2, z: -16, w: 17, h: 4, d: 1, texture: 'brick' },

    // Низкие платформы: 0.4 м проходятся без прыжка, на 0.8 м ведёт ступенька 0.4 м
    { x: 0, y: 0.2, z: 0, w: 10, h: 0.4, d: 6, texture: 'concrete' },
    { x: -12, y: 0.4, z: -10, w: 6, h: 0.8, d: 4, texture: 'concrete' },
    { x: -12, y: 0.2, z: -7.2, w: 3, h: 0.4, d: 1.6, texture: 'concrete' },
    { x: 12, y: 0.4, z: 10, w: 6, h: 0.8, d: 4, texture: 'concrete' },
    { x: 12, y: 0.2, z: 7.2, w: 3, h: 0.4, d: 1.6, texture: 'concrete' },
    { x: -22, y: 0.2, z: 24, w: 6, h: 0.4, d: 6, texture: 'concrete' },
    { x: 22, y: 0.2, z: -24, w: 6, h: 0.4, d: 6, texture: 'concrete' },

    // Металлические блоки 3.2 м: перекрывают линии обзора в центре
    { x: -12, y: 1.6, z: -1.5, w: 2.5, h: 3.2, d: 7, texture: 'metal' },
    { x: 12, y: 1.6, z: 1.5, w: 2.5, h: 3.2, d: 7, texture: 'metal' },

    // Укрытия-ящики (два на центральной платформе)
    { x: -8, y: 0.6, z: 3, w: 2, h: 1.2, d: 2, texture: 'crate' },
    { x: 8, y: 0.6, z: -3, w: 2, h: 1.2, d: 2, texture: 'crate' },
    { x: -4, y: 0.8, z: -9, w: 2.5, h: 1.6, d: 1.5, texture: 'crate' },
    { x: 4, y: 0.8, z: 9, w: 2.5, h: 1.6, d: 1.5, texture: 'crate' },
    { x: -15, y: 0.6, z: 11, w: 2, h: 1.2, d: 2, texture: 'crate' },
    { x: 15, y: 0.6, z: -11, w: 2, h: 1.2, d: 2, texture: 'crate' },
    { x: -13, y: 0.8, z: 22, w: 2, h: 1.6, d: 2, texture: 'crate' },
    { x: 13, y: 0.8, z: -22, w: 2, h: 1.6, d: 2, texture: 'crate' },
    { x: 11, y: 0.6, z: 25, w: 1.5, h: 1.2, d: 1.5, texture: 'crate' },
    { x: -11, y: 0.6, z: -25, w: 1.5, h: 1.2, d: 1.5, texture: 'crate' },
    { x: -26.5, y: 0.6, z: 9, w: 2, h: 1.2, d: 2, texture: 'crate' },
    { x: 26.5, y: 0.6, z: -9, w: 2, h: 1.2, d: 2, texture: 'crate' },
    { x: -2.5, y: 1, z: 0, w: 1.5, h: 1.2, d: 1.5, texture: 'crate' },
    { x: 2.5, y: 1, z: 0, w: 1.5, h: 1.2, d: 1.5, texture: 'crate' }
  ],

  // Зоны появления команд; ключи совпадают со значениями TEAM
  spawnZones: {
    player: { minX: -8, maxX: 8, minZ: 23, maxZ: 28, yawDegrees: 0 },
    bots: { minX: -8, maxX: 8, minZ: -28, maxZ: -23, yawDegrees: 180 }
  },

  // Только позиции: связи (поле links) строятся при загрузке по проходимости между точками
  waypoints: [
    // 0-8: южная база (последняя точка — ворота)
    { x: 0, z: 24 }, { x: -12, z: 19 }, { x: 12, z: 19 }, { x: 0, z: 19 }, { x: -16, z: 26 },
    { x: 16, z: 26 }, { x: -26.5, z: 20 }, { x: 26.5, z: 20 }, { x: 0, z: 16 },
    // 9-17: северная база
    { x: 0, z: -24 }, { x: 12, z: -19 }, { x: -12, z: -19 }, { x: 0, z: -19 }, { x: 16, z: -26 },
    { x: -16, z: -26 }, { x: 26.5, z: -20 }, { x: -26.5, z: -20 }, { x: 0, z: -16 },
    // 18-33: центр (последние две — окна в боковые коридоры)
    { x: 0, z: 11 }, { x: 0, z: -11 }, { x: -16, z: 5 }, { x: 16, z: -5 }, { x: -8, z: -1 }, { x: 8, z: 1 },
    { x: 0, z: 6 }, { x: 0, z: -6 }, { x: -6, z: -13 }, { x: 6, z: 13 }, { x: -18, z: -8 }, { x: 18, z: 8 },
    { x: -18, z: 8 }, { x: 18, z: -8 }, { x: -19, z: 0 }, { x: 19, z: 0 },
    // 34-39: западный коридор, 40-45: восточный коридор
    { x: -24.25, z: 13 }, { x: -24.25, z: 9 }, { x: -24.25, z: 5 }, { x: -26.5, z: 0 }, { x: -26.5, z: -5 }, { x: -26.5, z: -12 },
    { x: 24.25, z: -13 }, { x: 24.25, z: -9 }, { x: 24.25, z: -5 }, { x: 26.5, z: 0 }, { x: 26.5, z: 5 }, { x: 26.5, z: 12 }
  ],

  materials: {},
  wallMeshes: [],
  floorMesh: null,
  debugGroup: null
};

var dust2MapModel = null;
var DUST2_MODEL_PATH = 'assets/maps/de_dust2.glb';
var DUST2_MODEL_SCALE = 1.6;

function loadDust2MapModel() {
  return new Promise(function (resolve, reject) {
    new THREE.GLTFLoader().load(DUST2_MODEL_PATH, function (gltf) {
      dust2MapModel = gltf.scene;
      dust2MapModel.rotation.x = -Math.PI / 2;
      dust2MapModel.scale.setScalar(DUST2_MODEL_SCALE);
      dust2MapModel.updateMatrixWorld(true);
      mapData.name = 'Dust II';
      mapData.boxes = [];
      mapData.wallMeshes = [];
      dust2MapModel.traverse(function (object) {
        if (!object.isMesh || !object.geometry) return;
        object.geometry.computeBoundingBox();
        var bounds = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
        // GLB contains a few flat floor pieces; leave those to the existing floor collider.
        if (bounds.max.y - bounds.min.y < 0.55) return;
        var box = {
          x: (bounds.min.x + bounds.max.x) / 2,
          y: (bounds.min.y + bounds.max.y) / 2,
          z: (bounds.min.z + bounds.max.z) / 2,
          w: Math.max(0.12, bounds.max.x - bounds.min.x),
          h: Math.max(0.12, bounds.max.y - bounds.min.y),
          d: Math.max(0.12, bounds.max.z - bounds.min.z),
          texture: 'concrete'
        };
        mapData.boxes.push(box);
        mapData.wallMeshes.push(object);
      });
      // Keep combat and bot navigation inside the model's footprint.
      mapData.bounds = { minX: -29, maxX: 29, minZ: -29, maxZ: 29 };
      mapData.spawnZones.player = { minX: -4, maxX: 4, minZ: 22, maxZ: 26, yawDegrees: 0 };
      mapData.spawnZones.bots = { minX: -4, maxX: 4, minZ: -26, maxZ: -22, yawDegrees: 180 };
      resolve();
    }, undefined, reject);
  });
}

// Служебный отрезок для проверок видимости и проходимости (не создаём новые объекты в каждом вызове)
var segmentScratch = {
  fromX: 0,
  fromY: 0,
  fromZ: 0,
  dirX: 0,
  dirY: 0,
  dirZ: 0,
  tMin: 0,
  tMax: 1
};

// Грани бокса: угол-начало (0 — минимум, 1 — максимум по оси) и два направления u и v.
// Векторное произведение u × v даёт наружную нормаль, поэтому грани видны снаружи.
var BOX_FACES = [
  { originX: 1, originY: 0, originZ: 1, uX: 0, uY: 0, uZ: -1, vX: 0, vY: 1, vZ: 0 }, // +X
  { originX: 0, originY: 0, originZ: 0, uX: 0, uY: 0, uZ: 1, vX: 0, vY: 1, vZ: 0 }, // -X
  { originX: 0, originY: 1, originZ: 1, uX: 1, uY: 0, uZ: 0, vX: 0, vY: 0, vZ: -1 }, // +Y (верх)
  { originX: 0, originY: 0, originZ: 0, uX: 1, uY: 0, uZ: 0, vX: 0, vY: 0, vZ: 1 }, // -Y (низ)
  { originX: 0, originY: 0, originZ: 1, uX: 1, uY: 0, uZ: 0, vX: 0, vY: 1, vZ: 0 }, // +Z
  { originX: 1, originY: 0, originZ: 0, uX: -1, uY: 0, uZ: 0, vX: 0, vY: 1, vZ: 0 } // -Z
];

// ---------- подготовка данных ----------

// Границы считает addBoxBounds из player.js (вызывается уже во время работы, когда все скрипты загружены)
function prepareBoxes() {
  for (var index = 0; index < mapData.boxes.length; index++) {
    var box = mapData.boxes[index];
    addBoxBounds(box);
    if (CONFIG.textures.tileMeters[box.texture] === undefined) {
      console.warn('Бокс ' + index + ': неизвестная текстура ' + box.texture);
    }
  }
}

// Для ходьбы мешают боксы выше высоты шага и ниже макушки игрока
function isBlockingForWalking(box) {
  return box.maxY > CONFIG.player.maxStepHeight && box.minY < CONFIG.player.standingHeight;
}

// ---------- пересечение отрезка с боксами ----------

function setSegment(fromX, fromY, fromZ, toX, toY, toZ) {
  segmentScratch.fromX = fromX;
  segmentScratch.fromY = fromY;
  segmentScratch.fromZ = fromZ;
  segmentScratch.dirX = toX - fromX;
  segmentScratch.dirY = toY - fromY;
  segmentScratch.dirZ = toZ - fromZ;
}

// Сужает допустимый участок отрезка (tMin..tMax) плитой между slabMin и slabMax по одной оси
function clipSegmentToSlab(start, direction, slabMin, slabMax) {
  if (Math.abs(direction) < PARALLEL_EPSILON) {
    return start >= slabMin && start <= slabMax;
  }
  var tFirst = (slabMin - start) / direction;
  var tSecond = (slabMax - start) / direction;
  segmentScratch.tMin = Math.max(segmentScratch.tMin, Math.min(tFirst, tSecond));
  segmentScratch.tMax = Math.min(segmentScratch.tMax, Math.max(tFirst, tSecond));
  return segmentScratch.tMin <= segmentScratch.tMax;
}

function doesSegmentHitBox(box) {
  segmentScratch.tMin = 0;
  segmentScratch.tMax = 1;
  return clipSegmentToSlab(segmentScratch.fromX, segmentScratch.dirX, box.minX, box.maxX) &&
    clipSegmentToSlab(segmentScratch.fromY, segmentScratch.dirY, box.minY, box.maxY) &&
    clipSegmentToSlab(segmentScratch.fromZ, segmentScratch.dirZ, box.minZ, box.maxZ);
}

// Для проходимости бокс «раздувается» на запас вокруг тела, высота не учитывается
function doesWalkSegmentHitBox(box) {
  var clearance = mapData.navigation.clearance;
  segmentScratch.tMin = 0;
  segmentScratch.tMax = 1;
  return clipSegmentToSlab(segmentScratch.fromX, segmentScratch.dirX, box.minX - clearance, box.maxX + clearance) &&
    clipSegmentToSlab(segmentScratch.fromZ, segmentScratch.dirZ, box.minZ - clearance, box.maxZ + clearance);
}

// Прямая видимость между двумя точками: true, если ни один бокс не пересекает отрезок
function isLineOfSightClear(fromX, fromY, fromZ, toX, toY, toZ) {
  setSegment(fromX, fromY, fromZ, toX, toY, toZ);
  for (var index = 0; index < mapData.boxes.length; index++) {
    if (doesSegmentHitBox(mapData.boxes[index])) {
      return false;
    }
  }
  return true;
}

// Можно ли пройти по прямой между двумя точками на полу, не задев препятствия
function isWalkSegmentClear(fromX, fromZ, toX, toZ) {
  setSegment(fromX, 0, fromZ, toX, 0, toZ);
  for (var index = 0; index < mapData.boxes.length; index++) {
    var box = mapData.boxes[index];
    if (isBlockingForWalking(box) && doesWalkSegmentHitBox(box)) {
      return false;
    }
  }
  return true;
}

function isPointWalkable(x, z) {
  var clearance = mapData.navigation.clearance;
  for (var index = 0; index < mapData.boxes.length; index++) {
    var box = mapData.boxes[index];
    var isInside = x > box.minX - clearance && x < box.maxX + clearance &&
      z > box.minZ - clearance && z < box.maxZ + clearance;
    if (isBlockingForWalking(box) && isInside) {
      return false;
    }
  }
  return true;
}

// ---------- waypoints ----------

function connectWaypointsIfClear(indexA, indexB) {
  var pointA = mapData.waypoints[indexA];
  var pointB = mapData.waypoints[indexB];
  var distanceX = pointB.x - pointA.x;
  var distanceZ = pointB.z - pointA.z;
  var distance = Math.sqrt(distanceX * distanceX + distanceZ * distanceZ);
  if (distance > mapData.navigation.maxLinkDistance) {
    return;
  }
  if (!isWalkSegmentClear(pointA.x, pointA.z, pointB.x, pointB.z)) {
    return;
  }
  pointA.links.push(indexB);
  pointB.links.push(indexA);
}

function buildWaypointLinks() {
  var waypoints = mapData.waypoints;
  for (var index = 0; index < waypoints.length; index++) {
    waypoints[index].links = [];
  }
  for (var first = 0; first < waypoints.length; first++) {
    for (var second = first + 1; second < waypoints.length; second++) {
      connectWaypointsIfClear(first, second);
    }
  }
}

function createVisitedList(count) {
  var visited = [];
  for (var index = 0; index < count; index++) {
    visited.push(false);
  }
  return visited;
}

// Обход графа в глубину из первой точки: все ли waypoints достижимы
function isWaypointGraphConnected() {
  var waypoints = mapData.waypoints;
  if (waypoints.length === 0) {
    return true;
  }
  var visited = createVisitedList(waypoints.length);
  var stack = [0];
  var visitedCount = 1;
  visited[0] = true;
  while (stack.length > 0) {
    var links = waypoints[stack.pop()].links;
    for (var linkIndex = 0; linkIndex < links.length; linkIndex++) {
      var next = links[linkIndex];
      if (!visited[next]) {
        visited[next] = true;
        visitedCount += 1;
        stack.push(next);
      }
    }
  }
  return visitedCount === waypoints.length;
}

// Проверки для разработчика: предупреждения появляются в консоли, игра при этом продолжает работать
function validateWaypoints() {
  var waypoints = mapData.waypoints;
  for (var index = 0; index < waypoints.length; index++) {
    if (!isPointWalkable(waypoints[index].x, waypoints[index].z)) {
      console.warn('Waypoint ' + index + ' стоит слишком близко к препятствию');
    }
  }
  if (!isWaypointGraphConnected()) {
    console.warn('Граф waypoints не связный: часть карты недостижима для ботов');
  }
}

function initMapData() {
  prepareBoxes();
  buildWaypointLinks();
  validateWaypoints();
}

// ---------- запросы для других модулей ----------

function getWallMeshes() {
  return mapData.wallMeshes;
}

function getWaypointCount() {
  return mapData.waypoints.length;
}

// Возвращает объект {x, z, links}; links — номера соседних waypoints
function getWaypoint(index) {
  return mapData.waypoints[index];
}

function getWaypointNeighbors(index) {
  return mapData.waypoints[index].links;
}

function findNearestWaypointIndex(x, z) {
  var bestIndex = 0;
  var bestDistance = Infinity;
  for (var index = 0; index < mapData.waypoints.length; index++) {
    var distanceX = mapData.waypoints[index].x - x;
    var distanceZ = mapData.waypoints[index].z - z;
    var distanceSquared = distanceX * distanceX + distanceZ * distanceZ;
    if (distanceSquared < bestDistance) {
      bestDistance = distanceSquared;
      bestIndex = index;
    }
  }
  return bestIndex;
}

// team — TEAM.PLAYER или TEAM.BOTS. Возвращает новый объект {x, y, z, yawDegrees}
function getRandomSpawnPoint(team) {
  var zone = mapData.spawnZones[team];
  return {
    x: zone.minX + Math.random() * (zone.maxX - zone.minX),
    y: CONFIG.physics.floorHeight,
    z: zone.minZ + Math.random() * (zone.maxZ - zone.minZ),
    yawDegrees: zone.yawDegrees
  };
}

// ---------- сборка геометрии ----------

function createGeometryArrays() {
  return { positions: [], normals: [], uvs: [], indices: [] };
}

function getFaceLength(box, axisX, axisY, axisZ) {
  return Math.abs(axisX) * (box.maxX - box.minX) +
    Math.abs(axisY) * (box.maxY - box.minY) +
    Math.abs(axisZ) * (box.maxZ - box.minZ);
}

// Нижнюю грань боксов, стоящих на полу, не строим: её никто не увидит
function shouldSkipFace(box, face) {
  var normalY = face.uZ * face.vX - face.uX * face.vZ;
  return normalY < 0 && box.minY <= CONFIG.physics.floorHeight + CONFIG.physics.contactEpsilon;
}

function appendFaceNormals(arrays, face) {
  var normalX = face.uY * face.vZ - face.uZ * face.vY;
  var normalY = face.uZ * face.vX - face.uX * face.vZ;
  var normalZ = face.uX * face.vY - face.uY * face.vX;
  for (var corner = 0; corner < FACE_CORNERS; corner++) {
    arrays.normals.push(normalX, normalY, normalZ);
  }
}

function appendFaceCorner(arrays, x, y, z, u, v) {
  arrays.positions.push(x, y, z);
  arrays.uvs.push(u, v);
}

// Текстурные координаты считаются в метрах, поэтому текстура одинакова по размеру на любом боксе
function appendFace(arrays, box, face, tileMeters) {
  var uLength = getFaceLength(box, face.uX, face.uY, face.uZ);
  var vLength = getFaceLength(box, face.vX, face.vY, face.vZ);
  var cornerX = face.originX ? box.maxX : box.minX;
  var cornerY = face.originY ? box.maxY : box.minY;
  var cornerZ = face.originZ ? box.maxZ : box.minZ;
  var uStepX = face.uX * uLength;
  var uStepY = face.uY * uLength;
  var uStepZ = face.uZ * uLength;
  var vStepX = face.vX * vLength;
  var vStepY = face.vY * vLength;
  var vStepZ = face.vZ * vLength;
  var startIndex = arrays.positions.length / VECTOR_COMPONENTS;
  var maxU = uLength / tileMeters;
  var maxV = vLength / tileMeters;
  appendFaceCorner(arrays, cornerX, cornerY, cornerZ, 0, 0);
  appendFaceCorner(arrays, cornerX + uStepX, cornerY + uStepY, cornerZ + uStepZ, maxU, 0);
  appendFaceCorner(arrays, cornerX + uStepX + vStepX, cornerY + uStepY + vStepY, cornerZ + uStepZ + vStepZ, maxU, maxV);
  appendFaceCorner(arrays, cornerX + vStepX, cornerY + vStepY, cornerZ + vStepZ, 0, maxV);
  appendFaceNormals(arrays, face);
  arrays.indices.push(startIndex, startIndex + 1, startIndex + 2, startIndex, startIndex + 2, startIndex + 3);
}

// Все боксы списка сливаются в одну геометрию: один меш = один вызов отрисовки
function buildBoxGeometry(boxList, tileMeters) {
  var arrays = createGeometryArrays();
  for (var boxIndex = 0; boxIndex < boxList.length; boxIndex++) {
    for (var faceIndex = 0; faceIndex < BOX_FACES.length; faceIndex++) {
      if (!shouldSkipFace(boxList[boxIndex], BOX_FACES[faceIndex])) {
        appendFace(arrays, boxList[boxIndex], BOX_FACES[faceIndex], tileMeters);
      }
    }
  }
  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(arrays.positions, VECTOR_COMPONENTS));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(arrays.normals, VECTOR_COMPONENTS));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(arrays.uvs, UV_COMPONENTS));
  geometry.setIndex(arrays.indices);
  return geometry;
}

function groupBoxesByTexture() {
  var groups = {};
  for (var index = 0; index < mapData.boxes.length; index++) {
    var box = mapData.boxes[index];
    if (groups[box.texture] === undefined) {
      groups[box.texture] = [];
    }
    groups[box.texture].push(box);
  }
  return groups;
}

function getMapMaterial(textureName) {
  if (mapData.materials[textureName] === undefined) {
    mapData.materials[textureName] = new THREE.MeshLambertMaterial({ map: getTexture(textureName) });
  }
  return mapData.materials[textureName];
}

function buildWallMeshes(scene, shadowsEnabled) {
  var groups = groupBoxesByTexture();
  var textureNames = Object.keys(groups);
  for (var index = 0; index < textureNames.length; index++) {
    var name = textureNames[index];
    var geometry = buildBoxGeometry(groups[name], CONFIG.textures.tileMeters[name]);
    var mesh = new THREE.Mesh(geometry, getMapMaterial(name));
    mesh.castShadow = shadowsEnabled;
    mesh.receiveShadow = shadowsEnabled;
    scene.add(mesh);
    mapData.wallMeshes.push(mesh);
  }
}

function scaleGeometryUv(geometry, scaleU, scaleV) {
  var uv = geometry.attributes.uv;
  for (var index = 0; index < uv.count; index++) {
    uv.setXY(index, uv.getX(index) * scaleU, uv.getY(index) * scaleV);
  }
}

function buildFloor(scene, shadowsEnabled) {
  var bounds = mapData.bounds;
  var width = bounds.maxX - bounds.minX + mapData.floorMargin * 2;
  var depth = bounds.maxZ - bounds.minZ + mapData.floorMargin * 2;
  var tileMeters = CONFIG.textures.tileMeters[mapData.floorTexture];
  var geometry = new THREE.PlaneGeometry(width, depth);
  geometry.rotateX(-Math.PI / 2);
  scaleGeometryUv(geometry, width / tileMeters, depth / tileMeters);
  var floor = new THREE.Mesh(geometry, getMapMaterial(mapData.floorTexture));
  floor.position.set(
    (bounds.minX + bounds.maxX) / 2,
    CONFIG.physics.floorHeight,
    (bounds.minZ + bounds.maxZ) / 2
  );
  floor.receiveShadow = shadowsEnabled;
  scene.add(floor);
  mapData.floorMesh = floor;
}

// ---------- отладка: waypoints и связи (клавиша F4) ----------

function buildDebugPoints() {
  var positions = [];
  for (var index = 0; index < mapData.waypoints.length; index++) {
    positions.push(mapData.waypoints[index].x, mapData.debug.height, mapData.waypoints[index].z);
  }
  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, VECTOR_COMPONENTS));
  var material = new THREE.PointsMaterial({
    color: mapData.debug.pointColor,
    size: mapData.debug.pointSize,
    sizeAttenuation: false,
    depthTest: false,
    fog: false
  });
  var points = new THREE.Points(geometry, material);
  points.renderOrder = mapData.debug.renderOrder;
  return points;
}

// Каждая связь добавляется один раз (только от меньшего номера к большему)
function buildDebugLines() {
  var positions = [];
  var height = mapData.debug.height;
  for (var index = 0; index < mapData.waypoints.length; index++) {
    var point = mapData.waypoints[index];
    for (var linkIndex = 0; linkIndex < point.links.length; linkIndex++) {
      var neighbor = mapData.waypoints[point.links[linkIndex]];
      if (point.links[linkIndex] > index) {
        positions.push(point.x, height, point.z, neighbor.x, height, neighbor.z);
      }
    }
  }
  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, VECTOR_COMPONENTS));
  var material = new THREE.LineBasicMaterial({ color: mapData.debug.lineColor, depthTest: false, fog: false });
  var lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = mapData.debug.renderOrder;
  return lines;
}

function buildDebugGroup(scene) {
  var group = new THREE.Group();
  group.add(buildDebugLines());
  group.add(buildDebugPoints());
  group.visible = false;
  scene.add(group);
  mapData.debugGroup = group;
}

function toggleMapDebug() {
  if (mapData.debugGroup !== null) {
    mapData.debugGroup.visible = !mapData.debugGroup.visible;
  }
}

// ---------- сборка уровня ----------

// Вызывается после initMapData() и после создания текстур
function buildLevel(scene, shadowsEnabled) {
  if (dust2MapModel !== null) {
    scene.add(dust2MapModel);
    dust2MapModel.traverse(function (object) {
      if (object.isMesh) {
        object.castShadow = shadowsEnabled;
        object.receiveShadow = shadowsEnabled;
      }
    });
    buildDebugGroup(scene);
    return;
  }
  buildFloor(scene, shadowsEnabled);
  buildWallMeshes(scene, shadowsEnabled);
  buildDebugGroup(scene);
}
