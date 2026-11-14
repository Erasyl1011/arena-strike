var showcaseState = {
  scene: null,
  camera: null,
  objects: [],
  botEntries: [],
  weaponEntries: [],
  botIndex: 0,
  weaponIndex: 0,
  activeKind: '',
  angle: 0,
  radius: 4.5,
  targetY: 1,
  isDragging: false,
  lastPointerX: 0,
  lastPointerY: 0
};

var SHOWCASE_BOTS = [
  { name: 'Мейрамбек', face: 'MEYRAMBEK.jpg', description: 'Опытный боец. Не оставляет противнику времени на передышку.' },
  { name: 'Чуппа', face: 'CHUPPA.jpg', description: 'Быстрый и настойчивый. Всегда ищет путь к цели.' },
  { name: 'Коч', face: 'KOCH.jpg', description: 'Хладнокровный соперник с точной стрельбой.' }
];

function initShowcase() {
  showcaseState.scene = new THREE.Scene();
  showcaseState.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  showcaseState.scene.add(new THREE.AmbientLight(0xffffff, 1.25));
  var keyLight = new THREE.DirectionalLight(0xffd39a, 2.1);
  keyLight.position.set(-3, 6, 5);
  showcaseState.scene.add(keyLight);
  var rimLight = new THREE.DirectionalLight(0x6689ab, 1.4);
  rimLight.position.set(4, 3, -4);
  showcaseState.scene.add(rimLight);
  var plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.9, 0.14, 48),
    new THREE.MeshLambertMaterial({ color: 0x20252b })
  );
  plinth.position.y = -0.1;
  showcaseState.scene.add(plinth);
  var plinthEdge = new THREE.Mesh(
    new THREE.TorusGeometry(0.82, 0.012, 6, 48),
    new THREE.MeshBasicMaterial({ color: 0xffb02e })
  );
  plinthEdge.rotation.x = Math.PI / 2;
  plinthEdge.position.y = -0.02;
  showcaseState.scene.add(plinthEdge);

  for (var botIndex = 0; botIndex < SHOWCASE_BOTS.length; botIndex++) {
    var botModel = createBotModel('assets/bots/faces/' + SHOWCASE_BOTS[botIndex].face);
    botModel.group.visible = true;
    botModel.group.rotation.y = Math.PI;
    showcaseState.scene.add(botModel.group);
    showcaseState.botEntries.push(botModel.group);
  }

  for (var weaponIndex = 0; weaponIndex < WEAPON_ORDER.length; weaponIndex++) {
    var weaponModel = viewModelData.groups[weaponIndex].clone(true);
    weaponModel.visible = true;
    weaponModel.scale.setScalar(2.8);
    weaponModel.rotation.y = Math.PI;
    showcaseState.scene.add(weaponModel);
    showcaseState.weaponEntries.push(weaponModel);
  }
  setShowcaseSelection('bot', 0);
  bindShowcaseEvents();
}

function bindShowcaseEvents() {
  document.getElementById('button-open-bots').addEventListener('click', function () { openShowcase('bot'); });
  document.getElementById('button-open-weapons').addEventListener('click', function () { openShowcase('weapon'); });
  document.getElementById('button-bot-play').addEventListener('click', onLockButtonClick);
  document.getElementById('button-weapon-play').addEventListener('click', onLockButtonClick);
  document.getElementById('bot-previous').addEventListener('click', function () { stepShowcase('bot', -1); });
  document.getElementById('bot-next').addEventListener('click', function () { stepShowcase('bot', 1); });
  document.getElementById('weapon-previous').addEventListener('click', function () { stepShowcase('weapon', -1); });
  document.getElementById('weapon-next').addEventListener('click', function () { stepShowcase('weapon', 1); });
  var backButtons = document.querySelectorAll('[data-showcase-back]');
  for (var index = 0; index < backButtons.length; index++) {
    backButtons[index].addEventListener('click', function () { showScreen('screen-start'); });
  }
  bindPreviewInput(document.getElementById('bot-preview-window'));
  bindPreviewInput(document.getElementById('weapon-preview-window'));
}

