import Fluid_Simulation from "../simulations/Fluid_Simulation";

export default class Model {
    public data: {
        simulation: Fluid_Simulation | null;
        simulation_config: { [key: string]: any };
        simulation_running: boolean;
    };
    constructor() {
        this.data = {
            simulation: null,
            simulation_config: {
                width: 800,
                height: 800,
                n_particles: 1000,
                gravity: 0,
                bounce: 0.4,
                friction: 0.1,
                pressure_multiplier: 0.007,
                target_density: 0.2,
                smoothing_radius: 50,
            },
            simulation_running: false,
        };
    }
}
