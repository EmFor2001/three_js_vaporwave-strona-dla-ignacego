import { Canvas, useFrame, useThree, extend, useLoader } from "@react-three/fiber";
import {
  PerspectiveCamera,
  OrbitControls,
  useTexture,
} from "@react-three/drei";
import Head from "next/head";
import React, { useEffect } from "react";
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
    <mesh position={[0, 0.3, -3.4]}>
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
  const terrain3Ref = React.useRef();
  // const terrain4Ref = React.useRef();

  useFrame((state) => {
    // Update plane position
    terrain1Ref.current.position.z = (state.clock.elapsedTime * 0) % 2;
    terrain2Ref.current.position.z = ((state.clock.elapsedTime * 0) % 2) - 2;
    terrain3Ref.current.position.z = ((state.clock.elapsedTime * 0) % 2) + 2;
    // terrain4Ref.current.position.z = ((state.clock.elapsedTime * 0) % 2) - 6;
    
  });

  return (
    <>
      <Terrain ref={terrain1Ref} z={0} />
      <Terrain ref={terrain2Ref} z={-2} />
      <Terrain ref={terrain3Ref} z={2} />
      {/* <Terrain ref={terrain4Ref} z={-6} /> */}

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

  // spotlight1Ref.current?.target.position.set([-0.25, 0.25, 0.25]);
  // spotlight2Ref.current?.target.position.set([0.25, 0.25, 0.25]);

  return (
    <>
      <spotLight
        ref={spotlight1Ref}
        color="#ffffff"
        intensity={40}
        position={[0, 0.75, 4.1]}
        distance={25}
        angle={Math.PI * 0.1}
        penumbra={0.25}
        decay={10}
      />
      <spotLight
        ref={spotlight2Ref}
        color="#ffffff"
        intensity={40}
        position={[0, 0.75, 4.1]}
        distance={25}
        angle={Math.PI * 0.1}
        penumbra={0.25}
        decay={10}
      />
    </>
  );
};


const Foo = (props) => {
  const { camera } = useThree();
  const { scroll } = props;
  
  useEffect(() => {
  camera.position.set(0, 0.1, (-2.4+(scroll * 0.003)));
  }, [scroll]);

  return ( 
    <>
    </>
  );
}

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
  const { scroll } = props;

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
              position={[0, 0.1, -2.4]}
              fov={75}
              near={0.01}
              far={20}
            />
            <Light />
            <Landscape />
            <Effects />
            <Foo scroll={scroll}/>
            {/* <Cube /> */}
            <LogoObject />
          </React.Suspense>
        </Canvas>
      )}
    </>
  );
};

export default function Home() {
  const [scroll, setScroll] = React.useState(0);

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
        <div className="label-container"
          onScroll={(e) => {
            setScroll(e.currentTarget.scrollTop);
          }}
        >
          <div className="backdrop">
          </div>
          <p className="text">
            Lorem, ipsum dolor sit amet consectetur adipisicing elit. Suscipit, distinctio. Cum ex tenetur expedita atque porro voluptas iure consequuntur odio repellat aperiam similique earum iste possimus molestiae neque, placeat maxime.
            Lorem ipsum dolor sit amet consectetur, adipisicing elit. Expedita harum temporibus voluptate eos optio minima cupiditate quaerat nulla! Dolores consectetur repudiandae aut exercitationem illum repellat blanditiis, laudantium optio laboriosam molestias.
            Lorem ipsum dolor sit, amet consectetur adipisicing elit. Amet magnam labore quod qui laudantium est sunt, alias saepe. Qui quos suscipit aperiam cumque nemo ipsam laborum vel rerum est id.
          </p>
        </div>
        <Scene scroll={scroll}/>
      </main>
    </div>
  );
}
