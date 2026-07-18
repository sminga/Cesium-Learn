
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
