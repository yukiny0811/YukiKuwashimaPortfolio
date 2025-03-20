// WebGL-based Fluid Simulation that interacts with scrolling
document.addEventListener('DOMContentLoaded', function() {
    console.log('WebGL fluid simulation initializing...');
    
    // Get container element
    const container = document.getElementById('sph-fluid-container');
    if (!container) {
        console.error('Fluid container element not found!');
        return;
    }
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = 500; // Fixed height for the fluid section
    container.appendChild(canvas);
    
    // Get WebGL context
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return;
    }
    
    // Compile shader
    function compileShader(gl, shaderSource, shaderType) {
        const shader = gl.createShader(shaderType);
        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    // Create program from shaders
    function createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        
        return program;
    }
    
    // Vertex shader source
    const vsSource = `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        
        varying vec2 v_texCoord;
        
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }
    `;
    
    // Fragment shader source for fluid simulation
    const fsSource = `
        precision highp float;
        
        uniform sampler2D u_velocity;
        uniform sampler2D u_pressure;
        uniform sampler2D u_dye;
        
        uniform vec2 u_resolution;
        uniform float u_deltaTime;
        uniform vec2 u_gravity;
        uniform float u_viscosity;
        uniform float u_dissipation;
        
        varying vec2 v_texCoord;
        
        // Advection shader
        vec4 advect(sampler2D tex, vec2 coords, vec2 velocity, float dissipation) {
            vec2 pos = coords - velocity * u_deltaTime;
            return texture2D(tex, pos) * dissipation;
        }
        
        // Divergence shader
        float divergence(vec2 velocity, vec2 texelSize) {
            float left = texture2D(u_velocity, v_texCoord - vec2(texelSize.x, 0.0)).x;
            float right = texture2D(u_velocity, v_texCoord + vec2(texelSize.x, 0.0)).x;
            float bottom = texture2D(u_velocity, v_texCoord - vec2(0.0, texelSize.y)).y;
            float top = texture2D(u_velocity, v_texCoord + vec2(0.0, texelSize.y)).y;
            
            return 0.5 * (right - left + top - bottom);
        }
        
        // Pressure gradient shader
        vec2 gradient(float pressure, vec2 texelSize) {
            float left = texture2D(u_pressure, v_texCoord - vec2(texelSize.x, 0.0)).r;
            float right = texture2D(u_pressure, v_texCoord + vec2(texelSize.x, 0.0)).r;
            float bottom = texture2D(u_pressure, v_texCoord - vec2(0.0, texelSize.y)).r;
            float top = texture2D(u_pressure, v_texCoord + vec2(0.0, texelSize.y)).r;
            
            return vec2(right - left, top - bottom) * 0.5;
        }
        
        // Viscosity shader
        vec2 viscosity(vec2 velocity, vec2 texelSize) {
            vec2 left = texture2D(u_velocity, v_texCoord - vec2(texelSize.x, 0.0)).xy;
            vec2 right = texture2D(u_velocity, v_texCoord + vec2(texelSize.x, 0.0)).xy;
            vec2 bottom = texture2D(u_velocity, v_texCoord - vec2(0.0, texelSize.y)).xy;
            vec2 top = texture2D(u_velocity, v_texCoord + vec2(0.0, texelSize.y)).xy;
            vec2 center = texture2D(u_velocity, v_texCoord).xy;
            
            return (left + right + bottom + top - 4.0 * center) * u_viscosity;
        }
        
        void main() {
            vec2 texelSize = 1.0 / u_resolution;
            
            // Advection
            vec2 velocity = texture2D(u_velocity, v_texCoord).xy;
            vec2 advected = advect(u_velocity, v_texCoord, velocity, u_dissipation).xy;
            
            // Add gravity
            advected += u_gravity * u_deltaTime;
            
            // Add viscosity
            advected += viscosity(velocity, texelSize);
            
            // Pressure projection
            float div = divergence(advected, texelSize);
            float pressure = texture2D(u_pressure, v_texCoord).r;
            pressure = (pressure + div) * 0.5;
            
            // Subtract pressure gradient
            advected -= gradient(pressure, texelSize);
            
            // Output final velocity
            gl_FragColor = vec4(advected, pressure, 1.0);
        }
    `;
    
    // Fragment shader for rendering
    const renderFsSource = `
        precision highp float;
        
        uniform sampler2D u_dye;
        varying vec2 v_texCoord;
        
        void main() {
            vec3 color = texture2D(u_dye, v_texCoord).rgb;
            gl_FragColor = vec4(color, 1.0);
        }
    `;
    
    // Compile shaders
    const vertexShader = compileShader(gl, vsSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
    const renderFragmentShader = compileShader(gl, renderFsSource, gl.FRAGMENT_SHADER);
    
    // Create programs
    const fluidProgram = createProgram(gl, vertexShader, fragmentShader);
    const renderProgram = createProgram(gl, vertexShader, renderFragmentShader);
    
    // Create buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
         1.0,  1.0
    ]), gl.STATIC_DRAW);
    
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0
    ]), gl.STATIC_DRAW);
    
    // Create textures
    function createTexture(gl, width, height, format, type, data) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return texture;
    }
    
    // Create framebuffers
    function createFramebuffer(gl, texture) {
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        return framebuffer;
    }
    
    // Simulation parameters
    const simWidth = 256;
    const simHeight = 128;
    const dyeWidth = 1024;
    const dyeHeight = 512;
    
    // Create textures and framebuffers
    const velocityTexture1 = createTexture(gl, simWidth, simHeight, gl.RGBA, gl.FLOAT, null);
    const velocityTexture2 = createTexture(gl, simWidth, simHeight, gl.RGBA, gl.FLOAT, null);
    const pressureTexture1 = createTexture(gl, simWidth, simHeight, gl.RGBA, gl.FLOAT, null);
    const pressureTexture2 = createTexture(gl, simWidth, simHeight, gl.RGBA, gl.FLOAT, null);
    const dyeTexture1 = createTexture(gl, dyeWidth, dyeHeight, gl.RGBA, gl.FLOAT, null);
    const dyeTexture2 = createTexture(gl, dyeWidth, dyeHeight, gl.RGBA, gl.FLOAT, null);
    
    const velocityFBO1 = createFramebuffer(gl, velocityTexture1);
    const velocityFBO2 = createFramebuffer(gl, velocityTexture2);
    const pressureFBO1 = createFramebuffer(gl, pressureTexture1);
    const pressureFBO2 = createFramebuffer(gl, pressureTexture2);
    const dyeFBO1 = createFramebuffer(gl, dyeTexture1);
    const dyeFBO2 = createFramebuffer(gl, dyeTexture2);
    
    // Simulation state
    let currentVelocityTexture = velocityTexture1;
    let currentVelocityFBO = velocityFBO2;
    let currentPressureTexture = pressureTexture1;
    let currentPressureFBO = pressureFBO2;
    let currentDyeTexture = dyeTexture1;
    let currentDyeFBO = dyeFBO2;
    
    // Simulation parameters
    const deltaTime = 0.016;
    const viscosity = 0.1;
    const dissipation = 0.99;
    
    // Gravity parameters
    let gravityX = 0;
    let gravityY = 9.8; // Default gravity pointing down
    let lastScrollY = window.scrollY;
    let scrollDelta = 0;
    let scrollVelocity = 0;
    
    // Get uniform locations
    gl.useProgram(fluidProgram);
    const resolutionLocation = gl.getUniformLocation(fluidProgram, 'u_resolution');
    const deltaTimeLocation = gl.getUniformLocation(fluidProgram, 'u_deltaTime');
    const gravityLocation = gl.getUniformLocation(fluidProgram, 'u_gravity');
    const viscosityLocation = gl.getUniformLocation(fluidProgram, 'u_viscosity');
    const dissipationLocation = gl.getUniformLocation(fluidProgram, 'u_dissipation');
    const velocityLocation = gl.getUniformLocation(fluidProgram, 'u_velocity');
    const pressureLocation = gl.getUniformLocation(fluidProgram, 'u_pressure');
    const dyeLocation = gl.getUniformLocation(fluidProgram, 'u_dye');
    
    gl.useProgram(renderProgram);
    const renderDyeLocation = gl.getUniformLocation(renderProgram, 'u_dye');
    
    // Set up attributes
    function setupAttributes(program) {
        gl.useProgram(program);
        
        const positionLocation = gl.getAttribLocation(program, 'a_position');
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        
        const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
    }
    
    // Simulation step
    function step() {
        // Swap textures and framebuffers
        const tempVelocityTexture = currentVelocityTexture;
        currentVelocityTexture = currentVelocityFBO === velocityFBO1 ? velocityTexture2 : velocityTexture1;
        currentVelocityFBO = currentVelocityFBO === velocityFBO1 ? velocityFBO2 : velocityFBO1;
        
        const tempPressureTexture = currentPressureTexture;
        currentPressureTexture = currentPressureFBO === pressureFBO1 ? pressureTexture2 : pressureTexture1;
        currentPressureFBO = currentPressureFBO === pressureFBO1 ? pressureFBO2 : pressureFBO1;
        
        const tempDyeTexture = currentDyeTexture;
        currentDyeTexture = currentDyeFBO === dyeFBO1 ? dyeTexture2 : dyeTexture1;
        currentDyeFBO = currentDyeFBO === dyeFBO1 ? dyeFBO2 : dyeFBO1;
        
        // Update fluid simulation
        gl.bindFramebuffer(gl.FRAMEBUFFER, currentVelocityFBO);
        gl.viewport(0, 0, simWidth, simHeight);
        
        gl.useProgram(fluidProgram);
        gl.uniform2f(resolutionLocation, simWidth, simHeight);
        gl.uniform1f(deltaTimeLocation, deltaTime);
        gl.uniform2f(gravityLocation, gravityX, gravityY);
        gl.uniform1f(viscosityLocation, viscosity);
        gl.uniform1f(dissipationLocation, dissipation);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tempVelocityTexture);
        gl.uniform1i(velocityLocation, 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tempPressureTexture);
        gl.uniform1i(pressureLocation, 1);
        
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, tempDyeTexture);
        gl.uniform1i(dyeLocation, 2);
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        // Render to canvas
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        
        gl.useProgram(renderProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentDyeTexture);
        gl.uniform1i(renderDyeLocation, 0);
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    
    // Add fluid
    function addFluid(x, y, vx, vy, r, g, b) {
        const posX = x / canvas.width;
        const posY = y / canvas.height;
        const radius = 0.03;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, currentVelocityFBO);
        gl.viewport(0, 0, simWidth, simHeight);
        
        // Add velocity
        // Implementation would go here
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, currentDyeFBO);
        gl.viewport(0, 0, dyeWidth, dyeHeight);
        
        // Add dye
        // Implementation would go here
    }
    
    // Initialize
    setupAttributes(fluidProgram);
    setupAttributes(renderProgram);
    
    // Animation loop
    function animate() {
        step();
        requestAnimationFrame(animate);
    }
    
    // Handle window resize
    window.addEventListener('resize', function() {
        canvas.width = window.innerWidth;
        // Height stays fixed
    });
    
    // Handle scroll events
    window.addEventListener('scroll', function() {
        const currentScrollY = window.scrollY;
        scrollDelta = currentScrollY - lastScrollY;
        lastScrollY = currentScrollY;
        
        // Calculate scroll velocity (pixels per second)
        scrollVelocity = scrollDelta / deltaTime;
        
        // Update gravity based on scroll direction and speed
        // When scrolling down, it should feel like the canvas is moving up
        // When scrolling up, it should feel like the canvas is moving down
        const maxScrollVelocity = 1000; // Maximum scroll velocity to consider
        const normalizedScrollVelocity = Math.min(Math.abs(scrollVelocity), maxScrollVelocity) / maxScrollVelocity;
        
        if (scrollDelta > 0) {
            // Scrolling down - canvas moves up, so particles should appear to move down
            gravityY = 9.8 + normalizedScrollVelocity * 20;
        } else if (scrollDelta < 0) {
            // Scrolling up - canvas moves down, so particles should appear to move up
            gravityY = 9.8 - normalizedScrollVelocity * 20;
        } else {
            // Not scrolling - normal gravity
            gravityY = 9.8;
        }
        
        // Gradually reset gravity when not scrolling
        setTimeout(function() {
            if (Math.abs(scrollDelta) < 0.1) {
                gravityY = 9.8; // Reset to default gravity
            }
        }, 100);
    });
    
    // Start animation
    animate();
    
    // Add some initial fluid
    for (let i = 0; i < 10; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const vx = (Math.random() - 0.5) * 10;
        const vy = (Math.random() - 0.5) * 10;
        const r = Math.random();
        const g = Math.random();
        const b = Math.random();
        
        addFluid(x, y, vx, vy, r, g, b);
    }
});
