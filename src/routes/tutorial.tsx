import { createFileRoute } from '@tanstack/react-router'
import { TutorialPage } from '#/app/pages/TutorialPage'

/** The `/tutorial` route, the guided first shift. */
export const Route = createFileRoute('/tutorial')({
  // canvas and keyboard only exist in the browser
  ssr: false,
  component: TutorialPage,
})
