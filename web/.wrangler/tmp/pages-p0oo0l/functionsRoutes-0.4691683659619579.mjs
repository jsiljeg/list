import { onRequestGet as __api_availability_js_onRequestGet } from "C:\\Users\\Jure Siljeg\\IdeaProjects\\personal\\list\\web\\functions\\api\\availability.js"
import { onRequestPost as __api_reservations_js_onRequestPost } from "C:\\Users\\Jure Siljeg\\IdeaProjects\\personal\\list\\web\\functions\\api\\reservations.js"

export const routes = [
    {
      routePath: "/api/availability",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_availability_js_onRequestGet],
    },
  {
      routePath: "/api/reservations",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_reservations_js_onRequestPost],
    },
  ]