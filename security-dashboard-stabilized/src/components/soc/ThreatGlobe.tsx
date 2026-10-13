"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface Hub {
  name: string;
  lat: number;
  lng: number;
}

interface LiveAttack {
  id: string;
  fromLat: number;
  fromLng: number;
  toHub: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  progress: number;
  speed: number;
}

const SOC_HUBS: Hub[] = [
  { name: "New York HQ", lat: 40.7128, lng: -74.0060 },
  { name: "London SOC", lat: 51.5074, lng: -0.1278 },
  { name: "Tokyo SOC", lat: 35.6895, lng: 139.6917 },
  { name: "Singapore SOC", lat: 1.3521, lng: 103.8519 },
];

export default function ThreatGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Live attacks tracking array
  const attacksRef = useRef<LiveAttack[]>([]);

  useEffect(() => {
    setMounted(true);
    // Detect mobile viewport
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Periodic attack simulator to keep the globe alive in case of low log ingestion
  useEffect(() => {
    if (!mounted || isMobile) return;

    const generator = setInterval(() => {
      const severities: LiveAttack["severity"][] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
      const targetHub = SOC_HUBS[Math.floor(Math.random() * SOC_HUBS.length)];
      
      const newAttack: LiveAttack = {
        id: Math.random().toString(),
        fromLat: Math.random() * 120 - 60,
        fromLng: Math.random() * 360 - 180,
        toHub: targetHub.name,
        severity: severities[Math.floor(Math.random() * severities.length)],
        progress: 0,
        speed: Math.random() * 0.008 + 0.004,
      };

      attacksRef.current = [...attacksRef.current.slice(-15), newAttack];
    }, 3000);

    return () => clearInterval(generator);
  }, [mounted, isMobile]);

  // Three.js implementation
  useEffect(() => {
    if (!mounted || isMobile || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 380;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 3. Globe Core and Wireframe Grid Layers
    const globeRadius = 120;
    
    // Core (dark blue/black occluder so you don't see lines on the back side easily)
    const coreGeo = new THREE.SphereGeometry(globeRadius - 0.5, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x050a16,
      transparent: true,
      opacity: 0.85,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // Wireframe Outline
    const wireGeo = new THREE.SphereGeometry(globeRadius, 32, 24);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wireMesh);

    // Atmospheric Glow Outer Ring
    const glowGeo = new THREE.SphereGeometry(globeRadius + 8, 32, 32);
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
          gl_FragColor = vec4(0.0, 0.9, 1.0, 1.0) * intensity * 0.45;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glowMesh);

    // Helper: Map Lat/Lng to 3D Cartesian coordinates
    const latLngToVector3 = (lat: number, lng: number, radius: number): THREE.Vector3 => {
      const radLat = (lat * Math.PI) / 180;
      const radLng = (-lng * Math.PI) / 180; // Negative because WebGL coordinates face inward
      const x = radius * Math.cos(radLat) * Math.sin(radLng);
      const y = radius * Math.sin(radLat);
      const z = radius * Math.cos(radLat) * Math.cos(radLng);
      return new THREE.Vector3(x, y, z);
    };

    // 4. Place Target SOC Hub Pins
    const pinsGroup = new THREE.Group();
    scene.add(pinsGroup);

    const pinGeo = new THREE.SphereGeometry(2, 8, 8);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

    SOC_HUBS.forEach(hub => {
      const pos = latLngToVector3(hub.lat, hub.lng, globeRadius);
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.copy(pos);
      pinsGroup.add(pin);
    });

    // 5. Light source for volumetric effect
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // 6. Interaction & Rotational drag
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    const rotationSpeed = 0.003;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y,
      };

      coreMesh.rotation.y += deltaMove.x * rotationSpeed;
      coreMesh.rotation.x += deltaMove.y * rotationSpeed;
      wireMesh.rotation.y += deltaMove.x * rotationSpeed;
      wireMesh.rotation.x += deltaMove.y * rotationSpeed;
      pinsGroup.rotation.y += deltaMove.x * rotationSpeed;
      pinsGroup.rotation.x += deltaMove.y * rotationSpeed;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    // 7. Render Loop Tracking
    let animFrameId: number;
    const linesGroup = new THREE.Group();
    scene.add(linesGroup);

    const colorMap = {
      CRITICAL: 0xff4d6d,
      HIGH: 0xff8a00,
      MEDIUM: 0x8b5cf6,
      LOW: 0x00e5ff,
    };

    const activeCurves: {
      id: string;
      curve: THREE.QuadraticBezierCurve3;
      line: THREE.Line;
      dot: THREE.Mesh;
      attack: LiveAttack;
    }[] = [];

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);

      // Auto rotation when not dragging
      if (!isDragging) {
        coreMesh.rotation.y += 0.0015;
        wireMesh.rotation.y += 0.0015;
        pinsGroup.rotation.y += 0.0015;
        linesGroup.rotation.y += 0.0015;
      }

      // Update / Draw arcs
      const currentAttacks = attacksRef.current;
      
      // Remove stale curves that are no longer in attacks list
      for (let i = activeCurves.length - 1; i >= 0; i--) {
        const entry = activeCurves[i];
        if (!currentAttacks.find(a => a.id === entry.id)) {
          linesGroup.remove(entry.line);
          linesGroup.remove(entry.dot);
          entry.line.geometry.dispose();
          if (Array.isArray(entry.line.material)) {
            entry.line.material.forEach(m => m.dispose());
          } else {
            entry.line.material.dispose();
          }
          (entry.dot.material as THREE.Material).dispose();
          entry.dot.geometry.dispose();
          activeCurves.splice(i, 1);
        }
      }

      // Spawn or update active attacks
      currentAttacks.forEach(attack => {
        let entry = activeCurves.find(c => c.id === attack.id);
        
        if (!entry) {
          // Resolve coordinates
          const startVec = latLngToVector3(attack.fromLat, attack.fromLng, globeRadius);
          const hub = SOC_HUBS.find(h => h.name === attack.toHub) || SOC_HUBS[0];
          const endVec = latLngToVector3(hub.lat, hub.lng, globeRadius);

          // Midpoint elevated above surface for curve arc height
          const midVec = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
          const distance = startVec.distanceTo(endVec);
          const arcHeight = Math.max(30, distance * 0.25);
          midVec.normalize().multiplyScalar(globeRadius + arcHeight);

          // Construct bezier curve
          const curve = new THREE.QuadraticBezierCurve3(startVec, midVec, endVec);
          const points = curve.getPoints(24);
          const lineGeo = new THREE.BufferGeometry().setFromPoints(points);

          const col = colorMap[attack.severity] || 0x00e5ff;
          const lineMat = new THREE.LineBasicMaterial({
            color: col,
            transparent: true,
            opacity: attack.severity === "CRITICAL" ? 0.8 : 0.5,
            linewidth: attack.severity === "CRITICAL" ? 2 : 1,
          });

          const line = new THREE.Line(lineGeo, lineMat);
          linesGroup.add(line);

          // Dot traveler along curve
          const dotGeo = new THREE.SphereGeometry(attack.severity === "CRITICAL" ? 2.5 : 1.8, 8, 8);
          const dotMat = new THREE.MeshBasicMaterial({ color: col });
          const dot = new THREE.Mesh(dotGeo, dotMat);
          linesGroup.add(dot);

          entry = {
            id: attack.id,
            curve,
            line,
            dot,
            attack,
          };
          activeCurves.push(entry);
        }

        // Animate the travel progress
        attack.progress += attack.speed;
        if (attack.progress > 1) {
          attack.progress = 0; // restart vector sequence loop
        }

        const currentPos = entry.curve.getPointAt(attack.progress);
        entry.dot.position.copy(currentPos);
      });

      renderer.render(scene, camera);
    };

    animate();

    // 8. Dynamic container resizing
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth || 400;
      const h = containerRef.current.clientHeight || 400;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      // Dispose scenes elements
      scene.traverse(obj => {
        const anyObj = obj as any;
        if (anyObj.geometry) {
          anyObj.geometry.dispose();
        }
        if (anyObj.material) {
          if (Array.isArray(anyObj.material)) {
            anyObj.material.forEach((m: any) => m.dispose());
          } else {
            anyObj.material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [mounted, isMobile]);

  // Static/Fallback render for mobile performance
  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-4 min-h-[300px] font-mono border border-white/5 bg-[#07111f]/40 backdrop-blur-md rounded-xl select-none">
        <svg viewBox="0 0 100 100" className="w-24 h-24 text-cyber-blue animate-pulse mb-3">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <path d="M 50,5 A 45,45 0 0,1 95,50" fill="none" stroke="var(--cyber-red)" strokeWidth="1.5" />
          <circle cx="95" cy="50" r="2" fill="var(--cyber-red)" />
          <circle cx="50" cy="5" r="2" fill="var(--cyber-blue)" />
        </svg>
        <span className="text-[10px] text-cyber-blue font-bold uppercase tracking-wider">HOLOGRAPHIC THREAT FEED ENABLED</span>
        <span className="text-[8px] text-muted-foreground uppercase mt-0.5">Mobile simplified grid active</span>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="w-full h-[380px] rounded-full border border-cyber-blue/20 bg-card/40 flex items-center justify-center animate-pulse">
        <span className="text-muted-foreground font-mono text-xs">GLOBE BOOT SEQUENCE INITIATING...</span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center w-full h-[380px] select-none cursor-grab active:cursor-grabbing">
      {/* Target scanning indicator overlay rings */}
      <div className="absolute inset-0 rounded-full border border-cyber-blue/5 pointer-events-none w-[360px] h-[360px] m-auto animate-pulse" />
      <div className="absolute inset-0 rounded-full border border-cyber-blue/10 pointer-events-none w-[340px] h-[340px] m-auto border-dashed animate-spin" style={{ animationDuration: "180s" }} />

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
