/**
 * Rothermel 火蔓延模型
 * @module modules/fire/RothermelModel
 * @description 完整实现 Rothermel (1972) 半经验火蔓延模型
 * 参考: ELMFIRE, BehavePlus, FARSITE
 */

class RothermelModel {
  constructor() {
    this.constants = {
      G: 9.81,
      RME: 0.01,
      HEAT_OF_COMBUSTION: 18600,
      MOISTURE_OF_EXTINCTION_BASE: 0.20
    };
  }

  calculateSpreadRate(params) {
    const {
      fuelLoad1h,
      fuelLoad10h,
      fuelLoad100h,
      fuelLoadLive,
      fuelDepth,
      surfaceAreaVolume1h,
      surfaceAreaVolumeLive,
      heatContent,
      moistureDead,
      moistureLive,
      moistureOfExtinction,
      mineralContent,
      mineralDamping,
      windSpeed,
      windDirection,
      slope,
      aspect
    } = params;

    const totalFuelLoad = fuelLoad1h + fuelLoad10h + fuelLoad100h + fuelLoadLive;
    if (totalFuelLoad <= 0) return 0;

    const bulkDensity = this._calculateBulkDensity(totalFuelLoad, fuelDepth);
    const packingRatio = this._calculatePackingRatio(totalFuelLoad, fuelDepth);
    const optimalPackingRatio = this._calculateOptimalPackingRatio(surfaceAreaVolume1h);
    const relativePackingRatio = packingRatio / optimalPackingRatio;

    const reactionIntensity = this._calculateReactionIntensity({
      fuelLoad1h,
      fuelLoad10h,
      fuelLoad100h,
      fuelLoadLive,
      surfaceAreaVolume1h,
      surfaceAreaVolumeLive,
      heatContent,
      moistureDead,
      moistureLive,
      moistureOfExtinction,
      mineralDamping,
      packingRatio,
      relativePackingRatio
    });

    const propagatingFluxRatio = this._calculatePropagatingFluxRatio(
      relativePackingRatio,
      surfaceAreaVolume1h
    );

    const windFactor = this._calculateWindFactor(windSpeed, surfaceAreaVolume1h, packingRatio);
    const slopeFactor = this._calculateSlopeFactor(slope);

    const effectiveHeatingNumber = this._calculateEffectiveHeatingNumber(surfaceAreaVolume1h);
    const heatOfPreignition = this._calculateHeatOfPreignition(moistureDead);

    const numerator = reactionIntensity * propagatingFluxRatio * (1 + windFactor + slopeFactor);
    const denominator = bulkDensity * effectiveHeatingNumber * heatOfPreignition;

    const spreadRate = numerator / denominator;

    return {
      spreadRate: Math.max(0, spreadRate),
      reactionIntensity,
      propagatingFluxRatio,
      windFactor,
      slopeFactor,
      flameLength: this._calculateFlameLength(reactionIntensity, spreadRate)
    };
  }

  _calculateBulkDensity(totalFuelLoad, fuelDepth) {
    return totalFuelLoad / fuelDepth;
  }

  _calculatePackingRatio(totalFuelLoad, fuelDepth) {
    const particleDensity = 512;
    return totalFuelLoad / (particleDensity * fuelDepth);
  }

  _calculateOptimalPackingRatio(surfaceAreaVolume) {
    const sigma = surfaceAreaVolume;
    return 3.348 * Math.pow(sigma, -0.8189);
  }

