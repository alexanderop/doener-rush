/**
 * Pictures of the chef looks for the home page picker, drawn with the same models the kitchen
 * uses. One small renderer draws every look once, then lets its WebGL context go.
 */
import * as THREE from "three";
import type { Look } from "../looks.ts";
import { cookModel } from "./models.ts";

/** A PNG data URL per look id, `size` pixels square, the cook turned a little towards the light. */
export function renderPortraits(looks: readonly Look[], size = 224): ReadonlyMap<string, string> {
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#fff3dc", "#6a4a3a", 1.6));
  const sun = new THREE.DirectionalLight("#fff1d6", 2.4);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 1.75, 3.3);
  camera.lookAt(0, 0.9, 0);
  const shots = new Map<string, string>();

  try {
    for (const look of looks) {
      const model = cookModel(look);
      model.rotation.y = -0.4;
      scene.add(model);
      renderer.render(scene, camera);
      shots.set(look.id, canvas.toDataURL("image/png"));
      scene.remove(model);
    }
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return shots;
}
