/*
 * The Gmail connector row, moved out of App.tsx unchanged. The connector is
 * held back (GMAIL_CONNECTOR_VISIBLE in App.tsx), so this is not rendered in
 * current builds.
 */
import { Mail } from 'lucide-react'
import type { GmailConnectorController } from '../../gmail'

export function ConnectorSetting({ gmail }: { gmail: GmailConnectorController }) {
  const isConnected = gmail.status.state === 'connected'
  const needsReconnect = gmail.status.state === 'needs_reconnect'
  const isUnconfigured = gmail.status.state === 'unconfigured'
  const statusLabel =
    isConnected && gmail.status.accountEmail
      ? gmail.status.accountEmail
      : needsReconnect
        ? 'Reconnect required'
        : isUnconfigured
          ? 'Gmail login not enabled in this build'
          : 'Not connected'

  return (
    <div className={`connector-setting state-${gmail.status.state}`}>
      <div className="connector-summary">
        <Mail aria-hidden="true" />
        <div className="connector-copy">
          <strong>Gmail</strong>
          <span>Read-only inbox suggestions for local Sidenib tasks.</span>
          <em>{statusLabel}</em>
        </div>
        <div className="connector-actions">
          {isConnected ? (
            <>
              <button
                type="button"
                className="sn-chip"
                disabled={gmail.isLoading}
                onClick={gmail.loadSuggestions}
              >
                Sync
              </button>
              <button
                type="button"
                className="sn-chip"
                disabled={gmail.isLoading}
                onClick={gmail.disconnect}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              className="sn-chip"
              disabled={gmail.isLoading || isUnconfigured}
              onClick={gmail.connect}
            >
              {isUnconfigured
                ? 'OAuth setup missing'
                : needsReconnect
                  ? 'Reconnect Gmail'
                  : 'Connect Gmail'}
            </button>
          )}
        </div>
      </div>

      <p>
        <strong>Permission boundary.</strong> Sidenib requests Gmail read-only
        access. It can read recent unread inbox threads for suggestions, but
        it cannot send, delete, label, or archive email in this version.
      </p>

      <p role="status">
        {gmail.isLoading
          ? 'Working with Gmail...'
          : gmail.error || gmail.status.message}
      </p>

      <div aria-label="Gmail connector activity">
        <strong>Activity · {gmail.activities.length} events</strong>
        {gmail.activities.length > 0 ? (
          <ol>
            {gmail.activities.slice(0, 4).map((activity) => (
              <li key={activity.id}>
                <span>{activity.detail}</span>{' '}
                <time dateTime={activity.at}>
                  {new Intl.DateTimeFormat(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(activity.at))}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p>No Gmail reads yet.</p>
        )}
      </div>

      <p>
        This build is missing Sidenib's Google OAuth app credentials. Normal
        users should not create their own Google project; the public app build
        needs one verified app identity from the maintainer.
      </p>
    </div>
  )
}