function bindPreviewInput(element) {
  element.addEventListener('pointerdown', function (event) {
    showcaseState.isDragging = true;
    showcaseState.lastPointerX = event.clientX;
    showcaseState.lastPointerY = event.clientY;
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener('pointermove', function (event) {
    if (!showcaseState.isDragging) return;
    showcaseState.angle += (event.clientX - showcaseState.lastPointerX) * 0.012;
    showcaseState.targetY = clampValue(showcaseState.targetY + (showcaseState.lastPointerY - event.clientY) * 0.008, 0.4, 1.8);
    showcaseState.lastPointerX = event.clientX;
    showcaseState.lastPointerY = event.clientY;
  });
  element.addEventListener('pointerup', function () { showcaseState.isDragging = false; });
  element.addEventListener('pointercancel', function () { showcaseState.isDragging = false; });
  element.addEventListener('wheel', function (event) {
    event.preventDefault();
    showcaseState.radius = clampValue(showcaseState.radius + event.deltaY * 0.004, 2.4, 7);
  }, { passive: false });
}

function openShowcase(kind) {
  showcaseState.activeKind = kind;
  showcaseState.angle = 0;
  showcaseState.radius = kind === 'bot' ? 4.6 : 3.4;
  showcaseState.targetY = kind === 'bot' ? 1 : 0;
  showScreen(kind === 'bot' ? 'screen-bots' : 'screen-weapons');
  setShowcaseSelection(kind, kind === 'bot' ? showcaseState.botIndex : showcaseState.weaponIndex);
}

function stepShowcase(kind, direction) {
  var count = kind === 'bot' ? showcaseState.botEntries.length : showcaseState.weaponEntries.length;
  var index = kind === 'bot' ? showcaseState.botIndex : showcaseState.weaponIndex;
  setShowcaseSelection(kind, (index + direction + count) % count);
}

function setShowcaseSelection(kind, index) {
  var entries = kind === 'bot' ? showcaseState.botEntries : showcaseState.weaponEntries;
  for (var entryIndex = 0; entryIndex < entries.length; entryIndex++) {
    entries[entryIndex].visible = entryIndex === index;
  }
  if (kind === 'bot') {
    showcaseState.botIndex = index;
    document.getElementById('bot-name').textContent = SHOWCASE_BOTS[index].name;
    document.getElementById('bot-description').textContent = SHOWCASE_BOTS[index].description;
    document.getElementById('bot-counter').textContent = padShowcaseNumber(index + 1) + ' / ' + padShowcaseNumber(entries.length);
  } else {
    showcaseState.weaponIndex = index;
    var weapon = WEAPONS[WEAPON_ORDER[index]];
    document.getElementById('weapon-name').textContent = weapon.name;
    var descriptions = {
      knife: 'Бесшумное оружие ближнего боя.',
      shotgun: 'Мощный выстрел дробью на короткой дистанции.',
      sniper: 'Высокая точность и большой урон на дальней дистанции.'
    };
    document.getElementById('weapon-description').textContent = descriptions[weapon.id] || (weapon.isAutomatic ? 'Автоматический огонь для уверенного контроля дистанции.' : 'Точный одиночный огонь. Выбирай момент для выстрела.');
    document.getElementById('weapon-damage').textContent = weapon.damage;
    document.getElementById('weapon-magazine').textContent = weapon.isMelee ? '—' : weapon.magazineSize;
    document.getElementById('weapon-reload').textContent = weapon.isMelee ? '—' : weapon.reloadSeconds.toFixed(1) + ' s';
    document.getElementById('weapon-price').textContent = weapon.price === 0 ? 'FREE' : '$' + weapon.price;
    document.getElementById('weapon-counter').textContent = padShowcaseNumber(index + 1) + ' / ' + padShowcaseNumber(entries.length);
  }
}

function padShowcaseNumber(value) {
  return value < 10 ? '0' + value : String(value);
}

function renderShowcasePreview(renderer) {
  if (!showcaseState.scene || (gameState.current !== GAME_STATE.MENU && gameState.current !== GAME_STATE.MATCH_END)) return;
  var windowId = showcaseState.activeKind === 'bot' ? 'bot-preview-window' : 'weapon-preview-window';
  var previewWindow = document.getElementById(windowId);
  if (!previewWindow || previewWindow.closest('[hidden]')) return;
  var rect = previewWindow.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  if (!showcaseState.isDragging) showcaseState.angle += 0.0015;
  showcaseState.camera.aspect = rect.width / rect.height;
  showcaseState.camera.updateProjectionMatrix();
  showcaseState.camera.position.set(
    Math.sin(showcaseState.angle) * showcaseState.radius,
    showcaseState.targetY + (showcaseState.activeKind === 'bot' ? 0.35 : 0.45),
    Math.cos(showcaseState.angle) * showcaseState.radius
  );
  showcaseState.camera.lookAt(0, showcaseState.targetY, 0);
  renderer.clearDepth();
  renderer.setViewport(rect.left, window.innerHeight - rect.bottom, rect.width, rect.height);
  renderer.setScissor(rect.left, window.innerHeight - rect.bottom, rect.width, rect.height);
  renderer.setScissorTest(true);
  renderer.render(showcaseState.scene, showcaseState.camera);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
}
