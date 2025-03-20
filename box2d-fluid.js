// Box2D-based Fluid Simulation that interacts with scrolling
document.addEventListener('DOMContentLoaded', function() {
    console.log('Box2D fluid simulation initializing...');
    
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
    
    // Get 2D context
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas 2D not supported');
        return;
    }
    
    // Load Box2D
    const loadBox2D = async () => {
        try {
            // Check if Box2D is already loaded
            if (typeof Box2D === 'undefined') {
                // Create script element to load Box2D
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/box2d/2.3.1/Box2d.min.js';
                script.async = true;
                
                // Wait for script to load
                await new Promise((resolve, reject) => {
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
                
                console.log('Box2D loaded successfully');
            }
            
            // Initialize Box2D simulation
            initBox2D();
        } catch (error) {
            console.error('Failed to load Box2D:', error);
            // Fallback to simple particle system
            initSimpleParticles();
        }
    };
    
    // Initialize Box2D simulation
    function initBox2D() {
        // Box2D aliases
        const b2Vec2 = Box2D.Common.Math.b2Vec2;
        const b2BodyDef = Box2D.Dynamics.b2BodyDef;
        const b2Body = Box2D.Dynamics.b2Body;
        const b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
        const b2World = Box2D.Dynamics.b2World;
        const b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
        const b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
        const b2DebugDraw = Box2D.Dynamics.b2DebugDraw;
        
        // Physics constants
        const SCALE = 30; // Pixels per meter
        const STEP = 1/60; // Time step
        
        // Create world with gravity
        const gravity = new b2Vec2(0, 10); // Default gravity pointing down
        const world = new b2World(gravity, true); // Allow sleep
        
        // Create boundary walls
        createBoundaries();
        
        // Create particles
        const particles = [];
        const particleCount = 1000; // Increased number of particles
        
        for (let i = 0; i < particleCount; i++) {
            particles.push(createParticle());
        }
        
        // Scroll parameters
        let lastScrollY = window.scrollY;
        let scrollDelta = 0;
        
        // Create boundaries
        function createBoundaries() {
            // Ground
            const groundDef = new b2BodyDef();
            groundDef.position.Set(canvas.width / (2 * SCALE), canvas.height / SCALE);
            const ground = world.CreateBody(groundDef);
            const groundShape = new b2PolygonShape();
            groundShape.SetAsBox(canvas.width / (2 * SCALE), 0.5);
            
            // Create ground fixture with collision filtering
            const groundFixture = new b2FixtureDef();
            groundFixture.shape = groundShape;
            groundFixture.density = 0;
            groundFixture.friction = 0.3;
            groundFixture.filter.categoryBits = 0x0001; // Category for boundaries
            groundFixture.filter.maskBits = 0x0002; // Collide with particles
            ground.CreateFixture(groundFixture);
            
            // Left wall
            const leftWallDef = new b2BodyDef();
            leftWallDef.position.Set(0, canvas.height / (2 * SCALE));
            const leftWall = world.CreateBody(leftWallDef);
            const leftWallShape = new b2PolygonShape();
            leftWallShape.SetAsBox(0.5, canvas.height / (2 * SCALE));
            
            // Create left wall fixture with collision filtering
            const leftWallFixture = new b2FixtureDef();
            leftWallFixture.shape = leftWallShape;
            leftWallFixture.density = 0;
            leftWallFixture.friction = 0.3;
            leftWallFixture.filter.categoryBits = 0x0001; // Category for boundaries
            leftWallFixture.filter.maskBits = 0x0002; // Collide with particles
            leftWall.CreateFixture(leftWallFixture);
            
            // Right wall
            const rightWallDef = new b2BodyDef();
            rightWallDef.position.Set(canvas.width / SCALE, canvas.height / (2 * SCALE));
            const rightWall = world.CreateBody(rightWallDef);
            const rightWallShape = new b2PolygonShape();
            rightWallShape.SetAsBox(0.5, canvas.height / (2 * SCALE));
            
            // Create right wall fixture with collision filtering
            const rightWallFixture = new b2FixtureDef();
            rightWallFixture.shape = rightWallShape;
            rightWallFixture.density = 0;
            rightWallFixture.friction = 0.3;
            rightWallFixture.filter.categoryBits = 0x0001; // Category for boundaries
            rightWallFixture.filter.maskBits = 0x0002; // Collide with particles
            rightWall.CreateFixture(rightWallFixture);
        }
        
        // Create a particle
        function createParticle() {
            // Random position at bottom half of canvas
            const x = Math.random() * canvas.width;
            const y = canvas.height - Math.random() * (canvas.height / 2);
            
            // Create body definition
            const bodyDef = new b2BodyDef();
            bodyDef.type = b2Body.b2_dynamicBody;
            bodyDef.position.Set(x / SCALE, y / SCALE);
            
            // Create body
            const body = world.CreateBody(bodyDef);
            
            // Create circle shape
            const shape = new b2CircleShape();
            shape.SetRadius(0.3 + Math.random() * 0.2); // Larger random size
            
            // Create fixture with collision filtering
            const fixtureDef = new b2FixtureDef();
            fixtureDef.shape = shape;
            fixtureDef.density = 1.0;
            fixtureDef.friction = 0.3;
            fixtureDef.restitution = 0.2; // Slightly more bounce
            
            // Enable particle-to-particle collisions
            // Set collision categories and masks
            fixtureDef.filter.categoryBits = 0x0002; // Category for particles
            fixtureDef.filter.maskBits = 0x0001 | 0x0002; // Collide with boundaries (0x0001) and other particles (0x0002)
            
            // Add fixture to body
            body.CreateFixture(fixtureDef);
            
            // Return particle object
            return {
                body: body,
                color: '#4a90e2', // Blue color
                radius: shape.GetRadius() * SCALE
            };
        }
        
        // Update world
        function update() {
            // Update gravity based on scroll
            if (scrollDelta !== 0) {
                // Calculate scroll velocity
                const scrollVelocity = scrollDelta / STEP;
                const maxScrollVelocity = 1000;
                const normalizedScrollVelocity = Math.min(Math.abs(scrollVelocity), maxScrollVelocity) / maxScrollVelocity;
                
                // Update gravity
                if (scrollDelta > 0) {
                    // Scrolling down - canvas moves up, particles should move down
                    world.SetGravity(new b2Vec2(0, 10 + normalizedScrollVelocity * 20));
                } else if (scrollDelta < 0) {
                    // Scrolling up - canvas moves down, particles should move up
                    world.SetGravity(new b2Vec2(0, 10 - normalizedScrollVelocity * 20));
                }
                
                // Reset scroll delta
                scrollDelta *= 0.9;
            } else {
                // Reset to default gravity
                world.SetGravity(new b2Vec2(0, 10));
            }
            
            // Step the world
            world.Step(STEP, 10, 10);
            world.ClearForces();
        }
        
        // Draw particles
        function draw() {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw each particle
            for (let i = 0; i < particles.length; i++) {
                const particle = particles[i];
                const position = particle.body.GetPosition();
                const x = position.x * SCALE;
                const y = position.y * SCALE;
                const radius = particle.radius;
                
                // Create gradient for volume effect
                const gradient = ctx.createRadialGradient(
                    x, y, 0,
                    x, y, radius
                );
                gradient.addColorStop(0, 'rgba(120, 190, 255, 1.0)'); // Brighter blue in center
                gradient.addColorStop(0.6, 'rgba(74, 144, 226, 0.9)'); // Main blue color
                gradient.addColorStop(1, 'rgba(74, 144, 226, 0.2)'); // Slight fade at edges
                
                // Draw circle
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
            }
        }
        
        // Animation loop
        function animate() {
            update();
            draw();
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
            
            // Find and destroy all boundary bodies
            for (let body = world.GetBodyList(); body; body = body.GetNext()) {
                if (body.GetType() === b2Body.b2_staticBody) {
                    world.DestroyBody(body);
                }
            }
            
            // Recreate boundaries
            createBoundaries();
        });
        
        // Start animation
        animate();
    }
    
    // Fallback to simple particle system if Box2D fails to load
    function initSimpleParticles() {
        console.log('Using simple particle system fallback');
        
        // Particle system
        const particles = [];
        const particleCount = 1000; // Increased number of particles
        
        // Initialize particles
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: canvas.height - Math.random() * (canvas.height / 2),
                vx: 0,
                vy: 0,
                radius: 8 + Math.random() * 7, // Larger particles
                color: '#4a90e2'
            });
        }
        
        // Gravity and scroll parameters
        let gravity = 0.2;
        let lastScrollY = window.scrollY;
        let scrollDelta = 0;
        
        // Animation loop
        function animate() {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
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
                if (p.x - p.radius < 0) {
                    p.x = p.radius;
                    p.vx *= -0.5;
                } else if (p.x + p.radius > canvas.width) {
                    p.x = canvas.width - p.radius;
                    p.vx *= -0.5;
                }
                
                if (p.y - p.radius < 0) {
                    p.y = p.radius;
                    p.vy *= -0.5;
                } else if (p.y + p.radius > canvas.height) {
                    p.y = canvas.height - p.radius;
                    p.vy *= -0.5;
                }
                
                // Draw particle with volume
                const gradient = ctx.createRadialGradient(
                    p.x, p.y, 0,
                    p.x, p.y, p.radius
                );
                gradient.addColorStop(0, 'rgba(120, 190, 255, 1.0)'); // Brighter blue in center
                gradient.addColorStop(0.6, 'rgba(74, 144, 226, 0.9)'); // Main blue color
                gradient.addColorStop(1, 'rgba(74, 144, 226, 0.2)'); // Slight fade at edges
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
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
    
    // Load Box2D and initialize simulation
    loadBox2D();
});
