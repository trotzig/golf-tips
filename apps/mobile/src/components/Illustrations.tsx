import {
  ADDRESS_H,
  ADDRESS_W,
  addressLayout,
  addressSummary,
  CLUB_SPECS,
  compareWithNormal,
  setupInsight,
  type ShotScene,
} from "@shotbook/shot-viz";
import { Fragment, useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import {
  clockArc,
  clockPoint,
  clubLadder,
  FLIGHT_BASE,
  FLIGHT_W,
  flightPaths,
  flightX,
  footPath,
  round,
  side,
  SWING_NAME,
  SWING_TOP,
  tiltedLine,
  topPath,
} from "../lib/illustrations";
import { useHanded, usePrefs } from "../prefs";
import { fonts, useColors } from "../theme";

// The illustrated sections of a situation, as on the site: setup gauges, the swing clock, the
// flight compared with normal, and the club ladder and roll chart. Drawn from the diagram's scene
// for the reader's hand; the words beside each drawing carry its meaning, so drawings are hidden
// from screen readers.

/** An SVG that fills the width and keeps the view box's shape. */
function Figure({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", aspectRatio: w / h }}>
        {children}
      </Svg>
    </View>
  );
}

function Tile({
  title,
  value,
  wide,
  children,
}: {
  title: string;
  value: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <View style={[styles.tile, wide && styles.wide, { backgroundColor: c.surface }]}>
      <Text style={[styles.tileTitle, { color: c.inkMuted }]}>{title}</Text>
      <Text style={[styles.tileValue, { color: c.inkStrong }]}>{value}</Text>
      <View style={{ marginTop: 6 }}>{children}</View>
    </View>
  );
}

function Label(props: {
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  size?: number;
  color: string;
  bold?: boolean;
  children: string;
}) {
  return (
    <SvgText
      x={props.x}
      y={props.y}
      textAnchor={props.anchor ?? "middle"}
      fontSize={props.size ?? 10}
      fontFamily={props.bold ? fonts.semibold : fonts.regular}
      fill={props.color}
    >
      {props.children}
    </SvgText>
  );
}

/** Address position compared with a normal shot (dashed), seen the way the golfer sees it. */
export function SetupGauges({ scene }: { scene: ShotScene }) {
  const c = useColors();
  const handed = useHanded();
  const mirror = usePrefs().hand === "left";
  const i = useMemo(() => setupInsight(scene), [scene]);
  const { setup } = i;

  const shoulderText = i.matchesSlope
    ? "Match the slope"
    : setup.shoulderTilt > 7
      ? "Lead shoulder higher"
      : setup.shoulderTilt >= 2
        ? "Lead side a touch higher"
        : "Level";
  const aimText =
    Math.abs(i.aim) < 1 ? "At the target" : i.aim < 0 ? "A little {left}" : "A little {right}";

  const l = addressLayout(i, mirror);
  const { y: footY, h: footH } = l.foot;

  const ground = tiltedLine(scene.terrain.slopeAlong, 62, 50, mirror);
  const sh = tiltedLine(setup.shoulderTilt, 46, 22, mirror);

  // The target line runs toward the lead side; aiming left of it, for a right-hander, points
  // toward the golfer's side of the line (down).
  const aimBall = side(0.55, 130, mirror);
  const target = side(-0.9, 130, mirror);
  const a = (i.aim * 3 * Math.PI) / 180;
  const aimX = round(aimBall + (mirror ? 1 : -1) * Math.cos(a) * 62);
  const aimY = round(14 - Math.sin(a) * 62);

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.caption, { color: c.inkMuted }]}>
        {handed("Lead side on the {left}. Dashed: a normal shot.")}
      </Text>
      <View style={styles.grid}>
        <Tile title="Address" value={addressSummary(i)} wide>
          <Figure w={ADDRESS_W} h={ADDRESS_H}>
            <Line
              x1={l.line.x1}
              y1={l.ballY}
              x2={l.line.x2}
              y2={l.ballY}
              stroke={c.lineStrong}
              strokeWidth={1.4}
              strokeDasharray="2 4"
            />
            <Label
              x={l.target.x}
              y={l.ballY - 9}
              anchor={l.target.anchor}
              size={11}
              bold
              color={c.accent}
            >
              {l.target.text}
            </Label>
            {l.normalFeet.map((x) => (
              <Path
                key={x}
                d={footPath(x, footY, footH)}
                fill="none"
                stroke={c.lineStrong}
                strokeWidth={1.4}
                strokeDasharray="3 2"
              />
            ))}
            {l.feet.map((f) => (
              <Fragment key={f.label}>
                <Path
                  d={footPath(f.x, footY, footH)}
                  fill={c.card}
                  stroke={c.inkStrong}
                  strokeWidth={1.8}
                />
                <Path d={footPath(f.x, footY, footH)} fill={c.accent} fillOpacity={f.shade} />
                <Label x={f.x} y={l.labelY} size={11} color={c.inkMuted}>
                  {f.label}
                </Label>
              </Fragment>
            ))}
            <Line
              x1={l.ball}
              y1={l.guide.y1}
              x2={l.ball}
              y2={l.guide.y2}
              stroke={c.inkStrong}
              strokeWidth={1}
              strokeDasharray="1 3"
            />
            <Circle
              cx={l.normalBall}
              cy={l.ballY}
              r={8}
              fill="none"
              stroke={c.lineStrong}
              strokeWidth={1.6}
              strokeDasharray="3 2"
            />
            <Circle
              cx={l.ball}
              cy={l.ballY}
              r={8}
              fill={c.card}
              stroke={c.inkStrong}
              strokeWidth={2}
            />
            <Line
              x1={l.balance.x1}
              y1={l.balance.y}
              x2={l.balance.x2}
              y2={l.balance.y}
              stroke={c.lineStrong}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <Line
              x1={l.balance.centre}
              y1={l.balance.y - 4}
              x2={l.balance.centre}
              y2={l.balance.y + 4}
              stroke={c.lineStrong}
              strokeWidth={1.4}
            />
            <Path d={l.balance.pointer} fill={c.accent} />
          </Figure>
        </Tile>

        <Tile title="Shoulders" value={shoulderText}>
          <Figure w={130} h={64}>
            <Line {...ground} stroke={c.lineStrong} strokeWidth={5} strokeLinecap="round" />
            <Line {...sh} stroke={c.accent} strokeWidth={3} strokeLinecap="round" />
            <Circle cx={sh.x1} cy={sh.y1} r={4} fill={c.accent} />
            <Circle cx={sh.x2} cy={sh.y2} r={4} fill={c.accent} />
            <Label x={sh.x1} y={sh.y1 - 8} color={c.inkMuted}>
              Lead
            </Label>
            <Label x={sh.x2} y={sh.y2 - 8} color={c.inkMuted}>
              Trail
            </Label>
          </Figure>
        </Tile>

        <Tile title="Aim" value={handed(aimText)}>
          <Figure w={130} h={52}>
            <Line
              x1={aimBall}
              y1={14}
              x2={target}
              y2={14}
              stroke={c.lineStrong}
              strokeWidth={1.4}
              strokeDasharray="2 3"
            />
            <Circle cx={target} cy={14} r={3.5} fill={c.highlight} />
            <Line
              x1={aimBall}
              y1={14}
              x2={aimX}
              y2={aimY}
              stroke={c.accent}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
            <Circle cx={aimX} cy={aimY} r={3.5} fill={c.accent} />
            <Circle
              cx={aimBall}
              cy={14}
              r={4}
              fill={c.card}
              stroke={c.inkStrong}
              strokeWidth={1.5}
            />
            <Path d={footPath(aimBall - 14, 38, 22)} fill={c.lineStrong} />
            <Path d={footPath(aimBall + 14, 38, 22)} fill={c.lineStrong} />
          </Figure>
        </Tile>
      </View>
    </View>
  );
}

