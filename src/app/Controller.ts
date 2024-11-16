import App from "./App";
import Fluid_Simulation from "../simulations/Fluid_Simulation";

export default class Controller {
    public start_simulation(event: MouseEvent) {
        if (App.model.data.simulation_running) return;
        App.model.data.simulation_running = true;

        const canvas: HTMLCanvasElement = App.view.elements[
            "canvas"
        ] as HTMLCanvasElement;

        const ctx: CanvasRenderingContext2D | null = canvas.getContext("2d");
        if (ctx === null) return;

        const { width, height } = App.model.data.simulation_config;
        const simulation: Fluid_Simulation = new Fluid_Simulation(
            ctx,
            width,
            height,
            App.model.data.simulation_config
        );
        App.model.data.simulation = simulation;
        simulation.start();
    }

    public stop_simulation(event: MouseEvent) {
        if (!App.model.data.simulation_running) return;
        App.model.data.simulation_running = false;
        App.model.data.simulation?.stop();
    }

    public onclick_simulation(event: MouseEvent) {
        App.model.data.simulation?.onclick(event.offsetX, event.offsetY);
    }

    public update_simulation_config(event: Event) {
        const target: HTMLInputElement = event.target as HTMLInputElement;
        const key: string = target.id;
        const value: number = parseFloat(target.value);
        App.model.data.simulation_config[key] = value;
        App.model.data.simulation?.configure(App.model.data.simulation_config);
    }
}
