import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session as SupabaseSession, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { io, Socket } from "socket.io-client";

const configuredServerUrl = process.env.EXPO_PUBLIC_SERVER_URL;
const defaultServerUrl = configuredServerUrl && !configuredServerUrl.includes("YOUR_SERVER_HOST")
  ? configuredServerUrl
  : "http://localhost:3001";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: AsyncStorage,
    },
  })
  : null;

const RESPONSE_WINDOW_SECONDS = 10;
const TURN_WINDOW_SECONDS = 15;
const CARD_WIDTH = 92;
const CARD_HEIGHT = 138;
const HAND_ROW_LIMIT = 5;
const OPPONENT_VISIBLE_LIMIT = 4;
const TARGET_VISIBLE_CARD_RATIO = 0.7;
const HAND_CARD_STEP = Math.round(CARD_WIDTH * TARGET_VISIBLE_CARD_RATIO);
const HAND_ROW_STEP = 76;
const OPPONENT_CARD_WIDTH = Math.round(CARD_WIDTH * 0.8);
const OPPONENT_CARD_HEIGHT = Math.round(CARD_HEIGHT * 0.8);
const OPPONENT_CARD_STEP = Math.round(OPPONENT_CARD_WIDTH * 0.44);
const DECK_WIDTH = Math.round(CARD_WIDTH * 0.5);
const DECK_HEIGHT = Math.round(CARD_HEIGHT * 0.5);
const STACK_WIDTH = Math.round(116 * 1.25);
const STACK_HEIGHT = Math.round(174 * 1.25);
const TABLE_IMAGE = require("./resources/cards/table-1.png");
const CARD_BACK_IMAGE = require("./resources/cards/cardback.png");
const cardImages: Record<string, number> = {
  "bastos-1": require("./resources/cards/bastos-1.png"),
  "bastos-2": require("./resources/cards/bastos-2.png"),
  "bastos-3": require("./resources/cards/bastos-3.png"),
  "bastos-4": require("./resources/cards/bastos-4.png"),
  "bastos-5": require("./resources/cards/bastos-5.png"),
  "bastos-6": require("./resources/cards/bastos-6.png"),
  "bastos-7": require("./resources/cards/bastos-7.png"),
  "bastos-10": require("./resources/cards/bastos-10.png"),
  "bastos-11": require("./resources/cards/bastos-11.png"),
  "bastos-12": require("./resources/cards/bastos-12.png"),
  "copas-1": require("./resources/cards/copas-1.png"),
  "copas-2": require("./resources/cards/copas-2.png"),
  "copas-3": require("./resources/cards/copas-3.png"),
  "copas-4": require("./resources/cards/copas-4.png"),
  "copas-5": require("./resources/cards/copas-5.png"),
  "copas-6": require("./resources/cards/copas-6.png"),
  "copas-7": require("./resources/cards/copas-7.png"),
  "copas-10": require("./resources/cards/copas-10.png"),
  "copas-11": require("./resources/cards/copas-11.png"),
  "copas-12": require("./resources/cards/copas-12.png"),
  "espadas-1": require("./resources/cards/espadas-1.png"),
  "espadas-2": require("./resources/cards/espadas-2.png"),
  "espadas-3": require("./resources/cards/espadas-3.png"),
  "espadas-4": require("./resources/cards/espadas-4.png"),
  "espadas-5": require("./resources/cards/espadas-5.png"),
  "espadas-6": require("./resources/cards/espadas-6.png"),
  "espadas-7": require("./resources/cards/espadas-7.png"),
  "espadas-10": require("./resources/cards/espadas-10.png"),
  "espadas-11": require("./resources/cards/espadas-11.png"),
  "espadas-12": require("./resources/cards/espadas-12.png"),
  "oros-1": require("./resources/cards/oros-1.png"),
  "oros-2": require("./resources/cards/oros-2.png"),
  "oros-3": require("./resources/cards/oros-3.png"),
  "oros-4": require("./resources/cards/oros-4.png"),
  "oros-5": require("./resources/cards/oros-5.png"),
  "oros-6": require("./resources/cards/oros-6.png"),
  "oros-7": require("./resources/cards/oros-7.png"),
  "oros-10": require("./resources/cards/oros-10.png"),
  "oros-11": require("./resources/cards/oros-11.png"),
  "oros-12": require("./resources/cards/oros-12.png"),
};
const suitIconCards: Record<Suit, string> = {
  gold: "oros-1",
  cups: "copas-1",
  swords: "espadas-1",
  sticks: "bastos-1",
};

const soundPlaceholders = {
  draw: "resources/sounds/draw-card.*",
  gameEnd: "resources/sounds/game-end.*",
  lose: "resources/sounds/player-loses.*",
  music: "resources/sounds/music.*",
  pick: "resources/sounds/pick-card.*",
  play: "resources/sounds/play-card.*",
  turn: "resources/sounds/turn-change.*",
  win: "resources/sounds/win.*",
};

function playSoundPlaceholder(name: keyof typeof soundPlaceholders) {
  // Placeholder for later Expo AV integration.
  void soundPlaceholders[name];
}