/** How far back to swing, as a clock face seen face-on. Dashed: a full swing. */
export function SwingClock({ scene }: { scene: ShotScene }) {
  const c = useColors();
  const mirror = usePrefs().hand === "left";
  const { length, attackAngle } = scene.swing;
  const [ex, ey] = clockPoint(SWING_TOP[length], 40, mirror);
  const hitDown = attackAngle !== undefined && attackAngle <= -3;

  return (
    <View style={styles.clockRow}>
      <View accessible={false} importantForAccessibility="no-hide-descendants">
        <Svg width={112} height={112} viewBox="0 0 112 112">
          <Circle cx={56} cy={56} r={52} fill={c.surface} />
          {[12, 3, 6, 9].map((h) => {
            const [x1, y1] = clockPoint(h, 47, mirror);
            const [x2, y2] = clockPoint(h, 52, mirror);
            return <Line key={h} {...{ x1, y1, x2, y2 }} stroke={c.lineStrong} strokeWidth={2} />;
          })}
          <Path
            d={clockArc(12.3, mirror)}
            fill="none"
            stroke={c.lineStrong}
            strokeWidth={2}
            strokeDasharray="3 3"
          />
          <Path
            d={clockArc(SWING_TOP[length], mirror)}
            fill="none"
            stroke={c.accent}
            strokeWidth={6}
            strokeLinecap="round"
          />
          <Line x1={56} y1={56} x2={ex} y2={ey} stroke={c.inkStrong} strokeWidth={2} />
          <Circle cx={56} cy={56} r={4} fill={c.inkStrong} />
          <Circle cx={ex} cy={ey} r={5} fill={c.inkStrong} />
        </Svg>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.clockName, { color: c.inkStrong }]}>{SWING_NAME[length]}</Text>
        {hitDown && (
          <Text style={[styles.body, { color: c.inkMuted }]}>
            Hit down: ball first, then the ground.
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * What the ball does compared with a normal shot with the same club: three effect tiles, the
 * flight side-on over a dashed normal shot, and the curve from above when there is one.
 */
export function FlightComparison({ scene }: { scene: ShotScene }) {
  const c = useColors();
  const handed = useHanded();
  const mirror = usePrefs().hand === "left";
  const cmp = useMemo(() => compareWithNormal(scene), [scene]);
  const paths = useMemo(() => flightPaths(cmp), [cmp]);
  const club = CLUB_SPECS[scene.swing.club].label.toLowerCase();

  const height = { less: "Lower flight", normal: "Normal height", more: "Higher flight" }[
    cmp.height
  ];
  const roll = {
    less: "Less roll",
    normal: "Normal roll",
    more: "More roll",
    "much-more": "Much more roll",
  }[cmp.roll];
  const curve = { left: "Curves {left}", none: "Straight", right: "Curves {right}" }[cmp.curve];

  const heightCtrl = { less: 16, normal: 4, more: -8 }[cmp.height];
  const rollLen = { less: 2, normal: 5, more: 10, "much-more": 15 }[cmp.roll];
  const curveSide = cmp.curve === "none" ? 0 : (cmp.curve === "right") !== mirror ? 1 : -1;
  const curveEnd = 17 + curveSide * 8;
  const curveCtrl = 17 - curveSide * 6;

  const effect = (key: string, label: string, icon: ReactNode) => {
    const plain = key === "normal" || key === "none";
    return (
      <View style={[styles.effect, { backgroundColor: c.surface }]}>
        <View accessible={false} importantForAccessibility="no-hide-descendants">
          <Svg width={36} height={36} viewBox="0 0 34 34">
            {icon}
          </Svg>
        </View>
        <Text
          style={[
            styles.effectText,
            plain ? { color: c.inkMuted } : { color: c.inkStrong, fontFamily: fonts.semibold },
          ]}
        >
          {label}
        </Text>
      </View>
    );
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={styles.effects}>
        {effect(
          cmp.height,
          height,
          <>
            <Path
              d="M3 28 Q17 4 31 28"
              fill="none"
              stroke={c.lineStrong}
              strokeWidth={1.6}
              strokeDasharray="3 3"
            />
            <Path
              d={`M3 28 Q17 ${heightCtrl} 31 28`}
              fill="none"
              stroke={c.accent}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
            <Line x1={1} y1={29.5} x2={33} y2={29.5} stroke={c.lineStrong} strokeWidth={1.5} />
          </>,
        )}
        {effect(
          cmp.roll,
          roll,
          <>
            <Path
              d={`M2 28 Q${round((28 - rollLen) / 2 + 1)} 6 ${28 - rollLen} 28`}
              fill="none"
              stroke={c.accent}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
            <Line
              x1={28 - rollLen}
              y1={28}
              x2={28}
              y2={28}
              stroke={c.accent}
              strokeWidth={3.6}
              strokeLinecap="round"
            />
            <Circle cx={30} cy={26.5} r={2.4} fill={c.inkStrong} />
            <Line x1={1} y1={30.5} x2={33} y2={30.5} stroke={c.lineStrong} strokeWidth={1.5} />
          </>,
        )}
        {effect(
          cmp.curve,
          handed(curve),
          <>
            <Line
              x1={17}
              y1={31}
              x2={17}
              y2={3}
              stroke={c.lineStrong}
              strokeWidth={1.4}
              strokeDasharray="2 3"
            />
            <Path
              d={`M17 31 Q${curveCtrl} 12 ${curveEnd} 5`}
              fill="none"
              stroke={c.accent}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
            <Circle cx={17} cy={4} r={2.4} fill={c.highlight} />
          </>,
        )}
      </View>

      <Figure w={FLIGHT_W} h={112}>
        <Rect
          x={0}
          y={FLIGHT_BASE}
          width={FLIGHT_W}
          height={112 - FLIGHT_BASE}
          fill={c.accentSoft}
        />
        <Path
          d={paths.normal}
          fill="none"
          stroke={c.lineStrong}
          strokeWidth={2}
          strokeDasharray="4 4"
        />
        <Path d={paths.shot} fill="none" stroke={c.accent} strokeWidth={3} strokeLinecap="round" />
        <Line
          x1={paths.landX}
          y1={FLIGHT_BASE}
          x2={flightX(1)}
          y2={FLIGHT_BASE}
          stroke={c.accent}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <Circle cx={flightX(0)} cy={FLIGHT_BASE - 4} r={3.5} fill={c.inkStrong} />
        <Circle
          cx={flightX(1)}
          cy={FLIGHT_BASE - 4}
          r={4.5}
          fill={c.card}
          stroke={c.inkStrong}
          strokeWidth={1.8}
        />
        <Label x={paths.landX} y={FLIGHT_BASE + 13} color={c.inkMuted}>
          lands
        </Label>
      </Figure>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <Svg width={20} height={4}>
            <Line x1={0} y1={2} x2={20} y2={2} stroke={c.accent} strokeWidth={3} />
          </Svg>
          <Text style={[styles.small, { color: c.inkMuted }]}>This shot</Text>
        </View>
        <View style={styles.legendItem}>
          <Svg width={20} height={4}>
            <Line
              x1={0}
              y1={2}
              x2={20}
              y2={2}
              stroke={c.lineStrong}
              strokeWidth={2}
              strokeDasharray="4 3"
            />
          </Svg>
          <Text style={[styles.small, { color: c.inkMuted }]}>Normal {club} shot</Text>
        </View>
      </View>

      {cmp.curve !== "none" && (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.tileTitle, { color: c.inkMuted, marginBottom: 4 }]}>From above</Text>
          <Figure w={FLIGHT_W} h={60}>
            <Rect x={0} y={0} width={FLIGHT_W} height={60} rx={6} fill={c.surface} />
            <Line
              x1={12}
              y1={30}
              x2={FLIGHT_W - 12}
              y2={30}
              stroke={c.lineStrong}
              strokeWidth={1.4}
              strokeDasharray="3 4"
            />
            <Circle cx={FLIGHT_W - 12} cy={30} r={4} fill={c.highlight} />
            <Path
              d={topPath(cmp, mirror)}
              fill="none"
              stroke={c.accent}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <Label x={16} y={13} anchor="start" color={c.inkMuted}>
              left
            </Label>
            <Label x={16} y={54} anchor="start" color={c.inkMuted}>
              right
            </Label>
          </Figure>
        </View>
      )}
    </View>
  );
}

