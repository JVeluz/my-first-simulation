import Controller from "./Controller";
import Model from "./Model";
import View from "./View";

export default class App {
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
