class Simulation {
    private running: boolean = false;
    // Canvas
    private ctx: CanvasRenderingContext2D;
    private width: number;
    private height: number;
    // Parameters
    private n_particles: number = 0;
    private gravity: number = 0;
    private friction: number = 0;
    private bounce: number = 0;
    private target_density: number = 1;
    private pressure_multiplier: number = 1;
    private smoothing_radius: number = 0;
    // Particles
    private particles: Particle[];
    private densities: number[];
    private velocities: { x: number, y: number }[];
    private spacial_lookup: { cell_key: number, particle_index: number }[];
    private start_indices: number[];
    // Debug
    private debug: Simulation_Debug = new Simulation_Debug();


    constructor(canvas: HTMLCanvasElement, width: number, height: number) {
        this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        this.width = width;
        this.height = height;
        this.particles = [];
        this.densities = [];
        this.velocities = [];
        this.spacial_lookup = [];
        this.start_indices = [];
    }

    public configure(config: { [key: string]: any }): void {
        this.n_particles = config.n_particles;
        this.gravity = config.gravity;
        this.friction = config.friction;
        this.bounce = config.bounce;
        this.target_density = config.target_density;
        this.pressure_multiplier = config.pressure_multiplier;
        this.smoothing_radius = config.smoothing_radius;
        this.particles = this.create_random_particles();

        this.densities = this.particles.map(particle => particle.mass);
        this.velocities = this.particles.map(particle => ({ x: 0, y: 0 }));

        console.log('config:', config);
    }

    public start(): void {
        this.running = true;
        this.animate();
    }

    public stop(): void {
        this.running = false;
    }

    public restart(): void {
        this.stop();
        this.start();
    }

    public onclick(x: number, y: number): void {
        this.debug.add_circle(x, y, this.smoothing_radius, 'red');
        const density = this.calculate_density(x, y);
        console.log('density:', density);
    }


    private position_to_cell_coord(x: number, y: number): { x: number, y: number } {
        const cell_size = this.smoothing_radius;
        const cell_x = Math.floor(x / cell_size);
        const cell_y = Math.floor(y / cell_size);
        return { x: cell_x, y: cell_y };
    }

    private hash_cell(x: number, y: number): number {
        const a = x * 15823;
        const b = y * 9737333;
        return a + b;
    }

    private get_cell_key_from_hash(hash: number): number {
        return hash % this.spacial_lookup.length;
    }

    private update_spacial_lookup(): void {
        this.spacial_lookup = [];
        this.start_indices = [];
        this.spacial_lookup.map(() => ({ cell_key: -1, particle_index: -1 }));
        this.start_indices.map(() => -1);
        // Calculate spacial lookup
        this.particles.forEach((particle: Particle, index: number) => {
            const cell_coord = this.position_to_cell_coord(particle.x, particle.y);
            const cell_key = this.get_cell_key_from_hash(this.hash_cell(cell_coord.x, cell_coord.y));
            this.spacial_lookup.push({ cell_key, particle_index: index });
        });
        console.log('spacial_lookup:', this.spacial_lookup);
        // Sort
        this.spacial_lookup.sort((a, b) => a.cell_key - b.cell_key);
        // Find start indices
        let last_key = this.spacial_lookup[0].cell_key;
        this.start_indices[last_key] = 0;
        for (let i = 1; i < this.spacial_lookup.length; i++) {
            const key = this.spacial_lookup[i].cell_key;
            if (key !== last_key) {
                this.start_indices[key] = i;
                last_key = key;
            }
        }
    }

