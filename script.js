/**
 * ============================================================================
 * КОНФІГУРАЦІЯ МЕДІА-ФАЙЛІВ ТА ЗВУКОВИХ ЕФЕКТІВ (SFX)
 * ============================================================================
 */
const CONFIG = {
  introVideo: 'Startplot.mp4',
  winVideo: 'GoodEnd.mp4',
  loseVideo: 'BadEnd.mp4',
  tableBgImage: '', // Якщо порожній — використовується вбудований стилізований стіл
  sounds: {
    cardDeal: 'sfx/card_deal.wav',
    cardFlip: 'sfx/card_flip.wav',
    cardFold: 'sfx/card_fold.wav',
    chipsBet: 'sfx/chips_bet.wav',
    chipsAllin: 'sfx/chips_allin.wav',
    chipsWin: 'sfx/chips_win.wav',
    checkTap: 'sfx/check_tap.wav',
    uiClick: 'sfx/ui_click.wav',
    roundWin: 'sfx/round_win.wav',
    roundLose: 'sfx/round_lose.wav'
  }
};

/**
 * Оперативна змінна розблокування «Вільної гри»
 * (Зберігається ТІЛЬКИ в пам'яті JS, без localStorage / sessionStorage)
 */
let isFreePlayUnlocked = false;

/**
 * ============================================================================
 * КОНСТАНТИ ТА СТАН ГРИ
 * ============================================================================
 */
const STARTING_STACK = 2000;
const SMALL_BLIND = 20;
const BIG_BLIND = 40;

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = [
  { rank: 2, str: '2' },
  { rank: 3, str: '3' },
  { rank: 4, str: '4' },
  { rank: 5, str: '5' },
  { rank: 6, str: '6' },
  { rank: 7, str: '7' },
  { rank: 8, str: '8' },
  { rank: 9, str: '9' },
  { rank: 10, str: '10' },
  { rank: 11, str: 'J' },
  { rank: 12, str: 'Q' },
  { rank: 13, str: 'K' },
  { rank: 14, str: 'A' }
];

const state = {
  mode: 'story', // 'story' | 'free'
  roundNumber: 0,
  playerLossesInFirstSix: 0,
  dealer: 'boss', // Чергується кожну роздачу (у 1-му та 7-му раундах дилером стає 'player')
  playerChips: STARTING_STACK,
  bossChips: STARTING_STACK,
  pot: 0,
  playerBet: 0,
  bossBet: 0,
  street: 'preflop', // 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
  deck: [],
  scriptedBoard: [],
  playerHand: [],
  bossHand: [],
  communityCards: [],
  turn: null, // 'player' | 'boss' | null
  lastRaiseSize: BIG_BLIND,
  playerActed: false,
  bossActed: false,
  bossRaisesThisStreet: 0,
  handInProgress: false,
  raiseDrawerOpen: false,
  isVideoPlaying: false,
  timers: []
};

/**
 * ============================================================================
 * DOM-ЕЛЕМЕНТИ
 * ============================================================================
 */
const dom = {
  startMenu: document.getElementById('start-menu'),
  menuBgCanvas: document.getElementById('menu-bg-canvas'),
  videoLayer: document.getElementById('video-layer'),
  cutsceneVideo: document.getElementById('cutscene-video'),
  preloadWinVideo: document.getElementById('preload-win-video'),
  preloadLoseVideo: document.getElementById('preload-lose-video'),
  gameScreen: document.getElementById('game-screen'),
  finalOverlay: document.getElementById('final-overlay'),
  finalTitle: document.getElementById('final-title'),
  finalDesc: document.getElementById('final-desc'),
  tableFelt: document.getElementById('poker-table-felt'),

  btnStory: document.getElementById('btn-story'),
  btnFreeplay: document.getElementById('btn-freeplay'),
  freeplayWrap: document.getElementById('freeplay-btn-wrap'),
  freeplayLockIcon: document.getElementById('freeplay-lock-icon'),
  btnBackMenu: document.getElementById('btn-back-menu'),

  bossZone: document.getElementById('boss-zone'),
  playerZone: document.getElementById('player-zone'),
  bossDealerBtn: document.getElementById('boss-dealer-btn'),
  playerDealerBtn: document.getElementById('player-dealer-btn'),
  bossChips: document.getElementById('boss-chips'),
  playerChips: document.getElementById('player-chips'),
  bossActionStatus: document.getElementById('boss-action-status'),
  playerActionStatus: document.getElementById('player-action-status'),

  bossCards: document.getElementById('boss-cards'),
  playerCards: document.getElementById('player-cards'),
  communityCards: document.getElementById('community-cards'),
  potAmount: document.getElementById('pot-amount'),

  roundResultBanner: document.getElementById('round-result-banner'),
  roundResultText: document.getElementById('round-result-text'),

  bossBetPill: document.getElementById('boss-bet-pill'),
  bossBetVal: document.getElementById('boss-bet-val'),
  playerBetPill: document.getElementById('player-bet-pill'),
  playerBetVal: document.getElementById('player-bet-val'),

  controlsBar: document.getElementById('controls-bar'),
  raisePanel: document.getElementById('raise-panel'),
  raiseSlider: document.getElementById('raise-slider'),
  raiseMinus: document.getElementById('raise-minus'),
  raisePlus: document.getElementById('raise-plus'),
  raiseDisplayVal: document.getElementById('raise-display-val'),
  presetBtns: document.querySelectorAll('.preset-btn'),

  btnFold: document.getElementById('btn-fold'),
  btnCheckCall: document.getElementById('btn-check-call'),
  checkCallMain: document.getElementById('check-call-main'),
  checkCallSub: document.getElementById('check-call-sub'),
  btnRaise: document.getElementById('btn-raise'),
  raiseBtnMain: document.getElementById('raise-btn-main'),
  raiseBtnSub: document.getElementById('raise-btn-sub'),
  btnAllin: document.getElementById('btn-allin'),
  allinSub: document.getElementById('allin-sub'),

  smokeCanvas: document.getElementById('smoke-canvas')
};

/**
 * ============================================================================
 * МЕНЕДЖЕР ЗВУКОВИХ ЕФЕКТІВ (SFX ENGINE)
 * ============================================================================
 */
const sfxTemplates = {};
const activeSfxNodes = new Set();

function initSounds() {
  if (!CONFIG.sounds) return;
  for (const [key, src] of Object.entries(CONFIG.sounds)) {
    if (!src) continue;
    const audio = new Audio(src);
    audio.preload = 'auto';
    sfxTemplates[key] = audio;
  }
}

function playSfx(key, volume = 0.85) {
  if (state.isVideoPlaying) return;
  const template = sfxTemplates[key];
  if (!template) return;

  try {
    const node = template.cloneNode();
    node.volume = Math.max(0, Math.min(1, volume));
    activeSfxNodes.add(node);

    const cleanup = () => {
      activeSfxNodes.delete(node);
      node.onended = null;
      node.onerror = null;
    };
    node.onended = cleanup;
    node.onerror = cleanup;

    const p = node.play();
    if (p !== undefined) {
      p.catch(() => cleanup());
    }
  } catch (e) {
    // Безпечно ігноруємо помилки авто-відтворення
  }
}

function stopAllSfx() {
  activeSfxNodes.forEach((node) => {
    try {
      node.pause();
      node.currentTime = 0;
    } catch (e) {
      // Ігноруємо
    }
  });
  activeSfxNodes.clear();
}

/**
 * ============================================================================
 * ІНІЦІАЛІЗАЦІЯ ДОДАТКУ
 * ============================================================================
 */
