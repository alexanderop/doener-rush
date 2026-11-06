import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '#/app/pages/HomePage'

/** The `/` route, the shop front. */
export const Route = createFileRoute('/')({ component: HomePage })
