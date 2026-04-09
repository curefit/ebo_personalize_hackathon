import { useEffect, useState } from "react";
import {
  fetchAdminBootstrap,
  fetchBackOffice,
  loginAdmin,
  saveShopifySettings,
  triggerShopifySync,
} from "../services/apiClient";

const SEARCH_MODE_OPTIONS = [
  {
    value: "keyword-plus-recommendation-heuristics",
    label: "Keyword + recommendation heuristics",
  },
  {
    value: "vector-ready-hybrid",
    label: "Vector-ready hybrid",
  },
];

function buildSettingsForm(settings) {
  return {
    storeDomain: settings?.storeDomain || "",
    storefrontToken: "",
    apiVersion: settings?.apiVersion || "2025-01",
    syncEnabled: Boolean(settings?.syncEnabled),
    maxProducts: settings?.maxProducts || 250,
    searchMode: settings?.searchMode || "keyword-plus-recommendation-heuristics",
  };
}

export default function AdminConsole() {
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [token, setToken] = useState("");
  const [admin, setAdmin] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [settingsForm, setSettingsForm] = useState(buildSettingsForm(null));
  const [statusMessage, setStatusMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchAdminBootstrap()
      .then((payload) => {
        setDemoAccounts(payload.demoAccounts || []);
        if (payload.demoAccounts?.[0]) {
          setLoginForm({
            username: payload.demoAccounts[0].username,
            password: payload.demoAccounts[0].password,
          });
        }
      })
      .catch(() => {});
  }, []);

  async function loadBackOffice(nextToken, nextAdmin = admin) {
    setLoading(true);
    setSyncError("");
    try {
      const payload = await fetchBackOffice(nextToken);
      setToken(nextToken);
      setAdmin(nextAdmin);
      setSnapshot(payload);
      setSettingsForm(buildSettingsForm(payload.shopify));
    } catch (error) {
      setSyncError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");

    try {
      const payload = await loginAdmin(loginForm.username, loginForm.password);
      await loadBackOffice(payload.token, payload.admin);
    } catch (error) {
      setLoginError(error.message);
    }
  }

  async function handleSaveSettings(event) {
    event.preventDefault();
    setStatusMessage("");
    setSyncError("");

    try {
      const payload = await saveShopifySettings(token, settingsForm);
      setSettingsForm(buildSettingsForm(payload.settings));
      setStatusMessage("Shopify sync settings saved.");
      await loadBackOffice(token, admin);
    } catch (error) {
      setSyncError(error.message);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setStatusMessage("");
    setSyncError("");

    try {
      const payload = await triggerShopifySync(token, settingsForm);
      setStatusMessage(`Sync complete. Imported ${payload.sync.productCount} products.`);
      await loadBackOffice(token, admin);
    } catch (error) {
      setSyncError(error.message);
    } finally {
      setSyncing(false);
    }
  }

  if (!token) {
    return (
      <main className="admin-shell">
        <section className="admin-login-stage">
          <div className="admin-poster">
            <span className="eyebrow">Back office</span>
            <h1>Sync the in-store rack directly from Shopify.</h1>
            <p>Use the storefront API as the source of truth, keep sync history in SQLite, and reserve vector search for richer stylist prompts later.</p>

            <div className="demo-account-list">
              {demoAccounts.map((account) => (
                <div key={account.username} className="demo-account">
                  <strong>{account.name}</strong>
                  <span>{account.username}</span>
                  <span>{account.password}</span>
                </div>
              ))}
            </div>
          </div>

          <form className="admin-login-card" onSubmit={handleLogin}>
            <div className="brief-copy">
              <span className="eyebrow">Admin sign-in</span>
              <h2>Use a dummy back office account.</h2>
              <p>This is a protected flow for sync setup and catalog operations only.</p>
            </div>

            <label className="field">
              <span>Username</span>
              <input
                value={loginForm.username}
                onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
              />
            </label>

            {loginError ? <p className="form-error">{loginError}</p> : null}

            <div className="brief-actions">
              <button type="submit" className="primary-button">
                Enter back office
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <span className="eyebrow">Authenticated back office</span>
          <h1>Catalog sync console</h1>
          <p>{admin?.name} is signed in. Configure Shopify storefront sync and keep search architecture vector-ready.</p>
        </div>
      </header>

      <section className="admin-grid">
        <form className="workspace-panel" onSubmit={handleSaveSettings}>
          <div className="brief-copy">
            <span className="eyebrow">Shopify storefront sync</span>
            <h2>Connection settings</h2>
            <p>Save the store domain, storefront token, and sync profile. Tokens are stored locally for this demo.</p>
          </div>

          <div className="profile-edit-grid">
            <label className="field">
              <span>Store domain</span>
              <input
                placeholder="your-store.myshopify.com"
                value={settingsForm.storeDomain}
                onChange={(event) => setSettingsForm((current) => ({ ...current, storeDomain: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>Storefront token</span>
              <input
                type="password"
                placeholder="shpat_... or storefront access token"
                value={settingsForm.storefrontToken}
                onChange={(event) => setSettingsForm((current) => ({ ...current, storefrontToken: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>API version</span>
              <input
                value={settingsForm.apiVersion}
                onChange={(event) => setSettingsForm((current) => ({ ...current, apiVersion: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>Max products per sync</span>
              <input
                type="number"
                min="20"
                max="1000"
                value={settingsForm.maxProducts}
                onChange={(event) => setSettingsForm((current) => ({ ...current, maxProducts: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>Search mode</span>
              <select
                value={settingsForm.searchMode}
                onChange={(event) => setSettingsForm((current) => ({ ...current, searchMode: event.target.value }))}
              >
                {SEARCH_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field checkbox-field">
              <span>Sync enabled</span>
              <input
                type="checkbox"
                checked={settingsForm.syncEnabled}
                onChange={(event) => setSettingsForm((current) => ({ ...current, syncEnabled: event.target.checked }))}
              />
            </label>
          </div>

          {statusMessage ? <p className="loading-copy">{statusMessage}</p> : null}
          {syncError ? <p className="form-error">{syncError}</p> : null}

          <div className="brief-actions">
            <button type="submit" className="ghost-button">
              Save settings
            </button>
            <button type="button" className="primary-button" onClick={handleSync} disabled={syncing || loading}>
              {syncing ? "Syncing..." : "Run sync now"}
            </button>
          </div>
        </form>

        <div className="admin-stack">
          <section className="workspace-panel">
            <div className="brief-copy">
              <span className="eyebrow">Current architecture</span>
              <h2>Search + retrieval posture</h2>
              <p>{snapshot?.searchArchitecture?.note}</p>
            </div>

            <div className="token-row">
              <span className="mini-pill">{snapshot?.searchArchitecture?.currentMode || "loading"}</span>
              <span className="mini-pill mini-pill-dark">
                {snapshot?.searchArchitecture?.vectorDbPlanned ? "vector DB planned" : "keyword only"}
              </span>
            </div>
          </section>

          <section className="workspace-panel">
            <div className="brief-copy">
              <span className="eyebrow">Recent sync runs</span>
              <h2>Catalog history</h2>
            </div>

            <div className="sync-run-list">
              {(snapshot?.syncRuns || []).map((run) => (
                <article key={run.id} className="sync-run">
                  <div>
                    <strong>{run.provider}</strong>
                    <p>{run.summary || run.status}</p>
                  </div>
                  <div className="sync-run-meta">
                    <span>{run.productCount} products</span>
                    <span>{run.status}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