    private foreach_particles_within_radius(x: number, y: number, callback: (particle: Particle, index: number) => void): void {
        const center_coord = this.position_to_cell_coord(x, y);
        for (let i = center_coord.x - 1; i <= center_coord.x + 1; i++) {
            for (let j = center_coord.y - 1; j <= center_coord.y + 1; j++) {
                const key = this.get_cell_key_from_hash(this.hash_cell(i, j));
                const start_index = this.start_indices[key];
                for (let k = start_index; k < this.spacial_lookup.length; k++) {
                    if (this.spacial_lookup[k].cell_key !== key) {
                        break;
                    }
                    const particle = this.particles[this.spacial_lookup[k].particle_index];
                    const distance = this.calculate_distance(x, y, particle.x, particle.y);
                    if (distance <= this.smoothing_radius) {
                        callback(particle, this.spacial_lookup[k].particle_index);
                    }
                }
            }
        }
    }

    private smoothing_kernel(distance: number): number {
        if (distance >= this.smoothing_radius)
            return 0;
        const volume = (Math.PI * Math.pow(this.smoothing_radius, 4)) / 6;
        return Math.pow(this.smoothing_radius - distance, 2) / volume;
    }

    private somoothing_kernel_derivative(distance: number): number {
        if (distance >= this.smoothing_radius)
            return 0;
        const scale = 12 / (Math.PI * Math.pow(this.smoothing_radius, 4));
        return Math.pow(distance - this.smoothing_radius, 1) * scale;
    }

    private calculate_distance(x1: number, y1: number, x2: number, y2: number): number {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    private calculate_density(x: number, y: number): number {
        let density = 0;
        // this.foreach_particles_within_radius(x, y, (particle: Particle, index: number) => {
        //     const distance = this.calculate_distance(x, y, particle.x, particle.y);
        //     const influence = this.smoothing_kernel(distance);
        //     density += particle.mass * influence
        // });
        this.particles.forEach(particle => {
            const distance = this.calculate_distance(x, y, particle.x, particle.y);
            const influence = this.smoothing_kernel(distance);
            density += particle.mass * influence
        });
        return density;
    }

    private convert_density_to_pressure(density: number): number {
        return this.pressure_multiplier * (density - this.target_density);
    }

    private calculate_shared_pressure(density1: number, density2: number): number {
        const pressure1 = this.convert_density_to_pressure(density1);
        const pressure2 = this.convert_density_to_pressure(density2);
        return (pressure1 + pressure2) / 2;
    }

    private calculate_pressure(particle_index: number): { x: number, y: number } {
        let pressure: { x: number, y: number } = { x: 0, y: 0 };
        let direction: { x: number, y: number } = { x: 0, y: 0 };
        const particle = this.particles[particle_index];
        // this.foreach_particles_within_radius(particle.x, particle.y, (other_particle: Particle, other_particle_index: number) => {
        //     const distance = this.calculate_distance(particle.x, particle.y, other_particle.x, other_particle.y);
        //     if (distance == 0) {
        //         direction.x = Math.random();
        //         direction.y = Math.random();
        //     } else {
        //         direction.x = (other_particle.x - particle.x) / distance;
        //         direction.y = (other_particle.y - particle.y) / distance;
        //     }
        //     const slope = this.somoothing_kernel_derivative(distance);
        //     const density = this.densities[other_particle_index];
        //     const shared_pressure = this.calculate_shared_pressure(density, this.densities[particle_index]);
        //     pressure.x += shared_pressure * direction.x * slope * particle.mass / density;
        //     pressure.y += shared_pressure * direction.y * slope * particle.mass / density;
        // });

        this.particles.forEach((other_particle: Particle, other_particle_index: number) => {
            if (other_particle_index === particle_index) {
                return;
            }
            const distance = this.calculate_distance(particle.x, particle.y, other_particle.x, other_particle.y);
            if (distance == 0) {
                direction.x = Math.random();
                direction.y = Math.random();
            } else {
                direction.x = (other_particle.x - particle.x) / distance;
                direction.y = (other_particle.y - particle.y) / distance;
            }
            const slope = this.somoothing_kernel_derivative(distance);
            const density = this.densities[other_particle_index];
            const shared_pressure = this.calculate_shared_pressure(density, this.densities[particle_index]);
            pressure.x += shared_pressure * direction.x * slope * particle.mass / density;
            pressure.y += shared_pressure * direction.y * slope * particle.mass / density;
        });
        return pressure;
    }

    private create_random_particles(): Particle[] {
        const particles: Particle[] = [];
        const mass = 10;
        for (let i = 0; i < this.n_particles; i++) {
            const x = mass + Math.random() * (this.width - mass * 2);
            const y = mass + Math.random() * (this.height - mass * 2);
            const color = 'blue';
            particles.push(new Particle(x, y, mass, color));
        }
        return particles;
    }

    private create_grid_particles(): Particle[] {
        const particles: Particle[] = [];
        const mass = 10;
        const cols = 50;
        const rows = 50;
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const x = mass + (this.width / cols) * j;
                const y = mass + (this.height / rows) * i;
                const color = 'blue';
                particles.push(new Particle(x, y, mass, color));
            }
        }
        return particles;
    }



    private update(): void {
        this.update_spacial_lookup();
        this.particles.forEach((particle: Particle, i: number) => {
            this.densities[i] = this.calculate_density(particle.x, particle.y);

            // Apply gravity
            this.velocities[i].y += this.gravity;
            // Apply friction
            // this.velocities[i].x *= this.friction / 2;
            // this.velocities[i].y *= this.friction / 2;
            // Apply pressure
            const pressure = this.calculate_pressure(i);
            this.velocities[i].x += pressure.x / this.densities[i];
            this.velocities[i].y += pressure.y / this.densities[i];
            // Bounce
            if (particle.x - particle.radius < 0 || particle.x + particle.radius > this.width) {
                this.velocities[i].x *= -this.bounce;
            }
            if (particle.y - particle.radius < 0 || particle.y + particle.radius > this.height) {
                this.velocities[i].y *= -this.bounce;
            }
            // Update position
            particle.x += this.velocities[i].x;
            particle.y += this.velocities[i].y;
        });
    }

    private draw(): void {
        this.particles.forEach(particle => {
            particle.draw(this.ctx);
        });
        this.debug.draw(this.ctx);
    }

    private animate(): void {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.draw();
        this.update();
        if (this.running) {
            requestAnimationFrame(() => this.animate());
        }
    }
}

