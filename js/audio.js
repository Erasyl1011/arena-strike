// Роль: звук — синтез через Web Audio (шум, осцилляторы, фильтры, огибающие); громкости берутся из settings.

var audio = {
  context: null,
  effectsGain: null,
  musicGain: null,
  noiseBuffer: null,
  botDamageBuffer: null,
  botDamageSource: null,
  botDamagePending: false,
  botDamageLoading: false,
  botDamageLoadFailed: false,
  botDamageElement: new Audio('assets/audio/bots/CHUPPAAUDIO.mp3'),
  botDamageElementUnlocked: false,
  botDamageFallbackPending: false,
  activeVoices: 0,
  stepDistance: 0
};

audio.botDamageElement.preload = 'auto';
audio.botDamageElement.addEventListener('error', function () {
  console.error('Не удалось открыть assets/audio/bots/CHUPPAAUDIO.mp3', audio.botDamageElement.error);
});

function playBotDamageFallback() {
  if (!audio.botDamageElementUnlocked) {
    audio.botDamageFallbackPending = true;
    return;
  }
  audio.botDamageFallbackPending = false;
  audio.botDamageElement.pause();
  audio.botDamageElement.volume = settings.effectsVolume;
  if (audio.botDamageElement.readyState > 0) {
    audio.botDamageElement.currentTime = 0;
  }
  var playback = audio.botDamageElement.play();
  if (playback && typeof playback.catch === 'function') {
    playback.catch(function (error) {
      console.error('Не удалось воспроизвести голос бота', error);
    });
  }
}

function unlockBotDamageFallback() {
  if (audio.botDamageElementUnlocked) {
    return;
  }
  audio.botDamageElement.muted = true;
  var playback = audio.botDamageElement.play();
  function finishUnlock() {
    audio.botDamageElement.pause();
    if (audio.botDamageElement.readyState > 0) {
      audio.botDamageElement.currentTime = 0;
    }
    audio.botDamageElement.muted = false;
    audio.botDamageElementUnlocked = true;
    if (audio.botDamageFallbackPending) {
      playBotDamageFallback();
    }
  }
  if (playback && typeof playback.then === 'function') {
    playback.then(finishUnlock).catch(function () {
      audio.botDamageElement.muted = false;
    });
  } else {
    finishUnlock();
  }
}

function loadBotDamageVoice() {
  if (audio.context === null || audio.botDamageBuffer !== null || audio.botDamageLoading) {
    return;
  }
  audio.botDamageLoading = true;
  fetch('assets/audio/bots/CHUPPAAUDIO.mp3')
    .then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.arrayBuffer();
    })
    .then(function (fileData) {
      return audio.context.decodeAudioData(fileData);
    })
    .then(function (buffer) {
      audio.botDamageBuffer = buffer;
      audio.botDamageLoading = false;
      if (audio.botDamagePending) {
        audio.botDamagePending = false;
        playBotDamageVoice();
      }
    })
    .catch(function (error) {
      audio.botDamageLoading = false;
      audio.botDamageLoadFailed = true;
      console.error('Не удалось загрузить или декодировать assets/audio/bots/CHUPPAAUDIO.mp3', error);
      if (audio.botDamagePending) {
        audio.botDamagePending = false;
        playBotDamageFallback();
      }
    });
}

function playBotDamageVoice() {
  if (audio.context === null || audio.context.state !== 'running') {
    if (audio.context === null) {
      playBotDamageFallback();
      return;
    }
    audio.botDamagePending = true;
    return;
  }
  if (audio.botDamageBuffer === null) {
    if (audio.botDamageLoadFailed) {
      playBotDamageFallback();
      return;
    }
    audio.botDamagePending = true;
    loadBotDamageVoice();
    return;
  }

  if (audio.botDamageSource !== null) {
    audio.botDamageSource.onended = null;
    audio.botDamageSource.stop();
  }
  var source = audio.context.createBufferSource();
  source.buffer = audio.botDamageBuffer;
  source.connect(audio.effectsGain);
  source.onended = function () {
    if (audio.botDamageSource === source) {
      audio.botDamageSource = null;
    }
  };
  audio.botDamageSource = source;
  source.start();
}

// ---------- запуск: браузер разрешает звук только после действия пользователя ----------

function initAudio() {
  document.addEventListener('click', onFirstUserGesture);
  document.addEventListener('keydown', onFirstUserGesture);
}

function onFirstUserGesture() {
  unlockAudio();
  unlockBotDamageFallback();
  loadBotDamageVoice();
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
    var resumeResult = audio.context.resume();
    if (resumeResult && typeof resumeResult.then === 'function') {
      resumeResult.then(function () {
        if (audio.botDamagePending && audio.botDamageBuffer !== null) {
          audio.botDamagePending = false;
          playBotDamageVoice();
        }
      }).catch(function (error) {
        console.warn('Не удалось запустить AudioContext:', error);
      });
    }
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
