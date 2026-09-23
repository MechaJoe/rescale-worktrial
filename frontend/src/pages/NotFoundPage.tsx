import { Link } from 'react-router'

import { useDocumentTitle } from '../lib/navigation'
import controls from '../styles/controls.module.css'
import page from '../styles/page.module.css'

import styles from './NotFoundPage.module.css'

interface NotFoundPageProps {
  title?: string
  message?: string
}

/** For a path that matches no route, and for a job that does not exist. */
export function NotFoundPage({
  title = 'Page not found',
  message = 'There is nothing at this address.',
}: NotFoundPageProps) {
  useDocumentTitle(`${title} · Jobs`)
  return (
    <div className={page.page}>
      <main className={styles.panel}>
        <h1 className={page.title}>{title}</h1>
        <p className={page.subtitle}>{message}</p>
        <Link to="/" className={`${controls.button} ${styles.action}`}>
          View all jobs
        </Link>
      </main>
    </div>
  )
}
