import { CLUB_SPECS } from "./clubs.ts";
import type { FlightResult } from "./flight.ts";
import type { CameraPreset, ShotScene } from "./schema.ts";
import { deriveSetup } from "./setup.ts";

const VIEW_NAMES: Record<CameraPreset, string> = {
  "face-on": "Face-on view",
  "down-the-line": "Down-the-line view",
  behind: "View from behind the ball",
  overhead: "Overhead view",
};

function slopeText(scene: ShotScene): string {
  const { slopeAlong, slopeAcross } = scene.terrain;
  const parts: string[] = [];
  if (slopeAlong > 0.5)
    parts.push(`an uphill lie (${Math.round(slopeAlong)}° up toward the target)`);
  if (slopeAlong < -0.5)
    parts.push(`a downhill lie (${Math.round(-slopeAlong)}° down toward the target)`);
  if (slopeAcross > 0.5)
    parts.push(`the ball above the feet (${Math.round(slopeAcross)}° side slope)`);
  if (slopeAcross < -0.5)
    parts.push(`the ball below the feet (${Math.round(-slopeAcross)}° side slope)`);
  return parts.length ? parts.join(" and ") : "level ground";
}

function lateral(m: number): string {
  const side = m > 0 ? "right" : "left";
  return Math.abs(m) < 2
    ? "finishing close to the target line"
    : `finishing about ${Math.round(Math.abs(m))} m ${side}`;
}

/**
 * Plain-language description of a scene for alt text and screen readers. Directions are given
 * for the golfer's handedness.
 */
export function describeScene(scene: ShotScene, flight: FlightResult, view?: CameraPreset): string {
  const setup = deriveSetup(scene);
  const club = CLUB_SPECS[scene.swing.club].label.toLowerCase();
  const hand = scene.golfer.handedness === "left" ? "left-handed" : "right-handed";
  const mirror = scene.golfer.handedness === "left" ? -1 : 1;
  const ballPos =
    setup.ballPosition > 0.3
      ? "forward in the stance"
      : setup.ballPosition < -0.2
        ? "back in the stance"
        : "near the middle of the stance";
  const weight =
    setup.weightLead > 0.56
      ? "more weight on the lead foot"
      : setup.weightLead < 0.44
        ? "more weight on the trail foot"
        : "weight balanced";

  const sentences = [
    `${view ? `${VIEW_NAMES[view]}: ` : ""}a ${hand} golfer with a ${club} on ${slopeText(scene)}.`,
    `Ball ${ballPos}, ${weight}, shoulders tilted ${Math.round(Math.abs(setup.shoulderTilt))}° with the lead shoulder ${setup.shoulderTilt >= 0 ? "higher" : "lower"}.`,
  ];
  if (scene.golfer.aim !== 0) {
    const side = scene.golfer.aim * mirror > 0 ? "right" : "left";
    sentences.push(`Aim is ${Math.abs(scene.golfer.aim)}° ${side} of the target.`);
  }
  const wind = scene.flight.wind;
  if (wind && wind.speed > 0) {
    const from =
      wind.from < 45 || wind.from > 315
        ? "into the golfer's face"
        : wind.from > 135 && wind.from < 225
          ? "from behind"
          : `across from the ${(wind.from < 180 ? 1 : -1) * mirror > 0 ? "right" : "left"}`;
    sentences.push(`Wind ${Math.round(wind.speed * 2.237)} mph ${from}.`);
  }
  if (flight.carry > 0) {
    sentences.push(
      `The ball flies about ${Math.round(flight.carry)} m with a peak of ${Math.round(flight.apex[1])} m, lands at ${Math.round(flight.descentAngle)}° and rolls to about ${Math.round(flight.total)} m, ${lateral(flight.rest[2] * mirror)}.`,
    );
  } else {
    sentences.push(`The ball rolls about ${Math.round(flight.total)} m.`);
  }
  return sentences.join(" ");
}
