import { Simulation } from './Simulation';
export { App };

class App {
  public static model: Model;
  public static view: View;
  public static controller: Controller;

  public static start() {
    this.model = new Model();
    this.view = new View();
    this.controller = new Controller();
    this.view.render();
  }
}

class Model {
  public data: {
    simulation: Simulation | null,
    simulation_config: { [key: string]: any }
    simulation_running: boolean,
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

class View {
  public elements: { [key: string]: HTMLElement };

  constructor() {
    this.elements = {};
  }

  public render() {
    const main_page: HTMLElement = this.main_page();
    document.body.appendChild(main_page);
  }

  private main_page(): HTMLElement {
    const navbar: HTMLElement = this.navbar();

    const main_page: HTMLElement = document.createElement('div');
    main_page.classList.add('container-xxl');
    {
      main_page.appendChild(navbar);

      const card = document.createElement('div');
      card.classList.add('card');
      const card_body = document.createElement('div');
      card_body.classList.add('card-body');

      const row: HTMLElement = document.createElement('div');
      row.classList.add('row', 'mb-2');
      // Simulation controls
      {
        const col: HTMLElement = document.createElement('div');
        col.classList.add('col-3');
        {
          // Simulation parameters form
          const form: HTMLElement = document.createElement('form');
          {
            const { gravity, n_particles, friction, bounce, pressure_multiplier, target_density, smoothing_radius } = App.model.data.simulation_config;
            const n_particles_input: HTMLElement = this.slider('Particles', 'n_particles', n_particles, 0, 5000, 1, App.controller.update_simulation_config);
            const gravity_input: HTMLElement = this.slider('Gravity', 'gravity', gravity, 0, 1, 0.01, App.controller.update_simulation_config);
            const friction_input: HTMLElement = this.slider('Friction', 'friction', friction, 0, 1, 0.01, App.controller.update_simulation_config);
            const bounce_input: HTMLElement = this.slider('Bounce', 'bounce', bounce, 0, 1, 0.01, App.controller.update_simulation_config);
            const pressure_multiplier_input: HTMLElement = this.slider('Pressure multiplier', 'pressure_multiplier', pressure_multiplier, 0, 10, 0.01, App.controller.update_simulation_config);
            const target_density_input: HTMLElement = this.slider('Target density', 'target_density', target_density, 0, 0.1, 0.001, App.controller.update_simulation_config);
            const smoothing_radius_input: HTMLElement = this.slider('Smoothing radius', 'smoothing_radius', smoothing_radius, 0, 100, 1, App.controller.update_simulation_config);
            form.appendChild(n_particles_input);
            form.appendChild(gravity_input);
            form.appendChild(friction_input);
            form.appendChild(bounce_input);
            form.appendChild(pressure_multiplier_input);
            form.appendChild(target_density_input);
            form.appendChild(smoothing_radius_input);
          }
          col.appendChild(form);
          // Control buttons
          const row: HTMLElement = document.createElement('div');
          row.classList.add('row', 'mb-2');
          {
            const col: HTMLElement = document.createElement('div');
            col.classList.add('col-12');
            const start_button: HTMLElement = document.createElement('button');
            start_button.classList.add('btn', 'btn-primary', 'mx-2');
            start_button.innerText = 'Start';
            start_button.onclick = App.controller.start_simulation;
            col.appendChild(start_button);
            const stop_button: HTMLElement = document.createElement('button');
            stop_button.classList.add('btn', 'btn-danger', 'mx-2');
            stop_button.innerText = 'Stop';
            stop_button.onclick = App.controller.stop_simulation;
            col.appendChild(stop_button);
            row.appendChild(col);
          }
          col.appendChild(row);
        }
        row.appendChild(col);
      }
      // Simulation canvas
      {
        const col: HTMLElement = document.createElement('div');
        col.classList.add('col-9');
        {
          const canvas: HTMLCanvasElement = document.createElement('canvas');
          canvas.width = App.model.data.simulation_config.width;
          canvas.height = App.model.data.simulation_config.height;
          canvas.onclick = App.controller.onclick_simulation
          col.appendChild(canvas);
          this.elements['canvas'] = canvas;
        }
        row.appendChild(col);
      }
      card_body.appendChild(row);
      card.appendChild(card_body);

      main_page.appendChild(card);
    }

    return main_page;
  }

  private slider(label: string, id: string, value: number, min: number, max: number, step: number, onchange: (event: Event) => void): HTMLElement {
    const slider: HTMLElement = document.createElement('div');
    slider.classList.add('mb-2');
    {
      const label_element: HTMLElement = document.createElement('label');
      label_element.setAttribute('for', id);
      label_element.innerText = label;
      slider.appendChild(label_element);

      const input: HTMLInputElement = document.createElement('input');
      input.classList.add('form-range');
      input.type = 'range';
      input.id = id;
      input.value = value.toString();
      input.min = min.toString();
      input.max = max.toString();
      input.step = step.toString();
      input.onchange = onchange;
      slider.appendChild(input);
    }

    return slider;
  }

  private navbar(): HTMLElement {
    const navbar: HTMLElement = document.createElement('nav');
    const container: HTMLElement = document.createElement('div');
    const brand: HTMLElement = document.createElement('a');

    navbar.classList.add('navbar', 'bg-body-tertiary', 'rounded', 'my-2', 'shadow-sm');
    container.classList.add('container-fluid');
    brand.classList.add('navbar-brand');

    brand.innerText = 'Ca arrive fort !';

    container.appendChild(brand);
    navbar.appendChild(container);

    return navbar;
  }
}

class Controller {
  public start_simulation(event: MouseEvent) {
    if (App.model.data.simulation_running) return;
    App.model.data.simulation_running = true;

    const canvas: HTMLCanvasElement = App.view.elements['canvas'] as HTMLCanvasElement;

    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (ctx === null) return;

    const { width, height } = App.model.data.simulation_config;
    const simulation: Simulation = new Simulation(ctx, width, height, App.model.data.simulation_config);
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