function initApp() {
  initSounds();
  syncFreePlayLockUI();

  // Застосувати кастомний фон столу, якщо задано в CONFIG
  if (CONFIG.tableBgImage && CONFIG.tableBgImage.trim() !== '') {
    dom.tableFelt.style.backgroundImage = `url('${CONFIG.tableBgImage.trim()}')`;
    dom.tableFelt.style.backgroundSize = 'cover';
    dom.tableFelt.style.backgroundPosition = 'center';
  }

  // Підготувати preload для відео
  if (CONFIG.introVideo) {
    dom.cutsceneVideo.src = CONFIG.introVideo;
    dom.cutsceneVideo.load();
  }
  if (CONFIG.winVideo) {
    dom.preloadWinVideo.src = CONFIG.winVideo;
  }
  if (CONFIG.loseVideo) {
    dom.preloadLoseVideo.src = CONFIG.loseVideo;
  }

  // Слухачі кнопок головного меню
  dom.btnStory.addEventListener('click', () => {
    playSfx('uiClick', 0.7);
    handleStartGame('story');
  });

  // Обробка кліку по кнопці «Вільна гра» (або її обгортці, коли кнопка disabled)
  dom.freeplayWrap.addEventListener('click', (e) => {
    if (!isFreePlayUnlocked) {
      e.preventDefault();
      playSfx('uiClick', 0.45);
      dom.freeplayWrap.classList.remove('shake-locked');
      // Примусовий reflow для перезапуску анімації shake
      void dom.freeplayWrap.offsetWidth;
      dom.freeplayWrap.classList.add('shake-locked');
      return;
    }
    playSfx('uiClick', 0.7);
    handleStartGame('free');
  });

  dom.btnBackMenu.addEventListener('click', () => {
    playSfx('uiClick', 0.75);
    returnToMainMenu();
  });

  // Слухачі панелі керування покером
  dom.btnFold.addEventListener('click', () => onPlayerAction('fold'));
  dom.btnCheckCall.addEventListener('click', () => onPlayerAction('check-call'));
  dom.btnRaise.addEventListener('click', onRaiseButtonClick);
  dom.btnAllin.addEventListener('click', () => onPlayerAction('allin'));

  // Слайдер та пресети рейзу
  dom.raiseSlider.addEventListener('input', updateRaiseDisplayFromSlider);
  dom.raiseMinus.addEventListener('click', () => {
    playSfx('uiClick', 0.55);
    stepRaiseSlider(-BIG_BLIND);
  });
  dom.raisePlus.addEventListener('click', () => {
    playSfx('uiClick', 0.55);
    stepRaiseSlider(BIG_BLIND);
  });
  dom.presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      playSfx('uiClick', 0.6);
      applyRaisePreset(btn.dataset.preset);
    });
  });

  // Запустити живий фон головного меню та дим з попільнички
  initMenuBackgroundCanvas();
  initSmokeAnimation();
}

function syncFreePlayLockUI() {
  if (isFreePlayUnlocked) {
    dom.btnFreeplay.disabled = false;
    dom.btnFreeplay.setAttribute('aria-disabled', 'false');
    dom.btnFreeplay.classList.remove('is-locked');
    dom.freeplayLockIcon.classList.add('hidden');
    dom.freeplayWrap.classList.remove('locked-cursor', 'shake-locked');
  } else {
    dom.btnFreeplay.disabled = true;
    dom.btnFreeplay.setAttribute('aria-disabled', 'true');
    dom.btnFreeplay.classList.add('is-locked');
    dom.freeplayLockIcon.classList.remove('hidden');
    dom.freeplayWrap.classList.add('locked-cursor');
  }
}

function unlockFreePlayMode() {
  isFreePlayUnlocked = true;
  syncFreePlayLockUI();
}

function registerTimeout(fn, delay) {
  const id = setTimeout(fn, delay);
  state.timers.push(id);
  return id;
}

function clearAllTimers() {
  state.timers.forEach((id) => clearTimeout(id));
  state.timers = [];
}

/**
 * Перехід у Fullscreen та блокування орієнтації (безпечно для iOS Safari)
 */
async function tryFullscreenAndLandscape() {
  try {
    const docEl = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    }
  } catch (err) {
    // Безпечно ігноруємо на iOS Safari
  }

  try {
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      await screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (err) {
    // Безпечно ігноруємо, якщо браузер не підтримує lock
  }
}

/**
 * Відтворення повноекранних відео-вставок (Startplot.mp4, GoodEnd.mp4, BadEnd.mp4)
 */
function playFullscreenVideo(videoPath, onFinished, fadeOutOnEnd = false) {
  // Гарантуємо, що жодні ігрові SFX не накладаються на відео
  stopAllSfx();
  state.isVideoPlaying = true;

  const video = dom.cutsceneVideo;
  let finished = false;
  let triedAltCase = false;

  const getAlternateCasePath = (path) => {
    const lower = path.toLowerCase();
    if (lower === 'startplot.mp4') {
      return path === 'Startplot.mp4' ? 'StartPlot.mp4' : 'Startplot.mp4';
    }
    if (lower === 'goodend.mp4') {
      return path === 'GoodEnd.mp4' ? 'goodend.mp4' : 'GoodEnd.mp4';
    }
    if (lower === 'badend.mp4') {
      return path === 'BadEnd.mp4' ? 'badend.mp4' : 'BadEnd.mp4';
    }
    return null;
  };

  const complete = () => {
    if (finished) return;
    finished = true;
    video.onended = null;
    video.onerror = null;

    if (fadeOutOnEnd) {
      dom.videoLayer.classList.add('fade-out');
      registerTimeout(() => {
        video.pause();
        state.isVideoPlaying = false;
        dom.videoLayer.classList.remove('active', 'fade-out');
        dom.videoLayer.classList.add('hidden');
        if (onFinished) onFinished();
      }, 850);
    } else {
      video.pause();
      state.isVideoPlaying = false;
      dom.videoLayer.classList.remove('active', 'fade-out');
      dom.videoLayer.classList.add('hidden');
      if (onFinished) onFinished();
    }
  };

  dom.videoLayer.classList.remove('hidden', 'fade-out');
  dom.videoLayer.classList.add('active');

  video.muted = false;
  video.volume = 1.0;
  video.controls = false;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');

  video.onended = () => complete();

  video.onerror = () => {
    const altPath = getAlternateCasePath(videoPath);
    if (!triedAltCase && altPath) {
      triedAltCase = true;
      video.src = altPath;
      video.load();
      const p = video.play();
      if (p !== undefined) {
        p.catch(() => complete());
      }
      return;
    }
    complete();
  };

  const currentSrcAttr = video.getAttribute('src');
  if (currentSrcAttr !== videoPath) {
    video.src = videoPath;
    video.load();
  } else {
    try {
      video.currentTime = 0;
    } catch (e) {
      // Ігноруємо якщо метадані ще не завантажені
    }
  }

  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      video.muted = true;
      video.play().catch(() => complete());
    });
  }
}

/**
 * ============================================================================
 * СТАРТ ГРИ ТА ПЕРЕХОДИ МІЖ ЕКРАНАМИ
 * ============================================================================
 */
function handleStartGame(mode) {
  tryFullscreenAndLandscape();
  clearAllTimers();

  state.mode = mode;
  state.roundNumber = 0;
  state.playerLossesInFirstSix = 0;
  state.playerChips = STARTING_STACK;
  state.bossChips = STARTING_STACK;
  // Встановлюємо 'boss', щоб на старті 1-го раунду дилером став 'player' (і в 7-му раунді також 'player')
  state.dealer = 'boss';

  dom.startMenu.classList.remove('active');
  dom.startMenu.classList.add('hidden');
  dom.finalOverlay.classList.remove('active');
  dom.finalOverlay.classList.add('hidden');

  if (mode === 'story') {
    dom.gameScreen.classList.remove('hidden');
    dom.gameScreen.classList.add('active');
    resetTableUIForNewGame();

    playFullscreenVideo(
      CONFIG.introVideo,
      () => {
        startNextHand();
      },
      true
    );
  } else {
    dom.gameScreen.classList.remove('hidden');
    dom.gameScreen.classList.add('active');
    resetTableUIForNewGame();
    startNextHand();
  }
}

