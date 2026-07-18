const defaultFields = {
  U: 'U',
  V: 'V',
  W: '',
  H: '',
  lon: 'lon',
  lat: 'lat',
  lev: '',
}

const defaultColorTable = [
  [0.0, 0.0, 0.5],
  [0.0, 0.0, 0.8],
  [0.0, 0.5, 1.0],
  [0.0, 0.8, 0.8],
  [0.0, 1.0, 0.6],
  [0.5, 1.0, 0.0],
  [1.0, 0.8, 0.0],
  [1.0, 0.5, 0.0],
  [1.0, 0.0, 0.0],
  [0.8, 0.0, 0.2]
]

const defaultParticleSystemOptions = {
    maxParticles: 32 * 32,
    particleHeight: 1000.0,
    fadeOpacity: 0.996,
    dropRate: 0.003,
    dropRateBump: 0.01,
    speedFactor: 1.0,
    lineWidth: 2.0,
    dynamic: true
}

export { defaultFields, defaultColorTable, defaultParticleSystemOptions };