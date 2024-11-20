// @ts-check
import { defineConfig } from 'astro/config';

import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],

  site: "https://natxo09.github.io/smartpomodoro/",
  base: "smartpomodoro"
});
