export const fullscreenVert = `
in vec3 position;
in vec2 st;

out vec2 textureCoordinate;

void main() {
    textureCoordinate = st;
    gl_Position = vec4(position, 1.0);
}
`;

export const segmentDrawVert = `
in vec2 st;
in vec3 normal;
uniform vec2 hRange;
uniform vec2 uSpeedRange;
uniform vec2 vSpeedRange;
uniform vec2 wSpeedRange;

uniform sampler2D previousParticlesPosition;
uniform sampler2D currentParticlesPosition;
uniform sampler2D postProcessingPosition;
uniform sampler2D particlesSpeed;

uniform float particleHeight;

uniform float aspect;
uniform float pixelSize;
uniform float lineWidth;

struct adjacentPoints {
    vec4 previous;
    vec4 current;
    vec4 next;
};

out float heightNormalization;
out float speedNormalization;

vec3 convertCoordinate(vec3 lonLatLev) {
    float a = 6378137.0;
    float b = 6356752.3142;
    float e2 = 6.69437999014e-3;

    float latitude = radians(lonLatLev.y);
    float longitude = radians(lonLatLev.x);

    float cosLat = cos(latitude);
    float sinLat = sin(latitude);
    float cosLon = cos(longitude);
    float sinLon = sin(longitude);

    float N_Phi = a / sqrt(1.0 - e2 * sinLat * sinLat);
    float h = particleHeight + lonLatLev.z;
    vec3 cartesian = vec3(0.0);
    cartesian.x = (N_Phi + h) * cosLat * cosLon;
    cartesian.y = (N_Phi + h) * cosLat * sinLon;
    cartesian.z = ((b * b) / (a * a) * N_Phi + h) * sinLat;
    return cartesian;
}

vec4 calculateProjectedCoordinate(vec3 lonLatLev) {
    lonLatLev.x = mod(lonLatLev.x + 180.0, 360.0) - 180.0;
    vec3 particlePosition = convertCoordinate(lonLatLev);
    vec4 projectedCoordinate = czm_modelViewProjection * vec4(particlePosition, 1.0);
    return projectedCoordinate;
}

vec4 calculateOffsetOnNormalDirection(vec4 pointA, vec4 pointB, float offsetSign) {
    vec2 aspectVec2 = vec2(aspect, 1.0);
    vec2 pointA_XY = (pointA.xy / pointA.w) * aspectVec2;
    vec2 pointB_XY = (pointB.xy / pointB.w) * aspectVec2;

    float offsetLength = lineWidth / 2.0;
    vec2 direction = normalize(pointB_XY - pointA_XY);
    vec2 normalVector = vec2(-direction.y, direction.x);
    normalVector.x = normalVector.x / aspect;
    normalVector = offsetLength * normalVector;

    vec4 offset = vec4(offsetSign * normalVector, 0.0, 0.0);
    return offset;
}

float calculateWindNorm(vec3 speed) {
    vec3 percent = vec3(0.0);
    percent.x = (speed.x - uSpeedRange.x) / (uSpeedRange.y - uSpeedRange.x);
    percent.y = (speed.y - vSpeedRange.x) / (vSpeedRange.y - vSpeedRange.x);
    if(wSpeedRange.y == wSpeedRange.x){
      percent.z = 0.0;
    } else {
      percent.z = (speed.z - wSpeedRange.x) / (wSpeedRange.y - wSpeedRange.x);
    }
    float norm = length(percent);
    return norm;
}

void main() {
    vec2 particleIndex = st;

    vec3 previousPosition = texture(previousParticlesPosition, particleIndex).rgb;
    vec3 currentPosition = texture(currentParticlesPosition, particleIndex).rgb;
    vec3 nextPosition = texture(postProcessingPosition, particleIndex).rgb;

    float isAnyRandomPointUsed = texture(postProcessingPosition, particleIndex).a +
        texture(currentParticlesPosition, particleIndex).a +
        texture(previousParticlesPosition, particleIndex).a;

    adjacentPoints projectedCoordinates;
    if (isAnyRandomPointUsed > 0.0) {
        projectedCoordinates.previous = calculateProjectedCoordinate(previousPosition);
        projectedCoordinates.current = projectedCoordinates.previous;
        projectedCoordinates.next = projectedCoordinates.previous;
    } else {
        projectedCoordinates.previous = calculateProjectedCoordinate(previousPosition);
        projectedCoordinates.current = calculateProjectedCoordinate(currentPosition);
        projectedCoordinates.next = calculateProjectedCoordinate(nextPosition);
    }

    int pointToUse = int(normal.x);
    float offsetSign = normal.y;
    vec4 offset = vec4(0.0);
    if (pointToUse == -1) {
        offset = pixelSize * calculateOffsetOnNormalDirection(projectedCoordinates.previous, projectedCoordinates.current, offsetSign);
        gl_Position = projectedCoordinates.previous + offset;
    } else  if (pointToUse == 1) {
        offset = pixelSize * calculateOffsetOnNormalDirection(projectedCoordinates.current, projectedCoordinates.next, offsetSign);
        gl_Position = projectedCoordinates.next + offset;
    }

    heightNormalization = (currentPosition.z - hRange.x) / (hRange.y - hRange.x);
    speedNormalization = texture(particlesSpeed, particleIndex).a;
}
`;

