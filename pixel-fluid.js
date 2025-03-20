// Pixel-based Fluid Simulation that interacts with scrolling
document.addEventListener('DOMContentLoaded', function() {
    console.log('Pixel fluid simulation initializing...');
    
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
        console.error('WebGL not supported, falling back to Canvas 2D');
        initCanvas2D();
        return;
    }
    
    // Fallback to Canvas 2D if WebGL is not supported
    function initCanvas2D() {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Canvas 2D not supported');
            return;
        }
        
        // Particle system
        const particles = [];
        const particleCount = 8000; // More particles
        const particleSize = 4; // Larger square particles
        const particleColor = '#4a90e2'; // Blue color
        
        // Initialize particles
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: canvas.height - Math.random() * (canvas.height / 3), // Start mostly at bottom
                vx: 0,
                vy: 0,
                size: particleSize
            });
        }
        
        // Gravity and scroll parameters
        let gravity = 0.1;
        let lastScrollY = window.scrollY;
        let scrollDelta = 0;
        
        // Animation loop
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = particleColor;
            
            // Update and draw particles
            for (let i = 0; i < particleCount; i++) {
                const p = particles[i];
                
                // Apply gravity
                p.vy += gravity;
                
                // Apply scroll effect
                p.vy += scrollDelta * 0.05;
                
                // Update position
                p.x += p.vx;
                p.y += p.vy;
                
                // Boundary checks
                if (p.x < 0) {
                    p.x = 0;
                    p.vx *= -0.5;
                } else if (p.x > canvas.width) {
                    p.x = canvas.width;
                    p.vx *= -0.5;
                }
                
                if (p.y < 0) {
                    p.y = 0;
                    p.vy *= -0.5;
                } else if (p.y > canvas.height) {
                    p.y = canvas.height;
                    p.vy *= -0.5;
                }
                
                // Draw particle with volume
                const gradient = ctx.createRadialGradient(
                    p.x + p.size/2, p.y + p.size/2, 0,
                    p.x + p.size/2, p.y + p.size/2, p.size
                );
                gradient.addColorStop(0, 'rgba(100, 170, 255, 0.9)'); // Lighter blue in center
                gradient.addColorStop(1, 'rgba(74, 144, 226, 0.6)'); // Fade out at edges
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(p.x + p.size/2, p.y + p.size/2, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Reset scroll delta
            scrollDelta *= 0.9;
            
            requestAnimationFrame(animate);
        }
        
        // Handle scroll events
        window.addEventListener('scroll', function() {
            const currentScrollY = window.scrollY;
            scrollDelta = currentScrollY - lastScrollY;
            lastScrollY = currentScrollY;
        });
        
        // Handle window resize
        window.addEventListener('resize', function() {
            canvas.width = window.innerWidth;
        });
        
        // Start animation
        animate();
    }
    
    // WebGL implementation
    // Shader sources
    const vertexShaderSource = `
        attribute vec2 a_position;
        attribute vec2 a_velocity;
        attribute float a_size;
        
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_gravity;
        uniform float u_scrollDelta;
        
        varying vec2 v_position;
        varying vec2 v_velocity;
        varying float v_size;
        
        void main() {
            // Update velocity with gravity and scroll
            vec2 velocity = a_velocity;
            velocity.y += u_gravity;
            velocity.y += u_scrollDelta * 0.05;
            
            // Update position
            vec2 position = a_position + velocity;
            
            // Boundary checks
            if (position.x < 0.0) {
                position.x = 0.0;
                velocity.x *= -0.5;
            } else if (position.x > u_resolution.x) {
                position.x = u_resolution.x;
                velocity.x *= -0.5;
            }
            
            if (position.y < 0.0) {
                position.y = 0.0;
                velocity.y *= -0.5;
            } else if (position.y > u_resolution.y) {
                position.y = u_resolution.y;
                velocity.y *= -0.5;
            }
            
            // Convert to clip space
            vec2 clipSpace = (position / u_resolution) * 2.0 - 1.0;
            clipSpace.y *= -1.0; // Flip y
            
            gl_Position = vec4(clipSpace, 0, 1);
            gl_PointSize = a_size;
            
            // Pass to fragment shader
            v_position = position;
            v_velocity = velocity;
            v_size = a_size;
        }
    `;
    
    const fragmentShaderSource = `
        precision mediump float;
        
        uniform vec4 u_color;
        
        void main() {
            // Create rounded particles with volume
            vec2 coord = gl_PointCoord - vec2(0.5);
            float dist = length(coord);
            
            // Soft circle with volume effect
            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            
            // Add a highlight to create volume effect
            float highlight = smoothstep(0.4, 0.0, dist);
            vec3 color = u_color.rgb * (1.0 + highlight * 0.5);
            
            gl_FragColor = vec4(color, u_color.a * alpha);
        }
    `;
    
    // Create shader program
    function createShader(gl, type, source) {
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
    
    // Create shaders and program
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);
    
    if (!program) {
        console.error('Failed to create shader program');
        return;
    }
    
    // Get attribute and uniform locations
    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const velocityAttributeLocation = gl.getAttribLocation(program, 'a_velocity');
    const sizeAttributeLocation = gl.getAttribLocation(program, 'a_size');
    
    const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');
    const timeUniformLocation = gl.getUniformLocation(program, 'u_time');
    const gravityUniformLocation = gl.getUniformLocation(program, 'u_gravity');
    const scrollDeltaUniformLocation = gl.getUniformLocation(program, 'u_scrollDelta');
    const colorUniformLocation = gl.getUniformLocation(program, 'u_color');
    
    // Create buffers
    const positionBuffer = gl.createBuffer();
    const velocityBuffer = gl.createBuffer();
    const sizeBuffer = gl.createBuffer();
    
    // Particle system
    const particleCount = 10000; // Large number of particles
    const positions = new Float32Array(particleCount * 2);
    const velocities = new Float32Array(particleCount * 2);
    const sizes = new Float32Array(particleCount);
    
    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
        const i2 = i * 2;
        
        // Position - mostly at bottom
        positions[i2] = Math.random() * canvas.width;
        positions[i2 + 1] = canvas.height - Math.random() * (canvas.height / 2);
        
        // Velocity - small random values
        velocities[i2] = (Math.random() - 0.5) * 0.5;
        velocities[i2 + 1] = (Math.random() - 0.5) * 0.5;
        
        // Size - even larger particles for more volume
        sizes[i] = 8.0;
    }
    
    // Gravity and scroll parameters
    let gravity = 0.1;
    let lastScrollY = window.scrollY;
    let scrollDelta = 0;
    
    // Set up buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, velocities, gl.DYNAMIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);
    
    // Animation loop
    function render(time) {
        // Resize canvas to match container
        if (canvas.width !== container.clientWidth) {
            canvas.width = container.clientWidth;
        }
        
        // Clear canvas
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Use program
        gl.useProgram(program);
        
        // Set uniforms
        gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
        gl.uniform1f(timeUniformLocation, time * 0.001);
        gl.uniform1f(gravityUniformLocation, gravity);
        gl.uniform1f(scrollDeltaUniformLocation, scrollDelta);
        gl.uniform4f(colorUniformLocation, 0.29, 0.56, 0.89, 1.0); // Blue color with full opacity
        
        // Set attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffer);
        gl.enableVertexAttribArray(velocityAttributeLocation);
        gl.vertexAttribPointer(velocityAttributeLocation, 2, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
        gl.enableVertexAttribArray(sizeAttributeLocation);
        gl.vertexAttribPointer(sizeAttributeLocation, 1, gl.FLOAT, false, 0, 0);
        
        // Draw points
        gl.drawArrays(gl.POINTS, 0, particleCount);
        
        // Update positions and velocities
        for (let i = 0; i < particleCount; i++) {
            const i2 = i * 2;
            
            // Update velocity with gravity and scroll
            velocities[i2 + 1] += gravity;
            velocities[i2 + 1] += scrollDelta * 0.05;
            
            // Update position
            positions[i2] += velocities[i2];
            positions[i2 + 1] += velocities[i2 + 1];
            
            // Boundary checks
            if (positions[i2] < 0) {
                positions[i2] = 0;
                velocities[i2] *= -0.5;
            } else if (positions[i2] > canvas.width) {
                positions[i2] = canvas.width;
                velocities[i2] *= -0.5;
            }
            
            if (positions[i2 + 1] < 0) {
                positions[i2 + 1] = 0;
                velocities[i2 + 1] *= -0.5;
            } else if (positions[i2 + 1] > canvas.height) {
                positions[i2 + 1] = canvas.height;
                velocities[i2 + 1] *= -0.5;
            }
        }
        
        // Update buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, velocities, gl.DYNAMIC_DRAW);
        
        // Reset scroll delta
        scrollDelta *= 0.9;
        
        requestAnimationFrame(render);
    }
    
    // Handle scroll events
    window.addEventListener('scroll', function() {
        const currentScrollY = window.scrollY;
        scrollDelta = currentScrollY - lastScrollY;
        lastScrollY = currentScrollY;
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        canvas.width = window.innerWidth;
    });
    
    // Enable point sprites
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Start animation
    requestAnimationFrame(render);
});
