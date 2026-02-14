import React, { useRef, useState, useMemo, useEffect, useId } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { shaderMaterial, View } from '@react-three/drei';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';
import { useLiquidGlass } from '../../context/LiquidGlassContext';

// 1. Define the Shader Material
const LiquidGlassBackgroundMaterial = shaderMaterial(
    {
        uMouse: new THREE.Vector2(0.5, 0.5),
        uHover: 0,
        uCanvasPos: new THREE.Vector2(0, 0),
        uCanvasSize: new THREE.Vector2(300, 400),
        uPixelRatio: 1,
        uScroll: 0,
        uRadius: 30.0, // Default radius matching CSS
    },
    // Vertex Shader
    `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
    // Fragment Shader
    `
    uniform vec2 uMouse;
    uniform float uHover;
    uniform vec2 uCanvasPos;
    uniform vec2 uCanvasSize;
    uniform float uPixelRatio;
    uniform float uScroll;
    uniform float uRadius;
    varying vec2 vUv;

    // Procedural Grid Function
    vec3 getGrid(vec2 uv) {
        // Grid settings to match subtle CSS grid
        float scale = 10.0; // Adjust frequency
        vec2 grid = fract(uv * scale);
        float lineThickness = 0.02;
        float lines = step(1.0 - lineThickness, grid.x) + step(1.0 - lineThickness, grid.y);
        
        // Dark background color
        vec3 baseColor = vec3(0.03, 0.04, 0.07); 
        // White lines with low opacity
        vec3 lineColor = vec3(1.0);
        float lineOpacity = 0.1;
        
        return mix(baseColor, lineColor, lines * lineOpacity);
    }

    // SDF for Rounded Box
    float sdRoundedBox(in vec2 p, in vec2 b, in float r) {
        vec2 q = abs(p) - b + r;
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
    }

    void main() {
      vec2 uv = vUv;
      
      // --- ROUNDED CORNER MASKING ---
      vec2 pixelPos = uv * uCanvasSize;
      vec2 centerPos = pixelPos - (uCanvasSize * 0.5);
      vec2 halfSize = uCanvasSize * 0.5;
      
      float dist = sdRoundedBox(centerPos, halfSize, uRadius);
      float alpha = 1.0 - smoothstep(-1.0, 0.5, dist);
      
      if (alpha <= 0.0) discard;

      // --- DISTORTION CALCULATION ---
      float distFromEdgePixels = max(-dist, 0.0);
      
      // Edge effect zone (40px)
      float distortionStrength = smoothstep(40.0, 0.0, distFromEdgePixels);
      
      vec2 center = vec2(0.5);
      vec2 dir = normalize(uv - center);
      
      // Ripple effect
      float ripple = sin(distFromEdgePixels * 0.1 - uScroll * 0.03) * 0.05;
      
      // Distortion vector
      vec2 distortionOffset = dir * (distortionStrength * 0.2 + ripple * distortionStrength * 2.0);
      
      // --- SCREEN SPACE MAPPING ---
      // Use absolute screen coordinates for the background grid
      vec2 cssPixel = gl_FragCoord.xy / uPixelRatio;
      
      // Apply distortion to the screen lookup
      // Scale distortion by arbitrary factor to make it visible in pixels
      vec2 distortedPixel = cssPixel - (distortionOffset * 400.0);
      
      // Map to Grid UVs (400px = 10 grid cells matches CSS 40px grid)
      vec2 bgUv = vec2(
        distortedPixel.x / 400.0,
        distortedPixel.y / 400.0 
      );
      
      vec3 bgColor = getGrid(bgUv);
      
      // --- COMPOSITION ---
      vec3 finalColor = bgColor;
      
      // Tint
      finalColor = mix(finalColor, vec3(0.2, 0.3, 0.3), 0.1);
      
      // --- LIGHTING ---
      vec2 lightDir = normalize(vec2(-1.0, 1.0));
      
      // Edge Highlight
      float edgeAngle = dot(dir, lightDir);
      float specular = max(edgeAngle, 0.0);
      specular = pow(specular, 2.0);
      
      float directionalHighlight = smoothstep(10.0, 0.0, distFromEdgePixels) * specular * 0.15;
      finalColor += directionalHighlight;
      
      // Fresnel
      float fresnel = smoothstep(5.0, 0.0, distFromEdgePixels) * 0.05;
      finalColor += fresnel;
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
);

extend({ LiquidGlassBackgroundMaterial });

import { OrthographicCamera } from '@react-three/drei';

export const CardScene = ({ track }) => {
    const materialRef = useRef();
    const meshRef = useRef();
    const [hovered, setHover] = useState(false);
    const { size } = useThree(); // size is the canvas size in pixels

    useFrame((state, delta) => {
        if (!track?.current || !meshRef.current || !materialRef.current) return;

        // 1. Measure DOM Element
        const rect = track.current.getBoundingClientRect();

        // 2. Update Mesh Position & Scale (Pixel Coordinates)
        // Orthographic Camera (0,0 at center) with zoom=1 means units = pixels? 
        // We need to configure the camera to match pixels.
        // If camera left=-width/2, right=width/2, top=height/2, bottom=-height/2

        const width = size.width;
        const height = size.height;

        // Calculate center of the card relative to center of screen
        const x = rect.left + rect.width / 2 - width / 2;
        const y = -(rect.top + rect.height / 2 - height / 2); // Invert Y

        meshRef.current.position.set(x, y, 0);
        meshRef.current.scale.set(rect.width, rect.height, 1);

        // 3. Update Shader Uniforms
        materialRef.current.uHover = THREE.MathUtils.lerp(
            materialRef.current.uHover,
            hovered ? 1 : 0,
            delta * 5
        );

        // Pass exact pixel dimensions for SDF
        materialRef.current.uCanvasSize.set(rect.width, rect.height);

        // Pass screen position for grid alignment
        // uCanvasPos needs to be top-left in window coordinates (y down)
        // The shader uses this to reconstruct viewportX/Y
        materialRef.current.uCanvasPos.set(rect.left, rect.top);

        materialRef.current.uPixelRatio = state.gl.getPixelRatio();
        materialRef.current.uScroll = window.scrollY;
    });

    return (
        <mesh
            ref={meshRef}
            onPointerOver={() => setHover(true)}
            onPointerOut={() => setHover(false)}
        >
            <planeGeometry args={[1, 1]} /> {/* Unit plane, scaled by mesh.scale */}
            <liquidGlassBackgroundMaterial
                ref={materialRef}
                transparent
            />
        </mesh>
    );
};

const LiquidGlassBackground = () => {
    const ref = useRef(null);
    const id = useId();
    const { registerView, unregisterView } = useLiquidGlass();

    useEffect(() => {
        if (ref.current) {
            registerView(id, ref, CardScene);
        }
        return () => unregisterView(id);
    }, [id, registerView, unregisterView]);

    return (
        <div
            ref={ref}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: -1,
                borderRadius: '30px',
                // overflow: 'hidden', // View handles clipping usually
                pointerEvents: 'none'
            }}
        />
    );
};

export const LiquidGlassGlobalCanvas = () => {
    const { views } = useLiquidGlass();

    return (
        <Canvas
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
                zIndex: 0,
            }}
            eventSource={document.body}
            orthographic
            camera={{ position: [0, 0, 10], zoom: 1 }}
        >
            {/* 
               We need to update the camera frustum to match window size in pixels.
               R3F's ResizeContainer handles this for perspective, but for Orthographic to match pixels 1:1:
               We can use a simple effect to update camera.
            */}
            <PixelPerfectCamera />

            {views.map(({ id, ref }) => (
                <CardScene key={id} track={ref} />
            ))}
        </Canvas>
    );
};

const PixelPerfectCamera = () => {
    const { camera, size, set } = useThree();

    useEffect(() => {
        if (camera.isOrthographicCamera) {
            camera.left = -size.width / 2;
            camera.right = size.width / 2;
            camera.top = size.height / 2;
            camera.bottom = -size.height / 2;
            camera.updateProjectionMatrix();
        }
    }, [camera, size]);

    return null;
};

export default LiquidGlassBackground;
