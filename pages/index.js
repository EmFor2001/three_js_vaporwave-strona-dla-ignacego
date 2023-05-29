import { Canvas, useFrame, useThree, extend, useLoader } from "@react-three/fiber";
import {
  PerspectiveCamera,
  OrbitControls,
  useTexture,
} from "@react-three/drei";
import Head from "next/head";
import React, { useEffect } from "react";
import styled from "styled-components";
import {
  EffectComposer,
  GammaCorrectionShader,
  RGBShiftShader,
  RenderPass,
  ShaderPass,
  UnrealBloomPass,
} from "three-stdlib";
import { MeshStandardMaterial } from "three";
import CustomShaderMaterial from "three-custom-shader-material";
import { TextureLoader } from 'three/src/loaders/TextureLoader'

const fragmentShader = `
float aastep(in float threshold, in float value) {
  float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
  return 1.0 - smoothstep(threshold-afwidth, threshold+afwidth, value);
}

void main() {
  float lw = 1.0;
  float w;

  float gx = 1.0 + cos(vUv.x * 24.0 * 2.0 * PI - PI);
  w = fwidth(vUv.x) * lw;
  gx = aastep(w, gx);

  float gy = 1.0 + cos(vUv.y * 24.0 * 2.0 * PI - PI);
  w = fwidth(vUv.y) * lw;
  gy = aastep(w, gy);

  float grid = gx + gy;
  
  csm_DiffuseColor = vec4(grid, grid * 0.3, grid * 0.5, 1.0);
}
`;

/**
 * Lots of great examples on how to handle effects are available at: https://onion2k.github.io/r3f-by-example
 */

// Read more about extend at https://docs.pmnd.rs/react-three-fiber/api/objects#using-3rd-party-objects-declaratively
extend({ EffectComposer, RenderPass, ShaderPass, UnrealBloomPass });

/**
 * This component renders the terrain composed of:
 * - a plane geometry
 * - a mesh standard material where we added:
 *   - a displacementMap for the topography
 *   - a texture for the grid
 *   - a metalnessMap for the reflective parts
 */
const Terrain = React.forwardRef((props, ref) => {
  const { z } = props;
  const materialRef = React.useRef();

  const [heightTexture, metalnessTexture] = useTexture([
    "displacement-7.png",
    "metalness-2.png",
  ]);

  return (
    <mesh ref={ref} position={[0, 0, z]} rotation={[-Math.PI * 0.5, 0, 0]}>
      <planeBufferGeometry arrach="geometry" args={[1, 2, 24, 24]} />
      <CustomShaderMaterial
        ref={materialRef}
        baseMaterial={MeshStandardMaterial}
        fragmentShader={fragmentShader}
        displacementMap={heightTexture}
        displacementScale={0.4}
        metalnessMap={metalnessTexture}
        metalness={0.9}
        roughness={0.5}
      />
    </mesh>
  );
});

Terrain.displayName = "Terrain";

// const Cube = () => {
//   const texture = useLoader(TextureLoader, 'logo_jetskipsd.png');

//   return (
//     <mesh position={[0, 0.2, -3]}>
//       <boxBufferGeometry attach="geometry" args={[0.3, 0.3, 0.3]} />
//       <meshStandardMaterial attach="material" map={texture} />
//     </mesh>
//   );
// };

const LogoObject = () => {
  const texture = useLoader(TextureLoader, 'logo_jetskipsd.png');

  return (
    <mesh position={[0, 0.5, 0]}>
      <planeBufferGeometry attach="geometry" args={[1.1, 1]} />
      <meshBasicMaterial attach="material" map={texture} transparent />
    </mesh>
  );
};

/**
 * This component renders the landscape:
 * - 2 Terrains behing one one another
 * - each terrain moves along the z axis creating an "endless moving animation"
 */
const Landscape = () => {
  const terrain1Ref = React.useRef();
  const terrain2Ref = React.useRef();

  useFrame((state) => {
    // Update plane position
    terrain1Ref.current.position.z = (state.clock.elapsedTime * 0.1) % 2;
    terrain2Ref.current.position.z = ((state.clock.elapsedTime * 0.1) % 2) - 2;
  });

  return (
    <>
      <Terrain ref={terrain1Ref} z={0} />
      <Terrain ref={terrain2Ref} z={-2} />
    </>
  );
};

/**
 * This component renders the post-processing effects we're using for this scene:
 * - a RGBShift
 * - an UnrealBloom pass
 * - a GammaCorrection to fix the colors
 *
 * Note: I had to set the Canvas linear prop to true to make effects work!
 * See the canva API for more info: https://docs.pmnd.rs/react-three-fiber/api/canvas
 */
