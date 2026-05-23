import { StatusBar } from "expo-status-bar";
import * as NavigationBar from "expo-navigation-bar";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session as SupabaseSession, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform, SafeAreaView, Share } from "react-native";
import { io, Socket } from "socket.io-client";
import {
  ActivityItem,
  AppMode,
  AppScreen,
  AuthGateScreen,
  Card,
  ClientGameState,
  GameTable,
  LaunchTransition,
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
import { MainMenuScreen } from "./src/screens/MainMenuScreen";

const storedSessionKey = "take-two-session";
const storedNameKey = "take-two-player-name";
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
const devEmails = new Set(["walidsabhied@gmail.com", "houdasafi555@gmail.com"]);
const devWallet = { coins: 999999, gems: 999999 };
const rewardedAdUnitId = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID ?? "ca-app-pub-5859429926694208/7036413721";
const matchEndInterstitialAdUnitId = process.env.EXPO_PUBLIC_ADMOB_MATCH_END_INTERSTITIAL_ID ?? "ca-app-pub-5859429926694208/6032426039";
const useAdMobTestIds = process.env.EXPO_PUBLIC_USE_ADMOB_TEST_IDS === "true";
type Wallet = { coins: number; gems: number };
type LeaderboardMetric = "coins" | "matches" | "wins";
type LeaderboardPeriod = "all_time" | "day" | "month" | "year";
type LeaderboardRow = {
  display_name: string;
  rank: number;
  user_id: string;
  value: number;
};
type FriendRow = {
  friend_id: string;
  last_seen_at: string;
  room_code: string | null;
  room_size: number | null;
  status: "offline" | "online" | "ingame" | "inroom";
  username: string;
};
type FriendRequestRow = {
  created_at: string;
  friendship_id: string;
  requester_id: string;
  username: string;
};
type FriendMessage = {
  body: string;
  created_at: string;
  id: string;
  receiver_id: string;
  sender_id: string;
};
type RoomChatMessage = {
  body: string;
  createdAt: string;
  id: string;
  playerId: string;
  playerName: string;
  roomId: string;
};

function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
}

function isValidUsername(value: string) {
  return /^[a-z0-9_]{3,24}$/.test(value);
}

