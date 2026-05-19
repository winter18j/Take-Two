import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import {
  ImageBackground,
  Image,
  KeyboardAvoidingView,
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
import { LogoTitle } from "../components/LogoTitle";
import { MenuButton } from "../components/MenuButton";
import { MenuCard } from "../components/MenuCard";
import { TopBar } from "../components/TopBar";
import { gameTheme } from "../theme/gameTheme";

// Replace this require with the final generated main-menu background if you add a separate asset.
const menuBackground = require("../../resources/backgrounds/menu-main.png");
const menuIcons = {
  createRoom: require("../../resources/menu/icons/create-room.png"),
  customize: require("../../resources/menu/icons/customize.png"),
  dailyReward: require("../../resources/menu/icons/daily-reward.png"),
  joinRoom: require("../../resources/menu/icons/join-room.png"),
  navFriends: require("../../resources/menu/icons/nav-friends.png"),
  navHistory: require("../../resources/menu/icons/nav-history.png"),
  navHome: require("../../resources/menu/icons/nav-home.png"),
  navLeaderboard: require("../../resources/menu/icons/nav-leaderboard.png"),
  playRandom: require("../../resources/menu/icons/play-random.png"),
  rooms: require("../../resources/menu/icons/rooms.png"),
  shop: require("../../resources/menu/icons/shop.png"),
};
const defaultCardPreview = require("../../resources/cards-opti/oros-1.webp");
const defaultCardBackPreview = require("../../resources/cards-opti/cardback.webp");
const coinAdPacks = [
  { adsRequired: 3, amount: 500, currency: "coins" as const, id: "coins_500_ads", label: "500 coins" },
  { adsRequired: 6, amount: 1200, currency: "coins" as const, id: "coins_1200_ads", label: "1,200 coins" },
  { adsRequired: 12, amount: 3000, currency: "coins" as const, id: "coins_3000_ads", label: "3,000 coins" },
  { adsRequired: 25, amount: 7500, currency: "coins" as const, id: "coins_7500_ads", label: "7,500 coins" },
];
const gemAdPacks = [
  { adsRequired: 3, amount: 120, currency: "gems" as const, id: "gems_120_ads", label: "120 gems" },
  { adsRequired: 7, amount: 300, currency: "gems" as const, id: "gems_300_ads", label: "300 gems" },
  { adsRequired: 16, amount: 800, currency: "gems" as const, id: "gems_800_ads", label: "800 gems" },
  { adsRequired: 35, amount: 2000, currency: "gems" as const, id: "gems_2000_ads", label: "2,000 gems" },
];

type MatchmakingState = {
  etaSeconds?: number;
  queued: boolean;
  seconds?: number;
};
type LeaderboardMetric = "coins" | "matches" | "wins";
type LeaderboardPeriod = "all_time" | "day" | "month" | "year";
type LeaderboardRow = {
  display_name: string;
  rank: number;
  user_id: string;
  value: number;
};

type MainMenuScreenProps = {
  authBusy: boolean;
  authEmail: string;
  authPassword: string;
  disabledText: string;
  dailyRewardNextClaimAt: string | null;
  dailyRewardReady: boolean;
  isDevAccount: boolean;
  leaderboardBusy: boolean;
  leaderboardRows: LeaderboardRow[];
  matchmaking: MatchmakingState;
  musicMuted: boolean;
  name: string;
  onCancelMatchmaking: () => void;
  onAdReward: (currency: "coins" | "gems") => void;
  onWatchAdPack: (pack: { adsRequired: number; amount: number; currency: "coins" | "gems"; id: string }) => void;
  onClaimDailyReward: () => void;
  onCloseProfile: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onLoadLeaderboard: (metric: LeaderboardMetric, period: LeaderboardPeriod) => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onPlayRandom: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSignUp: () => void;
  onToggleMusicMute: () => void;
  profileOpen: boolean;
  setAuthEmail: (email: string) => void;
  setAuthPassword: (password: string) => void;
  setName: (name: string) => void;
  user: User | null;
  wallet: { coins: number; gems: number };
};

export function MainMenuScreen({
  authBusy,
  authEmail,
  authPassword,
  disabledText,
  dailyRewardNextClaimAt,
  dailyRewardReady,
  isDevAccount,
  leaderboardBusy,
  leaderboardRows,
  matchmaking,
  musicMuted,
  name,
  onAdReward,
  onCancelMatchmaking,
  onClaimDailyReward,
  onCloseProfile,
  onCreateRoom,
  onJoinRoom,
  onLoadLeaderboard,
  onOpenProfile,
  onOpenSettings,
  onPlayRandom,
  onSignIn,
  onSignOut,
  onSignUp,
  onToggleMusicMute,
  onWatchAdPack,
  profileOpen,
  setAuthEmail,
  setAuthPassword,
  setName,
  user,
  wallet,
}: MainMenuScreenProps) {
  const [view, setView] = useState<"customize" | "home" | "leaderboard" | "rooms" | "shop">("home");
  const queueText = `Elapsed ${matchmaking.seconds ?? 0}s | ETA ${matchmaking.etaSeconds ?? 10}s`;
  const roomButtonsDisabled = matchmaking.queued;

  return (
    <ImageBackground source={menuBackground} resizeMode="cover" style={styles.background}>
      <View style={styles.shade} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
          style={styles.keyboardView}
        >
          <TopBar
            coins={wallet.coins}
            gems={wallet.gems}
            musicMuted={musicMuted}
            onOpenProfile={onOpenProfile}
            onOpenSettings={onOpenSettings}
            onToggleMusicMute={onToggleMusicMute}
            playerName={name}
          />
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {view !== "home" ? (
              <Pressable onPress={() => setView("home")} style={styles.backPill}>
                <Text style={styles.backPillText}>Back</Text>
              </Pressable>
            ) : null}

            {view === "home" ? (
              <>
                <LogoTitle />
                <HomeActions
                  disabledText={disabledText}
                  matchmaking={matchmaking}
                  onCancelMatchmaking={onCancelMatchmaking}
                  onClaimDailyReward={onClaimDailyReward}
                  onCustomize={() => setView("customize")}
                  onPlayRandom={onPlayRandom}
                  onRooms={() => setView("rooms")}
                  onShop={() => setView("shop")}
                  queueText={queueText}
                  roomButtonsDisabled={roomButtonsDisabled}
                  dailyRewardReady={dailyRewardReady}
                  dailyRewardNextClaimAt={dailyRewardNextClaimAt}
                  user={user}
                />
              </>
            ) : null}

            {view === "rooms" ? (
              <RoomsView
                onCreateRoom={onCreateRoom}
                onJoinRoom={onJoinRoom}
                roomButtonsDisabled={roomButtonsDisabled}
              />
            ) : null}

            {view === "shop" ? (
              <ShopView
                isDevAccount={isDevAccount}
                onAdReward={onAdReward}
                onWatchAdPack={onWatchAdPack}
              />
            ) : null}

            {view === "customize" ? <CustomizeView /> : null}
            {view === "leaderboard" ? (
              <LeaderboardView
                busy={leaderboardBusy}
                onLoadLeaderboard={onLoadLeaderboard}
                rows={leaderboardRows}
              />
            ) : null}

            {disabledText ? <Text style={styles.notice}>{disabledText}</Text> : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <BottomNav currentView={view} onChangeView={setView} />
      <ProfileModal
        authBusy={authBusy}
        authEmail={authEmail}
        authPassword={authPassword}
        onClose={onCloseProfile}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        onSignUp={onSignUp}
        open={profileOpen}
        name={name}
        setName={setName}
        setAuthEmail={setAuthEmail}
        setAuthPassword={setAuthPassword}
        user={user}
      />
    </ImageBackground>
  );
}

function ProfileModal({
  authBusy,
  authEmail,
  authPassword,
  onClose,
  onSignIn,
  onSignOut,
  onSignUp,
  open,
  name,
  setName,
  setAuthEmail,
  setAuthPassword,
  user,
}: {
  authBusy: boolean;
  authEmail: string;
  authPassword: string;
  onClose: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSignUp: () => void;
  open: boolean;
  name: string;
  setName: (name: string) => void;
  setAuthEmail: (email: string) => void;
  setAuthPassword: (password: string) => void;
  user: User | null;
}) {
  const authDisabled = authBusy || !authEmail.trim() || authPassword.length < 6;

  return (
    <Modal transparent animationType="fade" visible={open} onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <View style={styles.profilePanel}>
          <Text style={styles.profileTitle}>Profile</Text>
          <Text style={styles.profileText}>{user?.email ? user.email : "Playing as guest"}</Text>
          {user ? (
            <View style={styles.lockedPseudoBox}>
              <Text style={styles.lockedPseudoLabel}>Pseudo</Text>
              <Text numberOfLines={1} style={styles.lockedPseudoValue}>{name}</Text>
            </View>
          ) : (
            <TextInput
              autoCapitalize="none"
              onChangeText={setName}
              placeholder="Choose pseudo"
              placeholderTextColor="rgba(255, 244, 214, 0.52)"
              style={styles.profileInput}
              value={name}
            />
          )}
          {!user ? (
            <>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setAuthEmail}
                placeholder="Email"
                placeholderTextColor="rgba(255, 244, 214, 0.52)"
                style={styles.profileInput}
                value={authEmail}
              />
              <TextInput
                onChangeText={setAuthPassword}
                placeholder="Password"
                placeholderTextColor="rgba(255, 244, 214, 0.52)"
                secureTextEntry
                style={styles.profileInput}
                value={authPassword}
              />
              <View style={styles.modalActions}>
                <MenuButton label="Close" onPress={onClose} size="small" variant="secondary" />
                <MenuButton disabled={authDisabled} label="Sign In" onPress={onSignIn} size="small" />
              </View>
              <MenuButton disabled={authDisabled} label="Create Account" onPress={onSignUp} size="small" variant="secondary" />
            </>
          ) : (
            <View style={styles.modalActions}>
              <MenuButton label="Close" onPress={onClose} size="small" variant="secondary" />
              <MenuButton label="Disconnect" onPress={onSignOut} size="small" />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function BottomNav({
  currentView,
  onChangeView,
}: {
  currentView: "customize" | "home" | "leaderboard" | "rooms" | "shop";
  onChangeView: (view: "customize" | "home" | "leaderboard" | "rooms" | "shop") => void;
}) {
  return (
    <View style={styles.bottomNav}>
      <NavItem label="Leaderboard" iconSource={menuIcons.navLeaderboard} active={currentView === "leaderboard"} onPress={() => onChangeView("leaderboard")} />
      <NavItem label="Friends" iconSource={menuIcons.navFriends} disabled />
      <NavItem label="Home" iconSource={menuIcons.navHome} active={currentView === "home"} onPress={() => onChangeView("home")} />
      <NavItem label="History" iconSource={menuIcons.navHistory} disabled />
    </View>
  );
}

function HomeActions({
  dailyRewardNextClaimAt,
  dailyRewardReady,
  matchmaking,
  onCancelMatchmaking,
  onClaimDailyReward,
  onCustomize,
  onPlayRandom,
  onRooms,
  onShop,
  queueText,
  roomButtonsDisabled,
  user,
}: {
  dailyRewardNextClaimAt: string | null;
  dailyRewardReady: boolean;
  disabledText: string;
  matchmaking: MatchmakingState;
  onCancelMatchmaking: () => void;
  onClaimDailyReward: () => void;
  onCustomize: () => void;
  onPlayRandom: () => void;
  onRooms: () => void;
  onShop: () => void;
  queueText: string;
  roomButtonsDisabled: boolean;
  user: User | null;
}) {
  return (
    <>
      <View style={styles.actions}>
        <MenuButton
          disabled={!user}
          iconSource={menuIcons.playRandom}
          label={matchmaking.queued ? `Finding Match ${matchmaking.seconds ?? 0}s` : "Play Random"}
          onPress={matchmaking.queued ? onCancelMatchmaking : onPlayRandom}
          subtitle={user ? "25 coins entry | Prize pool" : "Sign in to unlock"}
        />
        {matchmaking.queued ? <Text style={styles.notice}>{queueText}</Text> : null}
        <MenuButton
          disabled={roomButtonsDisabled}
          iconSource={menuIcons.rooms}
          label="Rooms"
          onPress={onRooms}
          subtitle="Play with Friends"
          variant="secondary"
        />
        <View style={styles.smallGrid}>
          <MenuButton iconSource={menuIcons.customize} label="Customize" onPress={onCustomize} size="small" variant="secondary" />
          <MenuButton iconSource={menuIcons.shop} label="Shop" onPress={onShop} size="small" variant="secondary" />
        </View>
      </View>
      <View style={styles.rewardStrip}>
        <View style={styles.rewardIcon}>
          <Image source={menuIcons.dailyReward} resizeMode="contain" style={styles.rewardIconImage} />
        </View>
        <View style={styles.rewardCopy}>
          <Text style={styles.rewardTitle}>Daily Reward</Text>
          <Text style={styles.rewardText}>
            {dailyRewardReady ? "100 coins + 5 gems ready" : `Next: ${dailyRewardNextClaimAt ? new Date(dailyRewardNextClaimAt).toLocaleTimeString() : "soon"}`}
          </Text>
        </View>
        <Pressable disabled={!user || !dailyRewardReady} onPress={onClaimDailyReward} style={[styles.claimButton, (!user || !dailyRewardReady) ? styles.claimButtonDisabled : null]}>
          <Text style={styles.claimText}>Claim</Text>
        </Pressable>
      </View>
    </>
  );
}

function RoomsView({
  onCreateRoom,
  onJoinRoom,
  roomButtonsDisabled,
}: {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  roomButtonsDisabled: boolean;
}) {
  return (
    <View style={styles.subView}>
      <Text style={styles.subViewTitle}>Rooms</Text>
      <MenuButton
        disabled={roomButtonsDisabled}
        iconSource={menuIcons.createRoom}
        label="Create Room"
        onPress={onCreateRoom}
        subtitle="Start a private table"
      />
      <MenuButton
        disabled={roomButtonsDisabled}
        iconSource={menuIcons.joinRoom}
        label="Join Room"
        onPress={onJoinRoom}
        subtitle="Enter a friend code"
        variant="secondary"
      />
    </View>
  );
}

function ShopView({
  isDevAccount,
  onAdReward,
  onWatchAdPack,
}: {
  isDevAccount: boolean;
  onAdReward: (currency: "coins" | "gems") => void;
  onWatchAdPack: (pack: { adsRequired: number; amount: number; currency: "coins" | "gems"; id: string }) => void;
}) {
  return (
    <View style={styles.subView}>
      <Text style={styles.subViewTitle}>Shop</Text>
      {isDevAccount ? <Text style={styles.notice}>Dev account: unlimited coins and gems.</Text> : null}
      <StoreSection title="Coins" products={coinAdPacks} onWatchAdPack={onWatchAdPack} />
      <StoreSection title="Gems" products={gemAdPacks} onWatchAdPack={onWatchAdPack} />
      <View style={styles.adRewardRow}>
        <MenuButton label="Ad: 50 coins" onPress={() => onAdReward("coins")} size="small" variant="secondary" />
        <MenuButton label="Ad: 10 gems" onPress={() => onAdReward("gems")} size="small" variant="secondary" />
      </View>
    </View>
  );
}

function StoreSection({
  onWatchAdPack,
  products,
  title,
}: {
  onWatchAdPack: (pack: { adsRequired: number; amount: number; currency: "coins" | "gems"; id: string }) => void;
  products: Array<{ adsRequired: number; amount: number; currency: "coins" | "gems"; id: string; label: string }>;
  title: string;
}) {
  return (
    <MenuCard>
      <Text style={styles.storeSectionTitle}>{title}</Text>
      {products.map((product) => (
        <Pressable key={product.id} onPress={() => onWatchAdPack(product)} style={styles.productRow}>
          <Text style={styles.productLabel}>{product.label}</Text>
          <Text style={styles.productPrice}>{product.adsRequired} ads</Text>
        </Pressable>
      ))}
    </MenuCard>
  );
}

function CustomizeView() {
  return (
    <View style={styles.subView}>
      <Text style={styles.subViewTitle}>Customize</Text>
      <MenuCard>
        <Text style={styles.storeSectionTitle}>Default deck</Text>
        <View style={styles.cardPreviewRow}>
          <Image source={defaultCardPreview} resizeMode="contain" style={styles.cardPreview} />
          <Image source={defaultCardBackPreview} resizeMode="contain" style={styles.cardPreview} />
        </View>
        <Text style={styles.rewardText}>
          New deck styles can be added later under resources/card-styles. Each shop style costs 500 gems.
        </Text>
      </MenuCard>
    </View>
  );
}

function LeaderboardView({
  busy,
  onLoadLeaderboard,
  rows,
}: {
  busy: boolean;
  onLoadLeaderboard: (metric: LeaderboardMetric, period: LeaderboardPeriod) => void;
  rows: LeaderboardRow[];
}) {
  const [metric, setMetric] = useState<LeaderboardMetric>("wins");
  const [period, setPeriod] = useState<LeaderboardPeriod>("day");

  useEffect(() => {
    onLoadLeaderboard(metric, period);
  }, [metric, period]);

  return (
    <View style={styles.subView}>
      <Text style={styles.subViewTitle}>Leaderboard</Text>
      <View style={styles.segmentRow}>
        <Segment label="Wins" active={metric === "wins"} onPress={() => setMetric("wins")} />
        <Segment label="Coins" active={metric === "coins"} onPress={() => setMetric("coins")} />
        <Segment label="Matches" active={metric === "matches"} onPress={() => setMetric("matches")} />
      </View>
      {metric !== "coins" ? (
        <View style={styles.segmentRow}>
          <Segment label="Day" active={period === "day"} onPress={() => setPeriod("day")} />
          <Segment label="Month" active={period === "month"} onPress={() => setPeriod("month")} />
          <Segment label="Year" active={period === "year"} onPress={() => setPeriod("year")} />
          <Segment label="All" active={period === "all_time"} onPress={() => setPeriod("all_time")} />
        </View>
      ) : null}
      <MenuCard>
        {busy ? <Text style={styles.notice}>Loading...</Text> : null}
        {!busy && rows.length === 0 ? <Text style={styles.notice}>No scores yet.</Text> : null}
        {rows.map((row) => (
          <View key={`${row.rank}-${row.user_id}`} style={styles.leaderboardRow}>
            <Text style={styles.leaderboardRank}>#{row.rank}</Text>
            <Text numberOfLines={1} style={styles.leaderboardName}>{row.display_name}</Text>
            <Text style={styles.leaderboardValue}>{row.value}</Text>
          </View>
        ))}
      </MenuCard>
    </View>
  );
}

function Segment({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segment, active ? styles.segmentActive : null]}>
      <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function NavItem({
  active = false,
  disabled = false,
  iconSource,
  label,
  onPress,
}: {
  active?: boolean;
  disabled?: boolean;
  iconSource: number;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.navItem, active ? styles.navItemActive : null, disabled ? styles.navItemDisabled : null]}>
      <View style={[styles.navIconPlate, active ? styles.navIconPlateActive : null]}>
        <Image source={iconSource} resizeMode="contain" style={styles.navIcon} />
      </View>
      <Text style={styles.navLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    maxWidth: 390,
    width: "100%",
  },
  adRewardRow: {
    flexDirection: "row",
    gap: 10,
  },
  backPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(8, 11, 22, 0.72)",
    borderColor: "rgba(243, 213, 138, 0.5)",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backPillText: {
    color: gameTheme.colors.cream,
    fontSize: 13,
    fontWeight: "900",
  },
  background: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    flexGrow: 1,
    gap: 16,
    justifyContent: "center",
    paddingBottom: 96,
    paddingHorizontal: 14,
    paddingTop: 20,
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "android" ? 4 : 2,
  },
  leaderboardName: {
    color: gameTheme.colors.cream,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
  },
  leaderboardRank: {
    color: gameTheme.colors.goldLight,
    fontSize: 14,
    fontWeight: "900",
    width: 42,
  },
  leaderboardRow: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(243, 213, 138, 0.16)",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  leaderboardValue: {
    color: gameTheme.colors.goldLight,
    fontSize: 15,
    fontWeight: "900",
    minWidth: 54,
    textAlign: "right",
  },
  lockedPseudoBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(243, 213, 138, 0.32)",
    borderRadius: gameTheme.radius.md,
    borderWidth: 1,
    gap: 3,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lockedPseudoLabel: {
    color: "rgba(255, 244, 214, 0.58)",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  lockedPseudoValue: {
    color: gameTheme.colors.cream,
    fontSize: 17,
    fontWeight: "900",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalScrim: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.54)",
    flex: 1,
    justifyContent: "center",
    padding: 22,
  },
  nameInput: {
    color: gameTheme.colors.cream,
    fontSize: 16,
    fontWeight: "900",
    minHeight: 48,
    paddingHorizontal: 2,
    textAlign: "center",
  },
  notice: {
    color: gameTheme.colors.cream,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  profileInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(243, 213, 138, 0.32)",
    borderRadius: gameTheme.radius.md,
    borderWidth: 1,
    color: gameTheme.colors.cream,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  profilePanel: {
    backgroundColor: gameTheme.colors.panelStrong,
    borderColor: "rgba(243, 213, 138, 0.42)",
    borderRadius: gameTheme.radius.lg,
    borderWidth: 1,
    gap: 12,
    maxWidth: 380,
    padding: 16,
    width: "100%",
  },
  profileText: {
    color: "rgba(255, 244, 214, 0.78)",
    fontSize: 14,
    fontWeight: "800",
  },
  profileTitle: {
    color: gameTheme.colors.cream,
    fontSize: 22,
    fontWeight: "900",
  },
  safeArea: {
    flex: 1,
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.26)",
  },
  segment: {
    alignItems: "center",
    backgroundColor: "rgba(8, 11, 22, 0.64)",
    borderColor: "rgba(243, 213, 138, 0.28)",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  segmentActive: {
    backgroundColor: "rgba(216, 168, 79, 0.18)",
    borderColor: gameTheme.colors.goldLight,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  segmentText: {
    color: "rgba(255, 244, 214, 0.68)",
    fontSize: 12,
    fontWeight: "900",
  },
  segmentTextActive: {
    color: gameTheme.colors.cream,
  },
  smallGrid: {
    flexDirection: "row",
    gap: 12,
  },
  bottomNav: {
    alignItems: "center",
    backgroundColor: "rgba(8, 11, 22, 0.9)",
    borderColor: "rgba(216, 168, 79, 0.38)",
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    left: 0,
    paddingBottom: Platform.OS === "android" ? 16 : 20,
    paddingTop: 10,
    position: "absolute",
    right: 0,
  },
  claimButton: {
    backgroundColor: "rgba(111, 59, 181, 0.86)",
    borderColor: gameTheme.colors.goldLight,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  claimButtonDisabled: {
    opacity: 0.45,
  },
  claimText: {
    color: gameTheme.colors.cream,
    fontSize: 15,
    fontWeight: "900",
  },
  cardPreview: {
    height: 126,
    width: 84,
  },
  cardPreviewRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 18,
    justifyContent: "center",
  },
  navIcon: {
    height: 22,
    width: 22,
  },
  navIconPlate: {
    alignItems: "center",
    borderColor: "rgba(243, 213, 138, 0.32)",
    borderRadius: 18,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  navIconPlateActive: {
    backgroundColor: "rgba(216, 168, 79, 0.22)",
    borderColor: gameTheme.colors.goldLight,
  },
  navItem: {
    alignItems: "center",
    gap: 3,
    minWidth: 70,
  },
  navItemActive: {
    opacity: 1,
  },
  navItemDisabled: {
    opacity: 0.44,
  },
  navLabel: {
    color: gameTheme.colors.cream,
    fontSize: 10,
    fontWeight: "800",
  },
  productLabel: {
    color: gameTheme.colors.cream,
    fontSize: 15,
    fontWeight: "900",
  },
  productPrice: {
    color: gameTheme.colors.goldLight,
    fontSize: 15,
    fontWeight: "900",
  },
  productRow: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(243, 213, 138, 0.18)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  rewardCopy: {
    flex: 1,
  },
  rewardIcon: {
    alignItems: "center",
    backgroundColor: "rgba(216, 168, 79, 0.2)",
    borderColor: "rgba(243, 213, 138, 0.55)",
    borderRadius: 18,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 64,
  },
  rewardIconImage: {
    height: 42,
    width: 54,
  },
  rewardStrip: {
    alignItems: "center",
    backgroundColor: "rgba(8, 11, 22, 0.66)",
    borderColor: "rgba(243, 213, 138, 0.46)",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    maxWidth: 390,
    padding: 12,
    width: "100%",
  },
  rewardText: {
    color: "rgba(255, 244, 214, 0.72)",
    fontSize: 13,
    fontWeight: "800",
  },
  rewardTitle: {
    color: gameTheme.colors.cream,
    fontSize: 16,
    fontWeight: "900",
  },
  storeSectionTitle: {
    color: gameTheme.colors.goldLight,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  subView: {
    gap: 14,
    maxWidth: 390,
    width: "100%",
  },
  subViewTitle: {
    color: gameTheme.colors.cream,
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "rgba(216, 168, 79, 0.55)",
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 10,
  },
});
