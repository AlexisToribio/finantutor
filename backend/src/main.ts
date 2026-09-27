import "dotenv/config";
import { compose } from "./infrastructure/composition.js";
import { createApp } from "./infrastructure/app.js";
const port = Number(process.env.PORT ?? 8000);
createApp(compose()).listen(port, "127.0.0.1", () =>
  console.log(`Finantutor BFF: http://127.0.0.1:${port}`),
);