function resetTableUIForNewGame() {
  clearCardSlots();
  hideResultBanner();
  clearZoneHighlights();
  dom.potAmount.textContent = '0';
  dom.bossChips.textContent = STARTING_STACK;
  dom.playerChips.textContent = STARTING_STACK;
  dom.bossBetPill.classList.add('hidden');
  dom.playerBetPill.classList.add('hidden');
  setBossStatus('Очікування', '');
  dom.playerActionStatus.classList.add('hidden');
  setControlsEnabled(false);
}

function returnToMainMenu() {
  clearAllTimers();
  stopAllSfx();
  state.handInProgress = false;
  state.isVideoPlaying = false;

  dom.videoLayer.classList.remove('active', 'fade-out');
  dom.videoLayer.classList.add('hidden');
  dom.cutsceneVideo.pause();

  dom.gameScreen.classList.remove('active');
  dom.gameScreen.classList.add('hidden');

  dom.finalOverlay.classList.remove('active');
  dom.finalOverlay.classList.add('hidden');

  syncFreePlayLockUI();
  dom.startMenu.classList.remove('hidden');
  dom.startMenu.classList.add('active');
}

function showFinalOverlay(title, desc) {
  setControlsEnabled(false);
  dom.finalTitle.textContent = title;
  dom.finalDesc.textContent = desc;
  dom.finalOverlay.classList.remove('hidden');
  dom.finalOverlay.classList.add('active');
}

/**
 * ============================================================================
 * КОЛОДА, КАРТИ ТА ВІЗУАЛЬНІ ЕФЕКТИ СТОЛУ
 * ============================================================================
 */
function createShuffledDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const r of RANKS) {
      deck.push({ rank: r.rank, rankStr: r.str, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }
  return deck;
}

function createCardElement(card, faceUp = true, delayMs = 0) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  const suitClass = isRed ? 'suit-red' : 'suit-black';

  const cardEl = document.createElement('div');
  cardEl.className = `playing-card ${faceUp ? 'face-up' : 'face-down'}`;
  cardEl.dataset.cardKey = `${card.rankStr}${card.suit}`;
  if (delayMs > 0) {
    cardEl.style.animationDelay = `${delayMs}ms`;
  }

  cardEl.innerHTML = `
    <div class="card-face card-front ${suitClass}">
      <div class="card-corner top-left">
        <span class="card-rank">${card.rankStr}</span>
        <span class="card-suit-mini">${card.suit}</span>
      </div>
      <div class="card-suit-center">${card.suit}</div>
      <div class="card-corner bottom-right">
        <span class="card-rank">${card.rankStr}</span>
        <span class="card-suit-mini">${card.suit}</span>
      </div>
    </div>
    <div class="card-face card-back"></div>
  `;
  return cardEl;
}

function clearCardSlots() {
  dom.bossCards.querySelectorAll('.card-slot').forEach((s) => (s.innerHTML = ''));
  dom.playerCards.querySelectorAll('.card-slot').forEach((s) => (s.innerHTML = ''));
  dom.communityCards.querySelectorAll('.comm-slot').forEach((s) => (s.innerHTML = ''));
}

function showResultBanner(text, variantClass = '') {
  dom.roundResultText.textContent = text;
  dom.roundResultBanner.className = 'result-banner';
  if (variantClass) {
    dom.roundResultBanner.classList.add(variantClass);
  }
}

function hideResultBanner() {
  dom.roundResultBanner.className = 'result-banner hidden';
  dom.roundResultText.textContent = '';
}

function setZoneHighlights(winner) {
  clearZoneHighlights();
  if (winner === 'player') {
    dom.playerZone.classList.add('winner-zone');
    dom.bossZone.classList.add('loser-zone');
  } else if (winner === 'boss') {
    dom.bossZone.classList.add('winner-zone');
    dom.playerZone.classList.add('loser-zone');
  }
}

function clearZoneHighlights() {
  dom.playerZone.classList.remove('winner-zone', 'loser-zone');
  dom.bossZone.classList.remove('winner-zone', 'loser-zone');
}

/**
 * Перехід між раундами: прибираємо старі карти й витримуємо паузу ~0.6с перед новою роздачею
 */
function transitionToNextHand() {
  clearAllTimers();
  clearCardSlots();
  hideResultBanner();
  clearZoneHighlights();
  dom.playerActionStatus.classList.add('hidden');
  dom.bossBetPill.classList.add('hidden');
  dom.playerBetPill.classList.add('hidden');
  setBossStatus('Підготовка...', '');

  registerTimeout(() => {
    startNextHand();
  }, 620);
}

/**
 * ============================================================================
 * ПОЧАТОК РОЗДАЧІ ТА КЕРУВАННЯ РАУНДАМИ (СЮЖЕТ ТА ВІЛЬНА ГРА)
 * ============================================================================
 */
function startNextHand() {
  clearAllTimers();

  // ПЕРЕВІРКА УМОВ СЮЖЕТНОГО РЕЖИМУ ПЕРЕД СТАРТОМ НОВОГО РАУНДУ
  if (state.mode === 'story') {
    // 1. Якщо гравець втратив усі фішки (playerChips <= 0) у будь-якому з раундів 1–6
    if (state.playerChips <= 0) {
      triggerStoryBadEnding();
      return;
    }

    // 2. Після завершення 6-го раунду (перед початком 7-го):
    //    - менше 100 фішок (playerChips < 100) -> BadEnd.mp4
    //    - кількість поразок у перших 6 роздачах становить 5 або 6 (playerLossesInFirstSix >= 5) -> BadEnd.mp4
    if (state.roundNumber === 6) {
      if (state.playerChips < 100 || state.playerLossesInFirstSix >= 5) {
        triggerStoryBadEnding();
        return;
      }
    }

    // Захист від раннього вильоту боса в раундах 1–6: непомітне поповнення стеку
    if (state.bossChips <= 0) {
      state.bossChips = STARTING_STACK;
    }

    // Перед 7-м раундом гарантуємо, що стек боса дозволяє покрити All-in гравця
    if (state.roundNumber === 6) {
      if (state.bossChips < state.playerChips) {
        state.bossChips = Math.max(state.playerChips, STARTING_STACK);
      }
    }
  } else {
    // Вільна гра: перевірка на завершення партії
    if (state.playerChips <= 0) {
      showFinalOverlay('Ви програли стек', 'Бос забрав усі фішки за цим столом.');
      return;
    }
    if (state.bossChips <= 0) {
      showFinalOverlay('Перемога за столом', 'Бос залишився без фішок. Ви обіграли казино.');
      return;
    }
  }

  state.roundNumber += 1;
  state.dealer = state.dealer === 'player' ? 'boss' : 'player';
  state.pot = 0;
  state.playerBet = 0;
  state.bossBet = 0;
  state.street = 'preflop';
  state.communityCards = [];
  state.playerActed = false;
  state.bossActed = false;
  state.bossRaisesThisStreet = 0;
  state.lastRaiseSize = BIG_BLIND;
  state.handInProgress = true;
  closeRaiseDrawer();

  clearCardSlots();
  hideResultBanner();
  clearZoneHighlights();
  dom.playerActionStatus.classList.add('hidden');
  setBossStatus('Роздача...', '');

  const isScriptedRound7 = state.mode === 'story' && state.roundNumber === 7;
  if (isScriptedRound7) {
    // У 7-му раунді гравець завжди ходить першим на Pre-flop, де активна лише кнопка All-in
    state.dealer = 'player';
  }

  // Оновлення фішки дилера
  if (state.dealer === 'player') {
    dom.playerDealerBtn.classList.remove('hidden');
    dom.bossDealerBtn.classList.add('hidden');
  } else {
    dom.bossDealerBtn.classList.remove('hidden');
    dom.playerDealerBtn.classList.add('hidden');
  }

  // Підготовка колоди (Заскриптований 7-й раунд vs Чесна колода)
  if (isScriptedRound7) {
    state.playerHand = [
      { rank: 13, rankStr: 'K', suit: '♥' },
      { rank: 10, rankStr: '10', suit: '♥' }
    ];
    state.bossHand = [
      { rank: 14, rankStr: 'A', suit: '♠' },
      { rank: 14, rankStr: 'A', suit: '♦' }
    ];
    state.scriptedBoard = [
      { rank: 14, rankStr: 'A', suit: '♥' }, // Flop 1
      { rank: 5, rankStr: '5', suit: '♦' },  // Flop 2
      { rank: 11, rankStr: 'J', suit: '♥' }, // Flop 3
      { rank: 10, rankStr: '10', suit: '♣' }, // Turn
      { rank: 12, rankStr: 'Q', suit: '♥' }  // River
    ];
    state.deck = [];
  } else {
    state.deck = createShuffledDeck();
    state.playerHand = [state.deck.pop(), state.deck.pop()];
    state.bossHand = [state.deck.pop(), state.deck.pop()];
    state.scriptedBoard = [];
  }

  // Стягнення блайндів (Дилер = Малий Блайнд, Опонент = Великий Блайнд)
  if (state.dealer === 'player') {
    postBet('player', SMALL_BLIND);
    postBet('boss', BIG_BLIND);
  } else {
    postBet('boss', SMALL_BLIND);
    postBet('player', BIG_BLIND);
  }

  updateHUD();

  // Анімація та звук роздачі кишенькових карт
  const playerSlots = dom.playerCards.querySelectorAll('.card-slot');
  const bossSlots = dom.bossCards.querySelectorAll('.card-slot');

  const dealSchedule = [
    { slot: playerSlots[0], card: state.playerHand[0], faceUp: true, delay: 40 },
    { slot: bossSlots[0], card: state.bossHand[0], faceUp: false, delay: 140 },
    { slot: playerSlots[1], card: state.playerHand[1], faceUp: true, delay: 240 },
    { slot: bossSlots[1], card: state.bossHand[1], faceUp: false, delay: 340 }
  ];

  dealSchedule.forEach((item) => {
    item.slot.appendChild(createCardElement(item.card, item.faceUp, item.delay));
    registerTimeout(() => playSfx('cardDeal', 0.75), item.delay);
  });

  registerTimeout(() => {
    // Якщо в звичайному раунді хтось уже в All-in на блайндах
    if (!isScriptedRound7 && (state.playerChips === 0 || state.bossChips === 0)) {
      if (state.playerBet === state.bossBet || (state.playerChips === 0 && state.bossChips === 0)) {
        normalizeUncalledExcess();
        runOutRemainingBoardToShowdown();
        return;
      }
    }

    const firstActor = state.dealer;
    setTurn(firstActor);
  }, 480);
}