class Simulation_Debug {
    private circles: { x: number, y: number, radius: number, color: string }[] = [];
    private lines: { x1: number, y1: number, x2: number, y2: number, color: string }[] = [];
    private text: { x: number, y: number, text: string, color: string }[] = [];

    public add_circle(x: number, y: number, radius: number, color: string): void {
        this.circles.push({ x, y, radius, color });
    }

    public add_line(x1: number, y1: number, x2: number, y2: number, color: string): void {
        this.lines.push({ x1, y1, x2, y2, color });
    }

    public add_text(x: number, y: number, text: string, color: string): void {
        this.text.push({ x, y, text, color });
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        this.circles.forEach(circle => {
            ctx.beginPath();
            ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
            ctx.strokeStyle = circle.color;
            ctx.stroke();
        });
        this.lines.forEach(line => {
            ctx.beginPath();
            ctx.moveTo(line.x1, line.y1);
            ctx.lineTo(line.x2, line.y2);
            ctx.strokeStyle = line.color;
            ctx.stroke();
        });
        this.text.forEach(text => {
            ctx.font = '16px Arial';
            ctx.fillStyle = text.color;
            ctx.fillText(text.text, text.x, text.y);
        });
    }
}

class Particle {
    public x: number;
    public y: number;
    public mass: number;
    public color: string;
    public radius: number;
    public velocity: { x: number, y: number };

    constructor(x: number, y: number, mass: number, color: string) {
        this.x = x;
        this.y = y;
        this.mass = mass;
        this.radius = mass / 2;
        this.color = color;
        this.velocity = { x: 0, y: 0 };
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

export { Simulation }