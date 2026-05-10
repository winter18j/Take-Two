import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  KeyboardAvoidingView,
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

const RESPONSE_WINDOW_SECONDS = 10;

export default function App() {
  const [serverUrl, setServerUrl] = useState("http://localhost:3001");
  const [name, setName] = useState("Player");
  const [joinCode, setJoinCode] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [game, setGame] = useState<ClientGameState | null>(null);
  const [error, setError] = useState("");
  const [chosenSuit, setChosenSuit] = useState<Suit>("sticks");
  const [pendingSevenCard, setPendingSevenCard] = useState<Card | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      socket?.disconnect();
    };
  }, [socket]);

  const currentPlayer = game?.players.find((player) => player.id === game.currentPlayerId);
  const you = session ? game?.players.find((player) => player.id === session.playerId) : null;
  const isYourTurn = Boolean(session && game?.currentPlayerId === session.playerId);
  const pendingForYou = Boolean(
    session && game?.pendingAction?.targetPlayerId === session.playerId,
  );
  const canDraw = Boolean(isYourTurn && !pendingForYou && game?.canDraw);
  const secondsLeft = game?.pendingAction
    ? Math.max(0, Math.ceil((game.pendingAction.expiresAt - now) / 1000))
    : 0;
  const timerProgress = game?.pendingAction
    ? Math.max(0, Math.min(1, secondsLeft / RESPONSE_WINDOW_SECONDS))
    : 0;
  const appMode: AppMode = !game ? "connect" : game.status === "lobby" ? "lobby" : "game";

  useEffect(() => {
    if (
      pendingSevenCard &&
      (!isYourTurn || !game?.hand.some((card) => card.id === pendingSevenCard.id))
    ) {
      setPendingSevenCard(null);
    }
  }, [game?.hand, isYourTurn, pendingSevenCard]);

  const tableLabel = useMemo(() => {
    if (!game?.middleCard) {
      return "No card yet";
    }

    if (game.chosenSuit) {
      return `${rankLabel(game.middleCard.rank)} changed to ${suitLabel(game.chosenSuit)}`;
    }

    return `${rankLabel(game.middleCard.rank)} of ${suitLabel(game.middleCard.suit)}`;
  }, [game?.middleCard, game?.chosenSuit]);

  function connect() {
    socket?.disconnect();
    setError("");
    setGame(null);
    setSession(null);

    const nextSocket = io(serverUrl, {
      transports: ["websocket"],
    });

    nextSocket.on("connect_error", () => {
      setError("Cannot connect. Make sure the server is running.");
    });
    nextSocket.on("session", setSession);
    nextSocket.on("gameState", setGame);
    nextSocket.on("errorMessage", setError);
    setSocket(nextSocket);
    return nextSocket;
  }

  function emit(event: string, payload: Record<string, unknown>) {
    setError("");
    socket?.emit(event, payload);
  }

  function createRoom() {
    if (!socket?.connected) {
      const nextSocket = connect();
      nextSocket.once("connect", () => nextSocket.emit("createRoom", { name }));
      return;
    }

    emit("createRoom", { name });
  }

  function joinRoom() {
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

  function playCard(card: Card) {
    if (!session) {
      return;
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

  function playSevenWithSuit(suit: Suit) {
    if (!session || !pendingSevenCard) {
      return;
    }

    setChosenSuit(suit);
    emit("playCard", {
      ...session,
      cardId: pendingSevenCard.id,
      chosenSuit: suit,
    });
    setPendingSevenCard(null);
  }

  function drawUntilPlayable() {
    if (session) {
      emit("drawUntilPlayable", session);
    }
  }

  function resolvePending() {
    if (session) {
      emit("resolvePending", session);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            appMode === "game" ? styles.gameContent : styles.centerContent,
          ]}
        >
          <View style={styles.topBar}>
            <View>
              <Text style={styles.appTitle}>La Baraja</Text>
              <Text style={styles.appSubtitle}>
                {appMode === "connect"
                  ? "Create a room or join one."
                  : appMode === "lobby"
                    ? "Waiting room"
                    : tableLabel}
              </Text>
            </View>
            <View style={[styles.statusDot, socket?.connected ? styles.onlineDot : null]} />
          </View>

          {appMode === "connect" ? (
            <AnimatedPanel>
              <Text style={styles.panelTitle}>Play Online</Text>
              <TextInput
                autoCapitalize="none"
                style={styles.input}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="Server URL"
                placeholderTextColor="#8c9197"
              />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="#8c9197"
              />
              <View style={styles.actions}>
                <Button label={socket?.connected ? "Connected" : "Connect"} onPress={connect} tone="secondary" />
                <Button label="Create Room" onPress={createRoom} />
              </View>
              <View style={styles.joinRow}>
                <TextInput
                  autoCapitalize="characters"
                  style={[styles.input, styles.joinInput]}
                  value={joinCode}
                  onChangeText={setJoinCode}
                  placeholder="Room code"
                  placeholderTextColor="#8c9197"
                />
                <Button label="Join" onPress={joinRoom} disabled={!joinCode.trim()} />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </AnimatedPanel>
          ) : null}

          {game && appMode === "lobby" ? (
            <AnimatedPanel>
              <View style={styles.roomCodeBlock}>
                <Text style={styles.metaLabel}>Room code</Text>
                <Text style={styles.roomCode}>{game.roomId}</Text>
              </View>
              <Text style={styles.message}>{game.message}</Text>
              <View style={styles.playerList}>
                {game.players.map((player) => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    isYou={player.id === session?.playerId}
                    active={player.id === game.currentPlayerId}
                  />
                ))}
              </View>
              {game.youAreHost ? (
                <Button label="Start Game" onPress={startGame} disabled={game.players.length < 2} />
              ) : (
                <Text style={styles.helper}>The host will start once there are at least 2 players.</Text>
              )}
            </AnimatedPanel>
          ) : null}

          {game && appMode === "game" ? (
            <>
              <View style={styles.scoreStrip}>
                {game.players.map((player) => (
                  <PlayerChip
                    key={player.id}
                    player={player}
                    serverUrl={serverUrl}
                    isYou={player.id === session?.playerId}
                    active={player.id === game.currentPlayerId}
                  />
                ))}
              </View>

              <AnimatedPanel style={styles.tablePanel}>
                <Text style={styles.turnLabel}>
                  {game.status === "finished"
                    ? `${game.players.find((player) => player.id === game.winnerId)?.name ?? "Someone"} won`
                    : `${currentPlayer?.name ?? "Waiting"}'s turn`}
                </Text>

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

                <View style={styles.tableCards}>
                  <CardBack serverUrl={serverUrl} count={game.deckCount} large />
                  <GameCard card={game.middleCard} serverUrl={serverUrl} large />
                </View>
                <Text style={styles.tableLabel}>{tableLabel}</Text>
              </AnimatedPanel>

              <AnimatedPanel style={styles.handPanel}>
                <View style={styles.handHeader}>
                  <View>
                    <Text style={styles.panelTitle}>{you?.name ?? "Your"} Hand</Text>
                    <Text style={styles.helper}>
                      {isYourTurn ? "Choose a playable card." : "Wait for your turn."}
                    </Text>
                  </View>
                  {pendingForYou ? (
                    <Button
                      label={game.pendingAction?.type === "draw" ? "Take" : "Skip"}
                      onPress={resolvePending}
                      tone="danger"
                    />
                  ) : (
                    <Button label="Draw" onPress={drawUntilPlayable} disabled={!canDraw} tone="secondary" />
                  )}
                </View>

                {pendingSevenCard ? (
                  <View style={styles.sevenChoice}>
                    <View style={styles.sevenChoiceHeader}>
                      <Text style={styles.sevenChoiceTitle}>Choose type for 7</Text>
                      <Pressable onPress={() => setPendingSevenCard(null)}>
                        <Text style={styles.cancelChoice}>Cancel</Text>
                      </Pressable>
                    </View>
                    <View style={styles.suitPicker}>
                      {suits.map((suit) => (
                        <Pressable
                          key={suit}
                          onPress={() => playSevenWithSuit(suit)}
                          style={[
                            styles.suitButton,
                            chosenSuit === suit ? styles.selectedSuit : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.suitButtonText,
                              chosenSuit === suit ? styles.selectedSuitText : null,
                            ]}
                          >
                            {suitLabel(suit)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  directionalLockEnabled
                  style={styles.handScroller}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[
                    styles.hand,
                    { minWidth: Math.max(0, game.hand.length * 104) },
                  ]}
                >
                  {game.hand.map((card) => {
                    const playable = canPlayClient(card, game, session?.playerId);

                    return (
                      <GameCard
                        key={card.id}
                        card={card}
                        serverUrl={serverUrl}
                        disabled={!playable}
                        onPress={() => playCard(card)}
                      />
                    );
                  })}
                </ScrollView>
              </AnimatedPanel>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AnimatedPanel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, lift]);

  return (
    <Animated.View
      style={[styles.panel, style, { opacity: fade, transform: [{ translateY: lift }] }]}
    >
      {children}
    </Animated.View>
  );
}

function Button({
  label,
  onPress,
  disabled,
  tone = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger";
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function animate(toValue: number) {
    Animated.spring(scale, {
      toValue,
      friction: 6,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animate(0.97)}
      onPressOut={() => animate(1)}
      disabled={disabled}
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
        <Text
          style={[
            styles.buttonText,
            tone === "secondary" ? styles.secondaryButtonText : null,
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function PlayerRow({
  player,
  isYou,
  active,
}: {
  player: Player;
  isYou: boolean;
  active: boolean;
}) {
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

function PlayerChip({
  player,
  serverUrl,
  isYou,
  active,
}: {
  player: Player;
  serverUrl: string;
  isYou: boolean;
  active: boolean;
}) {
  return (
    <View style={[styles.playerChip, active ? styles.activeChip : null]}>
      {!isYou ? (
        <View style={styles.opponentCards}>
          <CardBack serverUrl={serverUrl} small />
          {player.handCount > 1 ? (
            <View style={styles.opponentCardOffset}>
              <CardBack serverUrl={serverUrl} small />
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={styles.chipTextBlock}>
        <Text style={[styles.chipName, active ? styles.activeChipText : null]}>
          {isYou ? "You" : player.name}
        </Text>
        <Text style={[styles.chipCount, active ? styles.activeChipText : null]}>
          {player.handCount}
        </Text>
      </View>
    </View>
  );
}

function CardBack({
  serverUrl,
  count,
  large,
  small,
}: {
  serverUrl: string;
  count?: number;
  large?: boolean;
  small?: boolean;
}) {
  return (
    <View
      style={[
        styles.cardBack,
        large ? styles.largeCard : null,
        small ? styles.smallCardBack : null,
      ]}
    >
      <Image
        source={{ uri: `${serverUrl}/cards/cardback.png` }}
        style={styles.cardImage}
        resizeMode="cover"
      />
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
  serverUrl,
  onPress,
  disabled,
  large,
}: {
  card: Card | null;
  serverUrl: string;
  onPress?: () => void;
  disabled?: boolean;
  large?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  function animate(toValue: number) {
    Animated.spring(scale, {
      toValue,
      friction: 7,
      tension: 170,
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
      onPress={onPress}
      onPressIn={() => animate(0.96)}
      onPressOut={() => animate(1)}
      disabled={disabled || !onPress}
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
            source={{ uri: `${serverUrl}${card.imagePath}` }}
            style={styles.cardImage}
            resizeMode="contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={styles.cardFallback}>
            <Text style={styles.cardRank}>{rankLabel(card.rank)}</Text>
            <Text style={styles.cardSuit}>{suitLabel(card.suit)}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
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

type AppMode = "connect" | "lobby" | "game";
type Suit = (typeof suits)[number];
type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

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
  canDraw: boolean;
  winnerId: string | null;
  message: string;
  youAreHost: boolean;
};

type Session = {
  roomId: string;
  playerId: string;
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7f5ef",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    alignSelf: "center",
    gap: 14,
    maxWidth: 520,
    minHeight: "100%",
    padding: 16,
    width: "100%",
  },
  centerContent: {
    justifyContent: "center",
  },
  gameContent: {
    justifyContent: "flex-start",
    paddingTop: 18,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  appTitle: {
    color: "#171b1f",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
  },
  appSubtitle: {
    color: "#68717a",
    fontSize: 14,
    marginTop: 2,
  },
  statusDot: {
    backgroundColor: "#c5c0b8",
    borderColor: "#ffffff",
    borderRadius: 9,
    borderWidth: 3,
    height: 18,
    width: 18,
  },
  onlineDot: {
    backgroundColor: "#1f8a5b",
  },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#e1ddd4",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
    shadowColor: "#1b1d1f",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
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
    color: "#b42318",
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
  scoreStrip: {
    flexDirection: "row",
    gap: 8,
  },
  playerChip: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e1ddd4",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minHeight: 86,
    padding: 8,
  },
  activeChip: {
    backgroundColor: "#1f8a5b",
    borderColor: "#1f8a5b",
  },
  chipName: {
    color: "#4e5964",
    fontSize: 12,
    fontWeight: "800",
  },
  chipCount: {
    color: "#171b1f",
    fontSize: 20,
    fontWeight: "900",
  },
  chipTextBlock: {
    alignItems: "center",
  },
  activeChipText: {
    color: "#ffffff",
  },
  opponentCards: {
    height: 34,
    width: 48,
  },
  opponentCardOffset: {
    left: 13,
    position: "absolute",
    top: 4,
  },
  tablePanel: {
    alignItems: "center",
    backgroundColor: "#145a49",
    borderColor: "#145a49",
    gap: 12,
    minHeight: 300,
  },
  turnLabel: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  pendingCard: {
    backgroundColor: "#fff3c4",
    borderRadius: 8,
    gap: 8,
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
  tableCards: {
    alignItems: "center",
    flexDirection: "row",
    gap: 18,
    justifyContent: "center",
  },
  cardBack: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d9e8e1",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    height: 138,
    width: 92,
  },
  smallCardBack: {
    borderRadius: 5,
    height: 32,
    width: 22,
  },
  cardBackBadge: {
    alignItems: "center",
    backgroundColor: "#171b1f",
    borderRadius: 14,
    bottom: 8,
    minWidth: 28,
    paddingHorizontal: 7,
    paddingVertical: 4,
    position: "absolute",
    right: 8,
  },
  cardBackBadgeText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  deckCard: {
    alignItems: "center",
    backgroundColor: "#0f4539",
    borderColor: "#d9e8e1",
    borderRadius: 8,
    borderWidth: 1,
    height: 132,
    justifyContent: "center",
    width: 88,
  },
  deckCount: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
  },
  deckLabel: {
    color: "#c9ddd6",
    fontSize: 12,
    fontWeight: "800",
  },
  tableLabel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  handPanel: {
    gap: 12,
  },
  handHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  suitPicker: {
    flexDirection: "row",
    gap: 8,
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
  cancelChoice: {
    color: "#68717a",
    fontSize: 13,
    fontWeight: "900",
  },
  suitButton: {
    alignItems: "center",
    backgroundColor: "#f3f0e8",
    borderColor: "#d9d3c8",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  selectedSuit: {
    backgroundColor: "#171b1f",
    borderColor: "#171b1f",
  },
  suitButtonText: {
    color: "#4e5964",
    fontSize: 12,
    fontWeight: "900",
  },
  selectedSuitText: {
    color: "#ffffff",
  },
  hand: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 3,
    paddingRight: 8,
  },
  handScroller: {
    marginHorizontal: -2,
    maxHeight: 146,
    width: "100%",
  },
  cardTouchable: {
    flexShrink: 0,
    height: 138,
    width: 92,
  },
  largeCardTouchable: {
    height: 174,
    width: 116,
  },
  card: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d9d3c8",
    borderRadius: 8,
    borderWidth: 1,
    height: 138,
    justifyContent: "center",
    overflow: "hidden",
    width: 92,
  },
  largeCard: {
    height: 174,
    width: 116,
  },
  cardDisabled: {
    opacity: 0.35,
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
});
