// Роль: запуск игры — загрузка, инициализация Three.js, уровень, оружие, боты, игровой цикл, счётчик FPS.

var COLOR_COMPONENT_COUNT = 3; // r, g, b

var engine = {
  canvas: null,
  renderer: null,
  scene: null,
  camera: null,
  weaponScene: null,
  weaponCamera: null,
  sky: null,
  sun: null,
  nextTextureIndex: 0,
  lastFrameTime: 0,
  accumulator: 0,
  fpsFrames: 0,
  fpsTimer: 0,
  fpsElement: null,
  progressBar: null,
  progressFill: null,
  loadingLabel: null,
  loadingStepIndex: 0,
  isDeathShown: false
};

var loadingSteps = buildLoadingSteps();

// Каждая текстура — отдельный шаг загрузки, поэтому прогресс-бар показывает реальную работу
function buildLoadingSteps() {
  var steps = [
    { label: 'графика', run: createRenderer },
    { label: 'сцена', run: createScene },
    { label: 'камера', run: createCamera },
    { label: 'небо', run: createSky },
    { label: 'освещение', run: createLights }
  ];
  for (var index = 0; index < getTextureCount(); index++) {
    steps.push({ label: 'текстура (' + getTextureTitle(index) + ')', run: createNextTexture });
  }
  steps.push({ label: 'данные карты', run: createMapData });
  steps.push({ label: 'уровень', run: createLevel });
  steps.push({ label: 'оружие', run: createWeaponView });
  steps.push({ label: 'эффекты', run: createEffects });
  steps.push({ label: 'система оружия', run: createWeaponSystem });
  steps.push({ label: 'боты', run: createBots });
  steps.push({ label: 'игрок', run: createPlayer });
  steps.push({ label: 'управление', run: bindEvents });
  return steps;
}

// ---------- запуск и загрузка ----------

function startApplication() {
  cacheDomElements();
  applyGameTitle();
  var problem = checkRequirements();
  if (problem !== '') {
    showFatalError(problem);
    return;
  }
  loadSettings();
  applyFpsVisibility();
  runNextLoadingStep();
}

function cacheDomElements() {
  engine.canvas = document.getElementById('game-canvas');
  engine.fpsElement = document.getElementById('fps-counter');
  engine.progressBar = document.getElementById('loading-progress');
  engine.progressFill = document.getElementById('loading-progress-fill');
  engine.loadingLabel = document.getElementById('loading-label');
}

function applyGameTitle() {
  document.title = CONFIG.gameTitle;
  var titleElements = document.getElementsByClassName('js-game-title');
  for (var index = 0; index < titleElements.length; index++) {
    titleElements[index].textContent = CONFIG.gameTitle;
  }
}

function checkRequirements() {
  if (typeof THREE === 'undefined') {
    return CONFIG.text.errorNoThree;
  }
  if (THREE.REVISION !== CONFIG.threeRevision) {
    return CONFIG.text.errorWrongThree + THREE.REVISION;
  }
  return '';
}

function showFatalError(message) {
  engine.loadingLabel.textContent = message;
  engine.loadingLabel.classList.add('screen-text-error');
}

function showLoadingProgress(stepLabel) {
  var percent = Math.round(engine.loadingStepIndex / loadingSteps.length * PERCENT_MAX);
  engine.progressFill.style.width = percent + '%';
  engine.progressBar.setAttribute('aria-valuenow', String(percent));
  engine.loadingLabel.textContent = CONFIG.text.loadingPrefix + stepLabel;
}

// Шаги идут через setTimeout, чтобы браузер успевал перерисовать прогресс-бар
function runNextLoadingStep() {
  if (engine.loadingStepIndex >= loadingSteps.length) {
    finishLoading();
    return;
  }
  var step = loadingSteps[engine.loadingStepIndex];
  var result;
  try {
    result = step.run();
  } catch (error) {
    failLoadingStep(error);
    return;
  }

  if (result && typeof result.then === 'function') {
    showLoadingProgress(step.label);
    result.then(function () {
      completeLoadingStep(step);
    }).catch(failLoadingStep);
    return;
  }
  completeLoadingStep(step);
}