export default function App() {
  const [serverUrl, setServerUrl] = useState(defaultServerUrl);
  const [name, setNameState] = useState("Player");
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
  const [authGateDone, setAuthGateDone] = useState(false);
  const [roomAction, setRoomAction] = useState<RoomAction>("create");
  const [adDue, setAdDue] = useState(false);
  const [lastAdShownAt, setLastAdShownAt] = useState(Date.now());
  const [showLaunch, setShowLaunch] = useState(true);
  const [launchConnected, setLaunchConnected] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0.12);
  const [launchStatus, setLaunchStatus] = useState("Connecting to server...");
  const [musicMuted, setMusicMutedState] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [matchmaking, setMatchmaking] = useState<{ queued: boolean; etaSeconds?: number; seconds?: number }>({ queued: false });
  const [wallet, setWallet] = useState<Wallet>({ coins: 0, gems: 0 });
  const [dailyRewardReady, setDailyRewardReady] = useState(false);
  const [dailyRewardNextClaimAt, setDailyRewardNextClaimAt] = useState<string | null>(null);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);
  const [leaderboardBusy, setLeaderboardBusy] = useState(false);
  const [gameMusicStartedAt, setGameMusicStartedAt] = useState<number | null>(null);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequestRow[]>([]);
  const [friendMessages, setFriendMessages] = useState<FriendMessage[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<FriendRow | null>(null);
  const [roomChatMessages, setRoomChatMessages] = useState<RoomChatMessage[]>([]);

  const visibleGameRef = useRef<ClientGameState | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const screenRef = useRef<AppScreen>("menu");
  const nameRef = useRef("Player");
  const queueBaseRef = useRef<ClientGameState | null>(null);
  const animationQueueRef = useRef<TableAnimation[]>([]);
  const activeAnimationRef = useRef<TableAnimation | null>(null);
  const playedCardLayoutRef = useRef<{ cardId: string; point: Point } | null>(null);
  const lastTurnSoundRef = useRef<{ playerId: string | null; roomId: string | null }>({ playerId: null, roomId: null });

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    void NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => undefined);
    void NavigationBar.setVisibilityAsync("hidden").catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(storedNameKey)
      .then((storedName) => {
        if (storedName?.trim()) {
          setNameState(storedName);
        }
      })
      .catch(() => undefined);
  }, []);

  function setName(nextName: string) {
    setNameState(nextName);
    if (nextName.trim()) {
      void AsyncStorage.setItem(storedNameKey, nextName.trim());
    }
  }

  useEffect(() => {
    if (!matchmaking.queued) {
      return;
    }

    const timer = setInterval(() => {
      setMatchmaking((current) => current.queued
        ? { ...current, seconds: (current.seconds ?? 0) + 1 }
        : current);
    }, 1000);

    return () => clearInterval(timer);
  }, [matchmaking.queued]);

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
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    sessionRef.current = session;
    if (session) {
      void AsyncStorage.setItem(storedSessionKey, JSON.stringify(session));
    }
  }, [session]);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    if (visibleGame?.status === "finished") {
      const didWin = visibleGame.winnerId === session?.playerId;
      const didLose = visibleGame.loserId === session?.playerId;
      if (didWin) {
        setConfettiRun((run) => run + 1);
      }
      playSoundPlaceholder(didWin ? "win" : didLose ? "lose" : "gameEnd");
      setTimeout(() => {
        void loadEconomy();
      }, 1800);
      if (Date.now() - lastAdShownAt >= 5 * 60 * 1000) {
        setAdDue(true);
        setLastAdShownAt(Date.now());
      }
    }
  }, [lastAdShownAt, session?.playerId, visibleGame?.loserId, visibleGame?.status, visibleGame?.winnerId]);

  useEffect(() => {
    if (visibleGame?.status === "playing") {
      setGameMusicStartedAt((startedAt) => startedAt ?? Date.now());
      return;
    }
    setGameMusicStartedAt(null);
  }, [visibleGame?.roomId, visibleGame?.status]);

  useEffect(() => {
    if (visibleGame?.status !== "playing") {
      lastTurnSoundRef.current = { playerId: null, roomId: visibleGame?.roomId ?? null };
      return;
    }

    const next = { playerId: visibleGame.currentPlayerId, roomId: visibleGame.roomId };
    const previous = lastTurnSoundRef.current;
    const changed =
      previous.roomId === next.roomId &&
      Boolean(previous.playerId) &&
      previous.playerId !== next.playerId;
    lastTurnSoundRef.current = next;

    if (changed) {
      playSoundPlaceholder("turn");
    }
  }, [visibleGame?.currentPlayerId, visibleGame?.roomId, visibleGame?.status]);

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
      if (data.session?.user) {
        setAuthGateDone(true);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setAuthSession(nextSession);
      setAuthUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        setAuthGateDone(true);
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void loadEconomy();
    void loadProfileName();
    void loadFriends();
  }, [authUser?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        return;
      }

      const currentSocket = socketRef.current;
      const currentSession = sessionRef.current;
      const shouldResumeRoom = Boolean(currentSession && (visibleGameRef.current || screenRef.current === "room"));

      if (currentSocket?.connected && currentSession && shouldResumeRoom) {
        currentSocket.emit("resumeSession", { ...currentSession, name: nameRef.current });
      } else if (currentSocket && !currentSocket.connected) {
        currentSocket.connect();
      } else if (!currentSocket && currentSession && shouldResumeRoom) {
        connect({ resetState: false, resume: true });
      }
    });

    return () => subscription.remove();
  }, []);

  const currentPlayer = visibleGame?.players.find((player) => player.id === visibleGame.currentPlayerId);
  const isDevAccount = Boolean(authUser?.email && devEmails.has(authUser.email.toLowerCase()));
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

  useEffect(() => {
    const elapsed = gameMusicStartedAt ? (now - gameMusicStartedAt) / 1000 : 0;
    const scene = matchmaking.queued
      ? "queue"
      : appMode === "lobby"
        ? "rooms"
        : visibleGame?.status === "playing"
          ? elapsed >= 60
            ? "gameFinal"
            : elapsed >= 30
              ? "gameIntense"
              : "game"
          : "menu";

    void import("./src/audio/soundEffects")
      .then(({ setMusicScene }) => setMusicScene(scene))
      .catch(() => undefined);
  }, [appMode, gameMusicStartedAt, matchmaking.queued, now, visibleGame?.status]);

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

  function connect(options: { resetState?: boolean; resume?: boolean } = {}) {
    const resetState = options.resetState ?? true;
    socket?.disconnect();
    setError("");
    if (resetState) {
      setVisibleGame(null);
      setSession(null);
      setActivityLog([]);
      queueBaseRef.current = null;
      animationQueueRef.current = [];
      setActiveAnimation(null);
      setPendingSevenCard(null);
    }

    const nextSocket = io(serverUrl, {
      auth: {
        accessToken: authSession?.access_token,
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
      reconnectionDelayMax: 3000,
      transports: ["websocket"],
    });

    nextSocket.on("connect_error", () => {
      setError("Cannot connect. Make sure the server is running.");
    });
    nextSocket.on("connect", async () => {
      const currentSession = sessionRef.current
        ?? await AsyncStorage.getItem(storedSessionKey)
          .then((value) => value ? JSON.parse(value) as Session : null)
          .catch(() => null);

      if (currentSession && (options.resume || visibleGameRef.current || screenRef.current === "room")) {
        nextSocket.emit("resumeSession", { ...currentSession, name: nameRef.current });
      }
    });
    nextSocket.on("session", (nextSession: Session | null) => {
      setSession(nextSession);
      if (nextSession) {
        setScreen("room");
        setMatchmaking({ queued: false });
      }
      if (!nextSession) {
        void AsyncStorage.removeItem(storedSessionKey);
      }
    });
    nextSocket.on("gameState", receiveGameState);
    nextSocket.on("player_draws_card", (event: ServerAnimationEvent) => {
      void event;
    });
    nextSocket.on("player_plays_card", (event: ServerAnimationEvent) => {
      void event;
    });
    nextSocket.on("turn_changes", () => playSoundPlaceholder("turn"));
    nextSocket.on("matchmakingStatus", setMatchmaking);
    nextSocket.on("errorMessage", setError);
    nextSocket.on("roomChatMessage", (message: RoomChatMessage) => {
      setRoomChatMessages((items) => [message, ...items].slice(0, 50));
    });
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
    setFriendsOpen(false);
    setScreen("room");
  }

  function openJoinRoom() {
    setRoomAction("join");
    setError("");
    setFriendsOpen(false);
    setScreen("room");
  }

  function playRandom() {
    if (!authUser) {
      setError("Sign in to play random.");
      setProfileOpen(true);
      return;
    }
    if (!isDevAccount && wallet.coins < 25) {
      setError("You need 25 coins to play random.");
      return;
    }

    setError("");
    setMatchmaking({ queued: true, seconds: 0 });
    setFriendsOpen(false);
    if (!socket?.connected) {
      const nextSocket = connect({ resetState: false });
      nextSocket.once("connect", () => nextSocket.emit("joinMatchmaking", { name }));
      return;
    }
    emit("joinMatchmaking", { name });
  }

  function cancelMatchmaking() {
    setMatchmaking({ queued: false });
    socket?.emit("cancelMatchmaking");
  }

  function copyRoomCode(roomId: string) {
    void Clipboard.setStringAsync(roomId);
    setError(`Copied room code ${roomId}.`);
  }

  async function shareRoomCode(roomId: string) {
    await Share.share({
      message: `Join me in Take Two app on this code: ${roomId}`,
    });
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

  function continueAsGuest() {
    setAuthGateDone(true);
    AsyncStorage.getItem(storedSessionKey)
      .then((value) => {
        if (!value) {
          return;
        }
        const stored = JSON.parse(value) as Session;
        setSession(stored);
        connect({ resetState: false, resume: true });
        setScreen("room");
      })
      .catch(() => undefined);
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
      return;
    }
    setAuthGateDone(true);
  }

  async function signUp() {
    if (!supabase) {
      setError("Supabase is not configured in .env.");
      return;
    }

    const username = normalizeUsername(name.trim());
    if (!isValidUsername(username)) {
      setError("Choose a pseudo with 3-24 letters, numbers, or underscores.");
      return;
    }

    setAuthBusy(true);
    setError("");
    const { data: usernameAvailable, error: usernameError } = await supabase.rpc("is_username_available", {
      requested_username: username,
    });
    if (usernameError) {
      setAuthBusy(false);
      setError(usernameError.message);
      return;
    }
    if (!usernameAvailable) {
      setAuthBusy(false);
      setError("This pseudo is already taken.");
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
      options: {
        data: {
          display_name: username,
          username,
        },
      },
    });
    setAuthBusy(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setAuthGateDone(true);
  }

  async function loadProfileName() {
    if (!supabase || !authUser) {
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("username,display_name")
      .eq("id", authUser.id)
      .maybeSingle();
    const profileName = data?.username ?? data?.display_name;
    if (profileName?.trim()) {
      setName(profileName.trim());
    }
  }

  async function loadEconomy() {
    if (!supabase || !authUser) {
      setWallet({ coins: 0, gems: 0 });
      setDailyRewardReady(false);
      setDailyRewardNextClaimAt(null);
      return;
    }

    if (authUser.email && devEmails.has(authUser.email.toLowerCase())) {
      setWallet(devWallet);
      setDailyRewardReady(true);
      setDailyRewardNextClaimAt(null);
      return;
    }

    const [{ data: walletData }, { data: dailyData }] = await Promise.all([
      supabase.from("wallets").select("coins,gems").eq("user_id", authUser.id).single(),
      supabase.from("daily_rewards").select("next_claim_at").eq("user_id", authUser.id).maybeSingle(),
    ]);

    setWallet({
      coins: walletData?.coins ?? 0,
      gems: walletData?.gems ?? 0,
    });
    const nextClaim = dailyData?.next_claim_at ?? null;
    setDailyRewardNextClaimAt(nextClaim);
    setDailyRewardReady(!nextClaim || new Date(nextClaim).getTime() <= Date.now());
  }

  async function loadLeaderboard(metric: LeaderboardMetric, period: LeaderboardPeriod) {
    if (!supabase) {
      setLeaderboardRows([]);
      setError("Supabase is not configured.");
      return;
    }

    setLeaderboardBusy(true);
    setError("");
    const { data, error: leaderboardError } = await supabase.rpc("get_leaderboard", {
      metric,
      period,
      limit_count: 50,
    });
    setLeaderboardBusy(false);
    if (leaderboardError) {
      setError(leaderboardError.message);
      return;
    }
    setLeaderboardRows((data ?? []) as LeaderboardRow[]);
  }

  async function loadFriends() {
    if (!supabase || !authUser) {
      setFriends([]);
      setFriendRequests([]);
      setFriendMessages([]);
      setSelectedFriend(null);
      return;
    }

    const [{ data: friendData, error: friendError }, { data: requestData, error: requestError }] = await Promise.all([
      supabase.rpc("get_friends"),
      supabase.rpc("get_friend_requests"),
    ]);

    if (friendError || requestError) {
      setError(friendError?.message ?? requestError?.message ?? "Could not load friends.");
      return;
    }

    setFriends((friendData ?? []) as FriendRow[]);
    setFriendRequests((requestData ?? []) as FriendRequestRow[]);
  }

  async function sendFriendRequest(username: string) {
    if (!supabase || !authUser) {
      setError("Sign in to add friends.");
      return;
    }

    const { error: requestError } = await supabase.rpc("send_friend_request", {
      requested_username: username,
    });
    if (requestError) {
      setError(requestError.message);
      return;
    }
    setError("Friend request sent.");
    await loadFriends();
  }

  async function respondFriendRequest(friendshipId: string, accept: boolean) {
    if (!supabase || !authUser) {
      setError("Sign in to manage friends.");
      return;
    }

    const { error: responseError } = await supabase.rpc("respond_friend_request", {
      accept,
      friendship_uuid: friendshipId,
    });
    if (responseError) {
      setError(responseError.message);
      return;
    }
    await loadFriends();
  }

  async function openFriendChat(friend: FriendRow) {
    setSelectedFriend(friend);
    if (!supabase || !authUser) {
      return;
    }
    const { data, error: messagesError } = await supabase.rpc("get_friend_messages", {
      friend_uuid: friend.friend_id,
      limit_count: 50,
    });
    if (messagesError) {
      setError(messagesError.message);
      return;
    }
    setFriendMessages(((data ?? []) as FriendMessage[]).reverse());
  }

  async function sendFriendMessage(body: string) {
    if (!supabase || !authUser || !selectedFriend) {
      setError("Choose a friend first.");
      return;
    }
    const { error: messageError } = await supabase.rpc("send_friend_message", {
      friend_uuid: selectedFriend.friend_id,
      message_body: body,
    });
    if (messageError) {
      setError(messageError.message);
      return;
    }
    await openFriendChat(selectedFriend);
  }

  async function claimDailyReward() {
    if (!supabase || !authUser) {
      setError("Sign in to claim daily rewards.");
      return;
    }
    if (isDevAccount) {
      setError("Dev account has unlimited coins and gems.");
      return;
    }

    setError("");
    const { data, error: claimError } = await supabase.rpc("claim_daily_reward", {
      user_uuid: authUser.id,
    });
    if (claimError) {
      setError(claimError.message);
      return;
    }
    const reward = Array.isArray(data) ? data[0] : data;
    setWallet({ coins: reward?.coins ?? wallet.coins, gems: reward?.gems ?? wallet.gems });
    setDailyRewardNextClaimAt(reward?.next_claim_at ?? null);
    setDailyRewardReady(false);
  }

  async function grantAdReward(currency: "coins" | "gems") {
    if (!supabase || !authUser) {
      setError("Sign in to earn rewards.");
      return;
    }
    if (isDevAccount) {
      setError("Dev account has unlimited coins and gems.");
      return;
    }

    const adResult = await showRewardedAd();
    if (!adResult.ok) {
      setError(adResult.error ?? "Watch the full rewarded ad to receive the reward.");
      return;
    }

    const amount = currency === "coins" ? 50 : 10;
    const rpc = currency === "coins" ? "add_coins" : "add_gems";
    const { error: rewardError } = await supabase.rpc(rpc, {
      user_uuid: authUser.id,
      amount,
      reason_text: "rewarded_ad",
      metadata_json: {},
    });
    if (rewardError) {
      setError(rewardError.message);
      return;
    }
    await loadEconomy();
    setError(`Reward added: ${amount} ${currency}.`);
  }

  async function grantAdPack(pack: { adsRequired: number; amount: number; currency: "coins" | "gems"; id: string }) {
    if (!supabase || !authUser) {
      setError("Sign in to earn rewards.");
      return;
    }
    if (isDevAccount) {
      setError("Dev account has unlimited coins and gems.");
      return;
    }

    for (let adIndex = 0; adIndex < pack.adsRequired; adIndex += 1) {
      setError(`Ad ${adIndex + 1}/${pack.adsRequired}`);
      const adResult = await showRewardedAd();
      if (!adResult.ok) {
        setError(adResult.error ?? `Pack cancelled at ad ${adIndex + 1}/${pack.adsRequired}.`);
        return;
      }
    }

    const rpc = pack.currency === "coins" ? "add_coins" : "add_gems";
    const { error: rewardError } = await supabase.rpc(rpc, {
      user_uuid: authUser.id,
      amount: pack.amount,
      reason_text: "rewarded_ad_pack",
      metadata_json: {
        ads_required: pack.adsRequired,
        pack_id: pack.id,
      },
    });
    if (rewardError) {
      setError(rewardError.message);
      return;
    }
    await loadEconomy();
    setError(`Reward added: ${pack.amount} ${pack.currency}.`);
  }

  async function showRewardedAd() {
    try {
      const { AdEventType, RewardedAd, RewardedAdEventType, TestIds, default: mobileAds } = await import("react-native-google-mobile-ads");
      await mobileAds().initialize();
      const rewarded = RewardedAd.createForAdRequest(useAdMobTestIds ? TestIds.REWARDED : rewardedAdUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      return await new Promise<{ error?: string; ok: boolean }>((resolve) => {
        let earnedReward = false;
        const cleanups: Array<() => void> = [];
        const timeout = setTimeout(() => finish({ error: "Ad timed out. Try again.", ok: false }), 20_000);
        const finish = (value: { error?: string; ok: boolean }) => {
          clearTimeout(timeout);
          while (cleanups.length > 0) {
            cleanups.pop()?.();
          }
          resolve(value);
        };

        cleanups.push(rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => rewarded.show()));
        cleanups.push(rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          earnedReward = true;
        }));
        cleanups.push(rewarded.addAdEventListener(AdEventType.CLOSED, () => finish({
          error: earnedReward ? undefined : "The ad closed before the reward was earned.",
          ok: earnedReward,
        })));
        cleanups.push(rewarded.addAdEventListener(AdEventType.ERROR, (error) => finish({
          error: error.message || "Rewarded ad was not ready. Try again in a moment.",
          ok: false,
        })));

        rewarded.load();
      });
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Rewarded ads are not available in this build.",
        ok: false,
      };
    }
  }

  async function showMatchEndInterstitialAd() {
    try {
      const { AdEventType, InterstitialAd, TestIds, default: mobileAds } = await import("react-native-google-mobile-ads");
      await mobileAds().initialize();
      const interstitial = InterstitialAd.createForAdRequest(useAdMobTestIds ? TestIds.INTERSTITIAL : matchEndInterstitialAdUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      const shown = await new Promise<boolean>((resolve) => {
        const cleanups: Array<() => void> = [];
        const finish = (value: boolean) => {
          while (cleanups.length > 0) {
            cleanups.pop()?.();
          }
          resolve(value);
        };

        cleanups.push(interstitial.addAdEventListener(AdEventType.LOADED, () => {
          interstitial.show();
          finish(true);
        }));
        cleanups.push(interstitial.addAdEventListener(AdEventType.ERROR, () => finish(false)));

        interstitial.load();
      });
      setAdDue(false);
      if (!shown) {
        setError("Ad was not ready.");
      }
    } catch {
      setAdDue(false);
      setError("Ads are not available in this build yet.");
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setAuthEmail("");
    setAuthPassword("");
    setAuthGateDone(false);
    setWallet({ coins: 0, gems: 0 });
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

  function sendRoomChatMessage(body: string) {
    if (!session || !socket?.connected) {
      setError("Join a room to chat.");
      return;
    }

    emit("roomChatMessage", { ...session, body });
  }

  function retryRound() {
    if (session) {
      emit("restartRoom", session);
    }
  }

  function backToRoom() {
    if (session) {
      emit("returnToLobby", session);
      setScreen("room");
    }
  }

  function queueAgain() {
    if (!authUser) {
      setError("Sign in to play random.");
      setProfileOpen(true);
      return;
    }
    if (!isDevAccount && wallet.coins < 25) {
      setError("You need 25 coins to play random.");
      return;
    }
    if (session && socket?.connected) {
      socket.emit("leaveRoom", session);
    }
    setSession(null);
    void AsyncStorage.removeItem(storedSessionKey);
    setVisibleGame(null);
    setRoomChatMessages([]);
    setActivityLog([]);
    setActiveAnimation(null);
    setPendingSevenCard(null);
    queueBaseRef.current = null;
    visibleGameRef.current = null;
    animationQueueRef.current = [];
    setScreen("menu");
    setMatchmaking({ queued: true, seconds: 0 });
    if (!socket?.connected) {
      const nextSocket = connect({ resetState: false });
      nextSocket.once("connect", () => nextSocket.emit("joinMatchmaking", { name }));
      return;
    }
    emit("joinMatchmaking", { name });
  }

  function cleanupToMenu() {
    if (session && socket?.connected) {
      socket.emit("leaveRoom", session);
    }
    socket?.removeAllListeners();
    socket?.disconnect();
    setSocket(null);
    setSession(null);
    void AsyncStorage.removeItem(storedSessionKey);
    setVisibleGame(null);
    setRoomChatMessages([]);
    setActivityLog([]);
    setActiveAnimation(null);
    setPendingSevenCard(null);
    setMatchmaking({ queued: false });
    setError("");
    queueBaseRef.current = null;
    visibleGameRef.current = null;
    animationQueueRef.current = [];
    setScreen("menu");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#101317" }}>
      <StatusBar hidden />
      {showLaunch ? (
        <LaunchTransition
          connected={launchConnected}
          onFinish={() => setShowLaunch(false)}
          progress={launchProgress}
          status={launchStatus}
        />
      ) : !authGateDone ? (
        <AuthGateScreen
          authBusy={authBusy}
          authEmail={authEmail}
          authPassword={authPassword}
          disabledText={error}
          onContinueGuest={continueAsGuest}
          onSignIn={signIn}
          onSignUp={signUp}
          setAuthEmail={setAuthEmail}
          setAuthPassword={setAuthPassword}
          name={name}
          setName={setName}
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
          onAdReward={grantAdReward}
          onShowInterstitialAd={showMatchEndInterstitialAd}
          onBackToRoom={backToRoom}
          onQueueAgain={queueAgain}
          onMainMenu={cleanupToMenu}
        />
      ) : screen === "menu" ? (
        <MainMenuScreen
          authBusy={authBusy}
          authEmail={authEmail}
          authPassword={authPassword}
          disabledText={error}
          musicMuted={musicMuted}
          matchmaking={matchmaking}
          wallet={isDevAccount ? devWallet : wallet}
          friends={friends}
          friendMessages={friendMessages}
          friendRequests={friendRequests}
          leaderboardBusy={leaderboardBusy}
          leaderboardRows={leaderboardRows}
          selectedFriend={selectedFriend}
          onLoadFriends={loadFriends}
          onLoadLeaderboard={loadLeaderboard}
          onOpenFriendChat={openFriendChat}
          onRespondFriendRequest={respondFriendRequest}
          onSendFriendMessage={sendFriendMessage}
          onSendFriendRequest={sendFriendRequest}
          dailyRewardReady={dailyRewardReady}
          dailyRewardNextClaimAt={dailyRewardNextClaimAt}
          isDevAccount={isDevAccount}
          onCancelMatchmaking={cancelMatchmaking}
          onClaimDailyReward={claimDailyReward}
          onCreateRoom={openCreateRoom}
          onJoinRoom={openJoinRoom}
          onPlayRandom={playRandom}
          onOpenProfile={() => setProfileOpen(true)}
          onCloseProfile={() => setProfileOpen(false)}
          name={name}
          setName={setName}
          onToggleMusicMute={toggleMusicMute}
          onSignIn={signIn}
          onSignOut={signOut}
          onSignUp={signUp}
          profileOpen={profileOpen}
          onOpenSettings={() => setError("Settings coming soon.")}
          setAuthEmail={setAuthEmail}
          setAuthPassword={setAuthPassword}
          user={authUser}
          onAdReward={grantAdReward}
          onWatchAdPack={grantAdPack}
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
          onCopyRoomCode={copyRoomCode}
          onShareRoomCode={shareRoomCode}
          onSendRoomChat={sendRoomChatMessage}
          onStartGame={startGame}
          roomChatMessages={roomChatMessages}
          roomAction={roomAction}
          session={session}
          setJoinCode={setJoinCode}
          setName={setName}
        />
      )}
    </SafeAreaView>
  );
}
