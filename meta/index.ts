import { createCLI } from "@vladpazych/dexter/meta";
import { release } from "./commands/release";

await createCLI({
  commands: { release },
}).run();