  _calculateReactionIntensity(params) {
    const {
      fuelLoad1h,
      fuelLoad10h,
      fuelLoad100h,
      fuelLoadLive,
      surfaceAreaVolume1h,
      surfaceAreaVolumeLive,
      heatContent,
      moistureDead,
      moistureLive,
      moistureOfExtinction,
      mineralDamping,
      packingRatio,
      relativePackingRatio
    } = params;

    const totalFuelLoad = fuelLoad1h + fuelLoad10h + fuelLoad100h + fuelLoadLive;
    
    const weightedSAV = (
      fuelLoad1h * surfaceAreaVolume1h +
      fuelLoadLive * surfaceAreaVolumeLive
    ) / (fuelLoad1h + fuelLoadLive || 1);

    const etaM = this._calculateMoistureDamping(
      moistureDead,
      moistureLive,
      moistureOfExtinction,
      fuelLoad1h,
      fuelLoadLive
    );

    const etaS = mineralDamping || 1;

    const gammaPrime = this._calculateOptimumReactionVelocity(
      weightedSAV,
      relativePackingRatio
    );

    const reactionIntensity = gammaPrime * heatContent * etaM * etaS * packingRatio * totalFuelLoad;

    return reactionIntensity;
  }

  _calculateOptimumReactionVelocity(sigma, relativePackingRatio) {
    const a = 133 * Math.pow(sigma, -0.7913);
    const gammaPrimeMax = Math.pow(sigma, 1.5) / (495 + 0.0594 * Math.pow(sigma, 1.5));
    
    const gammaPrime = gammaPrimeMax * Math.pow(relativePackingRatio, a) * 
                        Math.exp(a * (1 - relativePackingRatio));

    return Math.max(0, gammaPrime);
  }

  _calculateMoistureDamping(moistureDead, moistureLive, moistureOfExtinction, fuelLoadDead, fuelLoadLive) {
    const Mx = moistureOfExtinction || this.constants.MOISTURE_OF_EXTINCTION_BASE;
    
    const etaMDead = 1 - 2.59 * (moistureDead / Mx) + 
                     5.11 * Math.pow(moistureDead / Mx, 2) - 
                     3.52 * Math.pow(moistureDead / Mx, 3);
    
    const etaMLive = 1 - 2.59 * (moistureLive / (3 * Mx)) + 
                     5.11 * Math.pow(moistureLive / (3 * Mx), 2) - 
                     3.52 * Math.pow(moistureLive / (3 * Mx), 3);

    const totalFuel = fuelLoadDead + fuelLoadLive;
    if (totalFuel <= 0) return 1;

    const etaM = (fuelLoadDead * Math.max(0, etaMDead) + fuelLoadLive * Math.max(0, etaMLive)) / totalFuel;

    return Math.max(0, Math.min(1, etaM));
  }

  _calculatePropagatingFluxRatio(relativePackingRatio, sigma) {
    const xi = Math.exp(
      (0.792 + 0.681 * Math.pow(sigma, 0.5)) * 
      (relativePackingRatio + 0.1) - 1.0
    ) / (192 + 0.2595 * sigma);

    return Math.max(0, Math.min(1, xi));
  }

  _calculateWindFactor(windSpeed, sigma, packingRatio) {
    if (windSpeed <= 0) return 0;

    const C = 7.47 * Math.exp(-0.133 * Math.pow(sigma, 0.55));
    const B = 0.02526 * Math.pow(sigma, 0.54);
    const E = 0.715 * Math.exp(-0.000359 * sigma);

    const phiW = C * Math.pow(windSpeed, B) * Math.pow(packingRatio, -E);

    return Math.max(0, phiW);
  }

  _calculateSlopeFactor(slope) {
    if (slope <= 0) return 0;

    const slopeRadians = slope * Math.PI / 180;
    const phiS = 5.275 * Math.pow(Math.pow(slopeRadians, 2), 0.5);

    return Math.max(0, phiS);
  }

  _calculateEffectiveHeatingNumber(sigma) {
    return Math.exp(-138 / sigma);
  }

  _calculateHeatOfPreignition(moisture) {
    return 250 + 1116 * moisture;
  }

  _calculateFlameLength(reactionIntensity, spreadRate) {
    const I = reactionIntensity * spreadRate / 60;
    return 0.45 * Math.pow(I, 0.46);
  }

