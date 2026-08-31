<template>
  <RouterView />
</template>

<style>
/* Broadcast overlay: transparent, full-viewport, no scrollbars.
   Routes: / (full broadcast), /ingame (ingame overlay), /pregame (2D champ select),
   /pregame-3d (3D champ select), /pregame-hybrid (2D layout + 3D pick models),
   /ingame/element/<name> (single element), /ingame/elements (index).
   Element positioning lives in views/overlay-layout.css. */
@layer base {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* Theme tokens (team colors, project accent, surface scrims) live in style.css
     so the dev preview entries share them. */
}

html,
body {
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  background: transparent;
  font-family:
    'Bebas Neue',
    system-ui,
    -apple-system,
    sans-serif;
  /* stats and timers tick every frame — tabular figures stop the jitter */
  font-variant-numeric: tabular-nums;
  color: #e2e8f0;
}
</style>
