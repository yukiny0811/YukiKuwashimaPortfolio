// SPH Fluid Simulation that interacts with scrolling
document.addEventListener('DOMContentLoaded', function() {
    console.log('SPH fluid simulation initializing...');
    
    // Get container element
    const container = document.getElementById('sph-fluid-container');
    if (!container) {
        console.error('SPH fluid container element not found!');
        return;
    }
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = 500; // Fixed height for the fluid section
    container.appendChild(canvas);
    
    // Get 2D context
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas 2D context not supported');
        return;
    }
    
    // SPH parameters
    const particleCount = 300;
    const particles = [];
    const particleRadius = 5;
    const particleMass = 1.0;
    const restDensity = 1.0;
    const gasConstant = 2000.0;
    const viscosity = 250.0;
    const dt = 0.016; // Time step
    
    // Gravity parameters
    let gravityX = 0;
    let gravityY = 980; // Default gravity pointing down
    let lastScrollY = window.scrollY;
    let scrollDelta = 0;
    
    // Boundary parameters
    const boundaryDamping = -0.5;
    
    // Smoothing kernel parameters
    const h = 20.0; // Smoothing length
    const h2 = h * h;
    const h6 = Math.pow(h, 6);
    const h9 = Math.pow(h, 9);
    const poly6Factor = 315.0 / (64.0 * Math.PI * h9);
    const spikyGradFactor = -45.0 / (Math.PI * h6);
    const viscLapFactor = 45.0 / (Math.PI * h6);
    
    // Color palette
    const colors = [
        { r: 62, g: 146, b: 204, a: 0.8 }, // Bright blue
        { r: 138, g: 79, b: 255, a: 0.8 }, // Purple
        { r: 90, g: 60, b: 220, a: 0.8 },  // Indigo
        { r: 26, g: 36, b: 99, a: 0.8 }    // Deep blue
    ];
    
    // Initialize particles
    function initParticles() {
        for (let i = 0; i < particleCount; i++) {
            const colorIndex = Math.floor(Math.random() * colors.length);
            const color = colors[colorIndex];
            
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * (canvas.height / 2), // Start in top half
                vx: 0,
                vy: 0,
                density: 0,
                pressure: 0,
                fx: 0,
                fy: 0,
                color: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`,
                radius: particleRadius
            });
        }
    }
    
    // Calculate density and pressure
    function computeDensityPressure() {
        for (let i = 0; i < particleCount; i++) {
            const particle = particles[i];
            particle.density = 0;
            
            // Compute density
            for (let j = 0; j < particleCount; j++) {
                const neighbor = particles[j];
                const dx = neighbor.x - particle.x;
                const dy = neighbor.y - particle.y;
                const r2 = dx * dx + dy * dy;
                
                if (r2 < h2) {
                    // Poly6 kernel
                    particle.density += particleMass * poly6Factor * Math.pow(h2 - r2, 3);
                }
            }
            
            // Compute pressure using equation of state
            particle.pressure = gasConstant * (particle.density - restDensity);
        }
    }
    
    // Calculate forces
    function computeForces() {
        for (let i = 0; i < particleCount; i++) {
            const particle = particles[i];
            let fx = 0;
            let fy = 0;
            
            // Pressure force and viscosity force
            for (let j = 0; j < particleCount; j++) {
                if (i === j) continue;
                
                const neighbor = particles[j];
                const dx = neighbor.x - particle.x;
                const dy = neighbor.y - particle.y;
                const r2 = dx * dx + dy * dy;
                
                if (r2 < h2 && r2 > 0.01) {
                    const r = Math.sqrt(r2);
                    const normalized_dx = dx / r;
                    const normalized_dy = dy / r;
                    
                    // Pressure force (using Spiky kernel gradient)
                    const pressureTerm = -particleMass * (particle.pressure + neighbor.pressure) / (2 * neighbor.density);
                    const pressureForce = spikyGradFactor * Math.pow(h - r, 2);
                    fx += pressureTerm * pressureForce * normalized_dx;
                    fy += pressureTerm * pressureForce * normalized_dy;
                    
                    // Viscosity force (using viscosity kernel laplacian)
                    const vx = neighbor.vx - particle.vx;
                    const vy = neighbor.vy - particle.vy;
                    const viscosityTerm = viscosity * particleMass / neighbor.density;
                    const viscosityForce = viscLapFactor * (h - r);
                    fx += viscosityTerm * viscosityForce * vx;
                    fy += viscosityTerm * viscosityForce * vy;
                }
            }
            
            // Add gravity
            fx += gravityX;
            fy += gravityY;
            
            particle.fx = fx;
            particle.fy = fy;
        }
    }
    
    // Integrate
    function integrate() {
        for (let i = 0; i < particleCount; i++) {
            const particle = particles[i];
            
            // Update velocity
            particle.vx += dt * particle.fx / particleMass;
            particle.vy += dt * particle.fy / particleMass;
            
            // Update position
            particle.x += dt * particle.vx;
            particle.y += dt * particle.vy;
            
            // Handle boundaries
            if (particle.x < particleRadius) {
                particle.vx *= boundaryDamping;
                particle.x = particleRadius;
            } else if (particle.x > canvas.width - particleRadius) {
                particle.vx *= boundaryDamping;
                particle.x = canvas.width - particleRadius;
            }
            
            if (particle.y < particleRadius) {
                particle.vy *= boundaryDamping;
                particle.y = particleRadius;
            } else if (particle.y > canvas.height - particleRadius) {
                particle.vy *= boundaryDamping;
                particle.y = canvas.height - particleRadius;
            }
        }
    }
    
    // Draw particles
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw each particle
        for (let i = 0; i < particleCount; i++) {
            const particle = particles[i];
            
            // Create radial gradient
            const gradient = ctx.createRadialGradient(
                particle.x, particle.y, 0,
                particle.x, particle.y, particle.radius * 2
            );
            
            // Extract color components
            const colorStr = particle.color;
            const rgbaMatch = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([.\d]+)\)/);
            
            if (rgbaMatch) {
                const r = rgbaMatch[1];
                const g = rgbaMatch[2];
                const b = rgbaMatch[3];
                const a = rgbaMatch[4];
                
                // Add gradient stops
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                
                ctx.fillStyle = gradient;
            } else {
                ctx.fillStyle = particle.color;
            }
            
            // Draw the particle
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw scroll indicator
        const arrowSize = 30;
        const arrowX = canvas.width - arrowSize - 20;
        const arrowY = canvas.height / 2;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        
        if (scrollDelta > 0) {
            // Down arrow
            ctx.moveTo(arrowX - arrowSize/2, arrowY - arrowSize/2);
            ctx.lineTo(arrowX + arrowSize/2, arrowY - arrowSize/2);
            ctx.lineTo(arrowX, arrowY + arrowSize/2);
        } else if (scrollDelta < 0) {
            // Up arrow
            ctx.moveTo(arrowX - arrowSize/2, arrowY + arrowSize/2);
            ctx.lineTo(arrowX + arrowSize/2, arrowY + arrowSize/2);
            ctx.lineTo(arrowX, arrowY - arrowSize/2);
        }
        
        ctx.closePath();
        ctx.fill();
    }
    
    // Main simulation loop
    function simulate() {
        computeDensityPressure();
        computeForces();
        integrate();
        draw();
        requestAnimationFrame(simulate);
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
        
        // Update gravity based on scroll direction and speed
        const scrollFactor = Math.min(Math.abs(scrollDelta), 50) / 50; // Normalize to 0-1
        const maxGravityX = 500; // Maximum horizontal gravity
        
        if (scrollDelta > 0) {
            // Scrolling down - gravity points down and right
            gravityX = scrollFactor * maxGravityX;
            gravityY = 980;
        } else if (scrollDelta < 0) {
            // Scrolling up - gravity points up and left
            gravityX = -scrollFactor * maxGravityX;
            gravityY = -980;
        } else {
            // Not scrolling - gravity points down
            gravityX = 0;
            gravityY = 980;
        }
        
        // Gradually reset gravity when not scrolling
        setTimeout(function() {
            if (Math.abs(scrollDelta) < 0.1) {
                gravityX *= 0.9;
                gravityY = 980;
            }
        }, 100);
    });
    
    // Initialize and start simulation
    initParticles();
    simulate();
});