export const segmentDrawFrag = `
uniform sampler2D colorTable;
uniform bool colour;

in float heightNormalization;
in float speedNormalization;

out vec4 fragColor;

void main() {
  const float zero = 0.0;
  if(speedNormalization > zero){
    if(colour){
      fragColor = texture(colorTable, vec2(heightNormalization, zero));
    } else {
      fragColor = texture(colorTable, vec2(speedNormalization, zero));
    }
  } else {
    fragColor = vec4(zero);
  }
}
`;

export const screenDrawFrag = `
uniform sampler2D trailsColorTexture;
uniform sampler2D trailsDepthTexture;

in vec2 textureCoordinate;
out vec4 fragColor;

void main() {
    vec4 trailsColor = texture(trailsColorTexture, textureCoordinate);
    float trailsDepth = texture(trailsDepthTexture, textureCoordinate).r;
    float globeDepth = czm_unpackDepth(texture(czm_globeDepthTexture, textureCoordinate));

    if (trailsDepth < globeDepth) {
        fragColor = trailsColor;
    } else {
        fragColor = vec4(0.0);
    }
}
`;

export const trailDrawFrag = `
in vec2 textureCoordinate;

uniform sampler2D segmentsColorTexture;
uniform sampler2D segmentsDepthTexture;

uniform sampler2D currentTrailsColor;
uniform sampler2D trailsDepthTexture;

uniform float fadeOpacity;

out vec4 fragColor;

void main() {
    vec4 pointsColor = texture(segmentsColorTexture, textureCoordinate);
    vec4 trailsColor = texture(currentTrailsColor, textureCoordinate);
    trailsColor = floor(fadeOpacity * 255.0 * trailsColor) / 255.0;

    float pointsDepth = texture(segmentsDepthTexture, textureCoordinate).r;
    float trailsDepth = texture(trailsDepthTexture, textureCoordinate).r;
    float globeDepth = czm_unpackDepth(texture(czm_globeDepthTexture, textureCoordinate));
    fragColor = vec4(0.0);
    if (pointsDepth < globeDepth) {
        fragColor = fragColor + pointsColor;
    }
    if (trailsDepth < globeDepth) {
        fragColor = fragColor + trailsColor;
    }
    gl_FragDepth = min(pointsDepth, trailsDepth);
}
`;

