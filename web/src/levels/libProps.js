/**
 * SHADOW PROTOCOL — shared prop builders used by both eras.
 * (Small props that exist in models.js are re-exported so level kits have a
 * single import surface; the container/corrugation prop lives here because it
 * is only ever used by modern levels.)
 */
import * as THREE from 'three';
import { MAT } from '../engine/materials.js';

export { buildCrate, buildBarrel, buildStreetLamp, buildTruck, buildBTR } from '../game/models.js';

export function buildContainer(color = [90, 80, 60]) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.44, 2.59, 12.19), MAT.container(color));
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // corrugation ribs on the long faces
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x000000, roughness: 0.9, transparent: true, opacity: 0.13
  });
  for (const s of [-1, 1]) {
    for (let i = -5; i <= 5; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.4, 0.12), ribMat);
      rib.position.set(s * 1.225, 0, i * 1.1);
      g.add(rib);
    }
  }
  // door locking bars on one end
  for (const y of [-0.7, 0, 0.7]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), MAT.metal(0x2a2e30));
    bar.position.set(0, y, 6.14);
    g.add(bar);
  }
  return g;
}

export function buildPalletStack() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 1.0), MAT.wood());
    pallet.position.y = 0.06 + i * 0.55;
    g.add(pallet);
    for (let k = 0; k < 3; k++) {
      const sack = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.16, 0.5, 3, 6),
        new THREE.MeshStandardMaterial({ color: 0x8a8271, roughness: 0.95 })
      );
      sack.rotation.z = Math.PI / 2;
      sack.position.set(0, 0.24 + i * 0.55, -0.32 + k * 0.32);
      g.add(sack);
    }
  }
  g.traverse((o) => { o.castShadow = true; });
  return g;
}
