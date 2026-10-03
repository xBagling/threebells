// The bell at the back of the garden, for a bell entrance (FIGHT.entrance; the owner, 2026-10-02): the
// owner's Hi3D post with its green bell (tools/3d/blender/57_bell_prop.py, art3d/bell/bell.gltf: two
// nodes, `post` with its foot at the origin and its arm along +X, `bell` pivoting at the top of its
// ring on the hook), stood so the bell hangs over the sim's bell, the arm reaching across the screen.
// Struck, the bell swings away from the blow and settles, a damped pendulum on real time.
import { Group, Vector3 } from "./three-lib.js?v=8898846";
import { paintMaterial } from "./materials3d.js?v=8898846";


export function makeBell3D(asset, look, E) {
  const group = new Group();
  const root = asset.scene.clone(true);
  let bellNode = null;
  root.traverse((o) => {
    if (o.name === "bell") bellNode = o;
    if (o.isMesh) {
      o.material = paintMaterial(look, { map: o.material.map || null, color: o.material.map ? 0xffffff : 0x6f8a3a, char: true, fill: [0.05, 0.06, 0.05] });
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  group.add(root);
  group.scale.setScalar(E.postH);
  // The arm along the screen's right (sim (1, −1)/√2, three (x, z) = (0.707, −0.707)): a quarter
  // turn of +X by +45° about up. The post's foot stands back along the arm from the bell.
  group.rotation.y = Math.PI / 4;
  const reach = E.hookX * E.postH; // (FIGHT.entrance: the hook's reach, from bell.json)
  group.position.set(E.bell[0] - Math.SQRT1_2 * reach, 0, E.bell[1] + Math.SQRT1_2 * reach);
  group.visible = false;

  let struckAt = null;
  let blow = 0; // the blow's direction in the bell's own frame: the swing goes away from it
  const axis = new Vector3();
  return {
    group,
    /** The sword struck it, coming from `a` (sim radians), at real time `now`. */
    strike(a, now) {
      struckAt = now;
      blow = a - Math.PI / 4;
    },
    update(w, now) {
      group.visible = !!w.bell;
      if (!w.bell || !bellNode) return;
      if (struckAt == null) {
        bellNode.rotation.set(0, 0, 0);
        return;
      }
      const t = now - struckAt;
      const ang = 0.42 * Math.exp(-1.1 * t) * Math.sin(6.5 * t);
      // Swing about the horizontal axis across the blow (its direction, turned into the node's frame).
      axis.set(Math.sin(blow), 0, Math.cos(blow)).normalize();
      bellNode.quaternion.setFromAxisAngle(axis, ang);
    },
  };
}
