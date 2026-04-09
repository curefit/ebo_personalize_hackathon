import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function WelcomeAnimation({ shopperName, shopperActivity, onComplete }) {
  const sceneRef = useRef(null);

  useEffect(() => {
    const container = sceneRef.current;
    if (!container) {
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xeef4ff, 8, 18);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 2.4, 8.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 1.8);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const rim = new THREE.DirectionalLight(0x93c5fd, 1.1);
    rim.position.set(-4, 3, -4);
    const warm = new THREE.PointLight(0xf97316, 0.9, 16);
    warm.position.set(1, 2, 5);
    scene.add(ambient, key, rim, warm);

    const hero = new THREE.Group();
    scene.add(hero);

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x6d4bd1,
      roughness: 0.92,
      metalness: 0.02,
    });
    const detailMaterial = new THREE.MeshStandardMaterial({
      color: 0x5d38c1,
      roughness: 0.84,
      metalness: 0.02,
    });
    const eyebrowMaterial = new THREE.MeshStandardMaterial({ color: 0x4f2cae, roughness: 0.76 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(1.56, 48, 48), bodyMaterial);
    body.scale.set(1, 1.12, 0.96);
    body.position.set(0, 1.88, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    hero.add(body);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(1.28, 40, 40), bodyMaterial);
    belly.scale.set(0.92, 0.96, 0.86);
    belly.position.set(0, 1.08, 0.32);
    belly.castShadow = true;
    hero.add(belly);

    const leftEar = new THREE.Mesh(new THREE.SphereGeometry(0.38, 28, 28), bodyMaterial);
    leftEar.scale.set(1, 0.8, 0.86);
    leftEar.position.set(-0.7, 3.32, -0.18);
    leftEar.castShadow = true;
    hero.add(leftEar);

    const rightEar = new THREE.Mesh(new THREE.SphereGeometry(0.26, 28, 28), bodyMaterial);
    rightEar.scale.set(1, 0.8, 0.86);
    rightEar.position.set(0.58, 3.38, -0.28);
    rightEar.castShadow = true;
    hero.add(rightEar);

    const leftArm = new THREE.Mesh(new THREE.SphereGeometry(0.58, 24, 24), bodyMaterial);
    leftArm.scale.set(0.9, 1.2, 0.86);
    leftArm.position.set(-1.1, 2, 0.54);
    leftArm.rotation.z = 0.2;
    leftArm.castShadow = true;
    hero.add(leftArm);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(1.05, 2, 0.68);
    hero.add(rightArmPivot);

    const rightArm = new THREE.Mesh(new THREE.SphereGeometry(0.58, 24, 24), bodyMaterial);
    rightArm.scale.set(0.9, 1.2, 0.86);
    rightArm.position.set(0, 0, 0);
    rightArm.rotation.z = -0.32;
    rightArm.castShadow = true;
    rightArmPivot.add(rightArm);

    const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.42, 8, 16), detailMaterial);
    leftLeg.position.set(-0.46, 0.06, 0.32);
    leftLeg.castShadow = true;
    hero.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.42, 8, 16), detailMaterial);
    rightLeg.position.set(0.5, 0.08, 0.5);
    rightLeg.rotation.z = -0.16;
    rightLeg.castShadow = true;
    hero.add(rightLeg);

    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.42, 6, 10), detailMaterial);
    tail.position.set(-0.98, 1.12, -1.08);
    tail.rotation.z = -0.84;
    tail.rotation.x = 0.72;
    tail.castShadow = true;
    hero.add(tail);

    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 24), detailMaterial);
    leftEye.scale.set(1, 0.82, 0.26);
    leftEye.position.set(-0.52, 2.68, 1.2);
    hero.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 24), detailMaterial);
    rightEye.scale.set(1, 0.82, 0.26);
    rightEye.position.set(0.3, 2.66, 1.26);
    hero.add(rightEye);

    const leftBrow = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.28, 4, 10), eyebrowMaterial);
    leftBrow.position.set(-0.56, 3, 1.18);
    leftBrow.rotation.z = -0.92;
    hero.add(leftBrow);

    const rightBrow = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 4, 10), eyebrowMaterial);
    rightBrow.position.set(0.42, 3.08, 1.1);
    rightBrow.rotation.z = 1.36;
    hero.add(rightBrow);

    const binocularGroup = new THREE.Group();
    binocularGroup.position.set(0.62, 2.36, 1.58);
    binocularGroup.rotation.y = 0.1;
    hero.add(binocularGroup);

    const barrelGeometry = new THREE.CylinderGeometry(0.3, 0.34, 1.48, 28, 1, true);
    const barrelMaterial = new THREE.MeshStandardMaterial({
      color: 0x6b43cb,
      roughness: 0.82,
      metalness: 0.04,
    });

    const leftBarrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    leftBarrel.rotation.z = Math.PI / 2;
    leftBarrel.position.set(-0.28, 0, 0);
    binocularGroup.add(leftBarrel);

    const rightBarrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    rightBarrel.rotation.z = Math.PI / 2;
    rightBarrel.position.set(0.28, 0, 0);
    binocularGroup.add(rightBarrel);

    const rimGeometry = new THREE.TorusGeometry(0.3, 0.06, 12, 32);
    const leftRim = new THREE.Mesh(rimGeometry, detailMaterial);
    leftRim.rotation.y = Math.PI / 2;
    leftRim.position.set(-0.28, 0, 0.76);
    binocularGroup.add(leftRim);

    const rightRim = new THREE.Mesh(rimGeometry, detailMaterial);
    rightRim.rotation.y = Math.PI / 2;
    rightRim.position.set(0.28, 0, 0.76);
    binocularGroup.add(rightRim);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.34), detailMaterial);
    bridge.position.set(0, 0, 0.08);
    binocularGroup.add(bridge);

    const gripLeft = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 18), detailMaterial);
    gripLeft.position.set(-0.56, -0.18, -0.22);
    binocularGroup.add(gripLeft);

    const gripRight = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 18), detailMaterial);
    gripRight.position.set(0.56, -0.1, -0.2);
    binocularGroup.add(gripRight);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(2.8, 0.08, 16, 80),
      new THREE.MeshStandardMaterial({
        color: 0xa78bfa,
        emissive: 0xa78bfa,
        emissiveIntensity: 0.22,
        transparent: true,
        opacity: 0.9,
      }),
    );
    halo.rotation.x = 1.24;
    halo.position.y = 1.6;
    scene.add(halo);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.8, 48),
      new THREE.MeshStandardMaterial({ color: 0xe9edff, transparent: true, opacity: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.34;
    floor.receiveShadow = true;
    scene.add(floor);

    hero.rotation.y = -0.48;
    hero.position.y = -0.04;

    function resizeRenderer() {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    }

    resizeRenderer();
    const resizeObserver = new ResizeObserver(resizeRenderer);
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let frameId = 0;

    const renderFrame = () => {
      const elapsed = clock.getElapsedTime();
      hero.rotation.y = -0.48 + Math.sin(elapsed * 0.8) * 0.16;
      hero.position.y = -0.04 + Math.sin(elapsed * 1.5) * 0.05;
      rightArmPivot.rotation.z = Math.sin(elapsed * 3) * 0.12;
      binocularGroup.rotation.x = Math.sin(elapsed * 1.9) * 0.03;
      halo.rotation.z = elapsed * 0.35;
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(renderFrame);
    };

    renderFrame();

    const timer = window.setTimeout(() => {
      onComplete?.();
    }, 3600);

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      scene.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose?.();
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose?.());
          } else {
            child.material?.dispose?.();
          }
        }
      });
    };
  }, [onComplete]);

  return (
    <section className="welcome-screen">
      <div className="welcome-scene" ref={sceneRef} />
      <div className="welcome-copy">
        <span className="eyebrow">Personalized Welcome</span>
        <h2>Hey {shopperName}, Welcome! 🎉</h2>
        <p>Your {shopperActivity} edit is ready.</p>
      </div>
      <div className="welcome-progress">
        <span />
      </div>
    </section>
  );
}