export const CalculateSpeedShader = `
uniform sampler2D U;
uniform sampler2D V;
uniform sampler2D W;
uniform sampler2D currentParticlesPosition;

uniform vec3 dimension;
uniform vec3 minimum;
uniform vec3 maximum;
uniform vec3 interval;

uniform vec2 uSpeedRange;
uniform vec2 vSpeedRange;
uniform vec2 wSpeedRange;
uniform float speedScaleFactor;

in vec2 v_textureCoordinates;

out vec4 fragColor;

vec2 mapPositionToNormalizedIndex2D(vec3 lonLatLev) {
    lonLatLev.x = clamp(lonLatLev.x, minimum.x, maximum.x);
    lonLatLev.y = clamp(lonLatLev.y, minimum.y, maximum.y);
    lonLatLev.z = clamp(lonLatLev.z, minimum.z, maximum.z);

    vec3 index3D = vec3(0.0);
    index3D.x = (lonLatLev.x - minimum.x) / interval.x;
    index3D.y = (lonLatLev.y - minimum.y) / interval.y;
    index3D.z = ceil((lonLatLev.z - minimum.z) / interval.z);

    vec2 index2D = vec2(index3D.x, index3D.z * dimension.y + index3D.y);
    vec2 normalizedIndex2D = vec2(index2D.x / dimension.x, index2D.y / (dimension.y * dimension.z));
    return normalizedIndex2D;
}

float getWindComponent(sampler2D componentTexture, vec3 lonLatLev) {
    vec2 normalizedIndex2D = mapPositionToNormalizedIndex2D(lonLatLev);
    float result = texture(componentTexture, normalizedIndex2D).r;
    return result;
}

float interpolateTexture(sampler2D componentTexture, vec3 lonLatLev) {
    float lon = lonLatLev.x;
    float lat = lonLatLev.y;
    float lev = lonLatLev.z;

    float lon0 = floor(lon / interval.x) * interval.x;
    float lon1 = lon0 + 1.0 * interval.x;
    float lat0 = floor(lat / interval.y) * interval.y;
    float lat1 = lat0 + 1.0 * interval.y;

    float lon0_lat0 = getWindComponent(componentTexture, vec3(lon0, lat0, lev));
    float lon1_lat0 = getWindComponent(componentTexture, vec3(lon1, lat0, lev));
    float lon0_lat1 = getWindComponent(componentTexture, vec3(lon0, lat1, lev));
    float lon1_lat1 = getWindComponent(componentTexture, vec3(lon1, lat1, lev));

    float lon_lat0 = mix(lon0_lat0, lon1_lat0, lon - lon0);
    float lon_lat1 = mix(lon0_lat1, lon1_lat1, lon - lon0);
    float lon_lat = mix(lon_lat0, lon_lat1, lat - lat0);
    return lon_lat;
}

vec3 linearInterpolation(vec3 lonLatLev) {
    float u = interpolateTexture(U, lonLatLev);
    float v = interpolateTexture(V, lonLatLev);
    float w = interpolateTexture(W, lonLatLev);
    return vec3(u, v, w);
}

vec2 lengthOfLonLat(vec3 lonLatLev) {
    float latitude = radians(lonLatLev.y);

    float term1 = 111132.92;
    float term2 = 559.82 * cos(2.0 * latitude);
    float term3 = 1.175 * cos(4.0 * latitude);
    float term4 = 0.0023 * cos(6.0 * latitude);
    float latLength = term1 - term2 + term3 - term4;

    float term5 = 111412.84 * cos(latitude);
    float term6 = 93.5 * cos(3.0 * latitude);
    float term7 = 0.118 * cos(5.0 * latitude);
    float longLength = term5 - term6 + term7;

    return vec2(longLength, latLength);
}

vec3 convertSpeedUnitToLonLat(vec3 lonLatLev, vec3 speed) {
    vec2 lonLatLength = lengthOfLonLat(lonLatLev);
    float u = speed.x / lonLatLength.x;
    float v = speed.y / lonLatLength.y;
    float w = speed.z;
    vec3 windVectorInLonLatLev = vec3(u, v, w);
    return windVectorInLonLatLev;
}

vec3 calculateSpeedByRungeKutta2(vec3 lonLatLev) {
    const float h = 0.5;

    vec3 y_n = lonLatLev;
    vec3 f_n = linearInterpolation(lonLatLev);
    vec3 midpoint = y_n + 0.5 * h * convertSpeedUnitToLonLat(y_n, f_n) * speedScaleFactor;
    vec3 speed = h * linearInterpolation(midpoint) * speedScaleFactor;

    return speed;
}

vec2 getRange(vec2 range) {
    float x1 = 0.0 - range.x;
    float x2 = range.y - 0.0;
    if(x1 < 0.0 || x2 < 0.0){
        return vec2(abs(x1), abs(x2));
    } else {
        return vec2(0.0, abs(max(x1, x2)));
    }
}

float calculateWindNorm(vec3 speed) {
    vec3 percent = vec3(0.0);
    vec2 uRange = getRange(uSpeedRange);
    vec2 vRange = getRange(vSpeedRange);
    vec2 wRange = getRange(wSpeedRange);
    if(length(speed.xyz) == 0.0){
        return 0.0;
    }

    percent.x = (abs(speed.x) - uRange.x) / (uRange.y - uRange.x);
    percent.y = (abs(speed.y) - vRange.x) / (vRange.y - vRange.x);
    if(wSpeedRange.y == wSpeedRange.x){
        percent.z = 0.0;
    } else {
        percent.z = (abs(speed.z) - wRange.x) / (wSpeedRange.y - wSpeedRange.x);
    }
    float norm = length(percent);

    return norm;
}

void main() {
    vec3 lonLatLev = texture(currentParticlesPosition, v_textureCoordinates).rgb;
    vec3 speedOrigin = linearInterpolation(lonLatLev);
    vec3 speed = calculateSpeedByRungeKutta2(lonLatLev);
    vec3 speedInLonLat = convertSpeedUnitToLonLat(lonLatLev, speed);

    fragColor = vec4(speedInLonLat, calculateWindNorm(speedOrigin));
}
`;

