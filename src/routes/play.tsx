import { createFileRoute } from '@tanstack/react-router'
import { PlayPage } from '#/app/pages/PlayPage'
import { validatePlaySearch } from '#/app/pages/playSearch'

/** The `/play` route, which runs one shift. */
export const Route = createFileRoute('/play')({
  // canvas and keyboard only exist in the browser
  ssr: false,
  validateSearch: validatePlaySearch,
  component: Play,
})

function Play() {
  return <PlayPage search={Route.useSearch()} />
}