function postBet(who, amount) {
  if (who === 'player') {
    const actual = Math.min(amount, state.playerChips);
    state.playerChips -= actual;
    state.playerBet += actual;
    state.pot += actual;
    return actual;
  } else {
    const actual = Math.min(amount, state.bossChips);
    state.bossChips -= actual;
    state.bossBet += actual;
    state.pot += actual;
    return actual;
  }
}

/**
 * Повернення непокритих фішок понад стек противника при All-in
 */
function normalizeUncalledExcess() {
  if (state.playerBet > state.bossBet && state.bossChips === 0) {
    const excess = state.playerBet - state.bossBet;
    state.playerBet -= excess;
    state.playerChips += excess;
    state.pot -= excess;
  } else if (state.bossBet > state.playerBet && state.playerChips === 0) {
    const excess = state.bossBet - state.playerBet;
    state.bossBet -= excess;
    state.bossChips += excess;
    state.pot -= excess;
  }
  updateHUD();
}

/**
 * ============================================================================
 * ОНОВЛЕННЯ HUD ТА ПАНЕЛІ КЕРУВАННЯ
 * ============================================================================
 */
function updateHUD() {
  dom.bossChips.textContent = state.bossChips;
  dom.playerChips.textContent = state.playerChips;
  dom.potAmount.textContent = state.pot;

  if (state.bossBet > 0) {
    dom.bossBetVal.textContent = state.bossBet;
    dom.bossBetPill.classList.remove('hidden');
  } else {
    dom.bossBetPill.classList.add('hidden');
  }

  if (state.playerBet > 0) {
    dom.playerBetVal.textContent = state.playerBet;
    dom.playerBetPill.classList.remove('hidden');
  } else {
    dom.playerBetPill.classList.add('hidden');
  }

  updateControlButtons();
}

function setBossStatus(text, typeClass = '') {
  dom.bossActionStatus.textContent = text;
  dom.bossActionStatus.className = 'action-pill';
  if (typeClass) {
    dom.bossActionStatus.classList.add(typeClass);
  }
}

function setPlayerStatus(text, typeClass = '') {
  dom.playerActionStatus.textContent = text;
  dom.playerActionStatus.className = 'action-pill';
  if (typeClass) {
    dom.playerActionStatus.classList.add(typeClass);
  }
}

function setControlsEnabled(enabled) {
  if (enabled) {
    dom.controlsBar.classList.remove('controls-disabled');
    updateControlButtons();
  } else {
    dom.controlsBar.classList.add('controls-disabled');
    closeRaiseDrawer();
  }
}

function getRaiseBoundsForPlayer() {
  const currentMaxBet = Math.max(state.playerBet, state.bossBet);
  const toCall = Math.max(0, currentMaxBet - state.playerBet);
  const maxPossibleTotalBet = state.playerBet + state.playerChips;
  const bossEffectiveMax = state.bossBet + state.bossChips;
  const maxTotalBet = Math.min(maxPossibleTotalBet, bossEffectiveMax);

  const minRaiseDelta = Math.max(BIG_BLIND, state.lastRaiseSize);
  const minTotalBet = Math.min(currentMaxBet + minRaiseDelta, maxTotalBet);

  const canRaise =
    state.playerChips > toCall &&
    state.bossChips > 0 &&
    maxTotalBet > currentMaxBet;

  return {
    currentMaxBet,
    toCall,
    minTotalBet,
    maxTotalBet,
    canRaise
  };
}

function updateControlButtons() {
  const isScriptedRound7 = state.mode === 'story' && state.roundNumber === 7;

  // У 7-му раунді сюжетного режиму активною є ТІЛЬКИ кнопка All-in
  if (isScriptedRound7) {
    dom.btnFold.disabled = true;
    dom.btnCheckCall.disabled = true;
    dom.btnRaise.disabled = true;

    dom.checkCallMain.textContent = 'Call';
    dom.checkCallSub.textContent = '—';
    dom.raiseBtnMain.textContent = 'Raise';
    dom.raiseBtnSub.textContent = '—';

    dom.btnAllin.disabled = state.playerChips <= 0;
    dom.btnAllin.classList.add('climax-pulse');
    dom.allinSub.textContent = state.playerChips > 0 ? `${state.playerChips}` : '0';
    return;
  }

  dom.btnAllin.classList.remove('climax-pulse');
  dom.btnFold.disabled = false;
  dom.btnCheckCall.disabled = false;

  const { currentMaxBet, toCall, minTotalBet, maxTotalBet, canRaise } = getRaiseBoundsForPlayer();

  // Check / Call кнопка
  if (toCall <= 0) {
    dom.checkCallMain.textContent = 'Check';
    dom.checkCallSub.textContent = 'Чек';
  } else {
    const callAmt = Math.min(toCall, state.playerChips);
    dom.checkCallMain.textContent = 'Call';
    dom.checkCallSub.textContent = `${callAmt}`;
  }

  // Raise кнопка
  dom.btnRaise.disabled = !canRaise;
  if (canRaise) {
    dom.raiseSlider.min = minTotalBet;
    dom.raiseSlider.max = maxTotalBet;
    dom.raiseSlider.step = SMALL_BLIND;

    const curVal = Number(dom.raiseSlider.value);
    if (curVal < minTotalBet || curVal > maxTotalBet) {
      dom.raiseSlider.value = minTotalBet;
    }
    dom.raiseDisplayVal.textContent = dom.raiseSlider.value;

    if (state.raiseDrawerOpen) {
      dom.raiseBtnMain.textContent = `Raise ${dom.raiseSlider.value}`;
      dom.raiseBtnSub.textContent = 'Підтвердити';
    } else {
      dom.raiseBtnMain.textContent = currentMaxBet === 0 ? 'Bet' : 'Raise';
      dom.raiseBtnSub.textContent = `від ${minTotalBet}`;
    }
  } else {
    dom.raiseBtnMain.textContent = 'Raise';
    dom.raiseBtnSub.textContent = 'Недоступно';
  }

  // All-in кнопка
  dom.btnAllin.disabled = state.playerChips <= 0;
  dom.allinSub.textContent = state.playerChips > 0 ? `${state.playerChips}` : '0';
}

