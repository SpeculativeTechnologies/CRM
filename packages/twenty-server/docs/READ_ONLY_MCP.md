# Read-only CRM access from ChatGPT

Connect a private ChatGPT plugin to `https://<crm-api-host>/mcp/read-only` using OAuth. This endpoint is separate from the existing, general-purpose `/mcp` endpoint.

## Connect

1. Release and verify the server change through the normal review and staging workflow.
2. Make the read-only endpoint and its OAuth discovery/token/registration routes reachable by the MCP client over HTTPS, or use OpenAI's Secure MCP Tunnel for an approved private deployment. Keep the interactive CRM sign-in protected. A browser-only access gateway on the MCP route prevents server-to-server calls; configure routing through the deployment owner's normal workflow.
3. In ChatGPT, open **Plugins → + → Add custom MCP server**, enter the endpoint URL, select OAuth, and create the plugin. Availability depends on workspace policy. Use dynamic client registration; no CRM administrator API key or static client secret is needed.
4. Sign in to Twenty and approve **Read CRM records without changing them**. Refresh the plugin's tools if replacing an earlier connection.
5. Try “Find the CRM records for this company and summarize the latest notes, with links” or “List opportunities in this stage and show the total.” Validate the answers and permissions on the approved staging deployment before enabling a live connection.

OpenAI's current [connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt) and [OAuth guide](https://developers.openai.com/plugins/build/auth) describe the client-side flow.

## Tool contract

The endpoint exposes three tools regardless of the number of custom objects:

- `discover_crm_reads`: find available read operations by object name/description, or list all with an empty query.
- `describe_crm_read`: obtain one operation's input schema, including custom fields, filters, and relationship options.
- `read_crm`: execute a discovered `find_many`, `find_one`, or `group_by` database operation. The server checks the operation's execution target against the current permission-filtered allowlist on every request.

For example, discover `people`, describe `find_many_people`, then call:

```json
{
  "operation": "find_many_people",
  "input": { "select": ["id", "name", "company"], "limit": 10 }
}
```

Select only needed fields. `find_many` defaults to 10 records, accepts at most 100, and returns `count`, `hasNextPage`, and record references with source URLs. Use `offset` for later pages. Relationship summaries use Twenty's existing read services. Aggregates default to 50 groups and accept at most 100. Available objects, fields, and rows remain subject to the intersection of the signed-in user's role and the installed application's role.

This is an ordinary-chat MCP tool integration. It does not implement the standardized `search`/`fetch` contract for company knowledge or deep research, an embedded CRM UI, or attachment-content retrieval.

## Authorization boundary

- `/.well-known/oauth-protected-resource/mcp/read-only` publishes the exact resource and its path-specific authorization server metadata.
- `/.well-known/oauth-authorization-server/mcp/read-only` advertises authorization-code/PKCE S256 and refresh grants. Its `/oauth/register-read-only` registration endpoint always grants only `mcp:read`, including when a client requests broader defaults.
- The authorization request, code exchange, and refresh request must include the same `resource` URL. Consent forwards the requested scope and resource. `api` cannot be combined with `mcp:read`; client-credentials grants are unavailable for read-only registrations.
- Issued access and refresh credentials have dedicated `MCP_READ_ONLY_ACCESS` and `MCP_READ_ONLY_REFRESH` token types. Access credentials are valid only for POST requests to their exact read-only MCP resource. They cannot authenticate normal MCP, REST, GraphQL, or non-HTTP authentication contexts. Older servers do not recognize these token types.
- Each read-only request also requires active user consent for that workspace/application. Revoking the application grant immediately blocks the access credential, as well as future refreshes. The usual OAuth `/oauth/revoke` endpoint accepts the client ID and refresh token.
- Write operations, workflows, logic functions, generic `execute_tool`, and code execution are unavailable, including with `?mode=direct`. MCP `readOnlyHint` annotations describe this enforced behavior; they do not implement the restriction.

Existing application tokens and the normal MCP endpoint retain their behavior. No database migration is required: resource binding uses existing authorization-code JSON context and signed token claims.

## Review and rollback

Review the authentication boundary independently. Exercise discovery, consent, PKCE, standard/custom record reads, role and field restrictions, source links, pagination, refresh, and revocation on the exact staging release. Also attempt direct and nested write calls and normal API calls using a restricted credential. Local API checks do not establish that ChatGPT can reach a deployed instance through its gateway.

Before rolling back, disconnect the plugin and revoke/remove its read-only client registrations and grants. In-flight authorization codes should expire (five minutes) before reverting the OAuth implementation. Dedicated read-only access/refresh token types are rejected by the older implementation; do not create a replacement connection against a release lacking the read-only endpoint.
