
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
        percent.z = (abs(speed.z) - wRange.x) / (wSpeedRange.y - wRange.x);
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
