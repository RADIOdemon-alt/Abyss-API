import express from "express";
import { routeLoader } from "./src/lib/routesLoader.js";
import runCodeRoute from "./src/routes/api/tools/run_code.js"; // 👈 استيراد المسار يدوي

async function setupApp(app, options = {}) {

  await routeLoader.loadRoutes(app, "api", "/api/v1");

  
  app.use("/api/v1/tools/run_code", runCodeRoute);

}

export default setupApp
