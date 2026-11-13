// Роль: все константы проекта — название, физика, раунды, экономика, сложности, боты, текстуры, эффекты, звук, тексты, сеть.

var MS_PER_SECOND = 1000;
var PERCENT_MAX = 100;

var GAME_STATE = {
  LOADING: 'loading',
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ROUND_END: 'roundEnd',
  MATCH_END: 'matchEnd'
};

// Фазы раунда внутри состояния PLAYING (итог раунда — это состояние ROUND_END)
var ROUND_PHASE = {
  FREEZE: 'freeze',
  FIGHT: 'fight'
};

var ROUND_WINNER = {
  PLAYER: 'player',
  BOTS: 'bots'
};

var ROUND_REASON = {
  BOTS_DESTROYED: 'botsDestroyed',
  PLAYER_KILLED: 'playerKilled',
  TIME_OUT: 'timeOut'
};

// TODO-BACKEND: адрес сервера. Пока пустой — игра работает полностью офлайн.
var API_URL = '';

var CONFIG = {
  gameTitle: 'Arena Strike 3D',
  threeRevision: '128',

  storage: {
    settingsKey: 'arenaStrike3d.settings'
  },

  loop: {
    fixedStep: 1 / 60,
    maxDelta: 0.05,
    stepTolerance: 0.001 // допуск, чтобы на мониторе 60 Гц шаг не пропускался из-за дрожания кадров
  },

  fps: {
    updateInterval: 0.5,
    maxFrameSeconds: 1 // более долгие кадры (возврат на вкладку) в счётчик не попадают
  },

  loading: {
    stepDelayMs: 120
  },

  pointerLock: {
    retryDelayMs: 1300 // Chrome не даёт захватить мышь заново сразу после выхода по Esc
  },

  // TODO-BACKEND: пока сеть имитируется задержкой, потом здесь будут параметры запросов
  network: {
    fakeSubmitDelayMs: 800
  },

  input: {
    maxMouseDelta: 500, // всплески больше этого значения — сбой браузера, их отбрасываем
    reservedKeys: ['Escape']
  },

  render: {
    maxPixelRatio: 1.5,
    antialias: true,
    fovDegrees: 75,
    nearPlane: 0.05,
    farPlane: 200,
    skyRadius: 150,
    skyWidthSegments: 16,
    skyHeightSegments: 12,
    fogNear: 30,
    fogFar: 120
  },

  // Тени включаются только при настройке качества «high»
  shadows: {
    mapSize: 2048,
    frustumHalfSize: 45,
    near: 1,
    far: 120,
    bias: -0.0005,
    normalBias: 0.03
  },

  colors: {
    skyZenith: '#1c222c',
    skyHorizon: '#5a4a3a',
    sun: '#ffe2b0',
    ambient: '#9aa4b8'
  },

  lighting: {
    sunIntensity: 0.9,
    ambientIntensity: 1,
    sunX: 20,
    sunY: 40,
    sunZ: 15
  },

  // Процедурные текстуры: tileMeters — сколько метров занимает одно повторение текстуры
  textures: {
    size: 256,
    anisotropy: 4,
    randomSeed: 20241,
    tileMeters: { concrete: 3, brick: 2, crate: 1.2, sand: 4, metal: 2 },
    concrete: {
      baseColor: '#7f7d78',
      noise: 12,
      blotchCount: 36,
      blotchRadiusMin: 12,
      blotchRadiusMax: 48,
      blotchAlpha: 0.07,
      speckleCount: 500,
      speckleSize: 2,
      speckleAlpha: 0.25,
      seamWidth: 2,
      seamColor: '#55534f'
    },
    brick: {
      mortarColor: '#6e6962',
      color: [140, 68, 48],
      variation: 22,
      rows: 8,
      columns: 4,
      mortar: 4,
      noise: 14
    },
    crate: {
      frameWidth: 22,
      frameColor: '#4a2f17',
      plankCount: 4,
      plankGap: 3,
      plankColor: [150, 104, 56],
      plankVariation: 16,
      grainCount: 90,
      grainLengthMin: 20,
      grainLengthMax: 120,
      grainAlpha: 0.14,
      braceWidth: 26,
      braceEdge: 3,
      braceColor: '#6b4523',
      braceEdgeColor: '#3a250f',
      nailRadius: 4,
      nailColor: '#241709',
      noise: 10
    },
    sand: {
      baseColor: '#8c7a58',
      noise: 16,
      blotchCount: 50,
      blotchRadiusMin: 16,
      blotchRadiusMax: 60,
      blotchAlpha: 0.08,
      pebbleCount: 140,
      pebbleRadiusMin: 1,
      pebbleRadiusMax: 3,
      pebbleColor: '#5e5038',
      pebbleAlpha: 0.6
    },
    metal: {
      stripeWidth: 16,
      stripeLight: '#7d8890',
      stripeDark: '#3a4249',
      scratchCount: 90,
      scratchLengthMin: 8,
      scratchLengthMax: 40,
      scratchAlpha: 0.2,
      rustCount: 14,
      rustRadiusMin: 10,
      rustRadiusMax: 30,
      rustColor: '#7a4a2a',
      rustAlpha: 0.18,
      noise: 8
    },
    // Круглые текстуры с прозрачностью для эффектов: градиент от центра к краю
    muzzleFlash: {
      stops: [
        { at: 0, color: 'rgba(255, 255, 255, 1)' },
        { at: 0.25, color: 'rgba(255, 214, 120, 0.9)' },
        { at: 0.6, color: 'rgba(255, 140, 40, 0.35)' },
        { at: 1, color: 'rgba(255, 100, 0, 0)' }
      ]
    },
    bulletMark: {
      stops: [
        { at: 0, color: 'rgba(10, 10, 10, 0.9)' },
        { at: 0.35, color: 'rgba(20, 20, 20, 0.7)' },
        { at: 1, color: 'rgba(20, 20, 20, 0)' }
      ]
    }
  },

  // Пулы эффектов: размеры пулов задают максимум одновременно живых объектов
  effects: {
    flash: { durationSeconds: 0.05, opacity: 0.95 },
    tracer: {
      poolSize: 32,
      durationSeconds: 0.07,
      thickness: 0.012,
      color: '#ffe9a8',
      opacity: 0.8,
      startRight: 0.14, // откуда вылетает трассер относительно глаз игрока
      startDown: 0.1,
      startForward: 0.5
    },
    sparks: {
      poolSize: 128,
      lifetimeSeconds: 0.35,
      minLifeRatio: 0.6,
      gravity: 9,
      size: 0.06,
      wallSpeed: 3,
      minSpeedRatio: 0.4,
      spread: 1.5,
      wallCount: 5,
      targetCount: 8,
      wallColor: [1, 0.85, 0.5],
      targetColor: [1, 0.25, 0.15]
    },
    marks: { poolSize: 48, size: 0.16, surfaceOffset: 0.012 }
  },

  // Слои звука: noise — шум через фильтр, tone — осциллятор. gain — громкость слоя, delay и duration — секунды.
  audio: {
    maxVoices: 32, // больше одновременных звуков не играем: защита от перегрузки
    noiseSeconds: 1,
    minGain: 0.001,
    footstepDistance: 2.3, // метров между шагами
    footstepMinSpeed: 1,
    quietFootstepVolume: 0.25,
    sounds: {
      empty: [
        { kind: 'noise', delay: 0, duration: 0.04, filter: 'highpass', frequency: 3500, q: 1, gain: 0.5 },
        { kind: 'tone', delay: 0, duration: 0.03, wave: 'square', frequency: 1800, endFrequency: 1200, gain: 0.1 }
      ],
      hit: [
        { kind: 'noise', delay: 0, duration: 0.07, filter: 'bandpass', frequency: 900, q: 1, gain: 0.6 },
        { kind: 'tone', delay: 0, duration: 0.07, wave: 'sine', frequency: 300, endFrequency: 150, gain: 0.5 }
      ],
      headHit: [
        { kind: 'tone', delay: 0, duration: 0.1, wave: 'sine', frequency: 1300, endFrequency: 900, gain: 0.5 },
        { kind: 'noise', delay: 0, duration: 0.05, filter: 'highpass', frequency: 3000, q: 1, gain: 0.4 }
      ],
      wallHit: [
        { kind: 'noise', delay: 0, duration: 0.06, filter: 'highpass', frequency: 4000, q: 1, gain: 0.25 }
      ],
      footstep: [
        { kind: 'noise', delay: 0, duration: 0.08, filter: 'lowpass', frequency: 450, q: 0.7, gain: 0.5 },
        { kind: 'tone', delay: 0, duration: 0.06, wave: 'sine', frequency: 85, endFrequency: 50, gain: 0.4 }
      ]
    }
  },

  // Временные подсказки на экране (до HUD этапа 7)
  tempHud: {
    hitInfoSeconds: 1.5
  },

  player: {
    maxHealth: 100,
    maxArmor: 100,
    startArmor: 0, // броню нужно покупать (меню закупки по B)
    radius: 0.35,
    standingHeight: 1.8,
    crouchHeight: 1.2,
    standingEyeHeight: 1.65,
    crouchEyeHeight: 1.1,
    crouchTransitionSpeed: 4, // м/с: скорость опускания и подъёма камеры
    walkSpeed: 5.5,
    quietWalkSpeed: 2.8,
    crouchSpeed: 2.6,
    jumpSpeed: 6.5,
    maxStepHeight: 0.4, // выступы такой высоты игрок и боты проходят без прыжка
    mouseRadiansPerPixel: 0.0022,
    maxPitchDegrees: 89
  },

  physics: {
    gravity: 22,
    maxFallSpeed: 40,
    maxMoveStep: 0.2, // максимальное перемещение за один подшаг коллизий, м
    groundAcceleration: 60,
    airAcceleration: 15,
    groundFriction: 9,
    stopSpeed: 2, // на малых скоростях трение считается как от этой скорости, чтобы игрок останавливался, а не «полз»
    floorHeight: 0,
    contactEpsilon: 0.001,
    collisionPasses: 3
  },

  camera: {
    bobCyclesPerMeter: 0.4,
    bobBouncesPerCycle: 2,
    bobVerticalAmplitude: 0.03,
    bobRollAmplitude: 0.004, // рад
    bobBlendSpeed: 6,
    stepSmoothSpeed: 3, // м/с: плавный подъём камеры после шага на выступ
    maxShake: 0.06, // рад
    shakeDecayPerSecond: 0.06,
    landingShakeMinSpeed: 5,
    landingShakePerSpeed: 0.003
  },

  combat: {
    headMultiplier: 2.5,
    bodyMultiplier: 1,
    legMultiplier: 0.75,
    armorAbsorbRatio: 0.5 // доля урона, которую поглощает броня
  },

  round: {
    winsToWinMatch: 5,
    freezeSeconds: 6,
    fightSeconds: 90,
    summarySeconds: 5
  },

  economy: {
    startMoney: 800,
    maxMoney: 16000,
    killReward: 300,
    roundWinReward: 2500,
    roundLossReward: 1500,
    armorPrice: 650
  },

  defaultDifficulty: 'normal',

  // Сложность: число ботов, время реакции, ошибка прицела, дальность и угол обзора, интервал между выстрелами
  difficulties: {
    easy: { label: 'Лёгкая', botCount: 3, reactionSeconds: 0.9, aimErrorDegrees: 7, viewDistance: 30, viewAngleDegrees: 90, shotIntervalSeconds: 0.5 },
    normal: { label: 'Средняя', botCount: 4, reactionSeconds: 0.55, aimErrorDegrees: 4.5, viewDistance: 40, viewAngleDegrees: 110, shotIntervalSeconds: 0.38 },
    hard: { label: 'Сложная', botCount: 5, reactionSeconds: 0.3, aimErrorDegrees: 2.5, viewDistance: 50, viewAngleDegrees: 130, shotIntervalSeconds: 0.28 }
  },

  bots: {
    poolSize: 5,
    weaponId: 'rifle', // звук выстрела берётся у этого оружия
    maxHealth: 100,
    radius: 0.35,
    height: 1.8,
    eyeHeight: 1.6,
    patrolSpeed: 2.5,
    investigateSpeed: 3.5,
    chaseSpeed: 4.5,
    retreatSpeed: 4.8,
    strafeSpeed: 2.5,
    turnSpeed: 7, // рад/с
    retreatHealth: 30,
    waypointReachDistance: 1,
    perceptionInterval: 0.12, // как часто бот проверяет, видит ли игрока
    hearingDistance: 45,
    memorySeconds: 6, // сколько бот ищет игрока, потеряв его из виду
    patrolWaitMin: 0.5,
    patrolWaitMax: 2,
    investigateLookSeconds: 1.5,
    retreatHideSeconds: 6,
    retreatMinPlayerDistance: 10, // на отступлении ищем укрытие не ближе этого расстояния до игрока
    closeDistance: 6, // ближе этого бот не подбегает, а двигается боком
    strafeSeconds: 1.2,
    replanSeconds: 0.6,
    fireAngleDegrees: 8, // стрелять можно, только если бот повёрнут к игроку не хуже этого угла
    shotDamage: 10,
    playerHitRadius: 0.5,
    tracerExtraLength: 4,
    tracerStartForward: 0.5,
    tracerStartDown: 0.25,
    hitShake: 0.012,
    minShotVolume: 0.15,
    stuckCheckSeconds: 1,
    stuckMinDistance: 0.3,
    stuckMoveRatio: 0.8, // доля времени, которую бот должен был идти, чтобы считаться застрявшим
    detourSeconds: 3,
    separationDistance: 0.9,
    separationSpeed: 1.5,
    spawnSpacing: 1.8,
    spawnTries: 20,
    hitFlashSeconds: 0.15,
    flashSideRatio: 0.25, // доля красного для зелёной и синей составляющих вспышки при попадании
    corpseSeconds: 3,
    deathFallSeconds: 0.6,
    respawnAllSeconds: Infinity, // автопоявление ботов отключено: раунды сами создают ботов (функцию в bots.js уберу при следующем изменении файла)
    pose: {
      legSwing: 0.7,
      armSwingRatio: 0.8,
      armAimAngle: 1.35,
      fallAngle: Math.PI / 2,
      strideCyclesPerMeter: 0.4,
      walkBlendSpeed: 8,
      aimBlendSpeed: 6
    },
    // Размеры частей модели в метрах; y — центр части от пола, pivotY — высота сустава
    model: {
      torso: { w: 0.5, h: 0.65, d: 0.28, y: 1.125, color: '#8c3b24' },
      head: { w: 0.28, h: 0.28, d: 0.28, y: 1.62, color: '#c99a76' },
      leg: { w: 0.2, h: 0.8, d: 0.2, x: 0.12, pivotY: 0.8, color: '#3a3f45' },
      arm: { w: 0.14, h: 0.6, d: 0.14, x: 0.34, pivotY: 1.42, color: '#3a3f45' },
      weapon: { w: 0.06, h: 0.1, d: 0.55, x: 0.16, y: 1.2, z: -0.3, color: '#25282c' },
      marker: { radius: 0.13, y: 2.15, color: '#ff3b30' } // ромб над головой: так бота видно по форме, не только по цвету
    },
    // Невидимые хитбоксы по частям тела; их проверяет луч выстрела
    hitboxes: {
      legs: { w: 0.5, h: 0.85, d: 0.35, y: 0.425 },
      body: { w: 0.62, h: 0.7, d: 0.4, y: 1.2 },
      head: { w: 0.36, h: 0.36, d: 0.36, y: 1.68 }
    }
  },

  settingsDefaults: {
    mouseSensitivity: 1,
    musicVolume: 0.5,
    effectsVolume: 0.8,
    graphicsQuality: 'medium', // low | medium | high
    cameraShake: true,
    headBob: true,
    reduceFlashing: false,
    showFps: false,
    crosshair: {
      color: '#9dff6a',
      size: 6,
      thickness: 2,
      gap: 4,
      dot: false
    },
    keys: {
      moveForward: 'KeyW',
      moveBackward: 'KeyS',
      moveLeft: 'KeyA',
      moveRight: 'KeyD',
      jump: 'Space',
      crouch: 'ControlLeft',
      quietWalk: 'ShiftLeft',
      reload: 'KeyR',
      buyMenu: 'KeyB',
      scoreboard: 'Tab',
      toggleFps: 'F3',
      toggleDebug: 'F4',
      toggleBotsFreeze: 'KeyH',
      weapon1: 'Digit1',
      weapon2: 'Digit2',
      weapon3: 'Digit3',
      weapon4: 'Digit4',
      weapon5: 'Digit5'
    }
  },

  text: {
    loadingPrefix: 'Загрузка: ',
    fpsLabel: 'FPS: ',
    lockWait: 'Подожди секунду и нажми ещё раз.',
    lockError: 'Не удалось захватить мышь. Подожди секунду и нажми ещё раз.',
    lockUnsupported: 'Браузер не поддерживает захват мыши. Используй последнюю версию Chrome, Edge или Firefox.',
    errorNoThree: 'Ошибка: не найден файл libs/three.min.js. Скачай его по инструкции и положи в папку libs.',
    errorWrongThree: 'Ошибка: неверная версия Three.js. Нужна r128, а найдена r',
    errorLoading: 'Ошибка загрузки. Нажми F12, открой вкладку Console и пришли текст ошибки: ',
    moneySuffix: ' $',
    secondsSuffix: ' с',
    roundLabel: 'Раунд',
    phaseFreeze: 'Заморозка',
    phaseFight: 'Бой',
    scoreYou: 'Вы',
    scoreBots: 'Боты',
    roundTitleWin: 'Раунд выигран',
    roundTitleLoss: 'Раунд проигран',
    reasonBotsDestroyed: 'Все боты уничтожены',
    reasonPlayerKilled: 'Вы убиты',
    reasonTimeOut: 'Время вышло',
    rewardLabel: 'Награда: ',
    moneyLabel: 'Деньги: ',
    nextRoundIn: 'Следующий раунд через ',
    matchResultIn: 'Итог матча через ',
    matchTitleWin: 'Матч выигран',
    matchTitleLoss: 'Матч проигран',
    difficultyLabel: 'Сложность: ',
    scoreSending: 'Отправка результата…',
    scoreSent: 'Результат отправлен',
    scoreFailed: 'Не удалось отправить результат',
    buyArmor: 'Броня',
    buyOwned: 'уже есть',
    buyNoMoney: 'не хватает денег',
    buyArmorFull: 'броня полная',
    teamLabel: 'Команда',
    columns: {
      wins: 'Раунды',
      kills: 'Убийства',
      deaths: 'Смерти',
      accuracy: 'Точность',
      headshots: 'В голову'
    },
    noValue: '—'
  }
};

var scoreSubmitCallback = null;

function completeFakeSubmit() {
  var callback = scoreSubmitCallback;
  scoreSubmitCallback = null;
  if (callback !== null) {
    callback(true);
  }
}

// TODO-BACKEND: отправка результата матча на сервер. Сейчас имитирует сетевую задержку и успех.
// scoreData — объект со статистикой матча, onComplete(isSuccess) вызывается по завершении отправки.
function submitScore(scoreData, onComplete) {
  scoreSubmitCallback = onComplete;
  // TODO-BACKEND: здесь будет запрос к API_URL; результат запроса передаётся в onComplete
  setTimeout(completeFakeSubmit, CONFIG.network.fakeSubmitDelayMs);
}
