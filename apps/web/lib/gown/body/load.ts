/**
 * 👗 gown/body/load — the faceless mannequin from its GLB bytes to a rig. The same call runs in a test (bytes read
 * from disk) and in the stage (bytes fetched from `GOWN_BODY_URL`, lazily, never in the shared bundle).
 *
 * The mesh: base mesh by Innerscene Corp (innerscene.com), CC0 1.0, a stylised faceless mannequin decimated for
 * Setnayan (the credit is inside the file's asset record; see public/gown/LICENSES.md).
 */
import type * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { makeGownRig, skinnedMeshOf, type GownRig } from './rig';
import { calibrateArm, solveGownBody } from './solve';

/** Served from apps/web/public/gown/ (a static file: one fetch, cached by the browser). */
export const GOWN_BODY_URL = '/gown/female.glb';

export function parseGownBody(bytes: ArrayBuffer): Promise<GownRig> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      bytes,
      '',
      (gltf) => {
        try {
          const rig = makeGownRig(skinnedMeshOf(gltf.scene as THREE.Object3D));
          calibrateArm(rig);
          solveGownBody(rig);
          resolve(rig);
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      },
      (e) => reject(e instanceof Error ? e : new Error(String(e))),
    );
  });
}
