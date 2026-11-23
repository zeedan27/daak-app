import React, { useEffect, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  MOBILE_PALETTE,
  cancelSosCountdown,
  canCorroborateIncident,
  createSosCountdown,
  evaluateSafeWalkDeadline,
  mobileDemoLogin,
  resolveBanglaOrBanglishThana,
  resolveMobileAreaCoords,
  syncMobileApiAction,
  tickSosCountdown,
  type SosCountdownState,
} from "./src/citizenCore";

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim();

type TabId = "home" | "map" | "reports" | "ai";
type ViewStateMode = "live" | "loading" | "empty" | "error";

interface CitizenReportItem {
  id: string;
  title: string;
  area: string;
  lat: number;
  lng: number;
  corroborations: number;
  authorLabel: string;
  isOwn?: boolean;
}

const INITIAL_REPORTS: CitizenReportItem[] = [
  {
    id: "33333333-3333-4333-8333-333333333301",
    title: "Phone snatching near Kalabagan footover bridge",
    area: "Dhanmondi",
    lat: 23.7495,
    lng: 90.3806,
    corroborations: 2,
    authorLabel: "Anonymous Citizen",
  },
  {
    id: "33333333-3333-4333-8333-333333333303",
    title: "Evening harassment outside Mirpur-10 metro exit",
    area: "Mirpur-10",
    lat: 23.8072,
    lng: 90.369,
    corroborations: 3,
    authorLabel: "Anonymous Citizen",
  },
];