function onRaiseButtonClick() {
  if (state.turn !== 'player') return;
  if (state.mode === 'story' && state.roundNumber === 7) return;

  const { canRaise } = getRaiseBoundsForPlayer();
  if (!canRaise) return;

  if (!state.raiseDrawerOpen) {
    playSfx('uiClick', 0.65);
    state.raiseDrawerOpen = true;
    dom.raisePanel.classList.remove('hidden');
    dom.btnRaise.classList.add('active-drawer');
    updateControlButtons();
  } else {
    const targetTotalBet = Number(dom.raiseSlider.value);
    closeRaiseDrawer();
    onPlayerAction('raise', targetTotalBet);
  }
}

function closeRaiseDrawer() {
  state.raiseDrawerOpen = false;
  dom.raisePanel.classList.add('hidden');
  dom.btnRaise.classList.remove('active-drawer');
  updateControlButtons();
}

function updateRaiseDisplayFromSlider() {
  dom.raiseDisplayVal.textContent = dom.raiseSlider.value;
  if (state.raiseDrawerOpen) {
    dom.raiseBtnMain.textContent = `Raise ${dom.raiseSlider.value}`;
  }
}

function stepRaiseSlider(delta) {
  const min = Number(dom.raiseSlider.min);
  const max = Number(dom.raiseSlider.max);
  let next = Number(dom.raiseSlider.value) + delta;
  next = Math.max(min, Math.min(max, next));
  dom.raiseSlider.value = next;
  updateRaiseDisplayFromSlider();
}

function applyRaisePreset(preset) {
  const { currentMaxBet, minTotalBet, maxTotalBet } = getRaiseBoundsForPlayer();
  let val = minTotalBet;

  if (preset === 'min') {
    val = minTotalBet;
  } else if (preset === 'half') {
    val = currentMaxBet + Math.round((state.pot * 0.5) / SMALL_BLIND) * SMALL_BLIND;
  } else if (preset === 'pot') {
    val = currentMaxBet + state.pot;
  } else if (preset === 'max') {
    val = maxTotalBet;
  }

  val = Math.max(minTotalBet, Math.min(maxTotalBet, val));
  dom.raiseSlider.value = val;
  updateRaiseDisplayFromSlider();
}

/**
 * ============================================================================
 * ХОДИ ТА ТОРГИ (BETTING STREETS)
 * ============================================================================
 */
function setTurn(who) {
  state.turn = who;
  updateHUD();

  if (who === 'player') {
    setControlsEnabled(true);
  } else if (who === 'boss') {
    setControlsEnabled(false);
    setBossStatus('Думає...', '');
    const thinkDelay = 850 + Math.floor(Math.random() * 650);
    registerTimeout(() => executeBossTurn(), thinkDelay);
  } else {
    setControlsEnabled(false);
  }
}

function onPlayerAction(actionType, raiseToAmount = 0) {
  if (state.turn !== 'player' || !state.handInProgress) return;

  const isScriptedRound7 = state.mode === 'story' && state.roundNumber === 7;
  // У 7-му раунді дозволено тільки All-in
  if (isScriptedRound7 && actionType !== 'allin') {
    return;
  }

  setControlsEnabled(false);

  const currentMaxBet = Math.max(state.playerBet, state.bossBet);
  const toCall = Math.max(0, currentMaxBet - state.playerBet);

  if (actionType === 'fold') {
    playSfx('cardFold', 0.85);
    setPlayerStatus('Fold', 'act-fold');
    handleFold('player');
    return;
  }

  if (actionType === 'check-call') {
    if (toCall <= 0) {
      playSfx('checkTap', 0.85);
      state.playerActed = true;
      setPlayerStatus('Check', 'act-check');
    } else {
      const added = postBet('player', toCall);
      state.playerActed = true;
      if (state.playerChips === 0) {
        playSfx('chipsAllin', 0.9);
        setPlayerStatus(`All-in ${state.playerBet}`, 'act-allin');
      } else {
        playSfx('chipsBet', 0.85);
        setPlayerStatus(`Call ${added}`, 'act-call');
      }
    }
    updateHUD();
    advanceBettingAfterAction('player');
    return;
  }

  if (actionType === 'raise') {
    const { minTotalBet, maxTotalBet } = getRaiseBoundsForPlayer();
    const targetTotal = Math.max(minTotalBet, Math.min(maxTotalBet, raiseToAmount));
    const needed = targetTotal - state.playerBet;
    const prevMax = currentMaxBet;

    postBet('player', needed);
    const raiseDiff = state.playerBet - prevMax;
    if (raiseDiff > 0) {
      state.lastRaiseSize = Math.max(state.lastRaiseSize, raiseDiff);
    }

    state.playerActed = true;
    state.bossActed = false;

    if (state.playerChips === 0) {
      playSfx('chipsAllin', 0.9);
      setPlayerStatus(`All-in ${state.playerBet}`, 'act-allin');
    } else {
      playSfx('chipsBet', 0.88);
      setPlayerStatus(`Raise ${state.playerBet}`, 'act-raise');
    }
    updateHUD();
    advanceBettingAfterAction('player');
    return;
  }

  if (actionType === 'allin') {
    const prevMax = currentMaxBet;
    postBet('player', state.playerChips);
    const raiseDiff = state.playerBet - prevMax;
    if (raiseDiff > 0) {
      state.lastRaiseSize = Math.max(state.lastRaiseSize, raiseDiff);
      state.bossActed = false;
    }
    state.playerActed = true;
    playSfx('chipsAllin', 0.95);
    setPlayerStatus(`All-in ${state.playerBet}`, 'act-allin');
    updateHUD();
    advanceBettingAfterAction('player');
  }
}

function advanceBettingAfterAction(lastActor) {
  const nextActor = lastActor === 'player' ? 'boss' : 'player';

  const betsEqual = state.playerBet === state.bossBet;
  const playerAllIn = state.playerChips === 0;
  const bossAllIn = state.bossChips === 0;

  if (betsEqual && state.playerActed && state.bossActed) {
    endBettingStreet();
    return;
  }

  if (
    (playerAllIn && state.bossBet >= state.playerBet && state.bossActed) ||
    (bossAllIn && state.playerBet >= state.bossBet && state.playerActed)
  ) {
    normalizeUncalledExcess();
    endBettingStreet();
    return;
  }

  setTurn(nextActor);
}

function endBettingStreet() {
  state.turn = null;
  setControlsEnabled(false);
  normalizeUncalledExcess();

  if (state.street === 'river') {
    registerTimeout(() => handleShowdown(), 550);
    return;
  }

  // Якщо хоча б один гравець в All-in — автоматично довідкриваємо карти столу до Showdown
  if (state.playerChips === 0 || state.bossChips === 0) {
    runOutRemainingBoardToShowdown();
    return;
  }

  registerTimeout(() => dealNextStreet(), 600);
}