export default function App() {
  const [serverUrl, setServerUrl] = useState(defaultServerUrl);
  const [name, setName] = useState("Player");
  const [joinCode, setJoinCode] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [authSession, setAuthSession] = useState<SupabaseSession | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [visibleGame, setVisibleGame] = useState<ClientGameState | null>(null);
  const [activeAnimation, setActiveAnimation] = useState<TableAnimation | null>(null);
  const [confettiRun, setConfettiRun] = useState(0);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [error, setError] = useState("");
  const [pendingSevenCard, setPendingSevenCard] = useState<Card | null>(null);
  const [now, setNow] = useState(Date.now());
  const [turnStartedAt, setTurnStartedAt] = useState(Date.now());
  const [screen, setScreen] = useState<AppScreen>("menu");
  const [adDue, setAdDue] = useState(false);
  const [lastAdShownAt, setLastAdShownAt] = useState(Date.now());

  const visibleGameRef = useRef<ClientGameState | null>(null);
  const queueBaseRef = useRef<ClientGameState | null>(null);
  const animationQueueRef = useRef<TableAnimation[]>([]);
  const activeAnimationRef = useRef<TableAnimation | null>(null);
  const playedCardLayoutRef = useRef<{ cardId: string; point: Point } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    visibleGameRef.current = visibleGame;
  }, [visibleGame]);

  useEffect(() => {
    if (visibleGame?.status === "finished") {
      setConfettiRun((run) => run + 1);
      playSoundPlaceholder(visibleGame.loserId === session?.playerId ? "lose" : "gameEnd");
      if (Date.now() - lastAdShownAt >= 5 * 60 * 1000) {
        setAdDue(true);
        setLastAdShownAt(Date.now());
      }
    }
  }, [lastAdShownAt, session?.playerId, visibleGame?.loserId, visibleGame?.status, visibleGame?.winnerId]);

  useEffect(() => {
    setTurnStartedAt(Date.now());
  }, [visibleGame?.currentPlayerId, visibleGame?.status]);

  useEffect(() => {
    activeAnimationRef.current = activeAnimation;
  }, [activeAnimation]);

  useEffect(() => {
    return () => {
      socket?.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setAuthSession(data.session);
      setAuthUser(data.session?.user ?? null);
      if (data.session?.user.email) {
        setName(data.session.user.email.split("@")[0] ?? "Player");
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setAuthSession(nextSession);
      setAuthUser(nextSession?.user ?? null);
      if (nextSession?.user.email) {
        setName(nextSession.user.email.split("@")[0] ?? "Player");
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const currentPlayer = visibleGame?.players.find((player) => player.id === visibleGame.currentPlayerId);
  const isYourTurn = Boolean(session && visibleGame?.currentPlayerId === session.playerId);
  const pendingForYou = Boolean(
    session && visibleGame?.pendingAction?.targetPlayerId === session.playerId,
  );
  const canDraw = Boolean(isYourTurn && !pendingForYou && visibleGame?.canDraw);
  const secondsLeft = visibleGame?.pendingAction
    ? Math.max(0, Math.ceil((visibleGame.pendingAction.expiresAt - now) / 1000))
    : 0;
  const timerProgress = visibleGame?.pendingAction
    ? Math.max(0, Math.min(1, secondsLeft / RESPONSE_WINDOW_SECONDS))
    : 0;
  const serverTurnExpiresAt = visibleGame?.pendingAction?.expiresAt ?? visibleGame?.turnExpiresAt ?? null;
  const turnSecondsLeft = visibleGame?.status !== "playing"
    ? 0
    : serverTurnExpiresAt
      ? Math.max(0, Math.ceil((serverTurnExpiresAt - now) / 1000))
      : Math.max(0, Math.ceil(TURN_WINDOW_SECONDS - (now - turnStartedAt) / 1000));
  const turnProgress = visibleGame?.status !== "playing"
    ? 0
    : serverTurnExpiresAt
      ? Math.max(0, Math.min(1, turnSecondsLeft / (visibleGame.pendingAction ? RESPONSE_WINDOW_SECONDS : TURN_WINDOW_SECONDS)))
      : Math.max(0, Math.min(1, turnSecondsLeft / TURN_WINDOW_SECONDS));
  const appMode: AppMode = !visibleGame
    ? "connect"
    : visibleGame.status === "lobby"
      ? "lobby"
      : "game";

  const tableLabel = useMemo(() => {
    if (!visibleGame?.middleCard) {
      return "No card yet";
    }

    if (visibleGame.chosenSuit) {
      return `${rankLabel(visibleGame.middleCard.rank)} changed to ${suitLabel(visibleGame.chosenSuit)}`;
    }

    return `${rankLabel(visibleGame.middleCard.rank)} of ${suitLabel(visibleGame.middleCard.suit)}`;
  }, [visibleGame?.middleCard, visibleGame?.chosenSuit]);

  const runNextAnimation = useCallback(() => {
    if (activeAnimationRef.current || animationQueueRef.current.length === 0) {
      return;
    }

    const nextAnimation = animationQueueRef.current.shift() ?? null;
    activeAnimationRef.current = nextAnimation;
    setActiveAnimation(nextAnimation);
  }, []);

  const finishAnimation = useCallback(() => {
    const finished = activeAnimationRef.current;
    if (!finished) {
      return;
    }

    playSoundPlaceholder(finished.type === "draw" ? "draw" : "play");
    setActivityLog((items) => trimActivityLog([formatActivity(finished), ...items]));
    queueBaseRef.current = finished.nextState;
    visibleGameRef.current = finished.nextState;
    activeAnimationRef.current = null;
    setVisibleGame(finished.nextState);
    setActiveAnimation(null);
    requestAnimationFrame(runNextAnimation);
  }, [runNextAnimation]);

  const receiveGameState = useCallback(
    (nextState: ClientGameState) => {
      const baseState = queueBaseRef.current ?? visibleGameRef.current;
      queueBaseRef.current = nextState;

      const animation = inferTableAnimation(
        baseState,
        nextState,
        session?.playerId,
        playedCardLayoutRef.current,
      );
      if (animation?.type === "play" && animation.card.id === playedCardLayoutRef.current?.cardId) {
        playedCardLayoutRef.current = null;
      }
      if (!animation) {
        if (baseState?.message && baseState.message !== nextState.message) {
          setActivityLog((items) => trimActivityLog([messageActivity(nextState.message), ...items]));
        }
        visibleGameRef.current = nextState;
        setVisibleGame(nextState);
        return;
      }

      animationQueueRef.current.push(animation);
      requestAnimationFrame(runNextAnimation);
    },
    [runNextAnimation],
  );

  useEffect(() => {
    if (
      pendingSevenCard &&
      (!isYourTurn || !visibleGame?.hand.some((card) => card.id === pendingSevenCard.id))
    ) {
      setPendingSevenCard(null);
    }
  }, [visibleGame?.hand, isYourTurn, pendingSevenCard]);

  function connect() {
    socket?.disconnect();
    setError("");
    setVisibleGame(null);
    setSession(null);
    setActivityLog([]);
    queueBaseRef.current = null;
    animationQueueRef.current = [];
    setActiveAnimation(null);
    setPendingSevenCard(null);

    const nextSocket = io(serverUrl, {
      auth: {
        accessToken: authSession?.access_token,
      },
      transports: ["websocket"],
    });

    nextSocket.on("connect_error", () => {
      setError("Cannot connect. Make sure the server is running.");
    });
    nextSocket.on("session", setSession);
    nextSocket.on("gameState", receiveGameState);
    nextSocket.on("player_draws_card", (event: ServerAnimationEvent) => {
      void event;
    });
    nextSocket.on("player_plays_card", (event: ServerAnimationEvent) => {
      void event;
    });
    nextSocket.on("turn_changes", () => playSoundPlaceholder("turn"));
    nextSocket.on("errorMessage", setError);
    setSocket(nextSocket);
    return nextSocket;
  }

  function emit(event: string, payload: Record<string, unknown>) {
    setError("");
    socket?.emit(event, payload);
  }

  function createRoom() {
    setScreen("room");
    if (!socket?.connected) {
      const nextSocket = connect();
      nextSocket.once("connect", () => nextSocket.emit("createRoom", { name }));
      return;
    }

    emit("createRoom", { name });
  }

  async function signIn() {
    if (!supabase) {
      setError("Supabase is not configured in .env.");
      return;
    }

    setAuthBusy(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });
    setAuthBusy(false);
    if (signInError) {
      setError(signInError.message);
    }
  }

  async function signUp() {
    if (!supabase) {
      setError("Supabase is not configured in .env.");
      return;
    }

    setAuthBusy(true);
    setError("");
    const { error: signUpError } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
      options: {
        data: {
          display_name: name,
        },
      },
    });
    setAuthBusy(false);
    if (signUpError) {
      setError(signUpError.message);
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setAuthEmail("");
    setAuthPassword("");
  }

  function joinRoom() {
    setScreen("room");
    if (!socket?.connected) {
      const nextSocket = connect();
      nextSocket.once("connect", () => nextSocket.emit("joinRoom", { name, roomId: joinCode }));
      return;
    }

    emit("joinRoom", { name, roomId: joinCode });
  }

  function startGame() {
    if (session) {
      emit("startGame", session);
    }
  }

  function playCard(card: Card, sourcePoint?: Point) {
    if (!session) {
      return;
    }

    if (sourcePoint) {
      playedCardLayoutRef.current = { cardId: card.id, point: sourcePoint };
    }

    if (card.rank === 7) {
      setPendingSevenCard(card);
      return;
    }

    emit("playCard", {
      ...session,
      cardId: card.id,
    });
  }

  function playSevenWithSuit(card: Card, suit: Suit) {
    if (!session) {
      return;
    }

    emit("playCard", {
      ...session,
      cardId: card.id,
      chosenSuit: suit,
    });
    setPendingSevenCard(null);
  }

  function drawCard() {
    if (session) {
      emit("drawUntilPlayable", session);
    }
  }

  function resolvePending() {
    if (session) {
      emit("resolvePending", session);
    }
  }

  function retryRound() {
    if (session) {
      emit("restartRoom", session);
    }
  }

  function cleanupToMenu() {
    if (session && socket?.connected) {
      socket.emit("leaveRoom", session);
    }
    socket?.removeAllListeners();
    socket?.disconnect();
    setSocket(null);
    setSession(null);
    setVisibleGame(null);
    setActivityLog([]);
    setActiveAnimation(null);
    setPendingSevenCard(null);
    setError("");
    queueBaseRef.current = null;
    visibleGameRef.current = null;
    animationQueueRef.current = [];
    setScreen("menu");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      {screen === "menu" ? (
        <MainMenuScreen
          authBusy={authBusy}
          authEmail={authEmail}
          authPassword={authPassword}
          disabledText={error}
          onCreateRoom={createRoom}
          onSignIn={signIn}
          onSignOut={signOut}
          onSignUp={signUp}
          onOpenSettings={() => setScreen("room")}
          setAuthEmail={setAuthEmail}
          setAuthPassword={setAuthPassword}
          user={authUser}
        />
      ) : appMode === "game" && visibleGame && session ? (
        <GameTable
          activeAnimation={activeAnimation}
          canDraw={canDraw}
          currentPlayerName={currentPlayer?.name ?? "Waiting"}
          game={visibleGame}
          onAnimationDone={finishAnimation}
          onDraw={drawCard}
          onPlayCard={playCard}
          onResolvePending={resolvePending}
          onSevenSuit={playSevenWithSuit}
          pendingForYou={pendingForYou}
          pendingSevenCard={pendingSevenCard}
          playerId={session.playerId}
          secondsLeft={secondsLeft}
          serverUrl={serverUrl}
          tableLabel={tableLabel}
          timerProgress={timerProgress}
          turnProgress={turnProgress}
          turnSecondsLeft={turnSecondsLeft}
          confettiRun={confettiRun}
          activityLog={activityLog}
          onQuit={cleanupToMenu}
          onRetry={retryRound}
          adDue={adDue}
          onAdClosed={() => setAdDue(false)}
        />
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.menuContent}
          >
            <View style={styles.topBar}>
              <View>
                <Text style={styles.appTitle}>Take Two</Text>
                <Text style={styles.appSubtitle}>
                  {appMode === "connect" ? "Create a room or join one." : "Waiting room"}
                </Text>
              </View>
              <View style={[styles.statusDot, socket?.connected ? styles.onlineDot : null]} />
            </View>
            <Button label="Main Menu" onPress={cleanupToMenu} tone="secondary" />

            {appMode === "connect" ? (
              <Panel>
                <Text style={styles.panelTitle}>Play Online</Text>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setServerUrl}
                  placeholder="Server URL"
                  placeholderTextColor="#8c9197"
                  style={styles.input}
                  value={serverUrl}
                />
                <TextInput
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor="#8c9197"
                  style={styles.input}
                  value={name}
                />
                <View style={styles.actions}>
                  <Button
                    label={socket?.connected ? "Connected" : "Connect"}
                    onPress={connect}
                    tone="secondary"
                  />
                  <Button label="Create Room" onPress={createRoom} />
                </View>
                <View style={styles.joinRow}>
                  <TextInput
                    autoCapitalize="characters"
                    onChangeText={setJoinCode}
                    placeholder="Room code"
                    placeholderTextColor="#8c9197"
                    style={[styles.input, styles.joinInput]}
                    value={joinCode}
                  />
                  <Button label="Join" onPress={joinRoom} disabled={!joinCode.trim()} />
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </Panel>
            ) : null}

            {visibleGame && appMode === "lobby" ? (
              <Panel>
                <View style={styles.roomCodeBlock}>
                  <Text style={styles.metaLabel}>Room code</Text>
                  <Text style={styles.roomCode}>{visibleGame.roomId}</Text>
                </View>
                <Text style={styles.message}>{visibleGame.message}</Text>
                <View style={styles.playerList}>
                  {visibleGame.players.map((player) => (
                    <PlayerRow
                      key={player.id}
                      active={player.id === visibleGame.currentPlayerId}
                      isYou={player.id === session?.playerId}
                      player={player}
                    />
                  ))}
                </View>
                {visibleGame.youAreHost ? (
                  <Button
                    label="Start Game"
                    onPress={startGame}
                    disabled={visibleGame.players.length < 2}
                  />
                ) : (
                  <Text style={styles.helper}>The host will start once there are at least 2 players.</Text>
                )}
              </Panel>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function GameTable({
  activeAnimation,
  activityLog,
  canDraw,
  currentPlayerName,
  game,
  onAnimationDone,
  onDraw,
  onPlayCard,
  onQuit,
  onResolvePending,
  onRetry,
  adDue,
  onAdClosed,
  onSevenSuit,
  pendingForYou,
  pendingSevenCard,
  playerId,
  secondsLeft,
  serverUrl,
  tableLabel,
  timerProgress,
  turnProgress,
  turnSecondsLeft,
  confettiRun,
}: GameTableProps) {
  const tableRef = useRef<View | null>(null);
  const [tableSize, setTableSize] = useState({ height: 1, width: 1 });
  const [tableOrigin, setTableOrigin] = useState<Point>({ x: 0, y: 0 });
  const seats = useMemo(
    () => buildSeats(game.players, playerId),
    [game.players, playerId],
  );
  const positions = useMemo(() => getTablePositions(tableSize), [tableSize]);
  const currentPlayer = game.players.find((player) => player.id === playerId);
  const isYourTurn = game.currentPlayerId === playerId;
  const [quitOpen, setQuitOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedCardId(null);
  }, [game.currentPlayerId, game.hand.length]);

  function handleLayout(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout;
    setTableSize({ height, width });
    tableRef.current?.measureInWindow((x, y) => {
      setTableOrigin({ x, y });
    });
  }

  return (
    <View ref={tableRef} style={styles.tableScreen} onLayout={handleLayout}>
      <ImageBackground source={TABLE_IMAGE} resizeMode="cover" style={styles.tableBackground}>
        <View style={styles.tableShade} />
        <Pressable style={styles.tableDeselectLayer} onPress={() => setSelectedCardId(null)} />
        <QuitButtonWithConfirm
          onCancel={() => setQuitOpen(false)}
          onConfirm={onQuit}
          onOpen={() => setQuitOpen(true)}
          open={quitOpen}
        />

        <View style={[styles.seat, styles.topSeat]}>
          {seats.top ? (
            <OpponentSeat active={seats.top.id === game.currentPlayerId} player={seats.top} serverUrl={serverUrl} side="top" />
          ) : null}
        </View>
        <View style={[styles.seat, styles.leftSeat]}>
          {seats.left ? (
            <OpponentSeat active={seats.left.id === game.currentPlayerId} player={seats.left} serverUrl={serverUrl} side="left" />
          ) : null}
        </View>
        <View style={[styles.seat, styles.rightSeat]}>
          {seats.right ? (
            <OpponentSeat active={seats.right.id === game.currentPlayerId} player={seats.right} serverUrl={serverUrl} side="right" />
          ) : null}
        </View>

        <View style={styles.tableStatus}>
          <View style={styles.turnStatusRow}>
            <TurnTimer progress={turnProgress} secondsLeft={turnSecondsLeft} />
            <View style={styles.turnStatusText}>
              <Text style={styles.turnLabel}>
                {game.status === "finished"
                  ? `${game.players.find((player) => player.id === game.winnerId)?.name ?? "Someone"} won`
                  : `${currentPlayerName}'s turn`}
              </Text>
              <Text style={styles.tableLabel}>{tableLabel}</Text>
            </View>
          </View>
          {game.pendingAction ? (
            <View style={styles.pendingCard}>
              <View style={styles.pendingHeader}>
                <Text style={styles.pendingText}>
                  {game.pendingAction.type === "draw"
                    ? `Stack 2 or draw ${game.pendingAction.amount}`
                    : "Play 1 or skip"}
                </Text>
                <Text style={styles.countdown}>{secondsLeft}s</Text>
              </View>
              <View style={styles.timerTrack}>
                <View style={[styles.timerFill, { width: `${timerProgress * 100}%` }]} />
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.centerPile}>
          <GameCard card={game.middleCard} large serverUrl={serverUrl} />
        </View>
        <DrawDeckButton canDraw={canDraw} count={game.deckCount} onDraw={onDraw} serverUrl={serverUrl} />

        <ActivityLog items={activityLog} />

        <View style={styles.bottomArea}>
          <View style={styles.handHeader}>
            <View>
              <Text style={styles.bottomName}>{currentPlayer?.name ?? "You"}</Text>
              <Text style={styles.bottomHint}>
                {isYourTurn ? "Play one card or draw one." : "Waiting for your turn."}
              </Text>
            </View>
            {pendingForYou ? (
              <Button
                label={game.pendingAction?.type === "draw" ? "Take" : "Skip"}
                onPress={onResolvePending}
                tone="danger"
              />
            ) : null}
          </View>

          <PlayerHand
            activeAnimation={activeAnimation}
            cards={game.hand}
            game={game}
            onPlayCard={onPlayCard}
            playerId={playerId}
            selectedCardId={selectedCardId}
            serverUrl={serverUrl}
            setSelectedCardId={setSelectedCardId}
            tableOrigin={tableOrigin}
            tableWidth={tableSize.width}
          />
        </View>

        <AnimationLayer
          activeAnimation={activeAnimation}
          positions={positions}
          seats={seats}
          serverUrl={serverUrl}
          onDone={onAnimationDone}
        />
        <SuitChoiceOverlay
          card={pendingSevenCard}
          onChoose={onSevenSuit}
          serverUrl={serverUrl}
        />
        <ConfettiOverlay run={confettiRun} />
        <EndGameOverlay
          adDue={adDue}
          game={game}
          onAdClosed={onAdClosed}
          onRetry={onRetry}
          playerId={playerId}
        />
      </ImageBackground>
    </View>
  );
}

function MainMenuScreen({
  authBusy,
  authEmail,
  authPassword,
  disabledText,
  onCreateRoom,
  onOpenSettings,
  onSignIn,
  onSignOut,
  onSignUp,
  setAuthEmail,
  setAuthPassword,
  user,
}: {
  authBusy: boolean;
  authEmail: string;
  authPassword: string;
  disabledText: string;
  onCreateRoom: () => void;
  onOpenSettings: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSignUp: () => void;
  setAuthEmail: (email: string) => void;
  setAuthPassword: (password: string) => void;
  user: User | null;
}) {
  return (
    <ImageBackground source={TABLE_IMAGE} resizeMode="cover" style={styles.menuBackground}>
      <View style={styles.menuShade} />
      <Pressable onPress={onOpenSettings} style={styles.settingsButton}>
        <Text style={styles.settingsButtonText}>Settings</Text>
      </Pressable>
      <View style={styles.mainMenuContent}>
        <Text style={styles.mainMenuTitle}>Take Two</Text>
        <View style={styles.accountStrip}>
          <Text style={styles.accountStripText}>
            {user?.email ? user.email : "Guest account"}
          </Text>
          <Text style={styles.accountStripSubtext}>
            {user ? "Signed in with Supabase." : "Sign in to keep tokens, stats, and matchmaking later."}
          </Text>
        </View>
        {!user ? (
          <View style={styles.authPanel}>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setAuthEmail}
              placeholder="Email"
              placeholderTextColor="#8c9197"
              style={styles.input}
              value={authEmail}
            />
            <TextInput
              onChangeText={setAuthPassword}
              placeholder="Password"
              placeholderTextColor="#8c9197"
              secureTextEntry
              style={styles.input}
              value={authPassword}
            />
            <View style={styles.actions}>
              <Button
                disabled={authBusy || !authEmail.trim() || authPassword.length < 6}
                label="Sign In"
                onPress={onSignIn}
                tone="secondary"
              />
              <Button
                disabled={authBusy || !authEmail.trim() || authPassword.length < 6}
                label="Create Account"
                onPress={onSignUp}
              />
            </View>
          </View>
        ) : (
          <View style={styles.mainMenuActions}>
            <Button label="Sign Out" onPress={onSignOut} tone="secondary" />
          </View>
        )}
        <View style={styles.mainMenuActions}>
          <Button disabled label="Play Random" onPress={() => undefined} tone="secondary" />
          <Button label="Create Room" onPress={onCreateRoom} />
          <Button disabled label="Watch Ad +1 Token" onPress={() => undefined} tone="secondary" />
          <Button disabled label="Buy Tokens" onPress={() => undefined} tone="secondary" />
          <Button disabled label="Remove Ads $0.99" onPress={() => undefined} tone="secondary" />
          <Button disabled label="Premium $5.99/mo" onPress={() => undefined} tone="secondary" />
          <Button disabled label="Customize" onPress={() => undefined} tone="secondary" />
        </View>
        {disabledText ? <Text style={styles.menuNotice}>{disabledText}</Text> : null}
      </View>
    </ImageBackground>
  );
}

function QuitButtonWithConfirm({
  onCancel,
  onConfirm,
  onOpen,
  open,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  onOpen: () => void;
  open: boolean;
}) {
  return (
    <>
      <Pressable onPress={onOpen} style={styles.quitButton}>
        <Text style={styles.quitButtonText}>Quit</Text>
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={onCancel}>
        <View style={styles.modalScrim}>
          <View style={styles.confirmPanel}>
            <Text style={styles.confirmTitle}>Quit game?</Text>
            <Text style={styles.confirmText}>You will leave the room if you quit the game.</Text>
            <View style={styles.confirmActions}>
              <Button label="Stay" onPress={onCancel} tone="secondary" />
              <Button label="Quit" onPress={onConfirm} tone="danger" />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function EndGameOverlay({
  adDue,
  game,
  onAdClosed,
  onRetry,
  playerId,
}: {
  adDue: boolean;
  game: ClientGameState;
  onAdClosed: () => void;
  onRetry: () => void;
  playerId: string;
}) {
  if (game.status !== "finished") {
    return null;
  }

  const isOneVsOne = game.players.length === 2;
  const loser = game.players.find((player) => player.id === game.loserId);
  const orderedResults = game.roundResults
    .map((id) => game.players.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player));

  return (
    <View style={styles.endOverlay} pointerEvents="box-none">
      <View style={styles.endPanel}>
        {adDue ? (
          <View style={styles.adPlaceholder}>
            <Text style={styles.adPlaceholderText}>Ad placeholder</Text>
            <Button label="Close" onPress={onAdClosed} tone="secondary" />
          </View>
        ) : null}
        <Text style={styles.endTitle}>
          {loser ? `${loser.name} loses` : "Round finished"}
        </Text>
        {orderedResults.map((player, index) => (
          <Text key={player.id} style={styles.endResultText}>
            {index + 1}. {player.name}
            {player.id === playerId ? " (You)" : ""}
          </Text>
        ))}
        {isOneVsOne ? (
          <View style={styles.scoreBlock}>
            {game.players.map((player) => (
              <Text key={player.id} style={styles.scoreText}>
                {player.name}: {game.scores[player.id] ?? 0}
              </Text>
            ))}
            <RetryButton onRetry={onRetry} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return <Button label="Retry" onPress={onRetry} />;
}

function PlayerHand({
  activeAnimation,
  cards,
  game,
  onPlayCard,
  playerId,
  selectedCardId,
  serverUrl,
  setSelectedCardId,
  tableOrigin,
  tableWidth,
}: PlayerHandProps) {
  const sortedCards = sortHand(cards);
  const rows = buildHandRows(sortedCards);
  const hiddenCardId =
    activeAnimation?.type === "play" && game.players.find((player) => player.id === playerId)?.id === activeAnimation.playerId
      ? activeAnimation.card.id
      : null;

  return (
    <View style={styles.handRows}>
      {rows.map((row, rowIndex) => {
        const isTopRow = rowIndex < rows.length - 1;
        const bottomCount = rows[rows.length - 1]?.length ?? row.length;
        const step = getHandStep(Math.max(row.length, bottomCount), tableWidth);
        const rowWidth = CARD_WIDTH + Math.max(0, row.length - 1) * step;

        return (
          <View
            key={rowIndex}
            style={[
              styles.handRow,
              isTopRow ? styles.handTopRow : styles.handBottomRow,
              {
                width: rowWidth,
                zIndex: isTopRow ? rowIndex : 20,
              },
            ]}
          >
            {row.map((card, cardIndex) => {
              const playable = canPlayClient(card, game, playerId);
              const selected = selectedCardId === card.id;

              return (
                <View
                  key={card.id}
                  style={[
                    styles.handCardWrap,
                    {
                      left: cardIndex * step + (isTopRow ? step / 2 : 0),
                      zIndex: selected ? 50 : cardIndex,
                    },
                  ]}
                >
                  <MeasuredCard
                    card={card}
                    disabled={!playable}
                    hidden={hiddenCardId === card.id}
                    onPress={(sourcePoint) => {
                      if (!playable) {
                        return;
                      }
                      if (selected) {
                        onPlayCard(card, sourcePoint);
                        setSelectedCardId(null);
                        return;
                      }
                      playSoundPlaceholder("pick");
                      setSelectedCardId(card.id);
                    }}
                    selected={selected}
                    serverUrl={serverUrl}
                    tableOrigin={tableOrigin}
                  />
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function DrawDeckButton({
  canDraw,
  count,
  onDraw,
  serverUrl,
}: {
  canDraw: boolean;
  count: number;
  onDraw: () => void;
  serverUrl: string;
}) {
  return (
    <Pressable
      disabled={!canDraw}
      onPress={onDraw}
      style={({ pressed }) => [
        styles.drawDeckButton,
        !canDraw ? styles.deckDisabled : null,
        pressed ? styles.deckPressed : null,
      ]}
    >
      <CardBack count={count} deck serverUrl={serverUrl} />
    </Pressable>
  );
}

function TurnTimer({ progress, secondsLeft }: { progress: number; secondsLeft: number }) {
  const danger = secondsLeft <= 5;

  return (
    <View style={[styles.turnTimer, danger ? styles.turnTimerDanger : null]}>
      <Text style={[styles.turnTimerText, danger ? styles.turnTimerTextDanger : null]}>
        {secondsLeft}
      </Text>
      <View style={styles.turnTimerTrack}>
        <View
          style={[
            styles.turnTimerFill,
            danger ? styles.turnTimerFillDanger : null,
            { height: `${Math.max(0, Math.min(1, progress)) * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

function ActivityLog({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.activityLog}>
      {items.slice(0, 4).map((item, index) => (
        <AnimatedActivityRow key={item.id} index={index} text={item.text} />
      ))}
    </View>
  );
}

function AnimatedActivityRow({ index, text }: { index: number; text: string }) {
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        duration: 180,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        duration: 180,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, lift]);

  return (
    <Animated.View
      style={[
        styles.activityRow,
        {
          transform: [{ translateY: lift }],
          opacity: fade.interpolate({
            inputRange: [0, 1],
            outputRange: [0, Math.max(0.45, 1 - index * 0.16)],
          }),
        },
      ]}
    >
      <Text style={styles.activityText} numberOfLines={1}>{text}</Text>
    </Animated.View>
  );
}

function SuitChoiceOverlay({
  card,
  onChoose,
  serverUrl,
}: {
  card: Card | null;
  onChoose: (card: Card, suit: Suit) => void;
  serverUrl: string;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    if (!card) {
      fade.setValue(0);
      scale.setValue(0.94);
      return;
    }

    Animated.parallel([
      Animated.timing(fade, {
        duration: 160,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        damping: 14,
        mass: 0.8,
        stiffness: 180,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [card, fade, scale]);

  if (!card) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.suitOverlay, { opacity: fade }]}
    >
      <Animated.View style={[styles.suitOverlayPanel, { transform: [{ scale }] }]}>
        {suitChoiceOrder.map((suit) => (
          <Pressable
            accessibilityLabel={`Choose ${suitLabel(suit)}`}
            key={suit}
            onPress={() => onChoose(card, suit)}
            style={({ pressed }) => [
              styles.suitIconButton,
              pressed ? styles.suitIconButtonPressed : null,
            ]}
          >
            <View style={styles.suitIconClip}>
              <Image
                resizeMode="cover"
                source={cardImages[suitIconCards[suit]]}
                style={styles.suitIconImage}
              />
            </View>
          </Pressable>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

function OpponentSeat({ active, player, serverUrl, side }: OpponentSeatProps) {
  return (
    <View style={[styles.opponentSeat, active ? styles.activeSeat : null]}>
      <OpponentCardStack active={active} count={player.handCount} serverUrl={serverUrl} side={side} />
    </View>
  );
}

function MeasuredCard({
  card,
  disabled,
  hidden,
  onPress,
  selected,
  serverUrl,
  tableOrigin,
}: {
  card: Card;
  disabled: boolean;
  hidden: boolean;
  onPress: (sourcePoint?: Point) => void;
  selected: boolean;
  serverUrl: string;
  tableOrigin: Point;
}) {
  const wrapperRef = useRef<View | null>(null);

  function handlePress() {
    wrapperRef.current?.measureInWindow((x, y) => {
      onPress({
        x: x - tableOrigin.x,
        y: y - tableOrigin.y,
      });
    });

    if (!wrapperRef.current) {
      onPress();
    }
  }

  return (
    <View
      ref={wrapperRef}
      style={[
        hidden ? styles.hiddenSourceCard : null,
        selected ? styles.selectedCardLift : null,
      ]}
    >
      <GameCard
        card={card}
        disabled={disabled}
        onPress={handlePress}
        serverUrl={serverUrl}
      />
    </View>
  );
}

function OpponentCardStack({
  active,
  count,
  serverUrl,
  side,
}: {
  active: boolean;
  count: number;
  serverUrl: string;
  side: OpponentSide;
}) {
  const visibleCards = Math.min(Math.max(count, 1), OPPONENT_VISIBLE_LIMIT);
  const isSide = side === "left" || side === "right";
  const cardWidth = side === "top" ? CARD_WIDTH : OPPONENT_CARD_WIDTH;
  const cardHeight = side === "top" ? CARD_HEIGHT : OPPONENT_CARD_HEIGHT;
  const horizontalStep = side === "top" ? HAND_CARD_STEP : OPPONENT_CARD_STEP;
  const verticalStep = Math.round(OPPONENT_CARD_WIDTH * 0.42);
  const stackWidth = isSide
    ? cardHeight
    : cardWidth + (visibleCards - 1) * horizontalStep;
  const stackHeight = isSide
    ? cardWidth + (visibleCards - 1) * verticalStep
    : cardHeight + 12;

  return (
    <View
      style={[
        styles.opponentStack,
        { height: stackHeight, width: stackWidth },
        active ? styles.activeOpponentStack : null,
      ]}
    >
      {Array.from({ length: visibleCards }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.opponentStackCard,
            {
              left: isSide ? 0 : index * horizontalStep,
              top: isSide ? index * verticalStep : Math.min(index, 5) * 1.4,
              zIndex: index,
            },
          ]}
        >
          {isSide ? (
            <View
              style={[
                styles.sideOpponentCardFrame,
                {
                  transform: [{ rotate: side === "left" ? "90deg" : "-90deg" }],
                },
              ]}
            >
              <CardBack serverUrl={serverUrl} opponent />
            </View>
          ) : (
            <CardBack serverUrl={serverUrl} />
          )}
        </View>
      ))}
      {count >= OPPONENT_VISIBLE_LIMIT + 1 ? (
        <View style={styles.opponentTrueCount}>
          <Text style={styles.opponentTrueCountText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ConfettiOverlay({ run }: { run: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 26 }).map((_, index) => ({
        color: confettiColors[index % confettiColors.length],
        delay: index * 18,
        drift: (index % 2 === 0 ? 1 : -1) * (24 + (index % 5) * 12),
        leftPercent: (index * 37) % 100,
        rotate: `${90 + (index % 6) * 38}deg`,
      })),
    [],
  );

  if (run === 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {pieces.map((piece, index) => (
        <ConfettiPiece key={`${run}-${index}`} piece={piece} />
      ))}
    </View>
  );
}

function ConfettiPiece({ piece }: { piece: ConfettiPieceSpec }) {
  const fall = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fall.setValue(0);
    Animated.timing(fall, {
      delay: piece.delay,
      duration: 1250,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [fall, piece.delay]);

  const translateY = fall.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 760],
  });
  const translateX = fall.interpolate({
    inputRange: [0, 1],
    outputRange: [0, piece.drift],
  });
  const rotate = fall.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", piece.rotate],
  });
  const opacity = fall.interpolate({
    inputRange: [0, 0.78, 1],
    outputRange: [1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        {
          backgroundColor: piece.color,
          left: `${piece.leftPercent}%`,
          opacity,
          transform: [{ translateX }, { translateY }, { rotate }],
        },
      ]}
    />
  );
}

function AnimationLayer({
  activeAnimation,
  onDone,
  positions,
  seats,
  serverUrl,
}: AnimationLayerProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!activeAnimation) {
      progress.setValue(0);
      return;
    }

    progress.setValue(0);
    Animated.timing(progress, {
      duration: activeAnimation.type === "play" ? 440 : 360,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onDone();
      }
    });
  }, [activeAnimation, onDone, progress]);

  if (!activeAnimation) {
    return null;
  }

  const from = activeAnimation.type === "draw"
    ? positions.deck
    : getAnimationSource(activeAnimation, seats, positions);
  const to = activeAnimation.type === "draw"
    ? getAnimationTarget(activeAnimation, seats, positions)
    : positions.stack;
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [from.x, to.x],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [from.y, to.y],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", activeAnimation.type === "play" ? "11deg" : "0deg", "0deg"],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: activeAnimation.type === "play"
      ? [1, STACK_WIDTH / CARD_WIDTH + 0.14, STACK_WIDTH / CARD_WIDTH]
      : [DECK_WIDTH / CARD_WIDTH, 0.86, 1],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flyingCard,
        {
          transform: [
            { translateX },
            { translateY },
            { rotate },
            { scale },
          ],
        },
      ]}
    >
      {activeAnimation.type === "draw" || !activeAnimation.card ? (
        <CardBack serverUrl={serverUrl} />
      ) : (
        <GameCard card={activeAnimation.card} serverUrl={serverUrl} />
      )}
    </Animated.View>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        duration: 220,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        duration: 220,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, lift]);

  return (
    <Animated.View style={[styles.panel, { opacity: fade, transform: [{ translateY: lift }] }]}>
      {children}
    </Animated.View>
  );
}

function Button({
  disabled,
  label,
  onPress,
  tone = "primary",
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary" | "danger";
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function animate(toValue: number) {
    Animated.spring(scale, {
      friction: 6,
      tension: 180,
      toValue,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => animate(0.97)}
      onPressOut={() => animate(1)}
    >
      <Animated.View
        style={[
          styles.button,
          tone === "secondary" ? styles.secondaryButton : null,
          tone === "danger" ? styles.dangerButton : null,
          disabled ? styles.disabled : null,
          { transform: [{ scale }] },
        ]}
      >
        <Text style={[styles.buttonText, tone === "secondary" ? styles.secondaryButtonText : null]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function PlayerRow({ active, isYou, player }: { active: boolean; isYou: boolean; player: Player }) {
  return (
    <View style={[styles.playerRow, active ? styles.activePlayerRow : null]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{player.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>
          {player.name}
          {isYou ? " (You)" : ""}
        </Text>
        <Text style={styles.helper}>
          {player.handCount} cards {player.isHost ? " | Host" : ""}
        </Text>
      </View>
    </View>
  );
}

function CardBack({
  count,
  deck,
  large,
  mini,
  opponent,
  serverUrl,
  small,
}: {
  count?: number;
  deck?: boolean;
  large?: boolean;
  mini?: boolean;
  opponent?: boolean;
  serverUrl: string;
  small?: boolean;
}) {
  return (
    <View
      style={[
        styles.cardBack,
        large ? styles.largeCard : null,
        deck ? styles.deckCardBack : null,
        small ? styles.smallCardBack : null,
        mini ? styles.miniCardBack : null,
        opponent ? styles.opponentCardBack : null,
      ]}
    >
      <Image resizeMode="cover" source={CARD_BACK_IMAGE} style={styles.cardImage} />
      {typeof count === "number" ? (
        <View style={styles.cardBackBadge}>
          <Text style={styles.cardBackBadgeText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

function GameCard({
  card,
  disabled,
  large,
  onPress,
  serverUrl,
}: {
  card: Card | null;
  disabled?: boolean;
  large?: boolean;
  onPress?: () => void;
  serverUrl: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  function animate(toValue: number) {
    Animated.spring(scale, {
      friction: 7,
      tension: 170,
      toValue,
      useNativeDriver: true,
    }).start();
  }

  if (!card) {
    return (
      <View style={[styles.card, large ? styles.largeCard : null]}>
        <Text style={styles.cardRank}>?</Text>
      </View>
    );
  }

  return (
    <Pressable
      disabled={disabled || !onPress}
      onPress={onPress}
      onPressIn={() => animate(0.96)}
      onPressOut={() => animate(1)}
      style={[styles.cardTouchable, large ? styles.largeCardTouchable : null]}
    >
      <Animated.View
        style={[
          styles.card,
          large ? styles.largeCard : null,
          disabled ? styles.cardDisabled : null,
          { transform: [{ scale }] },
        ]}
      >
        {!imageFailed ? (
          <Image
            onError={() => setImageFailed(true)}
            resizeMode="contain"
            source={cardImages[card.imageKey] ?? CARD_BACK_IMAGE}
            style={styles.cardImage}
          />
        ) : (
          <View style={styles.cardFallback}>
            <Text style={styles.cardRank}>{rankLabel(card.rank)}</Text>
            <Text style={styles.cardSuit}>{suitLabel(card.suit)}</Text>
          </View>
        )}
        {disabled ? <View pointerEvents="none" style={styles.disabledCardOverlay} /> : null}
      </Animated.View>
    </Pressable>
  );
}

function inferTableAnimation(
  previous: ClientGameState | null,
  next: ClientGameState,
  selfId?: string,
  playedCardLayout?: { cardId: string; point: Point } | null,
): TableAnimation | null {
  if (!previous || previous.status !== "playing" || (next.status !== "playing" && next.status !== "finished")) {
    return null;
  }

  const actorId = previous.currentPlayerId;
  if (!actorId) {
    return null;
  }

  if (previous.middleCard?.id !== next.middleCard?.id && next.middleCard) {
    const previousHand = actorId === selfId ? sortHand(previous.hand) : previous.hand;
    const sourceCardIndex = actorId === selfId
      ? previousHand.findIndex((card) => card.id === next.middleCard?.id)
      : undefined;

    return {
      id: `play-${actorId}-${next.middleCard.id}-${Date.now()}`,
      card: next.middleCard,
      nextState: next,
      playerId: actorId,
      sourcePoint: playedCardLayout?.cardId === next.middleCard.id ? playedCardLayout.point : undefined,
      sourceCardIndex,
      sourceHandCount: actorId === selfId ? previous.hand.length : undefined,
      type: "play",
    };
  }

  if (next.deckCount < previous.deckCount) {
    const nextHand = actorId === selfId ? sortHand(next.hand) : next.hand;
    const drawnCard = actorId === selfId
      ? nextHand.find((card) => !previous.hand.some((previousCard) => previousCard.id === card.id))
      : undefined;

    return {
      id: `draw-${actorId}-${previous.deckCount}-${next.deckCount}-${Date.now()}`,
      nextState: next,
      playerId: actorId,
      targetCardIndex: actorId === selfId && drawnCard
        ? nextHand.findIndex((card) => card.id === drawnCard.id)
        : undefined,
      targetHandCount: actorId === selfId ? nextHand.length : undefined,
      type: "draw",
    };
  }

  return null;
}

function buildSeats(players: Player[], selfId: string): TableSeats {
  const self = players.find((player) => player.id === selfId) ?? players[0] ?? null;
  const others = players.filter((player) => player.id !== self?.id);

  if (others.length === 1) {
    return { bottom: self, top: others[0], left: null, right: null };
  }

  if (others.length === 2) {
    return { bottom: self, left: others[0], top: others[1], right: null };
  }

  return {
    bottom: self,
    left: others[0] ?? null,
    top: others[1] ?? null,
    right: others[2] ?? null,
  };
}

function getTablePositions(size: { height: number; width: number }): TablePositions {
  const centerX = size.width / 2;
  const centerY = size.height / 2;
  const opponentVisibleOffset = Math.round(OPPONENT_CARD_HEIGHT * 0.67);
  const maxOpponentStackWidth = CARD_WIDTH + (HAND_ROW_LIMIT - 1) * HAND_CARD_STEP;
  const deckVisualX = size.width - DECK_WIDTH - 18;
  const deckVisualY = size.height - DECK_HEIGHT - 196;

  return {
    bottom: { x: centerX - CARD_WIDTH / 2, y: size.height - CARD_HEIGHT - 18 },
    deck: {
      x: deckVisualX + DECK_WIDTH / 2 - CARD_WIDTH / 2,
      y: deckVisualY + DECK_HEIGHT / 2 - CARD_HEIGHT / 2,
    },
    left: { x: -opponentVisibleOffset + OPPONENT_CARD_HEIGHT / 2 - CARD_WIDTH / 2, y: centerY - CARD_HEIGHT / 2 },
    right: { x: size.width - OPPONENT_CARD_HEIGHT + opponentVisibleOffset + OPPONENT_CARD_HEIGHT / 2 - CARD_WIDTH / 2, y: centerY - CARD_HEIGHT / 2 },
    stack: { x: centerX - CARD_WIDTH / 2, y: centerY - CARD_HEIGHT / 2 },
    top: { x: centerX + maxOpponentStackWidth / 2 - CARD_WIDTH, y: -Math.round(CARD_HEIGHT * 0.67) },
    width: size.width,
    origin: { x: 0, y: 0 },
  };
}

function getAnimationSource(animation: TableAnimation, seats: TableSeats, positions: TablePositions) {
  if (
    animation.type === "play" &&
    animation.sourcePoint
  ) {
    return animation.sourcePoint;
  }

  if (
    animation.type === "play" &&
    seats.bottom?.id === animation.playerId &&
    typeof animation.sourceCardIndex === "number" &&
    typeof animation.sourceHandCount === "number"
  ) {
    return getBottomHandCardPosition(animation.sourceCardIndex, animation.sourceHandCount, positions);
  }

  return getSeatPosition(animation.playerId, seats, positions);
}

function getAnimationTarget(animation: TableAnimation, seats: TableSeats, positions: TablePositions) {
  if (
    animation.type === "draw" &&
    seats.bottom?.id === animation.playerId &&
    typeof animation.targetCardIndex === "number" &&
    typeof animation.targetHandCount === "number"
  ) {
    return getBottomHandCardPosition(animation.targetCardIndex, animation.targetHandCount, positions);
  }

  return getSeatPosition(animation.playerId, seats, positions);
}

function getSeatPosition(playerId: string, seats: TableSeats, positions: TablePositions) {
  if (seats.bottom?.id === playerId) {
    return positions.bottom;
  }
  if (seats.left?.id === playerId) {
    return positions.left;
  }
  if (seats.top?.id === playerId) {
    return positions.top;
  }
  if (seats.right?.id === playerId) {
    return positions.right;
  }
  return positions.bottom;
}

function getBottomHandCardPosition(index: number, count: number, positions: TablePositions) {
  const totalRows = Math.max(1, Math.ceil(count / HAND_ROW_LIMIT));
  const safeIndex = Math.max(0, Math.min(index, count - 1));
  const row = Math.floor(safeIndex / HAND_ROW_LIMIT);
  const col = safeIndex % HAND_ROW_LIMIT;
  const rowCount = row === totalRows - 1 && count % HAND_ROW_LIMIT !== 0
    ? count % HAND_ROW_LIMIT
    : HAND_ROW_LIMIT;
  const step = getHandStep(rowCount, positions.width);
  const rowWidth = CARD_WIDTH + Math.max(0, rowCount - 1) * step;
  const startX = positions.width / 2 - rowWidth / 2;

  return {
    x: startX + col * step,
    y: positions.bottom.y - (totalRows - 1 - row) * HAND_ROW_STEP,
  };
}

function getHandStep(cardCount: number, tableWidth = 390) {
  if (cardCount <= 1) {
    return HAND_CARD_STEP;
  }

  const maxRowWidth = tableWidth - 24;
  const idealWidth = CARD_WIDTH + (cardCount - 1) * HAND_CARD_STEP;
  if (idealWidth <= maxRowWidth) {
    return HAND_CARD_STEP;
  }

  return Math.max(38, Math.floor((maxRowWidth - CARD_WIDTH) / (cardCount - 1)));
}

function sortHand(cards: Card[]) {
  return [...cards].sort((left, right) => {
    const suitDelta = suitSortOrder[left.suit] - suitSortOrder[right.suit];
    if (suitDelta !== 0) {
      return suitDelta;
    }

    return rankSortOrder[left.rank] - rankSortOrder[right.rank];
  });
}

function trimActivityLog(items: ActivityItem[]) {
  return items.slice(0, 5);
}

function formatActivity(animation: TableAnimation): ActivityItem {
  const player = animation.nextState.players.find((candidate) => candidate.id === animation.playerId);
  const name = player?.name ?? "Player";

  if (animation.type === "draw") {
    return messageActivity(`${name} drew 1 card`);
  }

  return messageActivity(`${name} played ${rankLabel(animation.card.rank)} of ${suitLabel(animation.card.suit)}`);
}

function messageActivity(text: string): ActivityItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text,
  };
}

function chunk<T>(items: T[], size: number) {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}

function buildHandRows(cards: Card[]) {
  return chunk(cards, 5).reverse();
}

function canPlayClient(card: Card, game: ClientGameState, playerId?: string) {
  if (game.status !== "playing" || game.currentPlayerId !== playerId) {
    return false;
  }

  if (game.pendingAction) {
    if (game.pendingAction.targetPlayerId !== playerId) {
      return false;
    }

    return game.pendingAction.type === "draw" ? card.rank === 2 : card.rank === 1;
  }

  if (game.chosenSuit) {
    return card.suit === game.chosenSuit || card.rank === 7;
  }

  return Boolean(
    game.middleCard && (card.suit === game.middleCard.suit || card.rank === game.middleCard.rank),
  );
}

function suitLabel(suit: Suit) {
  const labels: Record<Suit, string> = {
    sticks: "Sticks",
    cups: "Cups",
    swords: "Swords",
    gold: "Gold",
  };

  return labels[suit];
}

function rankLabel(rank: Rank) {
  return String(rank);
}

const suits = ["sticks", "cups", "swords", "gold"] as const;
const suitChoiceOrder: Suit[] = ["gold", "cups", "swords", "sticks"];
const confettiColors = ["#fff3c4", "#ff6b5f", "#28b36d", "#5cc8ff", "#f7a8ff", "#ffffff"];

type AppMode = "connect" | "lobby" | "game";
type AppScreen = "menu" | "room";
type Suit = (typeof suits)[number];
type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

const suitSortOrder: Record<Suit, number> = {
  gold: 0,
  cups: 1,
  swords: 2,
  sticks: 3,
};
const rankSortOrder: Record<Rank, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  10: 7,
  11: 8,
  12: 9,
};

type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  imageKey: string;
  imagePath: string;
};

type Player = {
  id: string;
  name: string;
  handCount: number;
  isHost: boolean;
  isConnected: boolean;
  placement: number | null;
};

type PendingAction =
  | {
      type: "skip";
      targetPlayerId: string;
      expiresAt: number;
    }
  | {
      type: "draw";
      targetPlayerId: string;
      amount: number;
      expiresAt: number;
    };

type ClientGameState = {
  roomId: string;
  status: "lobby" | "playing" | "finished";
  players: Player[];
  hand: Card[];
  deckCount: number;
  discardCount: number;
  middleCard: Card | null;
  currentPlayerId: string | null;
  chosenSuit: Suit | null;
  pendingAction: PendingAction | null;
  turnExpiresAt: number | null;
  canDraw: boolean;
  winnerId: string | null;
  loserId: string | null;
  roundResults: string[];
  scores: Record<string, number>;
  message: string;
  youAreHost: boolean;
};

type Session = {
  roomId: string;
  playerId: string;
};

type ServerAnimationEvent = {
  playerId: string;
  card?: Card;
};

type TableAnimation =
  | {
      id: string;
      nextState: ClientGameState;
      playerId: string;
      targetCardIndex?: number;
      targetHandCount?: number;
      type: "draw";
    }
  | {
      card: Card;
      id: string;
      nextState: ClientGameState;
      playerId: string;
      sourcePoint?: Point;
      sourceCardIndex?: number;
      sourceHandCount?: number;
      type: "play";
    };

type Point = {
  x: number;
  y: number;
};

type TablePositions = {
  bottom: Point;
  deck: Point;
  left: Point;
  origin: Point;
  right: Point;
  stack: Point;
  top: Point;
  width: number;
};

type TableSeats = {
  bottom: Player | null;
  left: Player | null;
  right: Player | null;
  top: Player | null;
};

type OpponentSide = "left" | "right" | "top";

type GameTableProps = {
  adDue: boolean;
  activeAnimation: TableAnimation | null;
  activityLog: ActivityItem[];
  canDraw: boolean;
  currentPlayerName: string;
  game: ClientGameState;
  onAnimationDone: () => void;
  onDraw: () => void;
  onPlayCard: (card: Card, sourcePoint?: Point) => void;
  onAdClosed: () => void;
  onQuit: () => void;
  onResolvePending: () => void;
  onRetry: () => void;
  onSevenSuit: (card: Card, suit: Suit) => void;
  pendingForYou: boolean;
  pendingSevenCard: Card | null;
  playerId: string;
  secondsLeft: number;
  serverUrl: string;
  tableLabel: string;
  timerProgress: number;
  turnProgress: number;
  turnSecondsLeft: number;
  confettiRun: number;
};

type ConfettiPieceSpec = {
  color: string;
  delay: number;
  drift: number;
  leftPercent: number;
  rotate: string;
};

type ActivityItem = {
  id: string;
  text: string;
};

type PlayerHandProps = {
  activeAnimation: TableAnimation | null;
  cards: Card[];
  game: ClientGameState;
  onPlayCard: (card: Card, sourcePoint?: Point) => void;
  playerId: string;
  selectedCardId: string | null;
  serverUrl: string;
  setSelectedCardId: (cardId: string | null) => void;
  tableOrigin: Point;
  tableWidth: number;
};

type OpponentSeatProps = {
  active: boolean;
  player: Player;
  serverUrl: string;
  side: OpponentSide;
};

type AnimationLayerProps = {
  activeAnimation: TableAnimation | null;
  onDone: () => void;
  positions: TablePositions;
  seats: TableSeats;
  serverUrl: string;
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#101317",
  },
  keyboardView: {
    flex: 1,
  },
  menuContent: {
    alignSelf: "center",
    gap: 14,
    justifyContent: "center",
    maxWidth: 520,
    minHeight: "100%",
    padding: 16,
    width: "100%",
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  appTitle: {
    color: "#f8fafc",
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: 0,
  },
  appSubtitle: {
    color: "#bac2cc",
    fontSize: 14,
    marginTop: 2,
  },
  statusDot: {
    backgroundColor: "#72757a",
    borderColor: "#ffffff",
    borderRadius: 9,
    borderWidth: 3,
    height: 18,
    width: 18,
  },
  onlineDot: {
    backgroundColor: "#28b36d",
  },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#e1ddd4",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  panelTitle: {
    color: "#171b1f",
    fontSize: 18,
    fontWeight: "900",
  },
  input: {
    backgroundColor: "#fbfaf7",
    borderColor: "#d9d3c8",
    borderRadius: 8,
    borderWidth: 1,
    color: "#171b1f",
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  joinRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  joinInput: {
    flex: 1,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#171b1f",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 46,
    minWidth: 88,
    paddingHorizontal: 14,
  },
  secondaryButton: {
    backgroundColor: "#ece7dd",
  },
  dangerButton: {
    backgroundColor: "#b42318",
  },
  disabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryButtonText: {
    color: "#171b1f",
  },
  error: {
    color: "#ff6b5f",
    fontSize: 14,
    fontWeight: "800",
  },
  helper: {
    color: "#68717a",
    fontSize: 13,
  },
  message: {
    color: "#4e5964",
    fontSize: 14,
    fontWeight: "700",
  },
  metaLabel: {
    color: "#68717a",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  roomCodeBlock: {
    alignItems: "center",
    backgroundColor: "#f5f1e8",
    borderRadius: 8,
    padding: 14,
  },
  roomCode: {
    color: "#171b1f",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
  },
  playerList: {
    gap: 8,
  },
  playerRow: {
    alignItems: "center",
    backgroundColor: "#fbfaf7",
    borderColor: "#e2ddd4",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  activePlayerRow: {
    borderColor: "#1f8a5b",
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#171b1f",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: "#171b1f",
    fontSize: 15,
    fontWeight: "900",
  },
  menuBackground: {
    flex: 1,
  },
  menuShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 14, 18, 0.44)",
  },
  settingsButton: {
    alignItems: "center",
    backgroundColor: "rgba(16, 19, 23, 0.72)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
    position: "absolute",
    right: 16,
    top: 18,
    zIndex: 4,
  },
  settingsButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  mainMenuContent: {
    alignItems: "center",
    flex: 1,
    gap: 22,
    justifyContent: "center",
    padding: 22,
  },
  mainMenuTitle: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: 0,
  },
  accountStrip: {
    backgroundColor: "rgba(16, 19, 23, 0.72)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 340,
    padding: 12,
    width: "100%",
  },
  accountStripText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  accountStripSubtext: {
    color: "#cbd5df",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
    textAlign: "center",
  },
  authPanel: {
    gap: 10,
    maxWidth: 340,
    width: "100%",
  },
  mainMenuActions: {
    gap: 12,
    maxWidth: 340,
    width: "100%",
  },
  menuNotice: {
    color: "#ffe1dd",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  loadingPanel: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  loadingTitle: {
    backgroundColor: "rgba(16, 19, 23, 0.78)",
    borderRadius: 8,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tableScreen: {
    flex: 1,
    overflow: "hidden",
  },
  tableBackground: {
    flex: 1,
  },
  tableShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 14, 18, 0.22)",
  },
  tableDeselectLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  quitButton: {
    alignItems: "center",
    backgroundColor: "rgba(16, 19, 23, 0.72)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    left: 14,
    minHeight: 42,
    paddingHorizontal: 14,
    position: "absolute",
    top: 16,
    zIndex: 25,
  },
  quitButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  modalScrim: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
    flex: 1,
    justifyContent: "center",
    padding: 22,
  },
  confirmPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    gap: 12,
    maxWidth: 340,
    padding: 16,
    width: "100%",
  },
  confirmTitle: {
    color: "#171b1f",
    fontSize: 18,
    fontWeight: "900",
  },
  confirmText: {
    color: "#4e5964",
    fontSize: 14,
    fontWeight: "700",
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  seat: {
    position: "absolute",
    zIndex: 3,
  },
  topSeat: {
    alignSelf: "center",
    top: -Math.round(CARD_HEIGHT * 0.67),
  },
  leftSeat: {
    left: -Math.round(OPPONENT_CARD_HEIGHT * 0.67),
    top: "35%",
  },
  rightSeat: {
    right: -Math.round(OPPONENT_CARD_HEIGHT * 0.67),
    top: "35%",
  },
  opponentSeat: {
    alignItems: "center",
    backgroundColor: "transparent",
    minWidth: 0,
    padding: 0,
  },
  activeSeat: {
    opacity: 1,
  },
  opponentStack: {
    overflow: "visible",
  },
  activeOpponentStack: {
    shadowColor: "#fff3c4",
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 8,
  },
  opponentStackCard: {
    position: "absolute",
  },
  sideOpponentCardFrame: {
    height: OPPONENT_CARD_HEIGHT,
    left: Math.round((OPPONENT_CARD_HEIGHT - OPPONENT_CARD_WIDTH) / 2),
    position: "absolute",
    top: -Math.round((OPPONENT_CARD_HEIGHT - OPPONENT_CARD_WIDTH) / 2),
    width: OPPONENT_CARD_WIDTH,
  },
  tableStatus: {
    alignItems: "center",
    alignSelf: "center",
    gap: 5,
    position: "absolute",
    top: 154,
    width: "86%",
    zIndex: 2,
  },
  turnStatusRow: {
    alignItems: "center",
    backgroundColor: "rgba(16, 19, 23, 0.66)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    maxWidth: 320,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  turnStatusText: {
    flexShrink: 1,
  },
  turnLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  tableLabel: {
    color: "#eaf1f7",
    fontSize: 12,
    fontWeight: "900",
  },
  turnTimer: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.26)",
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: "center",
    overflow: "hidden",
    width: 36,
  },
  turnTimerDanger: {
    borderColor: "#ffb4aa",
  },
  turnTimerText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    zIndex: 2,
  },
  turnTimerTextDanger: {
    color: "#ffe1dd",
  },
  turnTimerTrack: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  turnTimerFill: {
    backgroundColor: "rgba(92, 200, 255, 0.48)",
    width: "100%",
  },
  turnTimerFillDanger: {
    backgroundColor: "rgba(255, 107, 95, 0.56)",
  },
  pendingCard: {
    backgroundColor: "rgba(255, 243, 196, 0.95)",
    borderRadius: 8,
    gap: 8,
    maxWidth: 330,
    padding: 10,
    width: "100%",
  },
  pendingHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pendingText: {
    color: "#493700",
    fontSize: 14,
    fontWeight: "900",
  },
  countdown: {
    color: "#b42318",
    fontSize: 18,
    fontWeight: "900",
  },
  timerTrack: {
    backgroundColor: "#e5d38a",
    borderRadius: 6,
    height: 8,
    overflow: "hidden",
  },
  timerFill: {
    backgroundColor: "#b42318",
    borderRadius: 6,
    height: "100%",
  },
  centerPile: {
    alignItems: "center",
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: "35%",
    zIndex: 4,
  },
  drawDeckButton: {
    borderRadius: 8,
    bottom: 184,
    position: "absolute",
    right: 18,
    zIndex: 8,
  },
  deckPressable: {
    borderRadius: 8,
  },
  deckPressed: {
    transform: [{ scale: 0.97 }],
  },
  deckDisabled: {
    borderColor: "rgba(255,255,255,0.32)",
    borderWidth: 1,
  },
  activityLog: {
    alignSelf: "center",
    gap: 5,
    left: 24,
    position: "absolute",
    right: 24,
    top: "66%",
    zIndex: 5,
  },
  activityRow: {
    alignSelf: "center",
    backgroundColor: "rgba(16, 19, 23, 0.72)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 320,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activityText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  bottomArea: {
    backgroundColor: "transparent",
    bottom: 0,
    gap: 6,
    left: 0,
    paddingBottom: 10,
    paddingHorizontal: 12,
    paddingTop: 0,
    position: "absolute",
    right: 0,
    zIndex: 6,
  },
  handHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  bottomName: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  bottomHint: {
    color: "#cbd5df",
    fontSize: 12,
    fontWeight: "700",
  },
  sevenChoice: {
    backgroundColor: "#f7f3ea",
    borderColor: "#d9d3c8",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  sevenChoiceHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sevenChoiceTitle: {
    color: "#171b1f",
    fontSize: 14,
    fontWeight: "900",
  },
  suitPicker: {
    flexDirection: "row",
    gap: 8,
  },
  suitButton: {
    alignItems: "center",
    backgroundColor: "#171b1f",
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 6,
  },
  suitButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  suitOverlay: {
    alignItems: "center",
    bottom: 190,
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 18,
  },
  suitOverlayPanel: {
    alignItems: "center",
    backgroundColor: "rgba(16, 19, 23, 0.78)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  suitIconButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "rgba(255,255,255,0.72)",
    borderRadius: 8,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    overflow: "hidden",
    width: 58,
  },
  suitIconButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  suitIconClip: {
    height: 46,
    overflow: "hidden",
    width: 46,
  },
  suitIconImage: {
    height: 104,
    transform: [{ translateX: -12 }, { translateY: -30 }],
    width: 70,
  },
  handRows: {
    alignItems: "flex-end",
    gap: 0,
    minHeight: CARD_HEIGHT + Math.round(CARD_HEIGHT * 0.4),
    width: "100%",
  },
  handRow: {
    alignSelf: "center",
    height: CARD_HEIGHT,
    position: "relative",
  },
  handTopRow: {
    marginBottom: -Math.round(CARD_HEIGHT * 0.6),
  },
  handBottomRow: {
    marginBottom: 0,
  },
  handCardWrap: {
    position: "absolute",
    top: 0,
  },
  selectedCardLift: {
    transform: [{ translateY: -18 }],
  },
  hiddenSourceCard: {
    opacity: 0,
  },
  flyingCard: {
    left: 0,
    position: "absolute",
    top: 0,
    zIndex: 20,
  },
  endOverlay: {
    alignItems: "center",
    bottom: 150,
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 24,
  },
  endPanel: {
    alignItems: "center",
    backgroundColor: "rgba(16, 19, 23, 0.86)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    maxWidth: 330,
    padding: 14,
    width: "82%",
  },
  endTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  endResultText: {
    color: "#eaf1f7",
    fontSize: 13,
    fontWeight: "800",
  },
  scoreBlock: {
    gap: 8,
    paddingTop: 6,
    width: "100%",
  },
  scoreText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  adPlaceholder: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 8,
    padding: 10,
    width: "100%",
  },
  adPlaceholderText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  cardTouchable: {
    flexShrink: 0,
    height: CARD_HEIGHT,
    width: CARD_WIDTH,
  },
  largeCardTouchable: {
    height: STACK_HEIGHT,
    width: STACK_WIDTH,
  },
  card: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d9d3c8",
    borderRadius: 8,
    borderWidth: 1,
    height: CARD_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
    width: CARD_WIDTH,
  },
  cardBack: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d9e8e1",
    borderRadius: 8,
    borderWidth: 1,
    height: CARD_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: CARD_WIDTH,
  },
  largeCard: {
    height: STACK_HEIGHT,
    width: STACK_WIDTH,
  },
  deckCardBack: {
    borderRadius: 6,
    height: DECK_HEIGHT,
    width: DECK_WIDTH,
  },
  smallCardBack: {
    borderRadius: 5,
    height: 36,
    width: 25,
  },
  miniCardBack: {
    borderRadius: 5,
    height: 44,
    width: 30,
  },
  opponentCardBack: {
    borderRadius: 7,
    height: OPPONENT_CARD_HEIGHT,
    width: OPPONENT_CARD_WIDTH,
  },
  opponentTrueCount: {
    alignItems: "center",
    backgroundColor: "#171b1f",
    borderColor: "#ffffff",
    borderRadius: 13,
    borderWidth: 1,
    bottom: -2,
    justifyContent: "center",
    minWidth: 26,
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: "absolute",
    right: -6,
    zIndex: 20,
  },
  opponentTrueCountText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  cardBackBadge: {
    alignItems: "center",
    backgroundColor: "#171b1f",
    borderColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    bottom: 5,
    minWidth: 28,
    paddingHorizontal: 7,
    paddingVertical: 4,
    position: "absolute",
    right: 4,
  },
  cardBackBadgeText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  cardDisabled: {
    borderColor: "#8d949c",
  },
  disabledCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12, 16, 20, 0.46)",
    borderRadius: 8,
  },
  cardImage: {
    height: "100%",
    width: "100%",
  },
  cardFallback: {
    alignItems: "center",
    gap: 5,
    justifyContent: "center",
    padding: 8,
  },
  cardRank: {
    color: "#171b1f",
    fontSize: 34,
    fontWeight: "900",
  },
  cardSuit: {
    color: "#68717a",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 30,
  },
  confettiPiece: {
    borderRadius: 2,
    height: 14,
    position: "absolute",
    top: 0,
    width: 8,
  },
});