  calculateDirectionalSpreadRate(baseSpreadRate, windSpeed, windDirection, fireDirection, slope, aspect) {
    const headingSpreadRate = baseSpreadRate;

    const angleToWind = Math.abs(fireDirection - windDirection);
    const normalizedAngle = Math.min(angleToWind, 360 - angleToWind) * Math.PI / 180;

    const windEffect = Math.cos(normalizedAngle);

    let slopeEffect = 0;
    if (slope > 0) {
      const fireDirectionRad = fireDirection * Math.PI / 180;
      const aspectRad = aspect * Math.PI / 180;
      const angleToUpslope = Math.abs(fireDirectionRad - aspectRad);
      slopeEffect = Math.cos(angleToUpslope);
    }

    const combinedEffect = Math.max(0, 0.5 * (1 + windEffect + slopeEffect));

    const lengthToWidthRatio = 1 + 0.25 * windSpeed;
    const backingRatio = 1 / lengthToWidthRatio;

    let directionalRate;
    if (combinedEffect > 0.5) {
      directionalRate = headingSpreadRate * (backingRatio + (1 - backingRatio) * combinedEffect * 2);
    } else {
      directionalRate = headingSpreadRate * backingRatio;
    }

    return Math.max(0.01, directionalRate);
  }

  calculateFireEllipse(spreadRate, windSpeed, windDirection) {
    const lengthToWidthRatio = 1 + 0.25 * windSpeed;
    
    const length = spreadRate;
    const width = length / lengthToWidthRatio;
    
    const f = spreadRate * (1 - 1 / lengthToWidthRatio) / 2;
    
    const a = length / 2;
    const b = width / 2;
    
    const eccentricity = Math.sqrt(1 - (b * b) / (a * a));

    return {
      length,
      width,
      focalDistance: f,
      semiMajorAxis: a,
      semiMinorAxis: b,
      eccentricity,
      headingDirection: windDirection,
      backingSpreadRate: spreadRate / lengthToWidthRatio,
      flankingSpreadRate: spreadRate * (1 + 1 / lengthToWidthRatio) / 2
    };
  }
}