function dealNextStreet() {
  state.playerBet = 0;
  state.bossBet = 0;
  state.playerActed = false;
  state.bossActed = false;
  state.bossRaisesThisStreet = 0;
  state.lastRaiseSize = BIG_BLIND;
  dom.playerActionStatus.classList.add('hidden');
  updateHUD();

  const isScriptedRound7 = state.mode === 'story' && state.roundNumber === 7;
  const commSlots = dom.communityCards.querySelectorAll('.comm-slot');

  if (state.street === 'preflop') {
    state.street = 'flop';
    for (let i = 0; i < 3; i++) {
      const card = isScriptedRound7 ? state.scriptedBoard[i] : state.deck.pop();
      state.communityCards.push(card);
      const delay = i * 120;
      commSlots[i].appendChild(createCardElement(card, true, delay));
      registerTimeout(() => playSfx('cardDeal', 0.78), delay);
    }
  } else if (state.street === 'flop') {
    state.street = 'turn';
    const card = isScriptedRound7 ? state.scriptedBoard[3] : state.deck.pop();
    state.communityCards.push(card);
    commSlots[3].appendChild(createCardElement(card, true, 0));
    playSfx('cardDeal', 0.8);
  } else if (state.street === 'turn') {
    state.street = 'river';
    const card = isScriptedRound7 ? state.scriptedBoard[4] : state.deck.pop();
    state.communityCards.push(card);
    commSlots[4].appendChild(createCardElement(card, true, 0));
    playSfx('cardDeal', 0.8);
  }

  const postFlopFirst = state.dealer === 'player' ? 'boss' : 'player';
  registerTimeout(() => setTurn(postFlopFirst), 480);
}

/**
 * Автоматичне покрокове відкриття карт столу при All-in Showdown.
 * У 7-му раунді витримує напружені паузи ~1.8 секунди між Flop -> Turn -> River.
 */
function runOutRemainingBoardToShowdown() {
  state.turn = null;
  setControlsEnabled(false);

  const isScriptedRound7 = state.mode === 'story' && state.roundNumber === 7;
  const stagePauseMs = isScriptedRound7 ? 1800 : 1250;
  const commSlots = dom.communityCards.querySelectorAll('.comm-slot');

  const dealStep = () => {
    state.playerBet = 0;
    state.bossBet = 0;
    updateHUD();

    if (state.communityCards.length === 0) {
      state.street = 'flop';
      for (let i = 0; i < 3; i++) {
        const card = isScriptedRound7 ? state.scriptedBoard[i] : state.deck.pop();
        state.communityCards.push(card);
        const delay = i * 130;
        commSlots[i].appendChild(createCardElement(card, true, delay));
        registerTimeout(() => playSfx('cardDeal', 0.8), delay);
      }
      registerTimeout(dealStep, stagePauseMs);
    } else if (state.communityCards.length === 3) {
      state.street = 'turn';
      const card = isScriptedRound7 ? state.scriptedBoard[3] : state.deck.pop();
      state.communityCards.push(card);
      commSlots[3].appendChild(createCardElement(card, true, 0));
      playSfx('cardDeal', 0.82);
      registerTimeout(dealStep, stagePauseMs);
    } else if (state.communityCards.length === 4) {
      state.street = 'river';
      const card = isScriptedRound7 ? state.scriptedBoard[4] : state.deck.pop();
      state.communityCards.push(card);
      commSlots[4].appendChild(createCardElement(card, true, 0));
      playSfx('cardDeal', 0.85);
      registerTimeout(() => handleShowdown(), stagePauseMs);
    } else {
      registerTimeout(() => handleShowdown(), 700);
    }
  };

  registerTimeout(dealStep, 650);
}

/**
 * Обробка пасу (Fold) із паузою 2.2 секунди та чітким повідомленням
 */
function handleFold(whoFolded) {
  state.handInProgress = false;
  state.turn = null;
  setControlsEnabled(false);

  const wonPot = state.pot;

  if (whoFolded === 'player') {
    // Поразка гравця в раундах 1–6
    if (state.mode === 'story' && state.roundNumber >= 1 && state.roundNumber <= 6) {
      state.playerLossesInFirstSix += 1;
    }
    state.bossChips += wonPot;
    setZoneHighlights('boss');
    showResultBanner(`ТИ СКИНУВ КАРТИ • БОС ЗАБРАВ БАНК +${wonPot}`, 'banner-boss-win');
    playSfx('chipsWin', 0.78);
    playSfx('roundLose', 0.75);
  } else {
    state.playerChips += wonPot;
    setZoneHighlights('player');
    showResultBanner(`БОС СКИНУВ КАРТИ • ТИ ВИГРАВ РАУНД +${wonPot}`, '');
    playSfx('chipsWin', 0.82);
    playSfx('roundWin', 0.75);
  }

  state.pot = 0;
  state.playerBet = 0;
  state.bossBet = 0;
  updateHUD();

  // Пауза після Fold: 2.2 секунди (2–2.5с)
  registerTimeout(() => {
    transitionToNextHand();
  }, 2250);
}

/**
 * ============================================================================
 * ШТУЧНИЙ ІНТЕЛЕКТ БОСА (BOSS AI)
 * ============================================================================
 */
function executeBossTurn() {
  if (!state.handInProgress || state.turn !== 'boss') return;

  const currentMaxBet = Math.max(state.playerBet, state.bossBet);
  const toCall = Math.max(0, currentMaxBet - state.bossBet);
  const isScriptedRound7 = state.mode === 'story' && state.roundNumber === 7;

  // У 7-му раунді гравець іде All-in, а Бос одразу робить Call на еквівалентну суму
  if (isScriptedRound7) {
    const exactToCall = Math.max(0, state.playerBet - state.bossBet);
    const callAmount = Math.min(exactToCall, state.bossChips);
    state.bossActed = true;

    if (callAmount > 0) {
      postBet('boss', callAmount);
      playSfx('chipsAllin', 0.92);
      setBossStatus(`Call ${callAmount}`, 'act-allin');
    } else {
      playSfx('checkTap', 0.8);
      setBossStatus('Check', 'act-check');
    }

    normalizeUncalledExcess();
    updateHUD();
    advanceBettingAfterAction('boss');
    return;
  }

  // СТАНДАРТНИЙ ШІ БОСА (Раунди 1–6 та Вільна гра)
  const strength = estimateBossHandStrength();
  const potOdds = toCall > 0 ? toCall / (state.pot + toCall) : 0;
  const maxEffectiveAdd = Math.min(state.bossChips, toCall + state.playerChips);
  const canBossRaise =
    state.bossRaisesThisStreet < 2 &&
    maxEffectiveAdd > toCall &&
    state.playerChips > 0;

  const rng = Math.random();

  if (toCall === 0) {
    const wantsToBet =
      (strength >= 0.68 && rng < 0.82) ||
      (strength >= 0.52 && rng < 0.45) ||
      (strength < 0.35 && rng < 0.16);

    if (wantsToBet && canBossRaise) {
      const betFactor = strength > 0.75 ? 0.65 : 0.45;
      const rawBet = Math.max(BIG_BLIND, Math.round((state.pot * betFactor) / SMALL_BLIND) * SMALL_BLIND);
      const targetTotal = Math.min(state.bossBet + maxEffectiveAdd, state.bossBet + rawBet);
      if (targetTotal > currentMaxBet) {
        bossRaiseTo(targetTotal);
        return;
      }
    }
    bossCallOrCheck(0);
    return;
  }

  // Коли гравець зробив ставку або рейз (toCall > 0)
  if (strength >= 0.76) {
    if (canBossRaise && rng < 0.65) {
      const raiseSize = Math.max(state.lastRaiseSize, Math.round((state.pot * 0.6) / SMALL_BLIND) * SMALL_BLIND);
      const targetTotal = Math.min(state.bossBet + maxEffectiveAdd, currentMaxBet + raiseSize);
      if (targetTotal > currentMaxBet) {
        bossRaiseTo(targetTotal);
        return;
      }
    }
    bossCallOrCheck(toCall);
    return;
  }

  if (strength >= 0.46 || (strength >= 0.32 && potOdds <= 0.28)) {
    if (canBossRaise && strength >= 0.56 && rng < 0.15 && toCall <= BIG_BLIND * 3) {
      const targetTotal = Math.min(state.bossBet + maxEffectiveAdd, currentMaxBet + Math.max(state.lastRaiseSize, BIG_BLIND * 2));
      if (targetTotal > currentMaxBet) {
        bossRaiseTo(targetTotal);
        return;
      }
    }
    bossCallOrCheck(toCall);
    return;
  }

  if (toCall <= SMALL_BLIND && rng < 0.55) {
    bossCallOrCheck(toCall);
    return;
  }

  // Бос скидає карти (Fold)
  playSfx('cardFold', 0.85);
  setBossStatus('Fold', 'act-fold');
  handleFold('boss');
}