export default function App() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = MOBILE_PALETTE[scheme];

  const [tab, setTab] = useState<TabId>("home");
  const [viewMode, setViewMode] = useState<ViewStateMode>("live");
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [sosState, setSosState] = useState<SosCountdownState>({ status: "idle", secondsRemaining: 0 });
  const [sosBanner, setSosBanner] = useState<string | null>(null);
  const [walkTarget] = useState("TSC, Dhaka University");
  const [walkDeadline, setWalkDeadline] = useState(() => new Date(Date.now() + 18 * 60_000).toISOString());
  const [walkNowMs, setWalkNowMs] = useState(() => Date.now());
  const [walkActive, setWalkActive] = useState(true);
  const [reports, setReports] = useState<CitizenReportItem[]>(INITIAL_REPORTS);
  const [corroboratedIds, setCorroboratedIds] = useState<string[]>([]);

  const [reportTitle, setReportTitle] = useState("");
  const [reportArea, setReportArea] = useState("Dhanmondi");
  const [hideIdentity, setHideIdentity] = useState(true);
  const [aiQuery, setAiQuery] = useState("Dhanmondi te raat e hata safe?");
  const [aiReply, setAiReply] = useState<string | null>(null);

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: 23.7465,
    lng: 90.376,
  });
  const userLat = userCoords.lat;
  const userLng = userCoords.lng;

  useEffect(() => {
    if (!API_BASE) return;
    void mobileDemoLogin(API_BASE).then((tok) => {
      if (tok) setApiToken(tok);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const Location = await import("expo-location");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted" && mounted) {
          const pos = await Location.getCurrentPositionAsync({});
          if (mounted) {
            setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        }
      } catch {
        // Fallback to Dhanmondi coordinates when native location is unavailable
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!walkActive) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setWalkNowMs(now);
      const check = evaluateSafeWalkDeadline(walkDeadline, now);
      if (check.shouldAutoEscalate) {
        setWalkActive(false);
        setSosBanner("Safe Walk timeout escalated to Police Monitor.");
        if (API_BASE) {
          void syncMobileApiAction(API_BASE, apiToken, "/api/v1/sos", "POST", {
            lat: userLat,
            lng: userLng,
            area_name: "Dhanmondi",
            note: `Safe Walk timeout to ${walkTarget}`,
            idempotency_key: `mob-walk-${now}`,
          });
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [apiToken, userLat, userLng, walkActive, walkDeadline, walkTarget]);

  useEffect(() => {
    if (sosState.status !== "countdown") return;
    const timer = setTimeout(() => {
      setSosState((prev) => {
        const next = tickSosCountdown(prev);
        if (next.status === "transmitting") {
          setSosBanner("SOS transmitted to Police Monitor (Simulated 999 Relay).");
          if (API_BASE) {
            void syncMobileApiAction(API_BASE, apiToken, "/api/v1/sos", "POST", {
              lat: userLat,
              lng: userLng,
              area_name: "Dhanmondi",
              note: "Citizen SOS triggered from Mobile App",
              idempotency_key: `mob-sos-${Date.now()}`,
            });
          }
        }
        return next;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [apiToken, sosState, userLat, userLng]);

  const walkStatus = evaluateSafeWalkDeadline(walkDeadline, walkNowMs);
  const nearestThana = resolveBanglaOrBanglishThana("dhanmondi");

  const handlePublish = () => {
    if (!reportTitle.trim()) return;
    const titleVal = reportTitle.trim();
    const coords = resolveMobileAreaCoords(reportArea);
    setReports((prev) => [
      {
        id: `rep-${Date.now()}`,
        title: titleVal,
        area: reportArea,
        lat: coords.lat,
        lng: coords.lng,
        corroborations: 0,
        authorLabel: hideIdentity ? "Anonymous Citizen" : "Nadia Rahman",
        isOwn: true,
      },
      ...prev,
    ]);
    if (API_BASE) {
      void syncMobileApiAction(API_BASE, apiToken, "/api/v1/reports", "POST", {
        category: "snatching",
        severity: "medium",
        title: titleVal,
        description: `${titleVal} reported via Daak Citizen Mobile.`,
        area_name: reportArea,
        lat: coords.lat,
        lng: coords.lng,
        is_anonymous_public: hideIdentity,
      });
    }
    setReportTitle("");
    setTab("home");
  };

  const handleAskAi = async () => {
    if (API_BASE) {
      const remote = await syncMobileApiAction<{ reply?: string }>(
        API_BASE,
        apiToken,
        "/api/v1/ai/chat",
        "POST",
        { prompt: aiQuery, lat: userLat, lng: userLng }
      );
      if (remote?.reply) {
        setAiReply(remote.reply);
        return;
      }
    }
    const station = resolveBanglaOrBanglishThana(aiQuery);
    setAiReply(
      `Nearest station: ${station.name_en} (${station.name_bn}) · Duty phone: ${station.phone}. Keep Safe Walk active when commuting at night.`
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.canvas }]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />

      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: colors.railCommitted }]}>
        <View>
          <Text style={styles.headerSub}>Dhanmondi, Dhaka · Demo Citizen</Text>
          <Text style={styles.headerTitle}>Daak Safety</Text>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>Safety 78</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {viewMode === "loading" && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={{ color: colors.inkSecondary }}>Loading neighborhood safety snapshot...</Text>
          </View>
        )}

        {viewMode === "error" && (
          <View style={[styles.card, { backgroundColor: colors.emergencySoft, borderColor: colors.emergencyCrimson }]}>
            <Text style={{ color: colors.emergencyCrimson, fontWeight: "700" }}>
              Connection delayed — retry or call 999 directly.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={[styles.actionBtn, { borderColor: colors.hairline, marginTop: 8 }]}
              onPress={() => setViewMode("live")}
            >
              <Text style={{ color: colors.inkPrimary, fontWeight: "600" }}>Retry</Text>
            </Pressable>
          </View>
        )}

        {viewMode === "empty" && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={{ color: colors.inkPrimary, fontWeight: "600" }}>No nearby reports</Text>
            <Pressable
              accessibilityRole="button"
              style={[styles.actionBtn, { borderColor: colors.hairline, marginTop: 8 }]}
              onPress={() => setViewMode("live")}
            >
              <Text style={{ color: colors.inkPrimary }}>Restore demo feed</Text>
            </Pressable>
          </View>
        )}

        {viewMode === "live" && tab === "home" && (
          <>
            {sosBanner && (
              <View style={[styles.card, { backgroundColor: colors.emergencySoft, borderColor: colors.emergencyCrimson }]}>
                <Text style={{ color: colors.emergencyCrimson, fontWeight: "700" }}>{sosBanner}</Text>
              </View>
            )}

            {walkActive && (
              <View style={[styles.card, { backgroundColor: colors.railMuted, borderColor: colors.hairline }]}>
                <Text style={{ color: colors.inkPrimary, fontWeight: "700" }}>
                  Safe Walk: {walkTarget} ({Math.ceil(walkStatus.remainingSeconds / 60)}m left)
                </Text>
                <View style={styles.rowGap}>
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.actionBtn, { backgroundColor: colors.primaryTeal, flex: 1 }]}
                    onPress={() => setWalkActive(false)}
                  >
                    <Text style={{ color: colors.onPrimary, fontWeight: "600" }}>Check in safe</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.actionBtn, { borderColor: colors.hairline, backgroundColor: colors.surface, flex: 1 }]}
                    onPress={() => {
                      const now = Date.now();
                      setWalkDeadline(new Date(now - 1000).toISOString());
                      setWalkActive(false);
                      setSosBanner("Safe Walk timeout escalated to Police Monitor.");
                      if (API_BASE) {
                        void syncMobileApiAction(API_BASE, apiToken, "/api/v1/sos", "POST", {
                          lat: userLat,
                          lng: userLng,
                          area_name: "Dhanmondi",
                          note: `Safe Walk timeout to ${walkTarget}`,
                          idempotency_key: `mob-walk-manual-${now}`,
                        });
                      }
                    }}
                  >
                    <Text style={{ color: colors.inkPrimary, fontWeight: "600" }}>Escalate now</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Tactile 5s SOS Ring */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline, alignItems: "center" }]}>
              {sosState.status !== "countdown" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Trigger SOS 5 second countdown"
                  style={[styles.sosCircle, { backgroundColor: colors.emergencyFill }]}
                  onPress={() => setSosState(createSosCountdown(5))}
                >
                  <Text style={[styles.sosTitle, { color: colors.onEmergency }]}>SOS</Text>
                  <Text style={[styles.sosSub, { color: colors.onEmergency }]}>Tap for 5s countdown</Text>
                </Pressable>
              ) : (
                <View style={{ alignItems: "center", gap: 10 }}>
                  <View style={[styles.sosCountdown, { borderColor: colors.emergencyCrimson, backgroundColor: colors.emergencySoft }]}>
                    <Text style={{ color: colors.emergencyCrimson, fontSize: 32, fontWeight: "700" }}>
                      {sosState.secondsRemaining}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.actionBtn, { borderColor: colors.hairline, minWidth: 180 }]}
                    onPress={() => setSosState((prev) => cancelSosCountdown(prev))}
                  >
                    <Text style={{ color: colors.inkPrimary, fontWeight: "700" }}>Cancel SOS</Text>
                  </Pressable>
                </View>
              )}
              <Text style={{ color: colors.inkSecondary, fontSize: 12, marginTop: 10 }}>
                Nearest: {nearestThana.name_en} ({nearestThana.phone})
              </Text>
            </View>

            {/* Nearby Reports */}
            <Text style={[styles.sectionTitle, { color: colors.inkPrimary }]}>Nearby Verified Reports</Text>
            {reports.map((rep) => {
              const check = canCorroborateIncident(rep.lat, rep.lng, userLat, userLng, Boolean(rep.isOwn));
              const alreadyCorroborated = corroboratedIds.includes(rep.id);
              const disabled = !check.allowed || alreadyCorroborated;
              return (
                <View key={rep.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
                  <Text style={{ color: colors.inkPrimary, fontWeight: "700" }}>{rep.title}</Text>
                  <Text style={{ color: colors.inkSecondary, fontSize: 12, marginVertical: 4 }}>
                    {rep.area} · By {rep.authorLabel} · {check.distanceMeters}m away
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={disabled}
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: colors.hairline,
                        backgroundColor: !disabled ? colors.railMuted : colors.surface,
                        opacity: !disabled ? 1 : 0.55,
                      },
                    ]}
                    onPress={() => {
                      setCorroboratedIds((prev) => (prev.includes(rep.id) ? prev : [...prev, rep.id]));
                      setReports((prev) =>
                        prev.map((item) =>
                          item.id === rep.id ? { ...item, corroborations: item.corroborations + 1 } : item
                        )
                      );
                      if (API_BASE) {
                        void syncMobileApiAction(
                          API_BASE,
                          apiToken,
                          `/api/v1/reports/${rep.id}/corroborate`,
                          "POST",
                          { user_lat: userLat, user_lng: userLng }
                        );
                      }
                    }}
                  >
                    <Text style={{ color: colors.inkPrimary, fontWeight: "600" }}>
                      {alreadyCorroborated
                        ? `Corroborated (${rep.corroborations})`
                        : check.allowed
                        ? `I saw this too (${rep.corroborations})`
                        : `Outside 1 km (${rep.corroborations})`}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        {viewMode === "live" && tab === "map" && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={{ color: colors.inkPrimary, fontWeight: "700", marginBottom: 6 }}>
              Dhaka Area Safety Snapshot
            </Text>
            <Text style={{ color: colors.inkSecondary }}>Dhanmondi: 78 (Safe) · Mirpur-10: 58 (Moderate) · Shahbagh: 82 (Safe)</Text>
          </View>
        )}

        {viewMode === "live" && tab === "reports" && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline, gap: 10 }]}>
            <Text style={{ color: colors.inkPrimary, fontWeight: "700" }}>Report an Incident</Text>
            <TextInput
              value={reportTitle}
              onChangeText={setReportTitle}
              placeholder="Headline (e.g. Snatching near Science Lab)"
              placeholderTextColor={colors.inkSecondary}
              style={[styles.input, { borderColor: colors.hairline, color: colors.inkPrimary }]}
            />
            <TextInput
              value={reportArea}
              onChangeText={setReportArea}
              placeholder="Area (e.g. Dhanmondi)"
              placeholderTextColor={colors.inkSecondary}
              style={[styles.input, { borderColor: colors.hairline, color: colors.inkPrimary }]}
            />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 }}>
              <Text style={{ color: colors.inkPrimary }}>Hide my name publicly</Text>
              <Switch value={hideIdentity} onValueChange={setHideIdentity} />
            </View>
            <Pressable
              accessibilityRole="button"
              style={[styles.actionBtn, { backgroundColor: colors.primaryTeal }]}
              onPress={handlePublish}
            >
              <Text style={{ color: colors.onPrimary, fontWeight: "700" }}>Publish report</Text>
            </Pressable>
          </View>
        )}

        {viewMode === "live" && tab === "ai" && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline, gap: 10 }]}>
            <Text style={{ color: colors.inkPrimary, fontWeight: "700" }}>DaakAI (Bangla / Banglish)</Text>
            <TextInput
              value={aiQuery}
              onChangeText={setAiQuery}
              placeholder="Ask about an area or nearest Thana"
              placeholderTextColor={colors.inkSecondary}
              style={[styles.input, { borderColor: colors.hairline, color: colors.inkPrimary }]}
            />
            <Pressable
              accessibilityRole="button"
              style={[styles.actionBtn, { backgroundColor: colors.primaryTeal }]}
              onPress={handleAskAi}
            >
              <Text style={{ color: colors.onPrimary, fontWeight: "700" }}>Ask DaakAI</Text>
            </Pressable>
            {aiReply && <Text style={{ color: colors.inkPrimary }}>{aiReply}</Text>}
          </View>
        )}
      </ScrollView>

      {/* Bottom Material / HIG 4-Tab Bar (min 48dp height) */}
      <View accessibilityRole="tablist" style={[styles.tabBar, { backgroundColor: colors.surface, borderTopColor: colors.hairline }]}>
        {(["home", "map", "reports", "ai"] as TabId[]).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}
            style={[styles.tabItem, tab === item && { backgroundColor: colors.railMuted }]}
            onPress={() => setTab(item)}
          >
            <Text style={{ color: tab === item ? colors.primaryTeal : colors.inkSecondary, fontWeight: "700", fontSize: 12 }}>
              {item === "home" ? "Home" : item === "map" ? "Map" : item === "reports" ? "Reports" : "DaakAI"}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSub: { color: "#D6ECE8", fontSize: 12 },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  scoreBadge: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  scoreText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  scrollContent: { padding: 14, gap: 12 },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginTop: 4 },
  rowGap: { flexDirection: "row", gap: 8, marginTop: 6 },
  actionBtn: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  sosCircle: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: "center",
    justifyContent: "center",
  },
  sosTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  sosSub: { color: "#FFFFFF", fontSize: 11, marginTop: 2 },
  sosCountdown: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  tabBar: { flexDirection: "row", borderTopWidth: 1 },
  tabItem: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center" },
});
