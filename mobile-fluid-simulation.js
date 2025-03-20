// Simplified Fluid Simulation for Mobile Devices
// Based on the original fluid-simulation.js but with reduced complexity for better performance

document.addEventListener('DOMContentLoaded', function() {
    console.log('Mobile fluid simulation initializing...');
    
    // Get container element
    const container = document.getElementById('webgl-fluid-container');
    if (!container) {
        console.error('WebGL fluid container element not found!');
        return;
    }
    console.log('WebGL fluid container found:', container);
    
    // Create canvas
    let canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    container.appendChild(canvas);
    console.log('Canvas created with dimensions:', canvas.width, 'x', canvas.height);
    
    // Get WebGL context
    let gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return;
    }
    console.log('WebGL context created successfully');
    
    // Simulation parameters - REDUCED for mobile
    const GRID_SCALE = 3.0; // Increased scale (lower resolution)
    let GRID_WIDTH = Math.floor(canvas.width / GRID_SCALE);
    let GRID_HEIGHT = Math.floor(canvas.height / GRID_SCALE);
    const DT = 0.15;
    const ITERATIONS = 10; // Reduced iterations
    const VISCOSITY = 0.0;
    const VELOCITY_DISSIPATION = 0.99;
    const DENSITY_DISSIPATION = 0.99;
    const FORCE_MULTIPLIER = 800.0;
    const COLOR_MULTIPLIER = 8.0;
    const SPLAT_RADIUS = 0.015;
    
    // Mouse interaction variables
    let mouseX = 0.5;
    let mouseY = 0.5;
    let prevMouseX = 0.5;
    let prevMouseY = 0.5;
    let mouseDown = false;
    
    // Shader sources
    const vertexShaderSource = `
        attribute vec2 a_position;
        varying vec2 v_texCoord;
        
        void main() {
            v_texCoord = a_position * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;
    
    // Simplified advect shader
    const advectShaderSource = `
        precision mediump float;
        
        uniform sampler2D u_velocity;
        uniform sampler2D u_source;
        uniform vec2 u_resolution;
        uniform float u_dt;
        uniform float u_dissipation;
        
        varying vec2 v_texCoord;
        
        void main() {
            vec2 texelSize = 1.0 / u_resolution;
            vec2 pos = v_texCoord - u_dt * texture2D(u_velocity, v_texCoord).xy * texelSize;
            pos = clamp(pos, texelSize, 1.0 - texelSize);
            gl_FragColor = u_dissipation * texture2D(u_source, pos);
        }
    `;
    
    const divergenceShaderSource = `
        precision mediump float;
        
        uniform sampler2D u_velocity;
        uniform vec2 u_resolution;
        
        varying vec2 v_texCoord;
        
        void main() {
            vec2 texelSize = 1.0 / u_resolution;
            
            float n = texture2D(u_velocity, v_texCoord + vec2(0.0, texelSize.y)).y;
            float s = texture2D(u_velocity, v_texCoord - vec2(0.0, texelSize.y)).y;
            float e = texture2D(u_velocity, v_texCoord + vec2(texelSize.x, 0.0)).x;
            float w = texture2D(u_velocity, v_texCoord - vec2(texelSize.x, 0.0)).x;
            
            float divergence = 0.5 * (e - w + n - s);
            gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
        }
    `;
    
    const pressureShaderSource = `
        precision mediump float;
        
        uniform sampler2D u_pressure;
        uniform sampler2D u_divergence;
        uniform vec2 u_resolution;
        
        varying vec2 v_texCoord;
        
        void main() {
            vec2 texelSize = 1.0 / u_resolution;
            
            float n = texture2D(u_pressure, v_texCoord + vec2(0.0, texelSize.y)).r;
            float s = texture2D(u_pressure, v_texCoord - vec2(0.0, texelSize.y)).r;
            float e = texture2D(u_pressure, v_texCoord + vec2(texelSize.x, 0.0)).r;
            float w = texture2D(u_pressure, v_texCoord - vec2(texelSize.x, 0.0)).r;
            float divergence = texture2D(u_divergence, v_texCoord).r;
            
            float pressure = (n + s + e + w - divergence) * 0.25;
            gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
        }
    `;
    
    const gradientSubtractShaderSource = `
        precision mediump float;
        
        uniform sampler2D u_pressure;
        uniform sampler2D u_velocity;
        uniform vec2 u_resolution;
        
        varying vec2 v_texCoord;
        
        void main() {
            vec2 texelSize = 1.0 / u_resolution;
            
            float n = texture2D(u_pressure, v_texCoord + vec2(0.0, texelSize.y)).r;
            float s = texture2D(u_pressure, v_texCoord - vec2(0.0, texelSize.y)).r;
            float e = texture2D(u_pressure, v_texCoord + vec2(texelSize.x, 0.0)).r;
            float w = texture2D(u_pressure, v_texCoord - vec2(texelSize.x, 0.0)).r;
            
            vec2 velocity = texture2D(u_velocity, v_texCoord).xy;
            velocity.xy -= 0.5 * vec2(e - w, n - s);
            
            gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
    `;
    
    const addForceShaderSource = `
        precision mediump float;
        
        uniform sampler2D u_velocity;
        uniform vec2 u_point;
        uniform vec2 u_force;
        uniform float u_radius;
        
        varying vec2 v_texCoord;
        
        void main() {
            vec2 p = v_texCoord - u_point;
            float d = length(p);
            
            if (d < u_radius) {
                float strength = 1.0 - d / u_radius;
                vec2 force = u_force * strength;
                vec2 velocity = texture2D(u_velocity, v_texCoord).xy;
                velocity += force;
                gl_FragColor = vec4(velocity, 0.0, 1.0);
            } else {
                gl_FragColor = texture2D(u_velocity, v_texCoord);
            }
        }
    `;
    
    const addDensityShaderSource = `
        precision mediump float;
        
        uniform sampler2D u_density;
        uniform vec2 u_point;
        uniform vec3 u_color;
        uniform float u_radius;
        
        varying vec2 v_texCoord;
        
        void main() {
            vec2 p = v_texCoord - u_point;
            float d = length(p);
            
            if (d < u_radius) {
                float strength = 1.0 - d / u_radius;
                vec3 density = texture2D(u_density, v_texCoord).rgb;
                density += u_color * strength;
                gl_FragColor = vec4(density, 1.0);
            } else {
                gl_FragColor = texture2D(u_density, v_texCoord);
            }
        }
    `;
    
    // Simplified display shader
    const displayShaderSource = `
        precision mediump float;
        
        uniform sampler2D u_density;
        uniform vec3 u_color1;
        uniform vec3 u_color2;
        uniform vec3 u_color3;
        uniform float u_time;
        
        varying vec2 v_texCoord;
        
        void main() {
            vec3 density = texture2D(u_density, v_texCoord).rgb;
            
            // Simplified color calculation
            float t = u_time * 0.03;
            vec3 baseColor = mix(u_color1, u_color2, 0.5 + 0.5 * sin(t));
            baseColor = mix(baseColor, u_color3, 0.5 + 0.5 * cos(t * 0.7));
            
            // Apply density to color
            vec3 finalColor = baseColor + density * 1.5;
            
            // Simple vignette
            float vignette = 1.0 - length(v_texCoord - 0.5) * 0.7;
            
            gl_FragColor = vec4(finalColor * vignette, 0.95);
        }
    `;
    
    // Compile shader
    function compileShader(source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    // Create program
    function createProgram(vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }
        
        return program;
    }
    
    // Create framebuffer
    function createFramebuffer(texture) {
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return framebuffer;
    }
    
    // Create texture
    function createTexture(width, height) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }
    
    // Create double buffer
    function createDoubleBuffer(width, height) {
        const read = createTexture(width, height);
        const write = createTexture(width, height);
        const readFBO = createFramebuffer(read);
        const writeFBO = createFramebuffer(write);
        
        return {
            read,
            write,
            readFBO,
            writeFBO,
            swap() {
                const temp = this.read;
                this.read = this.write;
                this.write = temp;
                
                const tempFBO = this.readFBO;
                this.readFBO = this.writeFBO;
                this.writeFBO = tempFBO;
            }
        };
    }
    
    // Clear texture
    function clearTexture(texture, framebuffer) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    // Compile shaders
    let vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    let advectFragmentShader = compileShader(advectShaderSource, gl.FRAGMENT_SHADER);
    let divergenceFragmentShader = compileShader(divergenceShaderSource, gl.FRAGMENT_SHADER);
    let pressureFragmentShader = compileShader(pressureShaderSource, gl.FRAGMENT_SHADER);
    let gradientSubtractFragmentShader = compileShader(gradientSubtractShaderSource, gl.FRAGMENT_SHADER);
    let addForceFragmentShader = compileShader(addForceShaderSource, gl.FRAGMENT_SHADER);
    let addDensityFragmentShader = compileShader(addDensityShaderSource, gl.FRAGMENT_SHADER);
    let displayFragmentShader = compileShader(displayShaderSource, gl.FRAGMENT_SHADER);
    
    // Create programs
    let advectProgram = createProgram(vertexShader, advectFragmentShader);
    let divergenceProgram = createProgram(vertexShader, divergenceFragmentShader);
    let pressureProgram = createProgram(vertexShader, pressureFragmentShader);
    let gradientSubtractProgram = createProgram(vertexShader, gradientSubtractFragmentShader);
    let addForceProgram = createProgram(vertexShader, addForceFragmentShader);
    let addDensityProgram = createProgram(vertexShader, addDensityFragmentShader);
    let displayProgram = createProgram(vertexShader, displayFragmentShader);
    
    // Get uniform locations
    const advectUniforms = {
        velocity: gl.getUniformLocation(advectProgram, 'u_velocity'),
        source: gl.getUniformLocation(advectProgram, 'u_source'),
        resolution: gl.getUniformLocation(advectProgram, 'u_resolution'),
        dt: gl.getUniformLocation(advectProgram, 'u_dt'),
        dissipation: gl.getUniformLocation(advectProgram, 'u_dissipation')
    };
    
    const divergenceUniforms = {
        velocity: gl.getUniformLocation(divergenceProgram, 'u_velocity'),
        resolution: gl.getUniformLocation(divergenceProgram, 'u_resolution')
    };
    
    const pressureUniforms = {
        pressure: gl.getUniformLocation(pressureProgram, 'u_pressure'),
        divergence: gl.getUniformLocation(pressureProgram, 'u_divergence'),
        resolution: gl.getUniformLocation(pressureProgram, 'u_resolution')
    };
    
    const gradientSubtractUniforms = {
        pressure: gl.getUniformLocation(gradientSubtractProgram, 'u_pressure'),
        velocity: gl.getUniformLocation(gradientSubtractProgram, 'u_velocity'),
        resolution: gl.getUniformLocation(gradientSubtractProgram, 'u_resolution')
    };
    
    const addForceUniforms = {
        velocity: gl.getUniformLocation(addForceProgram, 'u_velocity'),
        point: gl.getUniformLocation(addForceProgram, 'u_point'),
        force: gl.getUniformLocation(addForceProgram, 'u_force'),
        radius: gl.getUniformLocation(addForceProgram, 'u_radius')
    };
    
    const addDensityUniforms = {
        density: gl.getUniformLocation(addDensityProgram, 'u_density'),
        point: gl.getUniformLocation(addDensityProgram, 'u_point'),
        color: gl.getUniformLocation(addDensityProgram, 'u_color'),
        radius: gl.getUniformLocation(addDensityProgram, 'u_radius')
    };
    
    const displayUniforms = {
        density: gl.getUniformLocation(displayProgram, 'u_density'),
        color1: gl.getUniformLocation(displayProgram, 'u_color1'),
        color2: gl.getUniformLocation(displayProgram, 'u_color2'),
        color3: gl.getUniformLocation(displayProgram, 'u_color3'),
        time: gl.getUniformLocation(displayProgram, 'u_time')
    };
    
    // Create buffers
    let velocityBuffer = createDoubleBuffer(GRID_WIDTH, GRID_HEIGHT);
    let densityBuffer = createDoubleBuffer(GRID_WIDTH, GRID_HEIGHT);
    let divergenceTexture = createTexture(GRID_WIDTH, GRID_HEIGHT);
    let divergenceFBO = createFramebuffer(divergenceTexture);
    let pressureBuffer = createDoubleBuffer(GRID_WIDTH, GRID_HEIGHT);
    
    // Clear buffers
    clearTexture(velocityBuffer.read, velocityBuffer.readFBO);
    clearTexture(velocityBuffer.write, velocityBuffer.writeFBO);
    clearTexture(densityBuffer.read, densityBuffer.readFBO);
    clearTexture(densityBuffer.write, densityBuffer.writeFBO);
    clearTexture(divergenceTexture, divergenceFBO);
    clearTexture(pressureBuffer.read, pressureBuffer.readFBO);
    clearTexture(pressureBuffer.write, pressureBuffer.writeFBO);
    
    // Create quad vertices
    const vertices = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
         1.0,  1.0
    ]);
    
    let vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    // Set up vertex attributes for all programs
    function setupVertexAttribForProgram(program) {
        gl.useProgram(program);
        const positionAttribLocation = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(positionAttribLocation);
        gl.vertexAttribPointer(positionAttribLocation, 2, gl.FLOAT, false, 0, 0);
    }
    
    // Setup vertex attributes for all shader programs
    setupVertexAttribForProgram(advectProgram);
    setupVertexAttribForProgram(divergenceProgram);
    setupVertexAttribForProgram(pressureProgram);
    setupVertexAttribForProgram(gradientSubtractProgram);
    setupVertexAttribForProgram(addForceProgram);
    setupVertexAttribForProgram(addDensityProgram);
    setupVertexAttribForProgram(displayProgram);
    
    // Set viewport
    gl.viewport(0, 0, canvas.width, canvas.height);
    
    // Event listeners
    canvas.addEventListener('mousemove', function(e) {
        const rect = canvas.getBoundingClientRect();
        prevMouseX = mouseX;
        prevMouseY = mouseY;
        mouseX = (e.clientX - rect.left) / canvas.width;
        mouseY = 1.0 - (e.clientY - rect.top) / canvas.height;
    });
    
    canvas.addEventListener('mousedown', function() {
        mouseDown = true;
    });
    
    canvas.addEventListener('mouseup', function() {
        mouseDown = false;
    });
    
    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        prevMouseX = mouseX;
        prevMouseY = mouseY;
        mouseX = (e.touches[0].clientX - rect.left) / canvas.width;
        mouseY = 1.0 - (e.touches[0].clientY - rect.top) / canvas.height;
    }, { passive: false });
    
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        mouseDown = true;
        const rect = canvas.getBoundingClientRect();
        mouseX = (e.touches[0].clientX - rect.left) / canvas.width;
        mouseY = 1.0 - (e.touches[0].clientY - rect.top) / canvas.height;
        prevMouseX = mouseX;
        prevMouseY = mouseY;
    }, { passive: false });
    
    canvas.addEventListener('touchend', function() {
        mouseDown = false;
    });
    
    // Handle window resize with throttling
    let resizeTimeout;
    window.addEventListener('resize', function() {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        
        resizeTimeout = setTimeout(function() {
            console.log('Resizing mobile fluid simulation...');
            
            // Update canvas dimensions
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            
            // Update grid dimensions
            GRID_WIDTH = Math.floor(canvas.width / GRID_SCALE);
            GRID_HEIGHT = Math.floor(canvas.height / GRID_SCALE);
            
            // Update viewport
            gl.viewport(0, 0, canvas.width, canvas.height);
            
            // Recreate buffers with new dimensions
            velocityBuffer = createDoubleBuffer(GRID_WIDTH, GRID_HEIGHT);
            densityBuffer = createDoubleBuffer(GRID_WIDTH, GRID_HEIGHT);
            divergenceTexture = createTexture(GRID_WIDTH, GRID_HEIGHT);
            divergenceFBO = createFramebuffer(divergenceTexture);
            pressureBuffer = createDoubleBuffer(GRID_WIDTH, GRID_HEIGHT);
            
            // Clear buffers
            clearTexture(velocityBuffer.read, velocityBuffer.readFBO);
            clearTexture(velocityBuffer.write, velocityBuffer.writeFBO);
            clearTexture(densityBuffer.read, densityBuffer.readFBO);
            clearTexture(densityBuffer.write, densityBuffer.writeFBO);
            clearTexture(divergenceTexture, divergenceFBO);
            clearTexture(pressureBuffer.read, pressureBuffer.readFBO);
            clearTexture(pressureBuffer.write, pressureBuffer.writeFBO);
            
            // Initialize fluid with new dimensions
            initializeFluid();
        }, 500); // Longer throttle for mobile
    });
    
    // Initialize with some fluid motion
    function initializeFluid() {
        // Create a simpler pattern for mobile
        const centerX = 0.5;
        const centerY = 0.5;
        const numPoints = 6; // Reduced number of points
        const radius = 0.3;
        
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            // Tangential velocity for vortex
            const dx = -Math.sin(angle) * 0.02;
            const dy = Math.cos(angle) * 0.02;
            
            // Add force
            gl.useProgram(addForceProgram);
            gl.uniform2f(addForceUniforms.resolution, GRID_WIDTH, GRID_HEIGHT);
            gl.uniform2f(addForceUniforms.point, x, y);
            gl.uniform2f(addForceUniforms.force, dx * FORCE_MULTIPLIER, dy * FORCE_MULTIPLIER);
            gl.uniform1f(addForceUniforms.radius, 0.08);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, velocityBuffer.read);
            gl.uniform1i(addForceUniforms.velocity, 0);
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, velocityBuffer.writeFBO);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            velocityBuffer.swap();
            
            // Add density
            const hue = i / numPoints;
            const r = 0.5 + 0.5 * Math.sin(hue * Math.PI * 2);
            const g = 0.5 + 0.5 * Math.sin(hue * Math.PI * 2 + 2.0);
            const b = 0.5 + 0.5 * Math.sin(hue * Math.PI * 2 + 4.0);
            
            gl.useProgram(addDensityProgram);
            gl.uniform2f(addDensityUniforms.point, x, y);
            gl.uniform3f(addDensityUniforms.color, r, g, b);
            gl.uniform1f(addDensityUniforms.radius, 0.08);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, densityBuffer.read);
            gl.uniform1i(addDensityUniforms.density, 0);
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, densityBuffer.writeFBO);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            densityBuffer.swap();
        }
    }
    
    // Add force from mouse
    function addForce() {
        const dx = mouseX - prevMouseX;
        const dy = mouseY - prevMouseY;
        
        // Only add force if there's significant mouse movement or if mouse is down
        if ((Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) || mouseDown) {
            // Calculate force based on mouse movement
            let forceX = dx * FORCE_MULTIPLIER * 3.0;
            let forceY = dy * FORCE_MULTIPLIER * 3.0;
            
            // Adjust radius and force based on whether mouse is down
            const radiusMultiplier = mouseDown ? 1.5 : 1.0;
            const colorIntensity = mouseDown ? COLOR_MULTIPLIER : COLOR_MULTIPLIER * 0.8;
            
            gl.useProgram(addForceProgram);
            gl.uniform2f(addForceUniforms.point, mouseX, mouseY);
            gl.uniform2f(addForceUniforms.force, forceX, forceY);
            gl.uniform1f(addForceUniforms.radius, SPLAT_RADIUS * radiusMultiplier);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, velocityBuffer.read);
            gl.uniform1i(addForceUniforms.velocity, 0);
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, velocityBuffer.writeFBO);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            velocityBuffer.swap();
            
            // Add density with dynamic colors
            const time = Date.now() * 0.001;
            const r = 0.5 + 0.5 * Math.sin(time);
            const g = 0.5 + 0.5 * Math.sin(time + 2.0);
            const b = 0.5 + 0.5 * Math.sin(time + 4.0);
            
            gl.useProgram(addDensityProgram);
            gl.uniform2f(addDensityUniforms.point, mouseX, mouseY);
            gl.uniform3f(addDensityUniforms.color, r * colorIntensity, g * colorIntensity, b * colorIntensity);
            gl.uniform1f(addDensityUniforms.radius, SPLAT_RADIUS * radiusMultiplier);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, densityBuffer.read);
            gl.uniform1i(addDensityUniforms.density, 0);
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, densityBuffer.writeFBO);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            densityBuffer.swap();
        }
    }
    
    // Advect velocity and density
    function advect() {
        gl.useProgram(advectProgram);
        gl.uniform2f(advectUniforms.resolution, GRID_WIDTH, GRID_HEIGHT);
        gl.uniform1f(advectUniforms.dt, DT);
        
        // Advect velocity
        gl.uniform1f(advectUniforms.dissipation, VELOCITY_DISSIPATION);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, velocityBuffer.read);
        gl.uniform1i(advectUniforms.velocity, 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, velocityBuffer.read);
        gl.uniform1i(advectUniforms.source, 1);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, velocityBuffer.writeFBO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        velocityBuffer.swap();
        
        // Advect density
        gl.uniform1f(advectUniforms.dissipation, DENSITY_DISSIPATION);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, velocityBuffer.read);
        gl.uniform1i(advectUniforms.velocity, 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, densityBuffer.read);
        gl.uniform1i(advectUniforms.source, 1);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, densityBuffer.writeFBO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        densityBuffer.swap();
    }
    
    // Compute divergence
    function computeDivergence() {
        gl.useProgram(divergenceProgram);
        gl.uniform2f(divergenceUniforms.resolution, GRID_WIDTH, GRID_HEIGHT);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, velocityBuffer.read);
        gl.uniform1i(divergenceUniforms.velocity, 0);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, divergenceFBO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    
    // Solve pressure
    function solvePressure() {
        gl.useProgram(pressureProgram);
        gl.uniform2f(pressureUniforms.resolution, GRID_WIDTH, GRID_HEIGHT);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, divergenceTexture);
        gl.uniform1i(pressureUniforms.divergence, 1);
        
        // Clear pressure
        clearTexture(pressureBuffer.read, pressureBuffer.readFBO);
        clearTexture(pressureBuffer.write, pressureBuffer.writeFBO);
        
        // Jacobi iteration
        for (let i = 0; i < ITERATIONS; i++) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, pressureBuffer.read);
            gl.uniform1i(pressureUniforms.pressure, 0);
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, pressureBuffer.writeFBO);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            pressureBuffer.swap();
        }
    }
    
    // Subtract pressure gradient
    function subtractPressureGradient() {
        gl.useProgram(gradientSubtractProgram);
        gl.uniform2f(gradientSubtractUniforms.resolution, GRID_WIDTH, GRID_HEIGHT);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, pressureBuffer.read);
        gl.uniform1i(gradientSubtractUniforms.pressure, 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, velocityBuffer.read);
        gl.uniform1i(gradientSubtractUniforms.velocity, 1);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, velocityBuffer.writeFBO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        velocityBuffer.swap();
    }
    
    // Display the result
    function display() {
        gl.useProgram(displayProgram);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, densityBuffer.read);
        gl.uniform1i(displayUniforms.density, 0);
        
        gl.uniform3f(displayUniforms.color1, 0.1, 0.14, 0.39); // Deep blue
        gl.uniform3f(displayUniforms.color2, 0.24, 0.57, 0.8); // Bright blue
        gl.uniform3f(displayUniforms.color3, 0.54, 0.31, 1.0); // Purple
        gl.uniform1f(displayUniforms.time, Date.now() * 0.001);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    
    // Simulation step
    function step() {
        // Add forces from user interaction
        addForce();
        
        // Advect velocity and density
        advect();
        
        // Compute divergence
        computeDivergence();
        
        // Solve pressure
        solvePressure();
        
        // Subtract pressure gradient
        subtractPressureGradient();
        
        // Display the result
        display();
    }
    
    // Animation loop with frame skipping for mobile
    let frameCount = 0;
    let animationFrameId = null;
    let skipFrames = 1; // Skip every other frame on mobile
    
    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        
        // Skip frames to improve performance
        if (frameCount % (skipFrames + 1) === 0) {
            step();
        }
        
        frameCount++;
    }
    
    // Initialize and start animation
    console.log('Initializing mobile fluid simulation...');
    initializeFluid();
    console.log('Starting animation loop...');
    animate();
    
    // Debug: Force some visible fluid motion
    console.log('Adding debug fluid motion...');
    // Simulate a mouse drag to create visible fluid motion
    mouseDown = true;
    mouseX = 0.3;
    mouseY = 0.3;
    prevMouseX = 0.5;
    prevMouseY = 0.5;
    addForce();
    mouseX = 0.7;
    mouseY = 0.7;
    addForce();
    mouseDown = false;
});
