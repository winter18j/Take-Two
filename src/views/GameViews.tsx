import { User } from "@supabase/supabase-js";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Animated,
  Easing,
  ImageBackground,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  Image as RNImage,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MenuButton } from "../components/MenuButton";
import { gameTheme } from "../theme/gameTheme";
import { CardImageEngine } from "./rendering/CardImageEngine";

export const RESPONSE_WINDOW_SECONDS = 10;
export const TURN_WINDOW_SECONDS = 15;
const MATCH_ENTRY_COST = 25;
const MATCH_REWARD_TABLE: Record<number, number[]> = {
  2: [40, 0],
  3: [45, 20, 10],
  4: [55, 30, 15, 0],
};
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
const TABLE_IMAGE = require("../../resources/cards-opti/table-1.png");
const ROOM_MENU_IMAGE = require("../../resources/backgrounds/menu-rooms.png");
const CARD_BACK_IMAGE = require("../../resources/cards-opti/cardback.webp");
const cardImages: Record<string, number> = {
  "bastos-1": require("../../resources/cards-opti/bastos-1.webp"),
  "bastos-2": require("../../resources/cards-opti/bastos-2.webp"),
  "bastos-3": require("../../resources/cards-opti/bastos-3.webp"),
  "bastos-4": require("../../resources/cards-opti/bastos-4.webp"),
  "bastos-5": require("../../resources/cards-opti/bastos-5.webp"),
  "bastos-6": require("../../resources/cards-opti/bastos-6.webp"),
  "bastos-7": require("../../resources/cards-opti/bastos-7.webp"),
  "bastos-10": require("../../resources/cards-opti/bastos-10.webp"),
  "bastos-11": require("../../resources/cards-opti/bastos-11.webp"),
  "bastos-12": require("../../resources/cards-opti/bastos-12.webp"),
  "copas-1": require("../../resources/cards-opti/copas-1.webp"),
  "copas-2": require("../../resources/cards-opti/copas-2.webp"),
  "copas-3": require("../../resources/cards-opti/copas-3.webp"),
  "copas-4": require("../../resources/cards-opti/copas-4.webp"),
  "copas-5": require("../../resources/cards-opti/copas-5.webp"),
  "copas-6": require("../../resources/cards-opti/copas-6.webp"),
  "copas-7": require("../../resources/cards-opti/copas-7.webp"),
  "copas-10": require("../../resources/cards-opti/copas-10.webp"),
  "copas-11": require("../../resources/cards-opti/copas-11.webp"),
  "copas-12": require("../../resources/cards-opti/copas-12.webp"),
  "espadas-1": require("../../resources/cards-opti/espadas-1.webp"),
  "espadas-2": require("../../resources/cards-opti/espadas-2.webp"),
  "espadas-3": require("../../resources/cards-opti/espadas-3.webp"),
  "espadas-4": require("../../resources/cards-opti/espadas-4.webp"),
  "espadas-5": require("../../resources/cards-opti/espadas-5.webp"),
  "espadas-6": require("../../resources/cards-opti/espadas-6.webp"),
  "espadas-7": require("../../resources/cards-opti/espadas-7.webp"),
  "espadas-10": require("../../resources/cards-opti/espadas-10.webp"),
  "espadas-11": require("../../resources/cards-opti/espadas-11.webp"),
  "espadas-12": require("../../resources/cards-opti/espadas-12.webp"),
  "oros-1": require("../../resources/cards-opti/oros-1.webp"),
  "oros-2": require("../../resources/cards-opti/oros-2.webp"),
  "oros-3": require("../../resources/cards-opti/oros-3.webp"),
  "oros-4": require("../../resources/cards-opti/oros-4.webp"),
  "oros-5": require("../../resources/cards-opti/oros-5.webp"),
  "oros-6": require("../../resources/cards-opti/oros-6.webp"),
  "oros-7": require("../../resources/cards-opti/oros-7.webp"),
  "oros-10": require("../../resources/cards-opti/oros-10.webp"),
  "oros-11": require("../../resources/cards-opti/oros-11.webp"),
  "oros-12": require("../../resources/cards-opti/oros-12.webp"),
};
const suitIconCards: Record<Suit, string> = {
  gold: "oros-1",
  cups: "copas-1",
  swords: "espadas-1",
  sticks: "bastos-1",
};

const CARD_FACE_RESIZE_METHOD = "resize" as const;

type SoundName = "button" | "draw" | "gameEnd" | "lose" | "matchIntro" | "pick" | "play" | "turn" | "win";