function bossCallOrCheck(toCall) {
  state.bossActed = true;
  if (toCall <= 0) {
    playSfx('checkTap', 0.85);
    setBossStatus('Check', 'act-check');
  } else {
    const added = postBet('boss', toCall);
    if (state.bossChips === 0) {
      playSfx('chipsAllin', 0.9);
      setBossStatus(`All-in ${state.bossBet}`, 'act-allin');
    } else {
      playSfx('chipsBet', 0.85);
      setBossStatus(`Call ${added}`, 'act-call');
    }
  }
  updateHUD();
  advanceBettingAfterAction('boss');
}

function bossRaiseTo(targetTotal) {
  const currentMaxBet = Math.max(state.playerBet, state.bossBet);
  const needed = Math.max(0, targetTotal - state.bossBet);
  postBet('boss', needed);

  const raiseDiff = state.bossBet - currentMaxBet;
  if (raiseDiff > 0) {
    state.lastRaiseSize = Math.max(state.lastRaiseSize, raiseDiff);
  }

  state.bossRaisesThisStreet += 1;
  state.bossActed = true;
  state.playerActed = false;

  if (state.bossChips === 0) {
    playSfx('chipsAllin', 0.9);
    setBossStatus(`All-in ${state.bossBet}`, 'act-allin');
  } else {
    playSfx('chipsBet', 0.88);
    setBossStatus(`Raise ${state.bossBet}`, 'act-raise');
  }
  updateHUD();
  advanceBettingAfterAction('boss');
}

/**
 * Оцінка сили руки Боса (0.0 .. 1.0)
 */
function estimateBossHandStrength() {
  const [c1, c2] = state.bossHand;
  const high = Math.max(c1.rank, c2.rank);
  const low = Math.min(c1.rank, c2.rank);
  const isPair = c1.rank === c2.rank;
  const isSuited = c1.suit === c2.suit;
  const gap = high - low;

  if (state.communityCards.length === 0) {
    let score = (high + low) / 28;
    if (isPair) score += 0.32 + (high / 14) * 0.2;
    if (isSuited) score += 0.07;
    if (gap === 1) score += 0.05;
    else if (gap === 2) score += 0.02;
    return Math.min(0.98, Math.max(0.15, score));
  }

  const allCards = [...state.bossHand, ...state.communityCards];
  const evalResult = evaluateBestHand(allCards);
  const category = evalResult.score[0];

  let base = 0.22;
  switch (category) {
    case 0:
      base = 0.20 + (evalResult.score[1] / 14) * 0.14;
      break;
    case 1:
      base = 0.46 + (evalResult.score[1] / 14) * 0.22;
      break;
    case 2:
      base = 0.72 + (evalResult.score[1] / 14) * 0.1;
      break;
    case 3:
      base = 0.83;
      break;
    case 4:
      base = 0.88;
      break;
    case 5:
      base = 0.91;
      break;
    default:
      base = 0.97;
      break;
  }

  if (state.communityCards.length < 5 && category <= 1) {
    const suitCounts = {};
    for (const c of allCards) {
      suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
    }
    if (Object.values(suitCounts).some((cnt) => cnt === 4)) {
      base += 0.14;
    }
  }

  return Math.min(0.99, base);
}

/**
 * ============================================================================
 * ОЦІНЮВАЧ ПОКЕРНИХ КОМБІНАЦІЙ (TEXAS HOLD'EM HAND EVALUATOR)
 * ============================================================================
 */
