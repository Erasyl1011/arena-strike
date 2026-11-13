// Роль: звук — синтез через Web Audio (шум, осцилляторы, фильтры, огибающие); громкости берутся из settings.

var BOT_DAMAGE_VOICE_PATHS = [
  'assets/audio/bots/CHUPPAAUDIO.mp3',
  'assets/audio/bots/MEYRAMBEKAUDIO.mp3'
];

var audio = {
  context: null,
  effectsGain: null,
  musicGain: null,
  noiseBuffer: null,
  botVoices: {},
  activeVoices: 0,
  stepDistance: 0
};

function getBotVoice(path) {
  if (audio.botVoices[path] !== undefined) {
    return audio.botVoices[path];
  }
  var element = new Audio(path);
  element.preload = 'auto';
  var voice = {
    path: path,
    buffer: null,
    source: null,
    pending: false,
    loading: false,
    loadFailed: false,
    element: element,
    elementUnlocked: false,
    fallbackPending: false
  };
  element.addEventListener('error', function () {
    console.error('Не удалось открыть ' + path, element.error);
  });
  audio.botVoices[path] = voice;
  return voice;
}

function playBotVoiceFallback(voice) {
  if (!voice.elementUnlocked) {
    voice.fallbackPending = true;
    return;
  }
  voice.fallbackPending = false;
  voice.element.pause();
  voice.element.volume = settings.effectsVolume;
  if (voice.element.readyState > 0) {
    voice.element.currentTime = 0;
  }
  var playback = voice.element.play();
  if (playback && typeof playback.catch === 'function') {
    playback.catch(function (error) {
      console.error('Не удалось воспроизвести голос бота из ' + voice.path, error);
    });
  }
}

function unlockBotVoiceFallback(voice) {
  if (voice.elementUnlocked) {
    return;
  }
  voice.element.muted = true;
  var playback = voice.element.play();
  function finishUnlock() {
    voice.element.pause();
    if (voice.element.readyState > 0) {
      voice.element.currentTime = 0;
    }
    voice.element.muted = false;
    voice.elementUnlocked = true;
    if (voice.fallbackPending) {
      playBotVoiceFallback(voice);
    }
  }
  if (playback && typeof playback.then === 'function') {
    playback.then(finishUnlock).catch(function () {
      voice.element.muted = false;
    });
  } else {
    finishUnlock();
  }
}

function loadBotDamageVoice(path) {
  var voice = getBotVoice(path);
  if (audio.context === null || voice.buffer !== null || voice.loading || voice.loadFailed) {
    return;
  }
  voice.loading = true;
  fetch(path)
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
      voice.buffer = buffer;
      voice.loading = false;
      if (voice.pending) {
        voice.pending = false;
        playBotDamageVoice(path);
      }
    })
    .catch(function (error) {
      voice.loading = false;
      voice.loadFailed = true;
      console.error('Не удалось загрузить или декодировать ' + path, error);
      if (voice.pending) {
        voice.pending = false;
        playBotVoiceFallback(voice);
      }
    });
}

function playBotDamageVoice(path) {
  var voicePath = path || BOT_DAMAGE_VOICE_PATHS[0];
  var voice = getBotVoice(voicePath);
  if (audio.context === null) {
    playBotVoiceFallback(voice);
    return;
  }
  if (audio.context.state !== 'running') {
    voice.pending = true;
    return;
  }
  if (voice.buffer === null) {
    if (voice.loadFailed) {
      playBotVoiceFallback(voice);
      return;
    }
    voice.pending = true;
    loadBotDamageVoice(voicePath);
    return;
  }

  if (voice.source !== null) {
    voice.source.onended = null;
    voice.source.stop();
  }
  var source = audio.context.createBufferSource();
  source.buffer = voice.buffer;
  source.connect(audio.effectsGain);
  source.onended = function () {
    if (voice.source === source) {
      voice.source = null;
    }
  };
  voice.source = source;
  source.start();
}

// ---------- запуск: браузер разрешает звук только после действия пользователя ----------

function initAudio() {
  document.addEventListener('click', onFirstUserGesture);
  document.addEventListener('keydown', onFirstUserGesture);
}

function onFirstUserGesture() {
  unlockAudio();
  for (var index = 0; index < BOT_DAMAGE_VOICE_PATHS.length; index++) {
    var voice = getBotVoice(BOT_DAMAGE_VOICE_PATHS[index]);
    unlockBotVoiceFallback(voice);
    loadBotDamageVoice(voice.path);
  }
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
        var voicePaths = Object.keys(audio.botVoices);
        for (var index = 0; index < voicePaths.length; index++) {
          var voice = audio.botVoices[voicePaths[index]];
          if (voice.pending && voice.buffer !== null) {
            voice.pending = false;
            playBotDamageVoice(voice.path);
          }
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
