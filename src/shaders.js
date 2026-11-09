import * as THREE from 'three';

/**
 * Custom GLSL Shader for Earth with Day/Night dynamic blending,
 * twilight scattering, ocean specular glint, and atmospheric limb fresnel.
 */
export function createEarthMaterial(dayTexture, nightTexture, specularTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      dayTexture: { value: dayTexture },
      nightTexture: { value: nightTexture },
      specularTexture: { value: specularTexture },
      sunWorldPosition: { value: new THREE.Vector3(0, 0, 0) },
      sunRadiusWorld: { value: 1.15 },
      moonWorldPosition: { value: new THREE.Vector3(0, 0, 0) },
      moonRadiusWorld: { value: 0.2725 },
      atmosphereColor: { value: new THREE.Color(0x60a5fa) },
      twilightColor: { value: new THREE.Color(0xf97316) },
    },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D dayTexture;
      uniform sampler2D nightTexture;
      uniform sampler2D specularTexture;
      uniform vec3 sunWorldPosition;
      uniform float sunRadiusWorld;
      uniform vec3 moonWorldPosition;
      uniform float moonRadiusWorld;
      uniform vec3 atmosphereColor;
      uniform vec3 twilightColor;

      varying vec3 vWorldNormal;
      varying vec2 vUv;
      varying vec3 vWorldPosition;

      void main() {
        #include <logdepthbuf_fragment>
        vec3 worldNormal = normalize(vWorldNormal);
        vec3 worldViewDir = normalize(cameraPosition - vWorldPosition);
        vec3 toSun = sunWorldPosition - vWorldPosition;
        float distSun = length(toSun);
        vec3 worldLightDir = toSun / max(distSun, 0.0001);

        // Sun incident cosine in world space
        float sunDot = dot(worldNormal, worldLightDir);

        // Textures
        vec4 dayColor = texture2D(dayTexture, vUv);
        vec4 nightColor = texture2D(nightTexture, vUv);
        vec4 specMask = texture2D(specularTexture, vUv);

        // Day / Night transition smoothstep between -0.12 (night) and 0.08 (day)
        float dayFactor = smoothstep(-0.12, 0.08, sunDot);

        vec3 cityLights = nightColor.rgb * 2.2;
        vec3 mixedDayNight = mix(cityLights, dayColor.rgb, dayFactor);

        // Specular reflection on water (only where sun shines)
        if (sunDot > 0.0 && specMask.r > 0.5) {
          vec3 halfVector = normalize(worldLightDir + worldViewDir);
          float specFactor = pow(max(0.0, dot(worldNormal, halfVector)), 32.0);
          mixedDayNight += vec3(1.0, 0.95, 0.8) * specFactor * 0.6 * dayFactor;
        }

        // Solar Eclipse Umbra/Penumbra shadow spot projected on Earth daylight surface
        vec3 toMoon = moonWorldPosition - vWorldPosition;
        float distMoon = length(toMoon);
        if (distMoon < distSun) {
          vec3 dirMoon = toMoon / max(distMoon, 0.0001);
          float sunMoonCos = dot(worldLightDir, dirMoon);
          if (sunMoonCos > 0.95) {
            float angSep = acos(clamp(sunMoonCos, -1.0, 1.0));
            float moonAngRadius = moonRadiusWorld / max(distMoon, 0.0001);
            float sunAngRadius = sunRadiusWorld / max(distSun, 0.0001);
            float penumbraEdge = sunAngRadius + moonAngRadius;
            float umbraEdge = abs(sunAngRadius - moonAngRadius);
            if (angSep < penumbraEdge) {
              float shadowIntensity = 1.0 - smoothstep(umbraEdge * 0.6, penumbraEdge, angSep);
              mixedDayNight *= (1.0 - 0.96 * shadowIntensity * dayFactor);
            }
          }
        }

        // Fresnel atmospheric rim glow (delicate Rayleigh blue on sunlit limb)
        float fresnel = 1.0 - max(0.0, dot(worldNormal, worldViewDir));
        fresnel = pow(fresnel, 3.8);
        float atmoSunLit = smoothstep(0.02, 0.25, sunDot);
        vec3 atmoGlow = atmosphereColor * fresnel * 0.75 * atmoSunLit;

        gl_FragColor = vec4(mixedDayNight + atmoGlow, 1.0);
      }
    `
  });
}

/**
 * Earth Atmosphere Outer Halo Shader
 */
export function createAtmosphereHaloMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      sunWorldPosition: { value: new THREE.Vector3(0, 0, 0) },
      atmosphereColor: { value: new THREE.Color(0x38bdf8) },
      twilightColor: { value: new THREE.Color(0xf97316) }
    },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 sunWorldPosition;
      uniform vec3 atmosphereColor;
      uniform vec3 twilightColor;

      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        #include <logdepthbuf_fragment>
        vec3 worldNormal = normalize(vWorldNormal);
        vec3 worldViewDir = normalize(cameraPosition - vWorldPosition);
        vec3 worldLightDir = normalize(sunWorldPosition - vWorldPosition);
        float sunDot = dot(worldNormal, worldLightDir);

        // Atmospheric rim fresnel for BackSide shell
        float viewDot = clamp(dot(worldNormal, worldViewDir), -1.0, 1.0);
        float rim = 1.0 - abs(viewDot);
        float intensity = pow(rim, 3.5);

        // Atmosphere scattering is illuminated only on the sunlit hemisphere
        float sunLit = smoothstep(0.02, 0.25, sunDot);
        vec3 color = atmosphereColor;
        float alpha = intensity * sunLit * 0.25;

        gl_FragColor = vec4(color, alpha);
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false
  });
}

/**
 * Photorealistic Moon Material with Lommel-Seeliger regolith scattering,
 * Earthshine on the night side, and Earth atmospheric refracted umbra (Blood Moon).
 */
export function createMoonMaterial(moonTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      moonTexture: { value: moonTexture },
      sunWorldPosition: { value: new THREE.Vector3(0, 0, 0) },
      earthWorldPosition: { value: new THREE.Vector3(0, 0, 0) },
      earthRadiusWorld: { value: 1.0 },
      sunRadiusWorld: { value: 4.5 },
      earthPhaseFactor: { value: 0.5 },
      earthshineColor: { value: new THREE.Color(0x78a6db) }
    },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D moonTexture;
      uniform vec3 sunWorldPosition;
      uniform vec3 earthWorldPosition;
      uniform float earthRadiusWorld;
      uniform float sunRadiusWorld;
      uniform float earthPhaseFactor;
      uniform vec3 earthshineColor;

      varying vec3 vWorldNormal;
      varying vec2 vUv;
      varying vec3 vWorldPosition;

      void main() {
        #include <logdepthbuf_fragment>
        vec3 worldNormal = normalize(vWorldNormal);
        vec3 worldViewDir = normalize(cameraPosition - vWorldPosition);
        vec3 toSun = sunWorldPosition - vWorldPosition;
        float distSun = length(toSun);
        vec3 worldSunDir = toSun / max(distSun, 0.0001);

        vec3 toEarth = earthWorldPosition - vWorldPosition;
        float distEarth = length(toEarth);
        vec3 worldEarthDir = toEarth / max(distEarth, 0.0001);

        vec4 albedo = texture2D(moonTexture, vUv);

        // Lommel-Seeliger / Hapke Reflectance Model
        float mu0 = max(0.0, dot(worldNormal, worldSunDir));
        float mu = max(0.0, dot(worldNormal, worldViewDir));
        float ls = mu0 / max(0.0001, mu0 + mu);
        float directLight = mix(mu0, ls * 1.8, 0.65);

        // Check Earth Shadow during Lunar Eclipse (Blood Moon)
        vec3 earthToMoon = vWorldPosition - earthWorldPosition;
        vec3 earthToSun = sunWorldPosition - earthWorldPosition;
        float distEarthToSun = length(earthToSun);
        vec3 dirSunEarth = -earthToSun / max(distEarthToSun, 0.0001);

        float shadowFactor = 1.0;
        vec3 bloodMoonGlow = vec3(0.0);

        float projOnShadowAxis = dot(earthToMoon, dirSunEarth);
        if (projOnShadowAxis > 0.0) {
          vec3 shadowAxisPt = dirSunEarth * projOnShadowAxis;
          float distToAxis = length(earthToMoon - shadowAxisPt);

          float sunAng = sunRadiusWorld / max(distEarthToSun, 0.0001);
          float earthAng = earthRadiusWorld / max(projOnShadowAxis, 0.0001);
          float penumbraR = (earthAng + sunAng) * projOnShadowAxis;
          float umbraR = max(0.0, (earthAng - sunAng) * projOnShadowAxis);

          if (distToAxis < penumbraR) {
            float penumbraFactor = smoothstep(umbraR, penumbraR, distToAxis);
            shadowFactor = mix(0.05, 1.0, penumbraFactor);

            if (distToAxis < umbraR * 1.25) {
              float umbraDepth = 1.0 - smoothstep(0.0, umbraR * 1.25, distToAxis);
              bloodMoonGlow = vec3(0.65, 0.16, 0.05) * albedo.rgb * umbraDepth * 0.45;
            }
          }
        }

        // Earthshine on night side
        float earthDot = max(0.0, dot(worldNormal, worldEarthDir));
        float nightFactor = 1.0 - smoothstep(0.0, 0.12, mu0);
        vec3 earthshine = earthshineColor * albedo.rgb * earthDot * earthPhaseFactor * nightFactor * 0.28;

        vec3 ambient = albedo.rgb * 0.035;
        vec3 finalColor = albedo.rgb * directLight * shadowFactor + bloodMoonGlow + earthshine + ambient;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
  });
}

/**
 * Sun Photosphere Shader with limb darkening
 */
export function createSunMaterial(sunTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      sunTexture: { value: sunTexture },
      uTime: { value: 0 }
    },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D sunTexture;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        #include <logdepthbuf_fragment>
        // Limb darkening: solar intensity falls off towards edge
        float mu = max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
        // Solar limb darkening approximation: I(mu) = I0 * (0.4 + 0.6 * mu)
        float limbDarkening = 0.45 + 0.55 * pow(mu, 0.6);

        // Slight texture pulsation / flow
        vec2 flowUv = vUv + vec2(sin(uTime * 0.05 + vUv.y * 10.0) * 0.003, 0.0);
        vec4 texColor = texture2D(sunTexture, flowUv);

        vec3 emissive = texColor.rgb * limbDarkening * 1.35;
        // Hot core tint
        emissive += vec3(0.15, 0.1, 0.0) * pow(mu, 2.0);

        gl_FragColor = vec4(emissive, 1.0);
      }
    `
  });
}

/**
 * Sun Corona Radial Glow Sprite Material
 */
export function createSunCoronaMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(256, 256, 120, 256, 256, 256);
  grad.addColorStop(0, 'rgba(255, 240, 180, 0.95)');
  grad.addColorStop(0.25, 'rgba(255, 170, 50, 0.55)');
  grad.addColorStop(0.55, 'rgba(255, 90, 10, 0.22)');
  grad.addColorStop(0.85, 'rgba(180, 30, 0, 0.06)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  return new THREE.SpriteMaterial({
    map: texture,
    color: 0xffe6aa,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });
}