export const UpdatePositionShader = `
uniform sampler2D currentParticlesPosition;
uniform sampler2D particlesSpeed;

in vec2 v_textureCoordinates;

out vec4 fragColor;

void main() {
    vec3 lonLatLev = texture(currentParticlesPosition, v_textureCoordinates).rgb;
    vec3 speed = texture(particlesSpeed, v_textureCoordinates).rgb;
    vec3 nextParticle = lonLatLev + speed;
    if(length(speed.rgb) > 0.0) {
        fragColor = vec4(nextParticle, 0.0);
    } else {
        fragColor = vec4(0.0);
    }
}
`;

export const PostProcessingPositionShader = `
uniform sampler2D nextParticlesPosition;
uniform sampler2D particlesSpeed;

uniform sampler2D H;

uniform vec3 dimension;
uniform vec3 minimum;
uniform vec3 maximum;
uniform vec3 interval;

uniform vec2 lonRange;
uniform vec2 latRange;
uniform vec2 viewerLonRange;
uniform vec2 viewerLatRange;

const float randomCoefficient = 0.1;
const float dropRate = 0.1;
const float dropRateBump = 0.1;

in vec2 v_textureCoordinates;

out vec4 fragColor;

vec2 mapPositionToNormalizedIndex2D(vec3 lonLatLev) {
    lonLatLev.x = clamp(lonLatLev.x, minimum.x, maximum.x);
    lonLatLev.y = clamp(lonLatLev.y, minimum.y, maximum.y);
    lonLatLev.z = clamp(lonLatLev.z, minimum.z, maximum.z);

    vec3 index3D = vec3(0.0);
    index3D.x = (lonLatLev.x - minimum.x) / interval.x;
    index3D.y = (lonLatLev.y - minimum.y) / interval.y;
    index3D.z = ceil((lonLatLev.z - minimum.z) / interval.z);

    vec2 index2D = vec2(index3D.x, index3D.z * dimension.y + index3D.y);
    vec2 normalizedIndex2D = vec2(index2D.x / dimension.x, index2D.y / (dimension.y * dimension.z));
    return normalizedIndex2D;
}

vec4 getTextureValue(sampler2D componentTexture, vec3 lonLatLev) {
    vec2 normalizedIndex2D = mapPositionToNormalizedIndex2D(lonLatLev);
    vec4 result = texture(componentTexture, normalizedIndex2D);
    return result;
}

const vec3 randomConstants = vec3(12.9898, 78.233, 4375.85453);
const vec2 normalRange = vec2(0.0, 1.0);
float rand(vec2 seed, vec2 range) {
    vec2 randomSeed = randomCoefficient * seed;
    float temp = dot(randomConstants.xy, randomSeed);
    temp = fract(sin(temp) * (randomConstants.z + temp));
    return temp * (range.y - range.x) + range.x;
}

bool particleNoSpeed(vec3 particle) {
    vec4 speed = getTextureValue(particlesSpeed, particle);
    return speed.r == 0.0 && speed.g == 0.0;
}

vec3 generateRandomParticle(vec2 seed, float lev) {
    float randomLon = mod(rand(seed, lonRange), 360.0);
    float randomLat = rand(-seed, latRange);

    float height = getTextureValue(H, vec3(randomLon, randomLat, lev)).r;

    return vec3(randomLon, randomLat, height);
}

bool particleOutbound(vec3 particle) {
    return particle.y < viewerLatRange.x || particle.y > viewerLatRange.y || particle.x < viewerLonRange.x || particle.x > viewerLonRange.y;
}

void main() {
    vec3 nextParticle = texture(nextParticlesPosition, v_textureCoordinates).rgb;
    vec4 nextSpeed = texture(particlesSpeed, v_textureCoordinates);
    float speedNorm = nextSpeed.a;
    float particleDropRate = dropRate + dropRateBump * speedNorm;

    vec2 seed1 = nextParticle.xy + v_textureCoordinates;
    vec2 seed2 = nextSpeed.xy + v_textureCoordinates;
    vec3 randomParticle = generateRandomParticle(seed1, nextParticle.z);
    float randomNumber = rand(seed2, normalRange);

    if (randomNumber < particleDropRate || particleOutbound(nextParticle)) {
        fragColor = vec4(randomParticle, 1.0);
    } else {
        fragColor = vec4(nextParticle, 0.0);
    }
}
`;
