// The jumps' style knobs — the ONE file the autoresearch loop edits (.claude/skills/autoresearch; scored by
// tools/3d/anim/jump-score.mjs against an Elden Ring-like jump: the weapon steady, a hang at the top and a faster fall,
// a short hard give on landing and a quick recovery). `stand` is read by tools/3d/anim/jump-keyed.mjs when it bakes the
// standing jump (rebake after a change); `run` is read live by hero3d.js jumpShape for the running leap.
// The sim's own timing (take-off 0.1 s, landing 0.62 s, PLAYER.jump) is gameplay and never changes here.
export const JUMP_STYLE = {
  stand: {
    // the flight between take-off and touchdown: where the top falls (0..1 of the air time) and how the rise and fall
    // curve (2 = a plain parabola; higher = faster off the ground and a longer hang near the top)
    apex: 0.48, riseExp: 2.6, fallExp: 2.4,
    // the crouch: reached at (s after the press) and held to — the push runs from there to the take-off at 0.105
    crouchG: 0.035, crouchHold: 0.035,
    // the landing crouch: extra hip drop (units) below the video's, its time after the press and how long it is held
    landDrop: 0, landG: 0.7, landHold: 0.75,
    // when he is back up out of the landing (s after the press; the video's own rise is at 1.0)
    standG: 0.82,
    // the sword in the crouch: its angle on the video's screen (deg) and lean out of it — the push turns it from here
    bladeCrouch: -10, bladeCrouchZ: 0.6,
    // the arms in the air: 0 = the owner's video (thrown over his head), 1 = Elden Ring's (hands in front of the chest, the
    // sword level, back past his side)
    airArms: 1,
    // the same for the push (the key between the crouch and the take-off)
    pushArms: 0.5,
    // the level blade in the air: how far it points back (+) or forward (−) against out past his sword side (1)
    airBladeBack: -0.3,
    // the sword hand in the air: how far out to his side of the chest's middle (arm lengths) — near the middle, a blade laid
    // back went through his own arm and side (the owner, 2026-10-11: "the sword is clipping the body in the jump")
    airHandOut: 0.35,
    // the blade at the push and at the touchdown held toward the air's (0 = the video's: up, and at the camera)
    pushBlade: 1, landBlade: 1,
    // the crouch's blade toward out past his side and down (and how far down)
    crouchBlade: 1, crouchBladeDown: 0.6,
    // the knees in the air: 0 = the video's, 1 = Elden Ring's tuck (thighs up, feet under the hips)
    airTuck: 1,
    // the knees pushed out over the toes (thigh lengths, out to each side)
    kneesOut: 0.65,
    // the feet opened out before the landing, braced for the impact (units each side; 0 = off)
    landSpread: 0,
    // the legs straightened down for the ground on the descent, before the touchdown (0 = the tuck kept, 1 = straight)
    landReach: 0.75,
    // the feet in the air pointed down from the shins: the angle between shin and foot (deg; 90 = square, 0 = off)
    airFootPoint: 0,
    // the feet at the push (heels lifting) and the take-off (leaving on the toes): shin-to-foot angle (deg; 0 = as posed)
    pushFootPoint: 0, takeoffFootPoint: 0,
    // the push a heel rise: the heels lifted this far (deg) with the balls of the feet kept on the grass
    pushHeel: 30, takeoffHeel: 50,
  },
  run: {
    apex: 0.47, riseExp: 2.6, fallExp: 2.4,
    // the landing's give (units), its length (s) and forward pitch (rad)
    land: 1.3, landTime: 0.34, landPitch: 0.2,
    // the arms: the lead side's and the other side's swing (rad), and the forward lean in the air (rad per leg share)
    armLead: 0.35, armOther: -0.75, lean: 0.16,
    // the legs turned out to their own sides in the air (rad; the sign of + is checked by the score's kneesIn)
    legsOut: -0.35,
    // the leap's height, a share of PLAYER.jump.height (its tucked feet ride above the body's lift: soles at 9 at the top)
    lift: 0.72,
    // the feet in the air pointed down from the shins: shin-to-foot angle (deg; 0 = off)
    footPoint: 78,
    // the legs straightened for the ground before the landing (0..1) and how much earlier than the old reach (s)
    reach: 0.95, reachLead: 0.05,
    // the sword held level out past his side in the air (0..1), and how far it points back (+) or forward (−)
    bladeLevel: 1, bladeBack: -0.3, bladeIn: 0.22, bladeOut: 0.15,
  },
  // the running leap's key poses (tools/3d/anim/jump-run-keyed.mjs bakes them; rebake after a change): g s after the press;
  // lean deg forward; R/L legs: thigh deg from straight down (+ forward), knee deg bent, toe deg the foot tips toes-down from
  // square; handR/handL [forward, up, out] from the shoulder in arm lengths; blade [forward, up, out] — the right leg leads,
  // the arms swing opposite; out: the legs' lean out to their sides (the knees over the feet)
  runKeys: {
    out: 0.08,
    keys: [
      // the drive: the trailing leg pushing off, its knee bent and the ankle not overdone; the lead knee driving up
      { g: 0.08, lean: 16, R: { thigh: 55, knee: 80, toe: 25 }, L: { thigh: -25, knee: 30, toe: 30 }, handR: [-0.05, -0.5, 0.55], handL: [0.6, 0.05, 0.1], blade: [0.8, -0.5, 0.35] },
      // the rise: the lead knee high, the trailing foot folding up behind
      { g: 0.22, lean: 12, R: { thigh: 75, knee: 95, toe: 25 }, L: { thigh: 0, knee: 95, toe: 40 }, handR: [0.35, -0.2, 0.45], handL: [0.55, 0.15, 0.0], blade: [0.3, 0, 1] },
      // the top: both knees tucked, the sword level out past his side, the free arm forward for balance
      { g: 0.36, lean: 10, R: { thigh: 80, knee: 110, toe: 15 }, L: { thigh: 45, knee: 115, toe: 20 }, handR: [0.45, -0.1, 0.45], handL: [0.5, 0.1, 0.25], blade: [0.3, 0, 1] },
      // the reach: the lead leg straightening down and ahead for the ground, the arms opening
      { g: 0.5, lean: 6, R: { thigh: 30, knee: 20, toe: 10 }, L: { thigh: 0, knee: 50, toe: 15 }, handR: [0.3, -0.25, 0.6], handL: [0.35, -0.05, 0.55], blade: [0.3, -0.2, 1] },
      // the touchdown: the lead foot just ahead, its knee giving; the trailing leg coming through
      { g: 0.62, lean: 10, R: { thigh: 22, knee: 30, toe: 5 }, L: { thigh: -15, knee: 55, toe: 15 }, handR: [0.2, -0.4, 0.5], handL: [0.3, -0.25, 0.45], blade: [0.2, -0.5, 0.9] },
    ],
  },
};

/** Height share 0..1 at s (0..1 of the air time): rises to 1 at `apex` and falls back, each side its own exponent. */
export function arc(s, { apex, riseExp, fallExp }) {
  if (s <= 0 || s >= 1) return 0;
  return s < apex ? 1 - Math.pow(1 - s / apex, riseExp) : 1 - Math.pow((s - apex) / (1 - apex), fallExp);
}
