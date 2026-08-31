<script setup lang="ts">
import { elements } from './elements'
</script>

<template>
  <div class="index">
    <h1>Overlay elements</h1>
    <p class="hint">
      Every element renders on its own page at its real overlay position, so pages double as
      per-element OBS browser sources. Add <code>?bg=dark</code> (or any CSS color, or
      <code>none</code>) to any page for a visible solid background while debugging. The default is
      transparent.
    </p>
    <p class="hint">
      <RouterLink to="/?bg=dark">Full broadcast</RouterLink> ·
      <RouterLink to="/ingame?bg=dark">ingame overlay</RouterLink> · standalone harnesses with mock
      data: <a href="/powerplay-preview.html">powerplay-preview</a>,
      <a href="/goldgraph-preview.html">goldgraph-preview</a>,
      <a href="/teamfight-preview.html">teamfight-preview</a>
    </p>

    <ul class="elements">
      <li v-for="element in elements" :key="element.slug">
        <RouterLink :to="`/ingame/element/${element.slug}?bg=dark`" class="element-link">
          {{ element.title }}
        </RouterLink>
        <code class="path">/ingame/element/{{ element.slug }}</code>
        <ul v-if="element.demoParams" class="params">
          <li v-for="param in element.demoParams" :key="param">
            <code>?{{ param }}</code>
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* The app body is a fixed 1920x1080 canvas with overflow hidden; the index is
   a normal page, so it scrolls inside its own fixed viewport container. */
.index {
  position: fixed;
  inset: 0;
  overflow: auto;
  padding: 32px 48px;
  background: #10131a;
}

h1 {
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 12px;
}

.hint {
  max-width: 900px;
  margin-bottom: 8px;
  color: #94a3b8;
  font-size: 14px;
}

a {
  color: var(--broadcast-accent);
}

.elements {
  margin-top: 24px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.element-link {
  font-size: 18px;
  font-weight: 700;
  text-decoration: none;
}

.element-link:hover {
  text-decoration: underline;
}

.path {
  margin-left: 12px;
  color: #64748b;
  font-size: 13px;
}

.params {
  list-style: none;
  margin: 2px 0 6px;
  padding-left: 16px;
  color: #94a3b8;
  font-size: 13px;
}
</style>