export function playSoundPlaceholder(name: SoundName) {
  void import("../audio/soundEffects")
    .then(({ playSound }) => playSound(name))
    .catch(() => undefined);
}


export function RoomScreen({
  appMode,
  connected,
  error,
  game,
  joinCode,
  name,
  onBack,
  onCopyRoomCode,
  onCreateRoom,
  onJoinRoom,
  onShareRoomCode,
  onStartGame,
  roomAction,
  session,
  setJoinCode,
  setName,
}: RoomScreenProps) {
  return (
    <ImageBackground source={ROOM_MENU_IMAGE} resizeMode="cover" style={styles.roomMenuBackground}>
      <View style={styles.roomMenuShade} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        style={styles.roomMenuKeyboard}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.roomMenuContent}
        >
          <View style={styles.roomTopBar}>
            <View>
              <Text style={styles.roomTitle}>Rooms</Text>
              <Text style={styles.roomSubtitle}>
                {appMode === "connect" ? "Create or join a private table." : "Waiting for players"}
              </Text>
            </View>
            <View style={[styles.statusDot, connected ? styles.onlineDot : null]} />
          </View>
          <Pressable onPress={onBack} style={styles.roomBackButton}>
            <Text style={styles.roomBackButtonText}>‹</Text>
          </Pressable>

          {appMode === "connect" ? (
            <View style={styles.roomPanel}>
              <Text style={styles.roomPanelTitle}>
                {roomAction === "create" ? "Create Room" : "Join Room"}
              </Text>
              <TextInput
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="rgba(255, 244, 214, 0.52)"
                style={styles.roomInput}
                value={name}
              />
              {roomAction === "join" ? (
                <TextInput
                  autoCapitalize="characters"
                  onChangeText={setJoinCode}
                  placeholder="Room code"
                  placeholderTextColor="rgba(255, 244, 214, 0.52)"
                  style={styles.roomInput}
                  value={joinCode}
                />
              ) : null}
              <View style={styles.roomActions}>
                <MenuButton label="Back" onPress={onBack} size="small" variant="secondary" />
                {roomAction === "create" ? (
                  <MenuButton label="Create" onPress={onCreateRoom} disabled={!name.trim()} size="small" />
                ) : (
                  <MenuButton label="Join" onPress={onJoinRoom} disabled={!name.trim() || !joinCode.trim()} size="small" />
                )}
              </View>
              {error ? <Text style={styles.roomError}>{error}</Text> : null}
            </View>
          ) : null}

          {game && appMode === "lobby" ? (
            <View style={styles.roomPanel}>
              <Pressable style={styles.premiumRoomCodeBlock} onPress={() => onCopyRoomCode(game.roomId)}>
                <Text style={styles.premiumMetaLabel}>Room code</Text>
                <Text style={styles.premiumRoomCode}>{game.roomId}</Text>
                <Text style={styles.roomTapHint}>Tap to copy</Text>
              </Pressable>
              <Text style={styles.roomMessage}>{game.message}</Text>
              <MenuButton label="Share Code" onPress={() => onShareRoomCode(game.roomId)} size="small" variant="secondary" />
              <View style={styles.playerList}>
                {game.players.map((player) => (
                  <PlayerRow
                    key={player.id}
                    active={player.id === game.currentPlayerId}
                    isYou={player.id === session?.playerId}
                    player={player}
                  />
                ))}
              </View>
              {game.youAreHost ? (
                <MenuButton
                  label="Start Game"
                  onPress={onStartGame}
                  disabled={game.players.length < 2}
                />
              ) : (
                <Text style={styles.roomHelper}>The host will start once there are at least 2 players.</Text>
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

export function AuthGateScreen({
  authBusy,
  authEmail,
  authPassword,
  disabledText,
  onContinueGuest,
  onSignIn,
  onSignUp,
  setAuthEmail,
  setAuthPassword,
  name,
  setName,
}: {
  authBusy: boolean;
  authEmail: string;
  authPassword: string;
  disabledText: string;
  onContinueGuest: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  setAuthEmail: (email: string) => void;
  setAuthPassword: (password: string) => void;
  name: string;
  setName: (name: string) => void;
}) {
  return (
    <ImageBackground source={TABLE_IMAGE} resizeMode="cover" style={styles.menuBackground}>
      <View style={styles.menuShade} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        style={styles.menuKeyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.mainMenuContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.mainMenuTitle}>Take Two</Text>
          <View style={styles.authPanel}>
            <TextInput
              onChangeText={setName}
              placeholder="Player name"
              placeholderTextColor="#8c9197"
              style={styles.input}
              value={name}
            />
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
            <Button label="Continue as Guest" onPress={onContinueGuest} tone="secondary" />
          </View>
          {disabledText ? <Text style={styles.menuNotice}>{disabledText}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

export function GameTable({
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
  onAdReward,
  onBackToRoom,
  onMainMenu,
  onQueueAgain,
  onShowInterstitialAd,
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
  const [dealRun, setDealRun] = useState(0);
  const [introRun, setIntroRun] = useState(0);
  const lastDealMiddleRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedCardId(null);
  }, [game.currentPlayerId, game.hand.length]);

  useEffect(() => {
    if (game.status === "playing" && game.message === "Game started." && game.middleCard?.id !== lastDealMiddleRef.current) {
      lastDealMiddleRef.current = game.middleCard?.id ?? null;
      setDealRun((run) => run + 1);
      setIntroRun((run) => run + 1);
      playSoundPlaceholder("matchIntro");
    }
  }, [game.message, game.middleCard?.id, game.status]);

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
          <StaticCardFace card={game.middleCard} large />
        </View>
        <DrawDeckButton canDraw={canDraw} count={game.deckCount} onDraw={onDraw} serverUrl={serverUrl} />
        <PendingActionOverlay
          game={game}
          onResolvePending={onResolvePending}
          playerId={playerId}
          pendingForYou={pendingForYou}
        />

        <ActivityLog items={activityLog} />

        <View style={styles.bottomArea}>
          <View style={styles.handHeader}>
            <View>
              <Text style={styles.bottomName}>{currentPlayer?.name ?? "You"}</Text>
              <Text style={styles.bottomHint}>
                {isYourTurn ? "Play one card or draw one." : "Waiting for your turn."}
              </Text>
            </View>
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
        <DealAnimationLayer positions={positions} run={dealRun} seats={seats} serverUrl={serverUrl} />
        <MatchIntroOverlay players={game.players} run={introRun} />
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
          onAdReward={onAdReward}
          onBackToRoom={onBackToRoom}
          onMainMenu={onMainMenu}
          onQueueAgain={onQueueAgain}
          onShowInterstitialAd={onShowInterstitialAd}
          onRetry={onRetry}
          playerId={playerId}
        />
      </ImageBackground>
    </View>
  );
}

export function MainMenuScreen({
  authBusy,
  authEmail,
  authPassword,
  disabledText,
  onCreateRoom,
  onJoinRoom,
  onCloseProfile,
  onOpenProfile,
  onCancelMatchmaking,
  onPlayRandom,
  onToggleMusicMute,
  onToggleFriends,
  onOpenSettings,
  onSignIn,
  onSignOut,
  onSignUp,
  setAuthEmail,
  setAuthPassword,
  name,
  setName,
  user,
  musicMuted,
  profileOpen,
  matchmaking,
  friendsOpen,
}: {
  authBusy: boolean;
  authEmail: string;
  authPassword: string;
  disabledText: string;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onCloseProfile: () => void;
  onOpenProfile: () => void;
  onCancelMatchmaking: () => void;
  onPlayRandom: () => void;
  onToggleMusicMute: () => void;
  onToggleFriends: () => void;
  onOpenSettings: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSignUp: () => void;
  setAuthEmail: (email: string) => void;
  setAuthPassword: (password: string) => void;
  name: string;
  setName: (name: string) => void;
  user: User | null;
  musicMuted: boolean;
  profileOpen: boolean;
  matchmaking: { queued: boolean; etaSeconds?: number; seconds?: number };
  friendsOpen: boolean;
}) {
  return (
    <ImageBackground source={TABLE_IMAGE} resizeMode="cover" style={styles.menuBackground}>
      <View style={styles.menuShade} />
      <Pressable onPress={onOpenProfile} style={styles.profileButton}>
        <View style={styles.profileIconHead} />
        <View style={styles.profileIconBody} />
      </Pressable>
      <Pressable onPress={onOpenSettings} style={styles.settingsButton}>
        <Text style={styles.settingsButtonText}>Settings</Text>
      </Pressable>
      <Pressable onPress={onToggleMusicMute} style={styles.musicButton}>
        <Text style={styles.settingsButtonText}>{musicMuted ? "Music Off" : "Music On"}</Text>
      </Pressable>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        style={styles.menuKeyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.mainMenuContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <Text style={styles.mainMenuTitle}>Take Two</Text>
        <View style={styles.accountStrip}>
          <Text style={styles.accountStripText}>
            {user?.email ? user.email : "Guest account"}
          </Text>
          <Text style={styles.accountStripSubtext}>
            {user ? "Signed in with Supabase." : "Sign in to keep tokens, stats, and matchmaking later."}
          </Text>
        </View>
        <View style={styles.nameStrip}>
          <TextInput
            onChangeText={setName}
            placeholder="Player name"
            placeholderTextColor="#8c9197"
            style={styles.input}
            value={name}
          />
        </View>
        <View style={styles.mainMenuActions}>
          <Button
            disabled={!user}
            label={matchmaking.queued ? `Finding Match ${matchmaking.seconds ?? 0}s` : "Play Random"}
            onPress={matchmaking.queued ? onCancelMatchmaking : onPlayRandom}
          />
          {matchmaking.queued ? (
            <Text style={styles.menuNotice}>
              Elapsed {matchmaking.seconds ?? 0}s · ETA {matchmaking.etaSeconds ?? 10}s
            </Text>
          ) : null}
          <Button disabled={matchmaking.queued} label="Play With Friends" onPress={onToggleFriends} tone="secondary" />
          {friendsOpen ? (
            <View style={styles.friendActions}>
              <Button label="Create Room" onPress={onCreateRoom} />
              <Button label="Join Room" onPress={onJoinRoom} tone="secondary" />
            </View>
          ) : null}
          <Button disabled label="Customize" onPress={() => undefined} tone="secondary" />
        </View>
        {disabledText ? <Text style={styles.menuNotice}>{disabledText}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={styles.bottomNav}>
        <View style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navIcon}>H</Text>
          <Text style={styles.navLabel}>Home</Text>
        </View>
        <View style={[styles.navItem, styles.navItemDisabled]}>
          <Text style={styles.navIcon}>L</Text>
          <Text style={styles.navLabel}>Leaderboard</Text>
        </View>
        <View style={[styles.navItem, styles.navItemDisabled]}>
          <Text style={styles.navIcon}>F</Text>
          <Text style={styles.navLabel}>Friends</Text>
        </View>
        <View style={[styles.navItem, styles.navItemDisabled]}>
          <Text style={styles.navIcon}>R</Text>
          <Text style={styles.navLabel}>History</Text>
        </View>
      </View>
      <Modal transparent animationType="fade" visible={profileOpen} onRequestClose={onCloseProfile}>
        <View style={styles.modalScrim}>
          <View style={styles.confirmPanel}>
            <Text style={styles.confirmTitle}>Profile</Text>
            <Text style={styles.confirmText}>
              {user?.email ? user.email : "Playing as guest"}
            </Text>
            {!user ? (
              <>
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
                <View style={styles.confirmActions}>
                  <Button label="Close" onPress={onCloseProfile} tone="secondary" />
                  <Button
                    disabled={authBusy || !authEmail.trim() || authPassword.length < 6}
                    label="Sign In"
                    onPress={onSignIn}
                  />
                </View>
                <Button
                  disabled={authBusy || !authEmail.trim() || authPassword.length < 6}
                  label="Create Account"
                  onPress={onSignUp}
                  tone="secondary"
                />
              </>
            ) : (
              <View style={styles.confirmActions}>
                <Button label="Close" onPress={onCloseProfile} tone="secondary" />
                <Button label="Disconnect" onPress={onSignOut} tone="danger" />
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  onAdReward,
  onBackToRoom,
  onMainMenu,
  onQueueAgain,
  onShowInterstitialAd,
  onRetry,
  playerId,
}: {
  adDue: boolean;
  game: ClientGameState;
  onAdClosed: () => void;
  onAdReward: (currency: "coins" | "gems") => void;
  onBackToRoom: () => void;
  onMainMenu: () => void;
  onQueueAgain: () => void;
  onShowInterstitialAd: () => void;
  onRetry: () => void;
  playerId: string;
}) {
  if (game.status !== "finished") {
    return null;
  }

  const isOneVsOne = game.players.length === 2;
  const connectedPlayers = game.players.filter((player) => player.isConnected);
  const retryEnabled = isOneVsOne && connectedPlayers.length === 2;
  const loser = game.players.find((player) => player.id === game.loserId);
  const requester = game.players.find((player) => game.rematchRequests.includes(player.id) && player.id !== playerId);
  const youRequested = game.rematchRequests.includes(playerId);
  const yourPlacement = game.roundResults.indexOf(playerId);
  const expectedReward =
    game.isMatchmaking && yourPlacement >= 0
      ? MATCH_REWARD_TABLE[game.players.length]?.[yourPlacement] ?? 0
      : 0;
  const orderedResults = game.roundResults
    .map((id) => game.players.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player));

  return (
    <View style={styles.endOverlay} pointerEvents="box-none">
      <View style={styles.endPanel}>
        {adDue ? (
          <View style={styles.adPlaceholder}>
            <Text style={styles.adPlaceholderText}>Ad break</Text>
            <Text style={styles.endResultText}>A full-screen ad may appear after the match.</Text>
            <View style={styles.confirmActions}>
              <Button label="Show Ad" onPress={onShowInterstitialAd} />
              <Button label="Skip" onPress={onAdClosed} tone="secondary" />
            </View>
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
        {game.isMatchmaking ? (
          <View style={styles.scoreBlock}>
            <Text style={styles.endResultText}>Entry: -{MATCH_ENTRY_COST} coins</Text>
            <Text style={styles.endResultText}>
              {expectedReward > 0
                ? `Winnings confirmed: +${expectedReward} coins`
                : "No coin prize for this placement."}
            </Text>
          </View>
        ) : null}
        {isOneVsOne ? (
          <View style={styles.scoreBlock}>
            {game.players.map((player) => (
              <Text key={player.id} style={styles.scoreText}>
                {player.name}: {game.scores[player.id] ?? 0}
              </Text>
            ))}
            {requester ? (
              <Text style={styles.endResultText}>{requester.name} wants to play again.</Text>
            ) : null}
            {youRequested ? (
              <Text style={styles.endResultText}>Waiting for the other player...</Text>
            ) : null}
            <RetryButton disabled={!retryEnabled || youRequested} onRetry={onRetry} />
          </View>
        ) : null}
        <View style={styles.confirmActions}>
          {game.isMatchmaking ? (
            <Button label="Queue Again" onPress={onQueueAgain} tone="secondary" />
          ) : (
            <Button label="Back to Room" onPress={onBackToRoom} tone="secondary" />
          )}
          <Button label="Main Menu" onPress={onMainMenu} />
        </View>
      </View>
    </View>
  );
}

function RetryButton({ disabled, onRetry }: { disabled: boolean; onRetry: () => void }) {
  return <Button disabled={disabled} label="Retry" onPress={onRetry} />;
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

function PendingActionOverlay({
  game,
  onResolvePending,
  pendingForYou,
  playerId,
}: {
  game: ClientGameState;
  onResolvePending: () => void;
  pendingForYou: boolean;
  playerId: string;
}) {
  const pending = game.pendingAction;
  if (!pendingForYou || !pending || pending.targetPlayerId !== playerId) {
    return null;
  }

  if (pending.type === "draw") {
    return (
      <Pressable onPress={onResolvePending} style={styles.pendingDeckAction}>
        <Text style={styles.pendingActionText}>Take {pending.amount}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onResolvePending} style={styles.pendingStackAction}>
      <Text style={styles.pendingActionText}>Skip</Text>
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
              <RNImage
                fadeDuration={0}
                resizeMethod={CARD_FACE_RESIZE_METHOD}
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
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
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
        <StaticCardFace card={activeAnimation.card} />
      )}
    </Animated.View>
  );
}

function DealAnimationLayer({
  positions,
  run,
  seats,
  serverUrl,
}: {
  positions: TablePositions;
  run: number;
  seats: TableSeats;
  serverUrl: string;
}) {
  const specs = useMemo(() => {
    if (run === 0) {
      return [];
    }

    const targets = [seats.bottom, seats.left, seats.top, seats.right]
      .filter((player): player is Player => Boolean(player))
      .map((player) => getSeatPosition(player.id, seats, positions));
    const pieces: Array<{ delay: number; key: string; to: Point }> = [];

    for (let round = 0; round < 4; round += 1) {
      targets.forEach((to, index) => {
        pieces.push({
          delay: (round * targets.length + index) * 42,
          key: `${run}-deal-${round}-${index}`,
          to,
        });
      });
    }
    pieces.push({ delay: pieces.length * 42, key: `${run}-middle`, to: positions.stack });
    return pieces;
  }, [positions, run, seats]);

  if (specs.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.dealLayer}>
      {specs.map((piece) => (
        <DealCardFlight
          from={positions.deck}
          key={piece.key}
          piece={piece}
          serverUrl={serverUrl}
        />
      ))}
    </View>
  );
}

function DealCardFlight({
  from,
  piece,
  serverUrl,
}: {
  from: Point;
  piece: { delay: number; to: Point };
  serverUrl: string;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      delay: piece.delay,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [piece.delay, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [from.x, piece.to.x],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [from.y, piece.to.y],
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [DECK_WIDTH / CARD_WIDTH, 0.72],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
      style={[
        styles.flyingCard,
        {
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    >
      <CardBack serverUrl={serverUrl} />
    </Animated.View>
  );
}

function MatchIntroOverlay({ players, run }: { players: Player[]; run: number }) {
  const [visible, setVisible] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (run <= 0) {
      return;
    }

    setVisible(true);
    progress.setValue(0);
    Animated.sequence([
      Animated.timing(progress, {
        duration: 360,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.delay(980),
      Animated.timing(progress, {
        duration: 320,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  }, [progress, run]);

  if (!visible) {
    return null;
  }

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.matchIntroLayer, { opacity: progress }]}>
      <Animated.View style={[styles.matchIntroPanel, { transform: [{ scale }, { translateY }] }]}>
        {players.map((player, index) => (
          <View key={player.id} style={styles.matchIntroPlayer}>
            <Text style={styles.matchIntroName} numberOfLines={1}>{player.name}</Text>
            {index < players.length - 1 ? <Text style={styles.matchIntroVs}>VS</Text> : null}
          </View>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

function Panel({ children }: { children: ReactNode }) {
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
  const playerMeta = player.accountId
    ? `${player.accountWins ?? 0} wins${player.isHost ? " | Host" : ""}`
    : `Guest${player.isHost ? " | Host" : ""}`;

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
          {playerMeta}
        </Text>
      </View>
    </View>
  );
}

function getCardBackSize({
  deck,
  large,
  mini,
  opponent,
  small,
}: {
  deck?: boolean;
  large?: boolean;
  mini?: boolean;
  opponent?: boolean;
  small?: boolean;
}) {
  if (deck) {
    return { height: DECK_HEIGHT, width: DECK_WIDTH };
  }
  if (small) {
    return { height: 36, width: 25 };
  }
  if (mini) {
    return { height: 44, width: 30 };
  }
  if (opponent) {
    return { height: OPPONENT_CARD_HEIGHT, width: OPPONENT_CARD_WIDTH };
  }
  if (large) {
    return { height: STACK_HEIGHT, width: STACK_WIDTH };
  }
  return { height: CARD_HEIGHT, width: CARD_WIDTH };
}

const CardBack = memo(function CardBack({
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
  const size = getCardBackSize({ deck, large, mini, opponent, small });

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
      <CardImageEngine fit="cover" height={size.height} source={CARD_BACK_IMAGE} width={size.width} />
      {typeof count === "number" ? (
        <View style={styles.cardBackBadge}>
          <Text style={styles.cardBackBadgeText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
});

const StaticCardFace = memo(function StaticCardFace({
  card,
  large,
}: {
  card: Card | null;
  large?: boolean;
}) {
  const source = card ? cardImages[card.imageKey] ?? CARD_BACK_IMAGE : null;
  const width = large ? STACK_WIDTH : CARD_WIDTH;
  const height = large ? STACK_HEIGHT : CARD_HEIGHT;

  if (!source) {
    return (
      <View style={[styles.card, large ? styles.largeCard : null]}>
        <Text style={styles.cardRank}>?</Text>
      </View>
    );
  }

  return (
    <View
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
      style={[styles.card, large ? styles.largeCard : null]}
    >
      <CardImageEngine height={height} source={source} width={width} />
    </View>
  );
});

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
        <CardImageEngine
          height={large ? STACK_HEIGHT : CARD_HEIGHT}
          source={cardImages[card.imageKey] ?? CARD_BACK_IMAGE}
          width={large ? STACK_WIDTH : CARD_WIDTH}
        />
        {disabled ? <View pointerEvents="none" style={styles.disabledCardOverlay} /> : null}
      </Animated.View>
    </Pressable>
  );
}

export function inferTableAnimation(
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
  const visiblePlayers = players.filter((player) => player.isConnected);
  const self = players.find((player) => player.id === selfId) ?? visiblePlayers[0] ?? null;
  const others = visiblePlayers.filter((player) => player.id !== self?.id);

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

export function sortHand(cards: Card[]) {
  return [...cards].sort((left, right) => {
    const suitDelta = suitSortOrder[left.suit] - suitSortOrder[right.suit];
    if (suitDelta !== 0) {
      return suitDelta;
    }

    return rankSortOrder[left.rank] - rankSortOrder[right.rank];
  });
}

export function trimActivityLog(items: ActivityItem[]) {
  return items.slice(0, 5);
}

export function formatActivity(animation: TableAnimation): ActivityItem {
  const player = animation.nextState.players.find((candidate) => candidate.id === animation.playerId);
  const name = player?.name ?? "Player";

  if (animation.type === "draw") {
    return messageActivity(`${name} drew 1 card`);
  }

  return messageActivity(`${name} played ${rankLabel(animation.card.rank)} of ${suitLabel(animation.card.suit)}`);
}

export function messageActivity(text: string): ActivityItem {
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

export function canPlayClient(card: Card, game: ClientGameState, playerId?: string) {
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

export function suitLabel(suit: Suit) {
  const labels: Record<Suit, string> = {
    sticks: "Sticks",
    cups: "Cups",
    swords: "Swords",
    gold: "Gold",
  };

  return labels[suit];
}

export function rankLabel(rank: Rank) {
  return String(rank);
}

const suits = ["sticks", "cups", "swords", "gold"] as const;
const suitChoiceOrder: Suit[] = ["gold", "cups", "swords", "sticks"];
const confettiColors = ["#fff3c4", "#ff6b5f", "#28b36d", "#5cc8ff", "#f7a8ff", "#ffffff"];

export type AppMode = "connect" | "lobby" | "game";
export type AppScreen = "menu" | "room";
export type RoomAction = "create" | "join";
export type Suit = (typeof suits)[number];
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

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

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  imageKey: string;
  imagePath: string;
};

export type Player = {
  id: string;
  accountId?: string;
  accountWins?: number;
  name: string;
  handCount: number;
  isHost: boolean;
  isConnected: boolean;
  placement: number | null;
};

export type PendingAction =
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

export type ClientGameState = {
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
  rematchRequests: string[];
  scores: Record<string, number>;
  message: string;
  isMatchmaking: boolean;
  youAreHost: boolean;
};

export type Session = {
  roomId: string;
  playerId: string;
};

export type ServerAnimationEvent = {
  playerId: string;
  card?: Card;
};

export type TableAnimation =
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

export type Point = {
  x: number;
  y: number;
};

export type TablePositions = {
  bottom: Point;
  deck: Point;
  left: Point;
  origin: Point;
  right: Point;
  stack: Point;
  top: Point;
  width: number;
};

export type TableSeats = {
  bottom: Player | null;
  left: Player | null;
  right: Player | null;
  top: Player | null;
};

export type OpponentSide = "left" | "right" | "top";

type RoomScreenProps = {
  appMode: AppMode;
  connected: boolean;
  error: string;
  game: ClientGameState | null;
  joinCode: string;
  name: string;
  onBack: () => void;
  onCopyRoomCode: (roomId: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onShareRoomCode: (roomId: string) => void;
  onStartGame: () => void;
  roomAction: RoomAction;
  session: Session | null;
  setJoinCode: (code: string) => void;
  setName: (name: string) => void;
};

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
  onAdReward: (currency: "coins" | "gems") => void;
  onBackToRoom: () => void;
  onMainMenu: () => void;
  onQueueAgain: () => void;
  onShowInterstitialAd: () => void;
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

export type ActivityItem = {
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
  roomMenuBackground: {
    flex: 1,
  },
  roomMenuShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  roomMenuKeyboard: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 34 : 26,
  },
  roomMenuContent: {
    flexGrow: 1,
    gap: 16,
    justifyContent: "center",
    paddingBottom: 28,
    paddingTop: 18,
  },
  roomTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roomBackButton: {
    alignItems: "center",
    backgroundColor: "rgba(8, 11, 22, 0.72)",
    borderColor: "rgba(243, 213, 138, 0.5)",
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    position: "absolute",
    left: 0,
    top: Platform.OS === "android" ? 34 : 26,
    width: 44,
    zIndex: 4,
  },
  roomBackButtonText: {
    color: gameTheme.colors.cream,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38,
  },
  roomTitle: {
    color: gameTheme.colors.cream,
    fontSize: 36,
    fontWeight: "900",
    textShadowColor: "rgba(216, 168, 79, 0.55)",
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 10,
  },
  roomSubtitle: {
    color: "rgba(255, 244, 214, 0.78)",
    fontSize: 13,
    fontWeight: "800",
  },
  roomPanel: {
    backgroundColor: "rgba(8, 11, 22, 0.72)",
    borderColor: "rgba(243, 213, 138, 0.36)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  roomPanelTitle: {
    color: gameTheme.colors.cream,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  roomInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(243, 213, 138, 0.34)",
    borderRadius: 16,
    borderWidth: 1,
    color: gameTheme.colors.cream,
    fontSize: 16,
    fontWeight: "800",
    minHeight: 52,
    paddingHorizontal: 14,
  },
  roomActions: {
    flexDirection: "row",
    gap: 12,
  },
  roomError: {
    color: "#ffb4aa",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  premiumRoomCodeBlock: {
    alignItems: "center",
    backgroundColor: "rgba(9, 20, 42, 0.72)",
    borderColor: "rgba(243, 213, 138, 0.6)",
    borderRadius: 24,
    borderWidth: 2,
    padding: 16,
  },
  premiumMetaLabel: {
    color: "rgba(255, 244, 214, 0.72)",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  premiumRoomCode: {
    color: gameTheme.colors.goldLight,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 0,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 6,
  },
  roomTapHint: {
    color: "rgba(255, 244, 214, 0.62)",
    fontSize: 11,
    fontWeight: "800",
  },
  roomMessage: {
    color: gameTheme.colors.cream,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  roomHelper: {
    color: "rgba(255, 244, 214, 0.68)",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
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
    color: "rgba(255, 244, 214, 0.68)",
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
    backgroundColor: "rgba(8, 11, 22, 0.68)",
    borderColor: "rgba(243, 213, 138, 0.28)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  activePlayerRow: {
    borderColor: gameTheme.colors.goldLight,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "rgba(216, 168, 79, 0.2)",
    borderColor: "rgba(243, 213, 138, 0.58)",
    borderWidth: 1,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  avatarText: {
    color: gameTheme.colors.cream,
    fontSize: 15,
    fontWeight: "900",
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: gameTheme.colors.cream,
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
  profileButton: {
    alignItems: "center",
    backgroundColor: "rgba(16, 19, 23, 0.72)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    left: 16,
    position: "absolute",
    top: 18,
    width: 44,
    zIndex: 5,
  },
  profileIconHead: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    height: 12,
    marginBottom: 3,
    width: 12,
  },
  profileIconBody: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    height: 10,
    width: 22,
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
  musicButton: {
    alignItems: "center",
    backgroundColor: "rgba(16, 19, 23, 0.72)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    left: 68,
    minHeight: 44,
    paddingHorizontal: 14,
    position: "absolute",
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
    gap: 22,
    justifyContent: "center",
    minHeight: "100%",
    padding: 22,
    paddingBottom: 96,
    paddingTop: 78,
  },
  menuKeyboardView: {
    flex: 1,
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
  nameStrip: {
    maxWidth: 340,
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
  friendActions: {
    gap: 10,
    paddingHorizontal: 12,
    width: "100%",
  },
  menuNotice: {
    color: "#ffe1dd",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  bottomNav: {
    alignItems: "center",
    backgroundColor: "rgba(10, 14, 18, 0.82)",
    borderColor: "rgba(246, 216, 120, 0.24)",
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    left: 0,
    paddingBottom: 10,
    paddingTop: 9,
    position: "absolute",
    right: 0,
    zIndex: 6,
  },
  navItem: {
    alignItems: "center",
    gap: 3,
    minWidth: 68,
  },
  navItemActive: {
    opacity: 1,
  },
  navItemDisabled: {
    opacity: 0.36,
  },
  navIcon: {
    color: "#f6d878",
    fontSize: 18,
    fontWeight: "900",
  },
  navLabel: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
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
    borderColor: "rgba(255, 243, 196, 0.75)",
    borderRadius: 8,
    borderWidth: 1,
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
  pendingDeckAction: {
    alignItems: "center",
    backgroundColor: "rgba(180, 35, 24, 0.62)",
    borderColor: "rgba(255,255,255,0.38)",
    borderRadius: 8,
    borderWidth: 1,
    bottom: 188,
    justifyContent: "center",
    minHeight: 42,
    minWidth: 78,
    paddingHorizontal: 10,
    position: "absolute",
    right: 72,
    zIndex: 16,
  },
  pendingStackAction: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(180, 35, 24, 0.58)",
    borderColor: "rgba(255,255,255,0.38)",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    minWidth: 78,
    paddingHorizontal: 10,
    position: "absolute",
    top: "45%",
    zIndex: 16,
  },
  pendingActionText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
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
  dealLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 19,
  },
  matchIntroLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.34)",
    justifyContent: "center",
    zIndex: 23,
  },
  matchIntroPanel: {
    alignItems: "center",
    backgroundColor: "rgba(16, 19, 23, 0.88)",
    borderColor: "rgba(246, 216, 120, 0.72)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    maxWidth: 340,
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: "84%",
  },
  matchIntroPlayer: {
    alignItems: "center",
    width: "100%",
  },
  matchIntroName: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  matchIntroVs: {
    color: "#f6d878",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 6,
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
