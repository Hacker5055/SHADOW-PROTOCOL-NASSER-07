/**
 * SHADOW PROTOCOL — Renderer
 * Unreal-inspired presentation on WebGL2:
 *  - ACES filmic tonemapping + physically-based exposure
 *  - Image-based lighting from a procedural gradient environment (Lumen-lite GI feel)
 *  - Cascaded shadow map (single hi-res directional + contact ambient)
 *  - Volumetric light shafts via additive cone meshes + exponential fog
 *  - Per-era post grade: 1973 = warm dust, halation, strong vignette, film grain
 *    modern = cool teal shadows, higher contrast, chromatic aberration, NOD
 */
import * as THREE from 'three';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.headless = !!globalThis.__SP_HEADLESS__;
    const renderer = this.headless ? makeHeadlessRenderer() : new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false
    });
    if (this.headless) {
      // Headless: keep the full object graph and update logic, skip GPU work.
      renderer.setPixelRatio(1);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = false;
    } else {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.info.autoReset = true;
    }
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.05, 900);
    this.scene.fog = new THREE.FogExp2(0xc8b48c, 0.0075);

    this.sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 220;
    this.sun.shadow.bias = -0.0007;
    this.sun.shadow.normalBias = 0.03;
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfd4e8, 0x6a5236, 1.0);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.22);
    this.scene.add(this.ambient);

    // ---------------------------------------------------------- view model
    // The first-person arms and weapon live in their own scene, drawn after the
    // world with the depth buffer cleared. Two reasons: the rig sits ~20 cm from
    // the eye and would be shredded by the world's 0.05 near plane, and this
    // scene needs its own tight fog/lighting so the weapon never sits in
    // silhouette against a bright sky.
    this.viewScene = new THREE.Scene();
    this.viewKey = new THREE.DirectionalLight(0xfff1d6, 1.55);
    this.viewKey.position.set(0.45, 1.0, 0.35);
    this.viewScene.add(this.viewKey);
    this.viewFill = new THREE.HemisphereLight(0xbcd2e8, 0x6b5738, 1.15);
    this.viewScene.add(this.viewFill);
    this.viewRim = new THREE.DirectionalLight(0xffd39a, 0.55);
    this.viewRim.position.set(-0.6, 0.2, -0.9);
    this.viewScene.add(this.viewRim);

    // Muzzle/point light pool for dynamic flashes
    this.flashLeft = 0;

    this._buildEnvironment();
    this._buildPost();

    this.time = 0;
    this.shake = { t: 0, amp: 0, freq: 20 };
    this.grade = 'modern';
    this.exposureTarget = 1.0;

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  _buildEnvironment() {
    // Procedural sky gradient -> PMREM environment for IBL
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#7fa6c9');
    g.addColorStop(0.45, '#cfd8d0');
    g.addColorStop(0.6, '#e8d3a8');
    g.addColorStop(1, '#8a7654');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    if (!this.headless) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envMap = pmrem.fromEquirectangular(t).texture;
      this.scene.environment = this.envMap;
      pmrem.dispose();
    }
    t.dispose();

    // Sky dome
    const skyGeo = new THREE.SphereGeometry(600, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x2f5d86) },
        mid: { value: new THREE.Color(0xb9c6c9) },
        bot: { value: new THREE.Color(0xd8c39a) },
        sunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3).normalize() },
        sunCol: { value: new THREE.Color(0xffd9a0) },
        haze: { value: 0.55 }
      },
      vertexShader: `varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
      fragmentShader: `
        uniform vec3 top, mid, bot, sunCol, sunDir; uniform float haze; varying vec3 vW;
        void main(){
          float h = clamp(vW.y*0.5+0.5, 0.0, 1.0);
          vec3 col = mix(bot, mid, smoothstep(0.42,0.58,h));
          col = mix(col, top, smoothstep(0.55,0.95,h));
          float sun = pow(max(dot(normalize(vW), normalize(sunDir)),0.0), 220.0);
          float glow = pow(max(dot(normalize(vW), normalize(sunDir)),0.0), 8.0);
          col += sunCol * (sun * 3.0 + glow * 0.35 * haze);
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    // Volumetric shafts: additive cones aligned with the sun
    this.shaftGroup = new THREE.Group();
    this.scene.add(this.shaftGroup);
  }

  _buildPost() {
    // Fullscreen post pass done with a second scene + ortho camera for the grade.
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType
    });
    this.postMat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: this.rt.texture },
        uTime: { value: 0 },
        uGrade: { value: 0 },
        uNVG: { value: 0 },
        uDamage: { value: 0 },
        uSupp: { value: 0 },
        uVignette: { value: 1 },
        uGrain: { value: 1 },
        uExposure: { value: 1 },
        uSat: { value: 1 },
        uFade: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0);} `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D tDiffuse; uniform float uTime, uGrade, uNVG, uDamage, uSupp, uVignette, uGrain, uExposure, uSat, uFade;
        uniform vec2 uResolution; varying vec2 vUv;

        vec3 hue(vec3 c){ float a=uNVG; vec3 g = vec3(dot(c, vec3(0.299,0.587,0.114))); return mix(c, g*vec3(0.32,1.35,0.42)*1.8, a); }

        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }

        void main(){
          vec2 uv = vUv;
          // chromatic aberration (stronger at edges)
          vec2 cdir = uv - 0.5;
          float ca = (0.0011 + uSupp*0.0016 + uDamage*0.0022) * dot(cdir,cdir) * 4.0;
          vec3 col;
          col.r = texture2D(tDiffuse, uv + cdir*ca).r;
          col.g = texture2D(tDiffuse, uv).g;
          col.b = texture2D(tDiffuse, uv - cdir*ca).b;

          col = hue(col) * uExposure;

          // era grade
          // uGrade 0 = modern (cool teal shadows, contrast)
          // uGrade 1 = 1973 (warm dust, halation, film)
          vec3 cool = vec3(0.94, 1.01, 1.08);
          vec3 warm = vec3(1.09, 1.0, 0.86);
          col *= mix(cool, warm, uGrade);
          // lift/gamma/gain
          float lift = mix(0.012, 0.035, uGrade);
          col = col + lift*(1.0-col);
          col = pow(col, vec3(mix(1.02, 0.95, uGrade)));
          float contrast = mix(1.1, 1.04, uGrade);
          col = (col - 0.5)*contrast + 0.5;

          // halation / bloom-lite on highlights (1973 film look)
          float lum = dot(col, vec3(0.2126,0.7152,0.0722));
          float hal = smoothstep(0.72, 1.0, lum) * mix(0.05, 0.16, uGrade);
          col += vec3(hal*1.1, hal*0.85, hal*0.6);

          float sat = uSat * mix(1.0, 0.82, uGrade);
          col = mix(vec3(lum), col, sat);

          // suppression: desaturate + darken + pulse
          float pulse = 0.5 + 0.5*sin(uTime*7.0);
          col = mix(col, vec3(dot(col,vec3(0.33))) * 0.55, uSupp*0.75);
          col *= 1.0 - uSupp*(0.22 + 0.06*pulse);

          // damage: red pulse + edge bleed
          float edge = smoothstep(0.1, 0.62, length(cdir)*1.55);
          col = mix(col, mix(vec3(0.45,0.03,0.03), col, 0.35), uDamage * edge * (0.55+0.45*pulse));

          // vignette
          float vig = smoothstep(0.95, 0.28, length(cdir)*mix(1.06,1.38,uGrade));
          col *= mix(1.0, vig, uVignette*0.85);

          // film grain
          float g = hash(uv*uResolution + fract(uTime)*137.0) - 0.5;
          col += g * mix(0.014, 0.045, uGrade) * uGrain;

          // scanline subtlety (NVG only)
          col *= 1.0 - uNVG*0.07*(0.5+0.5*sin(uv.y*uResolution.y*1.6));

          col = mix(col, vec3(0.0), clamp(uFade,0.0,1.0));
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
  }

  setEra(era) {
    this.grade = era;
    const g = era === '1973' ? 1 : 0;
    this.postMat.uniforms.uGrade.value = g;
    if (era === '1973') {
      this.scene.fog.color.setHex(0xc9b189);
      this.scene.fog.density = 0.0092;
      this.sun.color.setHex(0xffd6a0);
      this.sun.intensity = 2.9;
      this.hemi.color.setHex(0xc7d6e0);
      this.hemi.groundColor.setHex(0x7a5f3c);
      this.hemi.intensity = 0.85;
      this.sky.material.uniforms.top.value.setHex(0x35618c);
      this.sky.material.uniforms.mid.value.setHex(0xc3cbc4);
      this.sky.material.uniforms.bot.value.setHex(0xe0c79a);
      this.hemi.intensity = 0.9;
    } else {
      this.scene.fog.color.setHex(0x1b2b36);
      this.scene.fog.density = 0.014;
      this.sun.color.setHex(0x8fb3d4);
      this.sun.intensity = 1.5;
      this.hemi.color.setHex(0x4a6a86);
      this.hemi.groundColor.setHex(0x1b2430);
      this.hemi.intensity = 0.65;
      this.sky.material.uniforms.top.value.setHex(0x07121d);
      this.sky.material.uniforms.mid.value.setHex(0x1b3345);
      this.sky.material.uniforms.bot.value.setHex(0x2b3630);
    }
  }

  setSunDir(x, y, z) {
    this.sun.position.set(x * 90, y * 90, z * 90);
    this.sky.material.uniforms.sunDir.value.set(x, y, z).normalize();
  }

  followShadowTarget(pos) {
    this.sun.target.position.set(pos.x, pos.y, pos.z);
    this.sun.position.set(pos.x + 55, pos.y + 90, pos.z + 40);
  }

  addShake(amp) { this.shake.amp = Math.max(this.shake.amp, amp); this.shake.t = Math.max(this.shake.t, 0.28); }

  setNVG(v) { this.postMat.uniforms.uNVG.value = v; }
  setDamage(v) { this.postMat.uniforms.uDamage.value = v; }
  setSuppression(v) { this.postMat.uniforms.uSupp.value = v; }
  setFade(v) { this.postMat.uniforms.uFade.value = v; }
  setExposure(v) { this.exposureTarget = v; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.rt.setSize(Math.floor(w * this.renderer.getPixelRatio()), Math.floor(h * this.renderer.getPixelRatio()));
    this.postMat.uniforms.uResolution.value.set(w, h);
  }

  /** Attach the player's camera + arms + weapon to the view-model scene. */
  bindViewModel(viewCam, viewRoot) {
    this.viewCam = viewCam;
    this.viewRoot = viewRoot;
    // The arms/weapon rig is authored in VIEW SPACE — GRIP_POINTS, ARM_POSES and
    // the muzzle offsets are all metres in front of the eye. It has to stay a
    // child of the camera. `viewScene.add(viewRoot)` would reparent it to the
    // scene root and drop it at the origin, ~34 m behind the player, where it is
    // invisible. Only the camera needs to join the scene graph.
    if (viewCam && viewCam.parent !== this.viewScene) this.viewScene.add(viewCam);
    if (viewRoot && viewRoot.parent !== viewCam) viewCam.add(viewRoot);
  }

  render(dt, camOverride = null) {
    this.time += dt;
    if (this.headless) return;
    const cam = camOverride || this.camera;
    this.sky.position.copy(cam.position);

    let shakeOffset = [0, 0, 0];
    if (this.shake.t > 0) {
      this.shake.t -= dt;
      const k = this.shake.t * this.shake.amp;
      shakeOffset = [Math.sin(this.time * 47) * k, Math.cos(this.time * 39) * k, Math.sin(this.time * 31) * k];
      cam.position.x += shakeOffset[0];
      cam.position.y += shakeOffset[1];
      cam.position.z += shakeOffset[2];
      if (this.shake.t <= 0) this.shake.amp = 0;
    }

    this.postMat.uniforms.uTime.value = this.time;
    this.quadCam.position.copy(cam.position);
    this.quadCam.quaternion.copy(cam.quaternion);

    const pr = this.renderer.getPixelRatio();

    // The sky dome is a 600 m sphere centred on the camera so it can double as a
    // horizon. The view camera only reaches 60 m, which clipped it away and left
    // a flat black void above the terrain: the pass has to run with a far plane
    // long enough to contain the dome.
    const worldFar = cam.far;
    cam.far = 900;
    cam.updateProjectionMatrix();
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, cam);
    this.renderer.setRenderTarget(null);
    cam.far = worldFar;
    cam.updateProjectionMatrix();
    void pr;

    this.renderer.render(this.quadScene, this.quadCam);

    // First-person arms and weapon, on top, with depth cleared so nothing in the
    // world can poke through them.
    //
    // autoClear MUST be off for this pass. The renderer defaults it to true, and
    // a `render()` with autoClear on clears the colour buffer before drawing —
    // so this call was wiping out the entire composited image above and leaving
    // only the arms on black. clearDepth() already handles the depth buffer; the
    // colour buffer must survive.
    if (this.viewCam && this.viewRoot) {
      const autoClear = this.renderer.autoClear;
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.viewScene, this.viewCam);
      this.renderer.autoClear = autoClear;
    }

    if (this.shake.t > 0) {
      cam.position.x -= shakeOffset[0];
      cam.position.y -= shakeOffset[1];
      cam.position.z -= shakeOffset[2];
    }
  }



  dispose() {
    this.rt.dispose();
    this.postMat.dispose();
    this.renderer.dispose();
  }
}

/**
 * A no-op stand-in for WebGLRenderer used by the headless simulation harness
 * (tools/simtest.mjs). It preserves the API surface the engine touches so all
 * non-rendering systems behave exactly as they do in the browser.
 */
function makeHeadlessRenderer() {
  return {
    domElement: null,
    shadowMap: { enabled: true, type: 0 },
    info: { autoReset: true, render: {}, memory: {} },
    toneMapping: 0,
    toneMappingExposure: 1,
    outputColorSpace: '',
    autoClear: true,
    capabilities: { isWebGL2: true, maxTextureSize: 4096 },
    setPixelRatio() {},
    getPixelRatio() { return 1; },
    setSize() {},
    setRenderTarget() {},
    clearDepth() {},
    render() {},
    compile() {},
    dispose() {},
    getRenderTarget() { return null; }
  };
}
