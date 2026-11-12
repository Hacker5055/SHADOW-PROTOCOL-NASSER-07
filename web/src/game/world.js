/**
 * SHADOW PROTOCOL — World
 * Owns the scene contents for one mission: geometry, collision proxies, spawn
 * points, interactive props, triggers, particle pools and animated actors.
 * Levels are pure builder functions that populate a World (see levels/*.js),
 * exactly like a UE level script populating an AWorldSettings + actors.
 */
import * as THREE from 'three';
import { CollisionWorld } from '../engine/physics.js';

export class World {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.collision = new CollisionWorld();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.props = new Map();     // id -> { mesh, kind, data }
    this.triggers = [];         // { id, pos, radius, once, fired, onEnter }
    this.enemySpawns = [];      // { id, pos, yaw, kind, patrol, post, difficulty }
    this.friendSpawns = [];     // { id, callsign, pos, role }
    this.interactables = [];
    this.animated = [];
    this.particles = [];
    this.dynamicBodies = [];
    this.ambientAudio = [];
    this.groundFn = () => 0;
    this.waterLevel = -999;
    this.collision.groundFn = (x, z) => this.groundFn(x, z);
    this.collision.waterFn = () => this.waterLevel;
    this.meta = {};
    this.sceneryCount = 0;
  }

  /** Register heightfield terrain. fn(x,z) -> y */
  setTerrain(fn, { size = 400, segments = 200, material = null } = {}) {
    this.groundFn = fn;
    this.collision.groundFn = fn;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c1 = new THREE.Color(0xb59a6c);
    const c2 = new THREE.Color(0x9c8459);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = fn(x, z);
      pos.setY(i, y);
      const t = Math.min(1, Math.max(0, (y + 1) / 6 * 0.7 + Math.random() * 0.12));
      tmp.copy(c1).lerp(c2, t);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = material || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, metalness: 0 });
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.group.add(this.terrain);
    return this.terrain;
  }

  /** Add a collidable box mesh. Returns the mesh. */
  addBox(cx, cy, cz, sx, sy, sz, material, opts = {}) {
    let mesh;
    if (opts.geometry) mesh = new THREE.Mesh(opts.geometry, material);
    else mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(cx, cy, cz);
    if (opts.rotY) mesh.rotation.y = opts.rotY;
    mesh.castShadow = opts.castShadow !== false;
    mesh.receiveShadow = opts.receiveShadow !== false;
    this.group.add(mesh);
    if (opts.solid !== false) {
      const box = this.collision.addBox(cx, cy, cz, sx, sy, sz, opts.tag || 'static', {
        solid: true,
        cover: !!opts.cover,
        blockVision: opts.blockVision !== false
      });
      mesh.userData.collisionBox = box;
      if (opts.dynamic) { box.dynamic = true; this.dynamicBodies.push({ mesh, box }); }
    }
    this.sceneryCount++;
    return mesh;
  }

  addObject(obj, { solid = false, box = null, tag = 'prop' } = {}) {
    this.group.add(obj);
    if (solid && box) {
      const b = this.collision.addBox(box[0], box[1], box[2], box[3], box[4], box[5], tag, {
        solid: true, cover: !!box[6], blockVision: box[7] !== false
      });
      obj.userData.collisionBox = b;
    }
    this.sceneryCount++;
    return obj;
  }

  addProp(id, mesh, kind, data = {}) {
    this.props.set(id, { mesh, kind, data, alive: true });
    return this.props.get(id);
  }

  addTrigger(id, pos, radius, onEnter, once = true) {
    const t = { id, pos: { ...pos }, radius, onEnter, once, fired: false };
    this.triggers.push(t);
    return t;
  }

  addEnemy(spawn) { this.enemySpawns.push(spawn); return spawn; }
  addFriend(spawn) { this.friendSpawns.push(spawn); return spawn; }

  addInteractable(obj) { this.interactables.push(obj); return obj; }

  addAnimated(fn) { this.animated.push(fn); }

  // ------------------------------------------------------------ particles
  spawnParticles({ pos, count = 14, color = 0xffffff, size = 0.08, speed = 3, life = 0.7, gravity = 4, additive = false, spread = 1 }) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z;
      vel.push(new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.3) * spread,
        (Math.random() - 0.5) * spread
      ).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8)));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color, size, transparent: true, opacity: 1, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      sizeAttenuation: true
    });
    const pts = new THREE.Points(geo, mat);
    this.group.add(pts);
    this.particles.push({ pts, vel, life, maxLife: life, gravity, positions, geo, mat });
    if (this.particles.length > 60) {
      const old = this.particles.shift();
      this.group.remove(old.pts);
      old.geo.dispose(); old.mat.dispose();
    }
  }

  spawnTracer(from, to, color = 0xffd070, life = 0.06) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z), new THREE.Vector3(to.x, to.y, to.z)
    ]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.group.add(line);
    this.particles.push({ pts: line, vel: null, life, maxLife: life, gravity: 0, geo, mat, isLine: true });
  }

  spawnSmokeColumn(pos, { color = 0x8a8a80, count = 26, life = 6 } = {}) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x + (Math.random() - 0.5) * 1.2;
      positions[i * 3 + 1] = pos.y + Math.random() * 1.2;
      positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 1.2;
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 0.6));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 1.5, transparent: true, opacity: 0.32, depthWrite: false, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat);
    this.group.add(pts);
    this.particles.push({ pts, vel, life, maxLife: life, gravity: -0.25, positions, geo, mat, looping: true });
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.isLine) {
        p.mat.opacity = Math.max(0, p.life / p.maxLife);
      } else {
        const arr = p.positions;
        for (let j = 0; j < p.vel.length; j++) {
          const v = p.vel[j];
          v.y -= p.gravity * dt;
          arr[j * 3] += v.x * dt;
          arr[j * 3 + 1] += v.y * dt;
          arr[j * 3 + 2] += v.z * dt;
          if (arr[j * 3 + 1] < 0.02) { arr[j * 3 + 1] = 0.02; v.multiplyScalar(0.35); v.y = Math.abs(v.y) * 0.2; }
        }
        p.geo.attributes.position.needsUpdate = true;
        p.mat.opacity = Math.max(0, Math.min(1, p.life / p.maxLife)) * (p.looping ? 0.4 : 1);
      }
      if (p.life <= 0 && !p.looping) {
        this.group.remove(p.pts);
        p.geo.dispose(); p.mat.dispose();
        this.particles.splice(i, 1);
      } else if (p.looping && p.life <= 0) {
        p.life = p.maxLife; // recycle smoke
        const arr = p.positions;
        for (let j = 0; j < p.vel.length; j++) {
          arr[j * 3] = p.pts.position.x + (Math.random() - 0.5) * 1.4;
          arr[j * 3 + 1] = p.pts.position.y + Math.random();
          arr[j * 3 + 2] = p.pts.position.z + (Math.random() - 0.5) * 1.4;
        }
      }
    }
  }

  update(dt, t) {
    this.updateParticles(dt);
    for (const fn of this.animated) fn(dt, t);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
}
