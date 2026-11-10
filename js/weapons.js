// Роль: данные оружия (параметры, звуки, модели от первого лица) и общие настройки оружейной системы.

var COLOR_STEEL = '#3a3f45';
var COLOR_DARK = '#25282c';
var COLOR_BLADE = '#aeb6bd';
var COLOR_WOOD = '#6b4423';
var COLOR_GRIP = '#1d1f22';
var COLOR_ACCENT = '#b8791f';

// Номер в этом списке = номер слота оружия (клавиши 1–5 соответствуют номерам 0–4)
var WEAPON_ORDER = ['knife', 'pistol', 'rifle', 'shotgun', 'sniper'];

var WEAPON_SETTINGS = {
  startWeapon: 'pistol',
  startOwned: ['knife', 'pistol'], // остальное оружие покупается в меню закупки
  switchSeconds: 0.4,
  movingSpeedThreshold: 3, // выше этой скорости (м/с) разброс «в движении»; тихий шаг и присед считаются «стоя»
  zoomSpeed: 10,
  zoomedBlendThreshold: 0.8, // зум считается включённым для разброса, когда приближение дошло до этой доли
  hideModelBlend: 0.5, // при таком приближении модель оружия скрывается (прицел снайперки)
  recoilRecoveryPerSecond: 9,
  maxRecoilDegrees: 10,
  kickRecoveryPerSecond: 10,
  emptyClickInterval: 0.3,
  wallSoundInterval: 0.06,
  tracerMaxLength: 80,
  view: {
    fovDegrees: 60,
    near: 0.01,
    far: 5,
    cylinderSegments: 8,
    ambientColor: '#ffffff',
    ambientIntensity: 1.1,
    sunColor: '#ffffff',
    sunIntensity: 0.9,
    sunX: -1,
    sunY: 2,
    sunZ: 1.5,
    bobSwayX: 0.012,
    bobLiftY: 0.01,
    reloadDip: 0.14,
    reloadTilt: 0.7,
    reloadRoll: 0.35,
    lowerDistance: 0.3,
    lowerTilt: 0.8
  }
};

// Короткий щелчок механизма: из таких щелчков собираются звуки перезарядки
function createClickLayer(delay, frequency) {
  return { kind: 'noise', delay: delay, duration: 0.05, filter: 'highpass', frequency: frequency, q: 1, gain: 0.5 };
}

