import { defineMain } from '@storybook/react-vite/node'

export default defineMain({
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  // `Story.test(name, fn)`: one Vitest test per interaction instead of one long play function
  features: { experimentalTestSyntax: true },
  async viteFinal(config) {
    // TanStack Start's ~20 plugins expect a full server app; the stories only need React + Tailwind
    config.plugins = config.plugins?.flat().filter(
      (p) => !(p && 'name' in p && p.name.startsWith('tanstack-start')),
    )

    return config
  },
})