function getCombinationsOf5(cards) {
  const results = [];
  const n = cards.length;
  function helper(start, combo) {
    if (combo.length === 5) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(cards[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return results;
}

function evaluate5CardHand(fiveCards) {
  const ranks = fiveCards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = fiveCards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  const countsMap = new Map();
  for (const r of ranks) {
    countsMap.set(r, (countsMap.get(r) || 0) + 1);
  }

  const groups = Array.from(countsMap.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  let isStraight = false;
  let straightHigh = 0;
  if (groups.length === 5) {
    if (ranks[0] - ranks[4] === 4) {
      isStraight = true;
      straightHigh = ranks[0];
    } else if (
      ranks[0] === 14 &&
      ranks[1] === 5 &&
      ranks[2] === 4 &&
      ranks[3] === 3 &&
      ranks[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return [9, 14];
    }
    return [8, straightHigh];
  }

  if (groups[0][1] === 4) {
    return [7, groups[0][0], groups[1][0]];
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return [6, groups[0][0], groups[1][0]];
  }

  if (isFlush) {
    return [5, ...ranks];
  }

  if (isStraight) {
    return [4, straightHigh];
  }

  if (groups[0][1] === 3) {
    return [3, groups[0][0], groups[1][0], groups[2][0]];
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    return [2, groups[0][0], groups[1][0], groups[2][0]];
  }

  if (groups[0][1] === 2) {
    return [1, groups[0][0], groups[1][0], groups[2][0], groups[3][0]];
  }

  return [0, ...ranks];
}

function compareScores(scoreA, scoreB) {
  const len = Math.max(scoreA.length, scoreB.length);
  for (let i = 0; i < len; i++) {
    const a = scoreA[i] || 0;
    const b = scoreB[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function evaluateBestHand(cards) {
  const combos = getCombinationsOf5(cards);
  let bestScore = null;
  let bestCombo = null;

  for (const combo of combos) {
    const score = evaluate5CardHand(combo);
    if (!bestScore || compareScores(score, bestScore) > 0) {
      bestScore = score;
      bestCombo = combo;
    }
  }

  return {
    score: bestScore,
    cards: bestCombo
  };
}

/**
 * ============================================================================
 * SHOWDOWN, ПІДСВІЧУВАННЯ ПЕРЕМОЖЦЯ ТА КУЛЬМІНАЦІЯ
 * ============================================================================
 */
function handleShowdown() {
  state.street = 'showdown';
  state.turn = null;
  state.handInProgress = false;
  setControlsEnabled(false);

  // Звук та 3D-переворот карт Боса
  playSfx('cardFlip', 0.88);
  const bossCardEls = dom.bossCards.querySelectorAll('.playing-card');
  bossCardEls.forEach((el) => {
    el.classList.remove('face-down');
    el.classList.add('face-up');
  });

  const playerEval = evaluateBestHand([...state.playerHand, ...state.communityCards]);
  const bossEval = evaluateBestHand([...state.bossHand, ...state.communityCards]);
  const cmp = compareScores(playerEval.score, bossEval.score);
  const wonPot = state.pot;

  let winningCards = [];
  if (cmp > 0) {
    // Перемога гравця
    state.playerChips += wonPot;
    winningCards = playerEval.cards;
    setBossStatus('Програв банк', '');
    setZoneHighlights('player');
    showResultBanner(`ТИ ВИГРАВ РАУНД +${wonPot}`, '');
    playSfx('chipsWin', 0.85);
    playSfx('roundWin', 0.82);
  } else if (cmp < 0) {
    // Перемога боса (вважається поразкою гравця в раундах 1–6)
    if (state.mode === 'story' && state.roundNumber >= 1 && state.roundNumber <= 6) {
      state.playerLossesInFirstSix += 1;
    }
    state.bossChips += wonPot;
    winningCards = bossEval.cards;
    setBossStatus('Забрав банк', 'act-call');
    setZoneHighlights('boss');
    showResultBanner(`БОС ЗАБРАВ БАНК +${wonPot}`, 'banner-boss-win');
    playSfx('chipsWin', 0.82);
    playSfx('roundLose', 0.8);
  } else {
    // Нічия (Split Pot) — НЕ вважається поразкою
    const half = Math.floor(wonPot / 2);
    const remainder = wonPot - half * 2;
    state.playerChips += half + (state.dealer === 'player' ? remainder : 0);
    state.bossChips += half + (state.dealer === 'boss' ? remainder : 0);
    winningCards = playerEval.cards;
    setBossStatus('Split Pot', '');
    clearZoneHighlights();
    showResultBanner('НІЧИЯ (SPLIT POT)', 'banner-split');
    playSfx('chipsWin', 0.78);
  }

  // Підсвітити 5 карт виграшної комбінації золотим сяйвом
  highlightWinningCards(winningCards);

  state.pot = 0;
  state.playerBet = 0;
  state.bossBet = 0;
  updateHUD();

  // КУЛЬМІНАЦІЯ 7-ГО РАУНДУ В СЮЖЕТНОМУ РЕЖИМІ -> GoodEnd.mp4
  if (state.mode === 'story' && state.roundNumber === 7) {
    // Чітка фінальна пауза 3.5 секунди перед запуском GoodEnd.mp4
    registerTimeout(() => {
      triggerStoryGoodEnding();
    }, 3500);
    return;
  }

  // Пауза після Showdown у звичайних раундах: 3.7 секунди (3.5–4с)
  registerTimeout(() => {
    transitionToNextHand();
  }, 3700);
}

function highlightWinningCards(cards) {
  const keys = new Set(cards.map((c) => `${c.rankStr}${c.suit}`));
  document.querySelectorAll('.playing-card').forEach((cardEl) => {
    if (keys.has(cardEl.dataset.cardKey)) {
      cardEl.classList.add('winning-card');
    }
  });
}

function triggerStoryGoodEnding() {
  clearAllTimers();
  playFullscreenVideo(
    CONFIG.winVideo,
    () => {
      unlockFreePlayMode();
      showFinalOverlay('Фінал Історії', 'Королівський флеш вирішив долю цієї ночі. Режим «Вільна гра» розблоковано.');
    },
    false
  );
}

function triggerStoryBadEnding() {
  clearAllTimers();
  playFullscreenVideo(
    CONFIG.loseVideo,
    () => {
      unlockFreePlayMode();
      showFinalOverlay('Гру Завершено', 'Цього вечора удача була на боці казино. Режим «Вільна гра» розблоковано.');
    },
    false
  );
}

/**
 * ============================================================================
 * ЖИВИЙ АТМОСФЕРНИЙ ФОН ГОЛОВНОГО МЕНЮ (ПЛАВАЮЧІ ФІШКИ ТА МАСТІ)
 * ============================================================================
 */
function initMenuBackgroundCanvas() {
  const canvas = dom.menuBgCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const suitChars = ['♠', '♥', '♦', '♣'];
  const items = [];
  const ITEM_COUNT = 22;

  for (let i = 0; i < ITEM_COUNT; i++) {
    const isChip = i % 3 === 0;
    // Глибина сцени: 0.25 (далеко, менші й розмитіші) .. 1.0 (ближче, більші й чіткіші)
    const depth = 0.25 + Math.random() * 0.75;
    const suit = suitChars[i % suitChars.length];
    const isGoldAccent = suit === '♥' || suit === '♦' || isChip;

    items.push({
      type: isChip ? 'chip' : 'suit',
      suit,
      isGoldAccent,
      depth,
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22 * depth,
      vy: -(0.12 + Math.random() * 0.24) * depth,
      angle: Math.random() * Math.PI * 2,
      vAngle: (Math.random() - 0.5) * 0.0045,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.008 + Math.random() * 0.012,
      baseSize: isChip ? 16 + depth * 22 : 18 + depth * 28,
      alpha: 0.055 + depth * 0.095
    });
  }

  function drawPokerChip(r, alpha, wobbleCos) {
    ctx.save();
    // Легка ілюзія 3D-нахилу фішки в просторі
    ctx.scale(1, 0.72 + 0.28 * Math.abs(wobbleCos));

    ctx.strokeStyle = `rgba(212, 170, 100, ${alpha.toFixed(3)})`;
    ctx.fillStyle = `rgba(24, 18, 13, ${(alpha * 0.85).toFixed(3)})`;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Пунктирний внутрішній обідок покерної фішки
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function renderMenuBg() {
    // Малюємо лише коли меню видиме для економії ресурсів
    if (!dom.startMenu.classList.contains('hidden')) {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        it.wobblePhase += it.wobbleSpeed;
        it.x += it.vx + Math.sin(it.wobblePhase) * 0.16 * it.depth;
        it.y += it.vy;
        it.angle += it.vAngle;

        const margin = 60;
        if (it.y < -margin) {
          it.y = height + margin;
          it.x = Math.random() * width;
        }
        if (it.x < -margin) it.x = width + margin;
        if (it.x > width + margin) it.x = -margin;

        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.angle);

        // Імітація глибини різкості через м'яке тіньове розмиття для дальніх/ближніх об'єктів
        const blurAmount = it.depth < 0.55 ? (1 - it.depth) * 10 : 2;
        const colorRgb = it.isGoldAccent ? '210, 168, 98' : '225, 216, 200';
        ctx.shadowColor = `rgba(${colorRgb}, ${(it.alpha * 0.9).toFixed(3)})`;
        ctx.shadowBlur = blurAmount;

        if (it.type === 'chip') {
          drawPokerChip(it.baseSize, it.alpha, Math.cos(it.wobblePhase));
        } else {
          ctx.font = `${Math.round(it.baseSize)}px Georgia, serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = `rgba(${colorRgb}, ${it.alpha.toFixed(3)})`;
          ctx.fillText(it.suit, 0, 0);
        }

        ctx.restore();
      }
    }

    requestAnimationFrame(renderMenuBg);
  }

  requestAnimationFrame(renderMenuBg);
}

/**
 * ============================================================================
 * АНІМАЦІЯ НАПІВПРОЗОРОГО ДИМУ З ПОПІЛЬНИЧКИ (CANVAS)
 * ============================================================================
 */
function initSmokeAnimation() {
  const canvas = dom.smokeCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const particles = [];
  const MAX_PARTICLES = 28;

  function createParticle() {
    return {
      x: 78 + (Math.random() - 0.5) * 5,
      y: 82 + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.42) * 0.25,
      vy: -(0.28 + Math.random() * 0.28),
      radius: 3.5 + Math.random() * 3,
      maxLife: 110 + Math.random() * 60,
      age: 0,
      phase: Math.random() * Math.PI * 2
    };
  }

  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = createParticle();
    p.age = Math.random() * p.maxLife;
    particles.push(p);
  }

  function renderSmoke() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.age += 1;

      if (p.age >= p.maxLife) {
        particles[i] = createParticle();
        continue;
      }

      const progress = p.age / p.maxLife;
      const sway = Math.sin(progress * 4.5 + p.phase) * 0.32;
      p.x += p.vx + sway;
      p.y += p.vy;
      const currentRadius = p.radius + progress * 16;

      const alpha =
        progress < 0.2
          ? (progress / 0.2) * 0.22
          : (1 - (progress - 0.2) / 0.8) * 0.22;

      const grad = ctx.createRadialGradient(p.x, p.y, 0.5, p.x, p.y, currentRadius);
      grad.addColorStop(0, `rgba(215, 208, 198, ${alpha.toFixed(3)})`);
      grad.addColorStop(0.55, `rgba(175, 168, 158, ${(alpha * 0.5).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(130, 125, 118, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(renderSmoke);
  }

  requestAnimationFrame(renderSmoke);
}

// Запуск додатку після завантаження DOM
document.addEventListener('DOMContentLoaded', initApp);