// spread — половина угла конуса разброса в градусах; recoil — подброс камеры за выстрел (градусы);
// cameraShake — добавка к тряске камеры (рад); модель: оси x вправо, y вверх, z — от камеры вперёд (минус)
var WEAPONS = {
  knife: {
    id: 'knife',
    name: 'Нож',
    isMelee: true,
    isAutomatic: false,
    damage: 40,
    shotsPerSecond: 1.8,
    range: 2.2,
    pellets: 1,
    spread: { standing: 0, moving: 0, jumping: 0 },
    zoomFovDegrees: 0,
    zoomSpreadMultiplier: 1,
    recoil: { pitchDegrees: 0, yawDegrees: 0 },
    cameraShake: 0.004,
    magazineSize: 0,
    reserveAmmo: 0,
    reloadSeconds: 0,
    price: 0,
    flashSize: 0,
    sounds: {
      shot: [
        { kind: 'noise', delay: 0, duration: 0.2, filter: 'bandpass', frequency: 3500, endFrequency: 900, q: 1.2, gain: 0.35 }
      ],
      reload: []
    },
    viewModel: {
      position: { x: 0.22, y: -0.2, z: -0.42 },
      kickBack: 0.08,
      kickUp: 0.5,
      muzzle: { x: 0, y: 0.01, z: -0.3 },
      parts: [
        { shape: 'box', x: 0, y: 0.01, z: -0.17, w: 0.018, h: 0.05, d: 0.26, color: COLOR_BLADE },
        { shape: 'box', x: 0, y: 0, z: -0.035, w: 0.05, h: 0.02, d: 0.015, color: COLOR_DARK },
        { shape: 'box', x: 0, y: -0.005, z: 0.02, w: 0.03, h: 0.035, d: 0.11, color: COLOR_GRIP }
      ]
    }
  },

  pistol: {
    id: 'pistol',
    name: 'Пистолет',
    isMelee: false,
    isAutomatic: false,
    damage: 28,
    shotsPerSecond: 5,
    range: 70,
    pellets: 1,
    spread: { standing: 0.6, moving: 2.5, jumping: 5 },
    zoomFovDegrees: 0,
    zoomSpreadMultiplier: 1,
    recoil: { pitchDegrees: 1.4, yawDegrees: 0.3 },
    cameraShake: 0.004,
    magazineSize: 12,
    reserveAmmo: 36,
    reloadSeconds: 1.6,
    price: 200,
    flashSize: 0.16,
    sounds: {
      shot: [
        { kind: 'noise', delay: 0, duration: 0.14, filter: 'bandpass', frequency: 2200, endFrequency: 900, q: 0.9, gain: 0.9 },
        { kind: 'tone', delay: 0, duration: 0.11, wave: 'triangle', frequency: 260, endFrequency: 70, gain: 0.6 }
      ],
      reload: [createClickLayer(0.25, 3000), createClickLayer(0.9, 2500), createClickLayer(1.25, 2000)]
    },
    viewModel: {
      position: { x: 0.2, y: -0.2, z: -0.4 },
      kickBack: 0.05,
      kickUp: 0.25,
      muzzle: { x: 0, y: 0.02, z: -0.24 },
      parts: [
        { shape: 'box', x: 0, y: 0.02, z: -0.1, w: 0.04, h: 0.045, d: 0.21, color: COLOR_STEEL },
        { shape: 'box', x: 0, y: -0.01, z: -0.09, w: 0.038, h: 0.03, d: 0.17, color: COLOR_DARK },
        { shape: 'box', x: 0, y: -0.07, z: 0, w: 0.036, h: 0.11, d: 0.05, color: COLOR_GRIP, rx: -0.25 },
        { shape: 'cylinder', x: 0, y: 0.02, z: -0.215, radius: 0.009, length: 0.03, color: COLOR_DARK },
        { shape: 'box', x: 0, y: 0.047, z: -0.02, w: 0.008, h: 0.01, d: 0.01, color: COLOR_ACCENT }
      ]
    }
  },

  rifle: {
    id: 'rifle',
    name: 'Автомат',
    isMelee: false,
    isAutomatic: true,
    damage: 26,
    shotsPerSecond: 10,
    range: 100,
    pellets: 1,
    spread: { standing: 0.5, moving: 2.8, jumping: 6 },
    zoomFovDegrees: 0,
    zoomSpreadMultiplier: 1,
    recoil: { pitchDegrees: 0.9, yawDegrees: 0.35 },
    cameraShake: 0.005,
    magazineSize: 30,
    reserveAmmo: 90,
    reloadSeconds: 2.4,
    price: 1800,
    flashSize: 0.22,
    sounds: {
      shot: [
        { kind: 'noise', delay: 0, duration: 0.18, filter: 'lowpass', frequency: 3600, endFrequency: 1200, q: 0.8, gain: 1 },
        { kind: 'tone', delay: 0, duration: 0.16, wave: 'triangle', frequency: 180, endFrequency: 45, gain: 0.7 }
      ],
      reload: [createClickLayer(0.3, 2200), createClickLayer(1.2, 2600), createClickLayer(2, 1800)]
    },
    viewModel: {
      position: { x: 0.19, y: -0.2, z: -0.42 },
      kickBack: 0.05,
      kickUp: 0.18,
      muzzle: { x: 0, y: 0.01, z: -0.9 },
      parts: [
        { shape: 'box', x: 0, y: 0, z: -0.2, w: 0.05, h: 0.075, d: 0.38, color: COLOR_STEEL },
        { shape: 'box', x: 0, y: -0.005, z: 0.1, w: 0.04, h: 0.09, d: 0.2, color: COLOR_WOOD },
        { shape: 'box', x: 0, y: -0.005, z: -0.5, w: 0.055, h: 0.06, d: 0.22, color: COLOR_WOOD },
        { shape: 'cylinder', x: 0, y: 0.01, z: -0.75, radius: 0.011, length: 0.28, color: COLOR_DARK },
        { shape: 'box', x: 0, y: -0.1, z: -0.22, w: 0.035, h: 0.14, d: 0.06, color: COLOR_DARK, rx: 0.2 },
        { shape: 'box', x: 0, y: -0.08, z: -0.02, w: 0.035, h: 0.09, d: 0.045, color: COLOR_GRIP, rx: -0.2 },
        { shape: 'box', x: 0, y: 0.052, z: -0.35, w: 0.01, h: 0.03, d: 0.02, color: COLOR_ACCENT }
      ]
    }
  },

  shotgun: {
    id: 'shotgun',
    name: 'Дробовик',
    isMelee: false,
    isAutomatic: false,
    damage: 11,
    shotsPerSecond: 1.2,
    range: 35,
    pellets: 8,
    spread: { standing: 4.5, moving: 5.5, jumping: 8 },
    zoomFovDegrees: 0,
    zoomSpreadMultiplier: 1,
    recoil: { pitchDegrees: 4, yawDegrees: 0.8 },
    cameraShake: 0.02,
    magazineSize: 8,
    reserveAmmo: 32,
    reloadSeconds: 3,
    price: 1200,
    flashSize: 0.32,
    sounds: {
      shot: [
        { kind: 'noise', delay: 0, duration: 0.38, filter: 'lowpass', frequency: 1800, endFrequency: 400, q: 0.7, gain: 1 },
        { kind: 'tone', delay: 0, duration: 0.3, wave: 'triangle', frequency: 100, endFrequency: 30, gain: 0.9 },
        { kind: 'noise', delay: 0, duration: 0.06, filter: 'highpass', frequency: 3500, q: 1, gain: 0.5 }
      ],
      reload: [
        createClickLayer(0.4, 2400), createClickLayer(1, 2400), createClickLayer(1.6, 2400),
        createClickLayer(2.2, 2400), createClickLayer(2.7, 1500)
      ]
    },
    viewModel: {
      position: { x: 0.19, y: -0.21, z: -0.42 },
      kickBack: 0.09,
      kickUp: 0.35,
      muzzle: { x: 0, y: 0.015, z: -0.88 },
      parts: [
        { shape: 'cylinder', x: 0, y: 0.015, z: -0.5, radius: 0.02, length: 0.75, color: COLOR_STEEL },
        { shape: 'cylinder', x: 0, y: -0.02, z: -0.4, radius: 0.017, length: 0.55, color: COLOR_DARK },
        { shape: 'box', x: 0, y: -0.02, z: -0.4, w: 0.06, h: 0.05, d: 0.2, color: COLOR_WOOD },
        { shape: 'box', x: 0, y: 0, z: -0.05, w: 0.05, h: 0.08, d: 0.22, color: COLOR_DARK },
        { shape: 'box', x: 0, y: -0.02, z: 0.2, w: 0.045, h: 0.1, d: 0.25, color: COLOR_WOOD },
        { shape: 'box', x: 0, y: 0.04, z: -0.85, w: 0.008, h: 0.012, d: 0.008, color: COLOR_ACCENT }
      ]
    }
  },

  sniper: {
    id: 'sniper',
    name: 'Снайперская винтовка',
    isMelee: false,
    isAutomatic: false,
    damage: 110,
    shotsPerSecond: 0.8,
    range: 200,
    pellets: 1,
    spread: { standing: 3, moving: 6, jumping: 9 },
    zoomFovDegrees: 25,
    zoomSpreadMultiplier: 0.04,
    recoil: { pitchDegrees: 5, yawDegrees: 0.5 },
    cameraShake: 0.025,
    magazineSize: 5,
    reserveAmmo: 20,
    reloadSeconds: 3.2,
    price: 2600,
    flashSize: 0.3,
    sounds: {
      shot: [
        { kind: 'noise', delay: 0, duration: 0.6, filter: 'lowpass', frequency: 2600, endFrequency: 300, q: 0.7, gain: 1 },
        { kind: 'tone', delay: 0, duration: 0.5, wave: 'triangle', frequency: 120, endFrequency: 25, gain: 1 },
        { kind: 'noise', delay: 0, duration: 0.07, filter: 'highpass', frequency: 4500, q: 1, gain: 0.6 }
      ],
      reload: [createClickLayer(0.6, 2000), createClickLayer(1.5, 2800), createClickLayer(2.4, 1800)]
    },
    viewModel: {
      position: { x: 0.18, y: -0.2, z: -0.42 },
      kickBack: 0.1,
      kickUp: 0.4,
      muzzle: { x: 0, y: 0.012, z: -1.04 },
      parts: [
        { shape: 'cylinder', x: 0, y: 0.012, z: -0.6, radius: 0.014, length: 0.85, color: COLOR_DARK },
        { shape: 'box', x: 0, y: 0, z: -0.1, w: 0.05, h: 0.08, d: 0.35, color: COLOR_STEEL },
        { shape: 'box', x: 0, y: -0.01, z: 0.2, w: 0.045, h: 0.1, d: 0.3, color: COLOR_WOOD },
        { shape: 'cylinder', x: 0, y: 0.075, z: -0.15, radius: 0.026, length: 0.25, color: COLOR_DARK },
        { shape: 'cylinder', x: 0, y: 0.075, z: -0.27, radius: 0.032, length: 0.03, color: COLOR_STEEL },
        { shape: 'box', x: 0.04, y: 0.01, z: 0, w: 0.012, h: 0.012, d: 0.05, color: COLOR_ACCENT },
        { shape: 'box', x: 0, y: -0.06, z: -0.1, w: 0.035, h: 0.06, d: 0.08, color: COLOR_DARK }
      ]
    }
  }
};