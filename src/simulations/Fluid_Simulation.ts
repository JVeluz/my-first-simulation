export default class Fluid_Simulation {
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
    private spacial_lookup: { key: number, particle_index: number }[];
    private start_indices: number[] = [];
    // Debug
    private debug: Fluid_Simulation_Debug = new Fluid_Simulation_Debug();


    constructor(ctx: CanvasRenderingContext2D, width: number, height: number, config: { [key: string]: any }) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
        this.spacial_lookup = [];
        this.configure(config);
        // this.particles = this.create_random_particles();
        this.particles = this.create_grid_particles();
        this.densities = this.particles.map(particle => particle.mass);
        this.velocities = this.particles.map(particle => ({ x: 0, y: 0 }));
    }

    public configure(config: { [key: string]: any }): void {
        this.n_particles = config.n_particles;
        this.gravity = config.gravity;
        this.friction = config.friction;
        this.bounce = config.bounce;
        this.target_density = config.target_density;
        this.pressure_multiplier = config.pressure_multiplier;
        this.smoothing_radius = config.smoothing_radius;
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
        const cell_size = this.smoothing_radius * 2;
        const cell_x = Math.floor(x / cell_size);
        const cell_y = Math.floor(y / cell_size);
        return { x: cell_x, y: cell_y };
    }

    private cell_coord_to_key(cell_coord: { x: number, y: number }): number {
        return cell_coord.x + cell_coord.y * this.width;
    }

    private key_to_cell_coord(key: number): { x: number, y: number } {
        const x = key % this.width;
        const y = Math.floor(key / this.width);
        return { x, y };
    }

    private update_spacial_lookup(): void {
        this.spacial_lookup = [];
        this.start_indices = [];
        // Create spacial lookup
        this.particles.forEach((particle, particle_index) => {
            const cell_coord = this.position_to_cell_coord(particle.x, particle.y);
            const key = this.cell_coord_to_key(cell_coord);
            this.spacial_lookup.push({ key, particle_index });
        });
        // Sort by key
        this.spacial_lookup.sort((a, b) => a.key - b.key);
        // Create start indices
        this.spacial_lookup.forEach((entry, i) => {
            if (i === 0 || entry.key !== this.spacial_lookup[i - 1].key) {
                this.start_indices[entry.key] = i;
            }
        });
    }

    private foreach_particles_within_radius(x: number, y: number, callback: (particle: Particle, index: number) => void): void {
        const cell_coord = this.position_to_cell_coord(x, y);
        const key = this.cell_coord_to_key(cell_coord);
        const start_index = this.start_indices[key];
        const end_index = this.start_indices[key + 1] || this.spacial_lookup.length;
        for (let i = start_index; i < end_index; i++) {
            const entry = this.spacial_lookup[i];
            const particle = this.particles[entry.particle_index];
            const distance = this.calculate_distance(x, y, particle.x, particle.y);
            if (distance < this.smoothing_radius) {
                callback(particle, entry.particle_index);
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
        this.foreach_particles_within_radius(x, y, (particle: Particle, index: number) => {
            const distance = this.calculate_distance(x, y, particle.x, particle.y);
            const influence = this.smoothing_kernel(distance);
            density += particle.mass * influence
        });
        // this.particles.forEach(particle => {
        //     const distance = this.calculate_distance(x, y, particle.x, particle.y);
        //     const influence = this.smoothing_kernel(distance);
        //     density += particle.mass * influence
        // });
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
        this.foreach_particles_within_radius(particle.x, particle.y, (other_particle: Particle, other_particle_index: number) => {
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
        // this.particles.forEach((other_particle: Particle, other_particle_index: number) => {
        //     if (other_particle_index === particle_index) {
        //         return;
        //     }
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
        const cols = 30;
        const rows = 30;
        const center = { x: this.width / 2, y: this.height / 2 };
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const x = center.x - cols / 2 * mass + j * mass;
                const y = center.y - rows / 2 * mass + i * mass;
                const color = 'blue';
                particles.push(new Particle(x, y, mass, color));
            }
        }
        return particles;
    }

    private update_particles(): void {
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

    private update(): void {
        this.update_spacial_lookup();
        this.update_particles();
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

class Fluid_Simulation_Debug {
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