function completeLoadingStep(step) {
  engine.loadingStepIndex += 1;
  showLoadingProgress(step.label);
  setTimeout(runNextLoadingStep, CONFIG.loading.stepDelayMs);
}

function failLoadingStep(error) {
  console.error(error);
  showFatalError(CONFIG.text.errorLoading + error.message);
}

function finishLoading() {
  setGameState(GAME_STATE.MENU);
  startGameLoop();
}

// ---------- шаги загрузки: Three.js ----------

function isShadowQualityEnabled() {
  return settings.graphicsQuality === 'high';
}

function getPixelRatio() {
  return Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio);
}

function getAspectRatio() {
  return window.innerWidth / window.innerHeight;
}

function resizeRenderer() {
  engine.renderer.setPixelRatio(getPixelRatio());
  engine.renderer.setSize(window.innerWidth, window.innerHeight, false);
}

function createRenderer() {
  engine.renderer = new THREE.WebGLRenderer({
    canvas: engine.canvas,
    antialias: CONFIG.render.antialias
  });
  engine.renderer.outputEncoding = THREE.sRGBEncoding;
  engine.renderer.shadowMap.enabled = isShadowQualityEnabled();
  // Очистку делаем сами: между отрисовкой мира и оружия нужно сбросить только глубину
  engine.renderer.autoClear = false;
  resizeRenderer();
}

function createScene() {
  engine.scene = new THREE.Scene();
  // Туман применяется уже после кодировки цвета, поэтому его цвет не переводим в линейное пространство
  var fogColor = new THREE.Color(CONFIG.colors.skyHorizon);
  engine.scene.fog = new THREE.Fog(fogColor, CONFIG.render.fogNear, CONFIG.render.fogFar);
}

function createCamera() {
  engine.camera = new THREE.PerspectiveCamera(
    CONFIG.render.fovDegrees,
    getAspectRatio(),
    CONFIG.render.nearPlane,
    CONFIG.render.farPlane
  );
  // Порядок YXZ: сначала поворот вокруг вертикали (yaw), потом наклон (pitch), как в шутерах
  engine.camera.rotation.order = 'YXZ';
}

function paintSkyGradient(geometry) {
  var positions = geometry.attributes.position;
  var colors = new Float32Array(positions.count * COLOR_COMPONENT_COUNT);
  var zenithColor = createLinearColor(CONFIG.colors.skyZenith);
  var horizonColor = createLinearColor(CONFIG.colors.skyHorizon);
  var blendedColor = new THREE.Color();
  for (var index = 0; index < positions.count; index++) {
    var heightRatio = Math.max(0, positions.getY(index) / CONFIG.render.skyRadius);
    blendedColor.copy(horizonColor).lerp(zenithColor, heightRatio);
    blendedColor.toArray(colors, index * COLOR_COMPONENT_COUNT);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, COLOR_COMPONENT_COUNT));
}

function createSky() {
  var geometry = new THREE.SphereGeometry(
    CONFIG.render.skyRadius,
    CONFIG.render.skyWidthSegments,
    CONFIG.render.skyHeightSegments
  );
  paintSkyGradient(geometry);
  var material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false
  });
  engine.sky = new THREE.Mesh(geometry, material);
  engine.scene.add(engine.sky);
}

