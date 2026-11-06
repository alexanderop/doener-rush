import { definePreview } from '@storybook/react-vite'
import a11y from '@storybook/addon-a11y'
import '../src/styles.css'

export default definePreview({
  addons: [a11y()],
  // axe violations fail `pnpm test:stories`
  parameters: { layout: 'centered', a11y: { test: 'error' } },
  // Under Vitest, drive stories with real Playwright input instead of simulated DOM events.
  // Same swap Storybook's own repo does in code/.storybook/storybook.setup.ts
  loaders: [
    async (context) => {
      if (!('__vitest_browser__' in globalThis)) return
      const { userEvent } = await import('vitest/browser')
      // The Vitest runner owns this context; stories use the shared click/keyboard subset.
      Object.assign(context, { userEvent: userEvent.setup() })
    },
  ],
  decorators: [
    // the page background the app draws behind every component
    (Story) => (
        <div className="bg-background p-6 text-foreground">
          <Story />
        </div>
    ),
  ],
})
