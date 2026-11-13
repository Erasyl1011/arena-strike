// Роль: звук — синтез через Web Audio (шум, осцилляторы, фильтры, огибающие); громкости берутся из settings.

var audio = {
  context: null,
  effectsGain: null,
  musicGain: null,
  noiseBuffer: null,
  activeVoices: 0,
  stepDistance: 0
};

var botDamageVoice = new Audio('assets/audio/bots/CHUPPAAUDIO.mp3');
botDamageVoice.preload = 'auto';

function playBotDamageVoice() {
  botDamageVoice.pause();
  botDamageVoice.currentTime = 0;
  var playback = botDamageVoice.play();
  if (playback && typeof playback.catch === 'function') {
    playback.catch(function () {
      // Браузер может запретить звук, пока игрок не взаимодействовал со страницей.
    });
  }
}

// ---------- запуск: браузер разрешает звук только после действия пользователя ----------

function initAudio() {
  document.addEventListener('click', onFirstUserGesture);
  document.addEventListener('keydown', onFirstUserGesture);
}

function onFirstUserGesture() {
  unlockAudio();
  if (audio.context !== null) {
    document.removeEventListener('click', onFirstUserGesture);
    document.removeEventListener('keydown', onFirstUserGesture);
  }
}

function createNoiseBuffer(context) {
  var length = Math.floor(context.sampleRate * CONFIG.audio.noiseSeconds);
  var buffer = context.createBuffer(1, length, context.sampleRate);
  var data = buffer.getChannelData(0);
  for (var index = 0; index < length; index++) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function createAudioContext() {
  var ContextClass = window.AudioContext || window.webkitAudioContext;
  if (ContextClass === undefined) {
    return;
  }
  var context = new ContextClass();
  audio.effectsGain = context.createGain();
  audio.effectsGain.connect(context.destination);
  audio.musicGain = context.createGain();
  audio.musicGain.connect(context.destination);
  audio.noiseBuffer = createNoiseBuffer(context);
  audio.context = context;
  applyAudioVolumes();
}

// Создаёт AudioContext при первом вызове и запускает его, если браузер держит его на паузе
function unlockAudio() {
  if (audio.context === null) {
    createAudioContext();
  }
  if (audio.context !== null && audio.context.state === 'suspended') {
    audio.context.resume();
  }
}

// Раздельные громкости эффектов и музыки; меняются настройками на лету
function applyAudioVolumes() {
  if (audio.context === null) {
    return;
  }
  audio.effectsGain.gain.value = settings.effectsVolume;
  audio.musicGain.gain.value = settings.musicVolume;
}

// ---------- воспроизведение слоёв ----------

function onVoiceEnded(event) {
  event.target.disconnect();
  audio.activeVoices -= 1;
}

// Затухание звука: мгновенная атака и экспоненциальный спад до почти нуля
function applyEnvelope(gainNode, peak, startTime, duration) {
  gainNode.gain.setValueAtTime(peak, startTime);
  gainNode.gain.exponentialRampToValueAtTime(CONFIG.audio.minGain, startTime + duration);
}

function playNoiseLayer(layer, startTime, volumeScale) {
  var context = audio.context;
  var source = context.createBufferSource();
  var filter = context.createBiquadFilter();
  var gainNode = context.createGain();
  source.buffer = audio.noiseBuffer;
  filter.type = layer.filter;
  filter.Q.value = layer.q;
  filter.frequency.setValueAtTime(layer.frequency, startTime);
  if (layer.endFrequency !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(layer.endFrequency, startTime + layer.duration);
  }
  applyEnvelope(gainNode, layer.gain * volumeScale, startTime, layer.duration);
  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audio.effectsGain);
  source.onended = onVoiceEnded;
  source.start(startTime, Math.random() * (CONFIG.audio.noiseSeconds - layer.duration));
  source.stop(startTime + layer.duration);
}

function playToneLayer(layer, startTime, volumeScale) {
  var context = audio.context;
  var oscillator = context.createOscillator();
  var gainNode = context.createGain();
  oscillator.type = layer.wave;
  oscillator.frequency.setValueAtTime(layer.frequency, startTime);
  if (layer.endFrequency !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(layer.endFrequency, startTime + layer.duration);
  }
  applyEnvelope(gainNode, layer.gain * volumeScale, startTime, layer.duration);
  oscillator.connect(gainNode);
  gainNode.connect(audio.effectsGain);
  oscillator.onended = onVoiceEnded;
  oscillator.start(startTime);
  oscillator.stop(startTime + layer.duration);
}

// Проигрывает набор слоёв; volumeScale — множитель громкости (например, для далёких выстрелов ботов)
function playSoundLayers(layers, volumeScale) {
  if (audio.context === null || audio.context.state !== 'running') {
    return;
  }
  applyAudioVolumes();
  var now = audio.context.currentTime;
  for (var index = 0; index < layers.length; index++) {
    if (audio.activeVoices >= CONFIG.audio.maxVoices) {
      return;
    }
    var layer = layers[index];
    audio.activeVoices += 1;
    if (layer.kind === 'noise') {
      playNoiseLayer(layer, now + layer.delay, volumeScale);
    } else {
      playToneLayer(layer, now + layer.delay, volumeScale);
    }
  }
}

// ---------- готовые звуки ----------

function playWeaponShotSound(weapon, volumeScale) {
  playSoundLayers(weapon.sounds.shot, volumeScale);
}

function playWeaponReloadSound(weapon, volumeScale) {
  playSoundLayers(weapon.sounds.reload, volumeScale);
}

function playEmptyClickSound() {
  playSoundLayers(CONFIG.audio.sounds.empty, 1);
}

// part — 'head', 'body' или 'legs'
function playHitSound(part) {
  var layers = part === 'head' ? CONFIG.audio.sounds.headHit : CONFIG.audio.sounds.hit;
  playSoundLayers(layers, 1);
}

function playWallHitSound() {
  playSoundLayers(CONFIG.audio.sounds.wallHit, 1);
}

function playFootstepSound(volumeScale) {
  playSoundLayers(CONFIG.audio.sounds.footstep, volumeScale);
}

// Шаги по пройденному пути; тихий шаг и присед почти беззвучны
function updateFootstepSounds(step) {
  var speed = getHorizontalSpeed();
  if (!player.isGrounded || speed < CONFIG.audio.footstepMinSpeed) {
    return;
  }
  audio.stepDistance += speed * step;
  if (audio.stepDistance < CONFIG.audio.footstepDistance) {
    return;
  }
  audio.stepDistance -= CONFIG.audio.footstepDistance;
  var isQuiet = player.isCrouching || isActionPressed('quietWalk');
  playFootstepSound(isQuiet ? CONFIG.audio.quietFootstepVolume : 1);
}
