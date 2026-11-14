// 区画仕様: 150cm × 150cm、土の高さ 約60cm
export const PLOT = {
  widthCm: 150,
  depthCm: 150,
  heightCm: 60,
  areaM2: 2.25,
  volumeM3: 1.35,
  /** 10a(=1000m²)あたりの量に掛ける係数 */
  factorPer10a: 2.25 / 1000,
} as const;
