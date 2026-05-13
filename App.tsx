import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session as SupabaseSession, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native";
import { io, Socket } from "socket.io-client";
import {
  ActivityItem,
  AppMode,
  AppScreen,
  Card,
  ClientGameState,
  GameTable,
  LaunchTransition,
  MainMenuScreen,
  Point,
  RESPONSE_WINDOW_SECONDS,
  RoomAction,
  RoomScreen,
  ServerAnimationEvent,
  Session,
  Suit,
  TableAnimation,
  TURN_WINDOW_SECONDS,
  formatActivity,
  inferTableAnimation,
  messageActivity,
  playSoundPlaceholder,
  rankLabel,
  suitLabel,
  trimActivityLog,
} from "./src/views";

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
  const [roomAction, setRoomAction] = useState<RoomAction>("create");
  const [adDue, setAdDue] = useState(false);
  const [lastAdShownAt, setLastAdShownAt] = useState(Date.now());
  const [showLaunch, setShowLaunch] = useState(true);
  const [launchConnected, setLaunchConnected] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0.12);
  const [launchStatus, setLaunchStatus] = useState("Connecting to server...");
  const [musicMuted, setMusicMutedState] = useState(false);

  const visibleGameRef = useRef<ClientGameState | null>(null);
  const queueBaseRef = useRef<ClientGameState | null>(null);
  const animationQueueRef = useRef<TableAnimation[]>([]);
  const activeAnimationRef = useRef<TableAnimation | null>(null);
  const playedCardLayoutRef = useRef<{ cardId: string; point: Point } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function waitForServer() {
      let attempt = 0;
      while (!cancelled) {
        attempt += 1;
        setLaunchStatus(attempt === 1 ? "Connecting to server..." : "Server is waking up...");
        setLaunchProgress(Math.min(0.82, 0.16 + attempt * 0.11));

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch(`${serverUrl.replace(/\/$/, "")}/health`, {
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (response.ok) {
            setLaunchStatus("Connected");
            setLaunchProgress(1);
            try {
              const soundEngine = await import("./src/audio/soundEffects");
              await soundEngine.warmSoundEffects();
              soundEngine.setMusicMuted(musicMuted);
            } catch {
              // Audio warm-up should not stop the app from opening.
            }
            if (!cancelled) {
              setLaunchConnected(true);
            }
            return;
          }
        } catch {
          clearTimeout(timeout);
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    void waitForServer();
    return () => {
      cancelled = true;
    };
  }, [serverUrl]);

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
    if (nextAnimation) {
      playSoundPlaceholder(nextAnimation.type === "draw" ? "draw" : "play");
    }
    setActiveAnimation(nextAnimation);
  }, []);

  const finishAnimation = useCallback(() => {
    const finished = activeAnimationRef.current;
    if (!finished) {
      return;
    }

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

  function openCreateRoom() {
    setRoomAction("create");
    setJoinCode("");
    setError("");
    setScreen("room");
  }

  function openJoinRoom() {
    setRoomAction("join");
    setError("");
    setScreen("room");
  }

  function toggleMusicMute() {
    setMusicMutedState((previous) => {
      const next = !previous;
      void import("./src/audio/soundEffects")
        .then((soundEngine) => soundEngine.setMusicMuted(next))
        .catch(() => undefined);
      return next;
    });
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#101317" }}>
      <StatusBar style="light" />
      {showLaunch ? (
        <LaunchTransition
          connected={launchConnected}
          onFinish={() => setShowLaunch(false)}
          progress={launchProgress}
          status={launchStatus}
        />
      ) : screen === "menu" ? (
        <MainMenuScreen
          authBusy={authBusy}
          authEmail={authEmail}
          authPassword={authPassword}
          disabledText={error}
          musicMuted={musicMuted}
          onCreateRoom={openCreateRoom}
          onJoinRoom={openJoinRoom}
          onToggleMusicMute={toggleMusicMute}
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
        <RoomScreen
          appMode={appMode}
          connected={Boolean(socket?.connected)}
          error={error}
          game={visibleGame}
          joinCode={joinCode}
          name={name}
          onBack={cleanupToMenu}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onStartGame={startGame}
          roomAction={roomAction}
          session={session}
          setJoinCode={setJoinCode}
          setName={setName}
        />
      )}
    </SafeAreaView>
  );
}
