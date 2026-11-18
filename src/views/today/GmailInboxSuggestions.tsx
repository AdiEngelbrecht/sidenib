/*
 * Inbox suggestions above the Today tasks, moved out of App.tsx unchanged.
 * The connector is held back (GMAIL_CONNECTOR_VISIBLE in App.tsx), so this is
 * not rendered in current builds.
 */
import { ExternalLink, RefreshCw } from 'lucide-react'
import { IconButton } from '../../components/IconButton'
import type { GmailConnectorController, GmailThreadSuggestion } from '../../gmail'

export function GmailInboxSuggestions({
  gmail,
  onConvert,
}: {
  gmail: GmailConnectorController
  onConvert: (suggestion: GmailThreadSuggestion) => void
}) {
  const isConnected = gmail.status.state === 'connected'
  const needsReconnect = gmail.status.state === 'needs_reconnect'

  if (
    gmail.status.state === 'disconnected' &&
    gmail.suggestions.length === 0 &&
    !gmail.error
  ) {
    return null
  }

  return (
    <section className="sn-section gmail-suggestions" aria-label="Inbox suggestions">
      <div className="gmail-suggestions-header">
        <h2 className="sn-section-label">
          Inbox suggestions ·{' '}
          {isConnected && gmail.status.accountEmail
            ? gmail.status.accountEmail
            : needsReconnect
              ? 'Reconnect Gmail in settings'
              : 'Read-only Gmail'}
        </h2>
        <IconButton
          label="Sync Gmail inbox suggestions"
          disabled={!isConnected || gmail.isLoading}
          onClick={gmail.loadSuggestions}
        >
          <RefreshCw aria-hidden="true" />
        </IconButton>
      </div>

      <div className="sn-group">
        {gmail.error || needsReconnect ? (
          <p className="sn-note" role="status">
            <strong>{needsReconnect ? 'Reconnect needed' : 'Gmail paused'}.</strong>{' '}
            {gmail.error || gmail.status.message}
          </p>
        ) : null}

        {gmail.isLoading ? (
          <p className="sn-note" role="status">
            Checking inbox. Reading recent unread threads only.
          </p>
        ) : null}

        {!gmail.isLoading && isConnected && gmail.suggestions.length === 0 ? (
          <p className="sn-note">
            No unread suggestions. Ignored suggestions stay local on this
            device.
          </p>
        ) : null}

        {gmail.suggestions.map((suggestion) => (
          <article className="sn-row gmail-suggestion-row" key={suggestion.threadId}>
            <div className="sn-row-text">
              <span className="sn-row-title">{suggestion.subject}</span>
              <span className="sn-row-meta">
                {suggestion.from}
                {suggestion.date ? ` · ${suggestion.date}` : ''}
              </span>
            </div>
            <a
              className="sn-icon-button"
              aria-label={`Open Gmail thread ${suggestion.subject}`}
              href={suggestion.gmailUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" />
            </a>
            <button
              type="button"
              className="sn-chip"
              onClick={() => onConvert(suggestion)}
            >
              Add task
            </button>
            <button
              type="button"
              className="sn-chip"
              aria-label={`Ignore ${suggestion.subject}`}
              onClick={() =>
                gmail.ignoreSuggestion(suggestion.threadId, suggestion.subject)
              }
            >
              Ignore
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
