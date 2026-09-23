# Damage Flow contract

The authoritative source is `LeagueBroadcast/BlueBottleClient.GameLib/Ingame/State/Data/IngameDamageFlowData.cs`; regenerate its SDK DTOs rather than editing generated types.

```ts
enum DamageFlowView {
  StrongestConnections = 0,
  PlayerSpotlight = 1,
  DamageReceived = 2,
  MatchupMatrix = 3,
}
// Additive fields on the existing nodes/edges/startTime/endTime payload:
interface DamageFlowPresentation {
  view: DamageFlowView;
  attackingTeam: 1 | 2;
  highlightPlayerName?: string; // exact node.name, never displayName
  showDamageTypes?: boolean; // defaults to true when omitted
}
```

Caster buttons reuse their existing custom settings (`view`: `strongestConnections`, `playerSpotlight`, `damageReceived`, or `matchupMatrix`; `showDamageTypes`: boolean), team selector, time period and single-player picker. Each button can save its own choice. No ConfigFile schema change is required.

The existing `POST /api/ingame/showing` accepts typed overrides:

```json
{"damageFlow":{"show":true,"damageFlowView":1,"team":1,"highlightPlayerName":"SORA#DEMO","timePeriod":5,"showDamageTypes":true}}
```

Explicit `damageFlowView` overrides the button custom setting; an explicit raw player name overrides the role picker. Invalid view values fall back to Strongest Connections. A missing/invalid attacking team defaults to blue. A selected player anchors Player Spotlight to that player's team, and Damage Received to the opposing attacking team. The other views retain the chosen attacking team. The payload retains both teams and all edges; presentation never destructively filters the source data.

Without a player, Spotlight chooses the leading damage source and keeps that identity during the visible session. With an explicit unavailable player, it shows an unavailable state instead of silently selecting somebody else. A highlights matching top-three connections; C highlights the selected recipient row; D highlights the selected source row or recipient column. Highlighting does not remove the other data.

The typed `showDamageTypes` override takes precedence over the saved custom setting; omission defaults to true. A/B/C use Physical, Magic and True colors when available, retaining any unclassified remainder as Unknown. Invalid breakdowns never change damage totals. Entirely untyped data uses team colors. C keeps the biggest source bright and other attackers dim in either mode. D retains its shared magnitude scale. Backend mock payloads should exercise untyped, partial and rolling-window variants.

Older feeds without presentation fields render Strongest Connections, blue attacks. Scope remains full-game or the supplied rolling window, not latest fight. Derive cross-team totals from valid directed edges. Unknown/duplicate identities, negative/non-finite damage and same-team edges do not become valid plotted relationships. Use the actual opposite-direction edges when the attacking team changes.

Both custom clients pin SDK 1.13.0 and use its exported Damage Flow types; the two custom component implementations stay identical.