export const AndersonFuelModels = {
  1: {
    name: '短草草地',
    fuelLoad1h: 0.74,
    fuelLoad10h: 0.0,
    fuelLoad100h: 0.0,
    fuelLoadLive: 0.0,
    fuelDepth: 0.305,
    surfaceAreaVolume1h: 10593,
    surfaceAreaVolumeLive: 0,
    heatContent: 18600,
    moistureOfExtinction: 0.12,
    mineralDamping: 0.58
  },
  2: {
    name: '木材和草地',
    fuelLoad1h: 2.0,
    fuelLoad10h: 1.0,
    fuelLoad100h: 0.5,
    fuelLoadLive: 0.5,
    fuelDepth: 0.305,
    surfaceAreaVolume1h: 6561,
    surfaceAreaVolumeLive: 4921,
    heatContent: 18600,
    moistureOfExtinction: 0.15,
    mineralDamping: 0.58
  },
  3: {
    name: '高草草地',
    fuelLoad1h: 0.5,
    fuelLoad10h: 0.0,
    fuelLoad100h: 0.0,
    fuelLoadLive: 1.5,
    fuelDepth: 0.762,
    surfaceAreaVolume1h: 4921,
    surfaceAreaVolumeLive: 4921,
    heatContent: 18600,
    moistureOfExtinction: 0.25,
    mineralDamping: 0.58
  },
  4: {
    name: '灌木丛',
    fuelLoad1h: 5.0,
    fuelLoad10h: 4.0,
    fuelLoad100h: 2.0,
    fuelLoadLive: 5.0,
    fuelDepth: 1.829,
    surfaceAreaVolume1h: 6561,
    surfaceAreaVolumeLive: 4921,
    heatContent: 18600,
    moistureOfExtinction: 0.20,
    mineralDamping: 0.58
  },
  5: {
    name: '灌木',
    fuelLoad1h: 1.0,
    fuelLoad10h: 0.5,
    fuelLoad100h: 0.0,
    fuelLoadLive: 2.0,
    fuelDepth: 0.610,
    surfaceAreaVolume1h: 6561,
    surfaceAreaVolumeLive: 4921,
    heatContent: 18600,
    moistureOfExtinction: 0.20,
    mineralDamping: 0.58
  },
  6: {
    name: '灌木林',
    fuelLoad1h: 1.5,
    fuelLoad10h: 2.5,
    fuelLoad100h: 2.0,
    fuelLoadLive: 0.0,
    fuelDepth: 0.762,
    surfaceAreaVolume1h: 6561,
    surfaceAreaVolumeLive: 0,
    heatContent: 18600,
    moistureOfExtinction: 0.25,
    mineralDamping: 0.58
  },
  7: {
    name: '灌木林地',
    fuelLoad1h: 1.13,
    fuelLoad10h: 1.87,
    fuelLoad100h: 1.5,
    fuelLoadLive: 0.5,
    fuelDepth: 0.762,
    surfaceAreaVolume1h: 6561,
    surfaceAreaVolumeLive: 4921,
    heatContent: 18600,
    moistureOfExtinction: 0.40,
    mineralDamping: 0.58
  },
  8: {
    name: '封闭林冠',
    fuelLoad1h: 1.5,
    fuelLoad10h: 1.0,
    fuelLoad100h: 2.5,
    fuelLoadLive: 0.0,
    fuelDepth: 0.061,
    surfaceAreaVolume1h: 1884,
    surfaceAreaVolumeLive: 0,
    heatContent: 18600,
    moistureOfExtinction: 0.30,
    mineralDamping: 0.58
  },
  9: {
    name: '硬木林',
    fuelLoad1h: 2.92,
    fuelLoad10h: 0.41,
    fuelLoad100h: 0.17,
    fuelLoadLive: 0.0,
    fuelDepth: 0.061,
    surfaceAreaVolume1h: 2461,
    surfaceAreaVolumeLive: 0,
    heatContent: 18600,
    moistureOfExtinction: 0.25,
    mineralDamping: 0.58
  },
  10: {
    name: '针叶林',
    fuelLoad1h: 3.0,
    fuelLoad10h: 2.0,
    fuelLoad100h: 5.0,
    fuelLoadLive: 0.0,
    fuelDepth: 0.305,
    surfaceAreaVolume1h: 1640,
    surfaceAreaVolumeLive: 0,
    heatContent: 18600,
    moistureOfExtinction: 0.25,
    mineralDamping: 0.58
  },
  11: {
    name: '轻型采伐地',
    fuelLoad1h: 1.5,
    fuelLoad10h: 4.5,
    fuelLoad100h: 5.5,
    fuelLoadLive: 0.0,
    fuelDepth: 0.305,
    surfaceAreaVolume1h: 1181,
    surfaceAreaVolumeLive: 0,
    heatContent: 18600,
    moistureOfExtinction: 0.15,
    mineralDamping: 0.58
  },
  12: {
    name: '中型采伐地',
    fuelLoad1h: 4.0,
    fuelLoad10h: 14.0,
    fuelLoad100h: 16.5,
    fuelLoadLive: 0.0,
    fuelDepth: 0.701,
    surfaceAreaVolume1h: 1181,
    surfaceAreaVolumeLive: 0,
    heatContent: 18600,
    moistureOfExtinction: 0.20,
    mineralDamping: 0.58
  },
  13: {
    name: '重型采伐地',
    fuelLoad1h: 7.0,
    fuelLoad10h: 23.0,
    fuelLoad100h: 28.0,
    fuelLoadLive: 0.0,
    fuelDepth: 0.914,
    surfaceAreaVolume1h: 1181,
    surfaceAreaVolumeLive: 0,
    heatContent: 18600,
    moistureOfExtinction: 0.25,
    mineralDamping: 0.58
  }
};

export function getAndersonFuelModel(modelId) {
  return AndersonFuelModels[modelId] || AndersonFuelModels[1];
}

export default RothermelModel;
