const SLICES = 12;

export const TILE_BODY = Array.from({ length: SLICES }, (_, i) => {
  const angle = Math.PI * (i / (SLICES - 1) - 0.5);
  const through = Math.sin(angle);
  return {
    z: through * 0.98,
    out: Math.cos(angle).toFixed(4),
    mix: `${Math.round((through + 1) * 50)}%`,
  };
});
