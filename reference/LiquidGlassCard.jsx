import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { RenderTexture, Text, PerspectiveCamera, shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';
import leavesBg from '../assets/leaves.svg';

// 1. Define the Shader Material
const LiquidGlassMaterial = shaderMaterial(
    {
        uContentTexture: new THREE.Texture(),
        uBgTexture: new THREE.Texture(),
        uMouse: new THREE.Vector2(0.5, 0.5),
        uHover: 0,
        uCanvasPos: new THREE.Vector2(0, 0), // Position of canvas on screen
        uCanvasSize: new THREE.Vector2(300, 400), // Size of canvas
        uPixelRatio: 1, // Add pixel ratio for Retina screens
        uScroll: 0,
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
    uniform sampler2D uContentTexture;
    uniform sampler2D uBgTexture;
    uniform vec2 uMouse;
    uniform float uHover;
    uniform vec2 uCanvasPos;
    uniform vec2 uCanvasSize;
    uniform float uPixelRatio;
    uniform float uScroll;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      
      // --- DISTORTION CALCULATION ---
      vec2 distFromEdge = min(uv, 1.0 - uv);
      float edgeDist = min(distFromEdge.x, distFromEdge.y);
      
      // Smoother transition at edges
      // Reduced width by 1/3 (0.15 -> 0.10)
      float distortionStrength = smoothstep(0.10, 0.0, edgeDist);
      
      vec2 center = vec2(0.5);
      vec2 dir = normalize(uv - center);
      
      // Smoother, lower frequency ripple for elegance
      // Reduced frequency (50->20) for larger waves
      // Reduced amplitude (0.1->0.05) for subtlety
      float ripple = sin(edgeDist * 20.0 - uScroll * 0.03) * 0.05;
      
      // Combined distortion vector
      // Reduced multipliers to avoid "messy" extreme warping
      vec2 distortionOffset = dir * (distortionStrength * 0.2 + ripple * distortionStrength * 2.0);
      
      // --- SCREEN SPACE MAPPING ---
      // We need to find the pixel coordinate on the viewport corresponding to this fragment.
      // gl_FragCoord.xy is relative to the bottom-left of the CANVAS.
      
      // 1. Get CSS pixel coordinates (handle Retina/HighDPI)
      vec2 cssPixel = gl_FragCoord.xy / uPixelRatio;
      
      // 2. Convert to viewport coordinates (Top-Left origin, like CSS)
      // Viewport X = Canvas Left + Canvas Pixel X
      float viewportX = uCanvasPos.x + cssPixel.x;
      
      // Viewport Y = Canvas Top + (Canvas Height - Canvas Pixel Y)
      // (Because Canvas Pixel Y is 0 at bottom, but we want 0 at top)
      float viewportY = uCanvasPos.y + (uCanvasSize.y - cssPixel.y);
      
      // 3. Apply Distortion (in pixels)
      // We distort the lookup coordinate
      vec2 distortedViewportPos = vec2(viewportX, viewportY) - distortionOffset * 400.0;
      
      // 4. Map to Texture UVs
      // The background is 400x400 repeating
      float bgSize = 400.0;
      
      // We need to invert Y because:
      // Viewport Y increases downwards (0 at top).
      // Texture V increases upwards (0 at bottom).
      // We want V=1 at Y=0.
      vec2 bgUv = vec2(
        distortedViewportPos.x / bgSize,
        1.0 - (distortedViewportPos.y / bgSize)
      );
      
      // Sample background
      vec4 bgColor = texture2D(uBgTexture, bgUv);
      
      // --- INTERNAL CONTENT ---
      vec4 contentColor = texture2D(uContentTexture, uv);
      
      // --- COMPOSITION ---
      vec3 finalColor = bgColor.rgb;
      
      // Tint (very subtle for "clear" glass)
      finalColor = mix(finalColor, vec3(0.2, 0.3, 0.3), 0.1);
      
      // Overlay content
      finalColor = mix(finalColor, contentColor.rgb, contentColor.a);
      
      // --- LIGHTING ---
      // Light coming from Top-Left
      vec2 lightDir = normalize(vec2(-1.0, 1.0));
      
      // 1. Soft Gradient across the surface
      // Reduced intensity (0.1 -> 0.05)
      float gradient = dot(uv - 0.5, vec2(-0.7, 0.7)) * 0.05;
      finalColor += gradient;
      
      // 2. Directional Edge Highlight
      // 'dir' is the direction from center to pixel (approximate normal at edge)
      float edgeAngle = dot(dir, lightDir);
      float specular = max(edgeAngle, 0.0);
      specular = pow(specular, 2.0); // Focus the highlight
      
      // Apply only at edges
      // Reduced intensity (0.3 -> 0.15)
      float directionalHighlight = smoothstep(0.1, 0.0, edgeDist) * specular * 0.15;
      finalColor += directionalHighlight;
      
      // 3. Subtle uniform rim (fresnel) - keep it very faint
      // Reduced intensity (0.1 -> 0.05)
      float fresnel = smoothstep(0.02, 0.0, edgeDist) * 0.05;
      finalColor += fresnel;
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

extend({ LiquidGlassMaterial });

const CardScene = () => {
    const materialRef = useRef();
    const [hovered, setHover] = useState(false);
    const { viewport, size, gl } = useThree();

    // Use a ref for scroll to avoid re-renders
    const scrollRef = useRef(0);

    // Store the absolute page position of the canvas
    const canvasPagePos = useRef({ top: 0, left: 0, width: 0, height: 0 });

    // Load background texture
    const bgTexture = useLoader(THREE.TextureLoader, leavesBg);
    useMemo(() => {
        bgTexture.wrapS = THREE.RepeatWrapping;
        bgTexture.wrapT = THREE.RepeatWrapping;
    }, [bgTexture]);

    // Handle Scroll
    useEffect(() => {
        const handleScroll = () => {
            scrollRef.current = window.scrollY;
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Handle Resize & Initial Position
    useEffect(() => {
        const updateMetrics = () => {
            const rect = gl.domElement.getBoundingClientRect();
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;

            canvasPagePos.current = {
                top: rect.top + scrollY,
                left: rect.left + scrollX,
                width: rect.width,
                height: rect.height
            };
        };

        // Run initially and on resize
        updateMetrics();
        window.addEventListener('resize', updateMetrics);

        // Also run after a small delay to ensure layout is settled
        const timer = setTimeout(updateMetrics, 100);

        return () => {
            window.removeEventListener('resize', updateMetrics);
            clearTimeout(timer);
        };
    }, [gl.domElement]);

    useFrame((state, delta) => {
        if (materialRef.current) {
            materialRef.current.uHover = THREE.MathUtils.lerp(
                materialRef.current.uHover,
                hovered ? 1 : 0,
                delta * 5
            );

            // Update Scroll Uniform
            materialRef.current.uScroll = scrollRef.current;

            // Calculate Viewport Position based on Page Position - Scroll
            // This is more stable than getBoundingClientRect() every frame
            const viewportTop = canvasPagePos.current.top - scrollRef.current;
            const viewportLeft = canvasPagePos.current.left; // Assuming no horizontal scroll for demo

            materialRef.current.uCanvasPos.set(viewportLeft, viewportTop);
            materialRef.current.uCanvasSize.set(canvasPagePos.current.width, canvasPagePos.current.height);

            // Pass the pixel ratio
            materialRef.current.uPixelRatio = gl.getPixelRatio();
        }
    });

    const onPointerMove = (e) => {
        if (materialRef.current) {
            materialRef.current.uMouse.set(e.uv.x, e.uv.y);
        }
    };

    return (
        <mesh
            onPointerOver={() => setHover(true)}
            onPointerOut={() => setHover(false)}
            onPointerMove={onPointerMove}
        >
            <planeGeometry args={[viewport.width, viewport.height]} />

            <liquidGlassMaterial
                ref={materialRef}
                uBgTexture={bgTexture}
                transparent
            >
                <RenderTexture attach="uContentTexture">
                    <PerspectiveCamera makeDefault position={[0, 0, 5]} />
                    {/* No background color -> transparent */}

                    <ambientLight intensity={1} />
                    <directionalLight position={[10, 10, 5]} />

                    <group position={[0, 0, 0]}>
                        <Text
                            color="white"
                            fontSize={0.4}
                            position={[0, 0.5, 0]}
                            anchorX="center"
                            anchorY="middle"
                            font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
                        >
                            Liquid Glass
                        </Text>

                        <Text
                            color="#aaa"
                            fontSize={0.2}
                            position={[0, -0.2, 0]}
                            anchorX="center"
                            anchorY="middle"
                            maxWidth={2.5}
                            textAlign="center"
                            font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
                        >
                            Scroll to see the edges warp.
                        </Text>

                        <mesh position={[0, -1.2, 0]}>
                            <boxGeometry args={[2, 0.1, 0.1]} />
                            <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} />
                        </mesh>
                    </group>
                </RenderTexture>
            </liquidGlassMaterial>
        </mesh>
    );
};

const LiquidGlassCard = () => {
    return (
        <div className="glass-container">
            <Canvas camera={{ position: [0, 0, 2.5] }}>
                <React.Suspense fallback={null}>
                    <CardScene />
                </React.Suspense>
            </Canvas>
        </div>
    );
};

export default LiquidGlassCard;