// Область теней покрывает всю арену; включается только при качестве «high»
function configureSunShadow() {
  var shadows = CONFIG.shadows;
  var shadowCamera = engine.sun.shadow.camera;
  engine.sun.castShadow = true;
  engine.sun.shadow.mapSize.set(shadows.mapSize, shadows.mapSize);
  engine.sun.shadow.bias = shadows.bias;
  engine.sun.shadow.normalBias = shadows.normalBias;
  shadowCamera.left = -shadows.frustumHalfSize;
  shadowCamera.right = shadows.frustumHalfSize;
  shadowCamera.top = shadows.frustumHalfSize;
  shadowCamera.bottom = -shadows.frustumHalfSize;
  shadowCamera.near = shadows.near;
  shadowCamera.far = shadows.far;
  shadowCamera.updateProjectionMatrix();
}

function createLights() {
  var lighting = CONFIG.lighting;
  engine.sun = new THREE.DirectionalLight(createLinearColor(CONFIG.colors.sun), lighting.sunIntensity);
  engine.sun.position.set(lighting.sunX, lighting.sunY, lighting.sunZ);
  engine.scene.add(engine.sun);
  var ambient = new THREE.AmbientLight(createLinearColor(CONFIG.colors.ambient), lighting.ambientIntensity);
  engine.scene.add(ambient);
  if (isShadowQualityEnabled()) {
    configureSunShadow();
  }
}

// ---------- шаги загрузки: текстуры, карта, оружие, боты, игрок ----------

function createNextTexture() {
  var maxAnisotropy = engine.renderer.capabilities.getMaxAnisotropy();
  createTextureByIndex(engine.nextTextureIndex, maxAnisotropy);
  engine.nextTextureIndex += 1;
}

function createMapData() {
  initMapData();
}

function createLevel() {
  buildLevel(engine.scene, isShadowQualityEnabled());
}

// Оружие рисуется отдельным проходом поверх мира, со своей камерой: в стену оно не «проваливается»
function createWeaponView() {
  var view = WEAPON_SETTINGS.view;
  engine.weaponScene = new THREE.Scene();
  engine.weaponCamera = new THREE.PerspectiveCamera(view.fovDegrees, getAspectRatio(), view.near, view.far);
  var ambient = new THREE.AmbientLight(createLinearColor(view.ambientColor), view.ambientIntensity);
  var sun = new THREE.DirectionalLight(createLinearColor(view.sunColor), view.sunIntensity);
  sun.position.set(view.sunX, view.sunY, view.sunZ);
  engine.weaponScene.add(ambient);
  engine.weaponScene.add(sun);
  engine.weaponScene.add(createWeaponViewModels());
  return viewModelData.ready;
}

function createEffects() {
  initEffects(engine.scene, engine.weaponScene);
}

function createWeaponSystem() {
  initWeaponSystem();
}

// Создаёт пул ботов и расставляет их в зоне ботов: так они видны на фоне стартового экрана
function createBots() {
  initBots(engine.scene);
  respawnAllBots();
}

function createPlayer() {
  resetPlayer(getRandomSpawnPoint(TEAM.PLAYER));
}

function bindEvents() {
  window.addEventListener('resize', onWindowResize);
  initInput();
  initDeveloperConsole();
  initAudio();
  initMenu();
  initGame(engine.canvas);
}

// ---------- события ----------

function onWindowResize() {
  if (window.innerWidth === 0 || window.innerHeight === 0) {
    return;
  }
  resizeRenderer();
  engine.camera.aspect = getAspectRatio();
  engine.camera.updateProjectionMatrix();
  engine.weaponCamera.aspect = getAspectRatio();
  engine.weaponCamera.updateProjectionMatrix();
}

// ---------- счётчик FPS ----------

function applyFpsVisibility() {
  engine.fpsElement.hidden = !settings.showFps;
  engine.fpsFrames = 0;
  engine.fpsTimer = 0;
}

function toggleFpsCounter() {
  settings.showFps = !settings.showFps;
  saveSettings();
  applyFpsVisibility();
}