const Effects = () => {
  const composerRef = React.useRef();
  const rgbShiftRef = React.useRef();
  const { gl, scene, camera, size } = useThree();

  React.useEffect(() => {
    composerRef?.current.setSize(size.width, size.height);
  }, [size]);

  useFrame(() => {
    if (rgbShiftRef.current) {
      rgbShiftRef.current.uniforms["amount"].value = 0.0012;
    }
    composerRef.current.render();
  }, 1);

  return (
    <effectComposer ref={composerRef} args={[gl]}>
      <renderPass attachArray="passes" scene={scene} camera={camera} />
      <shaderPass
        ref={rgbShiftRef}
        attachArray="passes"
        args={[RGBShiftShader]}
      />
      <shaderPass attachArray="passes" args={[GammaCorrectionShader]} />
      <unrealBloomPass
        attachArray="passes"
        args={[size.width / size.height, 0.2, 0.8, 0]}
      />
    </effectComposer>
  );
};

/**
 * This component renders the Light of the scene which is composed of:
 * - 2 spotlights of high intensity positioned right behind the camera
 * - each spotlight aims at a specific target on opposite sides of the landscapes
 */
const Light = () => {
  const spotlight1Ref = React.useRef();
  const spotlight2Ref = React.useRef();

  spotlight1Ref.current?.target.position.set([-0.25, 0.25, 0.25]);
  spotlight2Ref.current?.target.position.set([0.25, 0.25, 0.25]);

  return (
    <>
      <spotLight
        ref={spotlight1Ref}
        color="#ff068c"
        intensity={10}
        position={[0.5, 0.75, 2.1]}
        distance={25}
        angle={Math.PI * 0.1}
        penumbra={0.25}
        decay={10}
      />
      <spotLight
        ref={spotlight2Ref}
        color="#ff068c"
        intensity={10}
        position={[-0.5, 0.75, 2.1]}
        distance={25}
        angle={Math.PI * 0.1}
        penumbra={0.25}
        decay={10}
      />
    </>
  );
};

/**
 * This component renders the scene which renders all the components declared above and more:
 * - the moving landscape
 * - the lights
 * - the effect
 * - a black background color
 * - a black fog towards the back of the scene to hide the second terrain showing up every now and then when it appears
 * - orbit controls to play with (it helps a lot during development to drag, rotate objects in the scene)
 * - the perspective camera (our default camera thanks to the makeDefault prop)
 *
 *
 * Note:
 * I used this useEffect / isMounted trick to make sure Next.js doesn't make the scene
 * crash due to the lack of "window". Not the best, but it works. At least we have access to the
 * device pixel ratio immediately when the scene appears the first time.
 *
 */
const Scene = (props) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {!mounted ? null : (
        <Canvas
          style={{
            position: "absolute",
            display: "block",
            top: 0,
            left: 0,
            zIndex: -100,
            outline: "none",
          }}
          dpr={Math.min(window.devicePixelRatio, 2)}
          linear
          antialias
        >
          <React.Suspense fallback={null}>
            <color attach="background" args={["#000000"]} />
            <fog attach="fog" args={["#000000", 1, 2.5]} />
            {/* <OrbitControls attach="orbitControls" /> */}
            <PerspectiveCamera
              makeDefault
              position={[0, 0.11, 1.1]}
              fov={90}
              near={0.01}
              far={20}
            />
            <Light />
            <Landscape />
            <Effects />
            {/* <Cube /> */}
            {/* <LogoObject /> */}
          </React.Suspense>
        </Canvas>
      )}
    </>
  );
};

export default function Home() {
  return (
    <div>
      <Head>
        <title>Linear - React-Three-Fiber</title>
        <meta
          name="description"
          content="A reversed-engineer versioned of the WebGL animation from the Linear 2021 release page. Recreated by @MaximeHeckel"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <div className="animation__content__container">
          <img className="logo__jetski" src="/logo_jetskipsd.png" alt="" />
          <a href="./#intro__section" className="arrow"><img src="/circle-down-solid.svg" alt="" /></a>
        </div>
        <div className="content__container">
          <section className="intro__section" id="intro__section">
            <div className="intro__img__container">
              <img className="intro__img" src="/jetski.webp" alt="" />
            </div>
            <div className="intro__text__container">
              <h1 className="intro__title">O nas</h1>
              <p className="intro__text">
                Oferujemy wynajem skuterów wodnych, na terenie całego trójmiasta wraz z dowozem sprzętu.
                Nasze skutery wodne podlegają regularnym przeglądom technicznym, dzięki czemu możemy zagwarantować bezpieczeństwo i komfort podczas jazdy.
              </p>
            </div>
          </section>

          <section className="table__container">
            <div className="table__content">
              <h1 className="table__title">Cennik</h1>
              <table className="table">
                <tr>
                  <th>Czas</th>
                  <th>Cena</th>
                </tr>
                <tr>
                  <td>1h</td>
                  <td>300zł</td>
                </tr>
                <tr>
                  <td>24h</td>
                  <td>600zł</td>
                </tr>
                <tr>
                  <td>3 - 9 dni</td>
                  <td>500zł / doba</td>
                </tr>
                <tr>
                  <td>10+ dni</td>
                  <td>460zł / doba</td>
                </tr>
              </table>
            </div>
          </section>
        </div>
        <Scene/>
      </main>
    </div>
  );
}
