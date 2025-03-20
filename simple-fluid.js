// Simple Fluid Effect for Portfolio
// A simplified fluid-like effect that works across browsers

document.addEventListener('DOMContentLoaded', function() {
    console.log('Simple fluid effect initializing...');
    
    // Get container element
    const container = document.getElementById('fluid-canvas-container');
    if (!container) {
        console.error('Container element not found!');
        return;
    }
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    container.appendChild(canvas);
    
    // Get 2D context
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas 2D context not supported');
        return;
    }
    
    // Particles for fluid simulation
    const particles = [];
    const particleCount = 200; // Increased particle count for better visual effect
    const maxRadius = 60;
    const minRadius = 5;
    
    // Color palette
    const colors = [
        { r: 26, g: 36, b: 99 },  // Deep blue
        { r: 62, g: 146, b: 204 }, // Bright blue
        { r: 138, g: 79, b: 255 }, // Purple
        { r: 90, g: 60, b: 220 }   // Indigo
    ];
    
    // Connection settings
    const CONNECTION_DISTANCE = 150; // Maximum distance for particles to connect
    const USE_GRADIENT = true;       // Use gradient for particles
    const DRAW_CONNECTIONS = true;   // Draw connections between particles
    
    // Mouse interaction
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let mouseVelX = 0;
    let mouseVelY = 0;
    let lastMouseX = mouseX;
    let lastMouseY = mouseY;
    let mouseDown = false;
    
    // Create particles
    function createParticles() {
        for (let i = 0; i < particleCount; i++) {
            const colorIndex = Math.floor(Math.random() * colors.length);
            const color = colors[colorIndex];
            
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: minRadius + Math.random() * (maxRadius - minRadius),
                color: `rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`, // Increased opacity to make it more visible
                vx: Math.random() * 2 - 1,
                vy: Math.random() * 2 - 1,
                targetRadius: minRadius + Math.random() * (maxRadius - minRadius),
                originalRadius: minRadius + Math.random() * (maxRadius - minRadius)
            });
        }
    }
    
    // Update particles
    function updateParticles() {
        // Calculate mouse velocity
        mouseVelX = mouseX - lastMouseX;
        mouseVelY = mouseY - lastMouseY;
        lastMouseX = mouseX;
        lastMouseY = mouseY;
        
        // Update each particle
        particles.forEach(particle => {
            // Apply mouse influence if mouse is down
            if (mouseDown) {
                const dx = mouseX - particle.x;
                const dy = mouseY - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const maxDistance = 200;
                
                if (distance < maxDistance) {
                    const force = (1 - distance / maxDistance) * 2;
                    particle.vx += (mouseVelX * force) / 10;
                    particle.vy += (mouseVelY * force) / 10;
                    particle.targetRadius = particle.originalRadius * 1.5;
                } else {
                    particle.targetRadius = particle.originalRadius;
                }
            } else {
                particle.targetRadius = particle.originalRadius;
            }
            
            // Update radius with smooth transition
            particle.radius += (particle.targetRadius - particle.radius) * 0.1;
            
            // Apply velocity
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Apply friction
            particle.vx *= 0.98;
            particle.vy *= 0.98;
            
            // Boundary check with bounce
            if (particle.x - particle.radius < 0) {
                particle.x = particle.radius;
                particle.vx *= -0.7;
            } else if (particle.x + particle.radius > canvas.width) {
                particle.x = canvas.width - particle.radius;
                particle.vx *= -0.7;
            }
            
            if (particle.y - particle.radius < 0) {
                particle.y = particle.radius;
                particle.vy *= -0.7;
            } else if (particle.y + particle.radius > canvas.height) {
                particle.y = canvas.height - particle.radius;
                particle.vy *= -0.7;
            }
            
            // Random movement
            particle.vx += (Math.random() - 0.5) * 0.1;
            particle.vy += (Math.random() - 0.5) * 0.1;
        });
    }
    
    // Draw particles
    function drawParticles() {
        // Clear canvas with complete transparency to let the WebGL fluid show through
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw connections between particles
        if (DRAW_CONNECTIONS) {
            ctx.lineWidth = 1;
            
            for (let i = 0; i < particles.length; i++) {
                const particleA = particles[i];
                
                for (let j = i + 1; j < particles.length; j++) {
                    const particleB = particles[j];
                    
                    const dx = particleA.x - particleB.x;
                    const dy = particleA.y - particleB.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < CONNECTION_DISTANCE) {
                        // Calculate opacity based on distance
                        const opacity = 1 - (distance / CONNECTION_DISTANCE);
                        
                        // Extract color components from the first particle
                        const colorStr = particleA.color;
                        const rgbaMatch = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([.\d]+)\)/);
                        
                        if (rgbaMatch) {
                            const r = rgbaMatch[1];
                            const g = rgbaMatch[2];
                            const b = rgbaMatch[3];
                            
                            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.15})`;
                            ctx.beginPath();
                            ctx.moveTo(particleA.x, particleA.y);
                            ctx.lineTo(particleB.x, particleB.y);
                            ctx.stroke();
                        }
                    }
                }
            }
        }
        
        // Draw each particle
        particles.forEach(particle => {
            if (USE_GRADIENT) {
                // Create radial gradient
                const gradient = ctx.createRadialGradient(
                    particle.x, particle.y, 0,
                    particle.x, particle.y, particle.radius
                );
                
                // Extract color components
                const colorStr = particle.color;
                const rgbaMatch = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([.\d]+)\)/);
                
                if (rgbaMatch) {
                    const r = rgbaMatch[1];
                    const g = rgbaMatch[2];
                    const b = rgbaMatch[3];
                    
                    // Add gradient stops
                    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`);
                    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                    
                    ctx.fillStyle = gradient;
                } else {
                    ctx.fillStyle = particle.color;
                }
            } else {
                ctx.fillStyle = particle.color;
            }
            
            // Draw the particle
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Draw glow effect around mouse when pressed
        if (mouseDown) {
            const radius = 100;
            const gradient = ctx.createRadialGradient(
                mouseX, mouseY, 0,
                mouseX, mouseY, radius
            );
            
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(mouseX, mouseY, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Animation loop
    function animate() {
        updateParticles();
        drawParticles();
        requestAnimationFrame(animate);
    }
    
    // Event listeners
    canvas.addEventListener('mousemove', function(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    
    canvas.addEventListener('mousedown', function() {
        mouseDown = true;
    });
    
    canvas.addEventListener('mouseup', function() {
        mouseDown = false;
    });
    
    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
    }, { passive: false });
    
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        mouseDown = true;
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
        lastMouseX = mouseX;
        lastMouseY = mouseY;
    }, { passive: false });
    
    canvas.addEventListener('touchend', function() {
        mouseDown = false;
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
    
    // Initialize and start animation
    createParticles();
    animate();
    
    // Add some initial motion
    function addInitialMotion() {
        // Create a vortex pattern
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) * 0.3;
        
        particles.forEach((particle, index) => {
            const angle = (index / particles.length) * Math.PI * 2;
            particle.x = centerX + Math.cos(angle) * radius * Math.random();
            particle.y = centerY + Math.sin(angle) * radius * Math.random();
            
            // Tangential velocity for vortex
            particle.vx = -Math.sin(angle) * 2;
            particle.vy = Math.cos(angle) * 2;
        });
    }
    
    // Add initial motion
    addInitialMotion();
});