function updateFpsCounter(realDelta) {
  if (!settings.showFps || realDelta > CONFIG.fps.maxFrameSeconds) {
    return;
  }
  engine.fpsFrames += 1;
  engine.fpsTimer += realDelta;
  if (engine.fpsTimer < CONFIG.fps.updateInterval) {
    return;
  }
  var fps = Math.round(engine.fpsFrames / engine.fpsTimer);
  engine.fpsElement.textContent = CONFIG.text.fpsLabel + fps;
  engine.fpsFrames = 0;
  engine.fpsTimer = 0;
}

// ---------- смерть игрока ----------

// Затемнение включается один раз при смерти и выключается при возрождении; DOM трогаем только при смене
function updateDeathOverlay() {
  var isDead = !player.isAlive;
  if (isDead === engine.isDeathShown) {
    return;
  }
  engine.isDeathShown = isDead;
  document.body.setAttribute('data-player-dead', String(isDead));
}

// ---------- игровой цикл ----------

// Действия, которые работают в любом состоянии игры
function handleGlobalActions() {
  if (isDeveloperConsoleOpen()) {
    return;
  }
  if (wasActionPressed('toggleBotsFreeze')) {
    botSystem.isFrozen = !botSystem.isFrozen;
  }
  if (wasActionPressed('toggleFps')) {
    toggleFpsCounter();
  }
  if (wasActionPressed('toggleDebug')) {
    toggleMapDebug();
  }
  if (wasActionPressed('buyMenu')) {
    toggleBuyMenu();
  }
}

// В заморозку игрок и боты стоят на месте; в бою работают игрок, шаги, боты. Таймер раунда идёт в обеих фазах
function updatePlayingLogic(step) {
  if (isCombatAllowed()) {
    updatePlayer(step);
    updateFootstepSounds(step);
    updateBots(step);
  }
  updateRound(step);
}

function updateGameLogic(step) {
  if (gameState.current === GAME_STATE.PLAYING) {
    updatePlayingLogic(step);
  } else if (gameState.current === GAME_STATE.ROUND_END) {
    updateRoundSummary(step);
  }
}

function runFixedUpdates(delta) {
  engine.accumulator += delta;
  while (engine.accumulator >= CONFIG.loop.fixedStep - CONFIG.loop.stepTolerance) {
    updateGameLogic(CONFIG.loop.fixedStep);
    engine.accumulator -= CONFIG.loop.fixedStep;
  }
}

// Сначала мир, потом сброс глубины и оружие поверх него
function renderFrame() {
  engine.renderer.clear();
  engine.renderer.render(engine.scene, engine.camera);
  engine.renderer.clearDepth();
  engine.renderer.render(engine.weaponScene, engine.weaponCamera);
}

// Оружие, отдача и эффекты считаются каждый кадр (а не в фиксированном шаге): нажатие кнопки не должно пропадать
function mainLoop(timestamp) {
  var realDelta = Math.max(0, (timestamp - engine.lastFrameTime) / MS_PER_SECOND);
  var logicDelta = Math.min(realDelta, CONFIG.loop.maxDelta);
  engine.lastFrameTime = timestamp;
  if (isDeveloperConsoleOpen()) {
    resetInputState();
  } else {
    handleGlobalActions();
    applyZoomToMouseDelta();
    updatePlayerLook();
    runFixedUpdates(logicDelta);
    updateWeaponSystem(logicDelta);
  }
  updateEffects(logicDelta);
  updateMenu();
  updateDeathOverlay();
  applyPlayerToCamera(engine.camera);
  applyWeaponRecoilToCamera(engine.camera);
  applyZoomToCamera(engine.camera);
  applyViewPose(viewPose);
  renderFrame();
  updateFpsCounter(realDelta);
  endInputFrame();
  // Следующий кадр запрашиваем в конце: при ошибке цикл остановится, и в консоли будет одна ошибка, а не тысячи
  requestAnimationFrame(mainLoop);
}

function startGameLoop() {
  engine.lastFrameTime = performance.now();
  requestAnimationFrame(mainLoop);
}

startApplication();