/** Clubs from less to more, each a little longer: the normal club dashed, the ones to take filled. */
export function ClubLadder({ change }: { change: number | [number, number] }) {
  const c = useColors();
  const { steps, spoken } = clubLadder(change);
  return (
    <View accessible accessibilityLabel={spoken} style={styles.ladder}>
      {steps.map(({ n, label, picked, length }) => {
        const color = picked ? c.onAccent : n === 0 ? c.inkStrong : c.inkMuted;
        return (
          <View
            key={n}
            style={[
              styles.rung,
              { backgroundColor: picked ? c.accent : c.surface },
              n === 0 && !picked && { borderStyle: "dashed", borderColor: c.lineStrong },
            ]}
          >
            <Svg width={16} height={44} viewBox="0 0 16 44">
              <Line
                x1={11}
                y1={42 - length}
                x2={7}
                y2={38}
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <Path d="M7 38 L2 40 L3 42.5 L9 42 Z" fill={color} />
            </Svg>
            <Text style={[styles.rungText, { color }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const ROLL_CLUBS = [
  ["SW", 1],
  ["PW", 2],
  ["9-iron", 3],
  ["8-iron", 4],
  ["7-iron", 5],
] as const;

/** Around the green, less loft means less air and more roll: one row per club, no numbers. */
export function ClubRollChart() {
  const c = useColors();
  return (
    <View
      accessible
      accessibilityLabel="The less loft, the more the ball rolls: a sand wedge flies furthest and rolls least, a 7-iron flies least and rolls most."
      style={{ marginBottom: 12, gap: 4 }}
    >
      {ROLL_CLUBS.map(([club, roll]) => {
        const air = round((206 / (roll + 1)) * 1.3);
        return (
          <View key={club} style={styles.rollRow}>
            <Text style={[styles.rollClub, { color: c.inkStrong }]}>{club}</Text>
            <View style={{ flex: 1 }}>
              <Svg viewBox="0 0 220 26" style={{ width: "100%", aspectRatio: 220 / 26 }}>
                <Path
                  d={`M4 22 Q${round(4 + air / 2)} 4 ${round(4 + air)} 22`}
                  fill="none"
                  stroke={c.lineStrong}
                  strokeWidth={1.6}
                  strokeDasharray="3 3"
                />
                <Line
                  x1={round(4 + air)}
                  y1={22}
                  x2={212}
                  y2={22}
                  stroke={c.accent}
                  strokeWidth={4}
                  strokeLinecap="round"
                />
                <Circle cx={round(4 + air)} cy={22} r={3} fill={c.inkStrong} />
              </Svg>
            </View>
          </View>
        );
      })}
      <View style={[styles.rollEnds, { paddingHorizontal: 8 }]}>
        <Text style={[styles.tiny, { color: c.inkMuted }]}>More air</Text>
        <Text style={[styles.tiny, { color: c.inkMuted }]}>More roll</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { fontFamily: fonts.regular, fontSize: 14, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: "40%",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  wide: { flexBasis: "100%" },
  tileTitle: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  tileValue: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: fonts.regular, fontSize: 14 },
  tiny: { fontFamily: fonts.regular, fontSize: 12 },
  clockRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  clockName: { fontFamily: fonts.semibold, fontSize: 18 },
  effects: { flexDirection: "row", gap: 8, marginBottom: 12 },
  effect: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  effectText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 17, textAlign: "center" },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  ladder: { flexDirection: "row", gap: 6, marginBottom: 12 },
  rung: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: 8,
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 6,
  },
  rungText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 4,
  },
  rollRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8 },
  rollClub: { width: 56, fontFamily: fonts.semibold, fontSize: 14 },
  rollEnds: { flexDirection: "row", justifyContent: "space-between" },
});
